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

    it('detects image generation via local fast-path', async () => {
      const result = await classifyIntent('draw me a cartoon monkey', '')
      expect(result.needsImageGen).toBe(true)
      expect(result.needsImageRefinement).toBe(false)
      expect(mockJson).not.toHaveBeenCalled()
    })

    it('sets needsImageRefinement on continuation after image gen', async () => {
      // First: user asks to generate an image
      const result1 = await classifyIntent('draw me a sunset over mountains', '')
      expect(result1.needsImageGen).toBe(true)
      expect(result1.needsImageRefinement).toBe(false)

      // Second: user says "make it more colorful" — continuation after image gen
      const result2 = await classifyIntent('make it more colorful', '')
      expect(result2.needsImageGen).toBe(true)
      expect(result2.needsImageRefinement).toBe(true)
    })

    it('sets needsImageRefinement on "try again" after image gen', async () => {
      await classifyIntent('generate an image of a cat', '')

      const result = await classifyIntent('try again', '')
      expect(result.needsImageGen).toBe(true)
      expect(result.needsImageRefinement).toBe(true)
    })

    it('detects knowledge queries via local fast-path', async () => {
      const result = await classifyIntent('what do I know about machine learning?', '')
      expect(result.needsKnowledgeQuery).toBe(true)
      expect(result.agentId).toBe('curator')
      expect(mockJson).not.toHaveBeenCalled()
    })

    it('detects platform engine via local fast-path', async () => {
      const result = await classifyIntent('Create a blog post about AI trends, research from my knowledge base, score it, and publish to Twitter and LinkedIn', '')
      expect(result.needsPlatformEngine).toBe(true)
      expect(result.needsContentEngine).toBe(false)
      expect(result.agentId).toBe('writer')
      expect(mockJson).not.toHaveBeenCalled()
    })

    it('detects "what should I write next" as platform engine', async () => {
      const result = await classifyIntent('what should I write next', '')
      expect(result.needsPlatformEngine).toBe(true)
      expect(mockJson).not.toHaveBeenCalled()
    })

    it('detects "create and publish" as platform engine', async () => {
      const result = await classifyIntent('create and publish a newsletter about design trends', '')
      expect(result.needsPlatformEngine).toBe(true)
      expect(mockJson).not.toHaveBeenCalled()
    })

    it('does NOT trigger platform engine for simple content requests', async () => {
      const result = await classifyIntent('write me a blog post about cooking', '')
      // This should route to content engine, not platform engine
      expect(result.needsPlatformEngine).toBe(false)
    })

    it('does NOT set needsImageRefinement on continuation after non-image classification', async () => {
      // First: normal researcher classification
      const result1 = await classifyIntent('research AI regulation', '')
      expect(result1.needsImageGen).toBe(false)

      // Continuation should NOT trigger image refinement
      const result2 = await classifyIntent('tell me more', '')
      expect(result2.needsImageRefinement).toBe(false)
      expect(result2.needsImageGen).toBe(false)
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
