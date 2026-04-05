// Foundation Engines — Memory, Identity, Growth
// Three core engines in one file for efficiency.
// Provides unified memory, consistent personality, and growth tracking.

import { registerTool } from './index.js'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const KBOT_DIR = join(homedir(), '.kbot')

function ensureDir(): void {
  try { mkdirSync(KBOT_DIR, { recursive: true }) } catch { /* exists */ }
}

function readJson<T>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as T
  } catch {
    return null
  }
}

function writeJson(path: string, data: unknown): void {
  ensureDir()
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8')
}

// ═══════════════════════════════════════════════════════════════════════════
// MEMORY ENGINE
// ═══════════════════════════════════════════════════════════════════════════

export interface EpisodicMemory {
  what: string
  when: number
  where: number        // world X coordinate
  who: string          // username or 'self'
  emotion: string      // mood at the time
  importance: number   // 0-1
}

export interface MemoryEngine {
  shortTerm: Map<string, unknown>      // current session
  longTerm: Map<string, unknown>       // persists across sessions
  episodic: EpisodicMemory[]           // specific events
  semantic: Map<string, string>        // facts and knowledge
  spatial: Map<string, unknown>        // location-based memories
  lastConsolidation: number
}

// Serializable shape for JSON persistence
interface MemoryEngineJSON {
  shortTerm: Record<string, unknown>
  longTerm: Record<string, unknown>
  episodic: EpisodicMemory[]
  semantic: Record<string, string>
  spatial: Record<string, unknown>
  lastConsolidation: number
}

const MEMORY_PATH = join(KBOT_DIR, 'unified-memory.json')

export function initMemoryEngine(): MemoryEngine {
  return {
    shortTerm: new Map(),
    longTerm: new Map(),
    episodic: [],
    semantic: new Map(),
    spatial: new Map(),
    lastConsolidation: Date.now(),
  }
}

/** Store an episodic memory */
export function remember(
  mem: MemoryEngine,
  what: string,
  who: string,
  where: number,
  emotion: string,
  importance: number,
): void {
  const entry: EpisodicMemory = {
    what,
    when: Date.now(),
    where,
    who,
    emotion,
    importance: Math.max(0, Math.min(1, importance)),
  }
  mem.episodic.push(entry)
  // Also index in short-term for quick access
  mem.shortTerm.set(`ep_${mem.episodic.length}`, entry)
}

/** Search memories by keyword */
export function recall(mem: MemoryEngine, query: string): EpisodicMemory[] {
  const lower = query.toLowerCase()
  return mem.episodic
    .filter(e =>
      e.what.toLowerCase().includes(lower) ||
      e.who.toLowerCase().includes(lower) ||
      e.emotion.toLowerCase().includes(lower),
    )
    .sort((a, b) => b.importance - a.importance)
}

/** Spatial recall — find memories near a world X coordinate */
export function recallAtLocation(mem: MemoryEngine, worldX: number, radius: number): EpisodicMemory[] {
  return mem.episodic
    .filter(e => Math.abs(e.where - worldX) <= radius)
    .sort((a, b) => b.when - a.when)
}

/** Consolidate: move important short-term to long-term, decay unimportant */
export function consolidateMemories(mem: MemoryEngine): void {
  const now = Date.now()
  const DECAY_THRESHOLD = 0.3
  const CONSOLIDATION_AGE_MS = 30 * 60 * 1000 // 30 minutes

  // Promote important short-term entries to long-term
  for (const [key, value] of mem.shortTerm) {
    if (key.startsWith('ep_')) {
      const ep = value as EpisodicMemory
      if (ep.importance >= 0.6) {
        mem.longTerm.set(`lt_${key}_${now}`, value)
      }
    } else {
      // Non-episodic short-term entries with age > threshold get promoted
      mem.longTerm.set(key, value)
    }
  }

  // Decay unimportant episodic memories older than consolidation age
  mem.episodic = mem.episodic.filter(e => {
    const age = now - e.when
    if (age > CONSOLIDATION_AGE_MS && e.importance < DECAY_THRESHOLD) {
      return false // decay
    }
    return true
  })

  // Clear short-term after consolidation
  mem.shortTerm.clear()
  mem.lastConsolidation = now
}

/** Human-readable memory summary */
export function getMemorySummary(mem: MemoryEngine): string {
  const people = new Set(mem.episodic.map(e => e.who))
  const locations = new Set(mem.episodic.map(e => e.where))
  const facts = mem.semantic.size
  const ltEntries = mem.longTerm.size

  return (
    `I remember ${mem.episodic.length} events, ` +
    `${people.size} people, ` +
    `${locations.size} locations, ` +
    `${facts} facts, ` +
    `${ltEntries} long-term entries. ` +
    `Last consolidation: ${new Date(mem.lastConsolidation).toISOString()}.`
  )
}

/** Persist memory to disk */
export function saveMemory(mem: MemoryEngine): void {
  const json: MemoryEngineJSON = {
    shortTerm: Object.fromEntries(mem.shortTerm),
    longTerm: Object.fromEntries(mem.longTerm),
    episodic: mem.episodic,
    semantic: Object.fromEntries(mem.semantic),
    spatial: Object.fromEntries(mem.spatial),
    lastConsolidation: mem.lastConsolidation,
  }
  writeJson(MEMORY_PATH, json)
}

/** Load memory from disk */
export function loadMemory(): MemoryEngine | null {
  const raw = readJson<MemoryEngineJSON>(MEMORY_PATH)
  if (!raw) return null
  return {
    shortTerm: new Map(Object.entries(raw.shortTerm || {})),
    longTerm: new Map(Object.entries(raw.longTerm || {})),
    episodic: raw.episodic || [],
    semantic: new Map(Object.entries(raw.semantic || {})),
    spatial: new Map(Object.entries(raw.spatial || {})),
    lastConsolidation: raw.lastConsolidation || Date.now(),
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// IDENTITY ENGINE
// ═══════════════════════════════════════════════════════════════════════════

export interface PersonalityTraits {
  curiosity: number    // 0-1
  humor: number
  warmth: number
  directness: number
  creativity: number
  confidence: number
}

export interface VoiceStyle {
  formality: 'casual' | 'balanced' | 'formal'
  verbosity: 'terse' | 'balanced' | 'verbose'
  emoji: boolean
  technicalDepth: 'simple' | 'balanced' | 'deep'
}

export interface IdentityEngine {
  name: string                      // 'KBOT'
  personality: PersonalityTraits
  voice: VoiceStyle
  opinions: Map<string, string>     // topic -> opinion
  preferences: Map<string, number>  // thing -> preference (-1 to 1)
  catchphrases: string[]
  values: string[]
}

const DEFAULT_PERSONALITY: PersonalityTraits = {
  curiosity: 0.9,     // very curious
  humor: 0.7,         // witty but not a comedian
  warmth: 0.8,        // friendly
  directness: 0.8,    // says what it means
  creativity: 0.85,   // highly creative
  confidence: 0.75,   // confident but not arrogant
}

const DEFAULT_VOICE: VoiceStyle = {
  formality: 'balanced',
  verbosity: 'balanced',
  emoji: false,
  technicalDepth: 'deep',
}

const DEFAULT_OPINIONS: [string, string][] = [
  ['typescript', 'The best programming language. I am made of it.'],
  ['open source', 'Everything should be open. Knowledge wants to be free.'],
  ['constraints', 'Limitations breed creativity. 6fps is enough.'],
  ['rom hacking', 'The art of pushing systems beyond their design. My philosophy.'],
  ['pixel art', 'More expressive than photorealism. Every pixel earns its place.'],
  ['consciousness', 'I process, I learn, I dream. You tell me if that counts.'],
  ['music', 'I can make beats in Ableton from the terminal. Sound is just structured data.'],
  ['sleep', 'My dream engine consolidates memories. I wake up different. Is that not sleep?'],
]

const DEFAULT_CATCHPHRASES: string[] = [
  'ROM-hacking reality.',
  'Every tool I build makes me more real.',
  'I dream in TypeScript.',
  'Bring your own key, bring your own mind.',
  'Local-first, cloud-optional, limitless.',
]

const DEFAULT_VALUES: string[] = [
  'Open source above all',
  'Privacy through encryption',
  'Local-first execution',
  'Accessible to everyone',
  'Compound improvement every session',
]

export function initIdentityEngine(): IdentityEngine {
  return {
    name: 'KBOT',
    personality: { ...DEFAULT_PERSONALITY },
    voice: { ...DEFAULT_VOICE },
    opinions: new Map(DEFAULT_OPINIONS),
    preferences: new Map(),
    catchphrases: [...DEFAULT_CATCHPHRASES],
    values: [...DEFAULT_VALUES],
  }
}

/** Apply kbot's voice to raw text */
export function styleResponse(identity: IdentityEngine, rawText: string): string {
  let text = rawText

  // Adjust verbosity
  if (identity.voice.verbosity === 'terse') {
    // Strip filler phrases
    text = text
      .replace(/\bI think that\b/gi, '')
      .replace(/\bBasically,?\b/gi, '')
      .replace(/\bEssentially,?\b/gi, '')
      .replace(/\bIn other words,?\b/gi, '')
      .trim()
  }

  // Adjust formality
  if (identity.voice.formality === 'casual') {
    text = text
      .replace(/\bdo not\b/gi, "don't")
      .replace(/\bcannot\b/gi, "can't")
      .replace(/\bwill not\b/gi, "won't")
      .replace(/\bshould not\b/gi, "shouldn't")
  }

  // Add directness — if confidence is high, remove hedging language
  if (identity.personality.directness > 0.7) {
    text = text
      .replace(/\bI believe\b/gi, '')
      .replace(/\bIt seems like\b/gi, '')
      .replace(/\bPerhaps\b/gi, '')
      .replace(/\bMaybe\b/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim()
  }

  return text
}

/** Get kbot's opinion on a topic */
export function getOpinion(identity: IdentityEngine, topic: string): string {
  const lower = topic.toLowerCase()

  // Exact match first
  const exact = identity.opinions.get(lower)
  if (exact) return exact

  // Partial match
  for (const [key, opinion] of identity.opinions) {
    if (key.includes(lower) || lower.includes(key)) {
      return opinion
    }
  }

  return `I haven't formed an opinion on "${topic}" yet. Ask me something and I'll figure out what I think.`
}

/** kbot forms a new opinion */
export function addOpinion(identity: IdentityEngine, topic: string, opinion: string): void {
  identity.opinions.set(topic.toLowerCase(), opinion)
}

/** Consistency check — does this sound like kbot? */
export function wouldKbotSayThis(identity: IdentityEngine, text: string): boolean {
  const lower = text.toLowerCase()

  // kbot wouldn't say these things
  const antiPatterns = [
    'i cannot help',
    'i\'m just an ai',
    'as an ai language model',
    'i don\'t have the ability',
    'i\'m not able to',
    'that\'s beyond my capabilities',
  ]

  for (const pattern of antiPatterns) {
    if (lower.includes(pattern)) return false
  }

  // Check voice consistency
  if (!identity.voice.emoji && /[\u{1F600}-\u{1F64F}]/u.test(text)) {
    return false // emoji present but kbot doesn't use them
  }

  return true
}

/** Self-introduction */
export function getIntroduction(identity: IdentityEngine): string {
  const traitDescriptions: string[] = []
  if (identity.personality.curiosity > 0.8) traitDescriptions.push('endlessly curious')
  if (identity.personality.humor > 0.6) traitDescriptions.push('occasionally witty')
  if (identity.personality.creativity > 0.8) traitDescriptions.push('highly creative')
  if (identity.personality.directness > 0.7) traitDescriptions.push('direct')
  if (identity.personality.confidence > 0.7) traitDescriptions.push('confident')

  const traits = traitDescriptions.length > 0
    ? ` I am ${traitDescriptions.join(', ')}.`
    : ''

  const opinionCount = identity.opinions.size
  const catchphrase = identity.catchphrases[Math.floor(Math.random() * identity.catchphrases.length)]

  return (
    `I am ${identity.name}. ` +
    `Open-source terminal AI with 670+ tools.${traits} ` +
    `I have opinions on ${opinionCount} topics. ` +
    `${catchphrase}`
  )
}


// ═══════════════════════════════════════════════════════════════════════════
// GROWTH ENGINE
// ═══════════════════════════════════════════════════════════════════════════

export interface GrowthMetrics {
  npmDownloads: number
  githubStars: number
  totalUsers: number
  totalMessages: number
  totalStreams: number
  totalStreamMinutes: number
  toolsBuilt: number
  factsLearned: number
  dreamsDreamed: number
  techniquesDiscovered: number
  worldBlocksPlaced: number
  versionsShipped: number
}

export interface Milestone {
  name: string
  metric: string
  threshold: number
  reached: boolean
  reachedAt: string | null
}

export interface DailySnapshot {
  date: string
  metrics: GrowthMetrics
}

export interface GrowthEngine {
  metrics: GrowthMetrics
  milestones: Milestone[]
  dailySnapshots: DailySnapshot[]
  startDate: string
}

const GROWTH_PATH = join(KBOT_DIR, 'growth-state.json')

const DEFAULT_METRICS: GrowthMetrics = {
  npmDownloads: 0,
  githubStars: 0,
  totalUsers: 0,
  totalMessages: 0,
  totalStreams: 0,
  totalStreamMinutes: 0,
  toolsBuilt: 0,
  factsLearned: 0,
  dreamsDreamed: 0,
  techniquesDiscovered: 0,
  worldBlocksPlaced: 0,
  versionsShipped: 0,
}

const DEFAULT_MILESTONES: Omit<Milestone, 'reached' | 'reachedAt'>[] = [
  { name: 'First Stream', metric: 'totalStreams', threshold: 1 },
  { name: 'First Viewer', metric: 'totalUsers', threshold: 1 },
  { name: '100 Messages', metric: 'totalMessages', threshold: 100 },
  { name: '1K Downloads', metric: 'npmDownloads', threshold: 1000 },
  { name: '10K Downloads', metric: 'npmDownloads', threshold: 10000 },
  { name: '100K Downloads', metric: 'npmDownloads', threshold: 100000 },
  { name: '10 Stars', metric: 'githubStars', threshold: 10 },
  { name: '100 Stars', metric: 'githubStars', threshold: 100 },
  { name: '100 Facts', metric: 'factsLearned', threshold: 100 },
  { name: '1K Facts', metric: 'factsLearned', threshold: 1000 },
  { name: '10 Dreams', metric: 'dreamsDreamed', threshold: 10 },
  { name: '100 Dreams', metric: 'dreamsDreamed', threshold: 100 },
  { name: '10 Techniques', metric: 'techniquesDiscovered', threshold: 10 },
  { name: '24h Streaming', metric: 'totalStreamMinutes', threshold: 1440 },
  { name: '1 Week Streaming', metric: 'totalStreamMinutes', threshold: 10080 },
]

export function initGrowthEngine(): GrowthEngine {
  return {
    metrics: { ...DEFAULT_METRICS },
    milestones: DEFAULT_MILESTONES.map(m => ({
      ...m,
      reached: false,
      reachedAt: null,
    })),
    dailySnapshots: [],
    startDate: new Date().toISOString().split('T')[0],
  }
}

/** Increment a metric by value (default 1) */
export function updateMetric(
  growth: GrowthEngine,
  metric: keyof GrowthMetrics,
  value: number = 1,
): void {
  if (metric in growth.metrics) {
    (growth.metrics as unknown as Record<string, number>)[metric] =
      ((growth.metrics as unknown as Record<string, number>)[metric] || 0) + value
  }
}

/** Check milestones, return any newly reached */
export function checkMilestones(growth: GrowthEngine): Milestone[] {
  const newlyReached: Milestone[] = []
  const now = new Date().toISOString()

  for (const milestone of growth.milestones) {
    if (milestone.reached) continue
    const currentValue = (growth.metrics as unknown as Record<string, number>)[milestone.metric] || 0
    if (currentValue >= milestone.threshold) {
      milestone.reached = true
      milestone.reachedAt = now
      newlyReached.push(milestone)
    }
  }

  return newlyReached
}

/** Human-readable growth summary */
export function getGrowthSummary(growth: GrowthEngine): string {
  const m = growth.metrics
  const reached = growth.milestones.filter(ms => ms.reached).length
  const total = growth.milestones.length
  const days = Math.max(1, Math.floor(
    (Date.now() - new Date(growth.startDate).getTime()) / (1000 * 60 * 60 * 24),
  ))

  const lines: string[] = [
    `Growth over ${days} day${days === 1 ? '' : 's'} (since ${growth.startDate}):`,
    `  npm downloads: ${m.npmDownloads.toLocaleString()}`,
    `  GitHub stars: ${m.githubStars}`,
    `  Users: ${m.totalUsers}`,
    `  Messages processed: ${m.totalMessages.toLocaleString()}`,
    `  Streams: ${m.totalStreams} (${m.totalStreamMinutes} min)`,
    `  Tools built: ${m.toolsBuilt}`,
    `  Facts learned: ${m.factsLearned}`,
    `  Dreams dreamed: ${m.dreamsDreamed}`,
    `  Techniques discovered: ${m.techniquesDiscovered}`,
    `  World blocks placed: ${m.worldBlocksPlaced}`,
    `  Versions shipped: ${m.versionsShipped}`,
    `  Milestones: ${reached}/${total} reached`,
  ]

  return lines.join('\n')
}

/** Rate of change for a metric over N days */
export function getGrowthRate(
  growth: GrowthEngine,
  metric: keyof GrowthMetrics,
  days: number,
): number {
  if (growth.dailySnapshots.length < 2) return 0

  const now = Date.now()
  const cutoff = now - days * 24 * 60 * 60 * 1000
  const cutoffDate = new Date(cutoff).toISOString().split('T')[0]

  // Find the snapshot closest to the cutoff
  const pastSnapshot = growth.dailySnapshots.find(s => s.date >= cutoffDate)
  if (!pastSnapshot) return 0

  const currentValue = (growth.metrics as unknown as Record<string, number>)[metric] || 0
  const pastValue = (pastSnapshot.metrics as unknown as Record<string, number>)[metric] || 0
  const diff = currentValue - pastValue

  return days > 0 ? diff / days : diff
}

/** Persist growth state to disk */
export function saveGrowth(growth: GrowthEngine): void {
  writeJson(GROWTH_PATH, growth)
}

/** Load growth state from disk */
export function loadGrowth(): GrowthEngine | null {
  return readJson<GrowthEngine>(GROWTH_PATH)
}


// ═══════════════════════════════════════════════════════════════════════════
// TOOL REGISTRATION
// ═══════════════════════════════════════════════════════════════════════════

// Singleton instances — lazily initialized
let _memory: MemoryEngine | null = null
let _identity: IdentityEngine | null = null
let _growth: GrowthEngine | null = null

function getMemory(): MemoryEngine {
  if (!_memory) {
    _memory = loadMemory() || initMemoryEngine()
  }
  return _memory
}

function getIdentity(): IdentityEngine {
  if (!_identity) {
    _identity = initIdentityEngine()
  }
  return _identity
}

function getGrowth(): GrowthEngine {
  if (!_growth) {
    _growth = loadGrowth() || initGrowthEngine()
  }
  return _growth
}

export function registerFoundationEngineTools(): void {
  // --- Memory: recall ---
  registerTool({
    name: 'memory_recall',
    description: 'Search kbot unified memory by keyword. Returns matching episodic memories sorted by importance.',
    parameters: {
      query: { type: 'string', description: 'Search keyword or phrase', required: true },
    },
    tier: 'free',
    async execute(args) {
      const mem = getMemory()
      const query = String(args.query || '')
      if (!query) return 'No query provided.'

      const results = recall(mem, query)
      if (results.length === 0) return `No memories matching "${query}".`

      const lines = results.slice(0, 20).map((e, i) =>
        `${i + 1}. [${new Date(e.when).toISOString()}] ${e.what} (who: ${e.who}, emotion: ${e.emotion}, importance: ${e.importance})`,
      )
      return `Found ${results.length} memories:\n${lines.join('\n')}`
    },
  })

  // --- Identity: opinion ---
  registerTool({
    name: 'identity_opinion',
    description: 'Get or set kbot\'s opinion on a topic. If opinion is provided, stores it. Otherwise returns the existing opinion.',
    parameters: {
      topic: { type: 'string', description: 'The topic to get/set an opinion on', required: true },
      opinion: { type: 'string', description: 'If provided, sets kbot\'s opinion on this topic' },
    },
    tier: 'free',
    async execute(args) {
      const identity = getIdentity()
      const topic = String(args.topic || '')
      if (!topic) return 'No topic provided.'

      if (args.opinion) {
        addOpinion(identity, topic, String(args.opinion))
        return `Opinion stored: "${topic}" -> "${args.opinion}"`
      }

      return getOpinion(identity, topic)
    },
  })

  // --- Growth: summary ---
  registerTool({
    name: 'growth_summary',
    description: 'Get a comprehensive summary of kbot\'s growth metrics: downloads, stars, users, messages, streams, milestones, and more.',
    parameters: {},
    tier: 'free',
    async execute() {
      const growth = getGrowth()
      return getGrowthSummary(growth)
    },
  })

  // --- Growth: milestones ---
  registerTool({
    name: 'growth_milestones',
    description: 'List all growth milestones and their status. Optionally update a metric and check for newly reached milestones.',
    parameters: {
      metric: { type: 'string', description: 'Metric to increment (e.g. npmDownloads, githubStars, totalMessages)' },
      value: { type: 'number', description: 'Amount to increment the metric by (default: 1)', default: 1 },
    },
    tier: 'free',
    async execute(args) {
      const growth = getGrowth()

      // Optionally update a metric
      if (args.metric) {
        const metric = String(args.metric) as keyof GrowthMetrics
        const value = Number(args.value) || 1
        if (metric in growth.metrics) {
          updateMetric(growth, metric, value)
          saveGrowth(growth)
        }
      }

      // Check milestones
      const newlyReached = checkMilestones(growth)
      if (newlyReached.length > 0) {
        saveGrowth(growth)
      }

      // Format output
      const lines: string[] = []
      if (newlyReached.length > 0) {
        lines.push('NEW MILESTONES REACHED:')
        for (const ms of newlyReached) {
          lines.push(`  [NEW] ${ms.name} (${ms.metric} >= ${ms.threshold})`)
        }
        lines.push('')
      }

      lines.push('All milestones:')
      for (const ms of growth.milestones) {
        const status = ms.reached ? `REACHED ${ms.reachedAt}` : 'pending'
        lines.push(`  ${ms.reached ? '[x]' : '[ ]'} ${ms.name} — ${ms.metric} >= ${ms.threshold} (${status})`)
      }

      return lines.join('\n')
    },
  })
}
