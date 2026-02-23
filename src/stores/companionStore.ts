// ─── Companion Store — Tamagotchi Mood Persistence ──────────
//
// Local-first Zustand store for the creature's emotional state.
// Mood decays over time, boosted by conversations, goals, and taps.
// On rehydration, retroactively applies decay for time user was away.

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CompanionMood {
  happiness: number    // 0-100 — boosted by conversations, goals, taps
  energy: number       // 0-100 — driven by time-of-day + activity
  attention: number    // 0-100 — decays when user is absent ("hunger")
  lastInteraction: string   // ISO timestamp
  lastTapTime: string       // ISO timestamp
  tapCount: number          // cumulative (for accessory unlocks)
  conversationsToday: number
  lastConversationDate: string // YYYY-MM-DD — resets daily
  streak: number             // consecutive days with interaction
  lastStreakDate: string     // YYYY-MM-DD
}

interface CompanionActions {
  petCreature: () => void
  recordConversation: () => void
  recordGoalComplete: () => void
  tickDecay: () => void
  _applyRetroactiveDecay: () => void
}

type CompanionStore = CompanionMood & CompanionActions

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

const INITIAL_STATE: CompanionMood = {
  happiness: 50,
  energy: 70,
  attention: 50,
  lastInteraction: new Date().toISOString(),
  lastTapTime: new Date().toISOString(),
  tapCount: 0,
  conversationsToday: 0,
  lastConversationDate: todayStr(),
  streak: 0,
  lastStreakDate: '',
}

export const useCompanionStore = create<CompanionStore>()(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,

      petCreature: () => {
        const now = new Date().toISOString()
        set(s => ({
          happiness: clamp(s.happiness + 5, 0, 100),
          attention: clamp(s.attention + 10, 0, 100),
          lastInteraction: now,
          lastTapTime: now,
          tapCount: s.tapCount + 1,
        }))
      },

      recordConversation: () => {
        const now = new Date().toISOString()
        const today = todayStr()
        const state = get()

        // Reset daily counter if new day
        const convsToday = state.lastConversationDate === today
          ? state.conversationsToday + 1
          : 1

        // Streak tracking
        let streak = state.streak
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        const yesterdayStr = yesterday.toISOString().slice(0, 10)

        if (state.lastStreakDate === yesterdayStr) {
          streak += 1
        } else if (state.lastStreakDate !== today) {
          streak = 1
        }

        // Happiness boost: +15 per conversation, capped at +30/day from convos
        const convoBoost = Math.min(15, 30 - Math.min(30, (convsToday - 1) * 15))

        set({
          happiness: clamp(state.happiness + convoBoost, 0, 100),
          attention: 100, // conversation resets attention to full
          lastInteraction: now,
          conversationsToday: convsToday,
          lastConversationDate: today,
          streak,
          lastStreakDate: today,
        })
      },

      recordGoalComplete: () => {
        const now = new Date().toISOString()
        set(s => ({
          happiness: clamp(s.happiness + 10, 0, 100),
          attention: clamp(s.attention + 15, 0, 100),
          lastInteraction: now,
        }))
      },

      tickDecay: () => {
        set(s => ({
          happiness: clamp(s.happiness - 0.033, 0, 100),  // ~2/hr at 60s interval
          attention: clamp(s.attention - 0.133, 0, 100),   // ~8/hr at 60s interval
        }))
      },

      _applyRetroactiveDecay: () => {
        const state = get()
        const elapsed = (Date.now() - new Date(state.lastInteraction).getTime()) / 3_600_000 // hours

        if (elapsed <= 0) return

        set({
          happiness: clamp(state.happiness - elapsed * 2, 10, 100),  // floor 10
          attention: clamp(state.attention - elapsed * 8, 0, 100),   // floor 0
        })
      },
    }),
    {
      name: 'kernel-companion',
      partialize: (state) => ({
        happiness: state.happiness,
        energy: state.energy,
        attention: state.attention,
        lastInteraction: state.lastInteraction,
        lastTapTime: state.lastTapTime,
        tapCount: state.tapCount,
        conversationsToday: state.conversationsToday,
        lastConversationDate: state.lastConversationDate,
        streak: state.streak,
        lastStreakDate: state.lastStreakDate,
      }),
    },
  ),
)
