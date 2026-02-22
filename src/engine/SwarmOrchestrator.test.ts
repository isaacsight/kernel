import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockJson = vi.fn()
const mockText = vi.fn()
const mockStreamChat = vi.fn()
const mockProvider = {
  name: 'mock',
  json: mockJson,
  text: mockText,
  stream: vi.fn(),
  streamChat: mockStreamChat,
}

vi.mock('./providers/registry', () => ({
  getProvider: () => mockProvider,
}))

import { runSwarm } from './SwarmOrchestrator'

describe('SwarmOrchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('runSwarm', () => {
    it('selects agents, gets contributions, and synthesizes', async () => {
      // Mock agent selection
      mockJson.mockResolvedValue({
        agents: ['researcher', 'analyst'],
        focus: 'Compare perspectives',
      })

      // Mock contributions
      mockText.mockResolvedValue('A focused perspective paragraph.')

      // Mock synthesis stream
      let streamCallback: ((chunk: string) => void) | undefined
      mockStreamChat.mockImplementation(async (_msgs: any, opts: any) => {
        streamCallback = opts?.onChunk
        streamCallback?.('Synthesized response')
        return 'Synthesized response'
      })

      const progressUpdates: any[] = []
      const streamedText: string[] = []

      const result = await runSwarm(
        'What should I do about my career?',
        '',
        [],
        (p) => progressUpdates.push({ ...p }),
        (t) => streamedText.push(t),
      )

      // Verify progress phases happened
      expect(progressUpdates.length).toBeGreaterThanOrEqual(1)
      expect(progressUpdates[0].phase).toBe('selecting')

      // Verify agents were selected (at least 2)
      const collaboratingPhase = progressUpdates.find(p => p.phase === 'collaborating')
      expect(collaboratingPhase).toBeDefined()
      expect(collaboratingPhase!.agents.length).toBeGreaterThanOrEqual(2)

      // Verify result is a string
      expect(typeof result).toBe('string')
    })

    it('falls back to kernel+analyst when selection fails', async () => {
      mockJson.mockRejectedValue(new Error('API error'))
      mockText.mockResolvedValue('Fallback perspective.')
      mockStreamChat.mockResolvedValue('Fallback synthesis')

      const progressUpdates: any[] = []

      await runSwarm(
        'Test query',
        '',
        [],
        (p) => progressUpdates.push({ ...p }),
        () => {},
      )

      const collaborating = progressUpdates.find(p => p.phase === 'collaborating')
      expect(collaborating).toBeDefined()
      expect(collaborating!.agents).toHaveLength(2)

      const agentIds = collaborating!.agents.map((a: any) => a.id)
      expect(agentIds).toContain('kernel')
      expect(agentIds).toContain('analyst')
    })
  })
})
