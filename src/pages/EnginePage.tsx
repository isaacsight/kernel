import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send } from 'lucide-react'
import { getEngine, type EngineState, type EngineEvent, type CognitivePhase } from '../engine/AIEngine'
import { claudeStreamChat } from '../engine/ClaudeClient'
import { KERNEL_AGENT, KERNEL_TOPICS } from '../agents/kernel'
import { useAuthContext } from '../providers/AuthProvider'

// ─── Config ─────────────────────────────────────────────

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://eoxxpyixdieprsxlpwcs.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || ''
const PRICE_ID = import.meta.env.VITE_STRIPE_KERNEL_PRICE_ID || ''

// ─── Login Gate ─────────────────────────────────────────

function LoginGate() {
  const { signInWithProvider, signInWithEmail, signUpWithEmail, activateAdmin } = useAuthContext()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [showAdmin, setShowAdmin] = useState(false)
  const [adminPass, setAdminPass] = useState('')
  const [adminError, setAdminError] = useState('')

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

  const handleAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    setAdminError('')
    const success = await activateAdmin(adminPass)
    if (!success) {
      setAdminError('Invalid passphrase')
      setAdminPass('')
    }
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
        <h1 className="ka-gate-title">The Antigravity Kernel</h1>
        <p className="ka-gate-subtitle">
          A cognitive architecture that perceives, attends, thinks, decides, acts, and reflects.
        </p>

        {/* Social sign-in */}
        <div className="ka-gate-social">
          <button className="ka-gate-social-btn ka-gate-social-google" onClick={() => signInWithProvider('google')}>
            Continue with Google
          </button>
          <button className="ka-gate-social-btn ka-gate-social-apple" onClick={() => signInWithProvider('apple')}>
            Continue with Apple
          </button>
          <button className="ka-gate-social-btn ka-gate-social-github" onClick={() => signInWithProvider('github')}>
            Continue with GitHub
          </button>
          <button className="ka-gate-social-btn ka-gate-social-twitter" onClick={() => signInWithProvider('twitter')}>
            Continue with X
          </button>
        </div>

        <div className="ka-gate-divider"><span>or</span></div>

        {/* Email + password auth */}
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

        {/* Admin */}
        {!showAdmin ? (
          <button className="ka-gate-admin-toggle" onClick={() => setShowAdmin(true)}>
            Admin
          </button>
        ) : (
          <form className="ka-gate-admin" onSubmit={handleAdmin}>
            <input
              type="password"
              className="ka-gate-input"
              value={adminPass}
              onChange={e => setAdminPass(e.target.value)}
              placeholder="Passphrase"
              autoFocus
            />
            <button type="submit" className="ka-gate-admin-btn" disabled={!adminPass}>
              Unlock
            </button>
            {adminError && <p className="ka-gate-error">{adminError}</p>}
          </form>
        )}
      </motion.div>
    </div>
  )
}

// ─── Subscription Gate ──────────────────────────────────

function SubscriptionGate() {
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
      const res = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_KEY}`,
          apikey: SUPABASE_KEY,
        },
        body: JSON.stringify({
          email: user.email,
          user_id: user.id,
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
          <div className="ka-gate-feature">Unlimited conversations</div>
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

// ─── Types ──────────────────────────────────────────────

interface ChatMessage {
  id: string
  role: 'user' | 'kernel'
  content: string
  timestamp: number
}

// ─── Engine State Serializer ────────────────────────────

function serializeState(s: EngineState): string {
  const parts: string[] = [
    `## Engine State Snapshot`,
    `Phase: ${s.phase}`,
    `Cycles: ${s.cycleCount} | Turns: ${s.working.turnCount}`,
    `Topic: ${s.working.topic || '(none)'}`,
    `Conviction: ${(s.worldModel.convictions.overall * 100).toFixed(1)}% (${s.worldModel.convictions.trend})`,
  ]

  if (s.worldModel.beliefs.length > 0) {
    parts.push(`\n## Beliefs (${s.worldModel.beliefs.length})`)
    for (const b of s.worldModel.beliefs) {
      parts.push(`- [${(b.confidence * 100).toFixed(0)}%] ${b.content} (${b.source})`)
    }
  }

  if (s.ephemeral.perception) {
    const p = s.ephemeral.perception
    parts.push(`\n## Perception: ${p.intent.type} | urgency ${(p.urgency * 100).toFixed(0)}% | complexity ${(p.complexity * 100).toFixed(0)}%`)
    parts.push(`Implied need: ${p.impliedNeed}`)
  }

  if (s.ephemeral.attention) {
    parts.push(`\n## Attention: ${s.ephemeral.attention.primaryFocus} (${s.ephemeral.attention.depth})`)
  }

  if (s.ephemeral.activeAgent) {
    parts.push(`\n## Active Agent: ${s.ephemeral.activeAgent.name}`)
  }

  const recent = s.lasting.reflections.slice(-2)
  if (recent.length > 0) {
    parts.push(`\n## Recent Reflections`)
    for (const r of recent) {
      parts.push(`- Quality ${(r.quality * 100).toFixed(0)}% (${r.agentUsed}): ${r.lesson}`)
    }
  }

  const perf = Object.entries(s.lasting.agentPerformance)
  if (perf.length > 0) {
    parts.push(`\n## Agent Performance`)
    for (const [id, p] of perf) {
      parts.push(`- ${id}: ${(p.avgQuality * 100).toFixed(0)}% avg, ${p.uses} uses`)
    }
  }

  parts.push(`\n## User Model: goal=${s.worldModel.userModel.apparentGoal}, style=${s.worldModel.userModel.communicationStyle}`)
  parts.push(`Situation: ${s.worldModel.situationSummary}`)

  return parts.join('\n')
}

// ─── Phase Bar ──────────────────────────────────────────

const PHASES: CognitivePhase[] = ['perceiving', 'attending', 'thinking', 'deciding', 'acting', 'reflecting']

function PhaseBar({ phase }: { phase: CognitivePhase }) {
  return (
    <div className="ka-phase-bar">
      {PHASES.map(p => (
        <div key={p} className={`ka-phase-pip ${phase === p ? 'ka-phase-pip--active' : ''}`}>
          <span className="ka-phase-pip-dot" />
          <span className="ka-phase-pip-label">{p}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Conviction Strip ───────────────────────────────────

function ConvictionStrip({ value, trend }: { value: number; trend: string }) {
  return (
    <div className="ka-conviction-strip">
      <span className="ka-conviction-label">conviction</span>
      <div className="ka-conviction-track">
        <motion.div
          className="ka-conviction-fill"
          animate={{ width: `${value * 100}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>
      <span className="ka-conviction-pct">{(value * 100).toFixed(0)}%</span>
      <span className="ka-conviction-arrow">
        {trend === 'rising' ? '↗' : trend === 'falling' ? '↘' : '→'}
      </span>
    </div>
  )
}

// ─── Event Feed (compact) ───────────────────────────────

function EventFeed({ events }: { events: EngineEvent[] }) {
  if (events.length === 0) return null
  return (
    <div className="ka-events">
      {[...events].reverse().slice(0, 5).map((e, i) => (
        <div key={i} className="ka-event">
          <span className="ka-event-time">
            {new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <span className="ka-event-type">{e.type.replace(/_/g, ' ')}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────

export function EnginePage() {
  const { isLoading, isAuthenticated, isSubscribed } = useAuthContext()

  if (isLoading) {
    return (
      <div className="ka-gate">
        <motion.div
          className="ka-gate-card"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="ka-gate-icon">K</div>
          <h1 className="ka-gate-title">Loading...</h1>
        </motion.div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginGate />
  }

  if (!isSubscribed) {
    return <SubscriptionGate />
  }

  return <EngineChat />
}

// ─── Engine Chat (post-auth) ────────────────────────────

function EngineChat() {
  const engine = getEngine()
  const [engineState, setEngineState] = useState<EngineState>(engine.getState())
  const [events, setEvents] = useState<EngineEvent[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Subscribe to engine events
  useEffect(() => {
    return engine.subscribe((event) => {
      setEvents(prev => [...prev.slice(-49), event])
      setEngineState(engine.getState())
    })
  }, [engine])

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (content: string) => {
    if (isStreaming || !content.trim()) return

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: Date.now(),
    }
    setMessages(prev => [...prev, userMsg])
    setIsStreaming(true)
    setInput('')

    const snapshot = serializeState(engine.getState())
    const systemPrompt = `${KERNEL_AGENT.systemPrompt}\n\n---\n\n${snapshot}`

    const kernelId = `kernel_${Date.now()}`
    setMessages(prev => [...prev, { id: kernelId, role: 'kernel', content: '', timestamp: Date.now() }])

    const claudeMessages = [...messages, userMsg].map(m => ({
      role: m.role === 'kernel' ? 'assistant' : 'user',
      content: m.content,
    }))

    try {
      await claudeStreamChat(
        claudeMessages,
        (fullText) => {
          setMessages(prev => prev.map(m => m.id === kernelId ? { ...m, content: fullText } : m))
        },
        { system: systemPrompt, model: 'sonnet', max_tokens: 1024, web_search: true }
      )
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to reach Kernel Agent'
      setMessages(prev => prev.map(m => m.id === kernelId ? { ...m, content: `*${errMsg}*` } : m))
    } finally {
      setIsStreaming(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  const { phase, worldModel } = engineState

  return (
    <div className="ka-page">
      {/* ── Status Strip ── */}
      <header className="ka-header">
        <div className="ka-header-left">
          <span className="ka-logo">K</span>
          <span className="ka-title">Kernel Agent</span>
          <span className="ka-phase-label">{phase}</span>
        </div>
        <ConvictionStrip value={worldModel.convictions.overall} trend={worldModel.convictions.trend} />
      </header>

      {/* ── Phase Pipeline ── */}
      <PhaseBar phase={phase} />

      {/* ── Chat Area ── */}
      <div className="ka-chat" ref={scrollRef}>
        {/* Empty state */}
        {messages.length === 0 && (
          <motion.div
            className="ka-empty"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="ka-empty-icon">K</div>
            <h1 className="ka-empty-title">The Antigravity Kernel</h1>
            <p className="ka-empty-subtitle">
              A cognitive architecture that perceives, attends, thinks, decides, acts, and reflects.
              <br />
              Ask it anything. Watch it think.
            </p>
            <div className="ka-topics">
              {KERNEL_TOPICS.map(t => (
                <button
                  key={t.label}
                  className="ka-topic"
                  onClick={() => sendMessage(t.prompt)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Messages */}
        <AnimatePresence initial={false}>
          {messages.map(msg => (
            <motion.div
              key={msg.id}
              className={`ka-msg ka-msg--${msg.role}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              {msg.role === 'kernel' && (
                <div className="ka-msg-avatar">K</div>
              )}
              <div className="ka-msg-bubble">
                {msg.content || (
                  <span className="ka-typing">
                    <span /><span /><span />
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Live event feed between messages */}
        <EventFeed events={events} />
      </div>

      {/* ── Input ── */}
      <form className="ka-input-bar" onSubmit={handleSubmit}>
        <input
          type="text"
          className="ka-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Talk to the Kernel..."
          disabled={isStreaming}
        />
        <button
          type="submit"
          className="ka-send"
          disabled={!input.trim() || isStreaming}
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  )
}
