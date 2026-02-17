import { describe, it, expect } from 'vitest'
import { attend } from './attention'
import type { Perception } from './types'

function makePerception(overrides: Partial<Perception> = {}): Perception {
  return {
    intent: { type: 'converse', message: 'test' },
    urgency: 0,
    complexity: 0,
    sentiment: 0,
    impliedNeed: 'test',
    keyEntities: [],
    isQuestion: false,
    isFollowUp: false,
    ...overrides,
  }
}

describe('attend', () => {
  it('returns correct AttentionState shape', () => {
    const attention = attend(makePerception(), [], [])
    expect(attention).toHaveProperty('primaryFocus')
    expect(attention).toHaveProperty('salience')
    expect(attention).toHaveProperty('distractions')
    expect(attention).toHaveProperty('depth')
  })

  it('sets depth to deep for high complexity', () => {
    const attention = attend(makePerception({ complexity: 0.8 }), [], [])
    expect(attention.depth).toBe('deep')
  })

  it('sets depth to deep for reasoning intent', () => {
    const attention = attend(
      makePerception({ intent: { type: 'reason', question: 'test', domain: 'general' } }),
      [], []
    )
    expect(attention.depth).toBe('deep')
  })

  it('sets depth to moderate for moderate complexity', () => {
    const attention = attend(makePerception({ complexity: 0.4 }), [], [])
    expect(attention.depth).toBe('moderate')
  })

  it('sets depth to surface for low complexity converse', () => {
    const attention = attend(makePerception({ complexity: 0.1 }), [], [])
    expect(attention.depth).toBe('surface')
  })

  it('extracts primary focus from discuss intent', () => {
    const attention = attend(
      makePerception({ intent: { type: 'discuss', topic: 'AI ethics' } }),
      [], []
    )
    expect(attention.primaryFocus).toBe('AI ethics')
  })

  it('builds salience from key entities', () => {
    const attention = attend(
      makePerception({ keyEntities: ['React', 'TypeScript'] }),
      [], []
    )
    expect(attention.salience['React']).toBeGreaterThan(0)
    expect(attention.salience['TypeScript']).toBeGreaterThan(0)
    expect(attention.salience['React']).toBeGreaterThan(attention.salience['TypeScript'])
  })

  it('adds distractions when too many unresolved questions', () => {
    const attention = attend(makePerception(), [], ['q1', 'q2', 'q3'])
    expect(attention.distractions.length).toBeGreaterThan(0)
  })

  it('no distractions when few unresolved questions', () => {
    const attention = attend(makePerception(), [], ['q1'])
    expect(attention.distractions.length).toBe(0)
  })
})
