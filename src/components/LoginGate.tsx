import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useAuthContext } from '../providers/AuthProvider'
import { usePWAInstall } from '../hooks/usePWAInstall'
import { IconClose } from './KernelIcons'

export function LoginGate() {
  const { t } = useTranslation('auth')
  const { signInWithProvider, signInWithEmail, signUpWithEmail, resetPassword } = useAuthContext()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const pwa = usePWAInstall()

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password.trim()) return
    setLoading(true)
    setError('')
    setSuccessMsg('')
    try {
      const result = isSignUp
        ? await signUpWithEmail(email.trim(), password)
        : await signInWithEmail(email.trim(), password)
      if (result.error) setError(result.error)
    } catch {
      setError(t('modal.error'))
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async () => {
    if (!email.trim()) {
      setError(t('modal.enterEmailFirst'))
      return
    }
    setLoading(true)
    setError('')
    setSuccessMsg('')
    try {
      const result = await resetPassword(email.trim())
      if (result.error) setError(result.error)
      else setSuccessMsg(t('modal.resetSent'))
    } catch {
      setError(t('modal.error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="landing">
      {/* Hero */}
      <motion.section
        className="landing-hero"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        <img className="landing-hero-art" src={`${import.meta.env.BASE_URL}concepts/hero-darkmode.svg`} alt="" aria-hidden="true" />
        <img className="landing-logo" src={`${import.meta.env.BASE_URL}logo-mark.svg`} alt="Kernel" />
        <h1 className="landing-title">{t('login.title')}</h1>
        <p className="landing-subtitle">
          {t('login.subtitle')}
        </p>
        <button className="landing-cta" onClick={() => setShowAuth(true)}>
          {t('login.cta')}
        </button>
        <p className="landing-hint">{t('login.hint')}</p>
      </motion.section>

      {/* Features */}
      <motion.section
        className="landing-features"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <div className="landing-feature">
          <img className="landing-feature-emblem" src={`${import.meta.env.BASE_URL}concepts/emblem-kernel.svg`} alt="" aria-hidden="true" />
          <h3>{t('login.feature1Title')}</h3>
          <p>{t('login.feature1Desc')}</p>
        </div>
        <div className="landing-feature">
          <img className="landing-feature-emblem" src={`${import.meta.env.BASE_URL}concepts/emblem-researcher.svg`} alt="" aria-hidden="true" />
          <h3>{t('login.feature2Title')}</h3>
          <p>{t('login.feature2Desc')}</p>
        </div>
        <div className="landing-feature">
          <img className="landing-feature-emblem" src={`${import.meta.env.BASE_URL}concepts/emblem-writer.svg`} alt="" aria-hidden="true" />
          <h3>{t('login.feature3Title')}</h3>
          <p>{t('login.feature3Desc')}</p>
        </div>
      </motion.section>

      {/* Pricing */}
      <motion.section
        className="landing-pricing"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
      >
        <div className="landing-plan">
          <h3>{t('login.freePlan')}</h3>
          <p className="landing-plan-price">{t('login.freePrice')}</p>
          <ul>
            <li>{t('login.freeFeature1')}</li>
            <li>{t('login.freeFeature2')}</li>
            <li>{t('login.freeFeature3')}</li>
            <li>{t('login.freeFeature4')}</li>
          </ul>
        </div>
        <div className="landing-plan landing-plan-pro">
          <h3>{t('login.proPlan')}</h3>
          <p className="landing-plan-price">{t('login.proPrice')}<span>{t('login.proPricePeriod')}</span></p>
          <ul>
            <li>{t('login.proFeature1')}</li>
            <li>{t('login.proFeature2')}</li>
            <li>{t('login.proFeature3')}</li>
            <li>{t('login.proFeature4')}</li>
          </ul>
          <button className="landing-plan-btn" onClick={() => { setShowAuth(true); setIsSignUp(true) }}>
            {t('login.startFree')}
          </button>
        </div>
      </motion.section>

      {/* Auth Modal */}
      <AnimatePresence>
        {showAuth && (
          <motion.div
            className="landing-auth-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowAuth(false) }}
          >
            <motion.div
              className="ka-gate-card"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              transition={{ duration: 0.3 }}
            >
              <img className="landing-auth-logo" src={`${import.meta.env.BASE_URL}logo-mark.svg`} alt="Kernel" />
              <h1 className="ka-gate-title">{t(isSignUp ? 'modal.createTitle' : 'modal.welcomeTitle')}</h1>

              <div className="ka-gate-social">
                <button className="ka-gate-social-btn ka-gate-social-google" onClick={() => signInWithProvider('google')}>
                  {t('modal.continueGoogle')}
                </button>
                <button className="ka-gate-social-btn ka-gate-social-github" onClick={() => signInWithProvider('github')}>
                  {t('modal.continueGitHub')}
                </button>
                <button className="ka-gate-social-btn ka-gate-social-twitter" onClick={() => signInWithProvider('twitter')}>
                  {t('modal.continueX')}
                </button>
              </div>

              <div className="ka-gate-divider"><span>{t('or', { ns: 'common' })}</span></div>

              <form className="ka-gate-form" onSubmit={handleEmailAuth}>
                <input
                  type="email"
                  className="ka-gate-input"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder={t('modal.emailPlaceholder')}
                  required
                />
                <input
                  type="password"
                  className="ka-gate-input"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={t('modal.passwordPlaceholder')}
                  required
                />
                <button
                  type="submit"
                  className="ka-gate-submit"
                  disabled={loading || !email.trim() || !password.trim()}
                >
                  {loading ? t('loading', { ns: 'common' }) : isSignUp ? t('modal.createAccount') : t('modal.signIn')}
                </button>
              </form>

              {!isSignUp && (
                <button
                  className="ka-gate-forgot"
                  onClick={handleResetPassword}
                  type="button"
                >
                  {t('modal.forgotPassword')}
                </button>
              )}

              {error && <p className="ka-gate-error">{error}</p>}
              {successMsg && <p className="ka-gate-success">{successMsg}</p>}

              <div className="ka-gate-toggle-section">
                <span className="ka-gate-toggle-label">
                  {isSignUp ? t('modal.toggleSignInLabel') : t('modal.toggleSignUpLabel')}
                </span>
                <button
                  className="ka-gate-toggle-btn"
                  onClick={() => { setIsSignUp(!isSignUp); setError(''); setSuccessMsg('') }}
                >
                  {isSignUp ? t('modal.toggleSignInAction') : t('modal.toggleSignUpAction')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PWA Install Banner */}
      <AnimatePresence>
        {pwa.canInstall && (
          <motion.div
            className="ka-pwa-banner"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="ka-pwa-banner-content">
              <span className="ka-pwa-banner-text">{t('pwa.installPrompt', { ns: 'common' })}</span>
              <button className="ka-pwa-banner-install" onClick={pwa.install}>
                {t('pwa.install', { ns: 'common' })}
              </button>
            </div>
            <button className="ka-pwa-banner-dismiss" onClick={pwa.dismiss} aria-label={t('close', { ns: 'common' })}>
              <IconClose size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
