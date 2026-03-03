// ─── Knowledge Engine ───────────────────────────────────────
//
// Unified personal knowledge base. Ingests from conversations,
// uploads, web searches, imports, and URLs. Retrieves relevant
// knowledge for prompt injection and explicit queries.

import { supabase } from './SupabaseClient'
import { chunkText, chunkConversation } from './knowledge/chunker'
import { extractKnowledgeItems, deduplicateAndMerge } from './knowledge/ingester'
import { searchKnowledge, rerankResults, formatKnowledgeForPrompt, synthesizeKnowledgeAnswer } from './knowledge/retriever'
import type { KnowledgeItem, KnowledgeSource, RetrievalResult, KnowledgeContradiction, KnowledgeTopic, KnowledgeStats, ExtractedItem } from './knowledge/types'

// ─── Ingestion Entry Points ─────────────────────────────────

/**
 * Ingest knowledge from a conversation (every 3 messages).
 */
export async function ingestFromConversation(
  messages: { role: string; content: string }[],
  userId: string,
  conversationId: string,
  conversationTitle?: string,
): Promise<number> {
  if (messages.length < 2) return 0

  const chunks = chunkConversation(messages)
  const source: KnowledgeSource = {
    type: 'conversation',
    id: conversationId,
    title: conversationTitle || 'Conversation',
  }

  return ingestChunks(chunks, source, userId)
}

/**
 * Ingest knowledge from a document upload (Pro only).
 */
export async function ingestFromDocument(
  content: string,
  fileName: string,
  _fileType: string,
  userId: string,
): Promise<number> {
  if (!content.trim()) return 0

  const chunks = chunkText(content, { targetTokens: 400 })
  const source: KnowledgeSource = {
    type: 'upload',
    title: fileName,
  }

  return ingestChunks(chunks, source, userId)
}

/**
 * Ingest knowledge from web search results.
 */
export async function ingestFromWebSearch(
  query: string,
  findings: string,
  userId: string,
): Promise<number> {
  if (!findings.trim()) return 0

  const chunks = chunkText(findings, { targetTokens: 350 })
  const source: KnowledgeSource = {
    type: 'web_search',
    title: `Search: ${query.slice(0, 80)}`,
  }

  return ingestChunks(chunks, source, userId)
}

/**
 * Ingest knowledge from a fetched URL.
 */
export async function ingestFromUrl(
  url: string,
  content: string,
  userId: string,
): Promise<number> {
  if (!content.trim()) return 0

  const chunks = chunkText(content, { targetTokens: 400 })
  const source: KnowledgeSource = {
    type: 'url',
    id: url,
    title: url.slice(0, 100),
  }

  return ingestChunks(chunks, source, userId)
}

/**
 * Ingest knowledge from an imported conversation.
 */
export async function ingestFromImport(
  messages: { role: string; content: string }[],
  platform: string,
  title: string,
  userId: string,
): Promise<number> {
  if (messages.length === 0) return 0

  const chunks = chunkConversation(messages)
  const source: KnowledgeSource = {
    type: 'import',
    title: `${platform}: ${title}`.slice(0, 100),
  }

  return ingestChunks(chunks, source, userId)
}

// ─── Core Ingestion Pipeline ────────────────────────────────

async function ingestChunks(
  chunks: string[],
  source: KnowledgeSource,
  userId: string,
): Promise<number> {
  let totalInserted = 0

  // Process chunks in batches of 3 to limit LLM calls
  for (let i = 0; i < chunks.length; i += 3) {
    const batch = chunks.slice(i, i + 3).join('\n\n---\n\n')
    const extracted = await extractKnowledgeItems(batch, source)
    if (extracted.length === 0) continue

    // Fetch existing items on same topics for dedup
    const topics = [...new Set(extracted.map(e => e.topic))]
    const existing = await getExistingByTopics(userId, topics)
    const { toInsert, toUpdate } = deduplicateAndMerge(extracted, existing)

    // Insert new items
    if (toInsert.length > 0) {
      const inserted = await insertItems(userId, toInsert, source)
      totalInserted += inserted

      // Check for contradictions against existing items
      for (const item of toInsert) {
        await detectContradiction(userId, item, existing)
      }
    }

    // Update existing items (boost mention_count + confidence)
    for (const update of toUpdate) {
      await updateItemMentions(update.id, update.mention_count, update.confidence)
    }

    // Upsert topics
    await upsertTopics(userId, extracted)
  }

  // Update user_memory knowledge stats
  if (totalInserted > 0) {
    await updateKnowledgeStats(userId)
  }

  return totalInserted
}

// ─── Retrieval ──────────────────────────────────────────────

/**
 * Retrieve relevant knowledge for system prompt injection.
 * Two-stage: Postgres trigram search → LLM rerank.
 */
export async function retrieveForContext(
  userId: string,
  query: string,
  topN = 5,
): Promise<RetrievalResult[]> {
  const rpc = async (name: string, params: Record<string, unknown>) => {
    const { data, error } = await supabase.rpc(name, params)
    return { data: data as RetrievalResult[] | null, error }
  }

  const candidates = await searchKnowledge(rpc, userId, query, 20)
  if (candidates.length === 0) return []

  // Update last_accessed for retrieved items
  const ids = candidates.map(c => c.id)
  supabase.from('knowledge_items')
    .update({ last_accessed: new Date().toISOString() })
    .in('id', ids.slice(0, topN))
    .then(() => {}) // fire-and-forget

  // Skip LLM rerank for small result sets
  if (candidates.length <= topN) return candidates

  return rerankResults(query, candidates, topN)
}

/**
 * Handle explicit knowledge queries ("what do I know about X?").
 * Returns a synthesized natural-language answer.
 */
export async function queryKnowledge(
  userId: string,
  query: string,
): Promise<string> {
  const rpc = async (name: string, params: Record<string, unknown>) => {
    const { data, error } = await supabase.rpc(name, params)
    return { data: data as RetrievalResult[] | null, error }
  }

  const candidates = await searchKnowledge(rpc, userId, query, 15)
  return synthesizeKnowledgeAnswer(query, candidates)
}

/**
 * Get proactive knowledge — items that should be surfaced without explicit request.
 * Checks: expiring items, topic overlap, contradiction alerts.
 */
export async function getProactiveKnowledge(
  userId: string,
  currentTopics: string[],
): Promise<{ expiring: KnowledgeItem[]; related: RetrievalResult[]; contradictions: KnowledgeContradiction[] }> {
  const result = { expiring: [] as KnowledgeItem[], related: [] as RetrievalResult[], contradictions: [] as KnowledgeContradiction[] }

  try {
    // Expiring items (within 7 days)
    const { data: expiringData } = await supabase
      .from('knowledge_items')
      .select('*')
      .eq('user_id', userId)
      .is('superseded_by', null)
      .lt('expires_at', new Date(Date.now() + 7 * 86400000).toISOString())
      .gt('expires_at', new Date().toISOString())
      .limit(3)
    result.expiring = (expiringData || []) as KnowledgeItem[]

    // Topic overlap — items related to current conversation topics
    if (currentTopics.length > 0) {
      const topicQuery = currentTopics.slice(0, 3).join(' ')
      result.related = await retrieveForContext(userId, topicQuery, 3)
    }

    // Pending contradictions
    const { data: contData } = await supabase
      .from('knowledge_contradictions')
      .select('*')
      .eq('user_id', userId)
      .eq('resolution', 'pending')
      .limit(3)
    result.contradictions = (contData || []) as KnowledgeContradiction[]
  } catch (err) {
    console.warn('[KnowledgeEngine] Proactive retrieval failed:', err)
  }

  return result
}

/**
 * Format knowledge for system prompt injection.
 */
export function formatForPrompt(items: RetrievalResult[]): string {
  return formatKnowledgeForPrompt(items, 600)
}

// ─── CRUD Operations ────────────────────────────────────────

export async function getTopics(userId: string): Promise<KnowledgeTopic[]> {
  const { data, error } = await supabase
    .from('knowledge_topics')
    .select('*')
    .eq('user_id', userId)
    .order('item_count', { ascending: false })
  if (error) console.warn('[KnowledgeEngine] Failed to get topics:', error)
  return (data || []) as KnowledgeTopic[]
}

export async function getItem(itemId: string): Promise<KnowledgeItem | null> {
  const { data, error } = await supabase
    .from('knowledge_items')
    .select('*')
    .eq('id', itemId)
    .single()
  if (error) return null
  return data as KnowledgeItem
}

export async function deleteItem(itemId: string): Promise<boolean> {
  const { error } = await supabase
    .from('knowledge_items')
    .delete()
    .eq('id', itemId)
  return !error
}

export async function updateItem(itemId: string, updates: Partial<Pick<KnowledgeItem, 'content' | 'summary' | 'topic' | 'domain' | 'confidence'>>): Promise<boolean> {
  const { error } = await supabase
    .from('knowledge_items')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', itemId)
  return !error
}

export async function resolveContradiction(
  contradictionId: string,
  resolution: 'user_confirmed_existing' | 'user_confirmed_new',
): Promise<boolean> {
  const { data: contradiction } = await supabase
    .from('knowledge_contradictions')
    .select('*')
    .eq('id', contradictionId)
    .single()

  if (!contradiction) return false

  // Update contradiction record
  await supabase
    .from('knowledge_contradictions')
    .update({ resolution, resolved_at: new Date().toISOString() })
    .eq('id', contradictionId)

  // If user confirmed new info, supersede the existing item
  if (resolution === 'user_confirmed_new') {
    const c = contradiction as KnowledgeContradiction
    // Create new item from the contradiction's new_content
    const { data: newItem } = await supabase
      .from('knowledge_items')
      .insert({
        user_id: c.user_id,
        content: c.new_content,
        source_type: c.new_source_type,
        confidence: 0.9,
      })
      .select()
      .single()

    if (newItem) {
      await supabase
        .from('knowledge_items')
        .update({ superseded_by: newItem.id })
        .eq('id', c.existing_item_id)
    }
  }

  return true
}

export async function getStats(userId: string): Promise<KnowledgeStats> {
  try {
    const [
      { count: totalItems },
      { count: topicCount },
      { data: domainData },
      { count: pendingContradictions },
      { data: memoryData },
    ] = await Promise.all([
      supabase.from('knowledge_items').select('*', { count: 'exact', head: true }).eq('user_id', userId).is('superseded_by', null),
      supabase.from('knowledge_topics').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('knowledge_items').select('domain').eq('user_id', userId).is('superseded_by', null),
      supabase.from('knowledge_contradictions').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('resolution', 'pending'),
      supabase.from('user_memory').select('last_knowledge_sync').eq('user_id', userId).maybeSingle(),
    ])

    // Count by domain
    const domainBreakdown: Record<string, number> = { tech: 0, personal: 0, work: 0, creative: 0, finance: 0, health: 0, general: 0 }
    for (const row of (domainData || []) as { domain: string }[]) {
      domainBreakdown[row.domain] = (domainBreakdown[row.domain] || 0) + 1
    }

    return {
      totalItems: totalItems || 0,
      topicCount: topicCount || 0,
      domainBreakdown: domainBreakdown as KnowledgeStats['domainBreakdown'],
      pendingContradictions: pendingContradictions || 0,
      lastSync: (memoryData as { last_knowledge_sync: string | null } | null)?.last_knowledge_sync || null,
    }
  } catch (err) {
    console.warn('[KnowledgeEngine] Stats failed:', err)
    return { totalItems: 0, topicCount: 0, domainBreakdown: { tech: 0, personal: 0, work: 0, creative: 0, finance: 0, health: 0, general: 0 }, pendingContradictions: 0, lastSync: null }
  }
}

// ─── Warmth Decay ───────────────────────────────────────────

/**
 * Prune items not accessed in 90 days with low mention_count.
 * Call periodically (e.g., daily via task-scheduler).
 */
export async function pruneStaleItems(userId: string): Promise<number> {
  const cutoff = new Date(Date.now() - 90 * 86400000).toISOString()

  const { data, error } = await supabase
    .from('knowledge_items')
    .delete()
    .eq('user_id', userId)
    .is('superseded_by', null)
    .lt('last_accessed', cutoff)
    .lt('mention_count', 2)
    .select('id')

  if (error) {
    console.warn('[KnowledgeEngine] Prune failed:', error)
    return 0
  }
  return data?.length || 0
}

// ─── Internal Helpers ───────────────────────────────────────

async function getExistingByTopics(
  userId: string,
  topics: string[],
): Promise<Pick<KnowledgeItem, 'id' | 'topic' | 'keywords' | 'content' | 'mention_count' | 'confidence'>[]> {
  if (topics.length === 0) return []
  const { data } = await supabase
    .from('knowledge_items')
    .select('id, topic, keywords, content, mention_count, confidence')
    .eq('user_id', userId)
    .is('superseded_by', null)
    .in('topic', topics)
    .limit(50)
  return (data || []) as Pick<KnowledgeItem, 'id' | 'topic' | 'keywords' | 'content' | 'mention_count' | 'confidence'>[]
}

async function insertItems(
  userId: string,
  items: ExtractedItem[],
  source: KnowledgeSource,
): Promise<number> {
  const rows = items.map(item => ({
    user_id: userId,
    content: item.content,
    summary: item.summary,
    topic: item.topic,
    subtopic: item.subtopic || null,
    domain: item.domain,
    item_type: item.item_type,
    source_type: source.type,
    source_id: source.id || null,
    source_title: source.title || null,
    confidence: item.confidence,
    keywords: item.keywords,
    knowledge_date: item.knowledge_date || null,
    expires_at: item.expires_at || null,
  }))

  const { data, error } = await supabase
    .from('knowledge_items')
    .insert(rows)
    .select('id')

  if (error) {
    console.warn('[KnowledgeEngine] Insert failed:', error)
    return 0
  }
  return data?.length || 0
}

async function updateItemMentions(
  id: string,
  mentionCount: number,
  confidence: number,
): Promise<void> {
  await supabase
    .from('knowledge_items')
    .update({
      mention_count: mentionCount,
      confidence,
      last_accessed: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
}

async function detectContradiction(
  userId: string,
  newItem: ExtractedItem,
  existingItems: Pick<KnowledgeItem, 'id' | 'topic' | 'keywords' | 'content' | 'mention_count' | 'confidence'>[],
): Promise<void> {
  // Only check items on the same topic
  const sameTopic = existingItems.filter(e =>
    (e.topic || '').toLowerCase() === newItem.topic.toLowerCase()
  )
  if (sameTopic.length === 0) return

  for (const existing of sameTopic) {
    // Simple contradiction heuristic: same topic but very different content
    const contentOverlap = computeWordOverlap(newItem.content, existing.content)
    // Low word overlap + same topic = potential contradiction
    if (contentOverlap < 0.15 && contentOverlap > 0) {
      // Check confidence delta — auto-resolve if large gap
      const confDelta = Math.abs(newItem.confidence - existing.confidence)
      if (confDelta > 0.3) {
        // Auto-resolve: higher confidence wins
        if (newItem.confidence > existing.confidence) {
          await supabase.from('knowledge_items')
            .update({ superseded_by: 'pending' }) // mark for replacement
            .eq('id', existing.id)
        }
        await supabase.from('knowledge_contradictions').insert({
          user_id: userId,
          existing_item_id: existing.id,
          new_content: newItem.content,
          new_source_type: 'conversation',
          resolution: 'auto_updated',
          resolved_at: new Date().toISOString(),
        })
      } else {
        // Log as pending for user review
        await supabase.from('knowledge_contradictions').insert({
          user_id: userId,
          existing_item_id: existing.id,
          new_content: newItem.content,
          new_source_type: 'conversation',
          resolution: 'pending',
        })
      }
    }
  }
}

function computeWordOverlap(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 3))
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 3))
  if (wordsA.size === 0 || wordsB.size === 0) return 0
  let shared = 0
  for (const w of wordsA) if (wordsB.has(w)) shared++
  return shared / Math.max(wordsA.size, wordsB.size)
}

async function upsertTopics(
  userId: string,
  items: ExtractedItem[],
): Promise<void> {
  const topicMap = new Map<string, { domain: string; count: number }>()
  for (const item of items) {
    const key = item.topic.toLowerCase()
    const existing = topicMap.get(key)
    if (existing) {
      existing.count++
    } else {
      topicMap.set(key, { domain: item.domain, count: 1 })
    }
  }

  for (const [name, { domain }] of topicMap) {
    // Upsert topic — increment item_count
    const { data: existing } = await supabase
      .from('knowledge_topics')
      .select('id, item_count')
      .eq('user_id', userId)
      .eq('name', name)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('knowledge_topics')
        .update({
          item_count: (existing as { item_count: number }).item_count + 1,
          last_updated: new Date().toISOString(),
        })
        .eq('id', (existing as { id: string }).id)
    } else {
      await supabase
        .from('knowledge_topics')
        .insert({
          user_id: userId,
          name,
          domain,
          item_count: 1,
        })
    }
  }
}

async function updateKnowledgeStats(userId: string): Promise<void> {
  const { count } = await supabase
    .from('knowledge_items')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('superseded_by', null)

  await supabase
    .from('user_memory')
    .update({
      knowledge_item_count: count || 0,
      last_knowledge_sync: new Date().toISOString(),
    })
    .eq('user_id', userId)
}
