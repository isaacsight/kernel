import { describe, it, expect } from 'vitest'
import { applyDecay, formatGraphForPrompt, findMatchingEntity, type KGEntity, type KGRelation } from './KnowledgeGraph'

function makeEntity(overrides: Partial<KGEntity> & Record<string, unknown> = {}): KGEntity & Record<string, unknown> {
  return {
    id: 'e1',
    user_id: 'u1',
    name: 'React',
    entity_type: 'concept',
    properties: {},
    confidence: 0.8,
    source: 'inferred',
    mention_count: 5,
    ...overrides,
  } as KGEntity & Record<string, unknown>
}

describe('applyDecay', () => {
  it('does not decay entity seen today', () => {
    const entity = makeEntity({ last_seen_at: new Date().toISOString() })
    const result = applyDecay([entity])
    expect(result[0].confidence).toBe(0.8)
  })

  it('decays entity 30 days old by 0.1', () => {
    const thirtyDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString()
    const entity = makeEntity({ last_seen_at: thirtyDaysAgo })
    const result = applyDecay([entity])
    expect(result[0].confidence).toBeCloseTo(0.7, 1)
  })

  it('decays entity 90 days old by 0.3', () => {
    const ninetyDaysAgo = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000).toISOString()
    const entity = makeEntity({ last_seen_at: ninetyDaysAgo, confidence: 0.8 })
    const result = applyDecay([entity])
    expect(result[0].confidence).toBeCloseTo(0.5, 1)
  })

  it('floors confidence at 0.1', () => {
    const yearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()
    const entity = makeEntity({ last_seen_at: yearAgo, confidence: 0.5 })
    const result = applyDecay([entity])
    expect(result[0].confidence).toBe(0.1)
  })

  it('passes through entity without last_seen_at unchanged', () => {
    const entity = makeEntity()
    // No last_seen_at field at all
    const result = applyDecay([entity])
    expect(result[0].confidence).toBe(0.8)
  })
})

describe('formatGraphForPrompt', () => {
  it('formats entities grouped by type with relations', () => {
    const entities: KGEntity[] = [
      makeEntity({ id: 'e1', name: 'React', entity_type: 'concept' }),
      makeEntity({ id: 'e2', name: 'kernel.chat', entity_type: 'company' }),
    ]
    const relations: KGRelation[] = [{
      id: 'r1',
      user_id: 'u1',
      source_id: 'e1',
      target_id: 'e2',
      relation_type: 'uses',
      properties: {},
      confidence: 0.8,
    }]
    const result = formatGraphForPrompt(entities, relations)
    expect(result).toContain('React')
    expect(result).toContain('concept')
    expect(result).toContain('kernel.chat')
    expect(result).toContain('company')
    expect(result).toContain('uses')
  })

  it('returns empty string for no entities', () => {
    expect(formatGraphForPrompt([], [])).toBe('')
  })
})

describe('findMatchingEntity', () => {
  const entities: KGEntity[] = [
    makeEntity({ name: 'React' }),
    makeEntity({ name: 'React Native' }),
    makeEntity({ name: 'TypeScript' }),
  ]

  it('finds exact match', () => {
    expect(findMatchingEntity('React', entities)?.name).toBe('React')
  })

  it('finds case-insensitive match', () => {
    expect(findMatchingEntity('react', entities)?.name).toBe('React')
  })

  it('finds substring match', () => {
    expect(findMatchingEntity('React', entities)?.name).toBe('React')
  })

  it('returns undefined for no match', () => {
    expect(findMatchingEntity('Vue', entities)).toBeUndefined()
  })
})
