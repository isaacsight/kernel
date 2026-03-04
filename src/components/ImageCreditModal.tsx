import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { getAccessToken } from '../engine/SupabaseClient'
import { getAutoReload, setAutoReload, type AutoReloadSettings } from '../engine/imageGen'
import { IconClose } from './KernelIcons'
import { TRANSITION } from '../constants/motion'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://eoxxpyixdieprsxlpwcs.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || ''

interface Pack {
  id: 'starter' | 'standard' | 'power'
  name: string
  credits: number
  price: string
  popular?: boolean
}

const PACKS: Pack[] = [
  { id: 'starter', name: 'Starter', credits: 25, price: '$4.99' },
  { id: 'standard', name: 'Standard', credits: 75, price: '$12.99', popular: true },
  { id: 'power', name: 'Power', credits: 200, price: '$29.99' },
]

interface ImageCreditModalProps {
  open: boolean
  onClose: () => void
  credits: number
  onToast: (msg: string) => void
}

export function ImageCreditModal({ open, onClose, credits, onToast }: ImageCreditModalProps) {
  const [loading, setLoading] = useState<string | null>(null)
  const [reloadSettings, setReloadSettings] = useState<AutoReloadSettings | null>(null)
  const [reloadSaving, setReloadSaving] = useState(false)

  // Load auto-reload settings when modal opens
  useEffect(() => {
    if (!open) return
    let cancelled = false
    getAutoReload().then(s => { if (!cancelled) setReloadSettings(s) })
    return () => { cancelled = true }
  }, [open])

  const handlePurchase = async (pack: Pack) => {
    setLoading(pack.id)
    try {
      const token = await getAccessToken()
      const res = await fetch(`${SUPABASE_URL}/functions/v1/create-image-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: SUPABASE_KEY,
        },
        body: JSON.stringify({
          pack: pack.id,
          success_url: `${window.location.origin}${window.location.pathname}#/?credits=purchased`,
          cancel_url: window.location.href,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new Error(data.error || `Checkout failed (${res.status})`)
      }
      const { url } = await res.json()
      if (url) window.location.href = url
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Could not start checkout')
    } finally {
      setLoading(null)
    }
  }

  const handleToggleReload = async () => {
    if (!reloadSettings) return
    setReloadSaving(true)
    try {
      if (reloadSettings.enabled) {
        // Disable
        await setAutoReload(null)
        setReloadSettings({ ...reloadSettings, enabled: false, pack: null })
      } else {
        // Enable with default pack (standard)
        const pack = 'standard'
        await setAutoReload(pack, reloadSettings.threshold)
        setReloadSettings({ ...reloadSettings, enabled: true, pack })
      }
    } catch {
      onToast('Failed to update auto-reload')
    } finally {
      setReloadSaving(false)
    }
  }

  const handlePackChange = async (packId: string) => {
    if (!reloadSettings) return
    setReloadSaving(true)
    try {
      await setAutoReload(packId, reloadSettings.threshold)
      setReloadSettings({ ...reloadSettings, pack: packId })
    } catch {
      onToast('Failed to update auto-reload')
    } finally {
      setReloadSaving(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="ka-credit-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={e => { if (e.target === e.currentTarget) onClose() }}
        >
          <motion.div
            className="ka-credit-modal"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={TRANSITION.CARD}
          >
            <button className="ka-credit-close" onClick={onClose} aria-label="Close">
              <IconClose size={16} />
            </button>
            <h2 className="ka-credit-title">Image Credits</h2>
            <p className="ka-credit-balance">
              You have <strong>{credits}</strong> credit{credits !== 1 ? 's' : ''} remaining
            </p>
            <div className="ka-credit-packs">
              {PACKS.map(pack => (
                <button
                  key={pack.id}
                  className={`ka-credit-pack ${pack.popular ? 'ka-credit-pack--popular' : ''}`}
                  onClick={() => handlePurchase(pack)}
                  disabled={loading !== null}
                >
                  {pack.popular && <span className="ka-credit-pack-badge">Most Popular</span>}
                  <span className="ka-credit-pack-name">{pack.name}</span>
                  <span className="ka-credit-pack-credits">{pack.credits} images</span>
                  <span className="ka-credit-pack-price">{pack.price}</span>
                  {loading === pack.id && <span className="ka-credit-pack-loading">...</span>}
                </button>
              ))}
            </div>

            {/* Auto-reload section */}
            {reloadSettings && (
              <div className="ka-credit-autoreload">
                <div className="ka-credit-autoreload-divider" />
                <div className="ka-credit-autoreload-header">
                  <div className="ka-credit-autoreload-label">
                    <span className="ka-credit-autoreload-title">Auto-reload</span>
                    <span className="ka-credit-autoreload-desc">
                      Replenish credits when you run low
                    </span>
                  </div>
                  <button
                    className={`ka-credit-toggle ${reloadSettings.enabled ? 'ka-credit-toggle--on' : ''}`}
                    onClick={handleToggleReload}
                    disabled={reloadSaving || !reloadSettings.has_payment_method}
                    aria-label="Toggle auto-reload"
                    role="switch"
                    aria-checked={reloadSettings.enabled}
                  >
                    <span className="ka-credit-toggle-knob" />
                  </button>
                </div>

                {!reloadSettings.has_payment_method && (
                  <p className="ka-credit-autoreload-hint">
                    Purchase a pack first to save your card
                  </p>
                )}

                {reloadSettings.enabled && reloadSettings.has_payment_method && (
                  <div className="ka-credit-pack-radios">
                    {PACKS.map(pack => (
                      <label
                        key={pack.id}
                        className={`ka-credit-pack-radio ${reloadSettings.pack === pack.id ? 'ka-credit-pack-radio--selected' : ''}`}
                      >
                        <input
                          type="radio"
                          name="auto-reload-pack"
                          value={pack.id}
                          checked={reloadSettings.pack === pack.id}
                          onChange={() => handlePackChange(pack.id)}
                          disabled={reloadSaving}
                        />
                        <span className="ka-credit-pack-radio-name">{pack.name}</span>
                        <span className="ka-credit-pack-radio-detail">
                          {pack.credits} credits &middot; {pack.price}
                        </span>
                      </label>
                    ))}
                    <p className="ka-credit-autoreload-threshold">
                      Triggers when credits drop to {reloadSettings.threshold} or below
                    </p>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
