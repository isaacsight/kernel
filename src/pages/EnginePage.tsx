import { useState, useRef, useEffect, useCallback, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import {
  IconSend, IconMenu, IconCopy, IconCheck, IconThumbsUp, IconThumbsDown,
  IconAttach, IconClose, IconDownload, IconMoon, IconSun, IconPencil,
  IconShare, IconExport, IconMic, IconMicOff, IconStop, IconChevronDown,
  IconMoreVertical, IconTrash, IconCrown, IconShield, IconBrain, IconChart,
  IconTarget, IconZap, IconClock, IconNewspaper, IconMessageCircle, IconLogOut,
  IconSettings, IconEye, IconPlus,
} from '../components/KernelIcons'
import { SPRING, DURATION, EASE, TRANSITION } from '../constants/motion'
import { BottomTabBar } from '../components/BottomTabBar'
import { NotificationBell } from '../components/NotificationBell'
import { KERNEL_TOPICS } from '../agents/kernel'
import { getSpecialist } from '../agents/specialists'
import { useAuthContext } from '../providers/AuthProvider'
import { upsertKGEntity, forkSharedConversation } from '../engine/SupabaseClient'
import { ConversationDrawer } from '../components/ConversationDrawer'
import { MessageContent, Linkify } from '../components/MessageContent'
import { ACCEPTED_FILES, downloadFile, EventFeed } from '../components/ChatHelpers'
import { useDarkMode } from '../hooks/useDarkMode'
import { useToast } from '../hooks/useToast'
import { useScrollTracking } from '../hooks/useScrollTracking'
import { useVoiceInput } from '../hooks/useVoiceInput'
import { useFileAttachments } from '../hooks/useFileAttachments'
import { usePanelManager } from '../hooks/usePanelManager'
import { useConversations } from '../hooks/useConversations'
import { useMessageActions } from '../hooks/useMessageActions'
import { useBilling } from '../hooks/useBilling'
import { useChatEngine } from '../hooks/useChatEngine'
import { useFeatureDiscovery } from '../hooks/useFeatureDiscovery'
import { useMiniPhone } from '../hooks/useMiniPhone'
import { lazyRetry } from '../utils/lazyRetry'
import { parseConversationFile, mineConversations, exportKernelData, downloadKernelExport } from '../engine/conversationImport'

// Lazy-loaded panels & modals (only loaded when user opens them)
// lazyRetry: on stale-cache 404, reload the page once to pick up new chunks
const LoginGate = lazyRetry(() => import('../components/LoginGate').then(m => ({ default: m.LoginGate })))
const KGPanel = lazyRetry(() => import('../components/kernel-agent/KGPanel'))
const StatsPanel = lazyRetry(() => import('../components/kernel-agent/StatsPanel'))
const GoalsPanel = lazyRetry(() => import('../components/GoalsPanel').then(m => ({ default: m.GoalsPanel })))
const WorkflowsPanel = lazyRetry(() => import('../components/WorkflowsPanel').then(m => ({ default: m.WorkflowsPanel })))
const ScheduledTasksPanel = lazyRetry(() => import('../components/ScheduledTasksPanel').then(m => ({ default: m.ScheduledTasksPanel })))
const BriefingPanel = lazyRetry(() => import('../components/BriefingPanel').then(m => ({ default: m.BriefingPanel })))
const InsightsPanel = lazyRetry(() => import('../components/InsightsPanel').then(m => ({ default: m.InsightsPanel })))
const PortabilityPanel = lazyRetry(() => import('../components/PortabilityPanel').then(m => ({ default: m.PortabilityPanel })))
const ShareModal = lazyRetry(() => import('../components/ShareModal').then(m => ({ default: m.ShareModal })))
const ConversationPicker = lazyRetry(() => import('../components/ConversationPicker').then(m => ({ default: m.ConversationPicker })))
const OnboardingFlow = lazyRetry(() => import('../components/OnboardingFlow').then(m => ({ default: m.OnboardingFlow })))
const MoreMenu = lazyRetry(() => import('../components/MoreMenu').then(m => ({ default: m.MoreMenu })))

// ─── Main Page ──────────────────────────────────────────

export function EnginePage() {
  const { user, isLoading, isAuthenticated } = useAuthContext()

  if (isLoading) {
    return (
      <div className="ka-loading-splash">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: DURATION.MODERATE, ease: EASE.OUT_STR }}
        >
          <img className="ka-loading-logo" src={`${import.meta.env.BASE_URL}logo-mark.svg`} alt="Kernel" />
        </motion.div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Suspense fallback={null}><LoginGate /></Suspense>
  }

  const onboardingKey = `kernel-onboarded-${user?.id || 'anon'}`
  const [onboarded, setOnboarded] = useState(() => localStorage.getItem(onboardingKey) === 'true')

  if (!onboarded) {
    return (
      <Suspense fallback={<div className="ka-loading-splash" />}>
        <OnboardingFlow
          userName={user?.email || undefined}
          onComplete={(interests) => {
            localStorage.setItem(onboardingKey, 'true')
            setOnboarded(true)
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
      </Suspense>
    )
  }

  return <EngineChat />
}

// ─── Helpers ─────────────────────────────────────────────

function getTimeGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function relativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

// Spring constants imported from @/constants/motion

// ─── Engine Chat (post-auth) ────────────────────────────

const FREE_MSG_LIMIT = 10

function EngineChat() {
  const { t } = useTranslation('home')
  const { user, isAdmin, isSubscribed, signOut, refreshSubscription } = useAuthContext()
  const isPro = isSubscribed || isAdmin
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const goOnline = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline) }
  }, [])

  // ─── Hooks ────────────────────────────────────────────
  const { darkMode, setDarkMode } = useDarkMode()
  const { toast, showToast } = useToast()
  const featureDiscovery = useFeatureDiscovery(user?.id)

  const billing = useBilling(user, showToast, signOut)

  const panels = usePanelManager({
    handleUpgrade: billing.handleUpgrade,
    handleManageSubscription: billing.handleManageSubscription,
    signOut,
    setShowDeleteConfirm: billing.setShowDeleteConfirm,
    setIsDrawerOpen,
  })

  const fileAttachments = useFileAttachments(isPro, showToast)

  const convs = useConversations(user?.id, (msgs) => {
    chatEngine.setMessages(msgs as any)
  })

  const chatEngine = useChatEngine({
    userId: user!.id,
    activeConversationId: convs.activeConversationId,
    setActiveConversationId: convs.setActiveConversationId,
    loadConversations: convs.loadConversations,
    createConversation: convs.createConversation,
    showToast,
    setShowUpgradeWall: billing.setShowUpgradeWall,
    signOut,
    attachedFiles: fileAttachments.attachedFiles,
    setAttachedFiles: fileAttachments.setAttachedFiles,
    handleNewChat: convs.handleNewChat,
    isPro,
  })

  const scroll = useScrollTracking(chatEngine.messages.length)

  const { isListening, toggleVoice } = useVoiceInput(
    (text) => chatEngine.setInput(text),
    showToast,
  )

  const msgActions = useMessageActions(
    chatEngine.messages,
    chatEngine.setMessages,
    convs.activeConversationId,
    convs.activeConversation,
    showToast,
    chatEngine.sendMessage,
  )

  // ─── Remaining effects ────────────────────────────────

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
          billing.setShowUpgradeWall(false)
          showToast(t('welcomeToPro'))
        }
        const cleanHash = hash.replace(/[?&]checkout=complete/, '').replace(/\?$/, '')
        window.location.hash = cleanHash || '#/'
      }
    }, 2000)
    return () => clearInterval(poll)
  }, [refreshSubscription, billing, showToast])

  // Fork shared conversation: read convId from URL search param (?fork=ID) or sessionStorage.
  // URL search params are reliable across hash router navigation (unlike history.state).
  // We wait for convsLoading to be false before switching to avoid races with mount effects.
  const forkHandledRef = useRef(false)
  const switchConvRef = useRef(convs.switchConversation)
  switchConvRef.current = convs.switchConversation
  const loadConvsRef = useRef(convs.loadConversations)
  loadConvsRef.current = convs.loadConversations

  useEffect(() => {
    if (!user || forkHandledRef.current || convs.convsLoading) return

    // Path A: conversation already forked — convId passed via localStorage from SharedConversationPage.
    // NOTE: Don't remove the key until switchConversation succeeds. EngineChat can mount twice
    // during hash-router transitions; removing eagerly lets the 2nd mount miss the key.
    const forkSuccessId = localStorage.getItem('kernel-fork-success')
    if (forkSuccessId) {
      forkHandledRef.current = true
      switchConvRef.current(forkSuccessId).then(() => {
        localStorage.removeItem('kernel-fork-success')
        loadConvsRef.current()
        showToast('Conversation forked — you can continue chatting.')
      }).catch(() => {
        forkHandledRef.current = false
      })
      return
    }

    // Path B: not logged in when they clicked Continue — fork now from localStorage intent
    const intent = localStorage.getItem('kernel-fork-intent')
    if (!intent) return

    forkHandledRef.current = true

    try {
      const parsed = JSON.parse(intent)
      forkSharedConversation(user.id, parsed.title, parsed.messages).then(async (forkId: string | null) => {
        if (forkId) {
          await switchConvRef.current(forkId)
          localStorage.removeItem('kernel-fork-intent')
          loadConvsRef.current()
          showToast('Conversation forked — you can continue chatting.')
        } else {
          forkHandledRef.current = false
          showToast('Could not continue conversation. Please try again.')
        }
      }).catch(() => {
        forkHandledRef.current = false
        showToast('Could not continue conversation. Please try again.')
      })
    } catch {
      forkHandledRef.current = false
      showToast('Could not continue conversation. Please try again.')
    }
  }, [user, convs.convsLoading])

  // Close header menu on outside click
  const headerMenuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!panels.headerMenuOpen) return
    const onClick = (e: MouseEvent) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target as Node)) {
        panels.setHeaderMenuOpen(false)
      }
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [panels.headerMenuOpen, panels])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        convs.handleNewChat()
        chatEngine.inputRef.current?.focus()
      }
      if (e.key === 'Escape') {
        if (panels.showMoreMenu) { panels.setShowMoreMenu(false); panels.setActiveTab('home') }
        if (isDrawerOpen) setIsDrawerOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isDrawerOpen, panels, convs, chatEngine.inputRef])

  // Edge swipe to open conversation drawer
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

  // ─── Derived ──────────────────────────────────────────
  const { messages, isStreaming, isThinking, thinkingAgent, events } = chatEngine
  const { researchProgress, taskProgress, swarmProgress } = chatEngine

  const [revealedTimestamps, setRevealedTimestamps] = useState<Record<string, boolean>>({})
  const [showMiniPopover, setShowMiniPopover] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const isMini = useMiniPhone()

  // Close popover on click outside
  useEffect(() => {
    if (!showMiniPopover) return
    const handleClickOutside = (e: Event) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowMiniPopover(false)
      }
    }
    document.addEventListener('pointerdown', handleClickOutside)
    return () => document.removeEventListener('pointerdown', handleClickOutside)
  }, [showMiniPopover])

  const toggleTimestamp = (msgId: string, e: React.MouseEvent) => {
    // Don't toggle when tapping interactive elements inside the message
    if ((e.target as HTMLElement).closest('a, button, pre, code, .ka-msg-actions, .ka-artifact, .ka-edit-form')) return
    setRevealedTimestamps(prev => ({
      ...prev,
      [msgId]: !prev[msgId]
    }))
  }

  // ─── Render ───────────────────────────────────────────
  return (
    <div className="ka-page">
      {/* Panel Bottom Sheets */}
      <AnimatePresence>
        {panels.showKGPanel && (
          <BottomSheet onClose={() => { panels.setShowKGPanel(false); panels.setActiveTab('home') }}>
            <Suspense fallback={<PanelShimmer />}>
              <KGPanel entities={chatEngine.kgEntities} relations={chatEngine.kgRelations} onClose={() => { panels.setShowKGPanel(false); panels.setActiveTab('home') }} />
            </Suspense>
          </BottomSheet>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {panels.showStatsPanel && user && (
          <BottomSheet onClose={() => { panels.setShowStatsPanel(false); panels.setActiveTab('home') }}>
            <Suspense fallback={<PanelShimmer />}>
              <StatsPanel userId={user.id} onClose={() => { panels.setShowStatsPanel(false); panels.setActiveTab('home') }} />
            </Suspense>
          </BottomSheet>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {panels.showGoalsPanel && user && (
          <BottomSheet onClose={() => { panels.setShowGoalsPanel(false); panels.setActiveTab('home') }}>
            <Suspense fallback={<PanelShimmer />}>
              <GoalsPanel userId={user.id} onClose={() => { panels.setShowGoalsPanel(false); panels.setActiveTab('home') }} onToast={showToast} />
            </Suspense>
          </BottomSheet>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {panels.showWorkflowsPanel && user && (
          <BottomSheet onClose={() => { panels.setShowWorkflowsPanel(false); panels.setActiveTab('home') }}>
            <Suspense fallback={<PanelShimmer />}>
              <WorkflowsPanel
                userId={user.id}
                onClose={() => { panels.setShowWorkflowsPanel(false); panels.setActiveTab('home') }}
                onToast={showToast}
                onRunWorkflow={(proc) => {
                  panels.setShowWorkflowsPanel(false)
                  chatEngine.sendMessage(`Run workflow: ${proc.name}`)
                }}
              />
            </Suspense>
          </BottomSheet>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {panels.showScheduledPanel && user && (
          <BottomSheet onClose={() => { panels.setShowScheduledPanel(false); panels.setActiveTab('home') }}>
            <Suspense fallback={<PanelShimmer />}>
              <ScheduledTasksPanel userId={user.id} onClose={() => { panels.setShowScheduledPanel(false); panels.setActiveTab('home') }} onToast={showToast} />
            </Suspense>
          </BottomSheet>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {panels.showBriefingPanel && user && (
          <BottomSheet onClose={() => { panels.setShowBriefingPanel(false); panels.setActiveTab('home') }}>
            <Suspense fallback={<PanelShimmer />}>
              <BriefingPanel
                userId={user.id}
                userMemory={chatEngine.userMemory}
                kgEntities={chatEngine.kgEntities}
                onClose={() => { panels.setShowBriefingPanel(false); panels.setActiveTab('home') }}
                onToast={showToast}
                onGoDeeper={(title, content) => { panels.setShowBriefingPanel(false); panels.setActiveTab('home'); chatEngine.handleBriefingGoDeeper(title, content) }}
                onAddGoal={chatEngine.handleBriefingAddGoal}
              />
            </Suspense>
          </BottomSheet>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {panels.showInsightsPanel && user && (
          <BottomSheet onClose={() => { panels.setShowInsightsPanel(false); panels.setActiveTab('home') }}>
            <Suspense fallback={<PanelShimmer />}>
              <InsightsPanel
                engineState={chatEngine.engineState}
                userMemory={chatEngine.userMemory}
                onChallengeBelief={(id) => chatEngine.engine.challengeBelief(id)}
                onRemoveBelief={(id) => chatEngine.engine.removeBelief(id)}
                onClose={() => { panels.setShowInsightsPanel(false); panels.setActiveTab('home') }}
              />
            </Suspense>
          </BottomSheet>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {panels.showPortabilityPanel && user && (
          <BottomSheet onClose={() => { panels.setShowPortabilityPanel(false); panels.setActiveTab('home') }}>
            <Suspense fallback={<PanelShimmer />}>
              <PortabilityPanel
                userId={user.id}
                userMemory={chatEngine.userMemory}
                kgEntities={chatEngine.kgEntities}
                conversationCount={convs.conversations.length}
                onImportFiles={async (files) => {
                  for (const file of files) {
                    try {
                      const conversations = await parseConversationFile(file)
                      if (conversations.length > 0) {
                        mineConversations(user.id, conversations).catch(() => {})
                        showToast(`Imported ${conversations.length} conversation${conversations.length > 1 ? 's' : ''} from ${file.name}`)
                      } else {
                        showToast('No conversations found in file')
                      }
                    } catch {
                      showToast('Could not parse file')
                    }
                  }
                }}
                onPasteShareLink={(url) => {
                  panels.setShowPortabilityPanel(false)
                  panels.setActiveTab('home')
                  chatEngine.sendMessage(url)
                }}
                onExport={async () => {
                  try {
                    const data = await exportKernelData(
                      user.id,
                      convs.conversations.map(c => ({
                        id: c.id,
                        title: c.title,
                        messages: chatEngine.messages.map(m => ({
                          role: m.role,
                          content: m.content,
                          agentName: m.agentName,
                          timestamp: m.timestamp,
                        })),
                      })),
                    )
                    downloadKernelExport(data)
                    showToast('Kernel data exported')
                  } catch {
                    showToast('Export failed')
                  }
                }}
                onClose={() => { panels.setShowPortabilityPanel(false); panels.setActiveTab('home') }}
                onToast={showToast}
              />
            </Suspense>
          </BottomSheet>
        )}
      </AnimatePresence>

      {/* Conversation Drawer */}
      <ConversationDrawer
        isOpen={isDrawerOpen}
        onClose={() => { setIsDrawerOpen(false); panels.setActiveTab('home') }}
        conversations={convs.conversations}
        activeId={convs.activeConversationId}
        onSelect={convs.switchConversation}
        onNewChat={convs.handleNewChat}
        onDelete={convs.handleDeleteConversation}
        onRename={(id, title) => {
          convs.setConversations(prev => prev.map(c => c.id === id ? { ...c, title } : c))
        }}
        onShare={(id) => {
          setIsDrawerOpen(false)
          setTimeout(async () => {
            await convs.switchConversation(id)
            msgActions.setShowShareModal(true)
          }, 250)
        }}
        isLoading={convs.convsLoading}
      />

      {/* Header */}
      <header className="ka-header">
        <div className="ka-header-left">
          <button className="ka-menu-btn" onClick={() => setIsDrawerOpen(true)} aria-label={t('aria.conversations', { ns: 'common' })}>
            <IconMenu size={18} />
          </button>
          <button className="ka-home-btn" onClick={() => { panels.closeAllPanels(); convs.handleNewChat() }} aria-label={t('aria.newChat', { ns: 'common' })}>
            <img className="ka-logo" src={`${import.meta.env.BASE_URL}logo-mark.svg`} alt="Kernel" />
            <span className="ka-title">
              {convs.activeConversation ? convs.activeConversation.title : 'Kernel'}
            </span>
          </button>
        </div>
        <div className="ka-header-right">
          {isAdmin && <span className="ka-admin-badge"><IconShield size={12} /> {t('admin')}</span>}
          {!isAdmin && isSubscribed && <span className="ka-pro-badge"><IconCrown size={12} /> {t('pro')}</span>}
          {user && <NotificationBell userId={user.id} />}
          <button className="ka-header-icon-btn" onClick={() => setDarkMode(!darkMode)} aria-label={t('aria.toggleDarkMode', { ns: 'common' })}>
            {darkMode ? <IconSun size={16} /> : <IconMoon size={16} />}
          </button>
          <div className="ka-header-menu-wrap" ref={headerMenuRef}>
            <button className="ka-header-icon-btn" onClick={() => panels.setHeaderMenuOpen(!panels.headerMenuOpen)} aria-label={t('aria.moreOptions', { ns: 'common' })}>
              <IconMoreVertical size={16} />
            </button>
            {panels.headerMenuOpen && (
              <div className="ka-header-menu">
                {messages.length > 0 && (
                  <>
                    <div className="ka-header-menu-label">{t('conversation', { ns: 'common' })}</div>
                    <button className="ka-header-menu-item" onClick={() => { msgActions.setShowShareModal(true); panels.setHeaderMenuOpen(false) }}>
                      <IconShare size={16} /> {t('menu.shareConversation')}
                    </button>
                    <button className="ka-header-menu-item" onClick={() => { msgActions.handleExportConversation(); panels.setHeaderMenuOpen(false) }}>
                      <IconExport size={16} /> {t('menu.exportMarkdown')}
                    </button>
                  </>
                )}
                <div className="ka-header-menu-divider ka-menu-tabbed" />
                <div className="ka-header-menu-label ka-menu-tabbed">{t('features', { ns: 'common' })}</div>
                <button className="ka-header-menu-item ka-menu-tabbed" onClick={() => { panels.closeAllPanels(); panels.setShowGoalsPanel(true); panels.setHeaderMenuOpen(false) }}>
                  <IconTarget size={16} /> {t('menu.goals')}
                </button>
                <button className="ka-header-menu-item ka-menu-tabbed" onClick={() => { featureDiscovery.markDiscovered('workflows'); panels.closeAllPanels(); panels.setShowWorkflowsPanel(true); panels.setHeaderMenuOpen(false) }}>
                  <IconZap size={16} /> {t('menu.workflows')}
                  {featureDiscovery.isNew('workflows') && <span className="ka-feature-dot" />}
                </button>
                <button className="ka-header-menu-item ka-menu-tabbed" onClick={() => { featureDiscovery.markDiscovered('scheduled'); panels.closeAllPanels(); panels.setShowScheduledPanel(true); panels.setHeaderMenuOpen(false) }}>
                  <IconClock size={16} /> {t('menu.scheduledTasks')}
                  {featureDiscovery.isNew('scheduled') && <span className="ka-feature-dot" />}
                </button>
                <button className="ka-header-menu-item ka-menu-tabbed" onClick={() => { panels.closeAllPanels(); panels.setShowBriefingPanel(true); panels.setHeaderMenuOpen(false) }}>
                  <IconNewspaper size={16} /> {t('menu.dailyBriefing')}
                </button>
                <button className="ka-header-menu-item ka-menu-tabbed" onClick={() => { featureDiscovery.markDiscovered('knowledge'); panels.closeAllPanels(); panels.setShowKGPanel(true); panels.setHeaderMenuOpen(false) }}>
                  <IconBrain size={16} /> {t('menu.whatKernelKnows')}
                  {featureDiscovery.isNew('knowledge') && <span className="ka-feature-dot" />}
                </button>
                <button className="ka-header-menu-item ka-menu-tabbed" onClick={() => { featureDiscovery.markDiscovered('stats'); panels.closeAllPanels(); panels.setShowStatsPanel(true); panels.setHeaderMenuOpen(false) }}>
                  <IconChart size={16} /> {t('menu.yourStats')}
                  {featureDiscovery.isNew('stats') && <span className="ka-feature-dot" />}
                </button>
                <button className="ka-header-menu-item ka-menu-tabbed" onClick={() => { featureDiscovery.markDiscovered('insights'); panels.closeAllPanels(); panels.setShowInsightsPanel(true); panels.setHeaderMenuOpen(false) }}>
                  <IconEye size={16} /> {t('menu.insights')}
                  {featureDiscovery.isNew('insights') && <span className="ka-feature-dot" />}
                </button>
                <button className="ka-header-menu-item ka-menu-tabbed" onClick={() => { featureDiscovery.markDiscovered('portability'); panels.closeAllPanels(); panels.setShowPortabilityPanel(true); panels.setHeaderMenuOpen(false) }}>
                  <IconExport size={16} /> {t('menu.portability')}
                  {featureDiscovery.isNew('portability') && <span className="ka-feature-dot" />}
                </button>
                <div className="ka-header-menu-divider" />
                <div className="ka-header-menu-label ka-menu-tabbed">{t('account', { ns: 'common' })}</div>
                {!isPro && (
                  <button className="ka-header-menu-item ka-header-menu-item--upgrade ka-menu-tabbed" onClick={() => { billing.handleUpgrade(); panels.setHeaderMenuOpen(false) }}>
                    <IconCrown size={16} /> {t('menu.upgradeToPro')}
                  </button>
                )}
                {!isAdmin && isSubscribed && (
                  <button className="ka-header-menu-item ka-menu-tabbed" onClick={() => { billing.handleManageSubscription(); panels.setHeaderMenuOpen(false) }} disabled={billing.portalLoading}>
                    <IconSettings size={16} className={billing.portalLoading ? 'ka-spin' : ''} /> {t('menu.manageSubscription')}
                  </button>
                )}
                <button className="ka-header-menu-item ka-menu-tabbed" onClick={() => { signOut(); panels.setHeaderMenuOpen(false) }}>
                  <IconLogOut size={16} /> {t('menu.signOut')}
                </button>
                <button className="ka-header-menu-item ka-header-menu-item--danger ka-menu-tabbed" onClick={() => { billing.setShowDeleteConfirm(true); panels.setHeaderMenuOpen(false) }}>
                  <IconTrash size={16} /> {t('menu.deleteAccount')}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      {billing.portalError && (
        <div className="ka-portal-error">
          {billing.portalError}
          <button onClick={() => billing.setPortalError('')}>&times;</button>
        </div>
      )}

      {/* Chat Area */}
      <div className="ka-chat" ref={scroll.scrollRef}>
        {convs.msgsLoading && (
          <div className="ka-skeleton-wrap">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className={`ka-skeleton-msg ${i % 2 === 0 ? 'ka-skeleton-msg--right' : ''}`}>
                <div className="ka-skeleton-line ka-skeleton-line--long" />
                {i % 2 !== 0 && <div className="ka-skeleton-line ka-skeleton-line--short" />}
              </div>
            ))}
          </div>
        )}
        {messages.length === 0 && !convs.msgsLoading && (
          <motion.div className="ka-empty" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <img className="ka-empty-illustration" src={`${import.meta.env.BASE_URL}concepts/empty-state.svg`} alt="" aria-hidden="true" />
            <h1 className="ka-empty-title">Kernel</h1>
            <p className="ka-empty-subtitle">{t('tagline')}</p>
            <p className="ka-home-greeting">{getTimeGreeting()}</p>
            {chatEngine.todayBriefing && (
              <div className="ka-home-briefing-card">
                <div className="ka-home-briefing-info">
                  <IconNewspaper size={16} className="ka-home-briefing-icon" />
                  <div className="ka-home-briefing-text">
                    <span className="ka-home-briefing-label">{t('briefing.todaysBriefing')}</span>
                    <span className="ka-home-briefing-title">{chatEngine.todayBriefing.title}</span>
                  </div>
                </div>
                <div className="ka-home-briefing-actions">
                  <button className="ka-home-briefing-btn" onClick={() => { panels.closeOtherPanels('briefings'); panels.setShowBriefingPanel(true); panels.setActiveTab('briefings') }}>{t('briefing.read')}</button>
                  <button className="ka-home-briefing-btn ka-home-briefing-btn--discuss" onClick={() => chatEngine.handleBriefingGoDeeper(chatEngine.todayBriefing!.title, chatEngine.todayBriefing!.content)}>
                    <IconMessageCircle size={12} /> {t('briefing.discuss')}
                  </button>
                </div>
              </div>
            )}
            {convs.conversations.length > 0 && (
              <div className="ka-home-recent">
                {convs.conversations.slice(0, 2).map(c => (
                  <div key={c.id} className="ka-home-context-item" onClick={() => convs.switchConversation(c.id)}>
                    <span className="ka-home-context-title">{c.title}</span>
                    <span className="ka-home-context-time">{relativeTime(c.updated_at)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="ka-topics">
              {KERNEL_TOPICS.map(t => (
                <button key={t.label} className="ka-topic" onClick={() => chatEngine.sendMessage(t.prompt)}>{t.label}</button>
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
              <span className="ka-research-detail">{t('status.lowConfidence')}</span>
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
              {swarmProgress.phase === 'selecting' && t('status.assemblingAgents')}
              {swarmProgress.phase === 'collaborating' && t('status.agentsCollaborating')}
              {swarmProgress.phase === 'synthesizing' && t('status.synthesizingPerspectives')}
            </div>
            {swarmProgress.agents.length > 0 && (
              <div className="ka-swarm-agents">
                {swarmProgress.agents.map(agent => (
                  <span key={agent.id} className={`ka-swarm-agent ka-swarm-agent--${agent.status}`}>
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
            <motion.div className="ka-thinking" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
              <div className="ka-thinking-dots"><span /><span /><span /></div>
              <div className="ka-thinking-info">
                {thinkingAgent ? (
                  <motion.span key={thinkingAgent} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="ka-thinking-text">{t('status.isWorking', { agent: thinkingAgent })}</motion.span>
                ) : (
                  <span className="ka-thinking-text">{t('status.routingToSpecialist')}</span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div key={msg.id} className={`ka-msg ka-msg--${msg.role}`} style={{ '--msg-index': i } as React.CSSProperties} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={TRANSITION.MESSAGE}>
              {msg.role === 'kernel' && (
                <div className="ka-msg-avatar-col">
                  <div className="ka-msg-avatar" data-agent={msg.agentId || 'kernel'}>
                    <img src={`${import.meta.env.BASE_URL}${getSpecialist(msg.agentId || 'kernel').emblem || 'concepts/emblem-kernel.svg'}`} alt="" aria-hidden="true" className="ka-msg-avatar-img" />
                  </div>
                  {msg.agentName && msg.agentName !== 'Kernel' && (
                    <span className="ka-agent-badge" style={{ color: getSpecialist(msg.agentId || 'kernel').color }}>{msg.agentName}</span>
                  )}
                </div>
              )}
              <div className="ka-msg-col" onClick={(e) => { if (isMini) toggleTimestamp(msg.id, e) }}>
                <div className="ka-msg-bubble">
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="ka-msg-attachments">
                      {msg.attachments.map((a, i) => <span key={i} className="ka-msg-attachment">{a.name}</span>)}
                    </div>
                  )}
                  {msgActions.editingMsgId === msg.id ? (
                    <form className="ka-edit-form" onSubmit={(e) => { e.preventDefault(); msgActions.handleEditMessage(msg.id, msgActions.editingContent) }}>
                      <input className="ka-edit-input" value={msgActions.editingContent} onChange={e => msgActions.setEditingContent(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { msgActions.setEditingMsgId(null); msgActions.setEditingContent('') } }} />
                      <button type="submit" className="ka-edit-save">{t('feedback.save')}</button>
                      <button type="button" className="ka-edit-cancel" onClick={() => { msgActions.setEditingMsgId(null); msgActions.setEditingContent('') }}>{t('feedback.cancel')}</button>
                    </form>
                  ) : msg.content ? (
                    msg.role === 'kernel' ? <MessageContent text={msg.content} /> : <Linkify text={msg.content} />
                  ) : (
                    <span className="ka-typing"><span /><span /><span /></span>
                  )}
                </div>
                {msg.role === 'user' && msg.content && !isStreaming && msgActions.editingMsgId !== msg.id && (
                  <div className="ka-msg-actions">
                    <button className="ka-msg-action-btn" onClick={() => { msgActions.setEditingMsgId(msg.id); msgActions.setEditingContent(msg.content) }} aria-label={t('aria.editMessage', { ns: 'common' })}>
                      <IconPencil size={14} />
                    </button>
                  </div>
                )}
                {msg.role === 'kernel' && msg.content && (
                  <div className="ka-msg-actions">
                    <button className="ka-msg-action-btn" onClick={() => msgActions.handleCopyMessage(msg.id, msg.content)} aria-label={t('aria.copyMessage', { ns: 'common' })}>
                      {msgActions.copiedMsgId === msg.id ? <IconCheck size={14} /> : <IconCopy size={14} />}
                    </button>
                    <button className="ka-msg-action-btn" onClick={() => downloadFile(msg.content, `kernel-${new Date(msg.timestamp).toISOString().slice(0, 10)}.md`)} aria-label={t('aria.downloadResponse', { ns: 'common' })}>
                      <IconDownload size={14} />
                    </button>
                    {msg.signalId && !msg.feedback && (
                      <>
                        <button className="ka-msg-action-btn ka-msg-action-btn--up" onClick={() => msgActions.handleFeedback(msg, 'helpful')} aria-label={t('aria.helpful', { ns: 'common' })}><IconThumbsUp size={14} /></button>
                        <button className="ka-msg-action-btn ka-msg-action-btn--down" onClick={() => msgActions.handleFeedback(msg, 'poor')} aria-label={t('aria.notHelpful', { ns: 'common' })}><IconThumbsDown size={14} /></button>
                      </>
                    )}
                    {msg.feedback && (
                      <span className="ka-msg-feedback-done">{msg.feedback === 'helpful' ? <IconThumbsUp size={14} /> : <IconThumbsDown size={14} />}</span>
                    )}
                  </div>
                )}
                <div className={`ka-msg-time${revealedTimestamps[msg.id] ? ' ka-msg-time--visible' : ''}`}>
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        <EventFeed events={events} />
      </div>

      {/* Scroll to bottom */}
      <AnimatePresence>
        {scroll.showScrollBtn && (
          <motion.button className="ka-scroll-btn" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} onClick={scroll.scrollToBottom} aria-label={t('aria.scrollToBottom', { ns: 'common' })}>
            <IconChevronDown size={18} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* File chips */}
      {fileAttachments.attachedFiles.length > 0 && (
        <div className="ka-file-chips">
          {fileAttachments.attachedFiles.map((f, i) => (
            <span key={i} className={`ka-file-chip${isStreaming ? ' ka-file-chip--sending' : ''}`}>
              <IconAttach size={12} />
              <span className="ka-file-chip-name">{f.name}</span>
              <span className="ka-file-chip-size">{f.size < 1024 ? `${f.size}B` : f.size < 1048576 ? `${(f.size / 1024).toFixed(0)}KB` : `${(f.size / 1048576).toFixed(1)}MB`}</span>
              {!isStreaming && (
                <button type="button" className="ka-file-chip-x" onClick={() => fileAttachments.removeFile(i)}><IconClose size={12} /></button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Upgrade Wall */}
      <AnimatePresence>
        {billing.showUpgradeWall && (
          <motion.div className="ka-upgrade-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="ka-upgrade-modal" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}>
              <img className="ka-upgrade-emblem" src={`${import.meta.env.BASE_URL}concepts/emblem-kernel.svg`} alt="" aria-hidden="true" />
              <h2 className="ka-upgrade-title">{t('upgrade.title', { limit: FREE_MSG_LIMIT })}</h2>
              <p className="ka-upgrade-subtitle">{t('upgrade.subtitle')}</p>
              <ul className="ka-upgrade-features">
                <li>{t('upgrade.features.unlimitedMessages')}</li><li>{t('upgrade.features.deepResearch')}</li><li>{t('upgrade.features.multiAgent')}</li><li>{t('upgrade.features.multiStep')}</li><li>{t('upgrade.features.persistentMemory')}</li>
              </ul>
              <button className="ka-upgrade-btn" onClick={billing.handleUpgrade} disabled={billing.upgradeLoading}>
                {billing.upgradeLoading ? t('upgrade.buttonLoading') : t('upgrade.button')}
              </button>
              <button className="ka-upgrade-dismiss" onClick={() => billing.setShowUpgradeWall(false)}>{t('upgrade.maybeLater')}</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Share Modal */}
      <AnimatePresence>
        {msgActions.showShareModal && convs.activeConversationId && user && (
          <Suspense fallback={null}>
            <ShareModal
              conversationId={convs.activeConversationId}
              conversationTitle={convs.activeConversation?.title || 'Kernel Conversation'}
              messages={messages.map(m => ({ role: m.role, content: m.content, agentName: m.agentName, timestamp: m.timestamp }))}
              userId={user.id}
              isPro={isPro}
              onClose={() => msgActions.setShowShareModal(false)}
              onToast={showToast}
              onNativeShare={msgActions.handleNativeShare}
            />
          </Suspense>
        )}
      </AnimatePresence>

      {/* Conversation Import Picker */}
      <AnimatePresence>
        {chatEngine.pickerConversations && (
          <Suspense fallback={null}>
            <ConversationPicker
              conversations={chatEngine.pickerConversations}
              onConfirm={chatEngine.handlePickerConfirm}
              onCancel={chatEngine.handlePickerCancel}
            />
          </Suspense>
        )}
      </AnimatePresence>

      {/* Delete Account Confirmation */}
      <AnimatePresence>
        {billing.showDeleteConfirm && (
          <motion.div className="ka-upgrade-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="ka-upgrade-modal" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}>
              <div className="ka-upgrade-icon ka-upgrade-icon--danger"><IconTrash size={22} /></div>
              <h2 className="ka-upgrade-title">{t('deleteConfirm.title')}</h2>
              <p className="ka-upgrade-subtitle">
                {t('deleteConfirm.subtitle')}
                {isSubscribed && t('deleteConfirm.subtitleWithSub')}
              </p>
              <button className="ka-upgrade-btn ka-upgrade-btn--danger" onClick={billing.handleDeleteAccount} disabled={billing.deleteLoading}>
                {billing.deleteLoading ? t('deleteConfirm.confirming') : t('deleteConfirm.confirm')}
              </button>
              <button className="ka-upgrade-dismiss" onClick={() => billing.setShowDeleteConfirm(false)}>{t('cancel', { ns: 'common' })}</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Free-tier hint */}
      <AnimatePresence>
        {!isPro && chatEngine.messageCountRef.current >= 7 && chatEngine.messageCountRef.current < FREE_MSG_LIMIT && !billing.showUpgradeWall && (
          <motion.div className="ka-msg-hint" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            {FREE_MSG_LIMIT - chatEngine.messageCountRef.current === 1 ? t('lastFreeMessage') : t('messagesRemaining', { count: FREE_MSG_LIMIT - chatEngine.messageCountRef.current })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input bar */}
      <form className="ka-input-bar" onSubmit={chatEngine.handleSubmit}>
        <input id="ka-file-input" ref={fileAttachments.fileInputRef} type="file" accept={ACCEPTED_FILES} multiple onChange={fileAttachments.handleFileSelect} className="ka-attach-input" />

        {isMini ? (
          <div className="ka-mini-popover-wrap" ref={popoverRef}>
            <button type="button" className={`ka-attach-btn${isStreaming ? ' ka-attach-btn--disabled' : ''}`} onClick={() => setShowMiniPopover(!showMiniPopover)}>
              <IconPlus size={18} />
            </button>
            {showMiniPopover && (
              <div className="ka-mini-popover">
                <label htmlFor="ka-file-input" className={`ka-mini-popover-item${isStreaming ? ' ka-attach-btn--disabled' : ''}`} onClick={() => setShowMiniPopover(false)}>
                  <IconAttach size={16} /> <span>{t('aria.attachFile', { ns: 'common' })}</span>
                </label>
                <button type="button" className={`ka-mini-popover-item${isListening ? ' ka-voice-btn--active' : ''}`} onClick={() => { toggleVoice(); setShowMiniPopover(false); }}>
                  {isListening ? <IconMicOff size={16} /> : <IconMic size={16} />} <span>{isListening ? t('aria.stopListening', { ns: 'common' }) : t('aria.voiceInput', { ns: 'common' })}</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <label htmlFor="ka-file-input" className={`ka-attach-btn${isStreaming ? ' ka-attach-btn--disabled' : ''}`} aria-label={t('aria.attachFile', { ns: 'common' })}>
            <IconAttach size={18} />
          </label>
        )}

        <textarea
          ref={chatEngine.inputRef}
          className="ka-input"
          value={chatEngine.input}
          onChange={e => {
            chatEngine.setInput(e.target.value)
            const el = e.target
            el.style.height = 'auto'
            el.style.height = Math.min(el.scrollHeight, 200) + 'px'
          }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); chatEngine.handleSubmit(e) } }}
          placeholder={t('placeholder')}
          disabled={isStreaming}
          rows={1}
        />
        {!isMini && (
          <button type="button" className={`ka-voice-btn${isListening ? ' ka-voice-btn--active' : ''}`} onClick={toggleVoice} disabled={isStreaming} aria-label={isListening ? t('aria.stopListening', { ns: 'common' }) : t('aria.voiceInput', { ns: 'common' })}>
            {isListening ? <IconMicOff size={18} /> : <IconMic size={18} />}
          </button>
        )}
        {isStreaming ? (
          <button type="button" className="ka-stop" onClick={chatEngine.stopStreaming} aria-label={t('aria.stopGenerating', { ns: 'common' })}><IconStop size={16} /></button>
        ) : (
          <button type="submit" className="ka-send" disabled={!chatEngine.input.trim() && fileAttachments.attachedFiles.length === 0} aria-label={t('aria.sendMessage', { ns: 'common' })}><IconSend size={18} /></button>
        )}
      </form>

      {!isOnline && <div className="ka-offline-banner">{t('offline', { ns: 'common' })}</div>}

      <BottomTabBar activeTab={panels.activeTab} onTabChange={panels.handleTabChange} undiscoveredCount={featureDiscovery.undiscoveredCount} />
      <AnimatePresence>
        {panels.showMoreMenu && (
          <Suspense fallback={null}>
            <MoreMenu isOpen={panels.showMoreMenu} onClose={() => { panels.setShowMoreMenu(false); panels.setActiveTab('home') }} onSelect={panels.handleMoreAction} isPro={isPro} isAdmin={isAdmin} isNewFeature={featureDiscovery.isNew} onFeatureDiscovered={featureDiscovery.markDiscovered} />
          </Suspense>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div className="ka-toast" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}>{toast}</motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Panel Loading Shimmer ────────────────────────────

function PanelShimmer() {
  return (
    <div className="ka-panel-shimmer">
      <div className="ka-skeleton-line ka-skeleton-line--long" />
      <div className="ka-skeleton-line ka-skeleton-line--short" />
      <div className="ka-skeleton-line ka-skeleton-line--long" />
    </div>
  )
}

// ─── Shared Bottom Sheet Component ──────────────────────

function BottomSheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div className="ka-kg-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        className="ka-kg-sheet"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={SPRING.DEFAULT}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.2}
        onDragEnd={(_, info) => { if (info.offset.y > 100 || info.velocity.y > 300) onClose() }}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <div className="ka-kg-drag-handle" />
        {children}
      </motion.div>
    </motion.div>
  )
}
