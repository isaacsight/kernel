import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../engine/SupabaseClient'

export interface ProviderTrend {
  score_15m: number
  score_1h: number
  score_24h: number
  trend: 'declining' | 'recovering' | 'stable'
  delta_15m_1h: number
}

export interface RetryStats {
  total_messages: number
  successful: number
  failed_platform: number
  retried: number
  retry_success: number
  retry_saved_refunds: number
  avg_duration_ms: number
  p95_duration_ms: number
}

export interface RefundAnalytics {
  window_hours: number
  total_errors: number
  total_refunds: number
  refund_rate_pct: number
  refund_cost_usd: number
  avg_message_cost_usd: number
  by_provider: Record<string, number>
  by_error_type: Record<string, number>
  by_hour_utc: Record<string, number>
}

export interface RecentError {
  provider: string
  model: string
  error_type: string
  http_status: number
  refunded: boolean
  created_at: string
}

export interface ProviderWindow {
  provider: string
  window: string
  score: number
  total_requests: number
  success_count: number
  error_count: number
  timeout_count: number
  refund_count: number
  computed_at: string
}

export interface ReliabilityDashboardData {
  providers: Record<string, ProviderWindow>
  trends: Record<string, ProviderTrend>
  retry_stats: RetryStats
  refund_analytics: RefundAnalytics
  recent_errors: RecentError[]
  generated_at: string
}

export interface UserReliabilityData {
  period_days: number
  total_messages: number
  success_rate_pct: number
  refund_count: number
  errors: Array<{
    provider: string
    error_type: string
    refunded: boolean
    created_at: string
  }>
  daily_breakdown: Array<{
    date: string
    total: number
    success: number
    errors: number
  }>
}

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export function useReliabilityDashboard() {
  const [data, setData] = useState<ReliabilityDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const cachedAt = useRef(0)
  const dataRef = useRef(data)
  dataRef.current = data

  const fetchDashboard = useCallback(async (force = false) => {
    if (!force && Date.now() - cachedAt.current < CACHE_TTL && dataRef.current) return
    setLoading(true)
    setError(null)
    try {
      const { data: result, error: err } = await supabase.rpc('get_reliability_dashboard')
      if (err) throw err
      setData(result as unknown as ReliabilityDashboardData)
      cachedAt.current = Date.now()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchDashboard() }, [fetchDashboard])

  return { data, loading, error, refresh: () => fetchDashboard(true) }
}

export function useUserReliability(userId: string | undefined) {
  const [data, setData] = useState<UserReliabilityData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    supabase.rpc('get_user_reliability', { p_user_id: userId, p_days: 7 })
      .then(({ data: result, error }) => {
        if (error) console.warn('[Reliability] RPC error:', error.message)
        else if (result) setData(result as unknown as UserReliabilityData)
      })
      .then(() => setLoading(false))
  }, [userId])

  return { data, loading }
}
