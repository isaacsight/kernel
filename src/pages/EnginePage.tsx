import { useState, useRef, useEffect, useCallback, useMemo, Suspense } from 'react'
import { motion, AnimatePresence, useDragControls } from 'framer-motion'
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
import { getSpecialist, getAllSpecialists } from '../agents/specialists'
import { useAuthContext } from '../providers/AuthProvider'
import { upsertKGEntity, forkSharedConversation } from '../engine/SupabaseClient'
import { getGoalsDueForCheckIn } from '../engine/GoalTracker'
import { ConversationDrawer } from '../components/ConversationDrawer'
import { MessageContent, Linkify } from '../components/MessageContent'
import { ACCEPTED_FILES, downloadFile, EventFeed, isAudioFile } from '../components/ChatHelpers'
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
import { useEntityEvolution } from '../hooks/useEntityEvolution'
import { useFeatureDiscovery } from '../hooks/useFeatureDiscovery'
import { useMiniPhone } from '../hooks/useMiniPhone'
import { useOverlayHistory } from '../hooks/useOverlayHistory'
import { useKeyboardHeight } from '../hooks/useKeyboardHeight'
import { useServiceWorkerUpdate } from '../hooks/useServiceWorkerUpdate'
import { useColorCycle } from '../hooks/useColorCycle'
import { lazyRetry } from '../utils/lazyRetry'
import { KernelLoading } from '../components/KernelLoading'
import { ParticleGrid } from '../components/ParticleGrid'

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
const UsageDashboard = lazyRetry(() => import('../components/UsageDashboard'))
const SetNewPasswordModal = lazyRetry(() => import('../components/SetNewPasswordModal').then(m => ({ default: m.SetNewPasswordModal })))
const ShareModal = lazyRetry(() => import('../components/ShareModal').then(m => ({ default: m.ShareModal })))
const ImportConversationModal = lazyRetry(() => import('../components/ImportConversationModal').then(m => ({ default: m.ImportConversationModal })))
const OnboardingFlow = lazyRetry(() => import('../components/OnboardingFlow').then(m => ({ default: m.OnboardingFlow })))
const MoreMenu = lazyRetry(() => import('../components/MoreMenu').then(m => ({ default: m.MoreMenu })))

// ─── Main Page ──────────────────────────────────────────

export function EnginePage() {
  const { user, isLoading, isAuthenticated } = useAuthContext()

  if (isLoading) {
    return <KernelLoading showLogo />
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

function agentPalette(idOrName: string): { particle: string; link: string; field: string } {
  // Accept agent ID or display name
  let s = getSpecialist(idOrName)
  if (s.id === 'kernel' && idOrName !== 'kernel' && idOrName !== 'Kernel') {
    const byName = getAllSpecialists().find(a => a.name === idOrName)
    if (byName) s = byName
  }
  const c = s.color
  const r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16)
  const link = `#${[r, g, b].map(v => Math.min(255, v + 40).toString(16).padStart(2, '0')).join('')}`
  const field = `#${[r, g, b].map(v => Math.min(255, v + 80).toString(16).padStart(2, '0')).join('')}`
  return { particle: c, link, field }
}

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

// ─── Feature 4: Open panel for nudge ─────────────────────

function openFeaturePanel(
  featureId: string,
  panels: ReturnType<typeof usePanelManager>,
  featureDiscovery: ReturnType<typeof useFeatureDiscovery>,
) {
  featureDiscovery.markDiscovered(featureId)
  panels.closeOtherPanels(featureId)
  switch (featureId) {
    case 'insights': panels.setShowInsightsPanel(true); break
    case 'knowledge': panels.setShowKGPanel(true); break
    case 'stats': panels.setShowStatsPanel(true); break
    case 'workflows': panels.setShowWorkflowsPanel(true); break
    case 'scheduled': panels.setShowScheduledPanel(true); break
  }
}

// ─── Engine Chat (post-auth) ────────────────────────────

const FREE_MSG_LIMIT = 10

function EngineChat() {
  const { t } = useTranslation('home')
  const { user, isAdmin, isSubscribed, isPasswordRecovery, updatePassword, clearPasswordRecovery, signOut, refreshSubscription } = useAuthContext()
  const isPro = isSubscribed || isAdmin
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [drawerSearchFocus, setDrawerSearchFocus] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
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
  const { updateAvailable, updateNow } = useServiceWorkerUpdate()
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

  const evolution = useEntityEvolution({
    conversationCount: convs.conversations.length,
    kgEntities: chatEngine.kgEntities,
    kgRelations: chatEngine.kgRelations,
    userGoals: chatEngine.userGoals,
    userMemory: chatEngine.userMemory,
    todayBriefing: chatEngine.todayBriefing,
    lastConversationUpdatedAt: convs.conversations[0]?.updated_at ?? null,
    isPro,
  })

  // Feature 4: Feature discovery with nudge context
  const featureDiscovery = useFeatureDiscovery(user?.id, {
    conversationCount: convs.conversations.length,
    kgEntityCount: chatEngine.kgEntities.length,
    completedGoals: chatEngine.userGoals.filter(g => g.status === 'completed').length,
  })

  // ─── Companion mood wiring ──────────────────────────────
  // Record conversation when messages grow (user sent a message)
  const prevMsgCountRef = useRef(chatEngine.messages.length)
  useEffect(() => {
    const count = chatEngine.messages.length
    if (count > prevMsgCountRef.current && count > 0) {
      // Only record when a new user message is added
      const lastMsg = chatEngine.messages[count - 1]
      if (lastMsg?.role === 'user') {
        evolution.companion.recordConversation()
      }
    }
    prevMsgCountRef.current = count
  }, [chatEngine.messages.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Record goal completion
  const prevGoalsDoneRef = useRef(
    chatEngine.userGoals.filter(g => g.status === 'completed').length,
  )
  useEffect(() => {
    const done = chatEngine.userGoals.filter(g => g.status === 'completed').length
    if (done > prevGoalsDoneRef.current) {
      evolution.companion.recordGoalComplete()
    }
    prevGoalsDoneRef.current = done
  }, [chatEngine.userGoals]) // eslint-disable-line react-hooks/exhaustive-deps

  // Feature 3: Goal check-in chips (exclude auto-generated briefing follow-ups)
  const goalCheckIns = useMemo(
    () => getGoalsDueForCheckIn(chatEngine.userGoals)
      .filter(g => !g.title.startsWith('Follow up:'))
      .slice(0, 2),
    [chatEngine.userGoals],
  )

  // Feature 6: Streak bonus — 3+ day streak gives free users 1 extra message
  const streakBonus = !isPro && evolution.companion.streak >= 3 ? 1 : 0
  const effectiveLimit = FREE_MSG_LIMIT + streakBonus

  // Feature 6: Mid-session value preview (once per session, at message 5)
  const [showValuePreview, setShowValuePreview] = useState(false)
  const valuePreviewShownRef = useRef(false)
  useEffect(() => {
    if (!isPro && chatEngine.messageCountRef.current === 5 && !valuePreviewShownRef.current) {
      valuePreviewShownRef.current = true
      setShowValuePreview(true)
      const timer = setTimeout(() => setShowValuePreview(false), 8000)
      return () => clearTimeout(timer)
    }
  }, [chatEngine.messages.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Feature 6: Memory highlights for upgrade wall
  const memoryHighlights = useMemo(() => {
    if (!chatEngine.userMemory) return null
    const interests = chatEngine.userMemory.interests?.slice(0, 3) || []
    const facts = chatEngine.userMemory.facts?.slice(0, 2) || []
    if (interests.length === 0 && facts.length === 0) return null
    return { interests, facts }
  }, [chatEngine.userMemory])

  const scroll = useScrollTracking(chatEngine.messages.length)

  const { isListening, toggleVoice } = useVoiceInput(
    (text) => chatEngine.setInput(text),
    showToast,
  )

  useKeyboardHeight()

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
      forkSharedConversation(user.id, parsed.title, parsed.messages).then(async (forkId: string) => {
        await switchConvRef.current(forkId)
        localStorage.removeItem('kernel-fork-intent')
        loadConvsRef.current()
        showToast('Conversation forked — you can continue chatting.')
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
        setDrawerSearchFocus(true)
        setIsDrawerOpen(true)
      }
      if (e.key === 'Escape') {
        if (panels.showMoreMenu) panels.closePanel('more')
        if (isDrawerOpen) panels.closePanel('drawer')
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

  // ─── Back button support ─────────────────────────────
  const anyPanelOpen = panels.showKGPanel || panels.showStatsPanel || panels.showGoalsPanel
    || panels.showWorkflowsPanel || panels.showScheduledPanel || panels.showBriefingPanel
    || panels.showInsightsPanel || panels.showUsagePanel
  useOverlayHistory(anyPanelOpen, panels.closeAllPanels)
  useOverlayHistory(isDrawerOpen && !anyPanelOpen, () => setIsDrawerOpen(false))
  useOverlayHistory(panels.showMoreMenu && !anyPanelOpen && !isDrawerOpen, () => { panels.setShowMoreMenu(false); panels.setActiveTab('home') })

  // ─── Derived ──────────────────────────────────────────
  const { messages, isStreaming, isThinking, thinkingAgent, events } = chatEngine
  const { researchProgress, taskProgress, swarmProgress } = chatEngine

  const cyclingPalette = useColorCycle(convs.msgsLoading)

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
      {/* Update Banner */}
      <AnimatePresence>
        {updateAvailable && (
          <motion.div
            className="ka-update-banner"
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          >
            <span className="ka-update-banner-text">New version available</span>
            <button className="ka-update-banner-btn" onClick={updateNow}>Refresh</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Panel Bottom Sheets */}
      <AnimatePresence>
        {panels.showKGPanel && (
          <BottomSheet onClose={() => panels.closePanel('kg')}>
            <Suspense fallback={<PanelShimmer />}>
              <KGPanel entities={chatEngine.kgEntities} relations={chatEngine.kgRelations} onClose={() => panels.closePanel('kg')} />
            </Suspense>
          </BottomSheet>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {panels.showStatsPanel && user && (
          <BottomSheet onClose={() => panels.closePanel('stats')}>
            <Suspense fallback={<PanelShimmer />}>
              <StatsPanel userId={user.id} onClose={() => panels.closePanel('stats')} />
            </Suspense>
          </BottomSheet>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {panels.showGoalsPanel && user && (
          <BottomSheet onClose={() => panels.closePanel('goals')}>
            <Suspense fallback={<PanelShimmer />}>
              <GoalsPanel userId={user.id} onClose={() => panels.closePanel('goals')} onToast={showToast} />
            </Suspense>
          </BottomSheet>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {panels.showWorkflowsPanel && user && (
          <BottomSheet onClose={() => panels.closePanel('workflows')}>
            <Suspense fallback={<PanelShimmer />}>
              <WorkflowsPanel
                userId={user.id}
                onClose={() => panels.closePanel('workflows')}
                onToast={showToast}
                onRunWorkflow={(proc) => {
                  panels.closePanel('workflows')
                  chatEngine.sendMessage(`Run workflow: ${proc.name}`)
                }}
              />
            </Suspense>
          </BottomSheet>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {panels.showScheduledPanel && user && (
          <BottomSheet onClose={() => panels.closePanel('scheduled')}>
            <Suspense fallback={<PanelShimmer />}>
              <ScheduledTasksPanel userId={user.id} onClose={() => panels.closePanel('scheduled')} onToast={showToast} />
            </Suspense>
          </BottomSheet>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {panels.showBriefingPanel && user && (
          <BottomSheet onClose={() => panels.closePanel('briefings')}>
            <Suspense fallback={<PanelShimmer />}>
              <BriefingPanel
                userId={user.id}
                userMemory={chatEngine.userMemory}
                kgEntities={chatEngine.kgEntities}
                onClose={() => panels.closePanel('briefings')}
                onToast={showToast}
                onGoDeeper={(title, content) => { panels.closePanel('briefings'); chatEngine.handleBriefingGoDeeper(title, content) }}
                onAddGoal={chatEngine.handleBriefingAddGoal}
              />
            </Suspense>
          </BottomSheet>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {panels.showInsightsPanel && user && (
          <BottomSheet onClose={() => panels.closePanel('insights')}>
            <Suspense fallback={<PanelShimmer />}>
              <InsightsPanel
                engineState={chatEngine.engineState}
                userMemory={chatEngine.userMemory}
                onChallengeBelief={(id) => chatEngine.engine.challengeBelief(id)}
                onRemoveBelief={(id) => chatEngine.engine.removeBelief(id)}
                onClose={() => panels.closePanel('insights')}
              />
            </Suspense>
          </BottomSheet>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {panels.showUsagePanel && user && (
          <BottomSheet onClose={() => panels.closePanel('usage')}>
            <Suspense fallback={<PanelShimmer />}>
              <UsageDashboard onClose={() => panels.closePanel('usage')} />
            </Suspense>
          </BottomSheet>
        )}
      </AnimatePresence>

      {/* Conversation Drawer */}
      <ConversationDrawer
        isOpen={isDrawerOpen}
        onClose={() => { panels.closePanel('drawer'); setDrawerSearchFocus(false) }}
        autoFocusSearch={drawerSearchFocus}
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
        onImport={() => setShowImportModal(true)}
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
                {(isPro || isAdmin) && (
                  <button className="ka-header-menu-item ka-menu-tabbed" onClick={() => { panels.closeAllPanels(); panels.setShowUsagePanel(true); panels.setHeaderMenuOpen(false) }}>
                    <IconChart size={16} /> {t('menu.usage')}
                  </button>
                )}
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
        <AnimatePresence mode="wait">
        {convs.msgsLoading && (
          <motion.div
            key="loading-grid"
            className="ka-loading-grid-wrap"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <ParticleGrid
              size={160}
              interactive={false}
              energetic
              palette={cyclingPalette ?? undefined}
            />
            <span className="ka-loading-label">Loading...</span>
          </motion.div>
        )}
        {messages.length === 0 && !convs.msgsLoading && (
          <motion.div key="empty-home" className="ka-empty" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <ParticleGrid />

            {/* Feature 2: Streak indicator */}
            {evolution.companion.streak >= 2 && (
              <span
                className="ka-home-streak"
                data-streak-milestone={
                  evolution.companion.streak >= 30 ? 'month' :
                  evolution.companion.streak >= 7 ? 'week' : undefined
                }
              >
                {t('entity.streak', { count: evolution.companion.streak })}
              </span>
            )}

            {/* Feature 1: Tier label + progress hint */}
            <AnimatePresence mode="wait">
              {evolution.isEvolving ? (
                <motion.div
                  key="evolving"
                  className="ka-home-tier ka-home-tier--evolving"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  {t('entity.evolved', { tier: evolution.tierName })}
                </motion.div>
              ) : (
                <motion.div
                  key="tier"
                  className="ka-home-tier"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <span className="ka-home-tier-name">{evolution.tierName}</span>
                  <span className="ka-home-tier-hint">{evolution.progressHint}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <h1 className="ka-empty-title">Kernel</h1>
            <p className="ka-empty-subtitle">{t('tagline')}</p>
            <p className="ka-home-greeting">{getTimeGreeting()}</p>

            {/* Feature 4: Contextual nudge */}
            {featureDiscovery.activeNudge && (
              <motion.div
                className="ka-home-nudge"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <p className="ka-home-nudge-text">{t(`nudge.${featureDiscovery.activeNudge.featureId}`)}</p>
                <div className="ka-home-nudge-actions">
                  <button className="ka-home-nudge-btn" onClick={() => {
                    openFeaturePanel(featureDiscovery.activeNudge!.featureId, panels, featureDiscovery)
                  }}>{t('nudge.showMe')}</button>
                  <button className="ka-home-nudge-dismiss" onClick={() => {
                    featureDiscovery.dismissNudge(featureDiscovery.activeNudge!.featureId)
                  }}>{t('nudge.notNow')}</button>
                </div>
              </motion.div>
            )}

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

            {/* Feature 3: Goal check-in chips */}
            {goalCheckIns.length > 0 && (
              <div className="ka-home-goal-checkins">
                {goalCheckIns.map(g => (
                  <button
                    key={g.id}
                    className="ka-topic ka-topic--goal"
                    onClick={() => chatEngine.sendMessage(`How's my progress on "${g.title}"?`)}
                  >
                    <IconTarget size={12} /> {t('entity.goalCheckIn', { title: g.title.length > 30 ? g.title.slice(0, 30) + '…' : g.title })}
                  </button>
                ))}
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
        </AnimatePresence>

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
              <div className="ka-thinking-grid">
                <ParticleGrid size={60} interactive={false} energetic palette={agentPalette(thinkingAgent || 'kernel')} />
              </div>
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
                    <div className="ka-typing-grid">
                      <ParticleGrid size={40} interactive={false} energetic palette={agentPalette(msg.agentId || 'kernel')} />
                    </div>
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
            <span key={i} className={`ka-file-chip${isStreaming ? ' ka-file-chip--sending' : ''}${isAudioFile(f) ? ' ka-file-chip--audio' : ''}`}>
              {isAudioFile(f) ? <IconMic size={12} /> : <IconAttach size={12} />}
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
              <h2 className="ka-upgrade-title">{t('upgrade.title', { limit: effectiveLimit })}</h2>
              <p className="ka-upgrade-subtitle">{t('upgrade.subtitle')}</p>
              {memoryHighlights && (
                <div className="ka-upgrade-learned">
                  <p className="ka-upgrade-learned-title">{t('upgrade.learnedTitle')}</p>
                  <ul className="ka-upgrade-learned-list">
                    {memoryHighlights.interests.map(i => <li key={i}>{i}</li>)}
                    {memoryHighlights.facts.map(f => <li key={f}>{f}</li>)}
                  </ul>
                  <p className="ka-upgrade-learned-cta">{t('upgrade.learnedCta')}</p>
                </div>
              )}
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

      {/* Import Conversation Modal */}
      <AnimatePresence>
        {showImportModal && user && (
          <Suspense fallback={null}>
            <ImportConversationModal
              userId={user.id}
              onClose={() => setShowImportModal(false)}
              onToast={showToast}
              onImported={(convId) => {
                convs.switchConversation(convId)
                convs.loadConversations()
              }}
            />
          </Suspense>
        )}
      </AnimatePresence>

      {/* Set New Password Modal (password recovery flow) */}
      <AnimatePresence>
        {isPasswordRecovery && (
          <Suspense fallback={null}>
            <SetNewPasswordModal
              onSubmit={updatePassword}
              onDismiss={clearPasswordRecovery}
              onToast={showToast}
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

      {/* Feature 6: Mid-session value preview */}
      <AnimatePresence>
        {showValuePreview && (
          <motion.div className="ka-value-preview" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <p className="ka-value-preview-text">{t('valuePreview.message')}</p>
            <button className="ka-value-preview-dismiss" onClick={() => setShowValuePreview(false)}>{t('valuePreview.gotIt')}</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Free-tier hint */}
      <AnimatePresence>
        {!isPro && chatEngine.messageCountRef.current >= 7 && chatEngine.messageCountRef.current < effectiveLimit && !billing.showUpgradeWall && (
          <motion.div className="ka-msg-hint" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            {effectiveLimit - chatEngine.messageCountRef.current === 1 ? t('lastFreeMessage') : t('messagesRemaining', { count: effectiveLimit - chatEngine.messageCountRef.current })}
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
          onPaste={fileAttachments.handlePaste}
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
            <MoreMenu isOpen={panels.showMoreMenu} onClose={() => panels.closePanel('more')} onSelect={panels.handleMoreAction} isPro={isPro} isAdmin={isAdmin} isNewFeature={featureDiscovery.isNew} onFeatureDiscovered={featureDiscovery.markDiscovered} />
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
  const dragControls = useDragControls()
  return (
    <motion.div className="ka-kg-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        className="ka-kg-sheet"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={SPRING.DEFAULT}
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.2}
        onDragEnd={(_, info) => { if (info.offset.y > 100 || info.velocity.y > 300) onClose() }}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <div className="ka-kg-drag-handle" onPointerDown={(e) => dragControls.start(e)} />
        <button className="ka-sheet-close-btn" onClick={onClose} aria-label="Close panel"><IconClose size={18} /></button>
        {children}
      </motion.div>
    </motion.div>
  )
}
