import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useAuthContext } from '../providers/AuthProvider'
import { getAccessToken } from '../engine/SupabaseClient'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://eoxxpyixdieprsxlpwcs.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || ''
const PRICE_ID = import.meta.env.VITE_STRIPE_KERNEL_PRICE_ID || ''

export function SubscriptionGate() {
  const { user, refreshSubscription, signOut } = useAuthContext()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [polling, setPolling] = useState(false)

  // After Stripe redirect, poll for webhook completion
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '')
    if (params.get('checkout') === 'complete') {
      setPolling(true)
      let attempts = 0
      const interval = setInterval(async () => {
        attempts++
        const active = await refreshSubscription()
        if (active || attempts >= 15) {
          clearInterval(interval)
          setPolling(false)
          // Clean up URL
          window.location.hash = '#/'
        }
      }, 2000)
      return () => clearInterval(interval)
    }
  }, [refreshSubscription])

  const handleSubscribe = async () => {
    if (!user?.email) return
    setLoading(true)
    setError('')
    try {
      const token = await getAccessToken()
      const res = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: SUPABASE_KEY,
        },
        body: JSON.stringify({
          mode: 'subscription',
          price_id: PRICE_ID,
          success_url: `${window.location.origin}${window.location.pathname}#/?checkout=complete`,
          cancel_url: window.location.href,
        }),
      })
      if (!res.ok) throw new Error('Failed to create checkout')
      const { url } = await res.json()
      if (url) window.location.href = url
    } catch {
      setError('Unable to start checkout. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (polling) {
    return (
      <div className="ka-gate">
        <motion.div
          className="ka-gate-card"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="ka-gate-icon">K</div>
          <h1 className="ka-gate-title">Activating...</h1>
          <p className="ka-gate-subtitle">Confirming your subscription. This usually takes a few seconds.</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="ka-gate">
      <motion.div
        className="ka-gate-card"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="ka-gate-icon">K</div>
        <h1 className="ka-gate-title">Subscribe to Kernel</h1>
        <p className="ka-gate-subtitle">
          Signed in as {user?.email}. Subscribe to access the Antigravity Kernel.
        </p>
        <p className="ka-gate-price">$20<span>/month</span></p>

        <div className="ka-gate-features">
          <div className="ka-gate-feature">Conversational AI with web search</div>
          <div className="ka-gate-feature">Real-time cognitive engine observability</div>
          <div className="ka-gate-feature">Belief and conviction management</div>
          <div className="ka-gate-feature">Unlimited messages</div>
        </div>

        <button
          className="ka-gate-submit"
          onClick={handleSubscribe}
          disabled={loading}
          style={{ width: '100%', marginBottom: 16 }}
        >
          {loading ? 'Loading...' : 'Subscribe — $20/mo'}
        </button>

        {error && <p className="ka-gate-error">{error}</p>}

        <button className="ka-gate-admin-toggle" onClick={signOut}>
          Sign out
        </button>
      </motion.div>
    </div>
  )
}
