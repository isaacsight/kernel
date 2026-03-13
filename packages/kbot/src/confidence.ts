// K:BOT Confidence Engine — Self-Awareness for Agent Actions
//
// Three systems:
// 1. CONFIDENCE CALIBRATION — Express uncertainty about responses/actions
// 2. SKILL BOUNDARIES — Self-model of strengths, weaknesses, unknowns
// 3. EFFORT ESTIMATION — Predict tool calls, cost, and complexity
//
// Persists calibration and effort history to ~/.kbot/ as JSON files.
// Integrates with the learning engine for pattern/task data.

import { homedir } from 'node:os'
import { join } from 'node:path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { registerTool } from './tools/index.js'
import { classifyTask, extractKeywords, findPattern } from './learning.js'
import { isLocalProvider, getByokProvider, estimateCost } from './auth.js'

// ── File Paths ──

const KBOT_DIR = join(homedir(), '.kbot')
const CONFIDENCE_FILE = join(KBOT_DIR, 'confidence.json')
const EFFORT_FILE = join(KBOT_DIR, 'effort-history.json')
const SKILL_FILE = join(KBOT_DIR, 'skill-profile.json')

// ── Helpers ──

function ensureDir(): void {
  if (!existsSync(KBOT_DIR)) mkdirSync(KBOT_DIR, { recursive: true })
}

function loadJSON<T>(path: string, fallback: T): T {
  ensureDir()
  if (!existsSync(path)) return fallback
  try { return JSON.parse(readFileSync(path, 'utf-8')) } catch { return fallback }
}

function saveJSON(path: string, data: unknown): void {
  ensureDir()
  try {
    writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8')
  } catch { /* silently fail — non-critical persistence */ }
}

// ══════════════════════════════════════════════════════════════════
// 1. CONFIDENCE CALIBRATION
// ══════════════════════════════════════════════════════════════════

export interface ConfidenceScore {
  /** 0-1: overall confidence in the action/response */
  overall: number
  /** 0-1: how sure about factual accuracy */
  factual: number
  /** 0-1: how sure the chosen approach is correct */
  approach: number
  /** 0-1: how sure all aspects were covered */
  completeness: number
  /** One-line explanation of the confidence level */
  reasoning: string
}

/** Historical calibration entry — predicted vs actual */
interface CalibrationEntry {
  task: string
  predicted: number
  actual: number
  domain: string
  timestamp: string
}

/** Full calibration history stored on disk */
interface CalibrationData {
  entries: CalibrationEntry[]
  /** Running calibration error (lower is better) */
  avgError: number
}

function loadCalibration(): CalibrationData {
  return loadJSON<CalibrationData>(CONFIDENCE_FILE, { entries: [], avgError: 0 })
}

function saveCalibration(data: CalibrationData): void {
  // Keep only last 200 entries to avoid unbounded growth
  if (data.entries.length > 200) {
    data.entries = data.entries.slice(-200)
  }
  saveJSON(CONFIDENCE_FILE, data)
}

/** Compute calibration bias from historical data for a domain */
function getCalibrationBias(domain: string): number {
  const data = loadCalibration()
  const domainEntries = data.entries.filter(e => e.domain === domain)
  if (domainEntries.length < 3) return 0

  // Average (predicted - actual): positive = overconfident, negative = underconfident
  const totalBias = domainEntries.reduce((sum, e) => sum + (e.predicted - e.actual), 0)
  return totalBias / domainEntries.length
}

/** Get historical success rate for a domain from calibration data */
function getHistoricalSuccessRate(domain: string): { rate: number; count: number } {
  const data = loadCalibration()
  const entries = data.entries.filter(e => e.domain === domain)
  if (entries.length === 0) return { rate: 0.5, count: 0 }
  const avgActual = entries.reduce((sum, e) => sum + e.actual, 0) / entries.length
  return { rate: avgActual, count: entries.length }
}

/** Detect the primary domain from task text */
function detectDomain(task: string): string {
  const lower = task.toLowerCase()

  // Check file extensions
  const extMatch = lower.match(/\.(ts|tsx|js|jsx|py|rs|go|java|rb|cpp|c|cs|swift|kt|lua|zig|sql|css|html|md|yaml|yml|json|toml|sh|bash|zsh)/)
  if (extMatch) {
    const extMap: Record<string, string> = {
      ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
      py: 'python', rs: 'rust', go: 'go', java: 'java', rb: 'ruby',
      cpp: 'cpp', c: 'c', cs: 'csharp', swift: 'swift', kt: 'kotlin',
      lua: 'lua', zig: 'zig', sql: 'sql', css: 'css', html: 'html',
      md: 'writing', yaml: 'devops', yml: 'devops', json: 'config',
      toml: 'config', sh: 'devops', bash: 'devops', zsh: 'devops',
    }
    return extMap[extMatch[1]] || 'general'
  }

  // Check language/domain keywords
  const domainKeywords: Record<string, string[]> = {
    typescript: ['typescript', 'ts ', 'tsx', 'type ', 'interface ', 'enum '],
    javascript: ['javascript', 'js ', 'jsx', 'node', 'npm', 'yarn', 'pnpm', 'bun'],
    python: ['python', 'pip', 'conda', 'django', 'flask', 'fastapi', 'pytorch'],
    rust: ['rust', 'cargo', 'crate', 'impl ', 'fn ', 'struct '],
    go: ['golang', 'go ', 'goroutine', 'go mod'],
    devops: ['docker', 'kubernetes', 'k8s', 'terraform', 'ansible', 'ci/cd', 'pipeline', 'deploy', 'nginx', 'aws', 'gcp', 'azure'],
    database: ['sql', 'postgres', 'mysql', 'mongo', 'redis', 'supabase', 'prisma', 'database', 'migration'],
    writing: ['write', 'blog', 'article', 'documentation', 'readme', 'explain', 'describe'],
    testing: ['test', 'spec', 'coverage', 'vitest', 'jest', 'pytest', 'assert'],
    security: ['security', 'vulnerability', 'auth', 'permission', 'encrypt', 'cve'],
    design: ['css', 'style', 'layout', 'responsive', 'animation', 'color', 'font'],
    react: ['react', 'component', 'hook', 'jsx', 'tsx', 'next.js', 'nextjs', 'remix'],
    git: ['git', 'commit', 'branch', 'merge', 'rebase', 'pr ', 'pull request'],
  }

  for (const [domain, keywords] of Object.entries(domainKeywords)) {
    if (keywords.some(kw => lower.includes(kw))) return domain
  }

  return 'general'
}

/** Count complexity signals in a task description */
function assessComplexity(task: string): {
  fileCount: number
  ambiguity: number
  multiStep: boolean
} {
  const lower = task.toLowerCase()

  // Estimate number of files involved
  const fileRefs = (task.match(/\b\w+\.\w{1,5}\b/g) || []).length
  const dirRefs = (task.match(/\b\w+\//g) || []).length
  const fileCount = Math.max(1, fileRefs + dirRefs)

  // Ambiguity — vague words that signal unclear intent
  const vagueTerms = ['maybe', 'somehow', 'might', 'possibly', 'not sure', 'something like',
    'kind of', 'sort of', 'whatever', 'figure out', 'if possible']
  const ambiguity = vagueTerms.filter(t => lower.includes(t)).length / vagueTerms.length

  // Multi-step — signals that the task has multiple phases
  const multiStepTerms = ['then', 'after that', 'also', 'and then', 'next', 'finally',
    'first', 'second', 'step', 'multi', 'several', 'all', 'each']
  const multiStep = multiStepTerms.some(t => lower.includes(t))

  return { fileCount, ambiguity, multiStep }
}

/**
 * Estimate confidence for a task before execution.
 *
 * Considers task complexity, past success with similar tasks,
 * provider capability, and available context.
 */
export function estimateConfidence(task: string, context: string): ConfidenceScore {
  const domain = detectDomain(task)
  const taskType = classifyTask(task)
  const complexity = assessComplexity(task)
  const cachedPattern = findPattern(task)
  const historical = getHistoricalSuccessRate(domain)
  const calibrationBias = getCalibrationBias(domain)

  // ── Base scores ──

  // Factual confidence — higher if we have context, patterns, or history
  let factual = 0.5
  if (context.length > 200) factual += 0.15      // good context available
  if (context.length > 1000) factual += 0.1       // rich context
  if (cachedPattern) factual += 0.15              // we've done this before
  if (historical.count > 5) {
    factual += (historical.rate - 0.5) * 0.2      // historical performance adjustment
  }

  // Approach confidence — higher for known task types, lower for ambiguity
  let approach = 0.6
  if (taskType !== 'general') approach += 0.1     // recognized task type
  if (cachedPattern && cachedPattern.successRate > 0.8) approach += 0.2  // proven pattern
  approach -= complexity.ambiguity * 0.3          // ambiguity reduces confidence
  if (complexity.multiStep) approach -= 0.1       // multi-step = more room for error

  // Completeness — how sure we cover everything
  let completeness = 0.6
  if (complexity.fileCount > 5) completeness -= 0.15  // many files = easy to miss things
  if (complexity.multiStep) completeness -= 0.1       // multi-step = might skip a step
  if (context.includes('repo-map') || context.includes('project structure')) completeness += 0.1
  if (cachedPattern) completeness += 0.1

  // Provider adjustment — local models get a penalty on complex tasks
  try {
    const provider = getByokProvider()
    if (isLocalProvider(provider)) {
      const localPenalty = complexity.multiStep ? 0.2 : 0.1
      factual -= localPenalty
      approach -= localPenalty
      completeness -= localPenalty * 0.5
    }
  } catch { /* no provider configured — skip adjustment */ }

  // Apply calibration correction — if we're historically overconfident, reduce scores
  factual -= calibrationBias * 0.5
  approach -= calibrationBias * 0.5
  completeness -= calibrationBias * 0.3

  // Clamp all scores to [0.05, 0.99]
  factual = Math.max(0.05, Math.min(0.99, factual))
  approach = Math.max(0.05, Math.min(0.99, approach))
  completeness = Math.max(0.05, Math.min(0.99, completeness))

  // Overall — weighted average
  const overall = Math.round((factual * 0.3 + approach * 0.4 + completeness * 0.3) * 100) / 100

  // Build reasoning
  const reasons: string[] = []
  if (cachedPattern) reasons.push('have a proven pattern for this')
  if (historical.count > 5 && historical.rate > 0.7) reasons.push(`strong track record in ${domain}`)
  if (historical.count > 5 && historical.rate < 0.4) reasons.push(`historically weak in ${domain}`)
  if (complexity.ambiguity > 0.2) reasons.push('request is somewhat ambiguous')
  if (complexity.multiStep) reasons.push('multi-step task')
  if (context.length < 100) reasons.push('limited context available')
  try {
    if (isLocalProvider(getByokProvider())) reasons.push('using local model (lower capability)')
  } catch { /* skip */ }

  const pct = Math.round(overall * 100)
  const reasoning = reasons.length > 0
    ? `~${pct}% confident — ${reasons.join(', ')}`
    : `~${pct}% confident — standard assessment for ${domain} ${taskType} task`

  return {
    overall,
    factual: Math.round(factual * 100) / 100,
    approach: Math.round(approach * 100) / 100,
    completeness: Math.round(completeness * 100) / 100,
    reasoning,
  }
}

/**
 * Format a confidence score as a human-readable string.
 */
export function reportConfidence(score: ConfidenceScore): string {
  const pct = Math.round(score.overall * 100)
  const level = pct >= 80 ? 'high' : pct >= 50 ? 'moderate' : 'low'

  const lines = [
    `Confidence: ${pct}% (${level})`,
    `  Factual:      ${Math.round(score.factual * 100)}%`,
    `  Approach:     ${Math.round(score.approach * 100)}%`,
    `  Completeness: ${Math.round(score.completeness * 100)}%`,
    `  ${score.reasoning}`,
  ]

  return lines.join('\n')
}

/**
 * Record a calibration entry — predicted vs actual (from self-eval or user feedback).
 * Called after a task completes to improve future predictions.
 */
export function recordCalibration(task: string, predicted: number, actual: number): void {
  const domain = detectDomain(task)
  const data = loadCalibration()

  data.entries.push({
    task: task.slice(0, 200), // truncate for storage
    predicted,
    actual,
    domain,
    timestamp: new Date().toISOString(),
  })

  // Recompute running average error
  if (data.entries.length > 0) {
    data.avgError = data.entries.reduce((sum, e) => sum + Math.abs(e.predicted - e.actual), 0) / data.entries.length
  }

  saveCalibration(data)
}


// ══════════════════════════════════════════════════════════════════
// 2. SKILL BOUNDARIES (Self-Model)
// ══════════════════════════════════════════════════════════════════

export interface SkillEntry {
  /** Domain or skill area, e.g. 'typescript', 'python', 'devops' */
  domain: string
  /** 0-1 success rate from historical data */
  successRate: number
  /** 0-1 average confidence when working in this domain */
  avgConfidence: number
  /** Number of task attempts */
  sampleSize: number
  /** ISO date of last attempt */
  lastAttempt: string
}

export interface SkillProfile {
  /** Domains the agent excels at (successRate >= 0.7, sampleSize >= 3) */
  strengths: SkillEntry[]
  /** Domains the agent struggles with (successRate < 0.5, sampleSize >= 3) */
  weaknesses: SkillEntry[]
  /** Domains the agent hasn't tried enough to assess (<3 samples) */
  unknown: string[]
}

/** Persisted skill data */
interface SkillData {
  skills: Record<string, {
    successCount: number
    failureCount: number
    totalConfidence: number
    sampleSize: number
    lastAttempt: string
  }>
}

function loadSkillData(): SkillData {
  return loadJSON<SkillData>(SKILL_FILE, { skills: {} })
}

function saveSkillData(data: SkillData): void {
  saveJSON(SKILL_FILE, data)
}

/**
 * Build a skill profile from stored skill data and calibration history.
 */
export function getSkillProfile(): SkillProfile {
  const skillData = loadSkillData()
  const calibration = loadCalibration()

  // Merge skill data with calibration entries for domains not in skill data
  const domainSet = new Set<string>(Object.keys(skillData.skills))
  for (const entry of calibration.entries) {
    domainSet.add(entry.domain)
  }

  const allDomains = Array.from(domainSet)
  const entries: SkillEntry[] = []

  for (const domain of allDomains) {
    const stored = skillData.skills[domain]
    const calEntries = calibration.entries.filter(e => e.domain === domain)

    let successRate: number
    let avgConfidence: number
    let sampleSize: number
    let lastAttempt: string

    if (stored) {
      sampleSize = stored.sampleSize
      successRate = sampleSize > 0 ? stored.successCount / sampleSize : 0.5
      avgConfidence = sampleSize > 0 ? stored.totalConfidence / sampleSize : 0.5
      lastAttempt = stored.lastAttempt
    } else if (calEntries.length > 0) {
      sampleSize = calEntries.length
      successRate = calEntries.reduce((s, e) => s + e.actual, 0) / sampleSize
      avgConfidence = calEntries.reduce((s, e) => s + e.predicted, 0) / sampleSize
      lastAttempt = calEntries[calEntries.length - 1].timestamp
    } else {
      continue
    }

    entries.push({
      domain,
      successRate: Math.round(successRate * 100) / 100,
      avgConfidence: Math.round(avgConfidence * 100) / 100,
      sampleSize,
      lastAttempt,
    })
  }

  // All known domains that could exist but have no data
  const allKnownDomains = [
    'typescript', 'javascript', 'python', 'rust', 'go', 'java', 'ruby',
    'cpp', 'c', 'csharp', 'swift', 'kotlin', 'devops', 'database', 'sql',
    'testing', 'security', 'design', 'writing', 'react', 'git', 'config',
    'html', 'css', 'lua', 'zig',
  ]

  const strengths = entries
    .filter(e => e.successRate >= 0.7 && e.sampleSize >= 3)
    .sort((a, b) => b.successRate - a.successRate)

  const weaknesses = entries
    .filter(e => e.successRate < 0.5 && e.sampleSize >= 3)
    .sort((a, b) => a.successRate - b.successRate)

  const assessedDomains = new Set(entries.map(e => e.domain))
  const unknown = allKnownDomains.filter(d => {
    const entry = entries.find(e => e.domain === d)
    return !entry || entry.sampleSize < 3
  })

  return { strengths, weaknesses, unknown }
}

/**
 * Assess whether the agent is suitable for a given task.
 */
export function assessSkillForTask(task: string): {
  canDo: boolean
  confidence: number
  suggestion?: string
} {
  const domain = detectDomain(task)
  const profile = getSkillProfile()

  // Check if this is a known strength
  const strength = profile.strengths.find(s => s.domain === domain)
  if (strength) {
    return {
      canDo: true,
      confidence: strength.avgConfidence,
    }
  }

  // Check if this is a known weakness
  const weakness = profile.weaknesses.find(w => w.domain === domain)
  if (weakness) {
    return {
      canDo: true,
      confidence: weakness.avgConfidence,
      suggestion: `Historical success rate in ${domain} is ${Math.round(weakness.successRate * 100)}% — consider breaking this into smaller steps or using a specialized tool.`,
    }
  }

  // Check if unknown domain
  if (profile.unknown.includes(domain)) {
    return {
      canDo: true,
      confidence: 0.5,
      suggestion: `Limited experience with ${domain} tasks — proceeding with caution.`,
    }
  }

  // General domain — no strong signal either way
  return {
    canDo: true,
    confidence: 0.6,
  }
}

/**
 * Update the skill profile after completing a task.
 *
 * @param domain - The task domain (auto-detected or overridden)
 * @param success - Whether the task completed successfully
 * @param confidence - The confidence score used for this task
 */
export function updateSkillProfile(domain: string, success: boolean, confidence: number): void {
  const data = loadSkillData()

  const existing = data.skills[domain]
  if (existing) {
    if (success) existing.successCount++
    else existing.failureCount++
    existing.totalConfidence += confidence
    existing.sampleSize++
    existing.lastAttempt = new Date().toISOString()
  } else {
    data.skills[domain] = {
      successCount: success ? 1 : 0,
      failureCount: success ? 0 : 1,
      totalConfidence: confidence,
      sampleSize: 1,
      lastAttempt: new Date().toISOString(),
    }
  }

  saveSkillData(data)
}


// ══════════════════════════════════════════════════════════════════
// 3. EFFORT ESTIMATION
// ══════════════════════════════════════════════════════════════════

export interface EffortEstimate {
  /** Tool call count estimate: min, expected, max */
  toolCalls: { min: number; expected: number; max: number }
  /** Estimated cost in USD: min, expected, max */
  estimatedCostUsd: { min: number; expected: number; max: number }
  /** Complexity classification */
  complexity: 'trivial' | 'simple' | 'moderate' | 'complex' | 'ambitious'
  /** Human-readable breakdown of expected operations */
  breakdown: string
}

/** Stored effort history entry */
interface EffortHistoryEntry {
  task: string
  taskType: string
  domain: string
  predicted: { toolCalls: number; costUsd: number; complexity: string }
  actual?: { toolCalls: number; costUsd: number }
  timestamp: string
}

interface EffortHistory {
  entries: EffortHistoryEntry[]
}

function loadEffortHistory(): EffortHistory {
  return loadJSON<EffortHistory>(EFFORT_FILE, { entries: [] })
}

function saveEffortHistory(data: EffortHistory): void {
  // Keep only last 100
  if (data.entries.length > 100) {
    data.entries = data.entries.slice(-100)
  }
  saveJSON(EFFORT_FILE, data)
}

/** Get average actual tool calls for a task type from history */
function getHistoricalEffort(taskType: string, domain: string): {
  avgToolCalls: number
  avgCost: number
  count: number
} | null {
  const history = loadEffortHistory()
  const relevant = history.entries.filter(
    e => e.actual && (e.taskType === taskType || e.domain === domain)
  )

  if (relevant.length < 2) return null

  const avgToolCalls = relevant.reduce((s, e) => s + (e.actual!.toolCalls || 0), 0) / relevant.length
  const avgCost = relevant.reduce((s, e) => s + (e.actual!.costUsd || 0), 0) / relevant.length

  return { avgToolCalls, avgCost, count: relevant.length }
}

/** Complexity classification based on signals */
function classifyComplexity(task: string): 'trivial' | 'simple' | 'moderate' | 'complex' | 'ambitious' {
  const complexity = assessComplexity(task)
  const taskType = classifyTask(task)
  const wordCount = task.split(/\s+/).length

  // Simple heuristics
  if (wordCount < 8 && !complexity.multiStep && complexity.fileCount <= 1) return 'trivial'
  if (wordCount < 20 && !complexity.multiStep && complexity.fileCount <= 2) return 'simple'
  if (complexity.fileCount > 10 || (complexity.multiStep && wordCount > 50)) return 'ambitious'
  if (complexity.multiStep || complexity.fileCount > 5 || wordCount > 40) return 'complex'
  return 'moderate'
}

/** Estimate tool call counts by task type */
function estimateToolCounts(taskType: string, complexityLevel: string, fileCount: number): {
  min: number; expected: number; max: number
} {
  // Base estimates by task type
  const baseEstimates: Record<string, { min: number; expected: number; max: number }> = {
    debug:    { min: 3, expected: 6, max: 15 },
    build:    { min: 5, expected: 10, max: 25 },
    refactor: { min: 3, expected: 8, max: 20 },
    test:     { min: 2, expected: 5, max: 12 },
    deploy:   { min: 2, expected: 5, max: 10 },
    explain:  { min: 1, expected: 3, max: 6 },
    review:   { min: 2, expected: 5, max: 12 },
    search:   { min: 1, expected: 3, max: 8 },
    general:  { min: 2, expected: 5, max: 12 },
  }

  const base = baseEstimates[taskType] || baseEstimates.general

  // Complexity multiplier
  const complexityMultiplier: Record<string, number> = {
    trivial: 0.3,
    simple: 0.6,
    moderate: 1.0,
    complex: 1.8,
    ambitious: 3.0,
  }

  const mult = complexityMultiplier[complexityLevel] || 1.0

  // File count adjustment
  const fileAdj = Math.max(0, (fileCount - 2) * 0.5)

  return {
    min: Math.max(1, Math.round(base.min * mult)),
    expected: Math.max(1, Math.round(base.expected * mult + fileAdj)),
    max: Math.max(2, Math.round(base.max * mult + fileAdj * 2)),
  }
}

/** Build a human-readable breakdown of expected operations */
function buildBreakdown(taskType: string, fileCount: number, complexityLevel: string): string {
  const parts: string[] = []

  // Reads
  const reads = Math.max(1, Math.ceil(fileCount * 0.8))
  parts.push(`~${reads} file read${reads > 1 ? 's' : ''}`)

  // Edits
  if (['build', 'debug', 'refactor'].includes(taskType)) {
    const edits = Math.max(1, Math.ceil(fileCount * 0.5))
    parts.push(`~${edits} edit${edits > 1 ? 's' : ''}`)
  }

  // Search
  if (['debug', 'search', 'review', 'refactor'].includes(taskType)) {
    parts.push('~1-2 searches')
  }

  // Test/build run
  if (['test', 'build', 'debug', 'deploy'].includes(taskType)) {
    parts.push('~1 test/build run')
  }

  // Git
  if (['deploy', 'build'].includes(taskType)) {
    parts.push('~1 git operation')
  }

  if (complexityLevel === 'ambitious') {
    parts.push('may require multiple iterations')
  }

  return parts.join(', ')
}

/**
 * Estimate the effort required for a task — tool calls, cost, and complexity.
 *
 * @param task - The task description
 * @param context - Optional context (repo state, file list, etc.)
 */
export function estimateEffort(task: string, context?: string): EffortEstimate {
  const taskType = classifyTask(task)
  const domain = detectDomain(task)
  const complexityLevel = classifyComplexity(task)
  const complexity = assessComplexity(task)

  // Try historical data first
  const historical = getHistoricalEffort(taskType, domain)

  let toolCalls: { min: number; expected: number; max: number }

  if (historical && historical.count >= 3) {
    // Use historical averages with some spread
    const avg = Math.round(historical.avgToolCalls)
    toolCalls = {
      min: Math.max(1, Math.round(avg * 0.5)),
      expected: avg,
      max: Math.round(avg * 2),
    }
  } else {
    toolCalls = estimateToolCounts(taskType, complexityLevel, complexity.fileCount)
  }

  // Cost estimation — rough approximation based on tool calls
  // Each tool call ~ 500 input tokens + 200 output tokens on average
  const tokensPerCall = { input: 500, output: 200 }
  let costPerCall: number

  try {
    const provider = getByokProvider()
    costPerCall = estimateCost(provider, tokensPerCall.input, tokensPerCall.output)
    if (isLocalProvider(provider)) costPerCall = 0
  } catch {
    // Default to Anthropic pricing (~$3/$15 per MTok)
    costPerCall = (tokensPerCall.input * 3 / 1_000_000) + (tokensPerCall.output * 15 / 1_000_000)
  }

  const estimatedCostUsd = {
    min: Math.round(toolCalls.min * costPerCall * 10000) / 10000,
    expected: Math.round(toolCalls.expected * costPerCall * 10000) / 10000,
    max: Math.round(toolCalls.max * costPerCall * 10000) / 10000,
  }

  const breakdown = buildBreakdown(taskType, complexity.fileCount, complexityLevel)

  // Store prediction for later calibration
  const history = loadEffortHistory()
  history.entries.push({
    task: task.slice(0, 200),
    taskType,
    domain,
    predicted: {
      toolCalls: toolCalls.expected,
      costUsd: estimatedCostUsd.expected,
      complexity: complexityLevel,
    },
    timestamp: new Date().toISOString(),
  })
  saveEffortHistory(history)

  return {
    toolCalls,
    estimatedCostUsd,
    complexity: complexityLevel,
    breakdown,
  }
}

/**
 * Record actual effort after a task completes, for future calibration.
 */
export function recordActualEffort(task: string, actualToolCalls: number, actualCostUsd: number): void {
  const history = loadEffortHistory()

  // Find the most recent prediction for this task
  const taskSlice = task.slice(0, 200)
  for (let i = history.entries.length - 1; i >= 0; i--) {
    if (history.entries[i].task === taskSlice && !history.entries[i].actual) {
      history.entries[i].actual = { toolCalls: actualToolCalls, costUsd: actualCostUsd }
      break
    }
  }

  saveEffortHistory(history)
}


// ══════════════════════════════════════════════════════════════════
// TOOL REGISTRATION
// ══════════════════════════════════════════════════════════════════

/**
 * Register confidence engine tools with the K:BOT tool registry.
 */
export function registerConfidenceTools(): void {
  registerTool({
    name: 'confidence_check',
    description: 'Get a confidence score for a proposed action or task. Returns factual, approach, and completeness scores with reasoning.',
    parameters: {
      task: {
        type: 'string',
        description: 'Description of the task or action to assess confidence for',
        required: true,
      },
      context: {
        type: 'string',
        description: 'Available context (repo state, file contents, memory, etc.)',
        required: false,
        default: '',
      },
    },
    tier: 'free',
    execute: async (args) => {
      const task = String(args.task || '')
      const context = String(args.context || '')

      if (!task) return 'Error: task parameter is required'

      const score = estimateConfidence(task, context)
      return reportConfidence(score)
    },
  })

  registerTool({
    name: 'skill_profile',
    description: 'Show the agent skill profile — strengths, weaknesses, and untested domains. Optionally assess suitability for a specific task.',
    parameters: {
      task: {
        type: 'string',
        description: 'Optional task to assess suitability for',
        required: false,
      },
    },
    tier: 'free',
    execute: async (args) => {
      const task = args.task ? String(args.task) : null

      const profile = getSkillProfile()
      const lines: string[] = ['=== Skill Profile ===', '']

      if (profile.strengths.length > 0) {
        lines.push('Strengths:')
        for (const s of profile.strengths) {
          lines.push(`  ${s.domain}: ${Math.round(s.successRate * 100)}% success (${s.sampleSize} tasks, avg confidence ${Math.round(s.avgConfidence * 100)}%)`)
        }
        lines.push('')
      }

      if (profile.weaknesses.length > 0) {
        lines.push('Weaknesses:')
        for (const w of profile.weaknesses) {
          lines.push(`  ${w.domain}: ${Math.round(w.successRate * 100)}% success (${w.sampleSize} tasks, avg confidence ${Math.round(w.avgConfidence * 100)}%)`)
        }
        lines.push('')
      }

      if (profile.unknown.length > 0) {
        lines.push(`Untested domains: ${profile.unknown.join(', ')}`)
        lines.push('')
      }

      if (task) {
        lines.push('--- Task Assessment ---')
        const assessment = assessSkillForTask(task)
        lines.push(`Can do: ${assessment.canDo ? 'yes' : 'no'}`)
        lines.push(`Confidence: ${Math.round(assessment.confidence * 100)}%`)
        if (assessment.suggestion) lines.push(`Note: ${assessment.suggestion}`)
      }

      return lines.join('\n')
    },
  })

  registerTool({
    name: 'effort_estimate',
    description: 'Predict how many tool calls, cost, and complexity a task will involve. Uses historical data when available.',
    parameters: {
      task: {
        type: 'string',
        description: 'Description of the task to estimate effort for',
        required: true,
      },
      context: {
        type: 'string',
        description: 'Optional context about the current state',
        required: false,
      },
    },
    tier: 'free',
    execute: async (args) => {
      const task = String(args.task || '')
      const context = args.context ? String(args.context) : undefined

      if (!task) return 'Error: task parameter is required'

      const estimate = estimateEffort(task, context)
      const lines = [
        '=== Effort Estimate ===',
        '',
        `Complexity: ${estimate.complexity}`,
        '',
        `Tool calls:`,
        `  Min:      ${estimate.toolCalls.min}`,
        `  Expected: ${estimate.toolCalls.expected}`,
        `  Max:      ${estimate.toolCalls.max}`,
        '',
        `Estimated cost (USD):`,
        `  Min:      $${estimate.estimatedCostUsd.min.toFixed(4)}`,
        `  Expected: $${estimate.estimatedCostUsd.expected.toFixed(4)}`,
        `  Max:      $${estimate.estimatedCostUsd.max.toFixed(4)}`,
        '',
        `Breakdown: ${estimate.breakdown}`,
      ]

      return lines.join('\n')
    },
  })
}
