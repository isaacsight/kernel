// ─── Adaptive Store — Self-Improving Intelligence State ─────────
//
// Zustand store for the Adaptive Engine. Persists profile and
// metrics to localStorage, excludes transient loading state.

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  AdaptiveProfile,
  Experiment,
  AdaptiveInsight,
  QualityMetrics,
} from '../engine/adaptive/types'

interface AdaptiveState {
  profile: AdaptiveProfile | null
  experiments: Experiment[]
  insights: AdaptiveInsight[]
  metrics: QualityMetrics | null
  signalCount: number
  isLoading: boolean
}

interface AdaptiveActions {
  setProfile: (profile: AdaptiveProfile) => void
  setExperiments: (experiments: Experiment[]) => void
  setInsights: (insights: AdaptiveInsight[]) => void
  setMetrics: (metrics: QualityMetrics) => void
  incrementSignalCount: () => void
  setLoading: (loading: boolean) => void
  reset: () => void
}

type AdaptiveStore = AdaptiveState & AdaptiveActions

export const useAdaptiveStore = create<AdaptiveStore>()(
  persist(
    (set) => ({
      // State
      profile: null,
      experiments: [],
      insights: [],
      metrics: null,
      signalCount: 0,
      isLoading: false,

      // Actions
      setProfile: (profile) => set({ profile }),
      setExperiments: (experiments) => set({ experiments }),
      setInsights: (insights) => set({ insights }),
      setMetrics: (metrics) => set({ metrics }),
      incrementSignalCount: () => set((state) => ({ signalCount: state.signalCount + 1 })),
      setLoading: (isLoading) => set({ isLoading }),
      reset: () => set({
        profile: null,
        experiments: [],
        insights: [],
        metrics: null,
        signalCount: 0,
        isLoading: false,
      }),
    }),
    {
      name: 'kernel-adaptive',
      partialize: (state) => ({
        profile: state.profile,
        experiments: state.experiments.slice(0, 10),
        insights: state.insights.slice(0, 30),
        metrics: state.metrics,
        signalCount: state.signalCount,
        // isLoading excluded
      }),
    },
  ),
)
