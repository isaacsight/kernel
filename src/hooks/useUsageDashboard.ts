import { useState, useCallback, useRef } from 'react'
import { getAccessToken } from '../engine/SupabaseClient'

export interface UsageSummary {
  period: { start: string; end: string }
  summary: {
    totalRequests: number
    totalTokens: { input: number; output: number }
    estimatedCost: number
    topAgents: { agentId: string; count: number }[]
    topEndpoints: { endpoint: string; count: number }[]
    dailyUsage: { date: string; requests: number; tokens: number }[]
  }
  recentActivity: {
    action: string
    source: string
    timestamp: string
    metadata: Record<string, unknown>
  }[]
}

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export function useUsageDashboard() {
  const [data, setData] = useState<UsageSummary | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cacheRef = useRef<{ data: UsageSummary; ts: number } | null>(null)

  const fetch_ = useCallback(async (force = false) => {
    // Return cached if fresh
    if (!force && cacheRef.current && Date.now() - cacheRef.current.ts < CACHE_TTL) {
      setData(cacheRef.current.data)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const token = await getAccessToken()
      if (!token) throw new Error('Not authenticated')

      const url = import.meta.env.VITE_SUPABASE_URL as string
      const res = await globalThis.fetch(`${url}/functions/v1/usage-dashboard`, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_KEY as string,
        },
      })

      if (res.status === 403) {
        setError('Pro subscription required')
        return
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(body.error || `HTTP ${res.status}`)
      }

      const result = await res.json() as UsageSummary
      cacheRef.current = { data: result, ts: Date.now() }
      setData(result)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const refresh = useCallback(() => fetch_(true), [fetch_])

  return { data, isLoading, error, fetch: fetch_, refresh }
}
