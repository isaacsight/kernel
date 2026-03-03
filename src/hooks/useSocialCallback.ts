// ─── useSocialCallback Hook ─────────────────────────────────────
// Handles the OAuth callback after social platform authorization.

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://eoxxpyixdieprsxlpwcs.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || ''

export function useSocialCallback() {
  const { platform } = useParams<{ platform: string }>()
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [accountName, setAccountName] = useState<string | null>(null)

  useEffect(() => {
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const errorParam = searchParams.get('error')

    if (errorParam) {
      setStatus('error')
      setError(searchParams.get('error_description') || 'Authorization denied')
      return
    }

    if (!code || !state) {
      setStatus('error')
      setError('Missing authorization code')
      return
    }

    async function exchangeCode() {
      try {
        const { getAccessToken } = await import('../engine/SupabaseClient')
        const token = await getAccessToken()
        if (!token) {
          setStatus('error')
          setError('Not signed in')
          return
        }

        const res = await fetch(`${SUPABASE_URL}/functions/v1/social-auth`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'apikey': SUPABASE_KEY,
          },
          body: JSON.stringify({
            action: 'exchange_code',
            code,
            state,
          }),
        })

        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: 'Exchange failed' }))
          throw new Error(body.error || 'Failed to connect account')
        }

        const { account } = await res.json()
        setAccountName(account?.platformDisplayName || account?.platformUsername || platform)
        setStatus('success')

        // Notify opener window
        if (window.opener) {
          window.opener.postMessage({
            type: 'social-auth-success',
            platform,
            account,
          }, window.location.origin)
        }

        // Auto-close after brief delay
        setTimeout(() => window.close(), 2000)
      } catch (err) {
        setStatus('error')
        setError(err instanceof Error ? err.message : 'Connection failed')
      }
    }

    exchangeCode()
  }, [platform, searchParams])

  return { platform, status, error, accountName }
}
