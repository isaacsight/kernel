// ─── Reflection Module ──────────────────────────────────────
//
// The engine looks at what it just produced and asks:
// - Was this good? (substance, coherence, relevance)
// - Was this beautiful? (brevity, craft)
// - What should I believe differently now?

import type { Perception, Reflection } from './types'
import type { Agent, Message } from '../types'

export function reflect(
  input: string,
  output: string,
  agent: Agent,
  perception: Perception,
  durationMs: number,
  conversationHistory: Message[],
): Reflection {
  const words = output.split(/\s+/).length
  const sentences = (output.match(/[.!?]+/g) || []).length || 1
  const avgSentenceLength = words / sentences

  // ── Substance (0-1) ──
  const hasSubstance = output.length > 50
  const hasSpecifics = /\d/.test(output) || output.includes('"') || output.includes('because')
  const notBoilerplate = !output.includes('I can help') && !output.includes('Here is')
  const substance = (
    (hasSubstance ? 0.4 : 0) +
    (hasSpecifics ? 0.35 : 0) +
    (notBoilerplate ? 0.25 : 0)
  )

  // ── Coherence (0-1) ──
  const noErrors = !output.includes('Error') && !output.includes('Unable to')
  const lastMessage = conversationHistory[conversationHistory.length - 2]
  const buildsOnPrior = lastMessage
    ? output.toLowerCase().split(' ').some(w =>
        w.length > 4 && lastMessage.content.toLowerCase().includes(w)
      )
    : true
  const coherence = (noErrors ? 0.5 : 0) + (buildsOnPrior ? 0.5 : 0)

  // ── Relevance (0-1) ──
  const inputWords = input.toLowerCase().split(/\s+/).filter(w => w.length > 3)
  const outputLower = output.toLowerCase()
  const relevantWords = inputWords.filter(w => outputLower.includes(w)).length
  const relevance = inputWords.length > 0
    ? Math.min(1, relevantWords / Math.min(inputWords.length, 5))
    : 0.5

  // ── Brevity (0-1) ──
  const isReasoning = perception.intent.type === 'reason' || perception.intent.type === 'evaluate'
  const idealSentences = isReasoning ? 8 : 3
  const sentenceRatio = sentences / idealSentences
  const brevity = sentenceRatio <= 1
    ? 0.6 + (sentenceRatio * 0.4)
    : Math.max(0, 1 - (sentenceRatio - 1) * 0.3)
  const brevityFinal = Math.min(1, brevity * (avgSentenceLength < 25 ? 1 : 0.7))

  // ── Craft (0-1) ──
  const hasVariedPunctuation = /[;:—–]/.test(output)
  const noRepetition = new Set(output.toLowerCase().split(/\s+/)).size / words > 0.6
  const notGeneric = !output.includes('In conclusion') && !output.includes('Overall')
  const craft = (
    (hasVariedPunctuation ? 0.3 : 0) +
    (noRepetition ? 0.4 : 0) +
    (notGeneric ? 0.3 : 0)
  )

  const quality = (
    substance * 0.25 +
    coherence * 0.25 +
    relevance * 0.2 +
    brevity * 0.15 +
    craft * 0.15
  )

  // ── Conviction Delta ──
  const convictionDelta = quality > 0.7 ? 0.03 : quality < 0.4 ? -0.05 : 0

  // ── Lesson ──
  const lesson =
    quality > 0.75
      ? `Strong cycle. ${agent.name}'s voice fits this intent well.`
      : quality > 0.5
      ? substance < 0.5
        ? `${agent.name} responded but lacked specifics. Push for concrete details.`
        : brevity < 0.4
        ? `Too verbose. ${agent.name} should be more concise for ${perception.intent.type} intents.`
        : `Adequate. The coherence could improve — build more on prior context.`
      : `Weak cycle. ${
          coherence < 0.3 ? 'Lost thread of conversation.' :
          relevance < 0.3 ? 'Missed the actual question.' :
          `${agent.name} may not be the right voice for this.`
        }`

  // ── World Model Update ──
  let worldModelUpdate: string | null = null
  if (perception.isQuestion && quality > 0.6) {
    worldModelUpdate = `User asks ${perception.intent.type} questions — prefers ${perception.complexity > 0.5 ? 'depth' : 'directness'}.`
  }

  return {
    timestamp: Date.now(),
    phase: 'reflecting',
    input,
    output: output.slice(0, 300),
    agentUsed: agent.id,
    durationMs,
    quality,
    scores: {
      substance,
      coherence,
      relevance,
      brevity: brevityFinal,
      craft,
    },
    lesson,
    worldModelUpdate,
    convictionDelta,
  }
}
