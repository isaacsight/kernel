/**
 * Context Preamble — Dynamic Self-Awareness Layer
 *
 * Builds a concise context block injected at the top of every system prompt,
 * giving Kernel awareness of who it's talking to, what it knows, and what
 * constraints are active. This is the "inner monologue" that makes responses
 * feel personal without any new UI.
 *
 * Token budget: ~300-500 tokens. Concise by design.
 */

import type { UserMemoryProfile } from './MemoryAgent'
import type { UserMirror } from './Convergence'

interface PreambleInput {
  /** User's extracted memory profile */
  memory: UserMemoryProfile | null
  /** Convergence mirror with facet observations + emergent insights */
  mirror: UserMirror | null
  /** Messages used today / daily limit */
  usage: { used: number; limit: number } | null
  /** Current specialist handling this message */
  agentName: string
  /** Number of messages in the current conversation */
  turnCount: number
  /** Recent conversation titles (for topic awareness) */
  recentTopics: string[]
  /** Whether the user is on the free tier */
  isFree: boolean
}

/**
 * Build a short, structured context block for the system prompt.
 * Returns empty string if no meaningful context is available (cold start).
 */
export function buildContextPreamble(input: PreambleInput): string {
  const lines: string[] = []

  // ── Who they are ──
  const identity = buildIdentityLine(input.memory)
  if (identity) lines.push(identity)

  // ── Communication style ──
  if (input.memory?.communication_style) {
    lines.push(`Style: ${input.memory.communication_style}`)
  }

  // ── What convergence has noticed ──
  const insight = pickTopInsight(input.mirror)
  if (insight) lines.push(`Observation: ${insight}`)

  // ── Session context ──
  const temporal = buildTemporalLine()
  lines.push(temporal)

  // ── Usage awareness ──
  if (input.usage && input.isFree) {
    const remaining = Math.max(0, input.usage.limit - input.usage.used)
    if (remaining <= 3) {
      lines.push(`They have ${remaining} message${remaining !== 1 ? 's' : ''} left today — be thorough and complete.`)
    } else {
      lines.push(`Messages remaining today: ${remaining} of ${input.usage.limit}`)
    }
  }

  // ── Recent topics ──
  if (input.recentTopics.length > 0) {
    const topics = input.recentTopics.slice(0, 4).join(', ')
    lines.push(`Recent topics: ${topics}`)
  }

  // ── Conversation depth ──
  if (input.turnCount > 10) {
    lines.push(`Deep in conversation (${input.turnCount} messages) — they're invested in this topic.`)
  } else if (input.turnCount === 0) {
    lines.push('This is a new conversation.')
  }

  if (lines.length === 0) return ''

  return `\n## Context\n${lines.join('\n')}\n`
}

// ─── Helpers ──────────────────────────────────────────────

function buildIdentityLine(memory: UserMemoryProfile | null): string {
  if (!memory) return ''

  const parts: string[] = []

  // Key facts (pick the most identifying ones)
  if (memory.facts.length > 0) {
    const topFacts = memory.facts.slice(0, 3).join('. ')
    parts.push(topFacts)
  }

  // Active goals
  if (memory.goals.length > 0) {
    const topGoals = memory.goals.slice(0, 2).join('; ')
    parts.push(`Working on: ${topGoals}`)
  }

  return parts.length > 0 ? parts.join('. ') : ''
}

function pickTopInsight(mirror: UserMirror | null): string {
  if (!mirror?.insights?.length) return ''

  // Pick the highest-confidence insight
  const sorted = [...mirror.insights]
    .filter(i => i.confidence >= 0.6)
    .sort((a, b) => b.confidence - a.confidence)

  if (sorted.length === 0) return ''

  // Return the top insight, trimmed
  const top = sorted[0]
  return top.insight.length > 200 ? top.insight.slice(0, 197) + '...' : top.insight
}

function buildTemporalLine(): string {
  const now = new Date()
  const hour = now.getHours()
  const day = now.toLocaleDateString('en-US', { weekday: 'long' })

  let timeOfDay: string
  if (hour < 6) timeOfDay = 'late night'
  else if (hour < 12) timeOfDay = 'morning'
  else if (hour < 17) timeOfDay = 'afternoon'
  else if (hour < 21) timeOfDay = 'evening'
  else timeOfDay = 'night'

  return `${day} ${timeOfDay}`
}
