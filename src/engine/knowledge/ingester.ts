// Knowledge Engine — Ingestion pipeline
// Extracts structured knowledge items from text using LLM, deduplicates against existing items.

import { getProvider } from '../providers/registry'
import type { ExtractedItem, KnowledgeItem, KnowledgeSource, KnowledgeDomain, KnowledgeItemType } from './types'

// ─── Extraction ─────────────────────────────────────────────

const EXTRACT_SYSTEM = `You are a knowledge extraction agent. Analyze the provided content and extract discrete knowledge items — facts, concepts, opinions, procedures, events, preferences, and references.

Rules:
- Extract at most 8 items per call
- Each item must be a self-contained statement (understandable without surrounding context)
- Focus on durable, referenceable knowledge — skip greetings, filler, and transient chat
- Never extract crisis-related content (self-harm, violence, abuse)
- Assign confidence: 0.3 = weak inference, 0.5 = reasonable guess, 0.7 = clearly stated, 0.9 = explicitly confirmed
- Classify domain: tech, personal, work, creative, finance, health, or general
- Classify type: fact (verifiable), concept (abstract idea), opinion (subjective), procedure (how-to), event (happened/happening), preference (user likes/dislikes), reference (source/link)
- Extract 2-5 keywords per item
- Summary should be 1-2 sentences max

Respond with ONLY valid JSON:
{"items": [{"content": "Full knowledge statement", "summary": "1-2 sentence summary", "topic": "Main topic", "subtopic": "Subtopic or null", "domain": "tech", "item_type": "fact", "confidence": 0.7, "keywords": ["keyword1", "keyword2"]}]}`

interface ExtractionResponse {
  items: ExtractedItem[]
}

/**
 * Extract knowledge items from text content using LLM.
 */
export async function extractKnowledgeItems(
  content: string,
  source: KnowledgeSource,
): Promise<ExtractedItem[]> {
  if (!content.trim() || content.length < 50) return []

  try {
    const sourceCtx = source.title ? `\nSource: ${source.title} (${source.type})` : ''
    const result = await getProvider().json<ExtractionResponse>(
      `Extract knowledge items from this content:${sourceCtx}\n\n${content}`,
      { system: EXTRACT_SYSTEM, tier: 'fast', max_tokens: 1500 }
    )

    return (result.items || [])
      .filter(item => item.content && item.topic && item.content.length >= 10)
      .map(item => ({
        content: item.content,
        summary: item.summary || item.content.slice(0, 150),
        topic: item.topic,
        subtopic: item.subtopic || undefined,
        domain: validateDomain(item.domain),
        item_type: validateItemType(item.item_type),
        confidence: Math.min(1, Math.max(0, item.confidence || 0.5)),
        keywords: (item.keywords || []).slice(0, 5),
        knowledge_date: item.knowledge_date,
        expires_at: item.expires_at,
      }))
  } catch (err) {
    console.warn('[KnowledgeEngine] Extraction failed:', err)
    return []
  }
}

// ─── Deduplication ──────────────────────────────────────────

/**
 * Deduplicate new items against existing items.
 * Items with >0.8 topic+keyword overlap are considered duplicates —
 * we increment mention_count + boost confidence instead of inserting.
 */
export function deduplicateAndMerge(
  newItems: ExtractedItem[],
  existingItems: Pick<KnowledgeItem, 'id' | 'topic' | 'keywords' | 'content' | 'mention_count' | 'confidence'>[],
): { toInsert: ExtractedItem[]; toUpdate: { id: string; mention_count: number; confidence: number }[] } {
  const toInsert: ExtractedItem[] = []
  const toUpdate: { id: string; mention_count: number; confidence: number }[] = []

  for (const newItem of newItems) {
    let bestMatch: typeof existingItems[0] | null = null
    let bestScore = 0

    for (const existing of existingItems) {
      const score = computeSimilarity(newItem, existing)
      if (score > bestScore) {
        bestScore = score
        bestMatch = existing
      }
    }

    if (bestScore > 0.8 && bestMatch) {
      // Duplicate — boost existing
      toUpdate.push({
        id: bestMatch.id,
        mention_count: bestMatch.mention_count + 1,
        confidence: Math.min(1, bestMatch.confidence + 0.05),
      })
    } else {
      toInsert.push(newItem)
    }
  }

  return { toInsert, toUpdate }
}

function computeSimilarity(
  newItem: ExtractedItem,
  existing: Pick<KnowledgeItem, 'topic' | 'keywords' | 'content'>,
): number {
  // Topic match (40% weight)
  const topicMatch = newItem.topic.toLowerCase() === (existing.topic || '').toLowerCase() ? 1 : 0

  // Keyword overlap (30% weight)
  const newKw = new Set(newItem.keywords.map(k => k.toLowerCase()))
  const existKw = new Set(existing.keywords.map(k => k.toLowerCase()))
  let kwOverlap = 0
  if (newKw.size > 0 && existKw.size > 0) {
    let shared = 0
    for (const k of newKw) if (existKw.has(k)) shared++
    kwOverlap = shared / Math.max(newKw.size, existKw.size)
  }

  // Content word overlap (30% weight)
  const newWords = new Set(newItem.content.toLowerCase().split(/\s+/).filter(w => w.length > 3))
  const existWords = new Set(existing.content.toLowerCase().split(/\s+/).filter(w => w.length > 3))
  let contentOverlap = 0
  if (newWords.size > 0 && existWords.size > 0) {
    let shared = 0
    for (const w of newWords) if (existWords.has(w)) shared++
    contentOverlap = shared / Math.max(newWords.size, existWords.size)
  }

  return topicMatch * 0.4 + kwOverlap * 0.3 + contentOverlap * 0.3
}

// ─── Validators ─────────────────────────────────────────────

const VALID_DOMAINS: KnowledgeDomain[] = ['tech', 'personal', 'work', 'creative', 'finance', 'health', 'general']
const VALID_ITEM_TYPES: KnowledgeItemType[] = ['fact', 'concept', 'opinion', 'procedure', 'event', 'preference', 'reference']

function validateDomain(d: string): KnowledgeDomain {
  return VALID_DOMAINS.includes(d as KnowledgeDomain) ? d as KnowledgeDomain : 'general'
}

function validateItemType(t: string): KnowledgeItemType {
  return VALID_ITEM_TYPES.includes(t as KnowledgeItemType) ? t as KnowledgeItemType : 'fact'
}
