import { describe, it, expect, vi } from 'vitest'
import { formBelief, challengeBeliefById, shiftConviction, updateWorldModel } from './WorldModel'
import type { WorldModel, EngineState, Reflection, Perception } from './types'

function createMockWorldModel(): WorldModel {
  return {
    beliefs: [],
    convictions: { overall: 0.5, trend: 'stable', lastShift: Date.now() },
    situationSummary: 'Test.',
    userModel: {
      apparentGoal: 'unknown',
      communicationStyle: 'unknown',
      expertise: 'unknown',
    },
  }
}

describe('WorldModel', () => {
  describe('formBelief', () => {
    it('adds a new belief when no match exists', () => {
      const wm = createMockWorldModel()
      const emit = vi.fn()

      const belief = formBelief(wm, emit, 'The sky is blue', 0.8, 'observed')

      expect(belief.content).toBe('The sky is blue')
      expect(belief.confidence).toBe(0.8)
      expect(belief.source).toBe('observed')
      expect(wm.beliefs).toHaveLength(1)
      expect(emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'belief_formed' }))
    })

    it('reinforces an existing belief when content overlaps', () => {
      const wm = createMockWorldModel()
      const emit = vi.fn()

      formBelief(wm, emit, 'The sky is blue', 0.5, 'observed')
      const reinforced = formBelief(wm, emit, 'The sky is blue today', 0.6, 'stated')

      expect(wm.beliefs).toHaveLength(1)
      expect(reinforced.confidence).toBe(0.6) // 0.5 + 0.1
      expect(reinforced.reinforcedCount).toBe(1)
      expect(emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'belief_updated', delta: 0.1 }))
    })

    it('caps beliefs at 20', () => {
      const wm = createMockWorldModel()
      const emit = vi.fn()

      for (let i = 0; i < 25; i++) {
        formBelief(wm, emit, `Unique belief number ${i} with enough unique text`, 0.5, 'inferred')
      }

      expect(wm.beliefs.length).toBeLessThanOrEqual(20)
    })

    it('caps confidence at 1.0', () => {
      const wm = createMockWorldModel()
      const emit = vi.fn()

      formBelief(wm, emit, 'Strong belief test', 0.95, 'observed')
      const reinforced = formBelief(wm, emit, 'Strong belief test confirmed', 0.8, 'observed')

      expect(reinforced.confidence).toBeLessThanOrEqual(1)
    })
  })

  describe('challengeBeliefById', () => {
    it('reduces confidence by 0.15', () => {
      const wm = createMockWorldModel()
      const emit = vi.fn()

      const belief = formBelief(wm, emit, 'Testable hypothesis', 0.8, 'inferred')
      challengeBeliefById(wm, emit, belief.id)

      expect(belief.confidence).toBeCloseTo(0.65, 2)
      expect(belief.challengedCount).toBe(1)
    })

    it('removes belief when confidence drops below 0.1', () => {
      const wm = createMockWorldModel()
      const emit = vi.fn()

      const belief = formBelief(wm, emit, 'Weak belief that will fail', 0.2, 'inferred')
      challengeBeliefById(wm, emit, belief.id) // 0.2 - 0.15 = 0.05

      expect(wm.beliefs.find(b => b.id === belief.id)).toBeUndefined()
    })

    it('does nothing for non-existent belief', () => {
      const wm = createMockWorldModel()
      const emit = vi.fn()

      challengeBeliefById(wm, emit, 'nonexistent')
      expect(emit).not.toHaveBeenCalled()
    })

    it('floors confidence at 0', () => {
      const wm = createMockWorldModel()
      const emit = vi.fn()

      const belief = formBelief(wm, emit, 'Near zero confidence belief test', 0.05, 'inferred')
      challengeBeliefById(wm, emit, belief.id)

      // Should be removed since 0.05 - 0.15 = -0.1 which is < 0.1
      expect(wm.beliefs.find(b => b.id === belief.id)).toBeUndefined()
    })
  })

  describe('shiftConviction', () => {
    it('increases conviction on positive delta', () => {
      const wm = createMockWorldModel()
      const emit = vi.fn()

      shiftConviction(wm, emit, 0.1, 'Good result')
      expect(wm.convictions.overall).toBeCloseTo(0.6, 2)
      expect(wm.convictions.trend).toBe('rising')
    })

    it('decreases conviction on negative delta', () => {
      const wm = createMockWorldModel()
      const emit = vi.fn()

      shiftConviction(wm, emit, -0.1, 'Bad result')
      expect(wm.convictions.overall).toBeCloseTo(0.4, 2)
      expect(wm.convictions.trend).toBe('falling')
    })

    it('clamps to [0, 1]', () => {
      const wm = createMockWorldModel()
      wm.convictions.overall = 0.95
      const emit = vi.fn()

      shiftConviction(wm, emit, 0.2, 'Overflow')
      expect(wm.convictions.overall).toBe(1)

      wm.convictions.overall = 0.05
      shiftConviction(wm, emit, -0.2, 'Underflow')
      expect(wm.convictions.overall).toBe(0)
    })

    it('emits event for significant shifts (> 0.02)', () => {
      const wm = createMockWorldModel()
      const emit = vi.fn()

      shiftConviction(wm, emit, 0.05, 'Significant')
      expect(emit).toHaveBeenCalledWith(expect.objectContaining({
        type: 'conviction_shifted',
        from: 0.5,
        reason: 'Significant',
      }))
    })

    it('does not emit for insignificant shifts (<= 0.02)', () => {
      const wm = createMockWorldModel()
      const emit = vi.fn()

      shiftConviction(wm, emit, 0.01, 'Tiny')
      expect(emit).not.toHaveBeenCalled()
    })

    it('marks trend as stable for small deltas', () => {
      const wm = createMockWorldModel()
      const emit = vi.fn()

      shiftConviction(wm, emit, 0.005, 'Negligible')
      expect(wm.convictions.trend).toBe('stable')
    })
  })

  describe('updateWorldModel', () => {
    function createMockState(): EngineState {
      return {
        phase: 'reflecting',
        ephemeral: {
          currentInput: 'test input',
          perception: null,
          attention: null,
          activeAgent: null,
          startedAt: Date.now(),
        },
        working: {
          conversationHistory: [],
          topic: 'test topic',
          turnCount: 5,
          agentSequence: [],
          emotionalTone: 0,
          coherenceScore: 1,
          threadSummary: '',
          unresolvedQuestions: [],
        },
        lasting: {
          totalInteractions: 10,
          preferredAgents: {},
          topicHistory: [],
          reflections: [],
          feedbackRatio: { positive: 0, negative: 0 },
          agentPerformance: {},
          patternNotes: [],
        },
        worldModel: createMockWorldModel(),
        isOnline: true,
        cycleCount: 5,
      }
    }

    const mockReflection: Reflection = {
      timestamp: Date.now(),
      phase: 'reflecting',
      input: 'test',
      output: 'test output',
      agentUsed: 'kernel',
      durationMs: 100,
      quality: 0.7,
      scores: { substance: 0.7, coherence: 0.8, relevance: 0.6, brevity: 0.7, craft: 0.6 },
      lesson: 'Good cycle.',
      worldModelUpdate: null,
      convictionDelta: 0.03,
    }

    const mockPerception: Perception = {
      intent: { type: 'converse', message: 'test' },
      urgency: 0,
      complexity: 0.3,
      sentiment: 0,
      impliedNeed: 'test',
      keyEntities: [],
      isQuestion: false,
      isFollowUp: false,
    }

    it('updates situation summary with topic', () => {
      const state = createMockState()
      const emit = vi.fn()
      const persist = vi.fn()

      updateWorldModel(state, emit, persist, mockReflection, mockPerception)

      expect(state.worldModel.situationSummary).toContain('test topic')
    })

    it('tracks agent performance', () => {
      const state = createMockState()
      const emit = vi.fn()
      const persist = vi.fn()

      updateWorldModel(state, emit, persist, mockReflection, mockPerception)

      expect(state.lasting.agentPerformance['kernel']).toBeDefined()
      expect(state.lasting.agentPerformance['kernel'].uses).toBe(1)
      expect(state.lasting.agentPerformance['kernel'].avgQuality).toBe(0.7)
    })

    it('calls persistState', () => {
      const state = createMockState()
      const emit = vi.fn()
      const persist = vi.fn()

      updateWorldModel(state, emit, persist, mockReflection, mockPerception)

      expect(persist).toHaveBeenCalledOnce()
    })

    it('emits world_model_updated', () => {
      const state = createMockState()
      const emit = vi.fn()
      const persist = vi.fn()

      updateWorldModel(state, emit, persist, mockReflection, mockPerception)

      expect(emit).toHaveBeenCalledWith(expect.objectContaining({
        type: 'world_model_updated',
      }))
    })

    it('forms belief when reflection has worldModelUpdate', () => {
      const state = createMockState()
      const emit = vi.fn()
      const persist = vi.fn()

      const reflectionWithUpdate = {
        ...mockReflection,
        worldModelUpdate: 'User prefers depth.',
      }

      updateWorldModel(state, emit, persist, reflectionWithUpdate, mockPerception)

      expect(state.worldModel.beliefs.length).toBeGreaterThan(0)
    })

    it('adds unresolved question on low relevance', () => {
      const state = createMockState()
      const emit = vi.fn()
      const persist = vi.fn()

      const lowRelevance = {
        ...mockReflection,
        scores: { ...mockReflection.scores, relevance: 0.2 },
      }
      const questionPerception = { ...mockPerception, isQuestion: true }

      updateWorldModel(state, emit, persist, lowRelevance, questionPerception)

      expect(state.working.unresolvedQuestions).toContain('test input')
    })
  })
})
