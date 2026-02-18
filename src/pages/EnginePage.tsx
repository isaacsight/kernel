import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Menu, Copy, Check, ThumbsUp, ThumbsDown, LogOut, Settings, Paperclip, X, Download, Moon, Sun, Pencil, Share2, FileDown, Mic, MicOff, Square, ChevronDown, EllipsisVertical, Trash2, Crown, Shield, Brain, BarChart3, Target, Zap, Clock, Newspaper, Home, MessageCircle } from 'lucide-react'
import { BottomTabBar, type TabId } from '../components/BottomTabBar'
import { MoreMenu, type MoreAction } from '../components/MoreMenu'
import KGPanel from '../components/kernel-agent/KGPanel'
import StatsPanel from '../components/kernel-agent/StatsPanel'
import { GoalsPanel } from '../components/GoalsPanel'
import { WorkflowsPanel } from '../components/WorkflowsPanel'
import { ScheduledTasksPanel } from '../components/ScheduledTasksPanel'
import { BriefingPanel } from '../components/BriefingPanel'
import { NotificationBell } from '../components/NotificationBell'
import { getEngine, type EngineState, type EngineEvent } from '../engine/AIEngine'
import { claudeStreamChat, RateLimitError, FreeLimitError, type ContentBlock } from '../engine/ClaudeClient'
import { fileToBase64 } from '../engine/fileUtils'
import { KERNEL_TOPICS } from '../agents/kernel'
import { getSpecialist } from '../agents/specialists'
import { classifyIntent, buildRecentContext } from '../engine/AgentRouter'
import { deepResearch, type ResearchProgress } from '../engine/DeepResearch'
import { extractMemory, mergeMemory, formatMemoryForPrompt, emptyProfile, type UserMemoryProfile } from '../engine/MemoryAgent'
import { extractEntities, formatGraphForPrompt, mergeExtraction, type KGEntity, type KGRelation } from '../engine/KnowledgeGraph'
import { planTask, executeTask, type TaskProgress } from '../engine/TaskPlanner'
import { runSwarm, type SwarmProgress } from '../engine/SwarmOrchestrator'
import { getGoalCheckInPrompt, extractGoalProgress, type UserGoal } from '../engine/GoalTracker'
import { useAuthContext } from '../providers/AuthProvider'
import {
  saveMessage,
  getChannelMessages,
  createConversation,
  getUserConversations,
  touchConversation,
  deleteConversation,
  getUserRecentMessages,
  saveResponseSignal,
  updateSignalQuality,
  getCollectiveInsights,
  upsertCollectiveInsight,
  getUserMemory,
  upsertUserMemory,
  getKGEntities,
  getKGRelations,
  upsertKGEntity,
  upsertKGRelation,
  getAccessToken,
  getUserGoals,
  upsertUserGoal,
  supabase,
  type DBConversation,
  type DBCollectiveInsight,
} from '../engine/SupabaseClient'
import { briefingToGoalDescription } from '../utils/briefingHelpers'
import { ShareModal } from '../components/ShareModal'
import { ConversationDrawer } from '../components/ConversationDrawer'
import { OnboardingFlow } from '../components/OnboardingFlow'
import { LoginGate } from '../components/LoginGate'
import { MessageContent, Linkify } from '../components/MessageContent'
import {
  TEXT_EXTENSIONS, ACCEPTED_FILES, LINK_REGEX,
  getMediaType, isImageFile, isPdfFile, readFileAsText,
  downloadFile, serializeState, EventFeed, fetchUrlContent,
  validateFileSize,
} from '../components/ChatHelpers'

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

// ─── Config ─────────────────────────────────────────────

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://eoxxpyixdieprsxlpwcs.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || ''

// ─── Main Page ──────────────────────────────────────────

export function EnginePage() {
  const { user, isLoading, isAuthenticated } = useAuthContext()

  if (isLoading) {
    return (
      <div className="ka-loading-splash">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          <img className="ka-loading-logo" src={`${import.meta.env.BASE_URL}logo-mark.svg`} alt="Kernel" />
        </motion.div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginGate />
  }

  // Show onboarding for first-time users
  const onboardingKey = `kernel-onboarded-${user?.id || 'anon'}`
  const [onboarded, setOnboarded] = useState(() => localStorage.getItem(onboardingKey) === 'true')

  if (!onboarded) {
    return (
      <OnboardingFlow
        userName={user?.email || undefined}
        onComplete={(interests) => {
          localStorage.setItem(onboardingKey, 'true')
          setOnboarded(true)
          // Seed KG with selected interests
          if (interests && interests.length > 0 && user?.id) {
            for (const interest of interests) {
              upsertKGEntity({
                user_id: user.id,
                name: interest.charAt(0).toUpperCase() + interest.slice(1),
                entity_type: 'preference',
                properties: { source: 'onboarding' },
                confidence: 0.7,
                source: 'stated',
                mention_count: 1,
              })
            }
          }
        }}
      />
    )
  }

  return <EngineChat />
}

// ─── Engine Chat (post-auth) ────────────────────────────

const FREE_MSG_LIMIT = 10
const PRICE_ID = import.meta.env.VITE_STRIPE_KERNEL_PRICE_ID || ''

function EngineChat() {
  const { user, session, isAdmin, isSubscribed, signOut, refreshSubscription } = useAuthContext()
  const navigate = useNavigate()
  const engine = getEngine()
  const [engineState, setEngineState] = useState<EngineState>(engine.getState())
  const [events, setEvents] = useState<EngineEvent[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [thinkingAgent, setThinkingAgent] = useState<string | null>(null)
  const [attachedFiles, setAttachedFiles] = useState<File[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Conversation state
  const [conversations, setConversations] = useState<DBConversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  // Free-tier upgrade wall
  const [showUpgradeWall, setShowUpgradeWall] = useState(false)
  const [upgradeLoading, setUpgradeLoading] = useState(false)
  const isPro = isSubscribed || isAdmin

  // Track the latest kernel response content for persistence
  const latestKernelContentRef = useRef<string>('')
  // Ref to always hold the latest sendMessage (avoids stale closures in effects)
  const sendMessageRef = useRef<(content: string) => Promise<void>>(async () => {})
  // Structured user memory (replaces raw userHistory)
  const [userMemory, setUserMemory] = useState<UserMemoryProfile>(emptyProfile())
  const userMemoryRef = useRef<UserMemoryProfile>(userMemory)
  userMemoryRef.current = userMemory
  const messageCountRef = useRef(0)
  // Knowledge Graph state
  const [kgEntities, setKGEntities] = useState<KGEntity[]>([])
  const [kgRelations, setKGRelations] = useState<KGRelation[]>([])
  const kgEntitiesRef = useRef<KGEntity[]>([])
  kgEntitiesRef.current = kgEntities
  // Abort controller for active stream — cleaned up on unmount
  const streamAbortRef = useRef<AbortController | null>(null)
  // Research progress
  const [researchProgress, setResearchProgress] = useState<ResearchProgress | null>(null)
  // Task progress
  const [taskProgress, setTaskProgress] = useState<TaskProgress | null>(null)
  // Swarm progress
  const [swarmProgress, setSwarmProgress] = useState<SwarmProgress | null>(null)
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
  // KG panel
  const [showKGPanel, setShowKGPanel] = useState(false)
  // Stats panel
  const [showStatsPanel, setShowStatsPanel] = useState(false)
  // Goals panel + state
  const [showGoalsPanel, setShowGoalsPanel] = useState(false)
  // Workflows panel
  const [showWorkflowsPanel, setShowWorkflowsPanel] = useState(false)
  // Scheduled tasks panel
  const [showScheduledPanel, setShowScheduledPanel] = useState(false)
  // Briefing panel
  const [showBriefingPanel, setShowBriefingPanel] = useState(false)
  const [userGoals, setUserGoals] = useState<UserGoal[]>([])
  const userGoalsRef = useRef<UserGoal[]>([])
  userGoalsRef.current = userGoals
  // Bottom tab bar state (mobile)
  const [activeTab, setActiveTab] = useState<TabId>('home')
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  // Today's briefing for home screen card
  const [todayBriefing, setTodayBriefing] = useState<{ id: string; title: string; content: string } | null>(null)
  // Close all panels before opening a new one
  const closeAllPanels = useCallback(() => {
    setShowKGPanel(false)
    setShowStatsPanel(false)
    setShowGoalsPanel(false)
    setShowWorkflowsPanel(false)
    setShowScheduledPanel(false)
    setShowBriefingPanel(false)
    setActiveTab('home')
    setShowMoreMenu(false)
  }, [])

  // Close all panels except the one we're about to open
  const closeOtherPanels = useCallback((except?: string) => {
    if (except !== 'kg') setShowKGPanel(false)
    if (except !== 'stats') setShowStatsPanel(false)
    if (except !== 'goals') setShowGoalsPanel(false)
    if (except !== 'workflows') setShowWorkflowsPanel(false)
    if (except !== 'scheduled') setShowScheduledPanel(false)
    if (except !== 'briefings') setShowBriefingPanel(false)
    if (except !== 'drawer') setIsDrawerOpen(false)
    if (except !== 'more') setShowMoreMenu(false)
  }, [])

  // Handle bottom tab bar navigation
  const handleTabChange = useCallback((tab: TabId) => {
    // Toggle: tapping active tab closes it
    if (tab === activeTab && tab !== 'home') {
      closeAllPanels()
      return
    }
    setActiveTab(tab)
    switch (tab) {
      case 'home':
        closeOtherPanels()
        break
      case 'chats':
        closeOtherPanels('drawer')
        setIsDrawerOpen(true)
        break
      case 'goals':
        closeOtherPanels('goals')
        setShowGoalsPanel(true)
        break
      case 'briefings':
        closeOtherPanels('briefings')
        setShowBriefingPanel(true)
        break
      case 'more':
        closeOtherPanels('more')
        setShowMoreMenu(true)
        break
    }
  }, [activeTab, closeAllPanels, closeOtherPanels])

  // Header menu
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false)
  const headerMenuRef = useRef<HTMLDivElement>(null)
  // Share modal
  const [showShareModal, setShowShareModal] = useState(false)
  // Scroll tracking
  const [isNearBottom, setIsNearBottom] = useState(true)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  // Voice input
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<any>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Clean up active stream on unmount
  useEffect(() => {
    return () => { streamAbortRef.current?.abort() }
  }, [])

  // Sync engine state with Supabase on auth
  useEffect(() => {
    if (!user) return
    engine.setUserId(user.id)
    engine.loadFromSupabase()
    return () => { engine.setUserId(null) }
  }, [user, engine])

  const activeConversation = conversations.find(c => c.id === activeConversationId)

  // Dark mode toggle
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
    localStorage.setItem('kernel-dark-mode', String(darkMode))
  }, [darkMode])

  // Post-checkout: detect ?checkout=complete and poll for Pro status
  useEffect(() => {
    const hash = window.location.hash
    if (!hash.includes('checkout=complete')) return
    let attempts = 0
    const maxAttempts = 15
    const poll = setInterval(async () => {
      attempts++
      const isPro = await refreshSubscription()
      if (isPro || attempts >= maxAttempts) {
        clearInterval(poll)
        if (isPro) {
          setShowUpgradeWall(false)
          setToast('Welcome to Kernel Pro!')
        }
        // Clean URL hash
        const cleanHash = hash.replace(/[?&]checkout=complete/, '').replace(/\?$/, '')
        window.location.hash = cleanHash || '#/'
      }
    }, 2000)
    return () => clearInterval(poll)
  }, [refreshSubscription])

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(t)
  }, [toast])

  // Close header menu on outside click
  useEffect(() => {
    if (!headerMenuOpen) return
    const onClick = (e: MouseEvent) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target as Node)) {
        setHeaderMenuOpen(false)
      }
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [headerMenuOpen])

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

  // Upgrade to Pro via Stripe checkout
  const handleUpgrade = useCallback(async () => {
    if (!user?.email || upgradeLoading) return
    setUpgradeLoading(true)
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
      setToast('Unable to start checkout. Please try again.')
    } finally {
      setUpgradeLoading(false)
    }
  }, [user, upgradeLoading])

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
      const msgs = await getUserRecentMessages(user.id, 40)
      if (msgs.length >= 2) {
        const recentMsgs = msgs.map(m => ({
          role: m.agent_id === 'user' ? 'user' : 'assistant',
          content: m.content,
        }))
        try {
          const profile = await extractMemory(recentMsgs)
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

  // Load Knowledge Graph on mount
  useEffect(() => {
    if (!user) return
    Promise.all([getKGEntities(user.id), getKGRelations(user.id)])
      .then(([entities, relations]) => {
        setKGEntities(entities)
        setKGRelations(relations)
      })
      .catch(err => console.warn('[KG] Failed to load knowledge graph:', err))
  }, [user])

  // Load user goals on mount
  useEffect(() => {
    if (!user) return
    getUserGoals(user.id).then(setUserGoals).catch(err => console.warn('[Goals] Failed to load:', err))
  }, [user])

  // Load collective insights on mount
  useEffect(() => {
    getCollectiveInsights(10).then(setCollectiveInsights).catch(() => {})
  }, [])

  // Load today's briefing for home screen card
  useEffect(() => {
    if (!user) return
    const loadTodayBriefing = async () => {
      try {
        const midnight = new Date()
        midnight.setHours(0, 0, 0, 0)
        const { data } = await supabase
          .from('briefings')
          .select('id, title, content')
          .eq('user_id', user.id)
          .gte('created_at', midnight.toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
        if (data && data.length > 0) {
          const b = data[0]
          if (!b.content.startsWith('Unable to generate briefing')) {
            setTodayBriefing({ id: b.id, title: b.title, content: b.content })
          }
        }
      } catch { /* no briefing today */ }
    }
    loadTodayBriefing()
  }, [user])

  // Subscribe to engine events
  useEffect(() => {
    return engine.subscribe((event) => {
      setEvents(prev => [...prev.slice(-49), event])
      setEngineState(engine.getState())
    })
  }, [engine])

  // Track scroll position
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
      setIsNearBottom(nearBottom)
      setShowScrollBtn(!nearBottom && messages.length > 0)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [messages.length])

  // Auto-scroll only when near bottom
  useEffect(() => {
    if (isNearBottom) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    }
  }, [messages, isNearBottom])

  // Auto-title: truncate first message to ~50 chars at word boundary
  function generateTitle(content: string): string {
    if (content.length <= 50) return content
    const truncated = content.substring(0, 50)
    const lastSpace = truncated.lastIndexOf(' ')
    return (lastSpace > 20 ? truncated.substring(0, lastSpace) : truncated) + '...'
  }

  // Switch conversation
  const [msgsLoading, setMsgsLoading] = useState(false)
  const switchConversation = useCallback(async (convId: string) => {
    setMsgsLoading(true)
    setActiveConversationId(convId)
    setMessages([])
    const dbMessages = await getChannelMessages(convId)
    const chatMessages: ChatMessage[] = dbMessages.map(m => ({
      id: m.id,
      role: m.agent_id === 'user' ? 'user' : 'kernel',
      content: m.content,
      timestamp: new Date(m.created_at).getTime(),
    }))
    setMessages(chatMessages)
    setMsgsLoading(false)
  }, [])

  // New chat
  const handleNewChat = useCallback(() => {
    setMessages([])
    setActiveConversationId(null)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        handleNewChat()
        inputRef.current?.focus()
      }
      if (e.key === 'Escape') {
        if (showMoreMenu) { setShowMoreMenu(false); setActiveTab('home') }
        if (isDrawerOpen) setIsDrawerOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isDrawerOpen, showMoreMenu, handleNewChat])

  // Delete conversation
  const handleDeleteConversation = useCallback(async (convId: string) => {
    await deleteConversation(convId)
    if (activeConversationId === convId) {
      setMessages([])
      setActiveConversationId(null)
    }
    await loadConversations()
  }, [activeConversationId, loadConversations])

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
    setMessages(prev => {
      const idx = prev.findIndex(m => m.id === msgId)
      return idx >= 0 ? prev.slice(0, idx) : prev
    })
    await sendMessage(newContent.trim())
  }, [])

  // Share conversation (plain text for share sheet / clipboard)
  const handleShare = useCallback(async () => {
    if (!activeConversationId || messages.length === 0) return
    const title = activeConversation?.title || 'Kernel Conversation'
    const text = messages
      .map(m => `${m.role === 'user' ? 'You' : 'Kernel'}: ${m.content}`)
      .join('\n\n')
    try {
      if (navigator.share) {
        await navigator.share({ title, text })
      } else {
        await navigator.clipboard.writeText(text)
        showToast('Conversation copied to clipboard')
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return // user cancelled
      showToast('Could not share — try Export instead')
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
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, feedback: quality } : m))
    updateSignalQuality(msg.signalId, quality)
    if (quality === 'helpful' && msg.signalId) {
      const idx = messages.findIndex(m => m.id === msg.id)
      const userMsg = idx > 0 ? messages[idx - 1] : null
      if (userMsg && userMsg.role === 'user') {
        const topic = userMsg.content.slice(0, 60).trim()
        upsertCollectiveInsight(topic)
      }
    }
  }, [messages])

  // Open Stripe billing portal
  const [portalError, setPortalError] = useState('')
  const [portalLoading, setPortalLoading] = useState(false)
  const handleManageSubscription = useCallback(async () => {
    if (!user?.email || portalLoading) return
    setPortalError('')
    setPortalLoading(true)
    try {
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
      // Handle non-JSON responses (e.g. HTML error pages, empty bodies)
      let data: Record<string, string> = {}
      const contentType = res.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        try { data = await res.json() } catch { /* empty JSON body */ }
      } else {
        const text = await res.text()
        console.error('Portal non-JSON response:', res.status, text)
        setPortalError(`Portal error (${res.status})`)
        return
      }
      if (!res.ok) {
        console.error('Portal error:', res.status, data)
        setPortalError(data?.error || data?.message || data?.msg || `Portal error (${res.status})`)
        return
      }
      if (data.url) window.location.href = data.url
    } catch (err) {
      console.error('Manage subscription error:', err)
      setPortalError(`Billing portal error: ${err instanceof Error ? err.message : 'Please try again.'}`)
    } finally {
      setPortalLoading(false)
    }
  }, [user, portalLoading])

  // Delete account (state declared early so handleMoreAction can reference setShowDeleteConfirm)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Handle "More" menu actions
  const handleMoreAction = useCallback((action: MoreAction) => {
    setShowMoreMenu(false)
    setActiveTab('home')
    switch (action) {
      case 'workflows':
        closeOtherPanels('workflows')
        setShowWorkflowsPanel(true)
        break
      case 'scheduled':
        closeOtherPanels('scheduled')
        setShowScheduledPanel(true)
        break
      case 'knowledge':
        closeOtherPanels('kg')
        setShowKGPanel(true)
        break
      case 'stats':
        closeOtherPanels('stats')
        setShowStatsPanel(true)
        break
      case 'upgrade':
        handleUpgrade()
        break
      case 'manage-subscription':
        handleManageSubscription()
        break
      case 'sign-out':
        signOut()
        break
      case 'delete-account':
        setShowDeleteConfirm(true)
        break
    }
  }, [closeOtherPanels, handleUpgrade, handleManageSubscription, signOut])

  // Delete account
  const [deleteLoading, setDeleteLoading] = useState(false)
  const handleDeleteAccount = useCallback(async () => {
    if (!user || deleteLoading) return
    setDeleteLoading(true)
    try {
      const token = await getAccessToken()
      const res = await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: SUPABASE_KEY,
        },
      })
      if (!res.ok) throw new Error('Delete failed')
      await signOut()
    } catch {
      setToast('Failed to delete account. Please try again.')
      setDeleteLoading(false)
      setShowDeleteConfirm(false)
    }
  }, [user, deleteLoading, signOut])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    const newFiles = Array.from(files)
    // Validate file sizes
    for (const file of newFiles) {
      const error = validateFileSize(file, isPro)
      if (error) {
        setToast(error)
        e.target.value = ''
        return
      }
    }
    setAttachedFiles(prev => [...prev, ...newFiles])
    e.target.value = ''
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
      if (!conv) {
        setToast('Session expired. Signing you out — please sign back in.')
        signOut()
        return
      }
      convId = conv.id
      setActiveConversationId(convId)
    }

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
    if (inputRef.current) inputRef.current.style.height = 'auto'
    setAttachedFiles([])
    setResearchProgress(null)
    setTaskProgress(null)
    setSwarmProgress(null)

    // Classify intent via AgentRouter
    const recentCtx = buildRecentContext(
      messages.filter(m => m.content.trim()).map(m => ({
        role: m.role === 'kernel' ? 'assistant' : 'user',
        content: m.content,
      }))
    )
    const classification = await classifyIntent(trimmed, recentCtx, filesToSend.length > 0)
    const specialist = getSpecialist(classification.agentId)
    setThinkingAgent(specialist.name)

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
          let text = await readFileAsText(file)
          const MAX_TEXT_CHARS = 30000
          if (text.length > MAX_TEXT_CHARS) {
            text = text.slice(0, MAX_TEXT_CHARS) + `\n\n[... truncated — file was ${(text.length / 1000).toFixed(0)}K chars, showing first ${(MAX_TEXT_CHARS / 1000).toFixed(0)}K]`
          }
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

      const finalText = (urlContext + textPrefix + trimmed).trim() || `[Attached: ${filesToSend.map(f => f.name).join(', ')}]`
      blocks.push({ type: 'text', text: finalText })
      userContent = blocks
    }

    // Persist user message (with attachment metadata if present)
    saveMessage({
      id: userMsgId,
      channel_id: convId,
      agent_id: 'user',
      content: trimmed,
      user_id: userId,
      attachments: attachmentMeta.length > 0 ? attachmentMeta : undefined,
    })

    // Free limit is enforced server-side via claude-proxy

    // Build system prompt with specialist + memory
    const snapshot = serializeState(engine.getState())
    const memoryText = formatMemoryForPrompt(userMemory)
    const memoryBlock = memoryText
      ? `\n\n---\n\n## User Memory\nYou know this about the user. Use it naturally — don't announce it.\n\n${memoryText}`
      : ''
    const kgText = formatGraphForPrompt(kgEntities, kgRelations)
    const kgBlock = kgText
      ? `\n\n## Knowledge Graph\nStructured facts and relationships you've learned:\n\n${kgText}`
      : ''
    const collectiveBlock = collectiveInsights.length > 0
      ? `\n\n---\n\n## Collective Intelligence (learned from all users)\nThese patterns have emerged from conversations across all users. Use them to improve your responses:\n${collectiveInsights.map(i => `- [strength ${(i.strength * 100).toFixed(0)}%] ${i.content}`).join('\n')}`
      : ''
    const goalBlock = getGoalCheckInPrompt(userGoalsRef.current)
    const systemPrompt = `${specialist.systemPrompt}\n\n---\n\n${snapshot}${memoryBlock}${kgBlock}${goalBlock}${collectiveBlock}`

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

    // Build claude messages
    const rawHistory = messages
      .filter(m => m.content.trim() !== '')
      .map(m => ({
        role: m.role === 'kernel' ? 'assistant' as const : 'user' as const,
        content: m.content,
      }))
    const sanitized: { role: 'user' | 'assistant'; content: string }[] = []
    for (const m of rawHistory) {
      const prev = sanitized[sanitized.length - 1]
      if (prev && m.role === prev.role) {
        prev.content = prev.content + '\n\n' + m.content
      } else {
        sanitized.push({ ...m })
      }
    }
    const claudeMessages: { role: string; content: string | ContentBlock[] }[] = [
      ...sanitized,
      { role: 'user', content: userContent },
    ]

    const updateKernelMsg = (text: string) => {
      if (isThinking) { setIsThinking(false); setThinkingAgent(null) }
      latestKernelContentRef.current = text
      setMessages(prev => prev.map(m => m.id === kernelId ? { ...m, content: text } : m))
    }

    try {
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
      } else if (classification.needsSwarm) {
        const history = messages
          .filter(m => m.content.trim())
          .map(m => ({
            role: m.role === 'kernel' ? 'assistant' as const : 'user' as const,
            content: m.content,
          }))
        await runSwarm(
          trimmed,
          memoryText,
          history,
          (progress) => setSwarmProgress(progress),
          updateKernelMsg
        )
        setSwarmProgress(null)
      } else if (classification.needsResearch) {
        await deepResearch(
          trimmed,
          memoryText,
          (progress) => setResearchProgress(progress),
          updateKernelMsg
        )
        setResearchProgress(null)
      } else {
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

      // Persist kernel response
      const finalContent = latestKernelContentRef.current
      if (finalContent) {
        saveMessage({
          id: kernelId,
          channel_id: convId,
          agent_id: specialist.id,
          content: finalContent,
          user_id: userId,
        })

        const signalId = `sig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const topic = trimmed.slice(0, 60).trim()
        saveResponseSignal({
          id: signalId,
          user_id: userId,
          conversation_id: convId,
          topic,
          response_quality: 'neutral',
        })
        if (topic.length > 3) {
          upsertCollectiveInsight(topic)
        }
        setMessages(prev => prev.map(m => m.id === kernelId ? { ...m, signalId } : m))
      }
      touchConversation(convId)
      loadConversations()

      // Background memory + KG extraction every 3 messages
      messageCountRef.current++
      if (messageCountRef.current % 3 === 0) {
        setMessages(currentMsgs => {
          const recentMsgs = currentMsgs
            .slice(-10)
            .filter(m => m.content.trim())
            .map(m => ({ role: m.role === 'kernel' ? 'assistant' : 'user', content: m.content }))
          if (recentMsgs.length > 0) {
            // Memory extraction
            extractMemory(recentMsgs).then(async (newProfile) => {
              const hasData = newProfile.interests.length > 0 || newProfile.goals.length > 0 ||
                newProfile.facts.length > 0 || newProfile.communication_style.length > 0
              if (!hasData) return
              const merged = await mergeMemory(userMemoryRef.current, newProfile)
              setUserMemory(merged)
              await upsertUserMemory(userId, merged as unknown as Record<string, unknown>, messageCountRef.current)
              console.log('[Memory] Profile updated, msg count:', messageCountRef.current)
            }).catch((err) => console.warn('[Memory] Periodic extraction failed:', err))

            // Goal progress extraction (parallel, independent)
            const activeGoals = userGoalsRef.current.filter(g => g.status === 'active')
            if (activeGoals.length > 0) {
              const lastUserMsg = recentMsgs.filter(m => m.role === 'user').pop()
              if (lastUserMsg) {
                extractGoalProgress(lastUserMsg.content, activeGoals).then(async (progress) => {
                  if (!progress) return
                  const goal = activeGoals.find(g => g.title === progress.goalTitle)
                  if (!goal) return
                  const updatedGoal: UserGoal = {
                    ...goal,
                    progress_notes: [...goal.progress_notes, { content: progress.note, timestamp: new Date().toISOString(), source: 'auto' }],
                    last_check_in_at: new Date().toISOString(),
                    milestones: progress.milestoneCompleted
                      ? goal.milestones.map(m => m.title === progress.milestoneCompleted ? { ...m, completed: true, completed_at: new Date().toISOString() } : m)
                      : goal.milestones,
                  }
                  await upsertUserGoal(updatedGoal)
                  setUserGoals(prev => prev.map(g => g.id === goal.id ? updatedGoal : g))
                  console.log('[Goals] Progress detected for:', goal.title)
                }).catch(err => console.warn('[Goals] Extraction failed:', err))
              }
            }

            // KG extraction (parallel, independent)
            const kgMessages = currentMsgs.slice(-10).filter(m => m.content.trim()).map(m => ({
              id: m.id,
              agentId: m.role === 'user' ? 'human' : (m.agentId || 'kernel'),
              agentName: m.role === 'user' ? 'User' : (m.agentName || 'Kernel'),
              content: m.content,
              timestamp: new Date(m.timestamp),
            }))
            extractEntities(kgMessages, kgEntitiesRef.current.map(e => e.name)).then(async (extraction) => {
              if (extraction.entities.length === 0 && extraction.relations.length === 0) return
              await mergeExtraction(userId, extraction, kgEntitiesRef.current, upsertKGEntity, upsertKGRelation)
              // Refresh KG state
              const [entities, relations] = await Promise.all([getKGEntities(userId), getKGRelations(userId)])
              setKGEntities(entities)
              setKGRelations(relations)
              console.log('[KG] Graph updated:', entities.length, 'entities,', relations.length, 'relations')
            }).catch((err) => console.warn('[KG] Extraction failed:', err))
          }
          return currentMsgs
        })
      }
    } catch (err) {
      if (err instanceof FreeLimitError) {
        setShowUpgradeWall(true)
        setMessages(prev => prev.filter(m => m.id !== kernelId))
      } else if (err instanceof RateLimitError) {
        setMessages(prev => prev.filter(m => m.id !== kernelId))
      } else {
        const errMsg = err instanceof Error ? err.message : 'Failed to reach Kernel Agent'
        setMessages(prev => prev.map(m => m.id === kernelId ? { ...m, content: `*${errMsg}*` } : m))
      }
      setResearchProgress(null)
      setTaskProgress(null)
      setSwarmProgress(null)
    } finally {
      setIsStreaming(false)
      setIsThinking(false)
    }
  }

  // Keep ref in sync so effects always call the latest sendMessage
  sendMessageRef.current = sendMessage

  const handleSubmit = (e: React.FormEvent | React.KeyboardEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  // Edge swipe to open conversation drawer (left edge, 30px zone)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0]
      if (touch.clientX < 30 && !isDrawerOpen) {
        touchStartRef.current = { x: touch.clientX, y: touch.clientY }
      }
    }
    const onTouchMove = (e: TouchEvent) => {
      if (!touchStartRef.current) return
      const touch = e.touches[0]
      const dx = touch.clientX - touchStartRef.current.x
      const dy = Math.abs(touch.clientY - touchStartRef.current.y)
      // Must be a horizontal swipe (dx > 60px, mostly horizontal)
      if (dx > 60 && dy < 50) {
        setIsDrawerOpen(true)
        touchStartRef.current = null
      }
    }
    const onTouchEnd = () => { touchStartRef.current = null }

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: true })
    document.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
    }
  }, [isDrawerOpen])

  // Handle briefing → chat navigation (from BriefingPage "Go deeper" pills via sessionStorage)
  useEffect(() => {
    const raw = sessionStorage.getItem('kernel-briefing-context')
    if (!raw) return
    sessionStorage.removeItem('kernel-briefing-context')
    try {
      const { title, section, content } = JSON.parse(raw) as { title: string; section: string; content: string }
      handleNewChat()
      const msg = `I just read the "${section}" section of my briefing "${title}". Here's the content:\n\n${content}\n\nLet's go deeper on this.`
      // Use ref to always call the latest sendMessage (avoids stale closure on mount)
      setTimeout(() => sendMessageRef.current(msg), 300)
    } catch { /* invalid JSON, ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Briefing panel → Chat callback
  const handleBriefingGoDeeper = useCallback((title: string, content: string) => {
    setShowBriefingPanel(false)
    setActiveTab('home')
    handleNewChat()
    const msg = `I just read my briefing "${title}". Here's a summary:\n\n${content.slice(0, 800)}\n\nLet's discuss this.`
    setTimeout(() => sendMessage(msg), 100)
  }, [handleNewChat])

  // Briefing panel → Goal callback
  const handleBriefingAddGoal = useCallback(async (title: string, description: string) => {
    if (!user) return
    const goal: UserGoal = {
      user_id: user.id,
      title,
      description,
      category: 'briefing',
      status: 'active',
      priority: 'medium',
      target_date: null,
      milestones: [],
      progress_notes: [],
      check_in_frequency: 'weekly',
      last_check_in_at: null,
    }
    await upsertUserGoal(goal)
    const goals = await getUserGoals(user.id)
    setUserGoals(goals)
    showToast('Goal added from briefing')
  }, [user, showToast])

  return (
    <div className="ka-page">
      {/* Knowledge Graph Panel (bottom sheet on mobile, centered modal on desktop) */}
      <AnimatePresence>
        {showKGPanel && (
          <motion.div
            className="ka-kg-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { setShowKGPanel(false); setActiveTab('home') }}
          >
            <motion.div
              className="ka-kg-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, info) => {
                if (info.offset.y > 100 || info.velocity.y > 300) {
                  setShowKGPanel(false); setActiveTab('home')
                }
              }}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              <div className="ka-kg-drag-handle" />
              <KGPanel
                entities={kgEntities}
                relations={kgRelations}
                onClose={() => { setShowKGPanel(false); setActiveTab('home') }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Panel */}
      <AnimatePresence>
        {showStatsPanel && user && (
          <motion.div
            className="ka-kg-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { setShowStatsPanel(false); setActiveTab('home') }}
          >
            <motion.div
              className="ka-kg-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, info) => {
                if (info.offset.y > 100 || info.velocity.y > 300) {
                  setShowStatsPanel(false); setActiveTab('home')
                }
              }}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              <div className="ka-kg-drag-handle" />
              <StatsPanel userId={user.id} onClose={() => { setShowStatsPanel(false); setActiveTab('home') }} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Goals Panel */}
      <AnimatePresence>
        {showGoalsPanel && user && (
          <motion.div
            className="ka-kg-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { setShowGoalsPanel(false); setActiveTab('home') }}
          >
            <motion.div
              className="ka-kg-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, info) => {
                if (info.offset.y > 100 || info.velocity.y > 300) {
                  setShowGoalsPanel(false); setActiveTab('home')
                }
              }}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              <div className="ka-kg-drag-handle" />
              <GoalsPanel userId={user.id} onClose={() => { setShowGoalsPanel(false); setActiveTab('home') }} onToast={showToast} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Workflows Panel */}
      <AnimatePresence>
        {showWorkflowsPanel && user && (
          <motion.div
            className="ka-kg-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { setShowWorkflowsPanel(false); setActiveTab('home') }}
          >
            <motion.div
              className="ka-kg-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, info) => {
                if (info.offset.y > 100 || info.velocity.y > 300) {
                  setShowWorkflowsPanel(false); setActiveTab('home')
                }
              }}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              <div className="ka-kg-drag-handle" />
              <WorkflowsPanel
                userId={user.id}
                onClose={() => { setShowWorkflowsPanel(false); setActiveTab('home') }}
                onToast={showToast}
                onRunWorkflow={(proc) => {
                  setShowWorkflowsPanel(false)
                  sendMessage(`Run workflow: ${proc.name}`)
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scheduled Tasks Panel */}
      <AnimatePresence>
        {showScheduledPanel && user && (
          <motion.div
            className="ka-kg-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { setShowScheduledPanel(false); setActiveTab('home') }}
          >
            <motion.div
              className="ka-kg-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, info) => {
                if (info.offset.y > 100 || info.velocity.y > 300) {
                  setShowScheduledPanel(false); setActiveTab('home')
                }
              }}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              <div className="ka-kg-drag-handle" />
              <ScheduledTasksPanel userId={user.id} onClose={() => { setShowScheduledPanel(false); setActiveTab('home') }} onToast={showToast} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Briefing Panel */}
      <AnimatePresence>
        {showBriefingPanel && user && (
          <motion.div
            className="ka-kg-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { setShowBriefingPanel(false); setActiveTab('home') }}
          >
            <motion.div
              className="ka-kg-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, info) => {
                if (info.offset.y > 100 || info.velocity.y > 300) {
                  setShowBriefingPanel(false); setActiveTab('home')
                }
              }}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              <div className="ka-kg-drag-handle" />
              <BriefingPanel
                userId={user.id}
                userMemory={userMemory}
                kgEntities={kgEntities}
                onClose={() => { setShowBriefingPanel(false); setActiveTab('home') }}
                onToast={showToast}
                onGoDeeper={handleBriefingGoDeeper}
                onAddGoal={handleBriefingAddGoal}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Conversation Drawer */}
      <ConversationDrawer
        isOpen={isDrawerOpen}
        onClose={() => { setIsDrawerOpen(false); setActiveTab('home') }}
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

      {/* Header */}
      <header className="ka-header">
        <div className="ka-header-left">
          <button className="ka-menu-btn" onClick={() => setIsDrawerOpen(true)} aria-label="Conversations">
            <Menu size={18} />
          </button>
          <button className="ka-home-btn" onClick={() => { closeAllPanels(); handleNewChat() }} aria-label="New chat">
            <img className="ka-logo" src={`${import.meta.env.BASE_URL}logo-mark.svg`} alt="Kernel" />
            <span className="ka-title">
              {activeConversation ? activeConversation.title : 'Kernel Agent'}
            </span>
          </button>
        </div>
        <div className="ka-header-right">
          {isAdmin && (
            <span className="ka-admin-badge"><Shield size={12} /> Admin</span>
          )}
          {!isAdmin && isSubscribed && (
            <span className="ka-pro-badge"><Crown size={12} /> Pro</span>
          )}
          {user && <NotificationBell userId={user.id} />}
          <button className="ka-header-icon-btn" onClick={() => setDarkMode(!darkMode)} aria-label="Toggle dark mode">
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <div className="ka-header-menu-wrap" ref={headerMenuRef}>
            <button className="ka-header-icon-btn" onClick={() => setHeaderMenuOpen(!headerMenuOpen)} aria-label="More options">
              <EllipsisVertical size={16} />
            </button>
            {headerMenuOpen && (
              <div className="ka-header-menu">
                {messages.length > 0 && (
                  <>
                    <div className="ka-header-menu-label">Conversation</div>
                    <button className="ka-header-menu-item" onClick={() => { setShowShareModal(true); setHeaderMenuOpen(false) }}>
                      <Share2 size={14} />
                      Share conversation
                    </button>
                    <button className="ka-header-menu-item" onClick={() => { handleExportConversation(); setHeaderMenuOpen(false) }}>
                      <FileDown size={14} />
                      Export as Markdown
                    </button>
                  </>
                )}
                <div className="ka-header-menu-divider ka-menu-tabbed" />
                <div className="ka-header-menu-label ka-menu-tabbed">Features</div>
                <button className="ka-header-menu-item ka-menu-tabbed" onClick={() => { closeAllPanels(); setShowGoalsPanel(true); setHeaderMenuOpen(false) }}>
                  <Target size={14} />
                  Goals
                </button>
                <button className="ka-header-menu-item ka-menu-tabbed" onClick={() => { closeAllPanels(); setShowWorkflowsPanel(true); setHeaderMenuOpen(false) }}>
                  <Zap size={14} />
                  Workflows
                </button>
                <button className="ka-header-menu-item ka-menu-tabbed" onClick={() => { closeAllPanels(); setShowScheduledPanel(true); setHeaderMenuOpen(false) }}>
                  <Clock size={14} />
                  Scheduled tasks
                </button>
                <button className="ka-header-menu-item ka-menu-tabbed" onClick={() => { closeAllPanels(); setShowBriefingPanel(true); setHeaderMenuOpen(false) }}>
                  <Newspaper size={14} />
                  Daily briefing
                </button>
                <button className="ka-header-menu-item ka-menu-tabbed" onClick={() => { closeAllPanels(); setShowKGPanel(true); setHeaderMenuOpen(false) }}>
                  <Brain size={14} />
                  What Kernel knows
                </button>
                <button className="ka-header-menu-item ka-menu-tabbed" onClick={() => { closeAllPanels(); setShowStatsPanel(true); setHeaderMenuOpen(false) }}>
                  <BarChart3 size={14} />
                  Your stats
                </button>
                <div className="ka-header-menu-divider" />
                <div className="ka-header-menu-label ka-menu-tabbed">Account</div>
                {!isPro && (
                  <button className="ka-header-menu-item ka-header-menu-item--upgrade ka-menu-tabbed" onClick={() => { handleUpgrade(); setHeaderMenuOpen(false) }}>
                    <Crown size={14} />
                    Upgrade to Pro
                  </button>
                )}
                {!isAdmin && isSubscribed && (
                  <button className="ka-header-menu-item ka-menu-tabbed" onClick={() => { handleManageSubscription(); setHeaderMenuOpen(false) }} disabled={portalLoading}>
                    <Settings size={14} className={portalLoading ? 'ka-spin' : ''} />
                    Manage subscription
                  </button>
                )}
                <button className="ka-header-menu-item ka-menu-tabbed" onClick={() => { signOut(); setHeaderMenuOpen(false) }}>
                  <LogOut size={14} />
                  Sign out
                </button>
                <button className="ka-header-menu-item ka-header-menu-item--danger ka-menu-tabbed" onClick={() => { setShowDeleteConfirm(true); setHeaderMenuOpen(false) }}>
                  <Trash2 size={14} />
                  Delete account
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      {portalError && (
        <div className="ka-portal-error">
          {portalError}
          <button onClick={() => setPortalError('')}>&times;</button>
        </div>
      )}

      {/* Chat Area */}
      <div className="ka-chat" ref={scrollRef}>
        {msgsLoading && (
          <div className="ka-skeleton-wrap">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className={`ka-skeleton-msg ${i % 2 === 0 ? 'ka-skeleton-msg--right' : ''}`}>
                <div className="ka-skeleton-line ka-skeleton-line--long" />
                {i % 2 !== 0 && <div className="ka-skeleton-line ka-skeleton-line--short" />}
              </div>
            ))}
          </div>
        )}
        {messages.length === 0 && !msgsLoading && (
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
            {todayBriefing && (
              <div className="ka-home-briefing-card">
                <div className="ka-home-briefing-info">
                  <Newspaper size={16} className="ka-home-briefing-icon" />
                  <div className="ka-home-briefing-text">
                    <span className="ka-home-briefing-label">Today's briefing</span>
                    <span className="ka-home-briefing-title">{todayBriefing.title}</span>
                  </div>
                </div>
                <div className="ka-home-briefing-actions">
                  <button
                    className="ka-home-briefing-btn"
                    onClick={() => { closeOtherPanels('briefings'); setShowBriefingPanel(true); setActiveTab('briefings') }}
                  >
                    Read
                  </button>
                  <button
                    className="ka-home-briefing-btn ka-home-briefing-btn--discuss"
                    onClick={() => handleBriefingGoDeeper(todayBriefing.title, todayBriefing.content)}
                  >
                    <MessageCircle size={12} />
                    Discuss
                  </button>
                </div>
              </div>
            )}
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

        {researchProgress && researchProgress.phase !== 'complete' && (
          <div className="ka-research-status">
            <span className="ka-research-dot" />
            <span className="ka-research-phase">{researchProgress.phase}</span>
            {(researchProgress.phase === 'searching' || researchProgress.phase === 'reformulating') && (
              <span className="ka-research-detail">
                {researchProgress.completedQueries}/{researchProgress.totalQueries}
                {researchProgress.currentQuery && ` — ${researchProgress.currentQuery}`}
              </span>
            )}
            {researchProgress.confidence !== undefined && researchProgress.phase === 'synthesizing' && researchProgress.confidence < 0.5 && (
              <span className="ka-research-detail">low confidence</span>
            )}
          </div>
        )}

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

        {swarmProgress && swarmProgress.phase !== 'complete' && (
          <div className="ka-swarm-status">
            <div className="ka-swarm-phase">
              {swarmProgress.phase === 'selecting' && 'Assembling agents...'}
              {swarmProgress.phase === 'collaborating' && 'Agents collaborating'}
              {swarmProgress.phase === 'synthesizing' && 'Synthesizing perspectives...'}
            </div>
            {swarmProgress.agents.length > 0 && (
              <div className="ka-swarm-agents">
                {swarmProgress.agents.map(agent => (
                  <span
                    key={agent.id}
                    className={`ka-swarm-agent ka-swarm-agent--${agent.status}`}
                  >
                    <span className="ka-swarm-agent-icon">{agent.icon}</span>
                    <span className="ka-swarm-agent-name">{agent.name}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <AnimatePresence>
          {isThinking && (
            <motion.div
              className="ka-thinking"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
            >
              <div className="ka-thinking-dots">
                <span /><span /><span />
              </div>
              <div className="ka-thinking-info">
                {thinkingAgent ? (
                  <motion.span
                    key={thinkingAgent}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="ka-thinking-text"
                  >
                    {thinkingAgent} is working...
                  </motion.span>
                ) : (
                  <span className="ka-thinking-text">Routing to specialist...</span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
                      onClick={() => downloadFile(msg.content, `kernel-${new Date(msg.timestamp).toISOString().slice(0, 10)}.md`)}
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

        <EventFeed events={events} />
      </div>

      {/* Scroll to bottom */}
      <AnimatePresence>
        {showScrollBtn && (
          <motion.button
            className="ka-scroll-btn"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => {
              scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
            }}
            aria-label="Scroll to bottom"
          >
            <ChevronDown size={18} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Input */}
      {attachedFiles.length > 0 && (
        <div className="ka-file-chips">
          {attachedFiles.map((f, i) => (
            <span key={i} className={`ka-file-chip${isStreaming ? ' ka-file-chip--sending' : ''}`}>
              <Paperclip size={12} />
              <span className="ka-file-chip-name">{f.name}</span>
              <span className="ka-file-chip-size">{f.size < 1024 ? `${f.size}B` : f.size < 1048576 ? `${(f.size / 1024).toFixed(0)}KB` : `${(f.size / 1048576).toFixed(1)}MB`}</span>
              {!isStreaming && (
                <button type="button" className="ka-file-chip-x" onClick={() => removeFile(i)}>
                  <X size={12} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      {/* Upgrade Wall Modal */}
      <AnimatePresence>
        {showUpgradeWall && (
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
              <div className="ka-upgrade-icon">K</div>
              <h2 className="ka-upgrade-title">You've used your {FREE_MSG_LIMIT} free messages</h2>
              <p className="ka-upgrade-subtitle">Upgrade to Kernel Pro to keep the conversation going.</p>
              <ul className="ka-upgrade-features">
                <li>Unlimited messages</li>
                <li>Deep research mode</li>
                <li>Multi-agent collaboration</li>
                <li>Multi-step task planning</li>
                <li>Persistent memory across sessions</li>
              </ul>
              <button
                className="ka-upgrade-btn"
                onClick={handleUpgrade}
                disabled={upgradeLoading}
              >
                {upgradeLoading ? 'Opening checkout...' : 'Upgrade to Pro \u2014 $20/mo'}
              </button>
              <button
                className="ka-upgrade-dismiss"
                onClick={() => setShowUpgradeWall(false)}
              >
                Maybe later
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Share Modal */}
      <AnimatePresence>
        {showShareModal && activeConversationId && user && (
          <ShareModal
            conversationId={activeConversationId}
            conversationTitle={activeConversation?.title || 'Kernel Conversation'}
            messages={messages.map(m => ({
              role: m.role,
              content: m.content,
              agentName: m.agentName,
              timestamp: m.timestamp,
            }))}
            userId={user.id}
            onClose={() => setShowShareModal(false)}
            onToast={showToast}
          />
        )}
      </AnimatePresence>

      {/* Delete Account Confirmation */}
      <AnimatePresence>
        {showDeleteConfirm && (
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
              <div className="ka-upgrade-icon" style={{ background: '#DC2626' }}>
                <Trash2 size={22} />
              </div>
              <h2 className="ka-upgrade-title">Delete your account?</h2>
              <p className="ka-upgrade-subtitle">
                This permanently deletes all your data: conversations, memory, and preferences. This cannot be undone.
                {isSubscribed && ' Your subscription will also be cancelled.'}
              </p>
              <button
                className="ka-upgrade-btn"
                style={{ background: '#DC2626' }}
                onClick={handleDeleteAccount}
                disabled={deleteLoading}
              >
                {deleteLoading ? 'Deleting...' : 'Yes, delete my account'}
              </button>
              <button
                className="ka-upgrade-dismiss"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Free-tier message counter hint */}
      <AnimatePresence>
        {!isPro && messageCountRef.current >= 7 && messageCountRef.current < FREE_MSG_LIMIT && !showUpgradeWall && (
          <motion.div
            className="ka-msg-hint"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            {FREE_MSG_LIMIT - messageCountRef.current === 1
              ? 'Last free message'
              : `${FREE_MSG_LIMIT - messageCountRef.current} messages remaining`}
          </motion.div>
        )}
      </AnimatePresence>

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
        <textarea
          ref={inputRef}
          className="ka-input"
          value={input}
          onChange={e => {
            setInput(e.target.value)
            // Auto-resize
            const el = e.target
            el.style.height = 'auto'
            el.style.height = Math.min(el.scrollHeight, 200) + 'px'
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSubmit(e)
            }
          }}
          placeholder="Talk to the Kernel..."
          disabled={isStreaming}
          rows={1}
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
        {isStreaming ? (
          <button
            type="button"
            className="ka-stop"
            onClick={() => {
              streamAbortRef.current?.abort()
              streamAbortRef.current = null
              setIsStreaming(false)
              setIsThinking(false)
              setResearchProgress(null)
              setTaskProgress(null)
              setSwarmProgress(null)
            }}
            aria-label="Stop generating"
          >
            <Square size={16} />
          </button>
        ) : (
          <button
            type="submit"
            className="ka-send"
            disabled={!input.trim() && attachedFiles.length === 0}
          >
            <Send size={18} />
          </button>
        )}
      </form>

      {/* Bottom Tab Bar (mobile only — hidden on desktop via CSS) */}
      <BottomTabBar activeTab={activeTab} onTabChange={handleTabChange} />

      {/* More Menu (bottom sheet from tab bar) */}
      <AnimatePresence>
        {showMoreMenu && (
          <MoreMenu
            isOpen={showMoreMenu}
            onClose={() => { setShowMoreMenu(false); setActiveTab('home') }}
            onSelect={handleMoreAction}
            isPro={isPro}
            isAdmin={isAdmin}
          />
        )}
      </AnimatePresence>

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
