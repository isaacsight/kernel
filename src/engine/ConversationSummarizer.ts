// ─── Conversation Summarizer ─────────────────────────────────
//
// Summarizes older turns in long conversations so early context
// isn't lost as the thread grows. Summaries are cached per
// conversation in the metadata JSONB column.
//
// Trigger: when a conversation exceeds SUMMARY_THRESHOLD messages,
// the oldest messages (beyond the recent window) are summarized
// into a compact block injected into the system prompt.

import { getBackgroundProvider } from './providers/registry'

// ─── Config ──────────────────────────────────────────────────

/** Start summarizing when conversation exceeds this many messages */
export const SUMMARY_THRESHOLD = 10

/** Keep this many recent messages unsummarized (passed raw to Claude) */
export const RECENT_WINDOW = 8

/** Max tokens for the summary itself */
const SUMMARY_MAX_TOKENS = 600

// ─── Types ───────────────────────────────────────────────────

export interface ConversationSummary {
  /** Compact summary of older messages */
  text: string
  /** Number of messages covered by this summary */
  messagesCovered: number
  /** Timestamp when summary was generated */
  generatedAt: number
}

// ─── Summarization ──────────────────────────────────────────

const SUMMARIZE_SYSTEM = `You are a conversation summarizer. Produce a compact summary of the conversation so far. Focus on:
- Key topics and questions discussed
- Decisions made or conclusions reached
- Important facts or preferences the user mentioned
- Any commitments or action items
- The emotional tone and trajectory of the conversation

Write in third person ("The user asked about...", "They discussed...").
Keep it under 300 words. Be dense with information — every sentence should carry meaning.
Do NOT include greetings, pleasantries, or filler.`

export async function summarizeConversation(
  messages: { role: string; content: string }[],
): Promise<string> {
  const conversation = messages
    .map(m => `${m.role === 'user' ? 'User' : 'Kernel'}: ${m.content.slice(0, 300)}`)
    .join('\n\n')

  try {
    return await getBackgroundProvider().text(
      `Summarize this conversation:\n\n${conversation}`,
      { system: SUMMARIZE_SYSTEM, tier: 'fast', max_tokens: SUMMARY_MAX_TOKENS },
    )
  } catch (err) {
    console.warn('[Summarizer] Failed:', err)
    return ''
  }
}

/**
 * Determine whether summarization should run for this conversation.
 * Returns the messages that should be summarized (older ones beyond the recent window),
 * or null if no summarization is needed.
 */
export function getMessagesToSummarize(
  allMessages: { role: string; content: string }[],
  existingSummary: ConversationSummary | null,
): { role: string; content: string }[] | null {
  // Not enough messages to warrant summarization
  if (allMessages.length < SUMMARY_THRESHOLD) return null

  const olderMessages = allMessages.slice(0, -RECENT_WINDOW)
  if (olderMessages.length === 0) return null

  // If we already have a summary covering these messages, skip
  if (existingSummary && existingSummary.messagesCovered >= olderMessages.length) {
    return null
  }

  return olderMessages
}

/**
 * Format a conversation summary for injection into the system prompt.
 */
export function formatSummaryForPrompt(summary: ConversationSummary): string {
  if (!summary.text) return ''
  return `## Earlier in This Conversation (${summary.messagesCovered} messages summarized)\n${summary.text}`
}

// ─── Cross-Conversation Memory ──────────────────────────────

/** Conversation entry with optional metadata for cross-thread retrieval */
interface ConversationEntry {
  id: string
  title: string
  metadata?: Record<string, unknown>
}

/**
 * Retrieve the most relevant past conversation for a cross-thread reference.
 * Matches the user's query against topic-annotated conversations, then returns
 * the best match's persisted summary (if any). No embedding search needed —
 * topics from indexing give us enough signal.
 *
 * @returns Formatted context block or empty string if no match found
 */
export function retrieveRelevantConversation(
  query: string,
  currentConvId: string | null,
  conversations: ConversationEntry[],
): string {
  const queryWords = new Set(query.toLowerCase().match(/\b[a-z]{3,}\b/g) || [])
  if (queryWords.size === 0) return ''

  let bestMatch: { conv: ConversationEntry; score: number; summary: string } | null = null

  for (const conv of conversations) {
    if (conv.id === currentConvId) continue
    const meta = conv.metadata
    if (!meta) continue

    const topics = (meta.topics as string[]) || []
    const summary = (meta.summary as { text?: string })?.text

    // Score: topic overlap + title keyword overlap
    const titleWords = new Set(conv.title.toLowerCase().match(/\b[a-z]{3,}\b/g) || [])
    const topicWords = new Set(topics.flatMap(t => t.toLowerCase().match(/\b[a-z]{3,}\b/g) || []))

    let overlap = 0
    for (const w of queryWords) {
      if (titleWords.has(w)) overlap += 1
      if (topicWords.has(w)) overlap += 2 // topics are stronger signal
    }

    const score = overlap / queryWords.size
    if (score > 0.1 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { conv, score, summary: summary || '' }
    }
  }

  if (!bestMatch) return ''

  const topicStr = ((bestMatch.conv.metadata?.topics as string[]) || []).join(', ')
  const header = `## Referenced Conversation: "${bestMatch.conv.title}"`
  const topicLine = topicStr ? `**Topics:** ${topicStr}` : ''
  const summaryLine = bestMatch.summary
    ? `**Summary:** ${bestMatch.summary.slice(0, 800)}`
    : `*No detailed summary available — conversation covered: ${topicStr || bestMatch.conv.title}*`

  return [header, topicLine, summaryLine].filter(Boolean).join('\n')
}
