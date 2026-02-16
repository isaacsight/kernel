import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthContext } from '../providers/AuthProvider'

export function LoginGate() {
  const { signInWithProvider, signInWithEmail, signUpWithEmail } = useAuthContext()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [showAuth, setShowAuth] = useState(false)

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password.trim()) return
    setLoading(true)
    setError('')
    try {
      const result = isSignUp
        ? await signUpWithEmail(email.trim(), password)
        : await signInWithEmail(email.trim(), password)
      if (result.error) setError(result.error)
    } catch {
      setError('Authentication failed. Please try again.')
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
        <img className="landing-logo" src={`${import.meta.env.BASE_URL}logo-mark.svg`} alt="Kernel" />
        <h1 className="landing-title">kernel</h1>
        <p className="landing-subtitle">
          A personal AI that learns who you are, remembers what matters,
          and gets better with every conversation.
        </p>
        <button className="landing-cta" onClick={() => setShowAuth(true)}>
          Get Started — Free
        </button>
        <p className="landing-hint">Unlimited messages. Free to start.</p>
      </motion.section>

      {/* Features */}
      <motion.section
        className="landing-features"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <div className="landing-feature">
          <div className="landing-feature-icon">K</div>
          <h3>It Learns You</h3>
          <p>Kernel builds a memory of your interests, goals, and style. Every conversation makes the next one better.</p>
        </div>
        <div className="landing-feature">
          <div className="landing-feature-icon">R</div>
          <h3>Specialist Agents</h3>
          <p>Your messages route to the right mind — researcher, coder, writer, or analyst. The Kernel decides who handles what.</p>
        </div>
        <div className="landing-feature">
          <div className="landing-feature-icon">W</div>
          <h3>Web Search Built In</h3>
          <p>Real-time information, not stale training data. Kernel searches the web and cites sources naturally.</p>
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
          <h3>Free</h3>
          <p className="landing-plan-price">$0</p>
          <ul>
            <li>Unlimited messages</li>
            <li>All specialist agents</li>
            <li>Conversation memory</li>
            <li>Web search</li>
          </ul>
        </div>
        <div className="landing-plan landing-plan-pro">
          <h3>Pro</h3>
          <p className="landing-plan-price">$20<span>/mo</span></p>
          <ul>
            <li>Unlimited messages</li>
            <li>Deep research mode</li>
            <li>Multi-step tasks</li>
            <li>Priority response</li>
          </ul>
          <button className="landing-plan-btn" onClick={() => { setShowAuth(true); setIsSignUp(true) }}>
            Start Free, Upgrade Anytime
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
              <h1 className="ka-gate-title">{isSignUp ? 'Create your Kernel' : 'Welcome back'}</h1>

              <div className="ka-gate-social">
                <button className="ka-gate-social-btn ka-gate-social-google" onClick={() => signInWithProvider('google')}>
                  Continue with Google
                </button>
                <button className="ka-gate-social-btn ka-gate-social-github" onClick={() => signInWithProvider('github')}>
                  Continue with GitHub
                </button>
                <button className="ka-gate-social-btn ka-gate-social-twitter" onClick={() => signInWithProvider('twitter')}>
                  Continue with X
                </button>
              </div>

              <div className="ka-gate-divider"><span>or</span></div>

              <form className="ka-gate-form" onSubmit={handleEmailAuth}>
                <input
                  type="email"
                  className="ka-gate-input"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                />
                <input
                  type="password"
                  className="ka-gate-input"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Password"
                  required
                />
                <button
                  type="submit"
                  className="ka-gate-submit"
                  disabled={loading || !email.trim() || !password.trim()}
                >
                  {loading ? 'Loading...' : isSignUp ? 'Create Account' : 'Sign In'}
                </button>
              </form>

              <button
                className="ka-gate-admin-toggle"
                onClick={() => setIsSignUp(!isSignUp)}
                style={{ marginBottom: 8 }}
              >
                {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
              </button>

              {error && <p className="ka-gate-error">{error}</p>}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
