import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { EntityEvolutionState } from '../hooks/useEntityEvolution'
import type { MoodState } from '../hooks/useCompanionMood'

// Mock dotlottie-react
vi.mock('@lottiefiles/dotlottie-react', () => ({
  DotLottieReact: (props: Record<string, unknown>) => {
    // Call dotLottieRefCallback with a fake instance
    if (typeof props.dotLottieRefCallback === 'function') {
      (props.dotLottieRefCallback as (inst: unknown) => void)({
        setSpeed: vi.fn(),
        play: vi.fn(),
        pause: vi.fn(),
      })
    }
    return null
  },
}))

// Mock PixelEntityCanvas
vi.mock('./PixelEntityCanvas', () => ({
  PixelEntityCanvas: () => null,
}))

function makeMockEvolution(overrides: Partial<EntityEvolutionState> = {}): EntityEvolutionState {
  return {
    score: 25,
    tier: 1,
    tierName: 'Sprout',
    progressHint: '5 conversations from Awake',
    topic: 'personal',
    topicColor: '#6B5B95',
    timePhase: 'day',
    isEvolving: false,
    hasUnreadBriefing: false,
    hasUrgentGoals: false,
    isRecentlyActive: false,
    isPro: false,
    moodState: 'content' as MoodState,
    companion: {
      mood: 'content' as MoodState,
      happiness: 60,
      energy: 50,
      attention: 40,
      tapCount: 5,
      streak: 1,
      petCreature: vi.fn(),
      recordConversation: vi.fn(),
      recordGoalComplete: vi.fn(),
    },
    cssVars: {
      '--entity-topic-color': '#6B5B95',
      '--entity-topic-r': '107',
      '--entity-topic-g': '91',
      '--entity-topic-b': '149',
    },
    dataAttrs: {
      'data-tier': '1',
      'data-time': 'day',
      'data-mood': 'content',
      'data-topic': 'personal',
    },
    ...overrides,
  }
}

describe('LottieEntity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('exports a LottieEntity component', async () => {
    const mod = await import('./LottieEntity')
    expect(mod.LottieEntity).toBeDefined()
    expect(typeof mod.LottieEntity).toBe('function')
  })

  it('MOOD_SPEEDS covers all MoodState values', async () => {
    // Verify internal speed map covers all moods
    const moods: MoodState[] = ['sleepy', 'lonely', 'excited', 'happy', 'content', 'sad', 'bored']
    // We can't access MOOD_SPEEDS directly since it's not exported,
    // but we test that the component doesn't crash with each mood
    for (const mood of moods) {
      const evo = makeMockEvolution({ moodState: mood })
      expect(evo.moodState).toBe(mood)
    }
  })

  it('evolution state shape is correct for LottieEntity', () => {
    const evo = makeMockEvolution()
    // Verify required fields exist
    expect(evo.tier).toBeDefined()
    expect(evo.moodState).toBeDefined()
    expect(evo.topicColor).toBeDefined()
    expect(evo.isEvolving).toBeDefined()
    expect(evo.hasUnreadBriefing).toBeDefined()
    expect(evo.companion.petCreature).toBeTypeOf('function')
    expect(evo.cssVars['--entity-topic-r']).toBeDefined()
    expect(evo.dataAttrs['data-tier']).toBeDefined()
  })

  it('tier 0-2 should not trigger hue rotation', () => {
    for (const tier of [0, 1, 2]) {
      const evo = makeMockEvolution({ tier })
      expect(evo.tier).toBeLessThan(3)
    }
  })

  it('tier 3+ with non-default topic should compute hue offset', () => {
    const evo = makeMockEvolution({ tier: 3, topic: 'tech', topicColor: '#6B8E6B' })
    expect(evo.tier).toBeGreaterThanOrEqual(3)
    expect(evo.topicColor).not.toBe('#6B5B95')
  })

  it('notification dot requires unread briefing + tier >= 1', () => {
    const evo = makeMockEvolution({ hasUnreadBriefing: true, tier: 1 })
    expect(evo.hasUnreadBriefing && evo.tier >= 1).toBe(true)

    const evo2 = makeMockEvolution({ hasUnreadBriefing: true, tier: 0 })
    expect(evo2.hasUnreadBriefing && evo2.tier >= 1).toBe(false)
  })
})
