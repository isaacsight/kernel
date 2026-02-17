import { describe, it, expect, vi, beforeEach } from 'vitest'
import { reflect, reflectWithAI } from './reflection'
import type { Perception } from './types'
import type { Agent } from '../types'

const mockJson = vi.fn()
const mockProvider = {
  name: 'mock',
  json: mockJson,
  text: vi.fn(),
  stream: vi.fn(),
  streamChat: vi.fn(),
}

vi.mock('./providers/registry', () => ({
  getProvider: () => mockProvider,
}))

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

describe('reflectWithAI', () => {
  const complexPerception: Perception = {
    intent: { type: 'reason', question: 'complex analysis', domain: 'technical' },
    urgency: 0,
    complexity: 0.8,
    sentiment: 0,
    impliedNeed: 'Deep analysis',
    keyEntities: [],
    isQuestion: true,
    isFollowUp: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('falls back to heuristic for low complexity', async () => {
    const lowComplexity = { ...basePerception, complexity: 0.3 }
    const r = await reflectWithAI('test', 'Some response.', mockAgent, lowComplexity, 100, [])
    // Should not call provider for low complexity
    expect(r).toHaveProperty('quality')
    expect(r).toHaveProperty('scores')
  })

  it('blends AI scores with heuristic for high complexity', async () => {
    mockJson.mockResolvedValue({
      substance: 0.9,
      coherence: 0.9,
      relevance: 0.9,
      brevity: 0.9,
      craft: 0.9,
    })

    const r = await reflectWithAI(
      'complex analysis request',
      'The analysis shows 3 key patterns because the data follows a Gaussian curve; specifically, 87% of events occur within 4 hours.',
      mockAgent,
      complexPerception,
      100,
      []
    )

    // AI scores (0.9) blended 60% with heuristic should push scores higher
    expect(r.scores.substance).toBeGreaterThan(0.5)
    expect(mockJson).toHaveBeenCalledOnce()
  })

  it('falls back to heuristic on provider failure', async () => {
    mockJson.mockRejectedValue(new Error('API error'))

    const r = await reflectWithAI('test', 'Response text.', mockAgent, complexPerception, 100, [])

    // Should still return a valid reflection
    expect(r).toHaveProperty('quality')
    expect(r.quality).toBeGreaterThanOrEqual(0)
    expect(r.quality).toBeLessThanOrEqual(1)
  })

  it('falls back to heuristic on invalid AI scores', async () => {
    mockJson.mockResolvedValue({
      substance: 'not a number',
      coherence: 0.8,
      relevance: 0.8,
      brevity: 0.8,
      craft: 0.8,
    })

    const heuristic = reflect('test', 'Response text.', mockAgent, complexPerception, 100, [])
    const r = await reflectWithAI('test', 'Response text.', mockAgent, complexPerception, 100, [])

    expect(r.quality).toBe(heuristic.quality)
  })

  it('blended score is weighted 60/40 AI/heuristic', async () => {
    mockJson.mockResolvedValue({
      substance: 1.0,
      coherence: 1.0,
      relevance: 1.0,
      brevity: 1.0,
      craft: 1.0,
    })

    const heuristic = reflect('complex test', 'Some response.', mockAgent, complexPerception, 100, [])
    const r = await reflectWithAI('complex test', 'Some response.', mockAgent, complexPerception, 100, [])

    // Each blended score = 1.0 * 0.6 + heuristic * 0.4
    const expectedSubstance = 1.0 * 0.6 + heuristic.scores.substance * 0.4
    expect(r.scores.substance).toBeCloseTo(expectedSubstance, 5)
  })
})
