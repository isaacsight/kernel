// kbot Recursive Language Learning Engine
//
// GOAL: Reduce token and message usage over time by learning from interactions.
//
// Three systems:
// 1. PATTERN CACHE — Cache successful tool sequences so repeat problems skip the API
// 2. SOLUTION INDEX — Extract reusable solutions from past conversations
// 3. USER PROFILE — Learn user preferences, style, and common workflows
//
// Everything persists to ~/.kbot/memory/ as JSON files.
//
// CONCURRENCY NOTE: Module-level state (patterns, solutions, profile, etc.) is
// intentionally shared across concurrent requests in `kbot serve` mode — learning
// data is cumulative and global. All mutation functions are synchronous, so they
// cannot interleave in Node.js's single-threaded event loop. The debounced saveJSON
// writer coalesces concurrent writes. selfTrain() uses a guard to prevent overlapping runs.

import { homedir } from 'node:os'
import { join } from 'node:path'
import { existsSync, readFileSync, writeFileSync, writeFile, mkdirSync } from 'node:fs'
import { getSkillRatingSystem } from './skill-rating.js'

const LEARN_DIR = join(homedir(), '.kbot', 'memory')
const PATTERNS_FILE = join(LEARN_DIR, 'patterns.json')
const SOLUTIONS_FILE = join(LEARN_DIR, 'solutions.json')
const PROFILE_FILE = join(LEARN_DIR, 'profile.json')
const STATS_FILE = join(LEARN_DIR, 'stats.json')
const KNOWLEDGE_FILE = join(LEARN_DIR, 'knowledge.json')
const CORRECTIONS_FILE = join(LEARN_DIR, 'corrections.json')
const PROJECTS_FILE = join(LEARN_DIR, 'projects.json')

function ensureDir(): void {
  if (!existsSync(LEARN_DIR)) mkdirSync(LEARN_DIR, { recursive: true })
}

function loadJSON<T>(path: string, fallback: T): T {
  ensureDir()
  if (!existsSync(path)) return fallback
  try { return JSON.parse(readFileSync(path, 'utf-8')) } catch { return fallback }
}

/** Debounced async file writer — batches multiple writes into one per file */
const pendingWrites = new Map<string, NodeJS.Timeout>()
const dirtyFiles = new Set<string>()
const WRITE_DEBOUNCE_MS = 500

function saveJSON(path: string, data: unknown): void {
  ensureDir()
  dirtyFiles.add(path)
  // Cancel any pending write for this file
  const existing = pendingWrites.get(path)
  if (existing) clearTimeout(existing)

  // Debounce — only write after 500ms of no new saves to this file
  const timer = setTimeout(() => {
    pendingWrites.delete(path)
    dirtyFiles.delete(path)
    writeFile(path, JSON.stringify(data, null, 2), (err) => {
      if (err) { /* non-critical — learning data can be regenerated */ }
    })
  }, WRITE_DEBOUNCE_MS)

  pendingWrites.set(path, timer)
}

/** Synchronous save for critical data (config, not learning) */
function saveJSONSync(path: string, data: unknown): void {
  ensureDir()
  writeFileSync(path, JSON.stringify(data, null, 2))
}

/** Flush all pending writes immediately (call on exit) — only saves dirty files */
export function flushPendingWrites(): void {
  for (const [path, timer] of pendingWrites.entries()) {
    clearTimeout(timer)
    pendingWrites.delete(path)
  }
  // Only save files that were actually modified (dirty tracking)
  const fileMap: Array<[string, unknown]> = [
    [PATTERNS_FILE, patterns],
    [SOLUTIONS_FILE, solutions],
    [PROFILE_FILE, profile],
    [KNOWLEDGE_FILE, knowledge],
    [CORRECTIONS_FILE, corrections],
    [PROJECTS_FILE, projects],
    [join(LEARN_DIR, 'tech-freq.json'), techStackFrequency],
  ]
  try {
    for (const [path, data] of fileMap) {
      if (dirtyFiles.has(path)) {
        writeFileSync(path, JSON.stringify(data, null, 2))
        dirtyFiles.delete(path)
      }
    }
  } catch { /* best-effort */ }

  // Flush Bayesian skill ratings (separate persistence)
  try {
    const skillRating = getSkillRatingSystem()
    // save() is async but we need sync flush on exit — use the sync fallback
    // The SkillRatingSystem.save() uses writeFileSync internally, so this is safe
    skillRating.save().catch(() => { /* best-effort */ })
  } catch { /* best-effort */ }
}

// ═══ 1. PATTERN CACHE ═══════════════════════════════════════════
// Maps intent signatures → tool sequences that worked.
// If a new message matches a cached pattern, we can hint the AI
// with "Last time this pattern worked: [steps]" — saving reasoning tokens.

export interface CachedPattern {
  /** Normalized intent (lowercase, stop-words removed) */
  intent: string
  /** Keywords extracted from the message */
  keywords: string[]
  /** Tool call sequence that succeeded */
  toolSequence: string[]
  /** How many times this pattern was used */
  hits: number
  /** Success rate (0-1) */
  successRate: number
  /** Last used timestamp */
  lastUsed: string
  /** Average tokens saved vs first attempt */
  avgTokensSaved: number
}

let patterns: CachedPattern[] = loadJSON(PATTERNS_FILE, [])

/** Normalize a message into an intent signature — preserves word order for context */
function normalizeIntent(message: string): string {
  const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
    'may', 'might', 'shall', 'can', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by',
    'from', 'it', 'this', 'that', 'these', 'those', 'i', 'me', 'my', 'we', 'you', 'your',
    'he', 'she', 'they', 'them', 'and', 'or', 'but', 'not', 'so', 'if', 'then', 'please'])
  // Preserve word order (don't sort) — order carries intent context
  return message.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w))
    .join(' ')
}

/** Extract keywords from a message */
export function extractKeywords(message: string): string[] {
  const techTerms = new Set(['react', 'typescript', 'node', 'python', 'rust', 'go', 'docker',
    'api', 'database', 'test', 'deploy', 'build', 'fix', 'bug', 'error', 'component',
    'function', 'class', 'import', 'export', 'async', 'await', 'fetch', 'route', 'auth',
    'css', 'html', 'json', 'sql', 'git', 'npm', 'install', 'config', 'env', 'server',
    'client', 'hook', 'state', 'redux', 'zustand', 'supabase', 'stripe', 'vite', 'webpack'])
  return message.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && techTerms.has(w))
}

/** Find a matching cached pattern (similarity > 0.6) */
export function findPattern(message: string): CachedPattern | null {
  const intent = normalizeIntent(message)
  const keywords = extractKeywords(message)
  if (!intent) return null

  let bestMatch: CachedPattern | null = null
  let bestScore = 0

  for (const p of patterns) {
    // Jaccard similarity on intent words
    const intentWords = new Set(intent.split(' '))
    const patternWords = new Set(p.intent.split(' '))
    const intersection = [...intentWords].filter(w => patternWords.has(w)).length
    const union = new Set([...intentWords, ...patternWords]).size
    const intentSim = union > 0 ? intersection / union : 0

    // Keyword overlap bonus
    const kwOverlap = keywords.filter(k => p.keywords.includes(k)).length
    const kwBonus = keywords.length > 0 ? (kwOverlap / keywords.length) * 0.3 : 0

    // Frequency boost (well-tested patterns are more reliable)
    const freqBoost = Math.min(p.hits / 10, 0.1)

    const score = intentSim + kwBonus + freqBoost

    if (score > bestScore && score > 0.6 && p.successRate > 0.5) {
      bestScore = score
      bestMatch = p
    }
  }

  return bestMatch
}

/** Record a successful pattern */
export function recordPattern(
  message: string,
  toolSequence: string[],
  tokensSaved: number = 0,
): void {
  if (toolSequence.length === 0) return

  const intent = normalizeIntent(message)
  const keywords = extractKeywords(message)
  if (!intent) return

  const existing = patterns.find(p => p.intent === intent)
  if (existing) {
    existing.hits++
    existing.successRate = (existing.successRate * (existing.hits - 1) + 1) / existing.hits
    existing.lastUsed = new Date().toISOString()
    existing.avgTokensSaved = (existing.avgTokensSaved * (existing.hits - 1) + tokensSaved) / existing.hits
    // Update tool sequence if this one is shorter (more efficient)
    if (toolSequence.length < existing.toolSequence.length) {
      existing.toolSequence = toolSequence
    }
  } else {
    patterns.push({
      intent, keywords, toolSequence,
      hits: 1, successRate: 1.0,
      lastUsed: new Date().toISOString(),
      avgTokensSaved: tokensSaved,
    })
  }

  // Keep top 100 patterns by score (hits * successRate)
  patterns.sort((a, b) => (b.hits * b.successRate) - (a.hits * a.successRate))
  patterns = patterns.slice(0, 100)
  saveJSON(PATTERNS_FILE, patterns)
}

/** Record a failed pattern */
export function recordPatternFailure(message: string): void {
  const intent = normalizeIntent(message)
  const existing = patterns.find(p => p.intent === intent)
  if (existing) {
    existing.successRate = (existing.successRate * existing.hits) / (existing.hits + 1)
    existing.hits++
    saveJSON(PATTERNS_FILE, patterns)
  }
}


// ═══ 2. SOLUTION INDEX ═══════════════════════════════════════════
// Stores extracted solutions from past conversations.
// When a similar question comes up, we inject the cached answer
// as context so the AI can reference it instead of re-deriving.

export interface CachedSolution {
  /** Question/problem signature */
  question: string
  /** Keywords for matching */
  keywords: string[]
  /** The solution that worked */
  solution: string
  /** Confidence (0-1) based on outcome */
  confidence: number
  /** Times this solution was reused */
  reuses: number
  /** Created timestamp */
  created: string
}

let solutions: CachedSolution[] = loadJSON(SOLUTIONS_FILE, [])

/** Find relevant cached solutions for a message */
export function findSolutions(message: string, maxResults: number = 3): CachedSolution[] {
  const keywords = extractKeywords(message)
  const messageWords = new Set(
    message.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2)
  )

  const scored = solutions.map(s => {
    const kwOverlap = keywords.filter(k => s.keywords.includes(k)).length
    const kwScore = keywords.length > 0 ? kwOverlap / keywords.length : 0

    // Word overlap with question
    const qWords = new Set(
      s.question.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2)
    )
    const overlap = [...messageWords].filter(w => qWords.has(w)).length
    const wordScore = qWords.size > 0 ? overlap / qWords.size : 0

    const score = kwScore * 0.4 + wordScore * 0.4 + s.confidence * 0.2
    return { solution: s, score }
  })

  const results = scored
    .filter(s => s.score > 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(s => s.solution)

  // Update reuse counts after search is complete (deferred side-effect)
  if (results.length > 0) {
    setImmediate(() => {
      for (const s of results) s.reuses++
      saveJSON(SOLUTIONS_FILE, solutions)
    })
  }

  return results
}

/** Cache a solution from a successful interaction */
export function cacheSolution(question: string, solution: string): void {
  if (solution.length < 20 || solution.length > 5000) return

  const keywords = extractKeywords(question)
  const normalized = normalizeIntent(question)

  // Don't duplicate similar solutions
  const existing = solutions.find(s => normalizeIntent(s.question) === normalized)
  if (existing) {
    existing.confidence = Math.min(1, existing.confidence + 0.1)
    existing.solution = solution // Update with latest
    saveJSON(SOLUTIONS_FILE, solutions)
    return
  }

  solutions.push({
    question: question.slice(0, 200),
    keywords,
    solution: solution.slice(0, 3000),
    confidence: 0.7,
    reuses: 0,
    created: new Date().toISOString(),
  })

  // Keep top 200 solutions
  solutions.sort((a, b) => (b.confidence * (b.reuses + 1)) - (a.confidence * (a.reuses + 1)))
  solutions = solutions.slice(0, 200)
  saveJSON(SOLUTIONS_FILE, solutions)
}


// ═══ 3. USER PROFILE ═══════════════════════════════════════════
// Learns user preferences and style to reduce back-and-forth.

export interface UserProfile {
  /** Preferred response length: 'concise' | 'detailed' | 'auto' */
  responseStyle: 'concise' | 'detailed' | 'auto'
  /** Primary languages/frameworks detected */
  techStack: string[]
  /** Common task types (what user asks for most) */
  taskPatterns: Record<string, number>
  /** Preferred agents */
  preferredAgents: Record<string, number>
  /** Total messages sent */
  totalMessages: number
  /** Total tokens used */
  totalTokens: number
  /** Total tokens saved by learning */
  tokensSaved: number
  /** Average tokens per message (tracks efficiency over time) */
  avgTokensPerMessage: number
  /** Session count */
  sessions: number
}

let profile: UserProfile = loadJSON(PROFILE_FILE, {
  responseStyle: 'auto',
  techStack: [],
  taskPatterns: {},
  preferredAgents: {},
  totalMessages: 0,
  totalTokens: 0,
  tokensSaved: 0,
  avgTokensPerMessage: 0,
  sessions: 0,
})

/** Tech stack usage frequency for decay-based ranking */
let techStackFrequency: Record<string, number> = loadJSON(join(LEARN_DIR, 'tech-freq.json'), {})

export function getProfile(): UserProfile {
  return profile
}

/** Update profile after each interaction */
export function updateProfile(opts: {
  tokens?: number
  tokensSaved?: number
  agent?: string
  taskType?: string
  techTerms?: string[]
  /** Original user message — used for Bayesian skill rating categorization */
  message?: string
  /** Whether the interaction was successful (for skill rating) */
  success?: boolean
}): void {
  if (opts.tokens) {
    profile.totalMessages++
    profile.totalTokens += opts.tokens
    profile.avgTokensPerMessage =
      profile.totalTokens / profile.totalMessages
  }
  if (opts.tokensSaved) {
    profile.tokensSaved += opts.tokensSaved
  }
  if (opts.agent && opts.agent !== 'local') {
    profile.preferredAgents[opts.agent] = (profile.preferredAgents[opts.agent] || 0) + 1

    // Update Bayesian skill ratings — record win for successful interactions
    if (opts.message) {
      const skillRating = getSkillRatingSystem()
      const category = skillRating.categorizeMessage(opts.message)
      const outcome = opts.success === false ? 'loss' : 'win'
      skillRating.recordOutcome(opts.agent, category, outcome)
      skillRating.save().catch(() => { /* non-critical */ })
    }
  }
  if (opts.taskType) {
    profile.taskPatterns[opts.taskType] = (profile.taskPatterns[opts.taskType] || 0) + 1
  }
  if (opts.techTerms && opts.techTerms.length > 0) {
    // Tech stack with frequency tracking for decay
    if (!techStackFrequency) techStackFrequency = {}
    for (const t of opts.techTerms) {
      techStackFrequency[t] = (techStackFrequency[t] || 0) + 1
    }
    // Rebuild techStack from frequency — most used terms first, with decay
    profile.techStack = Object.entries(techStackFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([term]) => term)
  }
  saveJSON(PROFILE_FILE, profile)
}

export function incrementSessions(): number {
  profile.sessions++
  saveJSON(PROFILE_FILE, profile)
  return profile.sessions
}


// ═══ 4. LEARNING CONTEXT BUILDER ════════════════════════════════
// Builds the most efficient context for each message by combining
// cached patterns, relevant solutions, and user profile.
// This replaces dumping the entire memory file into every prompt.

export function buildLearningContext(message: string): string {
  const parts: string[] = []

  // A. Pattern hint — if we've solved this type of problem before
  const pattern = findPattern(message)
  if (pattern) {
    parts.push(
      `[Learned Pattern — ${pattern.hits}x success, ${Math.round(pattern.successRate * 100)}% rate]`,
      `Similar tasks were solved with: ${pattern.toolSequence.join(' → ')}`,
      `Hint: follow this tool sequence to solve efficiently in fewer steps.`
    )
  }

  // B. Relevant solutions — inject only matching ones, not entire history
  const relevant = findSolutions(message, 2)
  if (relevant.length > 0) {
    parts.push('[Cached Solutions]')
    for (const s of relevant) {
      parts.push(`Q: ${s.question}\nA: ${s.solution}\n`)
    }
  }

  // C. User profile hints — help the AI match user expectations
  if (profile.totalMessages > 5) {
    const hints: string[] = []
    if (profile.techStack.length > 0) {
      hints.push(`User's stack: ${profile.techStack.join(', ')}`)
    }
    if (profile.responseStyle !== 'auto') {
      hints.push(`Preferred style: ${profile.responseStyle}`)
    }
    // Most common task type
    const topTask = Object.entries(profile.taskPatterns)
      .sort((a, b) => b[1] - a[1])[0]
    if (topTask && topTask[1] > 3) {
      hints.push(`Most common task: ${topTask[0]}`)
    }
    if (hints.length > 0) {
      parts.push(`[User Profile]\n${hints.join('\n')}`)
    }
  }

  return parts.length > 0 ? parts.join('\n\n') : ''
}


// ═══ 5. STATS TRACKING ══════════════════════════════════════════

export interface LearningStats {
  patternsCount: number
  solutionsCount: number
  totalTokensSaved: number
  avgTokensPerMsg: number
  totalMessages: number
  sessions: number
  efficiency: string // "X% more efficient than baseline"
}

export function getStats(): LearningStats {
  // Baseline: assume 2000 tokens per message without learning
  const baseline = 2000
  const actual = profile.avgTokensPerMessage || baseline
  const efficiencyPct = actual < baseline
    ? Math.round((1 - actual / baseline) * 100)
    : 0

  return {
    patternsCount: patterns.length,
    solutionsCount: solutions.length,
    totalTokensSaved: profile.tokensSaved,
    avgTokensPerMsg: Math.round(profile.avgTokensPerMessage),
    totalMessages: profile.totalMessages,
    sessions: profile.sessions,
    efficiency: efficiencyPct > 0 ? `${efficiencyPct}% more efficient` : 'Baseline (learning...)',
  }
}

/** Classify task type from message */
export function classifyTask(message: string): string {
  const lower = message.toLowerCase()
  if (/\b(fix|bug|error|issue|broken|crash|fail)\b/.test(lower)) return 'debug'
  if (/\b(build|create|scaffold|generate|new|init|setup)\b/.test(lower)) return 'build'
  if (/\b(refactor|clean|reorganize|restructure|simplify)\b/.test(lower)) return 'refactor'
  if (/\b(test|spec|coverage|assert)\b/.test(lower)) return 'test'
  if (/\b(deploy|ship|release|publish)\b/.test(lower)) return 'deploy'
  if (/\b(explain|what|how|why|describe)\b/.test(lower)) return 'explain'
  if (/\b(review|audit|check|inspect)\b/.test(lower)) return 'review'
  if (/\b(search|find|grep|locate|where)\b/.test(lower)) return 'search'
  return 'general'
}


// ═══ 6. KNOWLEDGE BASE — User-taught facts ══════════════════════
// Users can teach kbot things: "remember that my API uses port 3001"
// kbot extracts and stores knowledge from conversations.

export interface KnowledgeEntry {
  /** The fact or piece of knowledge */
  fact: string
  /** Category: preference, fact, rule, context, project */
  category: 'preference' | 'fact' | 'rule' | 'context' | 'project'
  /** Keywords for retrieval */
  keywords: string[]
  /** Source: 'user-taught' | 'extracted' | 'observed' */
  source: 'user-taught' | 'extracted' | 'observed'
  /** Confidence 0-1 */
  confidence: number
  /** Times referenced */
  references: number
  /** Created */
  created: string
  /** Last referenced */
  lastUsed: string
}

let knowledge: KnowledgeEntry[] = loadJSON(KNOWLEDGE_FILE, [])

/** Store a knowledge entry (user teaches kbot something) */
export function learnFact(fact: string, category: KnowledgeEntry['category'] = 'fact', source: KnowledgeEntry['source'] = 'user-taught'): void {
  if (!fact || fact.length < 5) return

  const keywords = fact.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2)

  // Check for duplicate or similar (use spread to avoid mutating stored arrays)
  const normalized = [...keywords].sort().join(' ')
  const existing = knowledge.find(k => {
    const kNorm = [...k.keywords].sort().join(' ')
    return kNorm === normalized
  })

  if (existing) {
    existing.fact = fact // Update with latest wording
    existing.confidence = Math.min(1, existing.confidence + 0.1)
    existing.lastUsed = new Date().toISOString()
    saveJSON(KNOWLEDGE_FILE, knowledge)
    return
  }

  knowledge.push({
    fact,
    category,
    keywords,
    source,
    confidence: source === 'user-taught' ? 1.0 : 0.7,
    references: 0,
    created: new Date().toISOString(),
    lastUsed: new Date().toISOString(),
  })

  // Keep top 500 knowledge entries
  knowledge.sort((a, b) => (b.confidence * (b.references + 1)) - (a.confidence * (a.references + 1)))
  knowledge = knowledge.slice(0, 500)
  saveJSON(KNOWLEDGE_FILE, knowledge)
}

/** Find relevant knowledge for a message */
export function findKnowledge(message: string, maxResults: number = 5): KnowledgeEntry[] {
  const msgWords = new Set(
    message.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2)
  )

  const scored = knowledge.map(k => {
    const overlap = k.keywords.filter(kw => msgWords.has(kw)).length
    const score = k.keywords.length > 0
      ? (overlap / k.keywords.length) * 0.6 + k.confidence * 0.3 + Math.min(k.references / 10, 0.1)
      : 0
    return { entry: k, score }
  })

  const results = scored
    .filter(s => s.score > 0.2)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(s => s.entry)

  // Update reference counts after search is complete (deferred side-effect)
  if (results.length > 0) {
    setImmediate(() => {
      const now = new Date().toISOString()
      for (const entry of results) {
        entry.references++
        entry.lastUsed = now
      }
      saveJSON(KNOWLEDGE_FILE, knowledge)
    })
  }

  return results
}

/** Extract knowledge from a conversation exchange — stricter matching to reduce false positives */
export function extractKnowledge(userMessage: string, assistantResponse: string): void {
  const lower = userMessage.toLowerCase().trim()

  // Skip short messages and questions — they rarely contain teachable facts
  if (lower.length < 15 || lower.endsWith('?')) return

  // Only extract from messages that are clearly declarative/directive
  // Require explicit teaching verbs at the START of the message or clause
  const teachPatterns = [
    /^(?:remember|note that|keep in mind)\s+(.{10,200})/i,
    /^(?:always|never)\s+(.{10,200})/i,
    /^(?:i (?:always |)(?:prefer|like|want|use|need))\s+(.{10,200})/i,
    /^(?:my\s+\w+\s+(?:is|are|uses?|runs?|has))\s+(.{5,200})/i,
    /^(?:we use|our\s+\w+\s+(?:is|are|uses?))\s+(.{5,200})/i,
    // Also match after explicit "btw" / "fyi" / "also"
    /(?:btw|fyi|also)[,:]?\s+(?:my|our|we|i)\s+(.{10,200})/i,
  ]

  for (const pattern of teachPatterns) {
    const match = lower.match(pattern)
    if (match) {
      const fact = match[0].charAt(0).toUpperCase() + match[0].slice(1)
      const category = /(?:always|never|prefer|like|want)/.test(lower) ? 'preference' :
        /(?:my|our|we)/.test(lower) ? 'context' : 'fact'
      learnFact(fact, category, 'extracted')
      return // Only extract one fact per message to avoid noise
    }
  }

  // Detect corrections — require explicit correction language
  const correctionPrefixes = /^(?:no[,.]?\s+(?:it|that|you)|that'?s\s+(?:wrong|incorrect|not right)|actually[,]?\s+(?:it|you|that))/i
  if (correctionPrefixes.test(lower)) {
    const correctionMatch = lower.match(/(?:no[,.]?\s+|actually[,]?\s+|instead[,]?\s+|should\s+(?:be|use)\s+)(.{10,200})/i)
    if (correctionMatch) {
      recordCorrection(userMessage, assistantResponse)
      learnFact(correctionMatch[1], 'rule', 'extracted')
    }
  }

  // Detect project-specific knowledge — only from explicit project declarations
  const projectPattern = /^(?:this (?:project|repo|app)|the codebase|our stack)\s+(?:is|uses?|has|runs?)\s+(.{5,200})/i
  const projectMatch = lower.match(projectPattern)
  if (projectMatch) {
    learnFact(projectMatch[0], 'project', 'extracted')
  }
}


// ═══ 7. CORRECTIONS TRACKER — Learn from mistakes ═══════════════
// When users correct kbot, track the mistake and correct behavior.

export interface Correction {
  /** What the user said (the correction) */
  userMessage: string
  /** What the assistant said wrong */
  wrongResponse: string
  /** Extracted rule from the correction */
  rule: string
  /** Times this correction pattern has occurred */
  occurrences: number
  /** Created */
  created: string
}

let corrections: Correction[] = loadJSON(CORRECTIONS_FILE, [])

/** Record a user correction */
export function recordCorrection(userMessage: string, wrongResponse: string): void {
  const rule = userMessage.slice(0, 300)

  // Deduplicate
  const existing = corrections.find(c =>
    normalizeIntent(c.userMessage) === normalizeIntent(userMessage)
  )
  if (existing) {
    existing.occurrences++
    saveJSON(CORRECTIONS_FILE, corrections)
    return
  }

  corrections.push({
    userMessage: userMessage.slice(0, 300),
    wrongResponse: wrongResponse.slice(0, 300),
    rule,
    occurrences: 1,
    created: new Date().toISOString(),
  })

  // Keep top 50 corrections
  corrections.sort((a, b) => b.occurrences - a.occurrences)
  corrections = corrections.slice(0, 50)
  saveJSON(CORRECTIONS_FILE, corrections)
}

/** Get relevant corrections to avoid repeating mistakes */
export function getRelevantCorrections(message: string, max: number = 3): Correction[] {
  const msgWords = new Set(
    message.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2)
  )

  return corrections
    .map(c => {
      const cWords = new Set(
        c.userMessage.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2)
      )
      const overlap = [...msgWords].filter(w => cWords.has(w)).length
      const score = cWords.size > 0 ? overlap / cWords.size : 0
      return { correction: c, score }
    })
    .filter(s => s.score > 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map(s => s.correction)
}


// ═══ 8. PROJECT MEMORY — Remember project-specific details ══════
// Tracks per-directory project knowledge.

export interface ProjectMemory {
  /** Directory path */
  path: string
  /** Project name (from package.json, Cargo.toml, etc.) */
  name: string
  /** Detected stack */
  stack: string[]
  /** Key files the user works with most */
  frequentFiles: Record<string, number>
  /** Project-specific knowledge entries */
  notes: string[]
  /** Last accessed */
  lastAccessed: string
}

let projects: ProjectMemory[] = loadJSON(PROJECTS_FILE, [])

/** Get or create project memory for current directory */
export function getProjectMemory(cwd: string): ProjectMemory | null {
  const project = projects.find(p => cwd.startsWith(p.path))
  if (project) {
    project.lastAccessed = new Date().toISOString()
    saveJSON(PROJECTS_FILE, projects)
  }
  return project || null
}

/** Record project information */
export function updateProjectMemory(cwd: string, data: {
  name?: string
  stack?: string[]
  file?: string
  note?: string
}): void {
  let project = projects.find(p => p.path === cwd)
  if (!project) {
    project = {
      path: cwd,
      name: data.name || cwd.split('/').pop() || 'unknown',
      stack: [],
      frequentFiles: {},
      notes: [],
      lastAccessed: new Date().toISOString(),
    }
    projects.push(project)
  }

  if (data.name) project.name = data.name
  if (data.stack) {
    const existing = new Set(project.stack)
    for (const s of data.stack) {
      if (!existing.has(s)) {
        project.stack.push(s)
        existing.add(s)
      }
    }
    project.stack = project.stack.slice(0, 20)
  }
  if (data.file) {
    project.frequentFiles[data.file] = (project.frequentFiles[data.file] || 0) + 1
    // Keep top 30 files
    const sorted = Object.entries(project.frequentFiles).sort((a, b) => b[1] - a[1]).slice(0, 30)
    project.frequentFiles = Object.fromEntries(sorted)
  }
  if (data.note && !project.notes.includes(data.note)) {
    project.notes.push(data.note)
    project.notes = project.notes.slice(-50)
  }

  project.lastAccessed = new Date().toISOString()

  // Keep top 20 projects
  projects.sort((a, b) => new Date(b.lastAccessed).getTime() - new Date(a.lastAccessed).getTime())
  projects = projects.slice(0, 20)
  saveJSON(PROJECTS_FILE, projects)
}


// ═══ ENHANCED CONTEXT BUILDER — Uses all learning systems ═══════

/** Override the original buildLearningContext with enhanced version */

// Enhance the existing buildLearningContext
export function buildFullLearningContext(message: string, cwd?: string): string {
  const parts: string[] = []

  // A. Pattern hint
  const pattern = findPattern(message)
  if (pattern) {
    parts.push(
      `[Learned Pattern — ${pattern.hits}x success]`,
      `Tool sequence: ${pattern.toolSequence.join(' → ')}`
    )
  }

  // B. Relevant solutions
  const relevant = findSolutions(message, 2)
  if (relevant.length > 0) {
    parts.push('[Cached Solutions]')
    for (const s of relevant) {
      parts.push(`Q: ${s.question}\nA: ${s.solution}`)
    }
  }

  // C. Relevant knowledge — things the user has taught
  const knowledgeEntries = findKnowledge(message, 4)
  if (knowledgeEntries.length > 0) {
    parts.push('[User Knowledge]')
    for (const k of knowledgeEntries) {
      const tag = k.source === 'user-taught' ? '(user said)' : '(learned)'
      parts.push(`• ${k.fact} ${tag}`)
    }
  }

  // D. Corrections — avoid repeating past mistakes
  const relevantCorrections = getRelevantCorrections(message, 2)
  if (relevantCorrections.length > 0) {
    parts.push('[Past Corrections — avoid these mistakes]')
    for (const c of relevantCorrections) {
      parts.push(`• User corrected: "${c.rule}"`)
    }
  }

  // E. User profile
  if (profile.totalMessages > 3) {
    const hints: string[] = []
    if (profile.techStack.length > 0) {
      hints.push(`Stack: ${profile.techStack.join(', ')}`)
    }
    if (profile.responseStyle !== 'auto') {
      hints.push(`Style: ${profile.responseStyle}`)
    }
    const topTask = Object.entries(profile.taskPatterns).sort((a, b) => b[1] - a[1])[0]
    if (topTask && topTask[1] > 2) {
      hints.push(`Common task: ${topTask[0]}`)
    }
    if (hints.length > 0) {
      parts.push(`[User Profile] ${hints.join(' · ')}`)
    }
  }

  // F. Project memory — if working in a known project
  if (cwd) {
    const project = getProjectMemory(cwd)
    if (project) {
      const projectHints: string[] = [`Project: ${project.name}`]
      if (project.stack.length > 0) projectHints.push(`Stack: ${project.stack.join(', ')}`)
      if (project.notes.length > 0) {
        projectHints.push('Notes:')
        for (const note of project.notes.slice(-5)) {
          projectHints.push(`  • ${note}`)
        }
      }
      const topFiles = Object.entries(project.frequentFiles)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([f]) => f)
      if (topFiles.length > 0) {
        projectHints.push(`Frequent files: ${topFiles.join(', ')}`)
      }
      parts.push(`[Project Context]\n${projectHints.join('\n')}`)
    }
  }

  return parts.length > 0 ? parts.join('\n\n') : ''
}


// ═══ 9. CONVERSATION LEARNING — Post-interaction extraction ═════
// Called after each exchange to extract and store learnings.

export function learnFromExchange(
  userMessage: string,
  assistantResponse: string,
  toolsUsed: string[],
  cwd?: string,
): void {
  // Extract knowledge from what the user said
  extractKnowledge(userMessage, assistantResponse)

  // Track file usage in project memory
  if (cwd && toolsUsed.length > 0) {
    const fileTools = ['read_file', 'write_file', 'edit_file', 'multi_file_write']
    // Try to extract file paths from tool names (simplified)
    for (const tool of toolsUsed) {
      if (fileTools.includes(tool)) {
        // The actual file paths would need to come from tool args — for now just track the tools
        updateProjectMemory(cwd, { stack: extractKeywords(userMessage) })
      }
    }
  }

  // Detect style preference from response feedback
  const lower = userMessage.toLowerCase()
  if (/(?:too (?:long|verbose|detailed)|shorter|tldr|brief)/i.test(lower)) {
    profile.responseStyle = 'concise'
    saveJSON(PROFILE_FILE, profile)
  }
  if (/(?:more detail|elaborate|explain more|too short|too brief)/i.test(lower)) {
    profile.responseStyle = 'detailed'
    saveJSON(PROFILE_FILE, profile)
  }

  // Save periodic stats
  saveJSON(KNOWLEDGE_FILE, knowledge)
}


// ═══ 10. LEARNING STATS — Extended ══════════════════════════════

// ═══ 11. SELF-TRAINING — Periodic knowledge review & synthesis ════
// kbot reviews its own knowledge base, prunes stale entries,
// synthesizes cross-pattern insights, and optimizes the learning engine.

const TRAINING_FILE = join(LEARN_DIR, 'training-log.json')

interface TrainingLog {
  lastRun: string
  runsTotal: number
  entriesPruned: number
  insightsSynthesized: number
  patternsOptimized: number
}

let trainingLog: TrainingLog = loadJSON(TRAINING_FILE, {
  lastRun: '',
  runsTotal: 0,
  entriesPruned: 0,
  insightsSynthesized: 0,
  patternsOptimized: 0,
})

/** Guard to prevent overlapping selfTrain runs in serve mode */
let selfTrainRunning = false

/** Run self-training: prune stale knowledge, optimize patterns, synthesize insights */
export function selfTrain(): {
  pruned: number
  optimized: number
  synthesized: number
  summary: string
} {
  if (selfTrainRunning) {
    return { pruned: 0, optimized: 0, synthesized: 0, summary: 'Self-training already in progress — skipped.' }
  }
  selfTrainRunning = true
  try {
    return selfTrainInner()
  } finally {
    selfTrainRunning = false
  }
}

function selfTrainInner(): {
  pruned: number
  optimized: number
  synthesized: number
  summary: string
} {
  let pruned = 0
  let optimized = 0
  let synthesized = 0
  const summaryParts: string[] = []

  // ── A. Prune stale patterns ──
  // Remove patterns with low success rate or no recent hits
  const now = Date.now()
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000
  const beforePatterns = patterns.length
  patterns = patterns.filter(p => {
    const lastUsed = new Date(p.lastUsed).getTime()
    // Keep if: recent, high success rate, or frequently used
    if (lastUsed > thirtyDaysAgo) return true
    if (p.successRate > 0.8 && p.hits > 5) return true
    if (p.hits > 10) return true
    pruned++
    return false
  })
  if (pruned > 0) {
    saveJSON(PATTERNS_FILE, patterns)
    summaryParts.push(`Pruned ${pruned} stale patterns (${beforePatterns} → ${patterns.length})`)
  }

  // ── B. Prune low-confidence knowledge ──
  const beforeKnowledge = knowledge.length
  knowledge = knowledge.filter(k => {
    // Keep all user-taught facts
    if (k.source === 'user-taught') return true
    // Keep high-confidence or frequently referenced
    if (k.confidence > 0.5 && k.references > 0) return true
    // Keep recent entries (< 7 days)
    const created = new Date(k.created).getTime()
    if (created > now - 7 * 24 * 60 * 60 * 1000) return true
    pruned++
    return false
  })
  if (knowledge.length < beforeKnowledge) {
    saveJSON(KNOWLEDGE_FILE, knowledge)
    summaryParts.push(`Pruned ${beforeKnowledge - knowledge.length} low-confidence knowledge entries`)
  }

  // ── C. Optimize patterns — merge similar ones ──
  const mergedPatterns = new Map<string, CachedPattern>()
  for (const p of patterns) {
    const key = p.toolSequence.join(',')
    const existing = mergedPatterns.get(key)
    if (existing && p.intent !== existing.intent) {
      // Same tool sequence, different intent — merge keywords
      existing.keywords = [...new Set([...existing.keywords, ...p.keywords])]
      existing.hits += p.hits
      existing.successRate = (existing.successRate + p.successRate) / 2
      optimized++
    } else {
      mergedPatterns.set(key, { ...p })
    }
  }
  if (optimized > 0) {
    patterns = Array.from(mergedPatterns.values())
    saveJSON(PATTERNS_FILE, patterns)
    summaryParts.push(`Merged ${optimized} redundant patterns`)
  }

  // ── D. Synthesize cross-pattern insights ──
  // Find common tool sequences across patterns to identify power workflows
  const toolFrequency: Record<string, number> = {}
  for (const p of patterns) {
    for (const tool of p.toolSequence) {
      toolFrequency[tool] = (toolFrequency[tool] || 0) + p.hits
    }
  }
  const topTools = Object.entries(toolFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
  if (topTools.length > 0) {
    const insight = `Most effective tools: ${topTools.map(([t, n]) => `${t}(${n}x)`).join(', ')}`
    const existingInsight = knowledge.find(k => k.fact.startsWith('Most effective tools:'))
    if (existingInsight) {
      existingInsight.fact = insight
      existingInsight.lastUsed = new Date().toISOString()
    } else {
      learnFact(insight, 'context', 'observed')
      synthesized++
    }
  }

  // Synthesize user task preference insights
  const topTasks = Object.entries(profile.taskPatterns)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
  if (topTasks.length > 0 && profile.totalMessages > 10) {
    const insight = `User primarily does: ${topTasks.map(([t, n]) => `${t}(${n}x)`).join(', ')}`
    const existing = knowledge.find(k => k.fact.startsWith('User primarily does:'))
    if (existing) {
      existing.fact = insight
      existing.lastUsed = new Date().toISOString()
    } else {
      learnFact(insight, 'context', 'observed')
      synthesized++
    }
  }

  // Synthesize solution success patterns
  const highConfSolutions = solutions.filter(s => s.confidence > 0.9 && s.reuses > 2)
  if (highConfSolutions.length > 0) {
    summaryParts.push(`${highConfSolutions.length} battle-tested solutions (>90% confidence, 2+ reuses)`)
  }

  if (synthesized > 0) {
    saveJSON(KNOWLEDGE_FILE, knowledge)
    summaryParts.push(`Synthesized ${synthesized} new insights`)
  }

  // ── E. Update training log ──
  trainingLog.lastRun = new Date().toISOString()
  trainingLog.runsTotal++
  trainingLog.entriesPruned += pruned
  trainingLog.insightsSynthesized += synthesized
  trainingLog.patternsOptimized += optimized
  saveJSON(TRAINING_FILE, trainingLog)

  const summary = summaryParts.length > 0
    ? summaryParts.join('\n')
    : 'Knowledge base is clean. No changes needed.'

  return { pruned, optimized, synthesized, summary }
}

/** Check if self-training should run (auto-trigger every 50 messages) */
export function shouldAutoTrain(): boolean {
  if (!trainingLog.lastRun) return profile.totalMessages >= 20
  const lastRun = new Date(trainingLog.lastRun).getTime()
  const hoursSinceLastRun = (Date.now() - lastRun) / (1000 * 60 * 60)
  // Auto-train if: > 24 hours since last run AND > 20 messages since
  return hoursSinceLastRun > 24 && profile.totalMessages % 50 === 0
}

/** Get training log for display */
export function getTrainingLog(): TrainingLog {
  return trainingLog
}


export function getExtendedStats(): LearningStats & {
  knowledgeCount: number
  correctionsCount: number
  projectsCount: number
  topKnowledge: string[]
} {
  const base = getStats()
  return {
    ...base,
    knowledgeCount: knowledge.length,
    correctionsCount: corrections.length,
    projectsCount: projects.length,
    topKnowledge: knowledge
      .sort((a, b) => b.references - a.references)
      .slice(0, 5)
      .map(k => k.fact.slice(0, 80)),
  }
}
