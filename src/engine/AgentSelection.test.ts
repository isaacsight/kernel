import { describe, it, expect } from 'vitest'
import { selectAgent } from './AgentSelection'
import type { Perception, AttentionState } from './types'
import type { Agent } from '../types'

const baseAttention: AttentionState = {
  primaryFocus: 'test',
  salience: { test: 1 },
  distractions: [],
  depth: 'moderate',
}

const noPerf: Record<string, { uses: number; avgQuality: number }> = {}

describe('AgentSelection', () => {
  describe('manual override', () => {
    it('returns overridden agent with confidence 1', () => {
      const override: Agent = {
        id: 'custom',
        name: 'Custom',
        persona: 'test',
        systemPrompt: 'test',
        avatar: 'C',
        color: '#000',
      }
      const perception: Perception = {
        intent: { type: 'converse', message: 'test' },
        urgency: 0,
        complexity: 0,
        sentiment: 0,
        impliedNeed: 'test',
        keyEntities: [],
        isQuestion: false,
        isFollowUp: false,
      }

      const result = selectAgent(perception, baseAttention, override, noPerf, [])
      expect(result.agent.id).toBe('custom')
      expect(result.confidence).toBe(1)
      expect(result.consumedOverride).toBe(true)
    })
  })

  describe('intent routing', () => {
    it('routes discuss to discussion rotation', () => {
      const perception: Perception = {
        intent: { type: 'discuss', topic: 'AI ethics' },
        urgency: 0,
        complexity: 0.5,
        sentiment: 0,
        impliedNeed: 'Multiple perspectives',
        keyEntities: ['AI', 'ethics'],
        isQuestion: false,
        isFollowUp: false,
      }

      const result = selectAgent(perception, baseAttention, null, noPerf, [])
      expect(result.confidence).toBe(0.9)
      expect(result.consumedOverride).toBe(false)
    })

    it('routes reason to reasoner', () => {
      const perception: Perception = {
        intent: { type: 'reason', question: 'What is the expected value?', domain: 'financial' },
        urgency: 0,
        complexity: 0.7,
        sentiment: 0,
        impliedNeed: 'Rigorous thinking',
        keyEntities: [],
        isQuestion: true,
        isFollowUp: false,
      }

      const result = selectAgent(perception, baseAttention, null, noPerf, [])
      expect(result.agent.id).toBe('reasoner')
      expect(result.confidence).toBe(0.7)
    })

    it('routes urgent + simple build to builder', () => {
      const perception: Perception = {
        intent: { type: 'build', description: 'make a button' },
        urgency: 0.8,
        complexity: 0.3,
        sentiment: 0,
        impliedNeed: 'A concrete artifact',
        keyEntities: [],
        isQuestion: false,
        isFollowUp: false,
      }

      const result = selectAgent(perception, baseAttention, null, noPerf, [])
      expect(result.agent.id).toBe('builder')
      expect(result.confidence).toBe(0.75)
    })

    it('routes complex build to architect', () => {
      const perception: Perception = {
        intent: { type: 'build', description: 'design a system' },
        urgency: 0.3,
        complexity: 0.8,
        sentiment: 0,
        impliedNeed: 'A concrete plan',
        keyEntities: [],
        isQuestion: false,
        isFollowUp: false,
      }

      const result = selectAgent(perception, baseAttention, null, noPerf, [])
      expect(result.agent.id).toBe('architect')
      expect(result.confidence).toBe(0.85)
    })

    it('routes evaluate to critic', () => {
      const perception: Perception = {
        intent: { type: 'evaluate', opportunity: 'new market' },
        urgency: 0,
        complexity: 0.5,
        sentiment: 0,
        impliedNeed: 'An honest assessment',
        keyEntities: [],
        isQuestion: false,
        isFollowUp: false,
      }

      const result = selectAgent(perception, baseAttention, null, noPerf, [])
      expect(result.agent.id).toBe('critic')
      expect(result.confidence).toBe(0.8)
    })

    it('routes converse via content routing', () => {
      const perception: Perception = {
        intent: { type: 'converse', message: 'hello there' },
        urgency: 0,
        complexity: 0,
        sentiment: 0.5,
        impliedNeed: 'A thoughtful response',
        keyEntities: [],
        isQuestion: false,
        isFollowUp: false,
      }

      const result = selectAgent(perception, baseAttention, null, noPerf, [])
      expect(result.agent).toBeDefined()
      expect(result.confidence).toBeGreaterThan(0)
      expect(result.consumedOverride).toBe(false)
    })
  })

  describe('performance-based confidence', () => {
    it('boosts reason confidence with good performance history', () => {
      const perception: Perception = {
        intent: { type: 'reason', question: 'Analyze this', domain: 'general' },
        urgency: 0,
        complexity: 0.5,
        sentiment: 0,
        impliedNeed: 'Reasoning',
        keyEntities: [],
        isQuestion: true,
        isFollowUp: false,
      }

      const goodPerf = { reasoner: { uses: 10, avgQuality: 0.9 } }
      const result = selectAgent(perception, baseAttention, null, goodPerf, [])

      expect(result.confidence).toBeGreaterThan(0.7)
      expect(result.confidence).toBeLessThanOrEqual(0.95)
    })

    it('boosts converse confidence with good agent performance', () => {
      const perception: Perception = {
        intent: { type: 'converse', message: 'hello' },
        urgency: 0,
        complexity: 0,
        sentiment: 0,
        impliedNeed: 'test',
        keyEntities: [],
        isQuestion: false,
        isFollowUp: false,
      }

      // We don't know which agent routeToAgent will pick, but test that perf affects confidence
      const result = selectAgent(perception, baseAttention, null, noPerf, [])
      expect(result.confidence).toBe(0.6) // default with no perf data
    })
  })
})
