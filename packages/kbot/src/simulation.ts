// Simulation Agent — "what if" engine inspired by David Wolpert's
// mathematical framework for universe simulation. Models codebases
// and predicts outcomes of changes before executing them.

import { runAgent } from './agent.js'
import * as fs from 'node:fs'
import * as path from 'node:path'

export interface SimulationScenario {
  description: string
  targetFiles: string[]
  changeType: 'refactor' | 'add_feature' | 'delete' | 'migrate' | 'upgrade'
  constraints?: string[]
}

export interface BreakingChange {
  file: string
  line?: number
  description: string
  severity: 'warning' | 'error'
  suggestedFix?: string
}

export interface SimulationResult {
  scenario: SimulationScenario
  predictedOutcome: string
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  breakingChanges: BreakingChange[]
  estimatedEffort: string
  confidence: number
  recommendations: string[]
}

export interface ComparisonResult {
  scenarios: SimulationResult[]
  recommended: number
  reasoning: string
}

export interface FileNode {
  path: string
  exports: string[]
  imports: string[]
  size: number
}

export interface DependencyGraph {
  nodes: Map<string, FileNode>
  edges: Map<string, string[]> // file -> files that depend on it
}

const IMPORT_RE = /(?:import\s+.*?from\s+['"](.+?)['"]|require\s*\(\s*['"](.+?)['"]\s*\))/g
const EXPORT_RE = /export\s+(?:default\s+)?(?:function|class|const|let|var|interface|type|enum)\s+(\w+)/g

const SIMULATE_PROMPT = `You are a codebase simulation engine. Predict the outcome of a proposed change.

SCENARIO: {description}
CHANGE TYPE: {changeType}
TARGET FILES: {targetFiles}
{constraints}

DEPENDENCY GRAPH (files impacted):
{impactedFiles}

FILE CONTENTS:
{fileContents}

Analyze this change and predict:
1. What will break?
2. What tests will fail?
3. What runtime behavior will change?
4. What edge cases could cause bugs?

Respond in JSON:
{
  "predictedOutcome": "summary of what happens",
  "riskLevel": "low|medium|high|critical",
  "breakingChanges": [
    {"file": "path", "line": null, "description": "what breaks", "severity": "warning|error", "suggestedFix": "how to fix"}
  ],
  "estimatedEffort": "e.g. 1-2 hours",
  "confidence": 0.0-1.0,
  "recommendations": ["list", "of", "recommendations"]
}

Respond ONLY with the JSON object.`

export async function buildDependencyGraph(rootDir: string): Promise<DependencyGraph> {
  const nodes = new Map<string, FileNode>()
  const edges = new Map<string, string[]>() // reverse deps: file -> files that import it

  const files = walkDir(rootDir, ['.ts', '.tsx', '.js', '.jsx'])

  for (const filePath of files) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      const relPath = path.relative(rootDir, filePath)

      // Extract exports
      const exports: string[] = []
      let match: RegExpExecArray | null
      const exportRe = new RegExp(EXPORT_RE.source, 'g')
      while ((match = exportRe.exec(content)) !== null) {
        if (match[1]) exports.push(match[1])
      }

      // Extract imports
      const imports: string[] = []
      const importRe = new RegExp(IMPORT_RE.source, 'g')
      while ((match = importRe.exec(content)) !== null) {
        const importPath = match[1] || match[2]
        if (importPath && !importPath.startsWith('node_modules') && (importPath.startsWith('.') || importPath.startsWith('/'))) {
          const resolved = resolveImport(filePath, importPath, rootDir)
          if (resolved) imports.push(resolved)
        }
      }

      nodes.set(relPath, {
        path: relPath,
        exports,
        imports,
        size: content.length,
      })

      // Build reverse edges
      for (const imp of imports) {
        if (!edges.has(imp)) edges.set(imp, [])
        edges.get(imp)!.push(relPath)
      }
    } catch { /* skip unreadable files */ }
  }

  return { nodes, edges }
}

export function findImpactedFiles(
  graph: DependencyGraph,
  changedFiles: string[],
): string[] {
  const impacted = new Set<string>()
  const queue = [...changedFiles]

  while (queue.length > 0) {
    const file = queue.pop()!
    if (impacted.has(file)) continue
    impacted.add(file)

    // Find files that depend on this one
    const dependents = graph.edges.get(file) || []
    for (const dep of dependents) {
      if (!impacted.has(dep)) queue.push(dep)
    }
  }

  return [...impacted]
}

export async function simulateChange(
  scenario: SimulationScenario,
  graph?: DependencyGraph,
): Promise<SimulationResult> {
  const rootDir = process.cwd()
  const depGraph = graph || await buildDependencyGraph(rootDir)

  const impacted = findImpactedFiles(depGraph, scenario.targetFiles)
  const impactedSummary = impacted.slice(0, 20).join('\n')

  // Read target + impacted files (limited to prevent token overflow)
  const fileContents: string[] = []
  const filesToRead = [...new Set([...scenario.targetFiles, ...impacted.slice(0, 10)])]

  for (const f of filesToRead) {
    const fullPath = path.resolve(rootDir, f)
    try {
      const content = fs.readFileSync(fullPath, 'utf-8')
      fileContents.push(`### ${f}\n\`\`\`\n${content.slice(0, 2000)}\n\`\`\``)
    } catch { /* skip missing files */ }
  }

  const constraintText = scenario.constraints?.length
    ? `CONSTRAINTS:\n${scenario.constraints.map(c => `- ${c}`).join('\n')}`
    : ''

  const prompt = SIMULATE_PROMPT
    .replace('{description}', scenario.description)
    .replace('{changeType}', scenario.changeType)
    .replace('{targetFiles}', scenario.targetFiles.join(', '))
    .replace('{constraints}', constraintText)
    .replace('{impactedFiles}', impactedSummary)
    .replace('{fileContents}', fileContents.join('\n\n'))

  try {
    const result = await runAgent(prompt, {
      agent: 'coder',
      stream: false,
      skipPlanner: true,
    })

    const match = result.content.match(/\{[\s\S]*\}/)
    if (match) {
      const parsed = JSON.parse(match[0])
      return {
        scenario,
        predictedOutcome: parsed.predictedOutcome || 'Unable to predict',
        riskLevel: parsed.riskLevel || 'medium',
        breakingChanges: parsed.breakingChanges || [],
        estimatedEffort: parsed.estimatedEffort || 'unknown',
        confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
        recommendations: parsed.recommendations || [],
      }
    }
  } catch { /* fall through */ }

  return {
    scenario,
    predictedOutcome: 'Simulation could not complete',
    riskLevel: 'high',
    breakingChanges: [],
    estimatedEffort: 'unknown',
    confidence: 0,
    recommendations: ['Manual review recommended'],
  }
}

export class Simulator {
  private rootDir: string
  private graph: DependencyGraph | null = null

  constructor(rootDir?: string) {
    this.rootDir = rootDir || process.cwd()
  }

  async init(): Promise<void> {
    this.graph = await buildDependencyGraph(this.rootDir)
  }

  async simulate(scenario: SimulationScenario): Promise<SimulationResult> {
    if (!this.graph) await this.init()
    return simulateChange(scenario, this.graph!)
  }

  async compareScenarios(scenarios: SimulationScenario[]): Promise<ComparisonResult> {
    if (!this.graph) await this.init()

    const results: SimulationResult[] = []
    for (const scenario of scenarios) {
      results.push(await simulateChange(scenario, this.graph!))
    }

    // Rank by lowest risk + highest confidence
    const riskOrder = { low: 0, medium: 1, high: 2, critical: 3 }
    let bestIdx = 0
    let bestScore = Infinity

    for (let i = 0; i < results.length; i++) {
      const score = riskOrder[results[i].riskLevel] * 10
        + results[i].breakingChanges.length
        - results[i].confidence * 5
      if (score < bestScore) {
        bestScore = score
        bestIdx = i
      }
    }

    return {
      scenarios: results,
      recommended: bestIdx,
      reasoning: `Scenario ${bestIdx + 1} has the lowest risk (${results[bestIdx].riskLevel}) with ${results[bestIdx].breakingChanges.length} breaking changes and ${(results[bestIdx].confidence * 100).toFixed(0)}% confidence.`,
    }
  }

  getGraph(): DependencyGraph | null {
    return this.graph
  }
}

// ── Helpers ────────────────────────────────────────────────────────

function walkDir(dir: string, extensions: string[]): string[] {
  const results: string[] = []
  const SKIP = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage'])

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (SKIP.has(entry.name)) continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        results.push(...walkDir(full, extensions))
      } else if (extensions.some(ext => entry.name.endsWith(ext))) {
        results.push(full)
      }
    }
  } catch { /* skip unreadable dirs */ }

  return results
}

function resolveImport(from: string, importPath: string, rootDir: string): string | null {
  const dir = path.dirname(from)
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.js']

  for (const ext of extensions) {
    const candidate = path.resolve(dir, importPath + ext)
    if (fs.existsSync(candidate)) {
      return path.relative(rootDir, candidate)
    }
  }

  // Try exact path
  const exact = path.resolve(dir, importPath)
  if (fs.existsSync(exact)) {
    return path.relative(rootDir, exact)
  }

  return null
}
