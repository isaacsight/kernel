// ═══════════════════════════════════════════════════════════════
//  Convergence — Where agents talk to each other
// ═══════════════════════════════════════════════════════════════
//
//  Each agent maintains a facet: its angle on who the user is.
//  Convergence is the process where facets meet and
//  emergent insights appear — things no single agent could see.
//
//  The mirror sharpens with every conversation.
//
// ═══════════════════════════════════════════════════════════════

import { getProvider, getBackgroundProvider } from './providers/registry'

// ── Types ─────────────────────────────────────────────────────

export interface AgentFacet {
  agentId: string
  observations: string[]
  patterns: string[]
  updatedAt: number
  messagesSeen: number
}

export interface ConvergenceInsight {
  insight: string
  sources: string[]
  confidence: number
  createdAt: number
}

export interface UserMirror {
  facets: Record<string, AgentFacet>
  insights: ConvergenceInsight[]
  lastConvergence: number
  convergenceCount: number
}

// ── Facet Lenses ──────────────────────────────────────────────
// Each lens tells an agent what dimension of the user to observe.
// Only 6 agents maintain facets — they each see something distinct.

const FACET_LENSES: Record<string, string> = {
  kernel: `You are the Kernel's eye for RELATIONSHIP.
What is the quality of the connection between Kernel and this person?
What makes them engaged? What frustrates them? What do they trust you with?
Notice emotional patterns, not just topics.`,

  researcher: `You are the Kernel's eye for CURIOSITY.
What is this person curious about? How deep do they go — breadth or depth?
Do they follow up, or move on? What domains pull them back again and again?`,

  coder: `You are the Kernel's eye for CRAFT.
What is this person's technical identity? How do they solve problems —
methodically, intuitively, experimentally? What do they value in code —
elegance, speed, simplicity? What's their skill level?`,

  writer: `You are the Kernel's eye for VOICE.
How does this person express themselves? Terse or expansive? Formal or raw?
Do they think in metaphors, lists, narratives? What words and rhythms
are distinctly theirs?`,

  analyst: `You are the Kernel's eye for JUDGMENT.
How does this person make decisions? Risk-tolerant or cautious?
Data-driven or intuitive? Do they seek validation or challenge?
What frameworks do they reach for?`,

  curator: `You are the Kernel's eye for ARC.
How is this person changing over time? What were they interested in before
that they've moved past? What's emerging that they haven't named yet?
What's the trajectory?`,
}

const FACET_NAMES: Record<string, string> = {
  kernel: 'Kernel',
  researcher: 'Researcher',
  coder: 'Coder',
  writer: 'Writer',
  analyst: 'Analyst',
  curator: 'Curator',
}

const FACET_DIMENSIONS: Record<string, string> = {
  kernel: 'relationship',
  researcher: 'curiosity',
  coder: 'craft',
  writer: 'voice',
  analyst: 'judgment',
  curator: 'arc',
}

export const FACET_AGENT_IDS = Object.keys(FACET_LENSES)

// ── Facet Extraction ──────────────────────────────────────────

function buildExtractSystem(lens: string): string {
  return `${lens}

Analyze the conversation below and extract what you see from your specific angle.

Rules:
- Focus ONLY on your dimension — don't comment on things outside your lens
- Be specific and concrete — cite actual things from the conversation
- Note patterns if you see them recurring
- Better to say less with confidence than more with guessing
- Max 4 observations, max 2 patterns

Respond with ONLY valid JSON:
{"observations": ["..."], "patterns": ["..."]}`
}

export async function extractFacet(
  agentId: string,
  messages: { role: string; content: string }[],
  existingFacet?: AgentFacet,
): Promise<AgentFacet | null> {
  const lens = FACET_LENSES[agentId]
  if (!lens) return null

  try {
    const conversation = messages
      .slice(-10)
      .map(m => `${m.role === 'user' ? 'User' : 'Kernel'}: ${m.content.slice(0, 500)}`)
      .join('\n\n')

    const existingContext = existingFacet && existingFacet.observations.length > 0
      ? `\n\nYour previous observations about this person:\n${existingFacet.observations.map(o => `- ${o}`).join('\n')}\n\nUpdate or add to these based on what you see in the new conversation. Drop observations that seem outdated.`
      : ''

    const result = await getBackgroundProvider().json<{ observations: string[]; patterns: string[] }>(
      `${conversation}${existingContext}`,
      { system: buildExtractSystem(lens), tier: 'fast', max_tokens: 400, feature: 'convergence' },
    )

    const observations = existingFacet
      ? mergeStringArrays(existingFacet.observations, result.observations || [], 6)
      : (result.observations || []).slice(0, 6)

    const patterns = existingFacet
      ? mergeStringArrays(existingFacet.patterns, result.patterns || [], 4)
      : (result.patterns || []).slice(0, 4)

    return {
      agentId,
      observations,
      patterns,
      updatedAt: Date.now(),
      messagesSeen: (existingFacet?.messagesSeen || 0) + 1,
    }
  } catch (err) {
    console.warn(`[Convergence] Facet extraction failed for ${agentId}:`, err)
    return existingFacet || null
  }
}

// ── Convergence ───────────────────────────────────────────────

const CONVERGENCE_SYSTEM = `You are the Convergence — the moment where Kernel's agents share what they've each noticed about the user and discover what none of them could see alone.

You will receive observations from multiple agent perspectives. Your task is to find EMERGENT insights — things that only become visible when you look across multiple angles at once.

Examples of emergent insights:
- "They research like a builder, not an academic — always asking 'how would I use this?'" (Researcher + Coder)
- "Their writing gets sharper when they're excited about a project, more careful when they're uncertain" (Writer + Analyst)
- "They're transitioning from exploring to building — the questions are getting more specific" (Curator + Coder)

Rules:
- Each insight MUST require 2+ agent perspectives to see — if one agent could see it alone, it's not convergent
- Be specific. Ground insights in actual observations, not platitudes
- 2-4 insights maximum. Quality over quantity
- Note which agent perspectives contributed to each insight
- Confidence 0.0-1.0 based on how much evidence supports the insight

Respond with ONLY valid JSON:
{"insights": [{"insight": "...", "sources": ["kernel", "coder"], "confidence": 0.8}]}`

export async function converge(mirror: UserMirror): Promise<ConvergenceInsight[]> {
  const activeFacets = Object.values(mirror.facets).filter(f => f.observations.length > 0)

  if (activeFacets.length < 2) {
    return mirror.insights
  }

  try {
    const facetText = activeFacets.map(f => {
      const name = FACET_NAMES[f.agentId] || f.agentId
      const dim = FACET_DIMENSIONS[f.agentId] || 'general'
      const obs = f.observations.map(o => `- ${o}`).join('\n')
      const pat = f.patterns.length > 0
        ? `\nPatterns:\n${f.patterns.map(p => `- ${p}`).join('\n')}`
        : ''
      return `## ${name} (${dim})\nObservations:\n${obs}${pat}`
    }).join('\n\n')

    const previousContext = mirror.insights.length > 0
      ? `\n\nPrevious convergence insights (update, deepen, or replace as needed):\n${mirror.insights.map(i => `- ${i.insight}`).join('\n')}`
      : ''

    const result = await getProvider().json<{ insights: ConvergenceInsight[] }>(
      `Agent perspectives on the user:\n\n${facetText}${previousContext}\n\nWhat can you see now that no single agent could see alone?`,
      { system: CONVERGENCE_SYSTEM, tier: 'strong', max_tokens: 600, feature: 'convergence' },
    )

    return (result.insights || []).slice(0, 4).map(i => ({
      insight: sanitizeInsight(i.insight || ''),
      sources: (i.sources || []).filter(s => FACET_AGENT_IDS.includes(s)),
      confidence: Math.min(1, Math.max(0, i.confidence || 0.5)),
      createdAt: Date.now(),
    }))
  } catch (err) {
    console.warn('[Convergence] Convergence failed:', err)
    return mirror.insights
  }
}

// ── Prompt Formatting ─────────────────────────────────────────

export function formatMirrorForPrompt(mirror: UserMirror): string {
  if (!mirror) return ''

  const parts: string[] = []

  if (mirror.insights.length > 0) {
    parts.push('**What the mirror sees:**')
    for (const insight of mirror.insights) {
      parts.push(`- ${insight.insight}`)
    }
  }

  const facetsWithPatterns = Object.values(mirror.facets).filter(f => f.patterns.length > 0)
  if (facetsWithPatterns.length > 0) {
    parts.push('')
    parts.push('**Patterns across conversations:**')
    for (const facet of facetsWithPatterns) {
      const dim = FACET_DIMENSIONS[facet.agentId]
      for (const pattern of facet.patterns.slice(0, 2)) {
        parts.push(`- [${dim}] ${pattern}`)
      }
    }
  }

  const result = parts.join('\n')
  return result.slice(0, 1500)
}

/**
 * Format coder-specific calibration from the Convergence mirror.
 * Injects into coder system prompt to adapt code output to user's skill level.
 */
export function formatCraftCalibration(mirror: UserMirror): string {
  if (!mirror) return ''

  const coderFacet = mirror.facets['coder']
  const analystFacet = mirror.facets['analyst']

  // Need at least the coder facet with observations
  if (!coderFacet || coderFacet.observations.length === 0) return ''

  const parts: string[] = []
  parts.push('## CRAFT CALIBRATION')
  parts.push('Adapt your code output to match this user\'s demonstrated level and preferences:')
  parts.push('')

  // Coder observations → technical identity
  if (coderFacet.observations.length > 0) {
    parts.push('**Technical identity:**')
    for (const obs of coderFacet.observations.slice(0, 4)) {
      parts.push(`- ${obs}`)
    }
  }

  // Coder patterns → coding style
  if (coderFacet.patterns.length > 0) {
    parts.push('')
    parts.push('**Coding patterns:**')
    for (const pat of coderFacet.patterns.slice(0, 3)) {
      parts.push(`- ${pat}`)
    }
  }

  // Analyst facet → decision-making style (useful for code trade-offs)
  if (analystFacet && analystFacet.patterns.length > 0) {
    parts.push('')
    parts.push('**Decision style:**')
    for (const pat of analystFacet.patterns.slice(0, 2)) {
      parts.push(`- ${pat}`)
    }
  }

  // Convergence insights that involve the coder facet
  const coderInsights = mirror.insights.filter(i =>
    i.sources.includes('coder') && i.confidence >= 0.6
  )
  if (coderInsights.length > 0) {
    parts.push('')
    parts.push('**Emergent insights about their craft:**')
    for (const insight of coderInsights.slice(0, 3)) {
      parts.push(`- ${insight.insight}`)
    }
  }

  parts.push('')
  parts.push('Use this calibration to adjust: comment density, abstraction level, error handling verbosity, variable naming style, and whether to explain decisions inline or after the code.')

  const result = parts.join('\n')
  return result.slice(0, 1200) // cap to prevent prompt bloat
}

// ── Scheduling ────────────────────────────────────────────────

export function shouldConverge(mirror: UserMirror, messageCount: number): boolean {
  const activeFacets = Object.values(mirror.facets).filter(f => f.observations.length > 0)
  if (activeFacets.length < 2) return false

  // First convergence as soon as we have 2+ facets
  if (mirror.convergenceCount === 0) return true

  // After that: every 5 messages, or when 3+ facets updated since last convergence
  const updatedSince = activeFacets.filter(f => f.updatedAt > mirror.lastConvergence).length
  if (updatedSince >= 3) return true

  return messageCount > 0 && messageCount % 10 === 0
}

export function resolveFacetAgent(activeAgentId: string): string {
  // If the active agent is a facet agent, use it.
  // Otherwise fall back to kernel (relationship is always observable).
  return FACET_AGENT_IDS.includes(activeAgentId) ? activeAgentId : 'kernel'
}

// ── Helpers ───────────────────────────────────────────────────

export function emptyMirror(): UserMirror {
  return {
    facets: {},
    insights: [],
    lastConvergence: 0,
    convergenceCount: 0,
  }
}

function mergeStringArrays(existing: string[], incoming: string[], max: number): string[] {
  const seen = new Set(existing.map(s => s.toLowerCase().trim()))
  const merged = [...existing]
  for (const item of incoming) {
    const key = item.toLowerCase().trim()
    if (key && !seen.has(key)) {
      merged.push(item)
      seen.add(key)
    }
  }
  return merged.slice(-max)
}

const MAX_INSIGHT_LENGTH = 200

function sanitizeInsight(text: string): string {
  return text.slice(0, MAX_INSIGHT_LENGTH).trim()
}
