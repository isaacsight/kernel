import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Menu, Copy, Check, ThumbsUp, ThumbsDown, LogOut, Settings, Paperclip, X, Download, Moon, Sun, Pencil, Share2, ClipboardCopy, FileDown, Mic, MicOff } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { getEngine, type EngineState, type EngineEvent } from '../engine/AIEngine'
import { claudeStreamChat, RateLimitError, type ContentBlock } from '../engine/ClaudeClient'
import { fileToBase64 } from '../engine/GeminiClient'
import { KERNEL_AGENT, KERNEL_TOPICS } from '../agents/kernel'
import { getSpecialist, type Specialist } from '../agents/specialists'
import { classifyIntent, buildRecentContext } from '../engine/AgentRouter'
import { deepResearch, type ResearchProgress } from '../engine/DeepResearch'
import { extractMemory, mergeMemory, formatMemoryForPrompt, emptyProfile, type UserMemoryProfile } from '../engine/MemoryAgent'
import { planTask, executeTask, type TaskPlan, type TaskProgress } from '../engine/TaskPlanner'
import { useAuthContext } from '../providers/AuthProvider'
import {
  saveMessage,
  getChannelMessages,
  createConversation,
  getUserConversations,
  updateConversationTitle,
  touchConversation,
  deleteConversation,
  getUserRecentMessages,
  saveResponseSignal,
  updateSignalQuality,
  getCollectiveInsights,
  upsertCollectiveInsight,
  getUserMemory,
  upsertUserMemory,
  getAccessToken,
  supabase,
  type DBConversation,
  type DBCollectiveInsight,
} from '../engine/SupabaseClient'
import { ConversationDrawer } from '../components/ConversationDrawer'
import { OnboardingFlow } from '../components/OnboardingFlow'

// ─── Config ─────────────────────────────────────────────

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://eoxxpyixdieprsxlpwcs.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || ''
const PRICE_ID = import.meta.env.VITE_STRIPE_KERNEL_PRICE_ID || ''
const URL_FETCH_ENDPOINT = `${SUPABASE_URL}/functions/v1/url-fetch`

const LINK_REGEX = /https?:\/\/[^\s)<>]+(?:\([^\s)<>]*\))?[^\s)<>,."'!?\]]*(?=[.,!?\]]*(?:\s|$))|https?:\/\/[^\s)<>]+/g

async function fetchUrlContent(url: string): Promise<string> {
  try {
    const token = await getAccessToken()
    const res = await fetch(URL_FETCH_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_KEY,
      },
      body: JSON.stringify({ url }),
    })
    if (!res.ok) return ''
    const { text } = await res.json()
    return text || ''
  } catch {
    return ''
  }
}

// ─── Login Gate ─────────────────────────────────────────

function LoginGate() {
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

// ─── Types ──────────────────────────────────────────────

interface ChatMessage {
  id: string
  role: 'user' | 'kernel'
  content: string
  timestamp: number
  signalId?: string
  feedback?: 'helpful' | 'poor'
  attachments?: { name: string; type: string }[]
  agentId?: string
  agentName?: string
}

const TEXT_EXTENSIONS = ['.txt', '.csv', '.md']
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
const ACCEPTED_FILES = '.jpg,.jpeg,.png,.gif,.webp,.pdf,.txt,.csv,.md'

const EXT_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.gif': 'image/gif', '.webp': 'image/webp', '.pdf': 'application/pdf',
}

function getMediaType(file: File): string {
  if (file.type) return file.type
  const ext = '.' + file.name.split('.').pop()?.toLowerCase()
  return EXT_TO_MIME[ext] || 'application/octet-stream'
}

function isImageFile(file: File): boolean {
  if (file.type && file.type.startsWith('image/')) return true
  const ext = '.' + file.name.split('.').pop()?.toLowerCase()
  return IMAGE_EXTENSIONS.includes(ext)
}

function isPdfFile(file: File): boolean {
  if (file.type === 'application/pdf') return true
  const ext = '.' + file.name.split('.').pop()?.toLowerCase()
  return ext === '.pdf'
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsText(file)
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
  })
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

// ─── File export helper ──────────────────────────────────

const LANG_EXT: Record<string, string> = {
  python: '.py', py: '.py', javascript: '.js', js: '.js', typescript: '.ts', ts: '.ts',
  html: '.html', css: '.css', csv: '.csv', json: '.json', sql: '.sql',
  bash: '.sh', sh: '.sh', markdown: '.md', md: '.md', yaml: '.yml', yml: '.yml',
  xml: '.xml', java: '.java', rust: '.rs', go: '.go', c: '.c', cpp: '.cpp',
  ruby: '.rb', php: '.php', swift: '.swift', kotlin: '.kt', r: '.r',
}

function downloadFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Linkify helper ─────────────────────────────────────

const URL_REGEX = /(https?:\/\/[^\s)<>]+(?:\([^\s)<>]*\))?[^\s)<>,."']*)/g

function Linkify({ text }: { text: string }) {
  const parts = text.split(URL_REGEX)
  return (
    <>
      {parts.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="ka-msg-link">
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  )
}

// ─── Code Block with copy + download ─────────────────────

function CodeBlock({ lang, code, ext, filename }: { lang: string; code: string; ext: string; filename: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="ka-code-block">
      <div className="ka-code-header">
        <span className="ka-code-lang">{lang}</span>
        <div className="ka-code-actions">
          <button className="ka-code-copy" onClick={handleCopy} aria-label="Copy code">
            {copied ? <Check size={13} /> : <ClipboardCopy size={13} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            className="ka-code-download"
            onClick={() => downloadFile(code, filename)}
            aria-label={`Download as ${filename}`}
          >
            <Download size={13} />
            {ext}
          </button>
        </div>
      </div>
      <pre className="ka-code-pre"><code>{code}</code></pre>
    </div>
  )
}

// ─── Message Content (markdown + code blocks) ────────────

const CODE_BLOCK_REGEX = /```(\w*)\n([\s\S]*?)```/g

function MessageContent({ text }: { text: string }) {
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let blockIndex = 0

  // Reset regex state
  CODE_BLOCK_REGEX.lastIndex = 0

  let match
  while ((match = CODE_BLOCK_REGEX.exec(text)) !== null) {
    // Markdown text before code block
    if (match.index > lastIndex) {
      const before = text.slice(lastIndex, match.index)
      parts.push(
        <ReactMarkdown key={`t${blockIndex}`} components={{
          a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="ka-msg-link">{children}</a>,
          code: ({ children }) => <code className="ka-inline-code">{children}</code>,
        }}>{before}</ReactMarkdown>
      )
    }

    const lang = match[1] || 'text'
    const code = match[2]
    const ext = LANG_EXT[lang.toLowerCase()] || '.txt'
    const filename = `kernel-export${ext}`

    parts.push(
      <CodeBlock key={`c${blockIndex}`} lang={lang} code={code} ext={ext} filename={filename} />
    )

    lastIndex = match.index + match[0].length
    blockIndex++
  }

  // Remaining text after last code block
  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex)
    parts.push(
      <ReactMarkdown key={`t${blockIndex}`} components={{
        a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="ka-msg-link">{children}</a>,
        code: ({ children }) => <code className="ka-inline-code">{children}</code>,
      }}>{remaining}</ReactMarkdown>
    )
  }

  return <>{parts}</>
}

// ─── Main Page ──────────────────────────────────────────

export function EnginePage() {
  const { user, isLoading, isAuthenticated, isSubscribed } = useAuthContext()

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

  // Free users can chat with daily limits — no subscription gate

  // Show onboarding for first-time users
  const onboardingKey = `kernel-onboarded-${user?.id || 'anon'}`
  const [onboarded, setOnboarded] = useState(() => localStorage.getItem(onboardingKey) === 'true')

  if (!onboarded) {
    return (
      <OnboardingFlow
        userName={user?.email || undefined}
        onComplete={() => {
          localStorage.setItem(onboardingKey, 'true')
          setOnboarded(true)
        }}
      />
    )
  }

  return <EngineChat />
}

// ─── Engine Chat (post-auth) ────────────────────────────

const FREE_DAILY_LIMIT = 999999 // No limit for launch — charge to cover

function EngineChat() {
  const { user, session, isAdmin, isSubscribed, signOut } = useAuthContext()
  const engine = getEngine()
  const [engineState, setEngineState] = useState<EngineState>(engine.getState())
  const [events, setEvents] = useState<EngineEvent[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [attachedFiles, setAttachedFiles] = useState<File[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Conversation state
  const [conversations, setConversations] = useState<DBConversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  // Daily message limit tracking
  const [dailyMsgCount, setDailyMsgCount] = useState(0)
  const [rateLimited, setRateLimited] = useState(false)
  const isPro = isSubscribed || isAdmin

  // Track the latest kernel response content for persistence
  const latestKernelContentRef = useRef<string>('')
  // Structured user memory (replaces raw userHistory)
  const [userMemory, setUserMemory] = useState<UserMemoryProfile>(emptyProfile())
  const userMemoryRef = useRef<UserMemoryProfile>(userMemory)
  userMemoryRef.current = userMemory
  const messageCountRef = useRef(0)
  // Abort controller for active stream — cleaned up on unmount
  const streamAbortRef = useRef<AbortController | null>(null)
  // Research progress
  const [researchProgress, setResearchProgress] = useState<ResearchProgress | null>(null)
  // Task progress
  const [taskProgress, setTaskProgress] = useState<TaskProgress | null>(null)
  // Collective intelligence
  const [collectiveInsights, setCollectiveInsights] = useState<DBCollectiveInsight[]>([])
  // Per-message copy feedback
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null)
  // Dark mode
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('kernel-dark-mode') === 'true')
  // Editing message
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  // Toast
  const [toast, setToast] = useState<string | null>(null)
  // Voice input
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<any>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Clean up active stream on unmount
  useEffect(() => {
    return () => { streamAbortRef.current?.abort() }
  }, [])

  const activeConversation = conversations.find(c => c.id === activeConversationId)

  // Dark mode toggle
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
    localStorage.setItem('kernel-dark-mode', String(darkMode))
  }, [darkMode])

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(t)
  }, [toast])

  // Voice input
  const toggleVoice = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
      return
    }

    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setToast('Speech recognition not supported in this browser')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = ''
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript
      }
      setInput(transcript)
    }

    recognition.onerror = () => {
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }, [isListening])

  // Clean up speech recognition on unmount
  useEffect(() => {
    return () => { recognitionRef.current?.stop() }
  }, [])

  // Load daily message count for rate limiting
  useEffect(() => {
    if (!user || isPro) return
    const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
    supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('agent_id', 'user')
      .gte('created_at', `${today}T00:00:00Z`)
      .then(({ count }) => {
        const c = count ?? 0
        setDailyMsgCount(c)
        if (c >= FREE_DAILY_LIMIT) setRateLimited(true)
      }, () => {}) // Ignore query errors
  }, [user, isPro])

  // Load conversations + user history on mount
  const [convsLoading, setConvsLoading] = useState(true)
  const loadConversations = useCallback(async () => {
    if (!user) return
    const convs = await getUserConversations(user.id)
    setConversations(convs)
    setConvsLoading(false)
  }, [user])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  // Load structured user memory (or fall back to raw messages for first-time users)
  useEffect(() => {
    if (!user) return
    getUserMemory(user.id).then(async (mem) => {
      if (mem && mem.profile) {
        // Check if profile has actual learned content (not just empty arrays)
        const p = mem.profile as Record<string, unknown>
        const hasContent = Object.values(p).some(v =>
          (Array.isArray(v) && v.length > 0) || (typeof v === 'string' && v.length > 0)
        )
        if (hasContent) {
          setUserMemory(p as unknown as UserMemoryProfile)
          messageCountRef.current = mem.message_count
          return
        }
      }
      // No meaningful profile: bootstrap from recent messages
      const msgs = await getUserRecentMessages(user.id, 40)
      if (msgs.length >= 2) {
        const recentMsgs = msgs.map(m => ({
          role: m.agent_id === 'user' ? 'user' : 'assistant',
          content: m.content,
        }))
        try {
          const profile = await extractMemory(recentMsgs)
          // Only persist if extraction produced real content
          const hasData = profile.interests.length > 0 || profile.goals.length > 0 ||
            profile.facts.length > 0 || profile.communication_style.length > 0
          if (hasData) {
            setUserMemory(profile)
            await upsertUserMemory(user.id, profile as unknown as Record<string, unknown>, msgs.length)
            console.log('[Memory] Bootstrap profile saved for', user.id)
          }
        } catch (err) {
          console.warn('[Memory] Bootstrap extraction failed:', err)
        }
      }
    }).catch(err => console.warn('[Memory] Failed to load user memory:', err))
  }, [user])

  // Load collective insights on mount
  useEffect(() => {
    getCollectiveInsights(10).then(setCollectiveInsights).catch(() => {})
  }, [])

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

  // Auto-title: truncate first message to ~50 chars at word boundary
  function generateTitle(content: string): string {
    if (content.length <= 50) return content
    const truncated = content.substring(0, 50)
    const lastSpace = truncated.lastIndexOf(' ')
    return (lastSpace > 20 ? truncated.substring(0, lastSpace) : truncated) + '...'
  }

  // Switch conversation
  const switchConversation = useCallback(async (convId: string) => {
    const dbMessages = await getChannelMessages(convId)
    const chatMessages: ChatMessage[] = dbMessages.map(m => ({
      id: m.id,
      role: m.agent_id === 'user' ? 'user' : 'kernel',
      content: m.content,
      timestamp: new Date(m.created_at).getTime(),
    }))
    setMessages(chatMessages)
    setActiveConversationId(convId)
  }, [])

  // New chat
  const handleNewChat = useCallback(() => {
    setMessages([])
    setActiveConversationId(null)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Cmd+K — new chat
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        handleNewChat()
        inputRef.current?.focus()
      }
      // Esc — close drawer
      if (e.key === 'Escape' && isDrawerOpen) {
        setIsDrawerOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isDrawerOpen, handleNewChat])

  // Delete conversation
  const handleDeleteConversation = useCallback(async (convId: string) => {
    await deleteConversation(convId)
    if (activeConversationId === convId) {
      setMessages([])
      setActiveConversationId(null)
    }
    await loadConversations()
  }, [activeConversationId, loadConversations])

  // Copy conversation to clipboard
  const handleCopy = useCallback(async () => {
    const text = messages
      .map(m => {
        const who = m.role === 'user' ? 'You' : 'Kernel'
        const time = new Date(m.timestamp).toLocaleString()
        return `${who} [${time}]\n${m.content}`
      })
      .join('\n\n---\n\n')
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [messages])

  // Copy a single message
  const handleCopyMessage = useCallback(async (msgId: string, content: string) => {
    await navigator.clipboard.writeText(content)
    setCopiedMsgId(msgId)
    setTimeout(() => setCopiedMsgId(null), 2000)
  }, [])

  // Show toast
  const showToast = useCallback((msg: string) => setToast(msg), [])

  // Edit & resend a user message
  const handleEditMessage = useCallback(async (msgId: string, newContent: string) => {
    if (!newContent.trim()) return
    setEditingMsgId(null)
    setEditingContent('')
    // Remove this message and all after it
    setMessages(prev => {
      const idx = prev.findIndex(m => m.id === msgId)
      return idx >= 0 ? prev.slice(0, idx) : prev
    })
    // Resend with new content
    await sendMessage(newContent.trim())
  }, [])

  // Share conversation
  const handleShare = useCallback(async () => {
    if (!activeConversationId || messages.length === 0) return
    const text = messages
      .map(m => `**${m.role === 'user' ? 'You' : 'Kernel'}**: ${m.content}`)
      .join('\n\n')
    try {
      if (navigator.share) {
        await navigator.share({ title: activeConversation?.title || 'Kernel Conversation', text })
      } else {
        await navigator.clipboard.writeText(text)
        showToast('Conversation copied to clipboard')
      }
    } catch {
      // User cancelled share
    }
  }, [activeConversationId, messages, activeConversation, showToast])

  // Export conversation as markdown
  const handleExportConversation = useCallback(() => {
    if (messages.length === 0) return
    const title = activeConversation?.title || 'Kernel Conversation'
    const md = `# ${title}\n\n` + messages
      .map(m => {
        const who = m.role === 'user' ? '**You**' : `**Kernel** _(${m.agentName || 'Kernel'})_`
        const time = new Date(m.timestamp).toLocaleString()
        return `### ${who}\n_${time}_\n\n${m.content}`
      })
      .join('\n\n---\n\n')
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title.replace(/[^a-zA-Z0-9 ]/g, '').trim().replace(/\s+/g, '-').toLowerCase()}.md`
    a.click()
    URL.revokeObjectURL(url)
    showToast('Conversation exported')
  }, [messages, activeConversation, showToast])

  // Thumbs feedback on a kernel message
  const handleFeedback = useCallback(async (msg: ChatMessage, quality: 'helpful' | 'poor') => {
    if (!msg.signalId || msg.feedback) return
    // Update local state
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, feedback: quality } : m))
    // Persist quality rating
    updateSignalQuality(msg.signalId, quality)
    // If helpful, strengthen the collective insight for this topic
    if (quality === 'helpful' && msg.signalId) {
      // Find the preceding user message to extract topic
      const idx = messages.findIndex(m => m.id === msg.id)
      const userMsg = idx > 0 ? messages[idx - 1] : null
      if (userMsg && userMsg.role === 'user') {
        const topic = userMsg.content.slice(0, 60).trim()
        upsertCollectiveInsight(topic)
      }
    }
  }, [messages])

  // Open Stripe billing portal to manage/cancel subscription
  const [portalError, setPortalError] = useState('')
  const [portalLoading, setPortalLoading] = useState(false)
  const handleManageSubscription = useCallback(async () => {
    if (!user?.email || portalLoading) return
    if (isAdmin) {
      setPortalError('Admin accounts don\'t have a Stripe subscription to manage.')
      return
    }
    setPortalError('')
    setPortalLoading(true)
    try {
      // Edge function handles everything: JWT → user → DB lookup → Stripe customer → portal
      const token = await getAccessToken()
      const res = await fetch(`${SUPABASE_URL}/functions/v1/create-portal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: SUPABASE_KEY,
        },
        body: JSON.stringify({ return_url: window.location.href }),
      })
      const data = await res.json()
      if (!res.ok) {
        console.error('Portal error:', res.status, data)
        setPortalError(data?.error || data?.message || data?.msg || `Portal error (${res.status})`)
        return
      }
      if (data.url) window.location.href = data.url
    } catch (err) {
      console.error('Manage subscription error:', err)
      setPortalError('Could not connect to billing portal. Please try again.')
    } finally {
      setPortalLoading(false)
    }
  }, [user, session, isAdmin, portalLoading])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    const newFiles = Array.from(files)
    setAttachedFiles(prev => [...prev, ...newFiles])
  }

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const sendMessage = async (content: string) => {
    console.log('[sendMessage] called, content:', content?.slice(0, 50), 'isStreaming:', isStreaming, 'attachedFiles:', attachedFiles.length)
    if (isStreaming || (!content.trim() && attachedFiles.length === 0)) return

    // Rate limits disabled for launch — all users unlimited

    const trimmed = content.trim()
    const filesToSend = [...attachedFiles]
    const userId = user!.id
    console.log('[sendMessage] userId:', userId, 'activeConversationId:', activeConversationId)

    // Lazy-create conversation on first message
    let convId = activeConversationId
    if (!convId) {
      const title = generateTitle(trimmed || filesToSend[0]?.name || 'New chat')
      console.log('[sendMessage] creating conversation, title:', title)
      const conv = await createConversation(userId, title)
      console.log('[sendMessage] createConversation result:', conv)
      if (!conv) {
        console.error('[sendMessage] Failed to create conversation — RLS may be blocking the insert')
        setToast('Session expired. Signing you out — please sign back in.')
        signOut()
        return
      }
      convId = conv.id
      setActiveConversationId(convId)
    }

    // Build attachment metadata for display
    const attachmentMeta = filesToSend.map(f => ({ name: f.name, type: f.type }))

    const userMsgId = `user_${Date.now()}`
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
      attachments: attachmentMeta.length > 0 ? attachmentMeta : undefined,
    }
    setMessages(prev => [...prev, userMsg])
    setIsStreaming(true)
    setIsThinking(true)
    setInput('')
    setAttachedFiles([])
    setResearchProgress(null)
    setTaskProgress(null)

    // ── Phase 1: Classify intent via AgentRouter ──
    const recentCtx = buildRecentContext(
      messages.filter(m => m.content.trim()).map(m => ({
        role: m.role === 'kernel' ? 'assistant' : 'user',
        content: m.content,
      }))
    )
    const classification = await classifyIntent(trimmed, recentCtx)
    const specialist = getSpecialist(classification.agentId)

    // Fetch URL content if message contains links
    let urlContext = ''
    const urls = trimmed.match(LINK_REGEX)
    if (urls && urls.length > 0) {
      const fetches = await Promise.all(urls.slice(0, 3).map(async (url) => {
        const text = await fetchUrlContent(url)
        return text ? `[URL: ${url}]\n${text}\n` : ''
      }))
      urlContext = fetches.filter(Boolean).join('\n')
    }

    // Build content blocks for Claude API
    let userContent: string | ContentBlock[] = urlContext
      ? `${urlContext}\n---\n${trimmed}`
      : trimmed

    if (filesToSend.length > 0) {
      const blocks: ContentBlock[] = []
      let textPrefix = ''

      for (const file of filesToSend) {
        const ext = '.' + file.name.split('.').pop()?.toLowerCase()

        if (TEXT_EXTENSIONS.includes(ext)) {
          const text = await readFileAsText(file)
          textPrefix += `[File: ${file.name}]\n${text}\n\n`
        } else if (isImageFile(file)) {
          const data = await fileToBase64(file)
          blocks.push({
            type: 'image',
            source: { type: 'base64', media_type: getMediaType(file), data },
          })
        } else if (isPdfFile(file)) {
          const data = await fileToBase64(file)
          blocks.push({
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data },
          })
        }
      }

      // Always include a text block — Claude requires non-empty content
      const finalText = (urlContext + textPrefix + trimmed).trim() || `[Attached: ${filesToSend.map(f => f.name).join(', ')}]`
      blocks.push({ type: 'text', text: finalText })
      userContent = blocks
    }

    // Persist user message (text only, no base64 in DB)
    saveMessage({
      id: userMsgId,
      channel_id: convId,
      agent_id: 'user',
      content: trimmed,
      user_id: userId,
    })

    // Increment daily count for rate limiting
    if (!isPro) {
      const newCount = dailyMsgCount + 1
      setDailyMsgCount(newCount)
      if (newCount >= FREE_DAILY_LIMIT) setRateLimited(true)
    }

    // Build system prompt with specialist + memory
    const snapshot = serializeState(engine.getState())
    const memoryText = formatMemoryForPrompt(userMemory)
    const memoryBlock = memoryText
      ? `\n\n---\n\n## User Memory\nYou know this about the user. Use it naturally — don't announce it.\n\n${memoryText}`
      : ''
    const collectiveBlock = collectiveInsights.length > 0
      ? `\n\n---\n\n## Collective Intelligence (learned from all users)\nThese patterns have emerged from conversations across all users. Use them to improve your responses:\n${collectiveInsights.map(i => `- [strength ${(i.strength * 100).toFixed(0)}%] ${i.content}`).join('\n')}`
      : ''
    const systemPrompt = `${specialist.systemPrompt}\n\n---\n\n${snapshot}${memoryBlock}${collectiveBlock}`

    const kernelId = `kernel_${Date.now()}`
    setMessages(prev => [...prev, {
      id: kernelId,
      role: 'kernel',
      content: '',
      timestamp: Date.now(),
      agentId: specialist.id,
      agentName: specialist.name,
    }])
    latestKernelContentRef.current = ''

    // Build claude messages — filter empty content
    const historyMessages = messages
      .filter(m => m.content.trim() !== '')
      .map(m => ({
        role: m.role === 'kernel' ? 'assistant' as const : 'user' as const,
        content: m.content,
      }))
    const claudeMessages: { role: string; content: string | ContentBlock[] }[] = [
      ...historyMessages,
      { role: 'user', content: userContent },
    ]

    const updateKernelMsg = (text: string) => {
      if (isThinking) setIsThinking(false)
      latestKernelContentRef.current = text
      setMessages(prev => prev.map(m => m.id === kernelId ? { ...m, content: text } : m))
    }

    try {
      // ── Phase 4: Multi-step tasks ──
      if (classification.isMultiStep) {
        const plan = await planTask(trimmed)
        setTaskProgress({ plan, currentStep: 0 })
        await executeTask(
          plan,
          memoryText,
          (progress) => setTaskProgress(progress),
          updateKernelMsg
        )
        setTaskProgress(null)
      }
      // ── Phase 2: Deep research ──
      else if (classification.needsResearch) {
        await deepResearch(
          trimmed,
          memoryText,
          (progress) => setResearchProgress(progress),
          updateKernelMsg
        )
        setResearchProgress(null)
      }
      // ── Standard specialist response ──
      else {
        const abortController = new AbortController()
        streamAbortRef.current = abortController
        await claudeStreamChat(
          claudeMessages,
          updateKernelMsg,
          {
            system: systemPrompt,
            model: 'sonnet',
            max_tokens: 1024,
            web_search: specialist.id === 'researcher' || specialist.id === 'kernel',
            signal: abortController.signal,
          }
        )
        streamAbortRef.current = null
      }

      // Persist kernel response on stream complete
      const finalContent = latestKernelContentRef.current
      if (finalContent) {
        saveMessage({
          id: kernelId,
          channel_id: convId,
          agent_id: specialist.id,
          content: finalContent,
          user_id: userId,
        })

        // Save response signal for collective intelligence
        const signalId = `sig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const topic = trimmed.slice(0, 60).trim()
        saveResponseSignal({
          id: signalId,
          user_id: userId,
          conversation_id: convId,
          topic,
          response_quality: 'neutral',
        })
        // Auto-strengthen collective insight for this topic
        if (topic.length > 3) {
          upsertCollectiveInsight(topic)
        }
        // Attach signalId to the message for later feedback
        setMessages(prev => prev.map(m => m.id === kernelId ? { ...m, signalId } : m))
      }
      touchConversation(convId)
      loadConversations()

      // ── Phase 3: Background memory extraction every 3 messages ──
      messageCountRef.current++
      if (messageCountRef.current % 3 === 0) {
        // Use current messages from state setter to avoid stale closure
        setMessages(currentMsgs => {
          const recentMsgs = currentMsgs
            .slice(-10)
            .filter(m => m.content.trim())
            .map(m => ({ role: m.role === 'kernel' ? 'assistant' : 'user', content: m.content }))
          if (recentMsgs.length > 0) {
            extractMemory(recentMsgs).then(async (newProfile) => {
              const hasData = newProfile.interests.length > 0 || newProfile.goals.length > 0 ||
                newProfile.facts.length > 0 || newProfile.communication_style.length > 0
              if (!hasData) return
              const merged = await mergeMemory(userMemoryRef.current, newProfile)
              setUserMemory(merged)
              await upsertUserMemory(userId, merged as unknown as Record<string, unknown>, messageCountRef.current)
              console.log('[Memory] Profile updated, msg count:', messageCountRef.current)
            }).catch((err) => console.warn('[Memory] Periodic extraction failed:', err))
          }
          return currentMsgs // Don't modify state
        })
      }
    } catch (err) {
      if (err instanceof RateLimitError) {
        setRateLimited(true)
        setDailyMsgCount(err.limit)
        setMessages(prev => prev.filter(m => m.id !== kernelId))
      } else {
        const errMsg = err instanceof Error ? err.message : 'Failed to reach Kernel Agent'
        setMessages(prev => prev.map(m => m.id === kernelId ? { ...m, content: `*${errMsg}*` } : m))
      }
      setResearchProgress(null)
      setTaskProgress(null)
    } finally {
      setIsStreaming(false)
      setIsThinking(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  return (
    <div className="ka-page">
      {/* ── Conversation Drawer ── */}
      <ConversationDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        conversations={conversations}
        activeId={activeConversationId}
        onSelect={switchConversation}
        onNewChat={handleNewChat}
        onDelete={handleDeleteConversation}
        onRename={(id, title) => {
          setConversations(prev => prev.map(c => c.id === id ? { ...c, title } : c))
        }}
        isLoading={convsLoading}
      />

      {/* ── Header ── */}
      <header className="ka-header">
        <div className="ka-header-left">
          <button className="ka-menu-btn" onClick={() => setIsDrawerOpen(true)} aria-label="Conversations">
            <Menu size={18} />
          </button>
          <img className="ka-logo" src={`${import.meta.env.BASE_URL}logo-mark.svg`} alt="Kernel" />
          <span className="ka-title">
            {activeConversation ? activeConversation.title : 'Kernel Agent'}
          </span>
        </div>
        <div className="ka-header-right">
          {messages.length > 0 && (
            <>
              <button className="ka-header-icon-btn" onClick={handleExportConversation} aria-label="Export conversation">
                <FileDown size={16} />
              </button>
              <button className="ka-header-icon-btn" onClick={handleShare} aria-label="Share conversation">
                <Share2 size={16} />
              </button>
              <button className="ka-copy-btn" onClick={handleCopy} aria-label="Copy conversation">
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </>
          )}
          <button className="ka-header-icon-btn" onClick={() => setDarkMode(!darkMode)} aria-label="Toggle dark mode">
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button className="ka-header-icon-btn" onClick={handleManageSubscription} disabled={portalLoading} aria-label="Manage subscription">
            <Settings size={16} className={portalLoading ? 'ka-spin' : ''} />
          </button>
          <button className="ka-header-icon-btn" onClick={signOut} aria-label="Sign out">
            <LogOut size={16} />
          </button>
        </div>
      </header>
      {portalError && (
        <div className="ka-portal-error">
          {portalError}
          <button onClick={() => setPortalError('')}>&times;</button>
        </div>
      )}

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
            <h1 className="ka-empty-title">Your Kernel</h1>
            <p className="ka-empty-subtitle">
              A personal AI that remembers you, thinks with you, and gets better over time.
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

        {/* Research progress indicator */}
        {researchProgress && researchProgress.phase !== 'complete' && (
          <div className="ka-research-status">
            <span className="ka-research-dot" />
            <span className="ka-research-phase">{researchProgress.phase}</span>
            {researchProgress.phase === 'searching' && (
              <span className="ka-research-detail">
                {researchProgress.completedQueries}/{researchProgress.totalQueries}
                {researchProgress.currentQuery && ` — ${researchProgress.currentQuery}`}
              </span>
            )}
          </div>
        )}

        {/* Task progress indicator */}
        {taskProgress && (
          <div className="ka-task-progress">
            <div className="ka-task-goal">{taskProgress.plan.goal}</div>
            <div className="ka-task-steps">
              {taskProgress.plan.steps.map(step => (
                <div key={step.id} className={`ka-task-step ka-task-step--${step.status}`}>
                  <span className="ka-task-step-icon">
                    {step.status === 'done' ? '\u2713' : step.status === 'running' ? '\u25CF' : step.status === 'error' ? '\u2717' : '\u25CB'}
                  </span>
                  <span className="ka-task-step-agent">{getSpecialist(step.agentId).name}</span>
                  <span className="ka-task-step-desc">{step.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Thinking indicator */}
        {isThinking && (
          <motion.div
            className="ka-thinking"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <span className="ka-thinking-dot" />
            <span className="ka-thinking-text">Kernel is thinking...</span>
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
                <div className="ka-msg-avatar-col">
                  <div className="ka-msg-avatar">{msg.agentId ? getSpecialist(msg.agentId).icon : 'K'}</div>
                  {msg.agentName && msg.agentName !== 'Kernel' && (
                    <span className="ka-agent-badge" style={{ color: getSpecialist(msg.agentId || 'kernel').color }}>
                      {msg.agentName}
                    </span>
                  )}
                </div>
              )}
              <div className="ka-msg-col">
                <div className="ka-msg-bubble">
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="ka-msg-attachments">
                      {msg.attachments.map((a, i) => (
                        <span key={i} className="ka-msg-attachment">{a.name}</span>
                      ))}
                    </div>
                  )}
                  {editingMsgId === msg.id ? (
                    <form className="ka-edit-form" onSubmit={(e) => { e.preventDefault(); handleEditMessage(msg.id, editingContent) }}>
                      <input
                        className="ka-edit-input"
                        value={editingContent}
                        onChange={e => setEditingContent(e.target.value)}
                        autoFocus
                        onKeyDown={e => { if (e.key === 'Escape') { setEditingMsgId(null); setEditingContent('') } }}
                      />
                      <button type="submit" className="ka-edit-save">Save</button>
                      <button type="button" className="ka-edit-cancel" onClick={() => { setEditingMsgId(null); setEditingContent('') }}>Cancel</button>
                    </form>
                  ) : msg.content ? (
                    msg.role === 'kernel' ? <MessageContent text={msg.content} /> : <Linkify text={msg.content} />
                  ) : (
                    <span className="ka-typing">
                      <span /><span /><span />
                    </span>
                  )}
                </div>
                {/* Edit button for user messages */}
                {msg.role === 'user' && msg.content && !isStreaming && editingMsgId !== msg.id && (
                  <div className="ka-msg-actions">
                    <button
                      className="ka-msg-action-btn"
                      onClick={() => { setEditingMsgId(msg.id); setEditingContent(msg.content) }}
                      aria-label="Edit message"
                    >
                      <Pencil size={14} />
                    </button>
                  </div>
                )}
                {/* Per-message actions: copy + download + thumbs (kernel messages only, after content loads) */}
                {msg.role === 'kernel' && msg.content && (
                  <div className="ka-msg-actions">
                    <button
                      className="ka-msg-action-btn"
                      onClick={() => handleCopyMessage(msg.id, msg.content)}
                      aria-label="Copy message"
                    >
                      {copiedMsgId === msg.id ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                    <button
                      className="ka-msg-action-btn"
                      onClick={() => downloadFile(msg.content, 'kernel-response.md')}
                      aria-label="Download response"
                    >
                      <Download size={14} />
                    </button>
                    {msg.signalId && !msg.feedback && (
                      <>
                        <button
                          className="ka-msg-action-btn ka-msg-action-btn--up"
                          onClick={() => handleFeedback(msg, 'helpful')}
                          aria-label="Helpful"
                        >
                          <ThumbsUp size={14} />
                        </button>
                        <button
                          className="ka-msg-action-btn ka-msg-action-btn--down"
                          onClick={() => handleFeedback(msg, 'poor')}
                          aria-label="Not helpful"
                        >
                          <ThumbsDown size={14} />
                        </button>
                      </>
                    )}
                    {msg.feedback && (
                      <span className="ka-msg-feedback-done">
                        {msg.feedback === 'helpful' ? <ThumbsUp size={14} /> : <ThumbsDown size={14} />}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Live event feed between messages */}
        <EventFeed events={events} />
      </div>

      {/* ── Input ── */}
      {attachedFiles.length > 0 && (
        <div className="ka-file-chips">
          {attachedFiles.map((f, i) => (
            <span key={i} className="ka-file-chip">
              {f.name}
              <button type="button" className="ka-file-chip-x" onClick={() => removeFile(i)}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      {/* Rate limit banner for free users */}
      {rateLimited && !isPro && (
        <div className="ka-rate-limit">
          <p>You've used {dailyMsgCount}/{FREE_DAILY_LIMIT} free messages today. Resets in {(() => {
            const now = new Date()
            const midnight = new Date(now)
            midnight.setUTCHours(24, 0, 0, 0)
            const hours = Math.ceil((midnight.getTime() - now.getTime()) / 3600000)
            return hours === 1 ? '1 hour' : `${hours} hours`
          })()}.</p>
          <button className="ka-rate-limit-btn" onClick={() => {
            window.location.hash = '#/?upgrade=true'
          }}>
            Upgrade to Pro — 150 messages/day
          </button>
        </div>
      )}
      {/* Message count indicator for free users */}
      {!isPro && !rateLimited && dailyMsgCount > FREE_DAILY_LIMIT * 0.5 && (
        <div className="ka-msg-count-hint">
          {FREE_DAILY_LIMIT - dailyMsgCount} messages remaining today
        </div>
      )}
      <form className="ka-input-bar" onSubmit={handleSubmit}>
        <input
          id="ka-file-input"
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_FILES}
          multiple
          onChange={handleFileSelect}
          className="ka-attach-input"
        />
        <label htmlFor="ka-file-input" className={`ka-attach-btn${isStreaming ? ' ka-attach-btn--disabled' : ''}`} aria-label="Attach file">
          <Paperclip size={18} />
        </label>
        <input
          ref={inputRef}
          type="text"
          className="ka-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Talk to the Kernel..."
          disabled={isStreaming}
        />
        <button
          type="button"
          className={`ka-voice-btn${isListening ? ' ka-voice-btn--active' : ''}`}
          onClick={toggleVoice}
          disabled={isStreaming}
          aria-label={isListening ? 'Stop listening' : 'Voice input'}
        >
          {isListening ? <MicOff size={18} /> : <Mic size={18} />}
        </button>
        <button
          type="submit"
          className="ka-send"
          disabled={(!input.trim() && attachedFiles.length === 0) || isStreaming}
        >
          <Send size={18} />
        </button>
      </form>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            className="ka-toast"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
