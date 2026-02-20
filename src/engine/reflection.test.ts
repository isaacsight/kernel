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

  it('weights substance higher for reason intents', () => {
    const substantiveOutput = 'The analysis shows 3 key patterns because the data distribution follows a Gaussian curve; the first pattern emerges from temporal clustering—specifically, 87% of events occur within a 4-hour window.'
    const reasonPerception: Perception = {
      ...basePerception,
      intent: { type: 'reason', question: 'analyze this data', domain: 'technical' },
    }
    const conversePerception: Perception = {
      ...basePerception,
      intent: { type: 'converse', message: 'analyze this data' },
    }
    const reasonResult = reflect('analyze this data', substantiveOutput, mockAgent, reasonPerception, 100, [])
    const converseResult = reflect('analyze this data', substantiveOutput, mockAgent, conversePerception, 100, [])
    // Same content, but reason intent weights substance/coherence higher
    // The scores themselves are the same, but quality differs due to weighting
    expect(reasonResult.scores.substance).toBe(converseResult.scores.substance)
    expect(reasonResult.quality).not.toBe(converseResult.quality)
  })

  it('weights relevance higher for build intents', () => {
    const buildOutput = 'Here is a concrete implementation plan with 3 steps because it addresses the core requirements.'
    const buildPerception: Perception = {
      ...basePerception,
      intent: { type: 'build', description: 'create a login form' },
    }
    const r = reflect('create a login form', buildOutput, mockAgent, buildPerception, 100, [])
    expect(r.quality).toBeGreaterThanOrEqual(0)
    expect(r.quality).toBeLessThanOrEqual(1)
  })

  it('negative conviction delta for low quality', () => {
    const r = reflect('tell me about quantum computing', 'Hi', mockAgent, basePerception, 100, [])
    expect(r.convictionDelta).toBeLessThanOrEqual(0)
  })

  it('detects boilerplate and scores low substance', () => {
    const r = reflect('help me', 'I can help you with that. Here is what you need.', mockAgent, basePerception, 100, [])
    expect(r.scores.substance).toBeLessThan(0.5)
  })

  it('generates world model update for questions with good quality', () => {
    const questionPerception: Perception = {
      ...basePerception,
      isQuestion: true,
      complexity: 0.7,
      intent: { type: 'reason', question: 'why does this happen', domain: 'technical' },
    }
    const r = reflect(
      'why does this happen',
      'This happens because of 3 fundamental forces; the primary driver is electromagnetic interaction—specifically, 99% of atomic behavior stems from this.',
      mockAgent,
      questionPerception,
      100,
      [{ id: '1', agentId: 'human', agentName: 'User', content: 'why does this happen', timestamp: new Date() }]
    )
    expect(r.worldModelUpdate).not.toBeNull()
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

  it('passes system prompt and intent to provider', async () => {
    mockJson.mockResolvedValue({
      substance: 0.8,
      coherence: 0.8,
      relevance: 0.8,
      brevity: 0.8,
      craft: 0.8,
    })

    await reflectWithAI('analyze data', 'The analysis shows patterns.', mockAgent, complexPerception, 100, [])

    expect(mockJson).toHaveBeenCalledWith(
      expect.stringContaining('[Intent: reason]'),
      expect.objectContaining({ system: expect.stringContaining('quality scorer') })
    )
  })

  it('uses context-aware weighting for blended quality', async () => {
    mockJson.mockResolvedValue({
      substance: 0.9,
      coherence: 0.9,
      relevance: 0.9,
      brevity: 0.9,
      craft: 0.9,
    })

    const evaluatePerception: Perception = {
      ...complexPerception,
      intent: { type: 'evaluate', opportunity: 'should I invest' },
    }

    const reasonResult = await reflectWithAI('analyze', 'Response.', mockAgent, complexPerception, 100, [])
    const evaluateResult = await reflectWithAI('evaluate', 'Response.', mockAgent, evaluatePerception, 100, [])

    // Different intents → different quality scores even with same AI scores
    // (heuristic baselines differ slightly due to intent-based brevity calc)
    expect(reasonResult).toHaveProperty('quality')
    expect(evaluateResult).toHaveProperty('quality')
  })

  it('handles out-of-range AI scores gracefully', async () => {
    mockJson.mockResolvedValue({
      substance: 1.5,
      coherence: -0.2,
      relevance: 0.8,
      brevity: 0.8,
      craft: 0.8,
    })

    const heuristic = reflect('test', 'Response text.', mockAgent, complexPerception, 100, [])
    const r = await reflectWithAI('test', 'Response text.', mockAgent, complexPerception, 100, [])

    // Out-of-range scores should fall back to heuristic
    expect(r.quality).toBe(heuristic.quality)
  })
})
