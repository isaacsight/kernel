import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockJson = vi.fn()
const mockStreamChat = vi.fn()
const mockProvider = {
  name: 'mock',
  json: mockJson,
  text: vi.fn(),
  stream: vi.fn(),
  streamChat: mockStreamChat,
}

vi.mock('./providers/registry', () => ({
  getProvider: () => mockProvider,
}))

import { planTask } from './TaskPlanner'

describe('TaskPlanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('planTask', () => {
    it('decomposes a request into steps', async () => {
      mockJson.mockResolvedValue({
        goal: 'Research and summarize AI trends',
        steps: [
          { id: 1, description: 'Research current AI trends', agentId: 'researcher' },
          { id: 2, description: 'Summarize findings', agentId: 'writer' },
        ],
      })

      const plan = await planTask('Research AI trends and write a summary')
      expect(plan.goal).toBe('Research and summarize AI trends')
      expect(plan.steps).toHaveLength(2)
      expect(plan.steps[0].agentId).toBe('researcher')
      expect(plan.steps[0].status).toBe('pending')
      expect(plan.steps[1].agentId).toBe('writer')
    })

    it('validates agent IDs and falls back to kernel', async () => {
      mockJson.mockResolvedValue({
        goal: 'Test task',
        steps: [
          { id: 1, description: 'Step 1', agentId: 'invalid_agent' },
          { id: 2, description: 'Step 2', agentId: 'coder' },
        ],
      })

      const plan = await planTask('Test')
      expect(plan.steps[0].agentId).toBe('kernel')
      expect(plan.steps[1].agentId).toBe('coder')
    })

    it('caps steps at 5', async () => {
      mockJson.mockResolvedValue({
        goal: 'Long task',
        steps: Array.from({ length: 8 }, (_, i) => ({
          id: i + 1,
          description: `Step ${i + 1}`,
          agentId: 'kernel',
        })),
      })

      const plan = await planTask('Complex task')
      expect(plan.steps.length).toBeLessThanOrEqual(5)
    })

    it('creates a single-step plan when steps are empty', async () => {
      mockJson.mockResolvedValue({
        goal: 'Simple task',
        steps: [],
      })

      const plan = await planTask('Do something simple')
      expect(plan.steps).toHaveLength(1)
      expect(plan.steps[0].agentId).toBe('kernel')
      expect(plan.steps[0].description).toBe('Do something simple')
    })

    it('falls back gracefully on provider error', async () => {
      mockJson.mockRejectedValue(new Error('API error'))

      const plan = await planTask('Failing request')
      expect(plan.goal).toBe('Failing request')
      expect(plan.steps).toHaveLength(1)
      expect(plan.steps[0].agentId).toBe('kernel')
    })
  })
})
