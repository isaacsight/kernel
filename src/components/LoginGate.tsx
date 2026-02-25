import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useAuthContext } from '../providers/AuthProvider'
import { usePWAInstall } from '../hooks/usePWAInstall'
import { IconClose, IconMail } from './KernelIcons'
import { VARIANT, TRANSITION, EASE, DURATION } from '../constants/motion'

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
  const [resetEmailSent, setResetEmailSent] = useState(false)
  const [resetCooldown, setResetCooldown] = useState(0)
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pwa = usePWAInstall()

  // Cleanup cooldown timer
  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current)
    }
  }, [])

  const startCooldown = useCallback((seconds: number) => {
    setResetCooldown(seconds)
    if (cooldownRef.current) clearInterval(cooldownRef.current)
    cooldownRef.current = setInterval(() => {
      setResetCooldown(prev => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current)
          cooldownRef.current = null
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

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
    if (resetCooldown > 0) return
    setLoading(true)
    setError('')
    setSuccessMsg('')
    try {
      const result = await resetPassword(email.trim())
      if (result.error) {
        setError(result.error)
      } else {
        setResetEmailSent(true)
        setSuccessMsg(t('modal.resetSent'))
        startCooldown(60)
      }
    } catch {
      setError(t('modal.error'))
    } finally {
      setLoading(false)
    }
  }

  const handleBackToLogin = () => {
    setResetEmailSent(false)
    setSuccessMsg('')
    setError('')
    setPassword('')
  }

  return (
    <div className="landing">
      {/* Hero */}
      <motion.section
        className="landing-hero"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={TRANSITION.HERO}
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
        variants={VARIANT.FADE_UP_LG}
        initial="hidden"
        animate="visible"
        transition={TRANSITION.FEATURE(0.2)}
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
        variants={VARIANT.FADE_UP_LG}
        initial="hidden"
        animate="visible"
        transition={TRANSITION.FEATURE(0.4)}
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
            onClick={(e) => { if (e.target === e.currentTarget) { setShowAuth(false); handleBackToLogin() } }}
          >
            <motion.div
              className="ka-gate-card"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              transition={TRANSITION.CARD}
            >
              {/* Password Reset Sent State */}
              {resetEmailSent ? (
                <div className="ka-gate-reset-sent">
                  <div className="ka-gate-reset-icon"><IconMail size={36} /></div>
                  <h2 className="ka-gate-title">{t('modal.resetSentTitle')}</h2>
                  <p className="ka-gate-reset-desc">{t('modal.resetSentDesc', { email })}</p>
                  <div className="ka-gate-reset-actions">
                    <button
                      className="ka-settings-text-btn"
                      onClick={handleResetPassword}
                      disabled={resetCooldown > 0 || loading}
                    >
                      {resetCooldown > 0
                        ? t('modal.resendIn', { seconds: resetCooldown })
                        : t('modal.resendReset')}
                    </button>
                    <button className="ka-gate-submit" onClick={handleBackToLogin}>
                      {t('modal.backToLogin')}
                    </button>
                  </div>
                  {error && <p className="ka-gate-error">{error}</p>}
                </div>
              ) : (
                <>
                  {/* Normal Auth State */}
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
                      disabled={resetCooldown > 0}
                      type="button"
                    >
                      {resetCooldown > 0
                        ? t('modal.resetCooldown', { seconds: resetCooldown })
                        : t('modal.forgotPassword')}
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

                  <p className="ka-gate-legal">
                    {t('modal.legalAgreement')}{' '}
                    <a href="#/terms">{t('modal.termsLink')}</a>
                    {' & '}
                    <a href="#/privacy">{t('modal.privacyLink')}</a>
                  </p>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PWA Install Banner */}
      <AnimatePresence>
        {pwa.canInstall && (
          <motion.div
            className="ka-pwa-banner"
            role="status"
            variants={VARIANT.SLIDE_UP}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={TRANSITION.CARD}
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
