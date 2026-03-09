import { useState, useCallback } from 'react'
import { supabase } from '../engine/SupabaseClient'

export interface ApiKey {
  id: string
  name: string
  key_prefix: string
  tier: string
  status: 'active' | 'revoked'
  monthly_message_limit: number
  rate_limit_per_min: number
  monthly_message_count: number
  overage_enabled: boolean
  overage_count: number
  max_monthly_spend_cents: number | null
  last_used_at: string | null
  revoked_at: string | null
  created_at: string
}

interface ApiKeysState {
  keys: ApiKey[]
  loading: boolean
  error: string | null
  /** Full key string — shown once after create/rotate, then cleared */
  newKey: string | null
}

export function useApiKeys() {
  const [state, setState] = useState<ApiKeysState>({
    keys: [],
    loading: false,
    error: null,
    newKey: null,
  })

  const invoke = useCallback(async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('api-keys', { body })
    if (error) throw new Error(error.message || 'Request failed')
    return data
  }, [])

  const fetchKeys = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const data = await invoke({ action: 'list' })
      setState(s => ({ ...s, keys: data.keys || [], loading: false }))
    } catch (err: any) {
      setState(s => ({ ...s, loading: false, error: err.message }))
    }
  }, [invoke])

  const createKey = useCallback(async (name: string) => {
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const data = await invoke({ action: 'create', name })
      setState(s => ({ ...s, newKey: data.key, loading: false }))
      await fetchKeys()
    } catch (err: any) {
      setState(s => ({ ...s, loading: false, error: err.message }))
    }
  }, [invoke, fetchKeys])

  const revokeKey = useCallback(async (keyId: string) => {
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      await invoke({ action: 'revoke', key_id: keyId })
      await fetchKeys()
    } catch (err: any) {
      setState(s => ({ ...s, loading: false, error: err.message }))
    }
  }, [invoke, fetchKeys])

  const rotateKey = useCallback(async (keyId: string) => {
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const data = await invoke({ action: 'rotate', key_id: keyId })
      setState(s => ({ ...s, newKey: data.key, loading: false }))
      await fetchKeys()
    } catch (err: any) {
      setState(s => ({ ...s, loading: false, error: err.message }))
    }
  }, [invoke, fetchKeys])

  const setCeiling = useCallback(async (keyId: string, cents: number | null) => {
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      await invoke({ action: 'set-ceiling', key_id: keyId, max_monthly_spend_cents: cents })
      await fetchKeys()
    } catch (err: any) {
      setState(s => ({ ...s, loading: false, error: err.message }))
    }
  }, [invoke, fetchKeys])

  const clearNewKey = useCallback(() => {
    setState(s => ({ ...s, newKey: null }))
  }, [])

  return {
    ...state,
    fetchKeys,
    createKey,
    revokeKey,
    rotateKey,
    setCeiling,
    clearNewKey,
  }
}
