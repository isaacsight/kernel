// ─── Knowledge Graph Memory ─────────────────────────────────
//
// Extracts structured entities and relationships from conversations.
// Runs alongside MemoryAgent — MemoryAgent handles style/preferences,
// KG handles entities/relationships ("Isaac works at Antigravity").

import { getProvider } from './providers/registry'
import type { Message } from '../types'

// ─── Types ──────────────────────────────────────────────────

export interface KGEntity {
  id?: string
  user_id: string
  name: string
  entity_type: 'person' | 'company' | 'project' | 'concept' | 'preference' | 'location'
  properties: Record<string, unknown>
  confidence: number
  source: 'inferred' | 'stated' | 'observed'
  mention_count: number
}

export interface KGRelation {
  id?: string
  user_id: string
  source_id: string
  target_id: string
  relation_type: 'works_at' | 'uses' | 'prefers' | 'knows' | 'owns' | 'related_to' | 'interested_in' | 'building'
  properties: Record<string, unknown>
  confidence: number
}

interface ExtractionResult {
  entities: { name: string; type: KGEntity['entity_type']; confidence: number }[]
  relations: { source: string; target: string; type: KGRelation['relation_type']; confidence: number }[]
}

// ─── Extraction ─────────────────────────────────────────────

const EXTRACT_SYSTEM = `You are a knowledge graph extraction agent. Analyze the conversation and extract entities (people, companies, projects, concepts, locations) and relationships between them.

Rules:
- Only extract entities you're confident about from the conversation
- Entity names should be normalized (proper case, full names when known)
- Relations connect two entities by name
- Confidence: 0.3 = weak inference, 0.5 = reasonable, 0.8 = explicitly stated
- Focus on durable facts, not transient conversation topics

Respond with ONLY valid JSON:
{"entities": [{"name": "EntityName", "type": "person|company|project|concept|preference|location", "confidence": 0.5}], "relations": [{"source": "Entity1", "target": "Entity2", "type": "works_at|uses|prefers|knows|owns|related_to|interested_in|building", "confidence": 0.5}]}`

export async function extractEntities(
  messages: Message[],
  existingEntityNames: string[],
): Promise<ExtractionResult> {
  try {
    const conversation = messages
      .slice(-10)
      .map(m => `${m.agentId === 'human' ? 'User' : m.agentName}: ${m.content}`)
      .join('\n\n')

    const existingCtx = existingEntityNames.length > 0
      ? `\n\nAlready known entities: ${existingEntityNames.join(', ')}`
      : ''

    const result = await getProvider().json<ExtractionResult>(
      `Extract entities and relationships from this conversation:${existingCtx}\n\n${conversation}`,
      { system: EXTRACT_SYSTEM, tier: 'fast', max_tokens: 500 }
    )

    return {
      entities: (result.entities || []).filter(e => e.name && e.type),
      relations: (result.relations || []).filter(r => r.source && r.target && r.type),
    }
  } catch (err) {
    console.warn('[KnowledgeGraph] Extraction failed:', err)
    return { entities: [], relations: [] }
  }
}

// ─── Query ──────────────────────────────────────────────────

export function formatGraphForPrompt(
  entities: KGEntity[],
  relations: KGRelation[],
): string {
  if (entities.length === 0) return ''

  const entityMap = new Map(entities.map(e => [e.id, e]))
  const lines: string[] = []

  // Group entities by type
  const byType = new Map<string, KGEntity[]>()
  for (const e of entities) {
    const group = byType.get(e.entity_type) || []
    group.push(e)
    byType.set(e.entity_type, group)
  }

  for (const [type, ents] of byType) {
    lines.push(`**${type}s:** ${ents.map(e => e.name).join(', ')}`)
  }

  // Format relationships
  if (relations.length > 0) {
    const relLines = relations.map(r => {
      const src = entityMap.get(r.source_id)?.name || '?'
      const tgt = entityMap.get(r.target_id)?.name || '?'
      return `${src} → ${r.relation_type} → ${tgt}`
    })
    lines.push(`**Connections:** ${relLines.join('; ')}`)
  }

  return lines.join('\n')
}

// ─── Fuzzy Matching ─────────────────────────────────────────

export function findMatchingEntity(
  name: string,
  existing: KGEntity[],
): KGEntity | undefined {
  const lower = name.toLowerCase().trim()
  return existing.find(e => {
    const eLower = e.name.toLowerCase().trim()
    return eLower === lower || eLower.includes(lower) || lower.includes(eLower)
  })
}

// ─── Supabase CRUD (called from SupabaseClient) ────────────

export async function mergeExtraction(
  userId: string,
  extraction: ExtractionResult,
  existingEntities: KGEntity[],
  upsertEntity: (entity: Omit<KGEntity, 'id'> & { id?: string }) => Promise<KGEntity | null>,
  upsertRelation: (relation: Omit<KGRelation, 'id'>) => Promise<KGRelation | null>,
): Promise<void> {
  const entityIdMap = new Map<string, string>() // name → id

  // Index existing entities by name
  for (const e of existingEntities) {
    entityIdMap.set(e.name.toLowerCase(), e.id!)
  }

  // Upsert entities
  for (const extracted of extraction.entities) {
    const match = findMatchingEntity(extracted.name, existingEntities)

    if (match) {
      // Update existing — bump mention count and confidence
      const updated = await upsertEntity({
        ...match,
        mention_count: match.mention_count + 1,
        confidence: Math.min(1, Math.max(match.confidence, extracted.confidence)),
      })
      if (updated) entityIdMap.set(extracted.name.toLowerCase(), updated.id!)
    } else {
      // Create new
      const created = await upsertEntity({
        user_id: userId,
        name: extracted.name,
        entity_type: extracted.type,
        properties: {},
        confidence: extracted.confidence,
        source: 'inferred',
        mention_count: 1,
      })
      if (created) entityIdMap.set(extracted.name.toLowerCase(), created.id!)
    }
  }

  // Upsert relations
  for (const rel of extraction.relations) {
    const sourceId = entityIdMap.get(rel.source.toLowerCase())
    const targetId = entityIdMap.get(rel.target.toLowerCase())

    if (sourceId && targetId) {
      await upsertRelation({
        user_id: userId,
        source_id: sourceId,
        target_id: targetId,
        relation_type: rel.type,
        properties: {},
        confidence: rel.confidence,
      })
    }
  }
}
