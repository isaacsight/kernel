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
}))

import { classifyIntent, buildRecentContext } from './AgentRouter'

describe('AgentRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

      const result = await classifyIntent('write a function', '')
      expect(result.agentId).toBe('coder')
      expect(result.confidence).toBe(0.9)
    })

    it('falls back to kernel on invalid agentId', async () => {
      mockJson.mockResolvedValue({
        agentId: 'nonexistent',
        confidence: 0.8,
        needsResearch: false,
        isMultiStep: false,
        needsSwarm: false,
      })

      const result = await classifyIntent('hello', '')
      expect(result.agentId).toBe('kernel')
      expect(result.confidence).toBe(0)
    })

    it('falls back to kernel when confidence < 0.3', async () => {
      mockJson.mockResolvedValue({
        agentId: 'researcher',
        confidence: 0.2,
        needsResearch: true,
        isMultiStep: false,
        needsSwarm: false,
      })

      const result = await classifyIntent('maybe research?', '')
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

      const result = await classifyIntent('evaluate this', '')
      expect(result.confidence).toBe(1)
    })

    it('falls back to kernel on provider error', async () => {
      mockJson.mockRejectedValue(new Error('Network error'))

      const result = await classifyIntent('anything', '')
      expect(result.agentId).toBe('kernel')
      expect(result.confidence).toBe(0)
    })

    it('routes researcher correctly', async () => {
      mockJson.mockResolvedValue({
        agentId: 'researcher',
        confidence: 0.85,
        needsResearch: true,
        isMultiStep: false,
        needsSwarm: false,
      })

      const result = await classifyIntent('research AI regulation', '')
      expect(result.agentId).toBe('researcher')
      expect(result.needsResearch).toBe(true)
    })

    it('routes writer correctly', async () => {
      mockJson.mockResolvedValue({
        agentId: 'writer',
        confidence: 0.75,
        needsResearch: false,
        isMultiStep: false,
        needsSwarm: false,
      })

      const result = await classifyIntent('write a blog post', '')
      expect(result.agentId).toBe('writer')
    })

    it('detects multi-step and swarm needs', async () => {
      mockJson.mockResolvedValue({
        agentId: 'analyst',
        confidence: 0.9,
        needsResearch: true,
        isMultiStep: true,
        needsSwarm: true,
      })

      const result = await classifyIntent('research, analyze, and write about AI', '')
      expect(result.isMultiStep).toBe(true)
      expect(result.needsSwarm).toBe(true)
      expect(result.needsResearch).toBe(true)
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
