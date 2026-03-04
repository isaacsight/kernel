// ═══════════════════════════════════════════════════════════════
//  IdentityGraph — Deep identity entity extraction & modeling
// ═══════════════════════════════════════════════════════════════
//
//  Extracts and maintains identity-level entities that define
//  who a person is: values, beliefs, traits, roles, aspirations.
//
//  These are slower-moving than knowledge graph entities —
//  they use a 180-day decay half-life (6x slower than KG).
//  Only extracted at growing+ relationship stage.
//
// ═══════════════════════════════════════════════════════════════

import { getBackgroundProvider } from './providers/registry'

// ── Types ─────────────────────────────────────────────────

export type IdentityEntityType = 'value' | 'belief' | 'trait' | 'role' | 'aspiration'

export interface IdentityEntity {
  id: string
  type: IdentityEntityType
  label: string
  evidence: string              // quote or observation that supports this
  confidence: number            // 0-1
  firstSeen: number
  lastReinforced: number
  reinforcementCount: number
}

// ── Constants ─────────────────────────────────────────────

const DECAY_HALF_LIFE_MS = 180 * 86_400_000  // 180 days
const MAX_ENTITIES = 30
const EXTRACTION_SYSTEM = `You are the Kernel's identity lens. You extract deep identity signals — not what someone knows, but who they ARE.

Entity types:
- value: What they prioritize. "Values transparency", "Prioritizes autonomy", "Cares about craft"
- belief: What they believe. "Believes AI should be personal", "Thinks simplicity beats cleverness"
- trait: How they operate. "Detail-oriented", "Builds before theorizing", "Prefers depth over breadth"
- role: How they identify. "Founder", "Parent", "Engineer", "Teacher"
- aspiration: What they're reaching for. "Build the best personal AI", "Write a novel", "Financial independence"

Rules:
- Only extract what is clearly evidenced in the conversation
- 1-4 entities per extraction. Quality over quantity
- Labels should be concise (2-6 words)
- Include the specific evidence that supports each entity
- Confidence 0.5-1.0 based on how explicit the signal is

Respond with ONLY valid JSON:
{"entities": [{"type": "value", "label": "...", "evidence": "...", "confidence": 0.8}]}`

// ── Extraction ────────────────────────────────────────────

export async function extractIdentityEntities(
  messages: { role: string; content: string }[],
  existingEntities: IdentityEntity[],
): Promise<IdentityEntity[]> {
  try {
    const conversation = messages
      .slice(-12)
      .map(m => `${m.role === 'user' ? 'User' : 'Kernel'}: ${m.content.slice(0, 500)}`)
      .join('\n\n')

    const existingContext = existingEntities.length > 0
      ? `\n\nExisting identity entities (reinforce if confirmed, don't duplicate):\n${existingEntities.map(e => `- [${e.type}] ${e.label}`).join('\n')}`
      : ''

    const result = await getBackgroundProvider().json<{
      entities: { type: IdentityEntityType; label: string; evidence: string; confidence: number }[]
    }>(
      `${conversation}${existingContext}`,
      { system: EXTRACTION_SYSTEM, tier: 'fast', max_tokens: 500, feature: 'identity' },
    )

    const now = Date.now()
    const extracted = (result.entities || []).slice(0, 4)

    return mergeIdentityEntities(existingEntities, extracted.map(e => ({
      id: `id_${now}_${Math.random().toString(36).slice(2, 6)}`,
      type: e.type,
      label: e.label.slice(0, 60),
      evidence: (e.evidence || '').slice(0, 200),
      confidence: Math.min(1, Math.max(0, e.confidence || 0.6)),
      firstSeen: now,
      lastReinforced: now,
      reinforcementCount: 1,
    })))
  } catch (err) {
    console.warn('[IdentityGraph] Extraction failed:', err)
    return existingEntities
  }
}

// ── Merge & Dedup ─────────────────────────────────────────

function mergeIdentityEntities(
  existing: IdentityEntity[],
  incoming: IdentityEntity[],
): IdentityEntity[] {
  const merged = [...existing]

  for (const newEntity of incoming) {
    const match = merged.findIndex(e =>
      e.type === newEntity.type &&
      e.label.toLowerCase().trim() === newEntity.label.toLowerCase().trim()
    )

    if (match >= 0) {
      // Reinforce existing entity
      merged[match] = {
        ...merged[match],
        lastReinforced: Date.now(),
        reinforcementCount: merged[match].reinforcementCount + 1,
        confidence: Math.min(1, merged[match].confidence + 0.1),
        evidence: newEntity.evidence || merged[match].evidence,
      }
    } else {
      merged.push(newEntity)
    }
  }

  return merged.slice(-MAX_ENTITIES)
}

// ── Decay ─────────────────────────────────────────────────

/** Apply 180-day half-life decay. Remove entities below threshold. */
export function applyIdentityDecay(entities: IdentityEntity[]): IdentityEntity[] {
  const now = Date.now()

  return entities
    .map(e => {
      const elapsed = now - e.lastReinforced
      const decayFactor = Math.pow(0.5, elapsed / DECAY_HALF_LIFE_MS)
      return {
        ...e,
        confidence: e.confidence * decayFactor,
      }
    })
    .filter(e => e.confidence >= 0.15) // prune very faded entities
}

// ── Prompt Formatting ─────────────────────────────────────

export function formatIdentityForPrompt(entities: IdentityEntity[]): string {
  if (!entities || entities.length === 0) return ''

  const grouped: Partial<Record<IdentityEntityType, IdentityEntity[]>> = {}
  for (const e of entities) {
    if (!grouped[e.type]) grouped[e.type] = []
    grouped[e.type]!.push(e)
  }

  const typeLabels: Record<IdentityEntityType, string> = {
    value: 'Values',
    belief: 'Beliefs',
    trait: 'Traits',
    role: 'Roles',
    aspiration: 'Aspirations',
  }

  const parts: string[] = []
  for (const [type, entities] of Object.entries(grouped)) {
    const label = typeLabels[type as IdentityEntityType] || type
    const items = (entities as IdentityEntity[])
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5)
      .map(e => `- ${e.label}${e.reinforcementCount > 2 ? ' (strong)' : ''}`)
    parts.push(`**${label}:** ${items.join(', ').replace(/^- /g, '')}`)
  }

  return parts.join('\n')
}

// ── Serialization ─────────────────────────────────────────

export function serializeIdentityGraph(entities: IdentityEntity[]): unknown[] {
  return entities
}

export function deserializeIdentityGraph(data: unknown): IdentityEntity[] {
  if (!Array.isArray(data)) return []
  return data.filter(e =>
    e && typeof e === 'object' && 'type' in e && 'label' in e
  ) as IdentityEntity[]
}
