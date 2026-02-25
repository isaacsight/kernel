import { describe, it, expect, vi } from 'vitest'
import { classifyIntent } from './AgentRouter'
import { routeToAgent } from '../agents/swarm'
import { getProvider } from './providers/registry'

vi.mock('./providers/registry', () => ({
    getProvider: vi.fn(),
}))

describe('New Agents Integration', () => {
    it('should classify and route to aesthete', async () => {
        const mockProvider = {
            json: vi.fn().mockResolvedValue({
                agentId: 'aesthete',
                confidence: 0.9,
                needsResearch: false,
                isMultiStep: false,
                needsSwarm: false,
            }),
        }
            ; (getProvider as any).mockReturnValue(mockProvider)

        const result = await classifyIntent('make this look premium', '')
        expect(result.agentId).toBe('aesthete')

        const routed = routeToAgent('make this look premium', result)
        expect(routed.id).toBe('aesthete')
        expect(routed.name).toBe('Aesthete')
    })

    it('should classify and route to guardian', async () => {
        const mockProvider = {
            json: vi.fn().mockResolvedValue({
                agentId: 'guardian',
                confidence: 0.95,
                needsResearch: false,
                isMultiStep: false,
                needsSwarm: false,
            }),
        }
            ; (getProvider as any).mockReturnValue(mockProvider)

        const result = await classifyIntent('check for security bugs', '')
        expect(result.agentId).toBe('guardian')

        const routed = routeToAgent('check for security bugs', result)
        expect(routed.id).toBe('guardian')
        expect(routed.name).toBe('Guardian')
    })

    it('should classify and route to curator', async () => {
        const mockProvider = {
            json: vi.fn().mockResolvedValue({
                agentId: 'curator',
                confidence: 0.8,
                needsResearch: false,
                isMultiStep: false,
                needsSwarm: false,
            }),
        }
            ; (getProvider as any).mockReturnValue(mockProvider)

        const result = await classifyIntent('what were my goals last month', '')
        expect(result.agentId).toBe('curator')

        const routed = routeToAgent('what were my goals last month', result)
        expect(routed.id).toBe('curator')
        expect(routed.name).toBe('Curator')
    })

    it('should classify and route to strategist', async () => {
        const mockProvider = {
            json: vi.fn().mockResolvedValue({
                agentId: 'strategist',
                confidence: 0.85,
                needsResearch: false,
                isMultiStep: true,
                needsSwarm: true,
            }),
        }
            ; (getProvider as any).mockReturnValue(mockProvider)

        const result = await classifyIntent('is this a good business move', '')
        expect(result.agentId).toBe('strategist')

        const routed = routeToAgent('is this a good business move', result)
        expect(routed.id).toBe('strategist')
        expect(routed.name).toBe('Strategist')
    })
})
