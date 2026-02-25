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
  const store = useCompanionStore()
  const hasAppliedDecay = useRef(false)

  // Apply retroactive decay once on mount
  useEffect(() => {
    if (!hasAppliedDecay.current) {
      hasAppliedDecay.current = true
      store._applyRetroactiveDecay()
    }
  }, [store])

  // Decay interval — every 60s
  useEffect(() => {
    const interval = setInterval(() => store.tickDecay(), 60_000)
    return () => clearInterval(interval)
  }, [store])

  // Compute energy from time-of-day + activity
  const [energy, setEnergy] = useState(() =>
    getTimeEnergy(timePhase, isRecentlyActive, store.conversationsToday),
  )

  useEffect(() => {
    setEnergy(getTimeEnergy(timePhase, isRecentlyActive, store.conversationsToday))
  }, [timePhase, isRecentlyActive, store.conversationsToday])

  const mood = useMemo(
    () => deriveMoodState(store.happiness, energy, store.attention, timePhase),
    [store.happiness, energy, store.attention, timePhase],
  )

  return {
    mood,
    happiness: store.happiness,
    energy,
    attention: store.attention,
    tapCount: store.tapCount,
    streak: store.streak,
    petCreature: store.petCreature,
    recordConversation: store.recordConversation,
    recordGoalComplete: store.recordGoalComplete,
  }
}
