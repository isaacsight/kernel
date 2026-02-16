import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Menu, Copy, Check, ThumbsUp, ThumbsDown, LogOut, Settings, Paperclip, X, Download } from 'lucide-react'
import { getEngine, type EngineState, type EngineEvent } from '../engine/AIEngine'
import { claudeStreamChat, type ContentBlock } from '../engine/ClaudeClient'
import { fileToBase64 } from '../engine/GeminiClient'
import { KERNEL_AGENT, KERNEL_TOPICS } from '../agents/kernel'
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
  type DBConversation,
  type DBCollectiveInsight,
} from '../engine/SupabaseClient'
import { ConversationDrawer } from '../components/ConversationDrawer'

// ─── Config ─────────────────────────────────────────────

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://eoxxpyixdieprsxlpwcs.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || ''
const PRICE_ID = import.meta.env.VITE_STRIPE_KERNEL_PRICE_ID || ''
const URL_FETCH_ENDPOINT = `${SUPABASE_URL}/functions/v1/url-fetch`

const LINK_REGEX = /https?:\/\/[^\s)<>]+(?:\([^\s)<>]*\))?[^\s)<>,."'!?\]]*(?=[.,!?\]]*(?:\s|$))|https?:\/\/[^\s)<>]+/g

async function fetchUrlContent(url: string): Promise<string> {
  try {
    const res = await fetch(URL_FETCH_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_KEY}`,
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
  signalId?: string
  feedback?: 'helpful' | 'poor'
  attachments?: { name: string; type: string }[]
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

// ─── Message Content (code blocks + linkify) ─────────────

const CODE_BLOCK_REGEX = /```(\w*)\n([\s\S]*?)```/g

function MessageContent({ text }: { text: string }) {
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let blockIndex = 0

  // Reset regex state
  CODE_BLOCK_REGEX.lastIndex = 0

  let match
  while ((match = CODE_BLOCK_REGEX.exec(text)) !== null) {
    // Text before code block
    if (match.index > lastIndex) {
      const before = text.slice(lastIndex, match.index)
      parts.push(<Linkify key={`t${blockIndex}`} text={before} />)
    }

    const lang = match[1] || 'text'
    const code = match[2]
    const ext = LANG_EXT[lang.toLowerCase()] || '.txt'
    const filename = `kernel-export${ext}`

    parts.push(
      <div key={`c${blockIndex}`} className="ka-code-block">
        <div className="ka-code-header">
          <span className="ka-code-lang">{lang}</span>
          <button
            className="ka-code-download"
            onClick={() => downloadFile(code, filename)}
            aria-label={`Download as ${filename}`}
          >
            <Download size={13} />
            {ext}
          </button>
        </div>
        <pre className="ka-code-pre"><code>{code}</code></pre>
      </div>
    )

    lastIndex = match.index + match[0].length
    blockIndex++
  }

  // Remaining text after last code block
  if (lastIndex < text.length) {
    parts.push(<Linkify key={`t${blockIndex}`} text={text.slice(lastIndex)} />)
  }

  return <>{parts}</>
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
  const { user, session, isAdmin, signOut } = useAuthContext()
  const engine = getEngine()
  const [engineState, setEngineState] = useState<EngineState>(engine.getState())
  const [events, setEvents] = useState<EngineEvent[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [attachedFiles, setAttachedFiles] = useState<File[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Conversation state
  const [conversations, setConversations] = useState<DBConversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  // Track the latest kernel response content for persistence
  const latestKernelContentRef = useRef<string>('')
  // Prior conversation history for user memory
  const [userHistory, setUserHistory] = useState<string>('')
  // Collective intelligence
  const [collectiveInsights, setCollectiveInsights] = useState<DBCollectiveInsight[]>([])
  // Per-message copy feedback
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null)

  const activeConversation = conversations.find(c => c.id === activeConversationId)

  // Load conversations + user history on mount
  const loadConversations = useCallback(async () => {
    if (!user) return
    const convs = await getUserConversations(user.id)
    setConversations(convs)
  }, [user])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  // Load cross-conversation memory
  useEffect(() => {
    if (!user) return
    getUserRecentMessages(user.id, 40).then(msgs => {
      if (msgs.length === 0) return
      const summary = msgs.map(m => {
        const who = m.agent_id === 'user' ? 'User' : 'Kernel'
        return `${who}: ${m.content}`
      }).join('\n')
      setUserHistory(summary)
    })
  }, [user])

  // Load collective insights on mount
  useEffect(() => {
    getCollectiveInsights(10).then(setCollectiveInsights)
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
      const token = session?.access_token || SUPABASE_KEY
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
    if (isStreaming || (!content.trim() && attachedFiles.length === 0)) return

    const trimmed = content.trim()
    const filesToSend = [...attachedFiles]
    const userId = user!.id

    // Lazy-create conversation on first message
    let convId = activeConversationId
    if (!convId) {
      const title = generateTitle(trimmed || filesToSend[0]?.name || 'New chat')
      const conv = await createConversation(userId, title)
      if (!conv) return
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
    setInput('')
    setAttachedFiles([])

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

    const snapshot = serializeState(engine.getState())
    const memoryBlock = userHistory
      ? `\n\n---\n\n## User Memory (previous conversations)\nYou have spoken with this user before. Use this history to personalize your responses, remember their interests, and build on prior topics. Do not repeat yourself.\n\n${userHistory}`
      : ''
    const collectiveBlock = collectiveInsights.length > 0
      ? `\n\n---\n\n## Collective Intelligence (learned from all users)\nThese patterns have emerged from conversations across all users. Use them to improve your responses:\n${collectiveInsights.map(i => `- [strength ${(i.strength * 100).toFixed(0)}%] ${i.content}`).join('\n')}`
      : ''
    const systemPrompt = `${KERNEL_AGENT.systemPrompt}\n\n---\n\n${snapshot}${memoryBlock}${collectiveBlock}`

    const kernelId = `kernel_${Date.now()}`
    setMessages(prev => [...prev, { id: kernelId, role: 'kernel', content: '', timestamp: Date.now() }])
    latestKernelContentRef.current = ''

    // Build claude messages — filter empty content, history is plain text, current uses content blocks
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

    try {
      await claudeStreamChat(
        claudeMessages,
        (fullText) => {
          latestKernelContentRef.current = fullText
          setMessages(prev => prev.map(m => m.id === kernelId ? { ...m, content: fullText } : m))
        },
        { system: systemPrompt, model: 'sonnet', max_tokens: 1024, web_search: true }
      )

      // Persist kernel response on stream complete
      const finalContent = latestKernelContentRef.current
      if (finalContent) {
        saveMessage({
          id: kernelId,
          channel_id: convId,
          agent_id: 'kernel',
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
        // Attach signalId to the message for later feedback
        setMessages(prev => prev.map(m => m.id === kernelId ? { ...m, signalId } : m))
      }
      touchConversation(convId)
      loadConversations()
      // Refresh user memory so next message has latest context
      getUserRecentMessages(userId, 40).then(msgs => {
        if (msgs.length === 0) return
        const summary = msgs.map(m => {
          const who = m.agent_id === 'user' ? 'User' : 'Kernel'
          return `${who}: ${m.content}`
        }).join('\n')
        setUserHistory(summary)
      })
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
      />

      {/* ── Header ── */}
      <header className="ka-header">
        <div className="ka-header-left">
          <button className="ka-menu-btn" onClick={() => setIsDrawerOpen(true)} aria-label="Conversations">
            <Menu size={18} />
          </button>
          <span className="ka-logo">K</span>
          <span className="ka-title">
            {activeConversation ? activeConversation.title : 'Kernel Agent'}
          </span>
        </div>
        <div className="ka-header-right">
          {messages.length > 0 && (
            <button className="ka-copy-btn" onClick={handleCopy} aria-label="Copy conversation">
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
          )}
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
              <div className="ka-msg-col">
                <div className="ka-msg-bubble">
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="ka-msg-attachments">
                      {msg.attachments.map((a, i) => (
                        <span key={i} className="ka-msg-attachment">{a.name}</span>
                      ))}
                    </div>
                  )}
                  {msg.content ? (
                    msg.role === 'kernel' ? <MessageContent text={msg.content} /> : <Linkify text={msg.content} />
                  ) : (
                    <span className="ka-typing">
                      <span /><span /><span />
                    </span>
                  )}
                </div>
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
          disabled={(!input.trim() && attachedFiles.length === 0) || isStreaming}
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  )
}
