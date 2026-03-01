import { describe, it, expect, vi, beforeEach } from 'vitest'

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
  getBackgroundProvider: () => mockProvider,
}))

import { classifyIntent, buildRecentContext, _resetClassificationCache } from './AgentRouter'

describe('AgentRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _resetClassificationCache()
  })

  describe('classifyIntent', () => {
    it('routes to correct agent from provider response', async () => {
      mockJson.mockResolvedValue({
        agentId: 'coder',
        confidence: 0.9,
        needsResearch: false,
        isMultiStep: false,
        needsSwarm: false,
      })

      // "write a function" — 'function' is a coder keyword but only 1 hit, falls to Groq
      const result = await classifyIntent('write a function', '')
      expect(result.agentId).toBe('coder')
      expect(result.confidence).toBe(0.9) // from Groq mock
    })

    it('falls back to kernel on invalid agentId via Groq', async () => {
      mockJson.mockResolvedValue({
        agentId: 'nonexistent',
        confidence: 0.8,
        needsResearch: false,
        isMultiStep: false,
        needsSwarm: false,
      })

      const result = await classifyIntent('do something completely ambiguous for me please', '')
      expect(result.agentId).toBe('kernel')
      expect(result.confidence).toBe(0)
    })

    it('falls back to kernel when Groq confidence < 0.3', async () => {
      mockJson.mockResolvedValue({
        agentId: 'analyst',
        confidence: 0.2,
        needsResearch: true,
        isMultiStep: false,
        needsSwarm: false,
      })

      const result = await classifyIntent('I have a vague question about something', '')
      expect(result.agentId).toBe('kernel')
      expect(result.needsResearch).toBe(false)
    })

    it('clamps confidence to [0, 1]', async () => {
      mockJson.mockResolvedValue({
        agentId: 'analyst',
        confidence: 1.5,
        needsResearch: false,
        isMultiStep: false,
        needsSwarm: false,
      })

      const result = await classifyIntent('give me your thoughts on this situation', '')
      expect(result.confidence).toBe(1)
    })

    it('falls back to kernel on provider error', async () => {
      mockJson.mockRejectedValue(new Error('Network error'))

      // No cached classification (reset in beforeEach), so should fall back to kernel
      const result = await classifyIntent('do something completely unknown', '')
      expect(result.agentId).toBe('kernel')
    })

    it('routes researcher via local fast-path', async () => {
      const result = await classifyIntent('research AI regulation', '')
      expect(result.agentId).toBe('researcher')
      expect(result.needsResearch).toBe(true)
      expect(mockJson).not.toHaveBeenCalled()
    })

    it('routes writer via local fast-path', async () => {
      const result = await classifyIntent('write a blog post', '')
      expect(result.agentId).toBe('writer')
      expect(mockJson).not.toHaveBeenCalled()
    })

    it('routes kernel via local fast-path for greetings', async () => {
      const result = await classifyIntent('hello', '')
      expect(result.agentId).toBe('kernel')
      expect(result.confidence).toBe(0.85)
      expect(mockJson).not.toHaveBeenCalled()
    })

    it('detects multi-step and swarm needs via Groq', async () => {
      mockJson.mockResolvedValue({
        agentId: 'analyst',
        confidence: 0.9,
        needsResearch: true,
        isMultiStep: true,
        needsSwarm: true,
      })

      const result = await classifyIntent('I need you to investigate the feasibility, then plan, and finally deliver a comprehensive report', '')
      expect(result.isMultiStep).toBe(true)
      expect(result.needsSwarm).toBe(true)
      expect(result.needsResearch).toBe(true)
    })

    it('uses continuation fast-path for short follow-ups', async () => {
      // First, establish a classification
      const result1 = await classifyIntent('tell me about quantum computing', '')
      expect(result1.agentId).toBe('researcher')

      // Short follow-up should reuse previous classification
      const result2 = await classifyIntent('tell me more', '')
      expect(result2.agentId).toBe('researcher')
    })
  })

  describe('buildRecentContext', () => {
    it('formats messages correctly', () => {
      const messages = [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi there' },
      ]
      const ctx = buildRecentContext(messages)
      expect(ctx).toContain('User: hello')
      expect(ctx).toContain('Kernel: hi there')
    })

    it('limits to specified count', () => {
      const messages = [
        { role: 'user', content: 'msg 1' },
        { role: 'assistant', content: 'msg 2' },
        { role: 'user', content: 'msg 3' },
        { role: 'assistant', content: 'msg 4' },
      ]
      const ctx = buildRecentContext(messages, 2)
      expect(ctx).not.toContain('msg 1')
      expect(ctx).not.toContain('msg 2')
      expect(ctx).toContain('msg 3')
      expect(ctx).toContain('msg 4')
    })

    it('truncates long messages to 150 chars', () => {
      const longMsg = 'a'.repeat(200)
      const messages = [{ role: 'user', content: longMsg }]
      const ctx = buildRecentContext(messages)
      expect(ctx.length).toBeLessThan(200)
    })

    it('returns empty string for empty input', () => {
      expect(buildRecentContext([])).toBe('')
    })
  })
})
