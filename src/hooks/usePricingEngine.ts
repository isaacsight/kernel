import { useEffect, useCallback, useRef } from 'react'
import { usePricingStore } from '../stores/pricingStore'
import { getUserCostSummary, getUsageForecast, getTierRecommendation } from '../engine/PricingEngine'

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export function usePricingEngine() {
  const store = usePricingStore()
  const lastFetch = useRef(0)

  const fetchAll = useCallback(async (force = false) => {
    if (!force && Date.now() - lastFetch.current < CACHE_TTL && store.costSummary) return
    if (store.isLoading) return

    store.setLoading(true)
    store.setError(null)

    try {
      const [summary, forecast, recommendation] = await Promise.all([
        getUserCostSummary(30),
        getUsageForecast(),
        getTierRecommendation(),
      ])

      store.setCostSummary(summary)
      store.setForecast(forecast)
      store.setRecommendation(recommendation)
      lastFetch.current = Date.now()
    } catch (err) {
      store.setError(err instanceof Error ? err.message : 'Failed to load usage data')
    } finally {
      store.setLoading(false)
    }
  }, [store])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  return {
    costSummary: store.costSummary,
    forecast: store.forecast,
    recommendation: store.recommendation,
    isLoading: store.isLoading,
    error: store.error,
    refresh: () => fetchAll(true),
  }
}
