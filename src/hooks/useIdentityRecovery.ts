import { useState, useCallback, useRef, useEffect } from 'react'
import { getAccessToken } from '../engine/SupabaseClient'

// ─── Types ───────────────────────────────────────────

export type RecoveryRequestType = 'password_reset' | 'email_change' | 'username_change'
export type RecoveryState = 'idle' | 'initiated' | 'challenged' | 'verified' | 'executed' | 'expired' | 'error'
export type TrustTier = 'standard' | 'elevated' | 'critical'

export interface RecoveryRequest {
  requestId: string
  requestType: RecoveryRequestType
  state: RecoveryState
  trustTier: TrustTier
  expiresAt: string
  maxAttempts: number
  challengeMethod?: string
  riskScore?: number
}

export interface IdentityEvent {
  id: number
  created_at: string
  event_type: string
  request_id: string | null
  ip_address: string | null
  device_id: string | null
  metadata: Record<string, unknown>
}

export interface DeviceInfo {
  id: string
  device_id: string
  device_name: string | null
  first_seen_at: string
  last_seen_at: string
  last_ip: string | null
  last_country: string | null
  is_trusted: boolean
  seen_count: number
}

interface RecoveryHookState {
  loading: boolean
  error: string | null
  request: RecoveryRequest | null
}

// ─── Device Fingerprint ──────────────────────────────
// Simple browser-based fingerprint (not a tracking vector — used for trust scoring)
function getDeviceFingerprint(): string {
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    screen.colorDepth,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.hardwareConcurrency || 0,
  ]
  // Simple hash — not cryptographically strong, but deterministic
  let hash = 0
  const str = components.join('|')
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return 'df_' + Math.abs(hash).toString(36)
}

function getDeviceName(): string {
  const ua = navigator.userAgent
  const browser = /Chrome/.test(ua) ? 'Chrome'
    : /Safari/.test(ua) ? 'Safari'
    : /Firefox/.test(ua) ? 'Firefox'
    : 'Browser'
  const os = /Mac/.test(ua) ? 'macOS'
    : /Windows/.test(ua) ? 'Windows'
    : /Linux/.test(ua) ? 'Linux'
    : /iPhone|iPad/.test(ua) ? 'iOS'
    : /Android/.test(ua) ? 'Android'
    : 'Unknown'
  return `${browser} on ${os}`
}

// ─── API Helper ──────────────────────────────────────

async function callIdentityAPI(body: Record<string, unknown>): Promise<{ data?: Record<string, unknown>; error?: string; status: number }> {
  const token = await getAccessToken()
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_KEY || ''

  const res = await fetch(`${url}/functions/v1/identity-recovery`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: key,
    },
    body: JSON.stringify({
      ...body,
      device_id: getDeviceFingerprint(),
      device_name: getDeviceName(),
    }),
  })

  const data = await res.json().catch(() => ({ error: 'Invalid response' }))

  if (!res.ok) {
    return { error: data.error || `HTTP ${res.status}`, status: res.status }
  }

  return { data, status: res.status }
}

// ─── Hook ────────────────────────────────────────────

export function useIdentityRecovery() {
  const [state, setState] = useState<RecoveryHookState>({
    loading: false,
    error: null,
    request: null,
  })
  const [cooldown, setCooldown] = useState(0)
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Cleanup
  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current)
    }
  }, [])

  const startCooldown = useCallback((seconds: number) => {
    setCooldown(seconds)
    if (cooldownRef.current) clearInterval(cooldownRef.current)
    cooldownRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current)
          cooldownRef.current = null
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  // ── Initiate Recovery ──────────────────────────────
  const initiate = useCallback(async (requestType: RecoveryRequestType, newValue?: string) => {
    setState({ loading: true, error: null, request: null })
    try {
      const { data, error, status } = await callIdentityAPI({
        action: 'initiate',
        request_type: requestType,
        new_value: newValue,
      })

      if (error) {
        setState({ loading: false, error, request: null })
        return null
      }

      const request: RecoveryRequest = {
        requestId: data!.request_id as string,
        requestType,
        state: 'initiated',
        trustTier: data!.trust_tier as TrustTier,
        expiresAt: data!.expires_at as string,
        maxAttempts: data!.max_attempts as number,
      }

      setState({ loading: false, error: null, request })
      return request
    } catch {
      setState({ loading: false, error: 'Network error', request: null })
      return null
    }
  }, [])

  // ── Send Challenge ─────────────────────────────────
  const sendChallenge = useCallback(async (requestId: string) => {
    if (cooldown > 0) return false
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const { data, error } = await callIdentityAPI({
        action: 'challenge',
        request_id: requestId,
      })

      if (error) {
        setState(s => ({ ...s, loading: false, error }))
        return false
      }

      setState(s => ({
        ...s,
        loading: false,
        request: s.request ? {
          ...s.request,
          state: 'challenged',
          challengeMethod: data!.method as string,
        } : null,
      }))
      startCooldown(60)
      return true
    } catch {
      setState(s => ({ ...s, loading: false, error: 'Network error' }))
      return false
    }
  }, [cooldown, startCooldown])

  // ── Verify Challenge ───────────────────────────────
  const verify = useCallback(async (requestId: string, code: string) => {
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const { data, error, status } = await callIdentityAPI({
        action: 'verify',
        request_id: requestId,
        token: code,
      })

      if (error) {
        const msg = error === 'invalid_token' ? 'Invalid code. Try again.'
          : error === 'expired' ? 'Request expired. Start over.'
          : error === 'max_attempts' ? 'Too many attempts. Start over.'
          : error
        setState(s => ({ ...s, loading: false, error: msg }))
        return false
      }

      setState(s => ({
        ...s,
        loading: false,
        request: s.request ? { ...s.request, state: 'verified' } : null,
      }))
      return true
    } catch {
      setState(s => ({ ...s, loading: false, error: 'Network error' }))
      return false
    }
  }, [])

  // ── Execute Credential Change ──────────────────────
  const execute = useCallback(async (requestId: string, newValue?: string) => {
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const { data, error } = await callIdentityAPI({
        action: 'execute',
        request_id: requestId,
        new_value: newValue,
      })

      if (error) {
        setState(s => ({ ...s, loading: false, error }))
        return false
      }

      setState(s => ({
        ...s,
        loading: false,
        request: s.request ? { ...s.request, state: 'executed' } : null,
      }))
      return true
    } catch {
      setState(s => ({ ...s, loading: false, error: 'Network error' }))
      return false
    }
  }, [])

  // ── Get Audit Trail ────────────────────────────────
  const getAuditTrail = useCallback(async (limit = 50, offset = 0): Promise<{ events: IdentityEvent[]; total: number } | null> => {
    try {
      const { data, error } = await callIdentityAPI({
        action: 'audit',
        limit,
        offset,
      })
      if (error || !data) return null
      return {
        events: data.events as IdentityEvent[],
        total: data.total as number,
      }
    } catch {
      return null
    }
  }, [])

  // ── Get Known Devices ──────────────────────────────
  const getDevices = useCallback(async (): Promise<DeviceInfo[] | null> => {
    try {
      const { data, error } = await callIdentityAPI({ action: 'devices' })
      if (error || !data) return null
      return data.devices as DeviceInfo[]
    } catch {
      return null
    }
  }, [])

  // ── Reset state ────────────────────────────────────
  const reset = useCallback(() => {
    setState({ loading: false, error: null, request: null })
  }, [])

  return {
    ...state,
    cooldown,
    initiate,
    sendChallenge,
    verify,
    execute,
    getAuditTrail,
    getDevices,
    reset,
  }
}
