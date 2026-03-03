// ─── useAdaptiveEngine — React hook for Adaptive Engine ─────────
//
// Provides easy signal recording, profile access, insights,
// metrics, and experiment management. Auto-loads profile on mount.

import { useCallback, useEffect, useRef } from 'react'
import { useAdaptiveStore } from '../stores/adaptiveStore'
import {
  recordSignal as recordAdaptiveSignal,
  getAdaptiveProfile,
  updateAdaptiveProfile,
  getResponseHints,
  getQualityMetrics,
  discoverInsights,
  getInsights,
  getExperiments,
  flushPendingSignals,
} from '../engine/AdaptiveEngine'
import type {
  AdaptiveSignalType,
  ResponseHints,
} from '../engine/adaptive/types'

/** Number of signals between automatic profile recalculations */
const RECALC_INTERVAL = 10

export function useAdaptiveEngine(userId: string | undefined) {
  const store = useAdaptiveStore()
  const loadedRef = useRef(false)

  // ─── Auto-load profile on mount ───────────────────────
  useEffect(() => {
    if (!userId || loadedRef.current) return
    loadedRef.current = true

    const load = async () => {
      store.setLoading(true)
      try {
        // Flush any offline-cached signals first
        await flushPendingSignals()

        const profile = await getAdaptiveProfile(userId)
        store.setProfile(profile)
      } catch (err) {
        console.error('[useAdaptiveEngine] Failed to load profile:', err)
      } finally {
        store.setLoading(false)
      }
    }
    load()
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Record Signal ────────────────────────────────────
  const recordSignal = useCallback(async (
    type: AdaptiveSignalType,
    context?: {
      messageId?: string
      agentId?: string
      engineId?: string
      topic?: string
      extra?: Record<string, unknown>
    },
  ) => {
    if (!userId) return

    const signal = await recordAdaptiveSignal({
      userId,
      type,
      messageId: context?.messageId,
      agentId: context?.agentId,
      engineId: context?.engineId,
      context: {
        ...(context?.extra || {}),
        ...(context?.topic ? { topic: context.topic } : {}),
      },
      timestamp: Date.now(),
    })

    if (signal) {
      store.incrementSignalCount()

      // Recalculate profile every N signals
      if (store.signalCount % RECALC_INTERVAL === 0) {
        const updated = await updateAdaptiveProfile(userId)
        store.setProfile(updated)
      }
    }
  }, [userId, store])

  // ─── Load Insights ────────────────────────────────────
  const loadInsights = useCallback(async () => {
    if (!userId) return
    store.setLoading(true)
    try {
      // Discover new insights from signals
      await discoverInsights(userId)
      // Fetch all persisted insights
      const insights = await getInsights(userId)
      store.setInsights(insights)
    } catch (err) {
      console.error('[useAdaptiveEngine] Failed to load insights:', err)
    } finally {
      store.setLoading(false)
    }
  }, [userId, store])

  // ─── Load Metrics ─────────────────────────────────────
  const loadMetrics = useCallback(async () => {
    if (!userId) return
    try {
      const metrics = await getQualityMetrics(userId)
      store.setMetrics(metrics)
    } catch (err) {
      console.error('[useAdaptiveEngine] Failed to load metrics:', err)
    }
  }, [userId, store])

  // ─── Load Experiments ─────────────────────────────────
  const loadExperiments = useCallback(async () => {
    try {
      const experiments = await getExperiments()
      store.setExperiments(experiments)
    } catch (err) {
      console.error('[useAdaptiveEngine] Failed to load experiments:', err)
    }
  }, [store])

  // ─── Get Response Hints ───────────────────────────────
  const getHints = useCallback(async (intent?: string): Promise<ResponseHints | null> => {
    if (!userId) return null
    try {
      return await getResponseHints(userId, intent)
    } catch (err) {
      console.error('[useAdaptiveEngine] Failed to get hints:', err)
      return null
    }
  }, [userId])

  // ─── Refresh Profile ──────────────────────────────────
  const refreshProfile = useCallback(async () => {
    if (!userId) return
    const updated = await updateAdaptiveProfile(userId)
    store.setProfile(updated)
  }, [userId, store])

  return {
    // Data
    profile: store.profile,
    insights: store.insights,
    metrics: store.metrics,
    experiments: store.experiments,
    signalCount: store.signalCount,
    isLoading: store.isLoading,

    // Actions
    recordSignal,
    getResponseHints: getHints,
    loadInsights,
    loadMetrics,
    loadExperiments,
    refreshProfile,
  }
}
