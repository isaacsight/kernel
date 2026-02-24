import { useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import type { PasswordStrength } from '../hooks/useAccountSettings'

function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return 'none'
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^a-zA-Z0-9]/.test(password)) score++
  if (score <= 1) return 'weak'
  if (score <= 3) return 'fair'
  return 'strong'
}

interface SetNewPasswordModalProps {
  onSubmit: (password: string) => Promise<{ error: string | null }>
  onDismiss: () => void
  onToast: (msg: string) => void
}

export function SetNewPasswordModal({ onSubmit, onDismiss, onToast }: SetNewPasswordModalProps) {
  const { t } = useTranslation('auth')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const strength = getPasswordStrength(password)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError(t('setPassword.tooShort'))
      return
    }
    if (password !== confirm) {
      setError(t('setPassword.mismatch'))
      return
    }

    setLoading(true)
    try {
      const result = await onSubmit(password)
      if (result.error) {
        setError(result.error)
      } else {
        onToast(t('setPassword.success'))
        onDismiss()
      }
    } catch {
      setError(t('modal.error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      className="ka-upgrade-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="ka-upgrade-modal"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
      >
        <h2 className="ka-upgrade-title">{t('setPassword.title')}</h2>
        <p className="ka-upgrade-subtitle">{t('setPassword.subtitle')}</p>

        <form onSubmit={handleSubmit} style={{ width: '100%' }}>
          <input
            type="password"
            className="ka-gate-input"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder={t('setPassword.newPasswordPlaceholder')}
            autoFocus
            required
            minLength={8}
          />

          {/* Password Strength Indicator */}
          {strength !== 'none' && (
            <div className="ka-settings-strength" style={{ marginBottom: '8px' }}>
              <div className="ka-settings-strength-bar">
                <div className={`ka-settings-strength-fill ka-settings-strength-fill--${strength}`} />
              </div>
              <span className={`ka-settings-strength-label ka-settings-strength-label--${strength}`}>
                {t(`setPassword.strength.${strength}`)}
              </span>
            </div>
          )}

          <input
            type="password"
            className="ka-gate-input"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder={t('setPassword.confirmPlaceholder')}
            required
            minLength={8}
          />
          {error && <p className="ka-gate-error">{error}</p>}
          <button
            type="submit"
            className="ka-gate-submit"
            disabled={loading || !password || !confirm}
          >
            {loading ? t('loading', { ns: 'common' }) : t('setPassword.submit')}
          </button>
        </form>

        <button className="ka-upgrade-dismiss" onClick={onDismiss}>
          {t('setPassword.skipForNow')}
        </button>
      </motion.div>
    </motion.div>
  )
}
