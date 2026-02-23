import { describe, it, expect } from 'vitest'
import { computeEvolutionScore, scoreToTier, classifyTopic } from './useEntityEvolution'
import type { KGEntity } from '../engine/KnowledgeGraph'
import type { UserMemoryProfile } from '../engine/MemoryAgent'

// ─── Score Computation ──────────────────────────────────────

describe('computeEvolutionScore', () => {
  it('returns 0 for a brand-new user', () => {
    expect(computeEvolutionScore(0, 0, 0, 0, 0)).toBe(0)
  })

  it('returns a low score for a few conversations', () => {
    const score = computeEvolutionScore(3, 0, 0, 0, 0)
    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThan(15) // should still be Tier 0 (Seed)
  })

  it('reaches Tier 1 (Sprout) with ~5-10 conversations and a few KG entities', () => {
    const score = computeEvolutionScore(8, 5, 2, 0, 0)
    expect(score).toBeGreaterThanOrEqual(15)
    expect(score).toBeLessThan(35)
  })

  it('reaches Tier 2 (Awake) with ~25 conversations, 25 KG entities, 1 goal', () => {
    const score = computeEvolutionScore(25, 25, 10, 1, 2)
    expect(score).toBeGreaterThanOrEqual(35)
    expect(score).toBeLessThan(60)
  })

  it('reaches Tier 3 (Ascendant) with ~50 conversations, 60 KG, 2 goals', () => {
    const score = computeEvolutionScore(50, 60, 20, 2, 3)
    expect(score).toBeGreaterThanOrEqual(60)
    expect(score).toBeLessThan(85)
  })

  it('reaches Tier 4 (Sovereign) with heavy usage', () => {
    const score = computeEvolutionScore(150, 200, 50, 5, 10)
    expect(score).toBeGreaterThanOrEqual(85)
  })

  it('caps at 100', () => {
    const score = computeEvolutionScore(10000, 10000, 10000, 100, 1000)
    expect(score).toBeLessThanOrEqual(100)
  })
})

// ─── Score to Tier ──────────────────────────────────────────

describe('scoreToTier', () => {
  it('maps 0 to Tier 0', () => expect(scoreToTier(0)).toBe(0))
  it('maps 14 to Tier 0', () => expect(scoreToTier(14)).toBe(0))
  it('maps 15 to Tier 1', () => expect(scoreToTier(15)).toBe(1))
  it('maps 34 to Tier 1', () => expect(scoreToTier(34)).toBe(1))
  it('maps 35 to Tier 2', () => expect(scoreToTier(35)).toBe(2))
  it('maps 59 to Tier 2', () => expect(scoreToTier(59)).toBe(2))
  it('maps 60 to Tier 3', () => expect(scoreToTier(60)).toBe(3))
  it('maps 84 to Tier 3', () => expect(scoreToTier(84)).toBe(3))
  it('maps 85 to Tier 4', () => expect(scoreToTier(85)).toBe(4))
  it('maps 100 to Tier 4', () => expect(scoreToTier(100)).toBe(4))
})

// ─── Topic Classification ───────────────────────────────────

function makeKGEntity(name: string, mentionCount = 1): KGEntity {
  return {
    user_id: 'test',
    name,
    entity_type: 'concept',
    properties: {},
    confidence: 0.8,
    source: 'inferred',
    mention_count: mentionCount,
  }
}

describe('classifyTopic', () => {
  it('defaults to personal with no data', () => {
    expect(classifyTopic([], null)).toBe('personal')
  })

  it('classifies tech from KG entities', () => {
    const entities = [
      makeKGEntity('React', 5),
      makeKGEntity('TypeScript', 3),
      makeKGEntity('Docker', 2),
    ]
    expect(classifyTopic(entities, null)).toBe('tech')
  })

  it('classifies creative from interests', () => {
    const memory: UserMemoryProfile = {
      interests: ['creative writing', 'illustration', 'music composition'],
      communication_style: 'casual',
      goals: [],
      facts: [],
      preferences: [],
    }
    expect(classifyTopic([], memory)).toBe('creative')
  })

  it('classifies science from mixed signals', () => {
    const entities = [
      makeKGEntity('Physics research', 3),
      makeKGEntity('Data analysis', 2),
    ]
    const memory: UserMemoryProfile = {
      interests: ['machine learning', 'neuroscience'],
      communication_style: '',
      goals: [],
      facts: [],
      preferences: [],
    }
    expect(classifyTopic(entities, memory)).toBe('science')
  })

  it('classifies business from KG entities', () => {
    const entities = [
      makeKGEntity('Startup strategy', 4),
      makeKGEntity('Market analysis', 3),
      makeKGEntity('Revenue growth', 2),
    ]
    expect(classifyTopic(entities, null)).toBe('business')
  })

  it('classifies learning from interests', () => {
    const memory: UserMemoryProfile = {
      interests: ['online courses', 'language learning', 'study techniques'],
      communication_style: '',
      goals: [],
      facts: [],
      preferences: [],
    }
    expect(classifyTopic([], memory)).toBe('learning')
  })

  it('weights mention_count in KG entities', () => {
    const entities = [
      makeKGEntity('React', 1),       // tech
      makeKGEntity('Writing', 10),     // creative — higher mentions
    ]
    expect(classifyTopic(entities, null)).toBe('creative')
  })
})
