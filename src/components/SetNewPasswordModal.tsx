import { useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { getPasswordStrength } from '../hooks/useAccountSettings'
import { VARIANT, TRANSITION } from '../constants/motion'

interface SetNewPasswordModalProps {
  onUpdatePassword: (password: string) => Promise<{ error: string | null }>
  onUpdateEmail: (email: string) => Promise<{ error: string | null }>
  onUpdateProfile: (data: { username: string }) => Promise<{ error: string | null }>
  onDismiss: () => void
  onToast: (msg: string) => void
  currentEmail?: string
  currentUsername?: string
}

export function SetNewPasswordModal({
  onUpdatePassword, onUpdateEmail, onUpdateProfile,
  onDismiss, onToast,
  currentEmail, currentUsername,
}: SetNewPasswordModalProps) {
  const { t } = useTranslation('auth')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [username, setUsername] = useState(currentUsername || '')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const strength = getPasswordStrength(password)

  const hasPasswordChange = password.length > 0
  const hasUsernameChange = username.trim() !== (currentUsername || '')
  const hasEmailChange = email.trim().length > 0 && email.trim() !== (currentEmail || '')
  const hasAnyChange = hasPasswordChange || hasUsernameChange || hasEmailChange

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (hasPasswordChange) {
      if (password.length < 8) {
        setError(t('setPassword.tooShort'))
        return
      }
      if (password !== confirm) {
        setError(t('setPassword.mismatch'))
        return
      }
    }

    if (hasEmailChange && !email.includes('@')) {
      setError(t('setPassword.invalidEmail'))
      return
    }

    setLoading(true)
    try {
      const results: string[] = []

      if (hasPasswordChange) {
        const r = await onUpdatePassword(password)
        if (r.error) { setError(r.error); setLoading(false); return }
        results.push('password')
      }

      if (hasUsernameChange) {
        const r = await onUpdateProfile({ username: username.trim() })
        if (r.error) { setError(r.error); setLoading(false); return }
        results.push('username')
      }

      if (hasEmailChange) {
        const r = await onUpdateEmail(email.trim())
        if (r.error) { setError(r.error); setLoading(false); return }
        results.push('email')
      }

      const msg = results.includes('email')
        ? t('setPassword.successWithEmail')
        : t('setPassword.success')
      onToast(msg)
      onDismiss()
    } catch {
      setError(t('modal.error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      className="ka-upgrade-overlay"
      variants={VARIANT.FADE}
      initial="hidden"
      animate="visible"
      exit="hidden"
      transition={TRANSITION.OVERLAY}
    >
      <motion.div
        className="ka-upgrade-modal"
        variants={VARIANT.FADE_SCALE}
        initial="hidden"
        animate="visible"
        exit="hidden"
        transition={TRANSITION.CARD}
        style={{ maxWidth: 420 }}
      >
        <h2 className="ka-upgrade-title">{t('setPassword.title')}</h2>
        <p className="ka-upgrade-subtitle">{t('setPassword.subtitle')}</p>

        <form onSubmit={handleSubmit} style={{ width: '100%' }}>
          {/* Password */}
          <span className="ka-settings-label">{t('setPassword.passwordLabel')}</span>
          <input
            type="password"
            className="ka-gate-input"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder={t('setPassword.newPasswordPlaceholder')}
            autoFocus
            autoComplete="new-password"
          />

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

          {hasPasswordChange && (
            <input
              type="password"
              className="ka-gate-input"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder={t('setPassword.confirmPlaceholder')}
              autoComplete="new-password"
            />
          )}

          {/* Username */}
          <span className="ka-settings-label" style={{ marginTop: 12, display: 'block' }}>{t('setPassword.usernameLabel')}</span>
          <input
            type="text"
            className="ka-gate-input"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder={t('setPassword.usernamePlaceholder')}
          />

          {/* Email */}
          <span className="ka-settings-label" style={{ marginTop: 12, display: 'block' }}>{t('setPassword.emailLabel')}</span>
          <input
            type="email"
            className="ka-gate-input"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder={currentEmail || t('setPassword.emailPlaceholder')}
          />

          {error && <p className="ka-gate-error">{error}</p>}
          <button
            type="submit"
            className="ka-gate-submit"
            disabled={loading || !hasAnyChange}
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
