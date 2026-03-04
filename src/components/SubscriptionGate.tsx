import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { useAuthContext } from '../providers/AuthProvider'
import { getAccessToken } from '../engine/SupabaseClient'
import { TRANSITION } from '../constants/motion'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://eoxxpyixdieprsxlpwcs.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || ''
const PRICE_ID = import.meta.env.VITE_STRIPE_KERNEL_PRICE_ID || ''

export function SubscriptionGate() {
  const { t } = useTranslation('auth')
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
      setError(t('subscription.checkoutError'))
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
          <h1 className="ka-gate-title">{t('subscription.activating')}</h1>
          <p className="ka-gate-subtitle">{t('subscription.activatingDesc')}</p>
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
        transition={TRANSITION.SECTION}
      >
        <div className="ka-gate-icon">K</div>
        <h1 className="ka-gate-title">{t('subscription.title')}</h1>
        <p className="ka-gate-subtitle">
          {t('subscription.signedInAs', { email: user?.email })}
        </p>
        <p className="ka-gate-price">{t('subscription.price')}<span>{t('subscription.pricePeriod')}</span></p>

        <div className="ka-gate-features">
          <div className="ka-gate-feature">{t('subscription.feature2')}</div>
          <div className="ka-gate-feature">{t('subscription.feature3')}</div>
          <div className="ka-gate-feature">{t('subscription.feature4')}</div>
        </div>

        <button
          className="ka-gate-submit"
          onClick={handleSubscribe}
          disabled={loading}
          style={{ width: '100%', marginBottom: 16 }}
        >
          {loading ? t('loading', { ns: 'common' }) : t('subscription.button')}
        </button>

        {error && <p className="ka-gate-error">{error}</p>}

        <button className="ka-gate-admin-toggle" onClick={signOut}>
          {t('subscription.signOut')}
        </button>
      </motion.div>
    </div>
  )
}
