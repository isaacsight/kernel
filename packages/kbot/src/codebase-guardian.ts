// kbot Codebase Guardian — Self-evolving code quality system
//
// Watches a codebase for:
//   - Repeated code patterns (3+ occurrences) → suggests extraction
//   - Files that always change together → suggests co-location
//   - Growing complexity (long functions, deep nesting) → suggests refactoring
//
// When the guardian finds a recurring pattern, it forges a tool to detect/fix
// that specific pattern in the future. Tools are saved to ~/.kbot/forge/.
//
// Usage:
//   import { runGuardian, forgeGuardianTool, getGuardianHistory } from './codebase-guardian.js'
//   const report = await runGuardian('/path/to/project')
//   forgeGuardianTool(report.findings[0])

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { join, relative, extname, basename } from 'node:path'
import { homedir } from 'node:os'
import { execSync } from 'node:child_process'

// ── Types ──

export type FindingType = 'duplicate-pattern' | 'co-change' | 'complexity'

export interface GuardianFinding {
  type: FindingType
  severity: 'info' | 'warn' | 'critical'
  title: string
  description: string
  files: string[]
  /** The repeated code snippet (for duplicate-pattern findings) */
  pattern?: string
  /** Occurrence count (for duplicate-pattern findings) */
  occurrences?: number
  /** Metric value (for complexity findings — e.g., function length) */
  metric?: number
  /** Suggested action */
  suggestion: string
  foundAt: string
}

export interface GuardianReport {
  analyzedAt: string
  rootDir: string
  filesScanned: number
  findings: GuardianFinding[]
  summary: {
    duplicates: number
    coChanges: number
    complexityWarnings: number
    totalFindings: number
  }
}

export interface ForgedGuardianTool {
  name: string
  description: string
  finding: GuardianFinding
  detectPattern: string
  createdAt: string
}

interface HistoryEntry {
  report: GuardianReport
  forgedTools: string[]
}

// ── Paths ──

const FORGE_DIR = join(homedir(), '.kbot', 'forge')
const HISTORY_PATH = join(homedir(), '.kbot', 'guardian-history.json')

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

// ── JSON helpers ──

function loadJsonSafe<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as T
  } catch {
    return fallback
  }
}

function saveJson(path: string, data: unknown): void {
  const dir = path.replace(/\/[^/]+$/, '')
  ensureDir(dir)
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8')
}

// ── File walking ──

const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', '.next', '.nuxt',
  'coverage', '.cache', '.turbo', '.parcel-cache', '__pycache__',
  'vendor', 'target', '.output', '.vercel',
])

const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs', '.py', '.rs',
  '.go', '.java', '.rb', '.php', '.swift', '.kt', '.c', '.cpp', '.h',
])

function walkCodeFiles(dir: string, maxFiles: number, files: string[] = []): string[] {
  if (files.length >= maxFiles) return files

  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return files
  }

  for (const entry of entries) {
    if (files.length >= maxFiles) break

    const fullPath = join(dir, entry)
    let stats
    try {
      stats = statSync(fullPath)
    } catch {
      continue
    }

    if (stats.isDirectory()) {
      if (!IGNORED_DIRS.has(entry) && !entry.startsWith('.')) {
        walkCodeFiles(fullPath, maxFiles, files)
      }
    } else if (stats.isFile()) {
      const ext = extname(entry).toLowerCase()
      if (CODE_EXTENSIONS.has(ext) && stats.size < 500_000) {
        files.push(fullPath)
      }
    }
  }

  return files
}

// ── Duplicate Pattern Detection ──

/** Normalize a code line for comparison (strip whitespace, comments) */
function normalizeLine(line: string): string {
  return line
    .replace(/\/\/.*$/, '')       // single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // block comments
    .replace(/#.*$/, '')           // Python/Ruby comments
    .replace(/\s+/g, ' ')         // collapse whitespace
    .trim()
}

/**
 * Extract "chunks" of 3+ consecutive non-trivial lines from a file.
 * Each chunk is normalized for comparison.
 */
function extractChunks(source: string, chunkSize: number): string[] {
  const lines = source.split('\n').map(normalizeLine).filter(l => l.length > 10)
  const chunks: string[] = []

  for (let i = 0; i <= lines.length - chunkSize; i++) {
    const chunk = lines.slice(i, i + chunkSize).join('\n')
    if (chunk.length > 30) {
      chunks.push(chunk)
    }
  }

  return chunks
}

function detectDuplicatePatterns(
  files: string[],
  rootDir: string,
): GuardianFinding[] {
  const findings: GuardianFinding[] = []

  // Map: normalized chunk → list of files it appears in
  const chunkMap = new Map<string, Set<string>>()
  const chunkOriginals = new Map<string, string>()
  const CHUNK_SIZE = 4

  for (const file of files) {
    let source: string
    try {
      source = readFileSync(file, 'utf-8')
    } catch {
      continue
    }

    const chunks = extractChunks(source, CHUNK_SIZE)
    const relPath = relative(rootDir, file)

    for (const chunk of chunks) {
      if (!chunkMap.has(chunk)) {
        chunkMap.set(chunk, new Set())
        // Store one original (unnormalized) version for reporting
        const rawLines = source.split('\n')
        for (let i = 0; i < rawLines.length - CHUNK_SIZE; i++) {
          const raw = rawLines.slice(i, i + CHUNK_SIZE).join('\n')
          const normalized = rawLines.slice(i, i + CHUNK_SIZE).map(normalizeLine).filter(l => l.length > 10).join('\n')
          if (normalized === chunk) {
            chunkOriginals.set(chunk, raw)
            break
          }
        }
      }
      chunkMap.get(chunk)!.add(relPath)
    }
  }

  // Find chunks that appear in 3+ files
  for (const [chunk, fileSet] of chunkMap) {
    if (fileSet.size >= 3) {
      const fileList = Array.from(fileSet)
      const original = chunkOriginals.get(chunk) || chunk
      findings.push({
        type: 'duplicate-pattern',
        severity: fileSet.size >= 5 ? 'critical' : 'warn',
        title: `Repeated code block in ${fileSet.size} files`,
        description: `A ${CHUNK_SIZE}-line code block appears in ${fileSet.size} files. Consider extracting into a shared utility.`,
        files: fileList,
        pattern: original.slice(0, 200),
        occurrences: fileSet.size,
        suggestion: `Extract this repeated pattern into a shared utility function and import it from a common module.`,
        foundAt: new Date().toISOString(),
      })
    }
  }

  // Limit to top 10 most duplicated
  findings.sort((a, b) => (b.occurrences || 0) - (a.occurrences || 0))
  return findings.slice(0, 10)
}

// ── Co-Change Detection ──

/**
 * Analyze git log to find files that always change together.
 * Two files that appear in 3+ commits together are flagged.
 */
function detectCoChanges(rootDir: string): GuardianFinding[] {
  const findings: GuardianFinding[] = []

  let gitLog: string
  try {
    // Get last 100 commits with changed files
    gitLog = execSync(
      'git log --name-only --format="%H" -100',
      { cwd: rootDir, encoding: 'utf-8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] },
    )
  } catch {
    // Not a git repo or git not available
    return findings
  }

  // Parse commits: each commit is separated by a blank line, starts with hash
  const commits: string[][] = []
  let currentFiles: string[] = []

  for (const line of gitLog.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) {
      if (currentFiles.length > 0) {
        commits.push(currentFiles)
        currentFiles = []
      }
      continue
    }
    // Skip commit hashes (40 hex chars)
    if (/^[a-f0-9]{40}$/.test(trimmed)) {
      if (currentFiles.length > 0) {
        commits.push(currentFiles)
        currentFiles = []
      }
      continue
    }
    // Only track code files
    const ext = extname(trimmed).toLowerCase()
    if (CODE_EXTENSIONS.has(ext)) {
      currentFiles.push(trimmed)
    }
  }
  if (currentFiles.length > 0) {
    commits.push(currentFiles)
  }

  // Count co-occurrences: pair → count
  const pairCounts = new Map<string, number>()
  const pairCommits = new Map<string, number>()

  for (const files of commits) {
    if (files.length < 2 || files.length > 20) continue // Skip too-large commits

    const sorted = files.sort()
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const key = `${sorted[i]}|||${sorted[j]}`
        pairCounts.set(key, (pairCounts.get(key) || 0) + 1)
        pairCommits.set(key, commits.length)
      }
    }
  }

  // Find pairs that co-change in 3+ commits
  for (const [key, count] of pairCounts) {
    if (count >= 3) {
      const [fileA, fileB] = key.split('|||')
      const dirA = fileA.split('/').slice(0, -1).join('/')
      const dirB = fileB.split('/').slice(0, -1).join('/')

      // Only flag if they're in different directories
      if (dirA !== dirB) {
        findings.push({
          type: 'co-change',
          severity: count >= 6 ? 'warn' : 'info',
          title: `Files frequently change together (${count} commits)`,
          description: `${fileA} and ${fileB} were modified in the same commit ${count} times. They may belong in the same module.`,
          files: [fileA, fileB],
          occurrences: count,
          suggestion: `Consider co-locating these files in the same directory, or extracting the shared concern into a common module.`,
          foundAt: new Date().toISOString(),
        })
      }
    }
  }

  // Limit to top 10 most coupled pairs
  findings.sort((a, b) => (b.occurrences || 0) - (a.occurrences || 0))
  return findings.slice(0, 10)
}

// ── Complexity Detection ──

interface ComplexityMetrics {
  file: string
  functionName: string
  lineCount: number
  maxNesting: number
  startLine: number
}

/**
 * Detect functions/methods that are too long or deeply nested.
 * Thresholds: >50 lines = warn, >100 lines = critical, >4 nesting = warn.
 */
function measureComplexity(source: string, filePath: string): ComplexityMetrics[] {
  const metrics: ComplexityMetrics[] = []
  const lines = source.split('\n')

  // Simple function detection: look for function/method declarations
  const funcPattern = /(?:export\s+)?(?:async\s+)?(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[a-zA-Z_]\w*)\s*=>|(\w+)\s*\([^)]*\)\s*(?::\s*\w[^{]*)?\s*\{)/

  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const match = funcPattern.exec(line)

    if (match) {
      const funcName = match[1] || match[2] || match[3] || 'anonymous'
      const startLine = i + 1

      // Count the function body: track brace depth
      let braceDepth = 0
      let maxNesting = 0
      let funcStarted = false
      let bodyLines = 0
      let j = i

      while (j < lines.length) {
        const currentLine = lines[j]
        for (const ch of currentLine) {
          if (ch === '{') {
            braceDepth++
            if (!funcStarted) funcStarted = true
            if (braceDepth > maxNesting) maxNesting = braceDepth
          } else if (ch === '}') {
            braceDepth--
          }
        }

        if (funcStarted) bodyLines++

        if (funcStarted && braceDepth === 0) {
          break
        }
        j++
      }

      // Subtract 1 for the initial nesting level of the function body itself
      const effectiveNesting = Math.max(0, maxNesting - 1)

      if (bodyLines > 50 || effectiveNesting > 4) {
        metrics.push({
          file: filePath,
          functionName: funcName,
          lineCount: bodyLines,
          maxNesting: effectiveNesting,
          startLine,
        })
      }

      i = j + 1
    } else {
      i++
    }
  }

  return metrics
}

function detectComplexity(
  files: string[],
  rootDir: string,
): GuardianFinding[] {
  const findings: GuardianFinding[] = []

  for (const file of files) {
    let source: string
    try {
      source = readFileSync(file, 'utf-8')
    } catch {
      continue
    }

    const relPath = relative(rootDir, file)
    const metrics = measureComplexity(source, relPath)

    for (const m of metrics) {
      if (m.lineCount > 100) {
        findings.push({
          type: 'complexity',
          severity: 'critical',
          title: `Very long function: ${m.functionName} (${m.lineCount} lines)`,
          description: `${m.file}:${m.startLine} — function \`${m.functionName}\` is ${m.lineCount} lines long. Functions over 100 lines are hard to maintain.`,
          files: [m.file],
          metric: m.lineCount,
          suggestion: `Break this function into smaller, focused helper functions. Each should do one thing well.`,
          foundAt: new Date().toISOString(),
        })
      } else if (m.lineCount > 50) {
        findings.push({
          type: 'complexity',
          severity: 'warn',
          title: `Long function: ${m.functionName} (${m.lineCount} lines)`,
          description: `${m.file}:${m.startLine} — function \`${m.functionName}\` is ${m.lineCount} lines long. Consider refactoring.`,
          files: [m.file],
          metric: m.lineCount,
          suggestion: `Look for logical sections within this function that could be extracted into helper functions.`,
          foundAt: new Date().toISOString(),
        })
      }

      if (m.maxNesting > 4) {
        findings.push({
          type: 'complexity',
          severity: m.maxNesting > 6 ? 'critical' : 'warn',
          title: `Deep nesting: ${m.functionName} (depth ${m.maxNesting})`,
          description: `${m.file}:${m.startLine} — function \`${m.functionName}\` has nesting depth ${m.maxNesting}. Deep nesting makes code hard to follow.`,
          files: [m.file],
          metric: m.maxNesting,
          suggestion: `Use early returns, guard clauses, or extract nested blocks into separate functions to reduce nesting.`,
          foundAt: new Date().toISOString(),
        })
      }
    }
  }

  // Limit to top 15 most complex
  findings.sort((a, b) => (b.metric || 0) - (a.metric || 0))
  return findings.slice(0, 15)
}

// ── Main Guardian ──

/**
 * Run the Codebase Guardian on a directory.
 *
 * Scans for:
 * - Duplicate code patterns (3+ occurrences across files)
 * - Files that always change together (from git history)
 * - Growing complexity (function length, nesting depth)
 *
 * Returns a structured report with all findings.
 */
export async function runGuardian(path: string): Promise<GuardianReport> {
  const rootDir = path
  const startTime = Date.now()

  // Collect all code files
  const files = walkCodeFiles(rootDir, 1000)

  // Run all analyses
  const duplicateFindings = detectDuplicatePatterns(files, rootDir)
  const coChangeFindings = detectCoChanges(rootDir)
  const complexityFindings = detectComplexity(files, rootDir)

  const allFindings = [
    ...duplicateFindings,
    ...coChangeFindings,
    ...complexityFindings,
  ]

  const report: GuardianReport = {
    analyzedAt: new Date().toISOString(),
    rootDir,
    filesScanned: files.length,
    findings: allFindings,
    summary: {
      duplicates: duplicateFindings.length,
      coChanges: coChangeFindings.length,
      complexityWarnings: complexityFindings.length,
      totalFindings: allFindings.length,
    },
  }

  // Save to history
  const history = loadJsonSafe<HistoryEntry[]>(HISTORY_PATH, [])
  history.push({ report, forgedTools: [] })
  // Keep last 50 reports
  if (history.length > 50) history.splice(0, history.length - 50)
  saveJson(HISTORY_PATH, history)

  const elapsed = Date.now() - startTime
  console.log(
    `Guardian scanned ${files.length} files in ${elapsed}ms — ` +
    `${allFindings.length} findings (${duplicateFindings.length} duplicates, ` +
    `${coChangeFindings.length} co-changes, ${complexityFindings.length} complexity)`,
  )

  return report
}

// ── Forge Guardian Tool ──

/**
 * When the guardian finds a recurring pattern, forge a tool to detect (and
 * optionally fix) that specific pattern in the future.
 *
 * The forged tool is saved to ~/.kbot/forge/guardian-{name}.json.
 */
export function forgeGuardianTool(finding: GuardianFinding): ForgedGuardianTool {
  ensureDir(FORGE_DIR)

  // Generate a tool name from the finding
  const slug = finding.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  const name = `guardian-${slug}`

  // Build a detection pattern based on the finding type
  let detectPattern: string

  switch (finding.type) {
    case 'duplicate-pattern':
      // Create a regex-safe version of the pattern's first meaningful line
      if (finding.pattern) {
        const firstLine = finding.pattern.split('\n')[0].trim()
        const escaped = firstLine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        detectPattern = escaped
      } else {
        detectPattern = '.*'
      }
      break

    case 'co-change':
      // Store the file pair for future monitoring
      detectPattern = finding.files.join('|')
      break

    case 'complexity':
      // Store a pattern to detect the function signature
      detectPattern = finding.files[0] + ':' + finding.title
      break

    default:
      detectPattern = '.*'
  }

  const tool: ForgedGuardianTool = {
    name,
    description: `Auto-forged by Codebase Guardian: ${finding.title}`,
    finding,
    detectPattern,
    createdAt: new Date().toISOString(),
  }

  // Save to forge directory
  const toolPath = join(FORGE_DIR, `${name}.json`)
  writeFileSync(toolPath, JSON.stringify(tool, null, 2), 'utf-8')

  // Update history to record the forged tool
  const history = loadJsonSafe<HistoryEntry[]>(HISTORY_PATH, [])
  if (history.length > 0) {
    history[history.length - 1].forgedTools.push(name)
    saveJson(HISTORY_PATH, history)
  }

  console.log(`Forged guardian tool: ${name} → ${toolPath}`)

  return tool
}

// ── History ──

/**
 * Get history of guardian reports and forged tools.
 */
export function getGuardianHistory(): HistoryEntry[] {
  return loadJsonSafe<HistoryEntry[]>(HISTORY_PATH, [])
}
