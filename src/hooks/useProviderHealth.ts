import { useState, useEffect, useRef } from 'react'
import { supabase } from '../engine/SupabaseClient'

export interface ProviderScore {
  provider: string
  score: number
  total_requests: number
  error_count: number
  timeout_count: number
}

export type SystemStatus = 'healthy' | 'degraded' | 'down'

export interface ProviderHealthState {
  providers: ProviderScore[]
  status: SystemStatus
  degradedProviders: string[]
  loading: boolean
}

const POLL_INTERVAL_MS = 60_000  // 1 minute

export function useProviderHealth(): ProviderHealthState {
  const [providers, setProviders] = useState<ProviderScore[]>([])
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    async function fetch() {
      try {
        const { data } = await supabase
          .from('provider_health')
          .select('provider, score, total_requests, error_count, timeout_count')
          .eq('time_window', '15m')

        if (data) {
          setProviders(data.map(d => ({
            provider: d.provider,
            score: Number(d.score),
            total_requests: d.total_requests,
            error_count: d.error_count,
            timeout_count: d.timeout_count,
          })))
        }
      } catch {
        // fail silent
      } finally {
        setLoading(false)
      }
    }

    fetch()
    intervalRef.current = setInterval(fetch, POLL_INTERVAL_MS)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  // Compute overall status
  const degradedProviders = providers.filter(p => p.score < 80 && p.total_requests > 0).map(p => p.provider)
  const downProviders = providers.filter(p => p.score < 30 && p.total_requests > 0)

  let status: SystemStatus = 'healthy'
  if (downProviders.length > 0) status = 'down'
  else if (degradedProviders.length > 0) status = 'degraded'

  return { providers, status, degradedProviders, loading }
}
