import { useState, useCallback } from 'react'
import { supabase } from '../engine/SupabaseClient'
import type { PlanId } from '../config/planLimits'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://eoxxpyixdieprsxlpwcs.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || ''

/** Get a guaranteed-fresh access token by forcing a session refresh */
async function getFreshToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.refreshSession()
  return session?.access_token || null
}

async function callCheckout(token: string, plan: string) {
  return fetch(`${SUPABASE_URL}/functions/v1/create-checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_KEY,
    },
    body: JSON.stringify({
      mode: 'subscription',
      plan,
      success_url: `${window.location.origin}${window.location.pathname}#/?checkout=complete`,
      cancel_url: window.location.href,
    }),
  })
}

export function useBilling(
  user: { id: string; email?: string } | null,
  showToast: (msg: string) => void,
  signOut: () => void,
) {
  // Upgrade wall disabled — Kernel is free (10 msgs/day). Set to true to re-enable.
  const UPGRADES_ENABLED = false
  const [showUpgradeWall, _setShowUpgradeWall] = useState(false)
  const setShowUpgradeWall = UPGRADES_ENABLED ? _setShowUpgradeWall : () => {}
  const [freeLimitResetsAt, setFreeLimitResetsAt] = useState<string | null>(null)
  const [upgradeLoading, setUpgradeLoading] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [portalError, setPortalError] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const handleUpgrade = useCallback(async (plan: string = 'free') => {
    if (!user?.email || upgradeLoading) return
    setUpgradeLoading(true)
    try {
      // Force a fresh token — prevents stale JWT 401s
      const token = await getFreshToken()
      if (!token) {
        showToast('Session expired. Please sign in again.')
        setUpgradeLoading(false)
        return
      }

      const res = await callCheckout(token, plan)

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        console.error('[Billing] Checkout error:', res.status, data)
        throw new Error(data?.error || data?.details || `Checkout failed (${res.status})`)
      }
      const { url } = await res.json()
      if (url) window.location.href = url
    } catch (err) {
      console.error('[Billing] handleUpgrade error:', err)
      showToast(err instanceof Error && err.message !== 'Failed to fetch'
        ? err.message
        : 'Unable to start checkout. Please try again.')
    } finally {
      setUpgradeLoading(false)
    }
  }, [user, upgradeLoading, showToast])

  const handleManageSubscription = useCallback(async () => {
    if (!user?.email || portalLoading) return
    setPortalError('')
    setPortalLoading(true)
    try {
      const token = await getFreshToken()
      if (!token) { setPortalError('Session expired. Please sign in again.'); return }
      const res = await fetch(`${SUPABASE_URL}/functions/v1/create-portal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: SUPABASE_KEY,
        },
        body: JSON.stringify({ return_url: window.location.href }),
      })
      let data: Record<string, string> = {}
      const contentType = res.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        try { data = await res.json() } catch { /* empty JSON body */ }
      } else {
        const text = await res.text()
        console.error('Portal non-JSON response:', res.status, text)
        setPortalError(`Portal error (${res.status})`)
        return
      }
      if (!res.ok) {
        console.error('Portal error:', res.status, data)
        setPortalError(data?.error || data?.message || data?.msg || `Portal error (${res.status})`)
        return
      }
      if (data.url) window.location.href = data.url
    } catch (err) {
      console.error('Manage subscription error:', err)
      setPortalError(`Billing portal error: ${err instanceof Error ? err.message : 'Please try again.'}`)
    } finally {
      setPortalLoading(false)
    }
  }, [user, portalLoading])

  const handleDeleteAccount = useCallback(async () => {
    if (!user || deleteLoading) return
    setDeleteLoading(true)
    try {
      const token = await getFreshToken()
      if (!token) { showToast('Session expired. Please sign in again.'); return }
      const res = await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: SUPABASE_KEY,
        },
      })
      if (!res.ok) throw new Error('Delete failed')
      await signOut()
    } catch {
      showToast('Failed to delete account. Please try again.')
      setDeleteLoading(false)
      setShowDeleteConfirm(false)
    }
  }, [user, deleteLoading, signOut, showToast])

  return {
    showUpgradeWall, setShowUpgradeWall, freeLimitResetsAt, setFreeLimitResetsAt,
    upgradeLoading,
    portalLoading, portalError, setPortalError,
    showDeleteConfirm, setShowDeleteConfirm,
    deleteLoading,
    handleUpgrade, handleManageSubscription, handleDeleteAccount,
  }
}
