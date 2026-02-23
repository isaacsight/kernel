// ─── useCompanionMood Tests ──────────────────────────────────

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { deriveMoodState } from './useCompanionMood'
import { useCompanionStore } from '../stores/companionStore'

describe('deriveMoodState', () => {
  it('returns sleepy at night with low energy', () => {
    expect(deriveMoodState(50, 30, 50, 'night')).toBe('sleepy')
  })

  it('returns lonely when attention < 20', () => {
    expect(deriveMoodState(50, 70, 15, 'day')).toBe('lonely')
  })

  it('returns excited when happiness > 80 and energy > 70', () => {
    expect(deriveMoodState(85, 80, 50, 'day')).toBe('excited')
  })

  it('returns happy when happiness > 60', () => {
    expect(deriveMoodState(65, 50, 50, 'day')).toBe('happy')
  })

  it('returns content when happiness > 40', () => {
    expect(deriveMoodState(45, 50, 50, 'day')).toBe('content')
  })

  it('returns sad when happiness < 25', () => {
    expect(deriveMoodState(20, 50, 50, 'day')).toBe('sad')
  })

  it('returns bored as default', () => {
    expect(deriveMoodState(30, 50, 50, 'day')).toBe('bored')
  })

  it('prioritizes sleepy over lonely at night', () => {
    expect(deriveMoodState(50, 30, 10, 'night')).toBe('sleepy')
  })

  it('requires night for sleepy — not sleepy during day', () => {
    expect(deriveMoodState(50, 30, 50, 'day')).not.toBe('sleepy')
  })
})

describe('companionStore', () => {
  beforeEach(() => {
    // Reset store between tests
    useCompanionStore.setState({
      happiness: 50,
      energy: 70,
      attention: 50,
      lastInteraction: new Date().toISOString(),
      lastTapTime: new Date().toISOString(),
      tapCount: 0,
      conversationsToday: 0,
      lastConversationDate: new Date().toISOString().slice(0, 10),
      streak: 0,
      lastStreakDate: '',
    })
  })

  it('petCreature increases happiness by 5', () => {
    const before = useCompanionStore.getState().happiness
    useCompanionStore.getState().petCreature()
    expect(useCompanionStore.getState().happiness).toBe(before + 5)
  })

  it('petCreature increments tapCount', () => {
    expect(useCompanionStore.getState().tapCount).toBe(0)
    useCompanionStore.getState().petCreature()
    useCompanionStore.getState().petCreature()
    expect(useCompanionStore.getState().tapCount).toBe(2)
  })

  it('petCreature increases attention by 10', () => {
    const before = useCompanionStore.getState().attention
    useCompanionStore.getState().petCreature()
    expect(useCompanionStore.getState().attention).toBe(before + 10)
  })

  it('recordConversation resets attention to 100', () => {
    useCompanionStore.setState({ attention: 30 })
    useCompanionStore.getState().recordConversation()
    expect(useCompanionStore.getState().attention).toBe(100)
  })

  it('recordConversation boosts happiness', () => {
    const before = useCompanionStore.getState().happiness
    useCompanionStore.getState().recordConversation()
    expect(useCompanionStore.getState().happiness).toBeGreaterThan(before)
  })

  it('recordGoalComplete increases happiness by 10', () => {
    const before = useCompanionStore.getState().happiness
    useCompanionStore.getState().recordGoalComplete()
    expect(useCompanionStore.getState().happiness).toBe(before + 10)
  })

  it('tickDecay decreases happiness', () => {
    const before = useCompanionStore.getState().happiness
    useCompanionStore.getState().tickDecay()
    expect(useCompanionStore.getState().happiness).toBeLessThan(before)
  })

  it('tickDecay decreases attention', () => {
    const before = useCompanionStore.getState().attention
    useCompanionStore.getState().tickDecay()
    expect(useCompanionStore.getState().attention).toBeLessThan(before)
  })

  it('happiness is clamped to [0, 100]', () => {
    useCompanionStore.setState({ happiness: 98 })
    useCompanionStore.getState().petCreature() // +5
    expect(useCompanionStore.getState().happiness).toBe(100)
  })

  it('attention floors at 0 after decay', () => {
    useCompanionStore.setState({ attention: 0.05 })
    useCompanionStore.getState().tickDecay()
    expect(useCompanionStore.getState().attention).toBe(0)
  })

  it('retroactive decay reduces values based on elapsed time', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    useCompanionStore.setState({
      happiness: 80,
      attention: 80,
      lastInteraction: twoHoursAgo,
    })
    useCompanionStore.getState()._applyRetroactiveDecay()
    // 2 hours * 2/hr = ~4 happiness loss
    expect(useCompanionStore.getState().happiness).toBeLessThan(80)
    expect(useCompanionStore.getState().happiness).toBeGreaterThan(70)
    // 2 hours * 8/hr = ~16 attention loss
    expect(useCompanionStore.getState().attention).toBeLessThan(80)
    expect(useCompanionStore.getState().attention).toBeGreaterThan(50)
  })

  it('retroactive decay floors happiness at 10', () => {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    useCompanionStore.setState({
      happiness: 30,
      attention: 80,
      lastInteraction: dayAgo,
    })
    useCompanionStore.getState()._applyRetroactiveDecay()
    expect(useCompanionStore.getState().happiness).toBe(10)
  })
})
