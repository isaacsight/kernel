// ─── Attention Module ───────────────────────────────────────
//
// Not everything matters equally. Attention assigns salience
// weights to what the engine should focus on right now.

import type { AttentionState, Perception } from './types'
import type { Message } from '../types'

export function attend(
  perception: Perception,
  conversationHistory: Message[],
  unresolvedQuestions: string[],
): AttentionState {
  const { intent, complexity, keyEntities, isFollowUp } = perception

  // Primary focus = the core of what's being asked
  const primaryFocus = intent.type === 'discuss'
    ? intent.topic
    : intent.type === 'reason'
      ? intent.question
      : intent.type === 'build'
        ? intent.description
        : intent.type === 'evaluate'
          ? intent.opportunity
          : intent.type === 'workflow'
            ? intent.request
            : intent.message

  // Build salience map from entities + conversation context
  const salience: Record<string, number> = {}
  keyEntities.forEach((entity, i) => {
    salience[entity] = 1 - (i * 0.15) // first entity = most salient
  })

  // Boost salience of things mentioned in recent conversation
  if (isFollowUp) {
    const recentMessages = conversationHistory.slice(-3)
    for (const msg of recentMessages) {
      for (const entity of keyEntities) {
        if (msg.content.toLowerCase().includes(entity.toLowerCase())) {
          salience[entity] = Math.min(1, (salience[entity] || 0) + 0.2)
        }
      }
    }
  }

  // Depth depends on complexity and intent
  const depth: AttentionState['depth'] =
    complexity > 0.6 || intent.type === 'reason' ? 'deep' :
      complexity > 0.3 || intent.type === 'evaluate' ? 'moderate' :
        'surface'

  // Distractions = things that might pull attention away
  const distractions: string[] = []
  if (unresolvedQuestions.length > 2) {
    distractions.push('accumulated unresolved questions')
  }

  return { primaryFocus, salience, distractions, depth }
}
