// ─── Companion Mood Hook — Tamagotchi Emotional State ─────────
//
// Derives a MoodState from companion store values + time of day.
// Runs 60s decay interval. Applies retroactive decay on mount.
// Returns mood state + store actions for PixelEntity/EnginePage.

import { useState, useEffect, useMemo, useRef } from 'react'
import { useCompanionStore } from '../stores/companionStore'
import type { TimePhase } from './useEntityEvolution'

export type MoodState =
  | 'sleepy'
  | 'lonely'
  | 'excited'
  | 'happy'
  | 'content'
  | 'sad'
  | 'bored'

export interface CompanionMoodResult {
  mood: MoodState
  happiness: number
  energy: number
  attention: number
  tapCount: number
  streak: number
  petCreature: () => void
  recordConversation: () => void
  recordGoalComplete: () => void
}

function getTimeEnergy(timePhase: TimePhase, isActive: boolean, conversationsToday: number): number {
  const base: Record<TimePhase, number> = {
    dawn: 70,
    day: 90,
    dusk: 60,
    night: 30,
  }
  let energy = base[timePhase]
  if (isActive) energy += 10
  if (conversationsToday > 20) energy -= 10
  return Math.min(100, Math.max(0, energy))
}

export function deriveMoodState(
  happiness: number,
  energy: number,
  attention: number,
  timePhase: TimePhase,
): MoodState {
  // Priority-ordered mood derivation
  if (timePhase === 'night' && energy < 40) return 'sleepy'
  if (attention < 20) return 'lonely'
  if (happiness > 80 && energy > 70) return 'excited'
  if (happiness > 60) return 'happy'
  if (happiness > 40) return 'content'
  if (happiness < 25) return 'sad'
  return 'bored'
}

export function useCompanionMood(timePhase: TimePhase, isRecentlyActive: boolean): CompanionMoodResult {
  // Select individual primitives to avoid re-renders from store identity changes
  const happiness = useCompanionStore(s => s.happiness)
  const attention = useCompanionStore(s => s.attention)
  const tapCount = useCompanionStore(s => s.tapCount)
  const streak = useCompanionStore(s => s.streak)
  const conversationsToday = useCompanionStore(s => s.conversationsToday)
  const petCreature = useCompanionStore(s => s.petCreature)
  const recordConversation = useCompanionStore(s => s.recordConversation)
  const recordGoalComplete = useCompanionStore(s => s.recordGoalComplete)

  const hasAppliedDecay = useRef(false)

  // Apply retroactive decay once on mount — use getState() to avoid dependency
  useEffect(() => {
    if (!hasAppliedDecay.current) {
      hasAppliedDecay.current = true
      useCompanionStore.getState()._applyRetroactiveDecay()
    }
  }, [])

  // Decay interval — every 60s, use getState() for stable reference
  useEffect(() => {
    const interval = setInterval(() => useCompanionStore.getState().tickDecay(), 60_000)
    return () => clearInterval(interval)
  }, [])

  // Compute energy from time-of-day + activity
  const [energy, setEnergy] = useState(() =>
    getTimeEnergy(timePhase, isRecentlyActive, conversationsToday),
  )

  useEffect(() => {
    setEnergy(getTimeEnergy(timePhase, isRecentlyActive, conversationsToday))
  }, [timePhase, isRecentlyActive, conversationsToday])

  const mood = useMemo(
    () => deriveMoodState(happiness, energy, attention, timePhase),
    [happiness, energy, attention, timePhase],
  )

  return {
    mood,
    happiness,
    energy,
    attention,
    tapCount,
    streak,
    petCreature,
    recordConversation,
    recordGoalComplete,
  }
}
