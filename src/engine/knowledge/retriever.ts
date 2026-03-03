// Knowledge Engine — Two-stage retrieval pipeline
// Stage 1: Postgres trigram similarity (fast, ~50ms)
// Stage 2: LLM rerank (optional, ~200ms)

import { getProvider } from '../providers/registry'
import type { RetrievalResult } from './types'

// ─── Stage 1: Postgres search ───────────────────────────────

/**
 * Search knowledge via the search_knowledge RPC.
 * Returns raw candidates ranked by trigram similarity + confidence.
 */
export async function searchKnowledge(
  supabaseRpc: (name: string, params: Record<string, unknown>) => Promise<{ data: RetrievalResult[] | null; error: unknown }>,
  userId: string,
  query: string,
  limit = 20,
): Promise<RetrievalResult[]> {
  try {
    const { data, error } = await supabaseRpc('search_knowledge', {
      p_user_id: userId,
      p_query: query,
      p_limit: limit,
    })
    if (error) {
      console.warn('[KnowledgeRetriever] Search RPC failed:', error)
      return []
    }
    return data || []
  } catch (err) {
    console.warn('[KnowledgeRetriever] Search failed:', err)
    return []
  }
}

// ─── Stage 2: LLM rerank ───────────────────────────────────

const RERANK_SYSTEM = `You are a relevance ranker. Given a user query and a list of knowledge items, rank them by relevance to the query. Return the IDs of the top items in order of relevance.

Respond with ONLY valid JSON:
{"ranked_ids": ["id1", "id2", "id3"]}`

interface RerankResponse {
  ranked_ids: string[]
}

/**
 * Rerank candidates using LLM for semantic relevance.
 * Takes top candidates from Postgres search, returns reranked top-N.
 */
export async function rerankResults(
  query: string,
  candidates: RetrievalResult[],
  topN = 5,
): Promise<RetrievalResult[]> {
  if (candidates.length <= topN) return candidates

  try {
    const summaryList = candidates.map((c, i) =>
      `[${c.id}] ${c.summary || c.content.slice(0, 120)} (topic: ${c.topic || 'unknown'}, confidence: ${c.confidence})`
    ).join('\n')

    const result = await getProvider().json<RerankResponse>(
      `Query: "${query}"\n\nRank these knowledge items by relevance to the query (return top ${topN}):\n\n${summaryList}`,
      { system: RERANK_SYSTEM, tier: 'fast', max_tokens: 300, feature: 'knowledge_ingestion' }
    )

    const rankedIds = result.ranked_ids || []
    const idMap = new Map(candidates.map(c => [c.id, c]))
    const ranked: RetrievalResult[] = []

    for (const id of rankedIds.slice(0, topN)) {
      const item = idMap.get(id)
      if (item) ranked.push(item)
    }

    // Fill remaining slots with unranked candidates (by original similarity)
    if (ranked.length < topN) {
      const rankedSet = new Set(ranked.map(r => r.id))
      for (const c of candidates) {
        if (ranked.length >= topN) break
        if (!rankedSet.has(c.id)) ranked.push(c)
      }
    }

    return ranked
  } catch (err) {
    console.warn('[KnowledgeRetriever] Rerank failed, using similarity order:', err)
    return candidates.slice(0, topN)
  }
}

// ─── Formatting ─────────────────────────────────────────────

/**
 * Format retrieved knowledge items for system prompt injection.
 * Capped at ~600 tokens to avoid bloating context.
 */
export function formatKnowledgeForPrompt(items: RetrievalResult[], maxTokens = 600): string {
  if (items.length === 0) return ''

  const lines: string[] = []
  let tokenEstimate = 0

  for (const item of items) {
    const line = formatItem(item)
    const lineTokens = Math.ceil(line.length / 4)
    if (tokenEstimate + lineTokens > maxTokens) break
    lines.push(line)
    tokenEstimate += lineTokens
  }

  return lines.join('\n')
}

function formatItem(item: RetrievalResult): string {
  const source = item.source_title ? ` (from: ${item.source_title})` : ''
  const conf = item.confidence >= 0.8 ? '' : item.confidence >= 0.5 ? ' [likely]' : ' [uncertain]'
  return `- **${item.topic || 'General'}**: ${item.summary || item.content.slice(0, 150)}${conf}${source}`
}

// ─── Knowledge Query Synthesis ──────────────────────────────

const SYNTHESIS_SYSTEM = `You are a knowledge synthesis agent. The user is asking about what they know on a topic. Synthesize the retrieved knowledge items into a coherent, organized response.

Rules:
- Group by topic/subtopic when there are multiple items
- Note confidence levels (mention if something is uncertain)
- Cite sources when available (e.g., "from your conversation about X" or "from the document Y")
- Be concise but comprehensive
- If contradictions exist, note them
- Use the user's own words/phrasing when possible`

/**
 * Synthesize a natural-language answer from retrieved knowledge items.
 * Used for "what do I know about X?" queries.
 */
export async function synthesizeKnowledgeAnswer(
  query: string,
  items: RetrievalResult[],
): Promise<string> {
  if (items.length === 0) {
    return "I don't have any knowledge items stored on that topic yet. As we continue our conversations, I'll build up your knowledge base."
  }

  try {
    const itemsText = items.map((item, i) =>
      `${i + 1}. [${item.topic || 'General'}] ${item.content} (confidence: ${item.confidence}, source: ${item.source_type}${item.source_title ? ` — ${item.source_title}` : ''})`
    ).join('\n')

    const response = await getProvider().text(
      `User query: "${query}"\n\nRetrieved knowledge items:\n${itemsText}`,
      { system: SYNTHESIS_SYSTEM, tier: 'strong', max_tokens: 1000, feature: 'knowledge_ingestion' }
    )

    return response || "I found some related knowledge but couldn't synthesize it. Here's what I have in your knowledge base on this topic."
  } catch (err) {
    console.warn('[KnowledgeRetriever] Synthesis failed:', err)
    // Fallback: return formatted items
    return `Here's what I found in your knowledge base:\n\n${formatKnowledgeForPrompt(items, 1000)}`
  }
}
