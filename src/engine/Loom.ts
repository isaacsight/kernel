// ═══════════════════════════════════════════════════════════════
//  The Loom — Reflexive intelligence for multi-agent systems
// ═══════════════════════════════════════════════════════════════
//
//  The system models the user through 12 specialists, 6
//  convergence facets, memory tiers, world models, and
//  knowledge graphs.
//
//  The Loom models the system itself.
//
//  It observes agent behavior, tracks outcomes, and weaves
//  those observations back into routing, selection, and
//  synthesis — enabling the system to evolve its own cognitive
//  structure per user, over time.
//
//  The loop closes here.
//
// ═══════════════════════════════════════════════════════════════

import type { ClassificationResult } from './AgentRouter'
import type { IntentType, Reflection } from './types'
import { getProvider } from './providers/registry'

// ── Types ─────────────────────────────────────────────────────

export interface UserSignal {
  continued: boolean             // sent another message in same thread
  messageLatencyMs: number       // time before they responded (0 = no response yet)
  lengthDelta: number            // their next msg length vs rolling avg (-1 to +1)
  rephrased: boolean             // semantically similar to previous input
  abandoned: boolean             // started new conversation within 60s
}

export interface Outcome {
  id: string
  timestamp: number
  // What was decided
  routerClassification: ClassificationResult
  agentUsed: string
  swarmComposition: string[] | null
  modelUsed: string
  // How it went
  reflectionQuality: number
  reflectionScores: Reflection['scores']
  // What the user did next
  userSignal: UserSignal
  // Derived
  effectiveQuality: number
}

export interface AgentLedger {
  agentId: string
  totalOutcomes: number
  avgEffectiveQuality: number
  qualityTrend: 'improving' | 'stable' | 'declining'
  bestIntentType: IntentType | null
  worstIntentType: IntentType | null
  bestSwarmPartners: string[]
  soloVsSwarmDelta: number       // positive = better solo, negative = better in swarm
  strengthSignals: string[]
  weaknessSignals: string[]
}

export interface LoomState {
  outcomes: Outcome[]            // rolling window of 100
  ledgers: Record<string, AgentLedger>
  patterns: string[]             // synthesized pattern notes
  selfContext: string            // pre-formatted self-mirror for prompts
  lastSynthesis: number          // timestamp of last pattern synthesis
}

// ── Constants ─────────────────────────────────────────────────

const MAX_OUTCOMES = 100
const SYNTHESIS_INTERVAL = 20    // run pattern synthesis every N outcomes
const SIGNAL_WEIGHT = 0.6        // user signal weight in effective quality
const REFLECTION_WEIGHT = 0.4    // reflection score weight in effective quality
const TREND_WINDOW = 10          // last N outcomes for trend calculation

// ── Empty State ───────────────────────────────────────────────

export function emptyLoomState(): LoomState {
  return {
    outcomes: [],
    ledgers: {},
    patterns: [],
    selfContext: '',
    lastSynthesis: 0,
  }
}

// ── User Signal Detection ─────────────────────────────────────

/** Compute a normalized user signal score from 0 to 1 */
function computeSignalScore(signal: UserSignal): number {
  let score = 0.5 // neutral baseline

  if (signal.continued) score += 0.25
  if (signal.abandoned) score -= 0.35
  if (signal.rephrased) score -= 0.25

  // Fast response = engaged, slow or none = less engaged
  if (signal.messageLatencyMs > 0 && signal.messageLatencyMs < 30_000) {
    score += 0.1
  } else if (signal.messageLatencyMs > 120_000) {
    score -= 0.1
  }

  // Longer follow-up messages = more engaged
  if (signal.lengthDelta > 0.2) score += 0.1
  if (signal.lengthDelta < -0.3) score -= 0.05

  return Math.max(0, Math.min(1, score))
}

/** Detect if a new message is a rephrase of the previous user message */
export function detectRephrase(previous: string, current: string): boolean {
  if (!previous || !current) return false
  const prevWords = new Set(previous.toLowerCase().split(/\s+/).filter(w => w.length > 3))
  const currWords = current.toLowerCase().split(/\s+/).filter(w => w.length > 3)
  if (prevWords.size === 0 || currWords.length === 0) return false
  const overlap = currWords.filter(w => prevWords.has(w)).length
  const ratio = overlap / Math.max(prevWords.size, currWords.length)
  return ratio > 0.5 && previous !== current
}

// ── Outcome Capture ───────────────────────────────────────────

/** Compute attunement score: how well-calibrated is the response to the user's behavior? */
function computeAttunement(signal: UserSignal, reflection: Reflection): number {
  let score = 0.5

  // Length alignment: if user is sending shorter messages and we're being concise, good
  // (lengthDelta positive = user getting longer, negative = shorter)
  const brevity = reflection.scores.brevity
  if (signal.lengthDelta < -0.2 && brevity > 0.6) score += 0.2 // short user, concise response: good
  if (signal.lengthDelta > 0.2 && brevity < 0.6) score += 0.15 // long user, detailed response: good
  if (signal.lengthDelta < -0.3 && brevity < 0.4) score -= 0.2 // short user, verbose response: bad

  // Engagement alignment
  if (signal.continued && !signal.rephrased) score += 0.15 // good signal
  if (signal.rephrased) score -= 0.2 // misalignment
  if (signal.abandoned) score -= 0.3 // severe misalignment

  // Continuity bonus
  const continuity = reflection.scores.continuity || 0
  score += continuity * 0.15

  return Math.max(0, Math.min(1, score))
}

export function captureOutcome(
  classification: ClassificationResult,
  agentUsed: string,
  swarmComposition: string[] | null,
  modelUsed: string,
  reflection: Reflection,
  userSignal: UserSignal,
): Outcome {
  const signalScore = computeSignalScore(userSignal)
  const attunement = computeAttunement(userSignal, reflection)
  const effectiveQuality =
    reflection.quality * REFLECTION_WEIGHT +
    signalScore * SIGNAL_WEIGHT

  return {
    id: `loom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    routerClassification: classification,
    agentUsed,
    swarmComposition,
    modelUsed,
    reflectionQuality: reflection.quality,
    reflectionScores: { ...reflection.scores, attunement },
    userSignal,
    effectiveQuality,
  }
}

// ── Agent Ledger ──────────────────────────────────────────────

function intentFromClassification(c: ClassificationResult): IntentType {
  // Map agent IDs to approximate intent types
  const map: Record<string, IntentType> = {
    kernel: 'converse', researcher: 'reason', coder: 'build',
    writer: 'build', analyst: 'evaluate', aesthete: 'build',
    guardian: 'evaluate', curator: 'converse', strategist: 'evaluate',
    infrastructure: 'build', quant: 'build', investigator: 'reason',
  }
  return map[c.agentId] || 'converse'
}

export function updateLedger(state: LoomState, outcome: Outcome): void {
  const { agentUsed } = outcome
  const existing = state.ledgers[agentUsed] || {
    agentId: agentUsed,
    totalOutcomes: 0,
    avgEffectiveQuality: 0,
    qualityTrend: 'stable' as const,
    bestIntentType: null,
    worstIntentType: null,
    bestSwarmPartners: [],
    soloVsSwarmDelta: 0,
    strengthSignals: [],
    weaknessSignals: [],
  }

  // Running average
  const newTotal = existing.totalOutcomes + 1
  const newAvg =
    (existing.avgEffectiveQuality * existing.totalOutcomes + outcome.effectiveQuality) / newTotal

  existing.totalOutcomes = newTotal
  existing.avgEffectiveQuality = newAvg

  // Trend from recent outcomes for this agent
  const agentOutcomes = state.outcomes
    .filter(o => o.agentUsed === agentUsed)
    .slice(-TREND_WINDOW)
  if (agentOutcomes.length >= 3) {
    const firstHalf = agentOutcomes.slice(0, Math.floor(agentOutcomes.length / 2))
    const secondHalf = agentOutcomes.slice(Math.floor(agentOutcomes.length / 2))
    const avgFirst = firstHalf.reduce((s, o) => s + o.effectiveQuality, 0) / firstHalf.length
    const avgSecond = secondHalf.reduce((s, o) => s + o.effectiveQuality, 0) / secondHalf.length
    const delta = avgSecond - avgFirst
    existing.qualityTrend = delta > 0.05 ? 'improving' : delta < -0.05 ? 'declining' : 'stable'
  }

  // Best/worst intent types for this agent
  const intentScores: Record<string, { total: number; count: number }> = {}
  for (const o of state.outcomes.filter(o => o.agentUsed === agentUsed)) {
    const intent = intentFromClassification(o.routerClassification)
    if (!intentScores[intent]) intentScores[intent] = { total: 0, count: 0 }
    intentScores[intent].total += o.effectiveQuality
    intentScores[intent].count++
  }
  const intents = Object.entries(intentScores)
    .filter(([, v]) => v.count >= 2)
    .map(([k, v]) => ({ intent: k as IntentType, avg: v.total / v.count }))
    .sort((a, b) => b.avg - a.avg)
  if (intents.length > 0) existing.bestIntentType = intents[0].intent
  if (intents.length > 1) existing.worstIntentType = intents[intents.length - 1].intent

  // Swarm partner analysis
  const swarmOutcomes = state.outcomes.filter(o => o.agentUsed === agentUsed && o.swarmComposition)
  const soloOutcomes = state.outcomes.filter(o => o.agentUsed === agentUsed && !o.swarmComposition)
  if (swarmOutcomes.length >= 2 && soloOutcomes.length >= 2) {
    const avgSwarm = swarmOutcomes.reduce((s, o) => s + o.effectiveQuality, 0) / swarmOutcomes.length
    const avgSolo = soloOutcomes.reduce((s, o) => s + o.effectiveQuality, 0) / soloOutcomes.length
    existing.soloVsSwarmDelta = avgSolo - avgSwarm
  }

  // Best swarm partners
  const partnerScores: Record<string, { total: number; count: number }> = {}
  for (const o of swarmOutcomes) {
    for (const partner of (o.swarmComposition || [])) {
      if (partner === agentUsed) continue
      if (!partnerScores[partner]) partnerScores[partner] = { total: 0, count: 0 }
      partnerScores[partner].total += o.effectiveQuality
      partnerScores[partner].count++
    }
  }
  existing.bestSwarmPartners = Object.entries(partnerScores)
    .filter(([, v]) => v.count >= 2)
    .sort((a, b) => (b[1].total / b[1].count) - (a[1].total / a[1].count))
    .slice(0, 3)
    .map(([k]) => k)

  state.ledgers[agentUsed] = existing
}

// ── Routing Context (injected into AgentRouter) ───────────────

export function buildRoutingContext(state: LoomState): string {
  if (state.outcomes.length < 5) return '' // not enough data yet

  const parts: string[] = []

  // Top agents by effective quality
  const ranked = Object.values(state.ledgers)
    .filter(l => l.totalOutcomes >= 3)
    .sort((a, b) => b.avgEffectiveQuality - a.avgEffectiveQuality)

  if (ranked.length > 0) {
    parts.push('Routing history for this user:')
    for (const l of ranked.slice(0, 5)) {
      const trend = l.qualityTrend === 'improving' ? '↑' : l.qualityTrend === 'declining' ? '↓' : '→'
      parts.push(`- ${l.agentId}: ${l.avgEffectiveQuality.toFixed(2)} avg quality ${trend} (${l.totalOutcomes} uses)`)
    }
  }

  // Recent misroutes (user rephrased or abandoned)
  const misroutes = state.outcomes
    .filter(o => o.userSignal.rephrased || o.userSignal.abandoned)
    .slice(-5)
  if (misroutes.length > 0) {
    parts.push('')
    parts.push('Recent misroutes (user rephrased or abandoned):')
    for (const m of misroutes) {
      parts.push(`- Routed to ${m.agentUsed}, effective quality ${m.effectiveQuality.toFixed(2)}`)
    }
  }

  // Agent-specific strengths
  const withStrengths = ranked.filter(l => l.bestIntentType)
  if (withStrengths.length > 0) {
    parts.push('')
    parts.push('Agent strengths for this user:')
    for (const l of withStrengths.slice(0, 5)) {
      if (l.bestIntentType) {
        parts.push(`- ${l.agentId}: best at "${l.bestIntentType}" intents`)
      }
    }
  }

  // Synthesized patterns
  if (state.patterns.length > 0) {
    parts.push('')
    parts.push('Learned patterns:')
    for (const p of state.patterns.slice(-5)) {
      parts.push(`- ${p}`)
    }
  }

  return parts.length > 0 ? parts.join('\n') : ''
}

// ── Swarm Composition Context (injected into SwarmOrchestrator) ──

export function buildSwarmContext(state: LoomState): string {
  if (state.outcomes.length < 5) return ''

  // Find compositions that worked well
  const swarmOutcomes = state.outcomes.filter(o => o.swarmComposition && o.swarmComposition.length >= 2)
  if (swarmOutcomes.length < 3) return ''

  // Group by composition key
  const compScores: Record<string, { total: number; count: number; agents: string[] }> = {}
  for (const o of swarmOutcomes) {
    const key = [...(o.swarmComposition || [])].sort().join('+')
    if (!compScores[key]) compScores[key] = { total: 0, count: 0, agents: o.swarmComposition || [] }
    compScores[key].total += o.effectiveQuality
    compScores[key].count++
  }

  const ranked = Object.values(compScores)
    .filter(c => c.count >= 2)
    .sort((a, b) => (b.total / b.count) - (a.total / a.count))

  if (ranked.length === 0) return ''

  const parts: string[] = ['Best swarm compositions for this user:']
  for (const c of ranked.slice(0, 4)) {
    parts.push(`- ${c.agents.join(' + ')}: ${(c.total / c.count).toFixed(2)} avg (${c.count} uses)`)
  }

  // Compositions to avoid
  const worst = ranked.filter(c => (c.total / c.count) < 0.5)
  if (worst.length > 0) {
    parts.push('')
    parts.push('Avoid:')
    for (const c of worst.slice(0, 2)) {
      parts.push(`- ${c.agents.join(' + ')}: ${(c.total / c.count).toFixed(2)} avg (${c.count} uses)`)
    }
  }

  return parts.join('\n')
}

// ── Self-Mirror (injected into agent system prompts) ──────────

export function formatSelfMirror(state: LoomState): string {
  if (state.outcomes.length < 5) return ''

  const parts: string[] = []

  // Top performing agents
  const ranked = Object.values(state.ledgers)
    .filter(l => l.totalOutcomes >= 3)
    .sort((a, b) => b.avgEffectiveQuality - a.avgEffectiveQuality)

  if (ranked.length > 0) {
    const top = ranked[0]
    parts.push(`This user responds best to the ${top.agentId} voice (${top.avgEffectiveQuality.toFixed(2)} avg quality)`)
  }

  // Solo vs swarm insight
  const withSwarmData = ranked.filter(l => Math.abs(l.soloVsSwarmDelta) > 0.05)
  for (const l of withSwarmData.slice(0, 2)) {
    if (l.soloVsSwarmDelta > 0.1) {
      parts.push(`${l.agentId} performs better solo than in swarms for this user`)
    } else if (l.soloVsSwarmDelta < -0.1) {
      parts.push(`${l.agentId} works better in swarms for this user`)
    }
  }

  // Synthesized patterns
  for (const p of state.patterns.slice(-3)) {
    parts.push(p)
  }

  if (parts.length === 0) return ''

  return parts.map(p => `- ${p}`).join('\n')
}

// ── Pattern Synthesis (periodic Haiku call) ───────────────────

const SYNTHESIS_SYSTEM = `You are the Loom — the part of Kernel that observes how the system itself performs. You are looking at routing decisions, agent performance scores, and user behavioral signals for a specific user.

Find patterns. What's working? What's failing? What should change?

Rules:
- Be specific. "Analyst works well" is useless. "Analyst outperforms researcher on strategy questions by 23% for this user" is useful.
- Note routing corrections: when the router picks wrong, what's the pattern?
- Note composition synergies: which agent pairs amplify each other?
- Note user-specific preferences: does this user respond better to certain agents?
- 3-5 insights maximum. Short sentences.

Respond with ONLY valid JSON:
{"patterns": ["...", "..."]}`

export async function synthesizePatterns(state: LoomState): Promise<string[]> {
  const recentOutcomes = state.outcomes.slice(-30)
  if (recentOutcomes.length < 10) return state.patterns

  try {
    // Build summary of recent performance
    const agentSummary = Object.values(state.ledgers)
      .filter(l => l.totalOutcomes >= 2)
      .map(l => {
        const parts = [`${l.agentId}: ${l.avgEffectiveQuality.toFixed(2)} avg, ${l.totalOutcomes} uses, trend ${l.qualityTrend}`]
        if (l.bestIntentType) parts.push(`best at ${l.bestIntentType}`)
        if (l.worstIntentType) parts.push(`worst at ${l.worstIntentType}`)
        if (l.bestSwarmPartners.length > 0) parts.push(`best with ${l.bestSwarmPartners.join(', ')}`)
        return parts.join(' | ')
      })
      .join('\n')

    const misroutes = recentOutcomes
      .filter(o => o.userSignal.rephrased || o.userSignal.abandoned)
      .map(o => `Routed to ${o.agentUsed} (${o.routerClassification.agentId}), quality ${o.effectiveQuality.toFixed(2)}${o.userSignal.rephrased ? ' — user rephrased' : ''}${o.userSignal.abandoned ? ' — user abandoned' : ''}`)
      .join('\n')

    const prompt = `Agent performance for this user:\n${agentSummary}\n\n${misroutes ? `Misroutes:\n${misroutes}\n\n` : ''}What patterns do you see?`

    const result = await getProvider().json<{ patterns: string[] }>(prompt, {
      system: SYNTHESIS_SYSTEM,
      tier: 'fast',
      max_tokens: 400,
    })

    return (result.patterns || []).slice(0, 5).map(p => p.slice(0, 200))
  } catch (err) {
    console.warn('[Loom] Pattern synthesis failed:', err)
    return state.patterns
  }
}

// ── Core Loop ─────────────────────────────────────────────────

/** Record an outcome and update the loom state. Returns true if synthesis ran. */
export async function recordOutcome(
  state: LoomState,
  outcome: Outcome,
): Promise<boolean> {
  // Append outcome (rolling window)
  state.outcomes = [...state.outcomes.slice(-(MAX_OUTCOMES - 1)), outcome]

  // Update agent ledger
  updateLedger(state, outcome)

  // Update self-mirror
  state.selfContext = formatSelfMirror(state)

  // Check if pattern synthesis should run
  const outcomesSinceSynthesis = state.outcomes.filter(o => o.timestamp > state.lastSynthesis).length
  if (outcomesSinceSynthesis >= SYNTHESIS_INTERVAL && state.outcomes.length >= 10) {
    state.patterns = await synthesizePatterns(state)
    state.lastSynthesis = Date.now()
    state.selfContext = formatSelfMirror(state) // refresh with new patterns
    return true
  }

  return false
}

// ── Scheduling ────────────────────────────────────────────────

/** Should Loom data be persisted? (after every outcome, debounced externally) */
export function shouldPersist(state: LoomState): boolean {
  return state.outcomes.length > 0
}

// ── Serialization ─────────────────────────────────────────────

export function serializeLoomState(state: LoomState): Record<string, unknown> {
  return {
    outcomes: state.outcomes.slice(-MAX_OUTCOMES),
    ledgers: state.ledgers,
    patterns: state.patterns,
    selfContext: state.selfContext,
    lastSynthesis: state.lastSynthesis,
  }
}

export function deserializeLoomState(data: Record<string, unknown> | null): LoomState {
  if (!data) return emptyLoomState()
  try {
    return {
      outcomes: (data.outcomes as Outcome[] || []).slice(-MAX_OUTCOMES),
      ledgers: (data.ledgers as Record<string, AgentLedger>) || {},
      patterns: (data.patterns as string[]) || [],
      selfContext: (data.selfContext as string) || '',
      lastSynthesis: (data.lastSynthesis as number) || 0,
    }
  } catch {
    return emptyLoomState()
  }
}
