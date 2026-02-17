import { describe, it, expect } from 'vitest'
import { reflect } from './reflection'
import type { Perception } from './types'
import type { Agent } from '../types'

const mockAgent: Agent = {
  id: 'kernel',
  name: 'Kernel',
  persona: 'test',
  systemPrompt: 'test',
  avatar: 'K',
  color: '#000',
}

const basePerception: Perception = {
  intent: { type: 'converse', message: 'test' },
  urgency: 0,
  complexity: 0.3,
  sentiment: 0,
  impliedNeed: 'test',
  keyEntities: [],
  isQuestion: false,
  isFollowUp: false,
}

describe('reflect', () => {
  it('returns correct Reflection shape', () => {
    const r = reflect('hello', 'Hello there! How can I help you today?', mockAgent, basePerception, 100, [])
    expect(r).toHaveProperty('quality')
    expect(r).toHaveProperty('scores')
    expect(r).toHaveProperty('lesson')
    expect(r).toHaveProperty('convictionDelta')
    expect(r.scores).toHaveProperty('substance')
    expect(r.scores).toHaveProperty('coherence')
    expect(r.scores).toHaveProperty('relevance')
    expect(r.scores).toHaveProperty('brevity')
    expect(r.scores).toHaveProperty('craft')
  })

  it('gives low substance for short/boilerplate output', () => {
    const r = reflect('hello', 'Hi', mockAgent, basePerception, 100, [])
    expect(r.scores.substance).toBeLessThan(0.5)
  })

  it('gives higher substance for detailed output with specifics', () => {
    const r = reflect(
      'hello',
      'The system processed 1,234 records because the batch size was optimized for throughput.',
      mockAgent, basePerception, 100, []
    )
    expect(r.scores.substance).toBeGreaterThan(0.5)
  })

  it('quality is between 0 and 1', () => {
    const r = reflect('test', 'Some response text here.', mockAgent, basePerception, 100, [])
    expect(r.quality).toBeGreaterThanOrEqual(0)
    expect(r.quality).toBeLessThanOrEqual(1)
  })

  it('positive conviction delta for high quality', () => {
    const r = reflect(
      'test analysis request',
      'The analysis shows 3 key patterns because the data distribution follows a Gaussian curve; the first pattern emerges from temporal clustering—specifically, 87% of events occur within a 4-hour window.',
      mockAgent,
      { ...basePerception, intent: { type: 'converse', message: 'test analysis request' } },
      100,
      [{ id: '1', agentId: 'human', agentName: 'User', content: 'test analysis request', timestamp: new Date() }]
    )
    // High quality responses should have positive or zero delta
    expect(r.convictionDelta).toBeGreaterThanOrEqual(0)
  })

  it('generates lesson string', () => {
    const r = reflect('test', 'Some response.', mockAgent, basePerception, 100, [])
    expect(typeof r.lesson).toBe('string')
    expect(r.lesson.length).toBeGreaterThan(0)
  })

  it('truncates output to 300 chars', () => {
    const longOutput = 'a'.repeat(500)
    const r = reflect('test', longOutput, mockAgent, basePerception, 100, [])
    expect(r.output.length).toBeLessThanOrEqual(300)
  })
})
