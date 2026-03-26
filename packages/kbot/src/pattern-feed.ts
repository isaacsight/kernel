// kbot Pattern Feed — Collective Memory Surface
//
// The collective memory — surfaces what worked for people like you.
// Reads local patterns + collective patterns, scores by relevance,
// and returns a feed of top insights grouped by category.
//
// Node built-ins only. No external dependencies.

import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'

// ── Paths ──

const KBOT_DIR = join(homedir(), '.kbot')
const MEMORY_DIR = join(KBOT_DIR, 'memory')
const COLLECTIVE_DIR = join(KBOT_DIR, 'collective')
const PATTERNS_FILE = join(MEMORY_DIR, 'patterns.json')
const COLLECTIVE_PATTERNS_FILE = join(COLLECTIVE_DIR, 'learned-patterns.json')

// ── Types ──

export interface FeedPattern {
  /** Pattern type: intent_match, tool_sequence, etc. */
  type: string
  /** Programming language (if detected) */
  language: string | null
  /** Framework (if detected) */
  framework: string | null
  /** Success rate 0-1 */
  successRate: number
  /** Tool names used */
  toolsUsed: string[]
  /** Agent that handled it */
  agentUsed: string | null
  /** Number of times this pattern was observed */
  hits: number
  /** Keywords (generic tech terms) */
  keywords: string[]
  /** Confidence score (0-1) */
  confidence: number
  /** Number of contributing sources */
  sampleCount: number
  /** Last updated timestamp */
  lastUpdated: string
  /** Source: 'local' or 'collective' */
  source: 'local' | 'collective'
}

export interface FeedEntry {
  /** Human-readable insight */
  insight: string
  /** Feed category */
  category: FeedCategory
  /** Relevance score (higher = more relevant) */
  score: number
  /** Underlying pattern */
  pattern: FeedPattern
}

export type FeedCategory =
  | 'tools_that_worked'
  | 'best_agents'
  | 'common_solutions'
  | 'forged_tools'

export interface FeedResult {
  entries: FeedEntry[]
  total_patterns_scanned: number
  project_type: string | null
}

// ── Helpers ──

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function loadJSON<T>(path: string, fallback: T): T {
  try {
    if (existsSync(path)) {
      return JSON.parse(readFileSync(path, 'utf-8'))
    }
  } catch {
    // Corrupt file — return fallback
  }
  return fallback
}

/** Raw local pattern shape from ~/.kbot/memory/patterns.json */
interface RawLocalPattern {
  intent?: string
  keywords?: string[]
  toolSequence?: string[]
  hits?: number
  successRate?: number
  lastUsed?: string
  agentUsed?: string
  avgTokensSaved?: number
}

/** Raw collective pattern shape from ~/.kbot/collective/learned-patterns.json */
interface RawCollectivePattern {
  type: string
  language: string | null
  framework: string | null
  successRate: number
  toolsUsed: string[]
  agentUsed: string | null
  hits: number
  keywords: string[]
  confidence: number
  sampleCount: number
  lastUpdated: string
  source?: string
}

// ── Language/Framework Detection ──

const LANGUAGE_MAP: Record<string, string> = {
  typescript: 'TypeScript', javascript: 'JavaScript', python: 'Python',
  rust: 'Rust', go: 'Go', java: 'Java', ruby: 'Ruby', php: 'PHP',
  swift: 'Swift', kotlin: 'Kotlin', csharp: 'C#', cpp: 'C++',
  node: 'Node.js',
}

const FRAMEWORK_MAP: Record<string, string> = {
  react: 'React', nextjs: 'Next.js', vue: 'Vue', angular: 'Angular',
  svelte: 'Svelte', express: 'Express', fastify: 'Fastify', django: 'Django',
  flask: 'Flask', rails: 'Rails', spring: 'Spring', prisma: 'Prisma',
  drizzle: 'Drizzle', tailwind: 'Tailwind', vite: 'Vite', webpack: 'Webpack',
}

function detectLanguage(keywords: string[]): string | null {
  for (const kw of keywords) {
    const lang = LANGUAGE_MAP[kw.toLowerCase()]
    if (lang) return lang
  }
  return null
}

function detectFramework(keywords: string[]): string | null {
  for (const kw of keywords) {
    const fw = FRAMEWORK_MAP[kw.toLowerCase()]
    if (fw) return fw
  }
  return null
}

// ── Pattern Loading ──

/** Load local patterns and normalize to FeedPattern shape */
function loadLocalPatterns(): FeedPattern[] {
  const raw = loadJSON<RawLocalPattern[]>(PATTERNS_FILE, [])
  if (!Array.isArray(raw)) return []

  return raw.map(p => {
    const keywords = Array.isArray(p.keywords) ? p.keywords : []
    const toolsUsed = Array.isArray(p.toolSequence) ? p.toolSequence : []
    return {
      type: typeof p.intent === 'string' ? 'intent_match' : 'unknown',
      language: detectLanguage(keywords),
      framework: detectFramework(keywords),
      successRate: typeof p.successRate === 'number' ? p.successRate : 0,
      toolsUsed,
      agentUsed: typeof p.agentUsed === 'string' ? p.agentUsed : null,
      hits: typeof p.hits === 'number' ? p.hits : 1,
      keywords,
      confidence: typeof p.successRate === 'number' ? p.successRate : 0.5,
      sampleCount: 1,
      lastUpdated: typeof p.lastUsed === 'string' ? p.lastUsed : new Date().toISOString(),
      source: 'local' as const,
    }
  })
}

/** Load collective patterns and normalize to FeedPattern shape */
function loadCollectivePatterns(): FeedPattern[] {
  const raw = loadJSON<RawCollectivePattern[]>(COLLECTIVE_PATTERNS_FILE, [])
  if (!Array.isArray(raw)) return []

  return raw.map(p => ({
    type: p.type || 'unknown',
    language: p.language,
    framework: p.framework,
    successRate: p.successRate,
    toolsUsed: Array.isArray(p.toolsUsed) ? p.toolsUsed : [],
    agentUsed: p.agentUsed,
    hits: typeof p.hits === 'number' ? p.hits : 1,
    keywords: Array.isArray(p.keywords) ? p.keywords : [],
    confidence: typeof p.confidence === 'number' ? p.confidence : 0.5,
    sampleCount: typeof p.sampleCount === 'number' ? p.sampleCount : 1,
    lastUpdated: p.lastUpdated || new Date().toISOString(),
    source: 'collective' as const,
  }))
}

// ── Scoring ──

/** Score a pattern by: relevance to project type x confidence x frequency */
function scorePattern(pattern: FeedPattern, projectType: string | null): number {
  // Base score from confidence (0-1)
  let score = pattern.confidence

  // Frequency weight: more observations = more reliable
  const frequencyWeight = Math.min(Math.log2(pattern.hits + 1) / 10, 0.3)
  score += frequencyWeight

  // Sample count weight (collective breadth)
  const sampleWeight = Math.min(Math.log2(pattern.sampleCount + 1) / 10, 0.2)
  score += sampleWeight

  // Success rate weight
  score *= (0.5 + pattern.successRate * 0.5)

  // Relevance to project type (if specified)
  if (projectType) {
    const normalizedProject = projectType.toLowerCase()
    const allTerms = [
      ...pattern.keywords.map(k => k.toLowerCase()),
      pattern.language?.toLowerCase() || '',
      pattern.framework?.toLowerCase() || '',
    ].filter(Boolean)

    const isRelevant = allTerms.some(
      term => term.includes(normalizedProject) || normalizedProject.includes(term)
    )
    if (isRelevant) {
      score *= 1.5 // 50% boost for project-relevant patterns
    } else {
      score *= 0.5 // 50% penalty for unrelated patterns
    }
  }

  // Recency boost: patterns updated recently are slightly more valuable
  try {
    const ageMs = Date.now() - new Date(pattern.lastUpdated).getTime()
    const ageDays = ageMs / (1000 * 60 * 60 * 24)
    if (ageDays < 7) score *= 1.1
    else if (ageDays > 90) score *= 0.9
  } catch {
    // Invalid date — no adjustment
  }

  return score
}

// ── Categorization ──

/** Assign a pattern to its primary feed category */
function categorizePattern(pattern: FeedPattern): FeedCategory {
  // Forged tools: patterns with tool names that look custom (contain underscores, longer names)
  const hasForgedTool = pattern.toolsUsed.some(
    t => t.includes('_') && t.length > 15
  )
  if (hasForgedTool) return 'forged_tools'

  // Best agents: patterns where the agent is the key differentiator
  if (pattern.agentUsed && pattern.successRate > 0.8 && pattern.hits > 3) {
    return 'best_agents'
  }

  // Tools that worked: patterns with specific tool sequences
  if (pattern.toolsUsed.length > 0) {
    return 'tools_that_worked'
  }

  // Default: common solutions
  return 'common_solutions'
}

// ── Feed Entry Formatting ──

/** Format a single pattern as a readable insight */
export function formatFeedEntry(pattern: FeedPattern): string {
  const parts: string[] = []

  // Build the context: "React + TypeScript users" or "Python users"
  const context: string[] = []
  if (pattern.framework) context.push(pattern.framework)
  if (pattern.language) context.push(pattern.language)
  const contextStr = context.length > 0
    ? `${context.join(' + ')} users`
    : 'Users'

  // Build the finding
  const successPct = Math.round(pattern.successRate * 100)
  const observationCount = pattern.source === 'collective'
    ? pattern.sampleCount
    : pattern.hits

  if (pattern.agentUsed && pattern.toolsUsed.length > 0) {
    parts.push(
      `${contextStr} found that the ${pattern.agentUsed} agent with ${pattern.toolsUsed.join('+')} tools`
    )
    parts.push(
      `solves ${pattern.type === 'intent_match' ? 'matching' : pattern.type} tasks ${successPct}% of the time`
    )
  } else if (pattern.agentUsed) {
    parts.push(
      `${contextStr} found that the ${pattern.agentUsed} agent`
    )
    parts.push(
      `succeeds ${successPct}% of the time for ${pattern.type} tasks`
    )
  } else if (pattern.toolsUsed.length > 0) {
    parts.push(
      `${contextStr} found that ${pattern.toolsUsed.join(' + ')} tools`
    )
    parts.push(
      `work ${successPct}% of the time`
    )
  } else {
    parts.push(
      `${contextStr} report a ${successPct}% success rate for ${pattern.type} tasks`
    )
  }

  // Add observation count
  const observationLabel = pattern.source === 'collective' ? 'contributors' : 'observations'
  parts.push(`(based on ${observationCount} ${observationLabel})`)

  return parts.join(' ')
}

// ── Core API ──

/**
 * Run the pattern feed. Reads local + collective patterns, scores them,
 * groups by category, and returns the top 20 insights.
 *
 * @param options.projectType - Optional project type filter (react, python, etc.)
 * @returns Feed result with entries, total patterns scanned, and project type
 */
export function runPatternFeed(options?: { projectType?: string }): FeedResult {
  const projectType = options?.projectType ?? null

  // 1. Load all patterns
  const localPatterns = loadLocalPatterns()
  const collectivePatterns = loadCollectivePatterns()
  const allPatterns = [...localPatterns, ...collectivePatterns]

  if (allPatterns.length === 0) {
    return {
      entries: [],
      total_patterns_scanned: 0,
      project_type: projectType,
    }
  }

  // 2. Score each pattern
  const scored = allPatterns.map(pattern => ({
    pattern,
    score: scorePattern(pattern, projectType),
    category: categorizePattern(pattern),
  }))

  // 3. Sort by score descending
  scored.sort((a, b) => b.score - a.score)

  // 4. Group by category, take top entries from each to ensure diversity
  const categoryBuckets = new Map<FeedCategory, typeof scored>()
  for (const entry of scored) {
    const bucket = categoryBuckets.get(entry.category) || []
    bucket.push(entry)
    categoryBuckets.set(entry.category, bucket)
  }

  // Take top entries from each category proportionally, up to 20 total
  const maxEntries = 20
  const categories: FeedCategory[] = ['tools_that_worked', 'best_agents', 'common_solutions', 'forged_tools']
  const feedEntries: FeedEntry[] = []

  // First pass: at least 3 from each non-empty category
  for (const cat of categories) {
    const bucket = categoryBuckets.get(cat) || []
    const take = Math.min(bucket.length, 3)
    for (let i = 0; i < take; i++) {
      const item = bucket[i]
      feedEntries.push({
        insight: formatFeedEntry(item.pattern),
        category: item.category,
        score: item.score,
        pattern: item.pattern,
      })
    }
  }

  // Second pass: fill remaining slots from overall top scored
  if (feedEntries.length < maxEntries) {
    const usedPatterns = new Set(feedEntries.map(e => patternFingerprint(e.pattern)))
    for (const item of scored) {
      if (feedEntries.length >= maxEntries) break
      const fp = patternFingerprint(item.pattern)
      if (usedPatterns.has(fp)) continue
      usedPatterns.add(fp)
      feedEntries.push({
        insight: formatFeedEntry(item.pattern),
        category: item.category,
        score: item.score,
        pattern: item.pattern,
      })
    }
  }

  // Sort final feed by score
  feedEntries.sort((a, b) => b.score - a.score)

  return {
    entries: feedEntries.slice(0, maxEntries),
    total_patterns_scanned: allPatterns.length,
    project_type: projectType,
  }
}

/**
 * Get a feed filtered for a specific project type.
 * Returns patterns that other users of the same stack found useful.
 */
export function getFeedForProject(projectType: string): FeedResult {
  return runPatternFeed({ projectType })
}

/**
 * Full-text search across all patterns.
 * Returns matching insights with confidence scores.
 */
export function searchFeed(query: string): FeedEntry[] {
  if (!query || typeof query !== 'string') return []

  const queryTerms = query.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1)

  if (queryTerms.length === 0) return []

  // Load all patterns
  const localPatterns = loadLocalPatterns()
  const collectivePatterns = loadCollectivePatterns()
  const allPatterns = [...localPatterns, ...collectivePatterns]

  // Score each pattern by query match
  const results: FeedEntry[] = []

  for (const pattern of allPatterns) {
    const searchableTerms = [
      ...pattern.keywords.map(k => k.toLowerCase()),
      pattern.language?.toLowerCase() || '',
      pattern.framework?.toLowerCase() || '',
      pattern.type?.toLowerCase() || '',
      pattern.agentUsed?.toLowerCase() || '',
      ...pattern.toolsUsed.map(t => t.toLowerCase()),
    ].filter(Boolean)

    let matchScore = 0
    for (const qt of queryTerms) {
      for (const term of searchableTerms) {
        if (term.includes(qt) || qt.includes(term)) {
          matchScore++
        }
      }
    }

    if (matchScore > 0) {
      // Combine text match score with pattern confidence
      const combinedScore = matchScore * 0.5 + pattern.confidence * 0.5

      results.push({
        insight: formatFeedEntry(pattern),
        category: categorizePattern(pattern),
        score: combinedScore,
        pattern,
      })
    }
  }

  // Sort by combined score descending
  results.sort((a, b) => b.score - a.score)

  return results.slice(0, 20)
}

// ── Internal Helpers ──

/** Generate a fingerprint for dedup within a feed */
function patternFingerprint(p: FeedPattern): string {
  const parts = [
    p.type,
    p.language || '',
    p.framework || '',
    p.source,
    ...(p.toolsUsed || []).sort(),
    ...(p.keywords || []).sort(),
  ]
  return parts.join(':').toLowerCase()
}
