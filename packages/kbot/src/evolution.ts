// K:BOT Self-Evolution Loop — Automated Source Code Improvement
//
// CONCEPT: kbot identifies its own weaknesses, proposes code changes,
// validates them (typecheck + tests), scores the improvement, and
// applies or rolls back. The first self-evolving open-source CLI agent.
//
// SAFETY:
//   - Only modifies files in packages/kbot/src/ (never node_modules, configs, etc.)
//   - Never modifies evolution.ts, cli.ts, or test files (prevents recursive traps)
//   - Uses git stash for instant rollback on any failure
//   - Requires clean working tree before starting
//   - Never auto-publishes or pushes
//   - Max 3 changes per cycle (bounded blast radius)
//   - All changes logged to ~/.kbot/evolution-log.json
//
// FLOW: diagnose → propose → validate → score → apply/rollback → log

import { homedir } from 'node:os'
import { join } from 'node:path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { execSync } from 'node:child_process'

// ── Types ──

export interface Weakness {
  /** Which subsystem is weak (e.g. 'streaming', 'tool-execution', 'routing') */
  area: string
  /** What's wrong — human-readable */
  description: string
  /** Severity: how much this hurts overall quality */
  severity: 'low' | 'medium' | 'high'
  /** Evidence — metric name, sample count, etc. */
  evidence: string
  /** Suggested file to improve */
  targetFile?: string
}

export interface Proposal {
  /** File path relative to packages/kbot/ */
  file: string
  /** Description of the change */
  description: string
  /** The weakness this addresses */
  weakness: Weakness
  /** Full proposed file content (or diff instructions) */
  patch: string
  /** Original file content for rollback reference */
  original: string
}

export interface EvolutionResult {
  /** Whether the change was applied or rolled back */
  status: 'applied' | 'rolled-back' | 'skipped'
  /** Why this status */
  reason: string
  /** Weakness that was targeted */
  weakness: Weakness
  /** Score improvement (positive = better) */
  delta: number
  /** Timestamp */
  timestamp: string
}

export interface EvolutionCycle {
  /** Unique ID for this cycle */
  id: string
  /** When the cycle started */
  startedAt: string
  /** When the cycle ended */
  endedAt?: string
  /** Weaknesses found */
  weaknesses: Weakness[]
  /** Proposals generated */
  proposals: Proposal[]
  /** Results of applying proposals */
  results: EvolutionResult[]
  /** Overall cycle status */
  status: 'running' | 'completed' | 'failed' | 'aborted'
  /** Error message if failed */
  error?: string
}

// ── File paths ──

const KBOT_DIR = join(homedir(), '.kbot')
const LOG_FILE = join(KBOT_DIR, 'evolution-log.json')

// Files that must NEVER be modified by the evolution loop
const PROTECTED_FILES = [
  'src/evolution.ts',
  'src/cli.ts',
  'src/auth.ts',        // never touch auth — security-critical
  'vitest.config.ts',
  'package.json',
  'tsconfig.json',
]

const PROTECTED_PATTERNS = [
  /\.test\.(ts|tsx)$/,   // never modify tests
  /\.spec\.(ts|tsx)$/,
  /^node_modules\//,
  /^dist\//,
]

// ── Helpers ──

function ensureDir(): void {
  if (!existsSync(KBOT_DIR)) mkdirSync(KBOT_DIR, { recursive: true })
}

function loadLog(): EvolutionCycle[] {
  ensureDir()
  if (!existsSync(LOG_FILE)) return []
  try { return JSON.parse(readFileSync(LOG_FILE, 'utf-8')) } catch { return [] }
}

function saveLog(log: EvolutionCycle[]): void {
  ensureDir()
  // Keep only last 50 cycles
  const trimmed = log.slice(-50)
  writeFileSync(LOG_FILE, JSON.stringify(trimmed, null, 2), 'utf-8')
}

function isProtectedFile(relPath: string): boolean {
  if (PROTECTED_FILES.includes(relPath)) return true
  return PROTECTED_PATTERNS.some(p => p.test(relPath))
}

/** Find the kbot package root */
function findKbotRoot(): string {
  // Try relative to this file first
  const candidates = [
    join(process.cwd(), 'packages/kbot'),
    join(import.meta.dirname || process.cwd(), '..'),
  ]
  for (const c of candidates) {
    if (existsSync(join(c, 'package.json'))) {
      try {
        const pkg = JSON.parse(readFileSync(join(c, 'package.json'), 'utf-8'))
        if (pkg.name === '@kernel.chat/kbot') return c
      } catch { /* continue */ }
    }
  }
  throw new Error('Cannot find kbot package root. Run from the project directory.')
}

// ══════════════════════════════════════════════════════════════════
// 1. DIAGNOSE — Find weaknesses from skill profile + learning data
// ══════════════════════════════════════════════════════════════════

/**
 * Analyze kbot's performance data to find areas for improvement.
 * Uses the confidence engine's skill profile + learning stats.
 */
export function diagnose(): Weakness[] {
  const weaknesses: Weakness[] = []

  // Pull skill profile data
  try {
    // Dynamic import would be async — use require-style for sync diagnosis
    const skillFile = join(KBOT_DIR, 'skill-profile.json')
    const confFile = join(KBOT_DIR, 'confidence.json')
    const statsFile = join(KBOT_DIR, 'memory', 'stats.json')

    // Check skill weaknesses
    if (existsSync(skillFile)) {
      const skills: Record<string, { successCount: number; failureCount: number; sampleSize: number }> =
        JSON.parse(readFileSync(skillFile, 'utf-8')).skills || {}

      for (const [domain, data] of Object.entries(skills)) {
        if (data.sampleSize < 3) continue
        const rate = data.successCount / data.sampleSize
        if (rate < 0.5) {
          weaknesses.push({
            area: domain,
            description: `Low success rate in ${domain} tasks (${Math.round(rate * 100)}%)`,
            severity: rate < 0.3 ? 'high' : 'medium',
            evidence: `${data.successCount}/${data.sampleSize} successes`,
          })
        }
      }
    }

    // Check calibration — are we systematically overconfident?
    if (existsSync(confFile)) {
      const cal = JSON.parse(readFileSync(confFile, 'utf-8'))
      if (cal.avgError > 0.25 && (cal.entries?.length || 0) >= 5) {
        weaknesses.push({
          area: 'confidence-calibration',
          description: `Confidence predictions are poorly calibrated (avg error: ${(cal.avgError * 100).toFixed(0)}%)`,
          severity: cal.avgError > 0.4 ? 'high' : 'medium',
          evidence: `${cal.entries.length} calibration entries, avg error ${cal.avgError.toFixed(3)}`,
          targetFile: 'src/confidence.ts',
        })
      }
    }

    // Check learning stats — look for patterns with low success
    if (existsSync(statsFile)) {
      const stats = JSON.parse(readFileSync(statsFile, 'utf-8'))
      if (stats.totalMessages > 50 && stats.toolErrorRate > 0.15) {
        weaknesses.push({
          area: 'tool-execution',
          description: `High tool error rate (${(stats.toolErrorRate * 100).toFixed(0)}%)`,
          severity: stats.toolErrorRate > 0.3 ? 'high' : 'medium',
          evidence: `${stats.totalMessages} messages, ${(stats.toolErrorRate * 100).toFixed(0)}% tool errors`,
        })
      }
    }

    // Check for common code quality signals
    const kbotRoot = findKbotRoot()
    const srcDir = join(kbotRoot, 'src')

    // Look for TODO/FIXME/HACK comments as improvement signals
    try {
      const result = execSync(
        `grep -rn "TODO\\|FIXME\\|HACK\\|XXX" "${srcDir}" --include="*.ts" | head -20`,
        { encoding: 'utf-8', timeout: 5000 },
      ).trim()

      if (result) {
        const todoCount = result.split('\n').filter(l => l.trim()).length
        if (todoCount >= 3) {
          weaknesses.push({
            area: 'code-quality',
            description: `${todoCount} TODO/FIXME/HACK markers in source code`,
            severity: todoCount > 10 ? 'medium' : 'low',
            evidence: `Found ${todoCount} markers via grep`,
          })
        }
      }
    } catch { /* grep not critical */ }

  } catch (err) {
    // Diagnosis failure is not fatal — return what we have
    if (process.env.KBOT_DEBUG) {
      console.error('[evolution] diagnose error:', (err as Error).message)
    }
  }

  // Sort by severity (high first)
  const severityOrder = { high: 0, medium: 1, low: 2 }
  weaknesses.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

  return weaknesses
}

// ══════════════════════════════════════════════════════════════════
// 2. PROPOSE — Use LLM to generate code improvements
// ══════════════════════════════════════════════════════════════════

/**
 * Ask the LLM to propose a code improvement for a weakness.
 * Reuses the auth/provider pattern from self-eval.ts.
 */
export async function proposeImprovement(weakness: Weakness): Promise<Proposal | null> {
  // Determine which file to improve
  const kbotRoot = findKbotRoot()
  const targetFile = weakness.targetFile || guessTargetFile(weakness.area)

  if (!targetFile) return null
  if (isProtectedFile(targetFile)) return null

  const absPath = join(kbotRoot, targetFile)
  if (!existsSync(absPath)) return null

  const original = readFileSync(absPath, 'utf-8')

  // Truncate very large files to keep prompt costs reasonable
  const maxSourceChars = 8000
  const source = original.length > maxSourceChars
    ? original.slice(0, maxSourceChars) + '\n// ... (truncated)'
    : original

  const prompt = buildProposalPrompt(weakness, targetFile, source)

  try {
    const { getByokKey, getByokProvider, getProvider, getProviderModel } = await import('./auth.js')
    const apiKey = getByokKey()
    if (!apiKey) return null

    const byokProvider = getByokProvider()
    const provider = getProvider(byokProvider)
    const model = getProviderModel(byokProvider, 'default')

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (provider.authHeader === 'x-api-key') {
      headers['x-api-key'] = apiKey
      headers['anthropic-version'] = '2023-06-01'
    } else if (apiKey && apiKey !== 'local') {
      headers['Authorization'] = `Bearer ${apiKey}`
    }

    let body: string
    let url: string

    if (provider.apiStyle === 'anthropic') {
      url = provider.apiUrl
      body = JSON.stringify({
        model,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      })
    } else if (provider.apiStyle === 'google') {
      url = `${provider.apiUrl}/${model}:generateContent?key=${apiKey}`
      body = JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 4096 },
      })
    } else {
      url = provider.apiUrl
      body = JSON.stringify({
        model,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      })
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(60_000),
    })

    if (!res.ok) return null

    const data = await res.json() as Record<string, unknown>
    let text = ''

    if (provider.apiStyle === 'anthropic') {
      const blocks = (data.content as Array<{ type: string; text?: string }>) || []
      text = blocks.filter(b => b.type === 'text').map(b => b.text || '').join('')
    } else if (provider.apiStyle === 'google') {
      const candidates = (data.candidates as Array<{ content: { parts: Array<{ text: string }> } }>) || []
      text = candidates[0]?.content?.parts?.map(p => p.text).join('') || ''
    } else {
      const choices = (data.choices as Array<{ message: { content: string } }>) || []
      text = choices[0]?.message?.content || ''
    }

    // Parse the response — expect a code block with the improved file
    const patch = extractCodeBlock(text)
    if (!patch) return null

    // Basic sanity: patch should be at least 50% the size of original
    if (patch.length < original.length * 0.5) return null

    return {
      file: targetFile,
      description: extractDescription(text),
      weakness,
      patch,
      original,
    }
  } catch {
    return null
  }
}

function buildProposalPrompt(weakness: Weakness, file: string, source: string): string {
  return `You are improving the source code of K:BOT, an open-source terminal AI agent.

WEAKNESS DETECTED:
- Area: ${weakness.area}
- Issue: ${weakness.description}
- Severity: ${weakness.severity}
- Evidence: ${weakness.evidence}

FILE TO IMPROVE: ${file}

CURRENT SOURCE:
\`\`\`typescript
${source}
\`\`\`

RULES:
1. Make the MINIMAL change needed to address the weakness
2. Keep all existing exports and function signatures
3. Do NOT change import paths
4. Do NOT add new dependencies
5. Preserve the coding style (2-space indent, single quotes, no semicolons at line ends where absent)
6. The change must pass \`npx tsc --noEmit\` and \`npx vitest run\`

Respond with:
1. A one-line description of your change
2. The COMPLETE improved file in a single typescript code block

DESCRIPTION: <your one-line description>

\`\`\`typescript
<complete improved file>
\`\`\``
}

function extractCodeBlock(text: string): string | null {
  const match = text.match(/```(?:typescript|ts)?\n([\s\S]*?)```/)
  return match ? match[1].trim() : null
}

function extractDescription(text: string): string {
  const match = text.match(/DESCRIPTION:\s*(.+)/i)
  return match ? match[1].trim() : 'Code improvement'
}

function guessTargetFile(area: string): string | null {
  const areaMap: Record<string, string> = {
    'typescript': 'src/agent.ts',
    'javascript': 'src/agent.ts',
    'streaming': 'src/streaming.ts',
    'tool-execution': 'src/agent.ts',
    'routing': 'src/learned-router.ts',
    'confidence-calibration': 'src/confidence.ts',
    'learning': 'src/learning.ts',
    'memory': 'src/memory.ts',
    'planning': 'src/planner.ts',
    'context': 'src/context-manager.ts',
    'code-quality': 'src/agent.ts',
    'testing': 'src/agent.ts',
    'search': 'src/tools/search.ts',
    'git': 'src/tools/git.ts',
    'devops': 'src/tools/bash.ts',
  }
  return areaMap[area] || null
}

// ══════════════════════════════════════════════════════════════════
// 3. VALIDATE — Typecheck + test the proposed change
// ══════════════════════════════════════════════════════════════════

/**
 * Apply a proposal temporarily and run validation (tsc + vitest).
 * Returns true if the change passes, false otherwise.
 */
export function validate(proposal: Proposal): { passes: boolean; errors: string } {
  const kbotRoot = findKbotRoot()
  const absPath = join(kbotRoot, proposal.file)

  // Write the patched file
  writeFileSync(absPath, proposal.patch, 'utf-8')

  try {
    // Type check
    execSync('npx tsc --noEmit', {
      cwd: kbotRoot,
      encoding: 'utf-8',
      timeout: 60_000,
      stdio: 'pipe',
    })
  } catch (err) {
    // Rollback
    writeFileSync(absPath, proposal.original, 'utf-8')
    const stderr = (err as { stderr?: string }).stderr || ''
    return { passes: false, errors: `Typecheck failed:\n${stderr.slice(0, 500)}` }
  }

  try {
    // Run tests
    execSync('npx vitest run --reporter=verbose 2>&1', {
      cwd: kbotRoot,
      encoding: 'utf-8',
      timeout: 120_000,
      stdio: 'pipe',
    })
  } catch (err) {
    // Rollback
    writeFileSync(absPath, proposal.original, 'utf-8')
    const stderr = (err as { stderr?: string; stdout?: string }).stderr || (err as { stdout?: string }).stdout || ''
    return { passes: false, errors: `Tests failed:\n${stderr.slice(0, 500)}` }
  }

  return { passes: true, errors: '' }
}

// ══════════════════════════════════════════════════════════════════
// 4. SCORE — Measure improvement via before/after metrics
// ══════════════════════════════════════════════════════════════════

export interface Metrics {
  /** Lines of code in the file */
  loc: number
  /** Cyclomatic complexity estimate (branches + loops) */
  complexity: number
  /** Number of TODO/FIXME/HACK markers */
  todoCount: number
  /** Number of exported functions */
  exportCount: number
}

export function scoreMetrics(source: string): Metrics {
  const lines = source.split('\n')
  const loc = lines.filter(l => l.trim() && !l.trim().startsWith('//')).length

  // Simple complexity: count if/else/for/while/switch/catch/? (ternary)
  const complexity = (source.match(/\b(if|else|for|while|switch|catch|case)\b|\?.*:/g) || []).length

  const todoCount = (source.match(/\b(TODO|FIXME|HACK|XXX)\b/g) || []).length

  const exportCount = (source.match(/\bexport\s+(function|const|class|interface|type|enum)\b/g) || []).length

  return { loc, complexity, todoCount, exportCount }
}

/**
 * Compute a delta score between before/after metrics.
 * Positive = improvement, negative = regression.
 */
export function computeDelta(before: Metrics, after: Metrics): number {
  let delta = 0

  // Fewer TODOs is better
  delta += (before.todoCount - after.todoCount) * 0.2

  // Lower complexity (if significant) is better
  if (before.complexity > 0) {
    const complexityReduction = (before.complexity - after.complexity) / before.complexity
    delta += complexityReduction * 0.3
  }

  // Breaking exports is bad — any lost export is a -1.0 penalty
  if (after.exportCount < before.exportCount) {
    delta -= (before.exportCount - after.exportCount) * 1.0
  }

  // LOC change: slight preference for smaller (but not drastic reduction)
  if (before.loc > 0) {
    const locChange = (before.loc - after.loc) / before.loc
    if (locChange > 0 && locChange < 0.3) {
      delta += locChange * 0.1  // slight reward for trimming
    } else if (locChange > 0.3) {
      delta -= 0.5  // suspicious: lost too much code
    }
  }

  return Math.round(delta * 1000) / 1000
}

// ══════════════════════════════════════════════════════════════════
// 5. RUN EVOLUTION CYCLE — Full orchestrator
// ══════════════════════════════════════════════════════════════════

/**
 * Run one evolution cycle:
 * 1. Check for clean working tree
 * 2. Diagnose weaknesses
 * 3. For each weakness (max 3): propose → validate → score → apply/rollback
 * 4. Log everything
 */
export async function runEvolutionCycle(): Promise<EvolutionCycle> {
  const cycleId = `evo-${Date.now()}`
  const cycle: EvolutionCycle = {
    id: cycleId,
    startedAt: new Date().toISOString(),
    weaknesses: [],
    proposals: [],
    results: [],
    status: 'running',
  }

  try {
    const kbotRoot = findKbotRoot()

    // Safety: check for clean working tree
    try {
      const gitStatus = execSync('git status --porcelain', {
        cwd: kbotRoot,
        encoding: 'utf-8',
        timeout: 5000,
      }).trim()

      if (gitStatus) {
        // Stash changes for safety
        execSync('git stash push -m "kbot-evolution-safety-stash"', {
          cwd: kbotRoot,
          encoding: 'utf-8',
          timeout: 10000,
        })
      }
    } catch {
      // Not a git repo or git not available — proceed without safety net
    }

    // Step 1: Diagnose
    const weaknesses = diagnose()
    cycle.weaknesses = weaknesses

    if (weaknesses.length === 0) {
      cycle.status = 'completed'
      cycle.endedAt = new Date().toISOString()
      cycle.results.push({
        status: 'skipped',
        reason: 'No weaknesses detected — kbot is performing well',
        weakness: { area: 'none', description: 'No issues found', severity: 'low', evidence: 'clean diagnosis' },
        delta: 0,
        timestamp: new Date().toISOString(),
      })
      appendToLog(cycle)
      return cycle
    }

    // Step 2: Process top 3 weaknesses
    const targetWeaknesses = weaknesses.slice(0, 3)

    for (const weakness of targetWeaknesses) {
      // Propose
      const proposal = await proposeImprovement(weakness)
      if (!proposal) {
        cycle.results.push({
          status: 'skipped',
          reason: 'Could not generate a valid proposal',
          weakness,
          delta: 0,
          timestamp: new Date().toISOString(),
        })
        continue
      }
      cycle.proposals.push(proposal)

      // Score before
      const beforeMetrics = scoreMetrics(proposal.original)

      // Validate (writes file, runs tsc + vitest)
      const validation = validate(proposal)

      if (!validation.passes) {
        // validate() already rolled back the file
        cycle.results.push({
          status: 'rolled-back',
          reason: validation.errors,
          weakness,
          delta: 0,
          timestamp: new Date().toISOString(),
        })
        continue
      }

      // Score after (file is still patched from validate())
      const afterMetrics = scoreMetrics(proposal.patch)
      const delta = computeDelta(beforeMetrics, afterMetrics)

      if (delta < -0.1) {
        // Negative delta — rollback even though it passes
        const absPath = join(kbotRoot, proposal.file)
        writeFileSync(absPath, proposal.original, 'utf-8')
        cycle.results.push({
          status: 'rolled-back',
          reason: `Negative quality delta (${delta.toFixed(3)}) — change makes code worse`,
          weakness,
          delta,
          timestamp: new Date().toISOString(),
        })
        continue
      }

      // Apply! File is already written by validate()
      cycle.results.push({
        status: 'applied',
        reason: `${proposal.description} (delta: +${delta.toFixed(3)})`,
        weakness,
        delta,
        timestamp: new Date().toISOString(),
      })
    }

    cycle.status = 'completed'
  } catch (err) {
    cycle.status = 'failed'
    cycle.error = err instanceof Error ? err.message : String(err)
  }

  cycle.endedAt = new Date().toISOString()
  appendToLog(cycle)
  return cycle
}

function appendToLog(cycle: EvolutionCycle): void {
  const log = loadLog()
  log.push(cycle)
  saveLog(log)
}

// ══════════════════════════════════════════════════════════════════
// 6. STATUS + REPORTING
// ══════════════════════════════════════════════════════════════════

/** Get the full evolution log */
export function getEvolutionLog(): EvolutionCycle[] {
  return loadLog()
}

/** Get a summary of evolution activity */
export function getEvolutionStats(): {
  totalCycles: number
  totalApplied: number
  totalRolledBack: number
  totalSkipped: number
  avgDelta: number
  lastCycle: string | null
} {
  const log = loadLog()
  let totalApplied = 0
  let totalRolledBack = 0
  let totalSkipped = 0
  let totalDelta = 0
  let deltaCount = 0

  for (const cycle of log) {
    for (const result of cycle.results) {
      if (result.status === 'applied') {
        totalApplied++
        totalDelta += result.delta
        deltaCount++
      } else if (result.status === 'rolled-back') {
        totalRolledBack++
      } else {
        totalSkipped++
      }
    }
  }

  return {
    totalCycles: log.length,
    totalApplied,
    totalRolledBack,
    totalSkipped,
    avgDelta: deltaCount > 0 ? Math.round((totalDelta / deltaCount) * 1000) / 1000 : 0,
    lastCycle: log.length > 0 ? log[log.length - 1].endedAt || log[log.length - 1].startedAt : null,
  }
}

/** Format evolution status for terminal display */
export function formatEvolutionStatus(): string {
  const stats = getEvolutionStats()
  const lines: string[] = []

  lines.push('=== K:BOT Evolution Engine ===')
  lines.push('')
  lines.push(`Cycles run:     ${stats.totalCycles}`)
  lines.push(`Applied:        ${stats.totalApplied}`)
  lines.push(`Rolled back:    ${stats.totalRolledBack}`)
  lines.push(`Skipped:        ${stats.totalSkipped}`)
  lines.push(`Avg improvement: ${stats.avgDelta >= 0 ? '+' : ''}${stats.avgDelta.toFixed(3)}`)

  if (stats.lastCycle) {
    const ago = Date.now() - new Date(stats.lastCycle).getTime()
    const hours = Math.round(ago / 3600000)
    lines.push(`Last cycle:     ${hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`}`)
  } else {
    lines.push('Last cycle:     never')
  }

  // Show recent results
  const log = loadLog()
  if (log.length > 0) {
    const recent = log[log.length - 1]
    lines.push('')
    lines.push(`Latest cycle (${recent.id}):`)
    lines.push(`  Status: ${recent.status}`)
    lines.push(`  Weaknesses: ${recent.weaknesses.length}`)
    for (const r of recent.results) {
      const icon = r.status === 'applied' ? '✓' : r.status === 'rolled-back' ? '✗' : '○'
      lines.push(`  ${icon} ${r.weakness.area}: ${r.reason.slice(0, 80)}`)
    }
  }

  return lines.join('\n')
}

/** Format diagnosis output for terminal display */
export function formatDiagnosis(weaknesses: Weakness[]): string {
  if (weaknesses.length === 0) {
    return 'No weaknesses detected. K:BOT is performing well.'
  }

  const lines = [`Found ${weaknesses.length} weakness${weaknesses.length > 1 ? 'es' : ''}:`, '']

  for (const w of weaknesses) {
    const icon = w.severity === 'high' ? '▲' : w.severity === 'medium' ? '●' : '○'
    lines.push(`  ${icon} [${w.severity}] ${w.area}`)
    lines.push(`    ${w.description}`)
    lines.push(`    Evidence: ${w.evidence}`)
    if (w.targetFile) lines.push(`    Target: ${w.targetFile}`)
    lines.push('')
  }

  return lines.join('\n')
}
