// @kernel.chat/memory-tiers — Three-Tier Generative Memory for AI Agents
//
// Based on Stanford's "Generative Agents" paper (Park et al., 2023).
//
// Three tiers:
//   1. OBSERVATIONS — Raw facts from interactions
//   2. REFLECTIONS  — Periodic synthesis into higher-level insights
//   3. IDENTITY     — Long-term personality and preference evolution
//
// Zero LLM calls. All synthesis uses frequency analysis and pattern matching.
//
// Usage:
//   import { MemorySystem } from '@kernel.chat/memory-tiers'
//
//   const memory = new MemorySystem()
//   memory.observe('user prefers TypeScript over JavaScript')
//   memory.observe('user prefers TypeScript for backend')
//   memory.observe('user asked about Rust twice')
//   memory.synthesize()  // → produces reflections from observations
//   memory.evolve()      // → produces identity from reflections

// ── Types ──────────────────────────────────────────────────────────────

/** A raw observation from an interaction */
export interface Observation {
  id: string
  text: string
  category: ObservationCategory
  timestamp: string
  /** Optional metadata (e.g., task type, agent used) */
  metadata?: Record<string, unknown>
}

/** Categories for observations */
export type ObservationCategory =
  | 'preference'    // User likes/dislikes
  | 'pattern'       // Recurring behavior
  | 'fact'          // Learned information
  | 'tool_usage'    // Which tools were used
  | 'outcome'       // Success/failure of a task
  | 'correction'    // User corrected the agent
  | 'general'

/** A synthesized insight from multiple observations */
export interface Reflection {
  id: string
  text: string
  category: string
  /** How many observations support this reflection */
  supportingCount: number
  /** Confidence (0-1), based on evidence weight */
  confidence: number
  /** IDs of observations that led to this reflection */
  sources: string[]
  timestamp: string
}

/** Long-term identity trait evolved from reflections */
export interface IdentityTrait {
  trait: string
  strength: number  // 0-1
  evidence: string[]  // reflection IDs
  firstSeen: string
  lastReinforced: string
}

/** Full memory state */
export interface MemoryState {
  observations: Observation[]
  reflections: Reflection[]
  identity: IdentityTrait[]
  stats: {
    totalObservations: number
    totalReflections: number
    totalIdentityTraits: number
    lastSynthesis: string | null
    lastEvolution: string | null
    synthesisCount: number
    evolutionCount: number
  }
}

/** Configuration for the memory system */
export interface MemoryConfig {
  /** Max observations to keep (default: 500) */
  maxObservations?: number
  /** Max reflections to keep (default: 100) */
  maxReflections?: number
  /** Max identity traits (default: 20) */
  maxIdentity?: number
  /** Min observations before synthesis triggers (default: 10) */
  synthesisThreshold?: number
  /** Min reflections before evolution triggers (default: 5) */
  evolutionThreshold?: number
}

// ── Category Classification ────────────────────────────────────────────

const CATEGORY_SIGNALS: Record<ObservationCategory, string[]> = {
  preference: ['prefer', 'like', 'dislike', 'want', 'hate', 'love', 'favorite', 'always', 'never', 'rather'],
  pattern: ['usually', 'often', 'tends to', 'recurring', 'habit', 'routine', 'typically', 'pattern'],
  fact: ['is', 'are', 'was', 'has', 'uses', 'works at', 'lives in', 'knows', 'learned'],
  tool_usage: ['used', 'tool', 'ran', 'executed', 'called', 'invoked', 'command'],
  outcome: ['success', 'failed', 'error', 'worked', 'broke', 'fixed', 'solved', 'resolved'],
  correction: ['no', 'wrong', 'not that', 'actually', 'correct', 'instead', 'meant'],
  general: [],
}

function classifyObservation(text: string): ObservationCategory {
  const lower = text.toLowerCase()
  let best: ObservationCategory = 'general'
  let bestScore = 0

  for (const [cat, signals] of Object.entries(CATEGORY_SIGNALS) as [ObservationCategory, string[]][]) {
    let score = 0
    for (const s of signals) {
      if (lower.includes(s)) score++
    }
    if (score > bestScore) {
      bestScore = score
      best = cat
    }
  }

  return best
}

// ── Core Memory System ─────────────────────────────────────────────────

let idCounter = 0
function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${++idCounter}`
}

export class MemorySystem {
  private state: MemoryState
  private config: Required<MemoryConfig>

  constructor(config?: MemoryConfig) {
    this.config = {
      maxObservations: config?.maxObservations ?? 500,
      maxReflections: config?.maxReflections ?? 100,
      maxIdentity: config?.maxIdentity ?? 20,
      synthesisThreshold: config?.synthesisThreshold ?? 10,
      evolutionThreshold: config?.evolutionThreshold ?? 5,
    }

    this.state = {
      observations: [],
      reflections: [],
      identity: [],
      stats: {
        totalObservations: 0,
        totalReflections: 0,
        totalIdentityTraits: 0,
        lastSynthesis: null,
        lastEvolution: null,
        synthesisCount: 0,
        evolutionCount: 0,
      },
    }
  }

  // ── Tier 1: Observations ──

  /**
   * Record a raw observation.
   * Category is auto-detected from text if not provided.
   */
  observe(text: string, category?: ObservationCategory, metadata?: Record<string, unknown>): Observation {
    const obs: Observation = {
      id: genId('obs'),
      text,
      category: category ?? classifyObservation(text),
      timestamp: new Date().toISOString(),
      metadata,
    }

    this.state.observations.push(obs)
    this.state.stats.totalObservations++

    // Trim oldest if over limit
    if (this.state.observations.length > this.config.maxObservations) {
      this.state.observations = this.state.observations.slice(-this.config.maxObservations)
    }

    return obs
  }

  /** Get all observations, optionally filtered by category */
  getObservations(category?: ObservationCategory): Observation[] {
    if (!category) return [...this.state.observations]
    return this.state.observations.filter(o => o.category === category)
  }

  // ── Tier 2: Reflections (Synthesis) ──

  /**
   * Synthesize observations into reflections.
   * Groups observations by similar content and produces insights.
   * No LLM calls — uses word overlap and frequency analysis.
   */
  synthesize(): Reflection[] {
    if (this.state.observations.length < this.config.synthesisThreshold) {
      return []
    }

    const newReflections: Reflection[] = []

    // Group observations by category
    const groups = new Map<string, Observation[]>()
    for (const obs of this.state.observations) {
      const key = obs.category
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(obs)
    }

    for (const [category, observations] of groups) {
      if (observations.length < 2) continue

      // Find recurring words/phrases (frequency > 1)
      const wordFreq = new Map<string, number>()
      const obsPerWord = new Map<string, Set<string>>()

      for (const obs of observations) {
        const words = obs.text.toLowerCase().split(/\s+/).filter(w => w.length > 3)
        const seen = new Set<string>()
        for (const w of words) {
          if (!seen.has(w)) {
            seen.add(w)
            wordFreq.set(w, (wordFreq.get(w) ?? 0) + 1)
            if (!obsPerWord.has(w)) obsPerWord.set(w, new Set())
            obsPerWord.get(w)!.add(obs.id)
          }
        }
      }

      // Find words that appear in multiple observations (themes)
      const themes: Array<{ word: string; count: number; obsIds: string[] }> = []
      for (const [word, count] of wordFreq) {
        if (count >= 2) {
          themes.push({ word, count, obsIds: [...(obsPerWord.get(word) ?? [])] })
        }
      }

      themes.sort((a, b) => b.count - a.count)

      // Generate reflections from top themes
      for (const theme of themes.slice(0, 3)) {
        const sourceObs = observations.filter(o => theme.obsIds.includes(o.id))
        const confidence = Math.min(1, theme.count / observations.length)

        // Check if we already have a similar reflection
        const existing = this.state.reflections.find(r =>
          r.category === category && r.text.toLowerCase().includes(theme.word)
        )

        if (existing) {
          // Reinforce existing reflection
          existing.supportingCount += theme.count
          existing.confidence = Math.min(1, existing.confidence + 0.1)
          existing.timestamp = new Date().toISOString()
          continue
        }

        const reflection: Reflection = {
          id: genId('ref'),
          text: `In ${category} context, "${theme.word}" is a recurring theme across ${theme.count} observations: ${sourceObs.map(o => o.text).slice(0, 3).join('; ')}`,
          category,
          supportingCount: theme.count,
          confidence,
          sources: theme.obsIds,
          timestamp: new Date().toISOString(),
        }

        newReflections.push(reflection)
      }
    }

    // Add new reflections and trim
    this.state.reflections.push(...newReflections)
    this.state.stats.totalReflections += newReflections.length
    this.state.stats.lastSynthesis = new Date().toISOString()
    this.state.stats.synthesisCount++

    if (this.state.reflections.length > this.config.maxReflections) {
      // Keep highest confidence
      this.state.reflections.sort((a, b) => b.confidence - a.confidence)
      this.state.reflections = this.state.reflections.slice(0, this.config.maxReflections)
    }

    return newReflections
  }

  /** Get all reflections, optionally filtered by category */
  getReflections(category?: string): Reflection[] {
    if (!category) return [...this.state.reflections]
    return this.state.reflections.filter(r => r.category === category)
  }

  // ── Tier 3: Identity (Evolution) ──

  /**
   * Evolve identity traits from reflections.
   * Identifies stable patterns across reflections and crystallizes them.
   */
  evolve(): IdentityTrait[] {
    if (this.state.reflections.length < this.config.evolutionThreshold) {
      return []
    }

    const newTraits: IdentityTrait[] = []
    const now = new Date().toISOString()

    // Find high-confidence reflections
    const strong = this.state.reflections.filter(r => r.confidence >= 0.5)

    // Group by category
    const groups = new Map<string, Reflection[]>()
    for (const ref of strong) {
      if (!groups.has(ref.category)) groups.set(ref.category, [])
      groups.get(ref.category)!.push(ref)
    }

    for (const [category, reflections] of groups) {
      if (reflections.length < 2) continue

      // Check for existing trait in this category
      const existing = this.state.identity.find(t =>
        t.trait.toLowerCase().includes(category)
      )

      if (existing) {
        // Reinforce
        existing.strength = Math.min(1, existing.strength + 0.05)
        existing.lastReinforced = now
        existing.evidence.push(...reflections.map(r => r.id))
        // Deduplicate evidence
        existing.evidence = [...new Set(existing.evidence)]
        continue
      }

      // Create new identity trait
      const avgConfidence = reflections.reduce((s, r) => s + r.confidence, 0) / reflections.length
      const trait: IdentityTrait = {
        trait: `Strong ${category} orientation based on ${reflections.length} reflections`,
        strength: Math.min(1, avgConfidence),
        evidence: reflections.map(r => r.id),
        firstSeen: now,
        lastReinforced: now,
      }

      newTraits.push(trait)
    }

    this.state.identity.push(...newTraits)
    this.state.stats.totalIdentityTraits += newTraits.length
    this.state.stats.lastEvolution = now
    this.state.stats.evolutionCount++

    if (this.state.identity.length > this.config.maxIdentity) {
      this.state.identity.sort((a, b) => b.strength - a.strength)
      this.state.identity = this.state.identity.slice(0, this.config.maxIdentity)
    }

    return newTraits
  }

  /** Get all identity traits */
  getIdentity(): IdentityTrait[] {
    return [...this.state.identity]
  }

  // ── Persistence ──

  /** Export full state as JSON */
  toJSON(): string {
    return JSON.stringify(this.state, null, 2)
  }

  /** Import state from JSON */
  fromJSON(json: string): void {
    const data = JSON.parse(json) as MemoryState
    this.state = data
  }

  /** Save state to a file */
  save(path: string): void {
    const { writeFileSync, mkdirSync } = require('fs') as typeof import('fs')
    const { dirname } = require('path') as typeof import('path')
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, this.toJSON())
  }

  /** Load state from a file */
  load(path: string): void {
    const { readFileSync, existsSync } = require('fs') as typeof import('fs')
    if (existsSync(path)) {
      this.fromJSON(readFileSync(path, 'utf-8'))
    }
  }

  // ── Queries ──

  /** Get stats about the memory system */
  getStats() {
    return { ...this.state.stats }
  }

  /** Get a human-readable summary */
  summary(): string {
    const lines = [
      'Memory System Summary',
      '═'.repeat(40),
      `Observations: ${this.state.observations.length} (${this.state.stats.totalObservations} total)`,
      `Reflections:  ${this.state.reflections.length} (${this.state.stats.synthesisCount} syntheses)`,
      `Identity:     ${this.state.identity.length} traits (${this.state.stats.evolutionCount} evolutions)`,
      '',
    ]

    if (this.state.identity.length > 0) {
      lines.push('Identity:')
      for (const t of this.state.identity) {
        const bar = '█'.repeat(Math.round(t.strength * 10)) + '░'.repeat(10 - Math.round(t.strength * 10))
        lines.push(`  [${bar}] ${t.trait}`)
      }
    }

    if (this.state.reflections.length > 0) {
      lines.push('')
      lines.push('Top reflections:')
      const top = [...this.state.reflections].sort((a, b) => b.confidence - a.confidence).slice(0, 5)
      for (const r of top) {
        lines.push(`  (${(r.confidence * 100).toFixed(0)}%) ${r.text.slice(0, 80)}`)
      }
    }

    return lines.join('\n')
  }
}
