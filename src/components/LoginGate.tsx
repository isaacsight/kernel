import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useAuthContext } from '../providers/AuthProvider'
import { IconClose, IconMail } from './KernelIcons'
import { TRANSITION } from '../constants/motion'

export function LoginGate() {
  const { signInWithProvider, signInWithEmail, signUpWithEmail, resetPassword } = useAuthContext()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [confirmEmailSent, setConfirmEmailSent] = useState(false)
  const [resetEmailSent, setResetEmailSent] = useState(false)
  const [resetCooldown, setResetCooldown] = useState(0)
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [terminalLines, setTerminalLines] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  // Terminal boot sequence
  useEffect(() => {
    const lines = [
      '> initializing kernel...',
      '> loading agents: kernel, researcher, coder, writer, analyst',
      '> memory system online',
      '> ready.',
    ]
    let i = 0
    const interval = setInterval(() => {
      if (i < lines.length) {
        setTerminalLines(prev => [...prev, lines[i]])
        i++
      } else {
        clearInterval(interval)
      }
    }, 400)
    return () => clearInterval(interval)
  }, [])

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
    try {
      if (isSignUp) {
        const result = await signUpWithEmail(email.trim(), password)
        if (result.error) { setError(result.error) }
        else if (result.confirmationPending) { setConfirmEmailSent(true) }
      } else {
        const result = await signInWithEmail(email.trim(), password)
        if (result.error) setError(result.error)
      }
    } catch {
      setError('Authentication failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async () => {
    if (!email.trim()) {
      setError('Enter your email address first.')
      return
    }
    if (resetCooldown > 0) return
    setLoading(true)
    setError('')
    try {
      const result = await resetPassword(email.trim())
      if (result.error) {
        setError(result.error)
      } else {
        setResetEmailSent(true)
        startCooldown(60)
      }
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="terminal-gate">
      <div className="terminal-window">
        {/* Header bar */}
        <div className="terminal-header">
          <span className="terminal-dot terminal-dot--red" />
          <span className="terminal-dot terminal-dot--yellow" />
          <span className="terminal-dot terminal-dot--green" />
          <span className="terminal-header-title">kernel</span>
        </div>

        {/* Terminal body */}
        <div className="terminal-body">
          {/* Boot sequence */}
          <div className="terminal-boot">
            {terminalLines.map((line, i) => (
              <motion.div
                key={i}
                className="terminal-line"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                transition={{ duration: 0.2 }}
              >
                {line}
              </motion.div>
            ))}
          </div>

          {/* Main content after boot */}
          <AnimatePresence>
            {terminalLines.length >= 4 && (
              <motion.div
                className="terminal-content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <h1 className="terminal-title">kernel</h1>
                <p className="terminal-desc">
                  your personal AI terminal. pay only for what you use.
                </p>

                {/* Confirmation / Reset states */}
                {confirmEmailSent ? (
                  <div className="terminal-notice">
                    <IconMail size={20} />
                    <p>Check your email at <strong>{email}</strong> to confirm your account.</p>
                    <button
                      className="terminal-link-btn"
                      onClick={() => { setConfirmEmailSent(false); setIsSignUp(false); setPassword('') }}
                    >
                      back to sign in
                    </button>
                  </div>
                ) : resetEmailSent ? (
                  <div className="terminal-notice">
                    <IconMail size={20} />
                    <p>Reset link sent to <strong>{email}</strong>.</p>
                    <div className="terminal-notice-actions">
                      <button
                        className="terminal-link-btn"
                        onClick={handleResetPassword}
                        disabled={resetCooldown > 0 || loading}
                      >
                        {resetCooldown > 0 ? `resend in ${resetCooldown}s` : 'resend'}
                      </button>
                      <button
                        className="terminal-link-btn"
                        onClick={() => { setResetEmailSent(false); setError(''); setPassword('') }}
                      >
                        back to sign in
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* OAuth buttons */}
                    <div className="terminal-oauth">
                      <button className="terminal-oauth-btn" onClick={() => signInWithProvider('google')}>
                        continue with google
                      </button>
                      <button className="terminal-oauth-btn" onClick={() => signInWithProvider('github')}>
                        continue with github
                      </button>
                    </div>

                    <div className="terminal-divider">
                      <span>or</span>
                    </div>

                    {/* Email/password form */}
                    <form className="terminal-form" onSubmit={handleEmailAuth}>
                      <input
                        ref={inputRef}
                        type="email"
                        className="terminal-input"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="email"
                        autoComplete="email"
                        required
                      />
                      <input
                        type="password"
                        className="terminal-input"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="password"
                        autoComplete={isSignUp ? 'new-password' : 'current-password'}
                        required
                      />
                      <button
                        type="submit"
                        className="terminal-submit"
                        disabled={loading || !email.trim() || !password.trim()}
                      >
                        {loading ? '...' : isSignUp ? 'create account' : 'sign in'}
                      </button>
                    </form>

                    {error && <p className="terminal-error">{'>'} {error}</p>}

                    <div className="terminal-footer-links">
                      {!isSignUp && (
                        <button
                          className="terminal-link-btn"
                          onClick={handleResetPassword}
                          disabled={resetCooldown > 0}
                          type="button"
                        >
                          {resetCooldown > 0 ? `reset sent (${resetCooldown}s)` : 'forgot password?'}
                        </button>
                      )}
                      <button
                        className="terminal-link-btn"
                        onClick={() => { setIsSignUp(!isSignUp); setError('') }}
                      >
                        {isSignUp ? 'have an account? sign in' : 'create account'}
                      </button>
                    </div>

                    <p className="terminal-legal">
                      by continuing you agree to the{' '}
                      <a href="#/terms">terms</a> & <a href="#/privacy">privacy policy</a>
                    </p>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
