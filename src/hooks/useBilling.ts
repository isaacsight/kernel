import { useState, useCallback } from 'react'
import { supabase } from '../engine/SupabaseClient'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://eoxxpyixdieprsxlpwcs.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || ''

export type CreditPack = 'starter' | 'standard' | 'pro' | 'max'

export const CREDIT_PACKS: Record<CreditPack, { label: string; price: string; cents: number }> = {
  starter:  { label: '$5',   price: '$5',   cents: 500 },
  standard: { label: '$20',  price: '$20',  cents: 2000 },
  pro:      { label: '$50',  price: '$50',  cents: 5000 },
  max:      { label: '$100', price: '$100', cents: 10000 },
}

/** Get a guaranteed-fresh access token by forcing a session refresh */
async function getFreshToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.refreshSession()
  return session?.access_token || null
}

export function useBilling(
  user: { id: string; email?: string } | null,
  showToast: (msg: string) => void,
  signOut: () => void,
) {
  const [creditBalance, setCreditBalance] = useState<number>(0)
  const [upgradeLoading, setUpgradeLoading] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [portalError, setPortalError] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Load credit balance from Supabase
  const refreshBalance = useCallback(async () => {
    if (!user?.id) return
    const { data } = await supabase.rpc('check_credit_balance', { p_user_id: user.id })
    if (data?.balance_cents != null) {
      setCreditBalance(data.balance_cents)
    }
  }, [user?.id])

  // Buy a credit pack (one-time Stripe checkout)
  const handleBuyCredits = useCallback(async (pack: CreditPack = 'starter') => {
    if (!user?.email || upgradeLoading) return
    setUpgradeLoading(true)
    try {
      const token = await getFreshToken()
      if (!token) {
        showToast('Session expired. Please sign in again.')
        setUpgradeLoading(false)
        return
      }

      const res = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: SUPABASE_KEY,
        },
        body: JSON.stringify({
          mode: 'payment',
          credit_pack: pack,
          success_url: `${window.location.origin}${window.location.pathname}#/?credits=added`,
          cancel_url: window.location.href,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new Error(data?.error || data?.details || `Checkout failed (${res.status})`)
      }
      const { url } = await res.json()
      if (url) window.location.href = url
    } catch (err) {
      console.error('[Billing] handleBuyCredits error:', err)
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
    creditBalance, setCreditBalance, refreshBalance,
    upgradeLoading,
    portalLoading, portalError, setPortalError,
    showDeleteConfirm, setShowDeleteConfirm,
    deleteLoading,
    handleBuyCredits, handleManageSubscription, handleDeleteAccount,
  }
}
