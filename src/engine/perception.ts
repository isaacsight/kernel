// ─── Perception Module ──────────────────────────────────────
//
// Raw input → structured understanding.
// Extracts intent, urgency, complexity, sentiment, implied need,
// key entities, and whether this is a follow-up.

import type { Intent, IntentType, Perception } from './types'
import type { ClassificationResult } from './AgentRouter'
import {
  countSignals,
  extractKeyEntities,
  URGENCY_SIGNALS,
  COMPLEXITY_SIGNALS,
  NEGATIVE_SIGNALS,
  POSITIVE_SIGNALS,
} from './textAnalysis'

export function perceiveInput(
  input: string,
  conversationHistory: { content: string }[],
  routerResult?: ClassificationResult,
): Perception {
  const lower = input.toLowerCase()
  const words = input.split(/\s+/)
  const wordCount = words.length

  // ── Intent Classification ──
  const intent = classifyIntent(input, lower, routerResult)

  // ── Urgency (0-1) ──
  const urgencyHits = countSignals(input, URGENCY_SIGNALS)
  const hasQuestionMark = input.includes('?')
  const isShort = wordCount < 8
  const urgency = Math.min(1, (urgencyHits * 0.3) + (isShort ? 0.1 : 0) + (hasQuestionMark ? 0.05 : 0))

  // ── Complexity (0-1) ──
  const complexityHits = countSignals(input, COMPLEXITY_SIGNALS)
  const hasMultipleSentences = (input.match(/[.!?]+/g)?.length || 0) > 1
  const isLong = wordCount > 30
  const complexity = Math.min(1,
    (complexityHits * 0.2) +
    (hasMultipleSentences ? 0.15 : 0) +
    (isLong ? 0.2 : 0) +
    (intent.type === 'reason' ? 0.3 : 0) +
    (intent.type === 'evaluate' ? 0.2 : 0)
  )

  // ── Sentiment (-1 to 1) ──
  const negHits = countSignals(input, NEGATIVE_SIGNALS)
  const posHits = countSignals(input, POSITIVE_SIGNALS)
  const sentiment = Math.max(-1, Math.min(1, (posHits - negHits) * 0.3))

  // ── Implied Need ──
  const impliedNeed = inferNeed(intent, urgency, complexity, sentiment)

  // ── Key Entities ──
  const keyEntities = extractKeyEntities(input)

  // ── Is Follow-Up? ──
  const isFollowUp =
    lower.startsWith('and ') ||
    lower.startsWith('also ') ||
    lower.startsWith('but ') ||
    lower.startsWith('what about') ||
    lower.startsWith('how about') ||
    conversationHistory.length > 0

  return {
    intent,
    urgency,
    complexity,
    sentiment,
    impliedNeed,
    keyEntities,
    isQuestion: hasQuestionMark || lower.startsWith('how') || lower.startsWith('what') || lower.startsWith('why') || lower.startsWith('should'),
    isFollowUp,
    routerClassification: routerResult,
  }
}

export function classifyIntent(input: string, lower: string, routerResult?: ClassificationResult): Intent {
  if (routerResult && (routerResult.isMultiStep || routerResult.needsSwarm)) {
    return { type: 'workflow', request: input }
  }

  // AgentRouter is the single source of truth — map agentId → IntentType
  if (routerResult && routerResult.confidence >= 0.5) {
    const agentToIntent: Record<string, IntentType> = {
      researcher: 'discuss',
      coder: 'build',
      analyst: 'evaluate',
      writer: 'build',
      kernel: 'converse',
    }
    const intentType = agentToIntent[routerResult.agentId] || 'converse'
    switch (intentType) {
      case 'discuss': {
        const topic = input.replace(/discuss|what do you think about|let's talk about|debate|perspectives on|opinions on/gi, '').trim() || input
        return { type: 'discuss', topic }
      }
      case 'build':
        return { type: 'build', description: input }
      case 'evaluate':
        return { type: 'evaluate', opportunity: input }
      case 'converse':
        return { type: 'converse', message: input }
    }
  }

  // Minimal keyword fallback (only used when AgentRouter API fails)
  if (lower.includes('build') || lower.includes('create') || lower.includes('implement')) {
    return { type: 'build', description: input }
  }
  if (lower.includes('analyze') || lower.includes('evaluate') || lower.includes('should i')) {
    return { type: 'evaluate', opportunity: input }
  }
  if (lower.includes('discuss') || lower.includes('debate')) {
    return { type: 'discuss', topic: input }
  }

  return { type: 'converse', message: input }
}

export function inferNeed(
  intent: Intent,
  urgency: number,
  complexity: number,
  sentiment: number,
): string {
  if (sentiment < -0.3) {
    return 'Reassurance and a clear path forward'
  }
  if (urgency > 0.6) {
    return 'A fast, decisive answer'
  }
  if (complexity > 0.6) {
    return 'Deep analysis with visible reasoning'
  }

  switch (intent.type) {
    case 'discuss': return 'Multiple perspectives to think with'
    case 'reason': return 'Rigorous thinking made visible'
    case 'build': return 'A concrete plan or artifact'
    case 'evaluate': return 'An honest assessment with numbers'
    case 'workflow': return 'An orchestrated sequential execution plan'
    case 'converse': return 'A thoughtful, human response'
  }
}
