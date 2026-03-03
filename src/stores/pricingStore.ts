import { create } from 'zustand'
import type { UserCostSummary, UsageForecast, TierRecommendation } from '../engine/pricing/types'

interface PricingState {
  costSummary: UserCostSummary | null
  forecast: UsageForecast | null
  recommendation: TierRecommendation | null
  isLoading: boolean
  error: string | null
}

interface PricingActions {
  setCostSummary: (summary: UserCostSummary | null) => void
  setForecast: (forecast: UsageForecast | null) => void
  setRecommendation: (rec: TierRecommendation | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearAll: () => void
}

type PricingStore = PricingState & PricingActions

export const usePricingStore = create<PricingStore>()((set) => ({
  costSummary: null,
  forecast: null,
  recommendation: null,
  isLoading: false,
  error: null,

  setCostSummary: (costSummary) => set({ costSummary }),
  setForecast: (forecast) => set({ forecast }),
  setRecommendation: (recommendation) => set({ recommendation }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  clearAll: () => set({ costSummary: null, forecast: null, recommendation: null, error: null }),
}))
