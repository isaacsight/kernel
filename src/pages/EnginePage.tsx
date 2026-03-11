import { useState, useRef, useEffect, useCallback, useMemo, Suspense } from 'react'
import { motion, AnimatePresence, useDragControls } from 'motion/react'
import { useTranslation } from 'react-i18next'
import {
  IconSend, IconMenu, IconCopy, IconCheck, IconThumbsUp, IconThumbsDown,
  IconAttach, IconClose, IconDownload, IconMoon, IconSun,
  IconShare, IconExport, IconMic, IconStop, IconChevronDown,
  IconMoreVertical, IconTrash, IconCrown, IconShield,
  IconMessageCircle, IconLogOut,
  IconSettings, IconPlus, IconBookOpen, IconFileText, IconSparkles, IconImage, IconGlobe, IconFolder, IconArchive,
} from '../components/KernelIcons'
import { SPRING, TRANSITION } from '../constants/motion'
import { BottomTabBar } from '../components/BottomTabBar'
import { KERNEL_TOPICS } from '../agents/kernel'
import { getSpecialist, getAllSpecialists } from '../agents/specialists'
import { useAuthContext } from '../providers/AuthProvider'
import { forkSharedConversation, updateConversationMetadata, getConversationMetadata } from '../engine/SupabaseClient'
import { ConversationDrawer } from '../components/ConversationDrawer'
import { MessageContent, Linkify } from '../components/MessageContent'
import { ACCEPTED_FILES, downloadFile, EventFeed, isAudioFile, isImageFile } from '../components/ChatHelpers'
import { useTheme } from '../hooks/useTheme'
import { useToast } from '../hooks/useToast'
import { useScrollTracking } from '../hooks/useScrollTracking'
import { useFileAttachments } from '../hooks/useFileAttachments'
import { usePanelManager } from '../hooks/usePanelManager'
import { useConversations } from '../hooks/useConversations'
import { useMessageActions } from '../hooks/useMessageActions'
import { useBilling } from '../hooks/useBilling'
import { OveragePrompt } from '../components/OveragePrompt'
import { useChatEngine } from '../hooks/useChatEngine'
import { useEntityEvolution } from '../hooks/useEntityEvolution'
import { useMiniPhone } from '../hooks/useMiniPhone'
import { useOverlayHistory } from '../hooks/useOverlayHistory'
import { useKeyboardHeight } from '../hooks/useKeyboardHeight'
import { useServiceWorkerUpdate } from '../hooks/useServiceWorkerUpdate'
import { useCrisisDetection } from '../hooks/useCrisisDetection'
import { useMessageUsage } from '../hooks/useMessageUsage'
import { useFolders } from '../hooks/useFolders'
import { useDrawerTabs } from '../hooks/useDrawerTabs'
import { useLiveShare } from '../hooks/useLiveShare'
import { useVoiceInput } from '../hooks/useVoiceInput'
import { useVoiceLoop } from '../hooks/useVoiceLoop'
import { VoiceLoopOverlay } from '../components/VoiceLoopOverlay'
import { LiveShareBadge } from '../components/LiveShareBadge'
import { WorkspaceSwitcher } from '../components/WorkspaceSwitcher'
import { useWorkspace } from '../hooks/useWorkspace'
import { CrisisBanner } from '../components/CrisisBanner'
import { useProjectStore } from '../stores/projectStore'
import { autoSaveArtifact } from '../engine/chatFolderAutoSave'
import { lazyRetry } from '../utils/lazyRetry'
import { KernelLoading } from '../components/KernelLoading'
import { ParticleGrid } from '../components/ParticleGrid'
import { ThinkingBlock } from '../components/ThinkingBlock'
import { WorkflowTimeline } from '../components/WorkflowTimeline'
import { ContentPipeline } from '../components/ContentPipeline'

// Lazy-loaded panels & modals (only loaded when user opens them)
const LoginGate = lazyRetry(() => import('../components/LoginGate').then(m => ({ default: m.LoginGate })))
const AccountSettingsPanel = lazyRetry(() => import('../components/AccountSettingsPanel'))
const SetNewPasswordModal = lazyRetry(() => import('../components/SetNewPasswordModal').then(m => ({ default: m.SetNewPasswordModal })))
const ShareModal = lazyRetry(() => import('../components/ShareModal').then(m => ({ default: m.ShareModal })))
const ImportConversationModal = lazyRetry(() => import('../components/ImportConversationModal').then(m => ({ default: m.ImportConversationModal })))
const OnboardingFlow = lazyRetry(() => import('../components/OnboardingFlow').then(m => ({ default: m.OnboardingFlow })))
const MoreMenu = lazyRetry(() => import('../components/MoreMenu').then(m => ({ default: m.MoreMenu })))
const ProviderStatusBanner = lazyRetry(() => import('../components/ProviderStatus').then(m => ({ default: m.ProviderStatusBanner })))
const ProviderStatusDot = lazyRetry(() => import('../components/ProviderStatus').then(m => ({ default: m.ProviderStatusDot })))
const ProjectPanel = lazyRetry(() => import('../components/ProjectPanel').then(m => ({ default: m.ProjectPanel })))
const ImageCreditModal = lazyRetry(() => import('../components/ImageCreditModal').then(m => ({ default: m.ImageCreditModal })))
const GeneratedImageCard = lazyRetry(() => import('../components/GeneratedImageCard').then(m => ({ default: m.GeneratedImageCard })))
const ImageGalleryPanel = lazyRetry(() => import('../components/ImageGalleryPanel').then(m => ({ default: m.ImageGalleryPanel })))
const FilesPanel = lazyRetry(() => import('../components/FilesPanel').then(m => ({ default: m.FilesPanel })))
const UsageDashboard = lazyRetry(() => import('../components/UsageDashboard').then(m => ({ default: m.UsageDashboard })))
const TagModal = lazyRetry(() => import('../components/TagModal').then(m => ({ default: m.TagModal })))

// ─── Main Page ──────────────────────────────────────────

export function EnginePage() {
  const { user, isLoading, isAuthenticated } = useAuthContext()

  if (isLoading) {
    return <KernelLoading showLogo />
  }

  if (!isAuthenticated) {
    return <Suspense fallback={null}><LoginGate /></Suspense>
  }

  return <EnginePageAuthed user={user!} />
}

function EnginePageAuthed({ user }: { user: NonNullable<ReturnType<typeof useAuthContext>['user']> }) {
  const onboardingKey = `kernel-onboarded-${user.id}`
  const [onboarded, setOnboarded] = useState(() => localStorage.getItem(onboardingKey) === 'true')

  if (!onboarded) {
    return (
      <Suspense fallback={<div className="ka-loading-splash" />}>
        <OnboardingFlow
          userName={user.email || undefined}
          onComplete={() => {
            localStorage.setItem(onboardingKey, 'true')
            setOnboarded(true)
          }}
        />
      </Suspense>
    )
  }

  return <EngineChat />
}

// ─── Helpers ─────────────────────────────────────────────

// CMYK palette from reference — vibrant loading state
const LOADING_PALETTE = { particle: '#00a4b8', link: '#e8345a', field: '#f5c518' }

const AGENT_PALETTES: Record<string, { particle: string; link: string; field: string }> = {
  kernel: { particle: '#6B5B95', link: '#9B8BC5', field: '#C4B8E0' },
  researcher: { particle: '#5B8BA0', link: '#7CB4CC', field: '#A8D4E8' },
  coder: { particle: '#6B8E6B', link: '#8FBD8F', field: '#B8D8B5' },
  writer: { particle: '#B8875C', link: '#D4A774', field: '#E8C494' },
  analyst: { particle: '#A0768C', link: '#C096AC', field: '#D8B0C4' },
  aesthete: { particle: '#F472B6', link: '#F9A8D4', field: '#FBCFE8' },
  guardian: { particle: '#10B981', link: '#6EE7B7', field: '#A7F3D0' },
  curator: { particle: '#8B5CF6', link: '#A78BFA', field: '#C4B5FD' },
  strategist: { particle: '#F59E0B', link: '#FCD34D', field: '#FDE68A' },
  hacker: { particle: '#00FF41', link: '#33FF66', field: '#80FFA0' },
  operator: { particle: '#FF6B35', link: '#FF8F66', field: '#FFB899' },
  dreamer: { particle: '#7B68EE', link: '#9F8FFF', field: '#C4B8FF' },
}

function agentPalette(idOrName: string): { particle: string; link: string; field: string } {
  if (AGENT_PALETTES[idOrName]) return AGENT_PALETTES[idOrName]
  const byName = getAllSpecialists().find(a => a.name === idOrName)
  if (byName && AGENT_PALETTES[byName.id]) return AGENT_PALETTES[byName.id]
  return AGENT_PALETTES.kernel
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

// ─── Delete Account Confirmation ────────────────────────
function DeleteAccountModal({ show, loading, isSubscribed, onConfirm, onCancel }: {
  show: boolean; loading: boolean; isSubscribed: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  const { t } = useTranslation('home')
  const [confirmText, setConfirmText] = useState('')
  const canDelete = confirmText.trim().toUpperCase() === 'DELETE'

  useEffect(() => { if (!show) setConfirmText('') }, [show])

  return (
    <AnimatePresence>
      {show && (
        <motion.div className="ka-upgrade-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="ka-upgrade-modal" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}>
            <div className="ka-upgrade-icon ka-upgrade-icon--danger"><IconTrash size={22} /></div>
            <h2 className="ka-upgrade-title">{t('deleteConfirm.title')}</h2>
            <p className="ka-upgrade-subtitle">
              {t('deleteConfirm.subtitle')}
              {isSubscribed && t('deleteConfirm.subtitleWithSub')}
            </p>
            <p className="ka-upgrade-subtitle" style={{ marginTop: 8 }}>{t('deleteConfirm.typeDelete')}</p>
            <input
              className="ka-gate-input"
              type="text"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder="DELETE"
              autoComplete="off"
              autoFocus
            />
            <button
              className="ka-upgrade-btn ka-upgrade-btn--danger"
              onClick={onConfirm}
              disabled={loading || !canDelete}
            >
              {loading ? t('deleteConfirm.confirming') : t('deleteConfirm.confirm')}
            </button>
            <button className="ka-upgrade-dismiss" onClick={onCancel}>{t('cancel', { ns: 'common' })}</button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── Engine Chat (post-auth) ────────────────────────────

function EngineChat() {
  const { t } = useTranslation('home')
  const { user, isAdmin, isSubscribed, isPasswordRecovery, updatePassword, updateEmail, updateProfile, clearPasswordRecovery, signOut, refreshSubscription, planId, planLimits } = useAuthContext()
  const isPro = isSubscribed || isAdmin
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [drawerSearchFocus, setDrawerSearchFocus] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const dragCounterRef = useRef(0)
  const [showCreditModal, setShowCreditModal] = useState(false)
  const [imageCredits, setImageCredits] = useState(0)
  const messageUsage = useMessageUsage(user?.id, planLimits.messagesPerDay)

  // Conversation tags
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [taggingConvId, setTaggingConvId] = useState<string | null>(null)
  const [convTagsMap, setConvTagsMap] = useState<Record<string, string[]>>({})

  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    for (const tags of Object.values(convTagsMap)) {
      for (const t of tags) tagSet.add(t)
    }
    return Array.from(tagSet).sort()
  }, [convTagsMap])

  const getConvTags = useCallback((id: string) => convTagsMap[id] || [], [convTagsMap])

  const handleSaveTags = useCallback(async (tags: string[]) => {
    if (!taggingConvId) return
    setConvTagsMap(prev => ({ ...prev, [taggingConvId]: tags }))
    try {
      await updateConversationMetadata(taggingConvId, { tags })
    } catch (e) {
      console.warn('[Tags] Failed to save:', e)
    }
  }, [taggingConvId])

  const handleToggleTag = useCallback((tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }, [])

  useEffect(() => {
    const goOnline = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline) }
  }, [])

  // Close lightbox on Escape
  useEffect(() => {
    if (!lightboxSrc) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightboxSrc(null) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [lightboxSrc])

  // ─── Hooks ────────────────────────────────────────────
  const { theme, setTheme } = useTheme()
  const { toast, showToast } = useToast()
  const { updateAvailable, updateNow } = useServiceWorkerUpdate()
  const billing = useBilling(user, showToast, signOut)

  const newChatRef = useRef<() => void>(() => { })
  const panels = usePanelManager({
    handleUpgrade: billing.handleUpgrade,
    handleManageSubscription: billing.handleManageSubscription,
    signOut,
    setShowDeleteConfirm: billing.setShowDeleteConfirm,
    setIsDrawerOpen,
    handleNewChat: () => newChatRef.current(),
  })

  const fileAttachments = useFileAttachments(isPro, showToast)
  const crisis = useCrisisDetection()

  const convs = useConversations(user?.id, (msgs) => {
    chatEngine.setMessages(msgs as any)
  }, planLimits.historyDays)
  newChatRef.current = convs.handleNewChat

  const folderHook = useFolders(user?.id ?? null)

  // ─── Live Share ─────────────────────────────────────────
  const liveShare = useLiveShare(user?.id ?? null)

  // ─── Workspace ─────────────────────────────────────────
  const workspaceHook = useWorkspace(user?.id ?? null)

  // ─── Drawer tabs ─────────────────────────────────────
  const drawerTabs = useDrawerTabs()


  // ─── Voice I/O (hooks that don't depend on chatEngine) ──
  const voiceInput = useVoiceInput()


  // Load tags from conversation metadata
  useEffect(() => {
    const loadTags = async () => {
      const map: Record<string, string[]> = {}
      for (const conv of convs.conversations) {
        try {
          const meta = await getConversationMetadata(conv.id)
          if (meta?.tags && Array.isArray(meta.tags)) {
            map[conv.id] = meta.tags as string[]
          }
        } catch { /* ignore */ }
      }
      setConvTagsMap(map)
    }
    if (convs.conversations.length > 0) loadTags()
  }, [convs.conversations]) // eslint-disable-line react-hooks/exhaustive-deps

  const chatEngine = useChatEngine({
    userId: user!.id,
    activeConversationId: convs.activeConversationId,
    setActiveConversationId: convs.setActiveConversationId,
    loadConversations: convs.loadConversations,
    createConversation: convs.createConversation,
    conversations: convs.conversations,
    showToast,
    setShowUpgradeWall: billing.setShowUpgradeWall,
    setFreeLimitResetsAt: billing.setFreeLimitResetsAt,
    signOut,
    attachedFiles: fileAttachments.attachedFiles,
    setAttachedFiles: fileAttachments.setAttachedFiles,
    handleNewChat: convs.handleNewChat,
    isPro,
    planLimits,
    crisisActive: crisis.crisisState.isActive,
    crisisSeverity: crisis.crisisState.highestSeverity,
    onShowCreditModal: () => setShowCreditModal(true),
  })

  // Crisis-aware send wrapper
  const originalSendRef = useRef(chatEngine.sendMessage)
  originalSendRef.current = chatEngine.sendMessage
  const crisisSendMessage = useCallback(async (msg: string) => {
    crisis.checkMessage(msg)
    await originalSendRef.current(msg)
  }, [crisis.checkMessage])
  chatEngine.sendMessage = crisisSendMessage

  // Reset crisis state on new conversation
  const originalNewChatRef = useRef(convs.handleNewChat)
  originalNewChatRef.current = convs.handleNewChat
  const crisisNewChat = useCallback(() => {
    crisis.resetCrisisState()
    originalNewChatRef.current()
  }, [crisis.resetCrisisState])
  convs.handleNewChat = crisisNewChat
  newChatRef.current = crisisNewChat

  // ─── Voice Loop (depends on chatEngine) ──────────────
  const lastKernelResponse = useMemo(() => {
    for (let i = chatEngine.messages.length - 1; i >= 0; i--) {
      const m = chatEngine.messages[i]
      if (m.role === 'kernel' && typeof m.content === 'string') return m.content
    }
    return null
  }, [chatEngine.messages])

  const voiceLoop = useVoiceLoop(isPro, (text) => {
    chatEngine.setInput(text)
    chatEngine.handleSubmit(new Event('submit') as any)
  }, lastKernelResponse, chatEngine.isStreaming)

  // Feed voice transcript into input field (non-loop mode)
  useEffect(() => {
    if (!voiceInput.isRecording || voiceLoop.isActive) return
    const text = voiceInput.transcript || voiceInput.finalTranscript
    if (text) chatEngine.setInput(text)
  }, [voiceInput.transcript, voiceInput.finalTranscript, voiceInput.isRecording, voiceLoop.isActive]) // eslint-disable-line react-hooks/exhaustive-deps

  // Surface voice input errors as toasts
  useEffect(() => {
    if (voiceInput.error) showToast(voiceInput.error)
  }, [voiceInput.error]) // eslint-disable-line react-hooks/exhaustive-deps

  // Project context — file tracking + cloud sync
  const registerProjectFile = useProjectStore(s => s.registerFile)
  const syncToCloud = useProjectStore(s => s.syncToCloud)
  const loadFromCloud = useProjectStore(s => s.loadFromCloud)
  const messagesRef = useRef(chatEngine.messages)
  messagesRef.current = chatEngine.messages
  const handleArtifactRendered = useCallback((filename: string, language: string, content: string) => {
    const convId = convs.activeConversationId
    if (!convId) return
    const latestKernelMsg = messagesRef.current.filter(m => m.role === 'kernel').pop()
    const messageId = latestKernelMsg?.id || `msg_${Date.now()}`
    registerProjectFile(convId, filename, language, content, messageId)
    if (isPro) syncToCloud(convId, filename)
    // Auto-save artifact to Chat/Artifacts folder
    if (user) autoSaveArtifact(user.id, filename, content)
  }, [convs.activeConversationId, registerProjectFile, isPro, syncToCloud, user])

  // Load project files from cloud when conversation changes (Pro only)
  const prevConvIdRef = useRef<string | null>(null)
  useEffect(() => {
    const convId = convs.activeConversationId
    if (!convId || convId === prevConvIdRef.current || !isPro) return
    prevConvIdRef.current = convId
    loadFromCloud(convId)
  }, [convs.activeConversationId, isPro, loadFromCloud])

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

  // Companion mood wiring
  const prevMsgCountRef = useRef(chatEngine.messages.length)
  useEffect(() => {
    const count = chatEngine.messages.length
    if (count > prevMsgCountRef.current && count > 0) {
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

  // Daily message limit from plan
  const effectiveLimit = planLimits.messagesPerDay

  // Memory highlights for upgrade wall
  const memoryHighlights = useMemo(() => {
    if (!chatEngine.userMemory) return null
    const interests = chatEngine.userMemory.interests?.slice(0, 3) || []
    const facts = chatEngine.userMemory.facts?.slice(0, 2) || []
    if (interests.length === 0 && facts.length === 0) return null
    return { interests, facts }
  }, [chatEngine.userMemory])

  const scroll = useScrollTracking(chatEngine.messages.length)

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

  // Reopen account settings after OAuth identity link redirect
  useEffect(() => {
    if (localStorage.getItem('kernel-reopen-settings') === 'true') {
      localStorage.removeItem('kernel-reopen-settings')
      panels.closeAllPanels()
      panels.setShowAccountSettings(true)
      showToast('Account linked successfully')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

  // Post-credit-purchase: detect ?credits=purchased and refresh credit balance
  useEffect(() => {
    const hash = window.location.hash
    if (!hash.includes('credits=purchased')) return
    import('../engine/imageGen').then(({ getImageCredits }) => {
      getImageCredits().then(c => {
        setImageCredits(c)
        if (c > 0) showToast(`Image credits added — ${c} credits available`)
      })
    })
    const cleanHash = hash.replace(/[?&]credits=purchased/, '').replace(/\?$/, '')
    window.location.hash = cleanHash || '#/'
  }, [showToast])

  // Fork shared conversation
  const forkHandledRef = useRef(false)
  const switchConvRef = useRef(convs.switchConversation)
  switchConvRef.current = convs.switchConversation
  const loadConvsRef = useRef(convs.loadConversations)
  loadConvsRef.current = convs.loadConversations

  useEffect(() => {
    if (!user || forkHandledRef.current || convs.convsLoading) return

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
        if (panels.showMoreMenu) panels.closePanel('settings')
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
  const anyPanelOpen = panels.showProjectPanel || panels.showImageGallery || panels.showAccountSettings || panels.showUsageDashboard
  const anyOverlayOpen = anyPanelOpen || isDrawerOpen || panels.showMoreMenu
  const closeTopOverlay = useCallback(() => {
    if (panels.showMoreMenu) { panels.setShowMoreMenu(false); panels.setActiveTab('home') }
    else if (anyPanelOpen) panels.closeAllPanels()
    else if (isDrawerOpen) setIsDrawerOpen(false)
  }, [panels, anyPanelOpen, isDrawerOpen, setIsDrawerOpen])
  useOverlayHistory(anyOverlayOpen, closeTopOverlay)

  // Refresh message counter after each AI response completes
  const prevStreamingRef = useRef(false)
  useEffect(() => {
    if (prevStreamingRef.current && !chatEngine.isStreaming) messageUsage.refresh()
    prevStreamingRef.current = chatEngine.isStreaming
  }, [chatEngine.isStreaming]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Derived ──────────────────────────────────────────
  const { messages, isStreaming, isThinking, thinkingAgent, events } = chatEngine
  const { researchProgress, taskProgress, swarmProgress, workflowSteps, isWorkflowActive, cancelWorkflow } = chatEngine
  const { contentPipelineStages, isContentPipelineActive, approveContentStage, editContentStage, cancelContentPipeline } = chatEngine
  const { currentThinking, thinkingStartRef } = chatEngine

  // Compute last kernel message index for lazy auto-preview
  const lastKernelIndex = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'kernel') return i
    }
    return -1
  }, [messages])

  const [revealedTimestamps, setRevealedTimestamps] = useState<Record<string, boolean>>({})
  const [showMiniPopover, setShowMiniPopover] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const inputBarRef = useRef<HTMLFormElement>(null)
  const isMini = useMiniPhone()
  const userId = user?.id

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
    if ((e.target as HTMLElement).closest('a, button, pre, code, .ka-msg-actions, .ka-artifact, .ka-edit-form')) return
    setRevealedTimestamps(prev => ({
      ...prev,
      [msgId]: !prev[msgId]
    }))
  }

  // ─── Drag-drop handlers ─────────────────────────────
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current++
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragOver(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) {
      setIsDragOver(false)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current = 0
    setIsDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      fileAttachments.addFiles(files)
    }
  }, [fileAttachments])

  // ─── Render ───────────────────────────────────────────
  return (
    <div className="ka-page" onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop}>
      {/* Drag-drop overlay */}
      <AnimatePresence>
        {isDragOver && (
          <motion.div className="ka-dropzone" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <div className="ka-dropzone-inner">
              <IconAttach size={32} />
              <span className="ka-dropzone-text">Drop image here</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Crisis Banner */}
      <CrisisBanner isActive={crisis.crisisState.isActive} severity={crisis.crisisState.highestSeverity} />

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

      {/* Panel Bottom Sheets — only Project, Gallery, Account Settings */}
      <AnimatePresence>
        {panels.showProjectPanel && (
          <BottomSheet onClose={() => panels.closePanel('project')}>
            <Suspense fallback={<PanelShimmer />}>
              <ProjectPanel
                conversationId={convs.activeConversationId}
                onClose={() => panels.closePanel('project')}
              />
            </Suspense>
          </BottomSheet>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {panels.showImageGallery && user && (
          <BottomSheet onClose={() => panels.closePanel('image-gallery')}>
            <Suspense fallback={<PanelShimmer />}>
              <FilesPanel
                userId={user.id}
                onClose={() => panels.closePanel('image-gallery')}
              />
            </Suspense>
          </BottomSheet>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {panels.showAccountSettings && user && (
          <BottomSheet onClose={() => panels.closePanel('account-settings')}>
            <Suspense fallback={<PanelShimmer />}>
              <AccountSettingsPanel
                user={user}
                isAdmin={isAdmin}
                onClose={() => panels.closePanel('account-settings')}
                onToast={showToast}
                onSignOut={signOut}
                onDeleteAccount={() => billing.setShowDeleteConfirm(true)}
              />
            </Suspense>
          </BottomSheet>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {panels.showUsageDashboard && (
          <Suspense fallback={<PanelShimmer />}>
            <UsageDashboard
              onClose={() => panels.closePanel('usage')}
              onUpgrade={() => {}}
              isPro={false}
              monthlyLimit={planLimits.messagesPerDay * 30}
            />
          </Suspense>
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
        isLoading={convs.convsLoading}
        onUnarchive={convs.handleUnarchiveConversation}
        showArchive={drawerTabs.showArchive}
        onCloseArchive={drawerTabs.closeArchive}
        archivedConversations={convs.archivedConversations}
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
          {workspaceHook.workspaces.length > 0 && (
            <WorkspaceSwitcher
              workspaces={workspaceHook.workspaces}
              activeWorkspace={workspaceHook.activeWorkspace}
              onSelect={workspaceHook.setActiveWorkspaceId}
              onCreate={(name) => workspaceHook.createWorkspace(name)}
            />
          )}
          {isAdmin && <span className="ka-admin-badge"><IconShield size={12} /> {t('admin')}</span>}
          {liveShare.state.isActive && (
            <LiveShareBadge
              participants={liveShare.state.participants}
              onClick={() => { msgActions.setShowShareModal(true) }}
            />
          )}
          <Suspense fallback={null}><ProviderStatusDot /></Suspense>
          <button className="ka-header-icon-btn" data-testid="theme-toggle" onClick={() => setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'eink' : 'light')} aria-label={t('aria.toggleTheme', { ns: 'common' })}>
            {theme === 'dark' ? <IconSun size={16} /> : theme === 'eink' ? <IconBookOpen size={16} /> : <IconMoon size={16} />}
          </button>
          {/* Mobile inline actions — replace dropdown on small screens */}
          {messages.length > 0 && (
            <div className="ka-mobile-header-actions">
              <button className="ka-header-icon-btn" onClick={() => msgActions.setShowShareModal(true)} aria-label={t('menu.shareConversation')}>
                <IconShare size={16} />
              </button>
              <button className="ka-header-icon-btn" onClick={() => msgActions.handleExportConversation()} aria-label={t('menu.exportMarkdown')}>
                <IconExport size={16} />
              </button>
            </div>
          )}
          {/* Desktop dropdown menu — hidden on mobile */}
          <div className="ka-header-menu-wrap ka-desktop-only" ref={headerMenuRef}>
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
                <div className="ka-header-menu-divider" />
                <button className="ka-header-menu-item" onClick={() => { convs.loadArchivedConversations(); drawerTabs.openArchive(); setIsDrawerOpen(true); panels.setHeaderMenuOpen(false) }}>
                  <IconArchive size={16} /> {t('conversations.archive', { ns: 'common' })}
                </button>
                <div className="ka-header-menu-divider" />
                <button className="ka-header-menu-item" onClick={() => { panels.closeAllPanels(); panels.setShowImageGallery(true); panels.setHeaderMenuOpen(false) }}>
                  <IconFolder size={16} /> Files
                </button>
                <div className="ka-header-menu-divider" />
                <button className="ka-header-menu-item" onClick={() => { panels.closeAllPanels(); panels.setShowAccountSettings(true); panels.setHeaderMenuOpen(false) }}>
                  <IconSettings size={16} /> {t('menu.accountSettings')}
                </button>
                <button className="ka-header-menu-item" onClick={() => { signOut(); panels.setHeaderMenuOpen(false) }}>
                  <IconLogOut size={16} /> {t('menu.signOut')}
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
      <Suspense fallback={null}><ProviderStatusBanner /></Suspense>

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
              transition={TRANSITION.CARD}
            >
              <ParticleGrid
                size={200}
                interactive={false}
                energetic
                palette={convs.loadingAgentId ? agentPalette(convs.loadingAgentId) : LOADING_PALETTE}
              />
              <span className="ka-loading-label">Loading...</span>
            </motion.div>
          )}
          {messages.length === 0 && !convs.msgsLoading && (
            <motion.div key="empty-home" className="ka-empty" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={TRANSITION.CARD}>
              <ParticleGrid />

              <h1 className="ka-empty-title">Kernel</h1>
              <p className="ka-empty-subtitle">{t('tagline')}</p>
              <p className="ka-home-greeting">{getTimeGreeting()}</p>

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

        {(workflowSteps.length > 0 || isWorkflowActive) && (
          <WorkflowTimeline
            steps={workflowSteps}
            isActive={isWorkflowActive}
            onCancel={cancelWorkflow}
          />
        )}

        {(contentPipelineStages.length > 0 || isContentPipelineActive) && (
          <ContentPipeline
            stages={contentPipelineStages}
            isActive={isContentPipelineActive}
            onApprove={approveContentStage}
            onEdit={editContentStage}
            onCancel={cancelContentPipeline}
          />
        )}

        <AnimatePresence>
          {isThinking && !isWorkflowActive && (
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
            <motion.div key={msg.id} className={`ka-msg ka-msg--${msg.role}${msg.isProactive ? ' ka-msg-proactive' : ''}`} style={{ '--msg-index': i } as React.CSSProperties} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={TRANSITION.MESSAGE}>
              {msg.role === 'kernel' && (
                <div className="ka-msg-avatar-col">
                  <div className="ka-msg-avatar" data-agent={msg.agentId || 'kernel'}>
                    <ParticleGrid size={28} interactive={false} energetic palette={agentPalette(msg.agentId || 'kernel')} />
                  </div>
                  {msg.agentName && msg.agentName !== 'Kernel' && (
                    <span className="ka-agent-badge" style={{ color: getSpecialist(msg.agentId || 'kernel').color }}>{msg.agentName}</span>
                  )}
                </div>
              )}
              <div className="ka-msg-col" onClick={(e) => { if (isMini) toggleTimestamp(msg.id, e) }}>
                {msg.role === 'kernel' && (msg.thinking || (isStreaming && currentThinking && i === messages.length - 1)) && (
                  <ThinkingBlock
                    thinking={msg.thinking || currentThinking}
                    thinkingStartTime={thinkingStartRef.current || undefined}
                    isStreaming={isStreaming && !msg.thinking && i === messages.length - 1}
                  />
                )}
                {msg.role === 'kernel' && msg.workflowSteps && msg.workflowSteps.length > 0 && (
                  <WorkflowTimeline
                    steps={msg.workflowSteps}
                    isActive={false}
                  />
                )}
                {msg.role === 'kernel' && msg.contentPipelineStages && msg.contentPipelineStages.length > 0 && (
                  <ContentPipeline
                    stages={msg.contentPipelineStages}
                    isActive={false}
                  />
                )}
                <div className="ka-msg-bubble">
                  {msg.isProactive && (
                    <div className="ka-msg-proactive-label">
                      <IconSparkles size={13} className="ka-msg-proactive-icon" />
                      <span>{t('proactive.noticed')}</span>
                    </div>
                  )}
                  {msg.imageDataUrls && msg.imageDataUrls.length > 0 && (
                    <div className="ka-msg-thumbnails">
                      {msg.imageDataUrls.map((url, j) => (
                        <button key={j} className="ka-msg-thumb-btn" type="button" onClick={() => setLightboxSrc(url)}>
                          <img src={url} alt={msg.attachments?.[j]?.name || 'Attached image'} className="ka-msg-thumb" />
                        </button>
                      ))}
                    </div>
                  )}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="ka-msg-attachments">
                      {msg.attachments.filter(a => !a.type.startsWith('image/')).map((a, i) => <span key={i} className="ka-msg-attachment">{a.name}</span>)}
                    </div>
                  )}
                  {msgActions.editingMsgId === msg.id ? (
                    <form className="ka-edit-form" onSubmit={(e) => { e.preventDefault(); msgActions.handleEditMessage(msg.id, msgActions.editingContent) }}>
                      <input className="ka-edit-input" value={msgActions.editingContent} onChange={e => msgActions.setEditingContent(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { msgActions.setEditingMsgId(null); msgActions.setEditingContent('') } }} />
                      <button type="submit" className="ka-edit-save">{t('feedback.save')}</button>
                      <button type="button" className="ka-edit-cancel" onClick={() => { msgActions.setEditingMsgId(null); msgActions.setEditingContent('') }}>{t('feedback.cancel')}</button>
                    </form>
                  ) : msg.generatedImages && msg.generatedImages.length > 0 ? (
                    <Suspense fallback={null}>
                      {msg.generatedImages.map((img, j) => (
                        <GeneratedImageCard key={j} image={img.image || undefined} imageUrl={img.image_url} mimeType={img.mimeType} prompt={(msg.content || '').replace(/^\[Generated image:\s*/, '').replace(/\]$/, '') || ''} creditsRemaining={img.credits_remaining > 0 ? img.credits_remaining : undefined} onRefine={() => { chatEngine.setInput('Refine this image: '); chatEngine.inputRef.current?.focus() }} />
                      ))}
                    </Suspense>
                  ) : msg.content || msg.thinking ? (
                    msg.role === 'kernel' ? <MessageContent text={msg.content} thinking={msg.thinking} isLatestMessage={i === lastKernelIndex} onArtifactRendered={handleArtifactRendered} conversationId={convs.activeConversationId} /> : <Linkify text={msg.content} />
                  ) : (
                    <div className="ka-typing-grid">
                      <ParticleGrid size={40} interactive={false} energetic palette={agentPalette(msg.agentId || 'kernel')} />
                    </div>
                  )}
                </div>
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
                {msg.role === 'kernel' && i === lastKernelIndex && !isStreaming && msg.suggestions && msg.suggestions.length > 0 && (
                  <div className="ka-suggestion-chips">
                    {msg.suggestions.map((s, si) => (
                      <button key={si} className="ka-suggestion-chip" onClick={() => chatEngine.sendMessage(s)}>{s}</button>
                    ))}
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
        {scroll.showScrollBtn && (
          <motion.button className="ka-scroll-btn" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} onClick={scroll.scrollToBottom} aria-label={t('aria.scrollToBottom', { ns: 'common' })}>
            <IconChevronDown size={18} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Active document indicator */}
      <AnimatePresence>
        {chatEngine.hasActiveDocument && chatEngine.activeDocument && (
          <motion.div
            className="ka-doc-indicator"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <IconFileText size={14} />
            <span className="ka-doc-indicator-name" title={chatEngine.activeDocument.name}>
              {t('document.active', { name: chatEngine.activeDocument.name })}
            </span>
            <span className="ka-doc-indicator-hint">{t('document.contextHint')}</span>
            <button
              type="button"
              className="ka-doc-indicator-close"
              onClick={chatEngine.clearDocument}
              aria-label={t('document.clear')}
              title={t('document.clear')}
            >
              <IconClose size={12} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* File chips / image previews above input */}
      {fileAttachments.attachedFiles.length > 0 && (
        <div className="ka-file-chips">
          {fileAttachments.attachedFiles.map((f, i) => (
            isImageFile(f) ? (
              <span key={`${f.name}-${f.size}-${f.lastModified}`} className={`ka-file-chip ka-file-chip--image${isStreaming ? ' ka-file-chip--sending' : ''}`}>
                <img src={URL.createObjectURL(f)} alt={f.name} className="ka-file-chip-preview" />
                <span className="ka-file-chip-name">{f.name}</span>
                {!isStreaming && (
                  <button type="button" className="ka-file-chip-x" onClick={() => fileAttachments.removeFile(i)}><IconClose size={12} /></button>
                )}
              </span>
            ) : (
              <span key={`${f.name}-${f.size}-${f.lastModified}`} className={`ka-file-chip${isStreaming ? ' ka-file-chip--sending' : ''}${isAudioFile(f) ? ' ka-file-chip--audio' : ''}`}>
                {isAudioFile(f) ? <IconMic size={12} /> : <IconAttach size={12} />}
                <span className="ka-file-chip-name">{f.name}</span>
                <span className="ka-file-chip-size">{f.size < 1024 ? `${f.size}B` : f.size < 1048576 ? `${(f.size / 1024).toFixed(0)}KB` : `${(f.size / 1048576).toFixed(1)}MB`}</span>
                {!isStreaming && (
                  <button type="button" className="ka-file-chip-x" onClick={() => fileAttachments.removeFile(i)}><IconClose size={12} /></button>
                )}
              </span>
            )
          ))}
        </div>
      )}

      {/* Upgrade Wall */}
      <AnimatePresence>
        {billing.showUpgradeWall && (
          <motion.div className="ka-upgrade-overlay" data-testid="upgrade-wall" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="ka-upgrade-modal" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}>
              <img className="ka-upgrade-emblem" src={`${import.meta.env.BASE_URL}concepts/emblem-kernel.svg`} alt="" aria-hidden="true" />
              <h2 className="ka-upgrade-title">{t('upgrade.title', { limit: effectiveLimit })}</h2>
              {billing.freeLimitResetsAt ? (
                <p className="ka-upgrade-subtitle">{t('upgrade.resetsAt', { time: new Date(billing.freeLimitResetsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) })}</p>
              ) : (
                <p className="ka-upgrade-subtitle">{t('upgrade.subtitle')}</p>
              )}
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
              <button className="ka-upgrade-dismiss" onClick={() => billing.setShowUpgradeWall(false)}>Come back tomorrow</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overage Prompt */}
      <AnimatePresence>
        {chatEngine.showOveragePrompt && (
          <motion.div className="ka-upgrade-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="ka-upgrade-modal" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}>
              <OveragePrompt
                limit={planLimits.messagesPerDay * 30}
                overageRate={30}
                onAccept={() => {
                  localStorage.setItem('kernel_overage_accepted', 'true')
                  chatEngine.setShowOveragePrompt(false)
                  // Re-send the last user message
                  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
                  if (lastUserMsg) chatEngine.sendMessage(lastUserMsg.content)
                }}
                onDecline={() => chatEngine.setShowOveragePrompt(false)}
              />
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
              liveShareState={liveShare.state}
              onCreateLiveShare={() => liveShare.create(convs.activeConversationId!)}
              onRevokeLiveShare={liveShare.revoke}
              onKickParticipant={liveShare.kick}
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
              onUpdatePassword={updatePassword}
              onUpdateEmail={updateEmail}
              onUpdateProfile={updateProfile}
              onDismiss={clearPasswordRecovery}
              onToast={showToast}
              currentEmail={user?.email}
              currentUsername={user?.user_metadata?.username}
            />
          </Suspense>
        )}
      </AnimatePresence>

      {/* Delete Account Confirmation */}
      <DeleteAccountModal
        show={billing.showDeleteConfirm}
        loading={billing.deleteLoading}
        isSubscribed={isSubscribed}
        onConfirm={billing.handleDeleteAccount}
        onCancel={() => billing.setShowDeleteConfirm(false)}
      />

      {/* Image Credit Modal */}
      <Suspense fallback={null}>
        <ImageCreditModal
          open={showCreditModal}
          onClose={() => setShowCreditModal(false)}
          credits={imageCredits}
          onToast={showToast}
        />
      </Suspense>

      {/* Free-tier message counter */}
      {!isPro && !billing.showUpgradeWall && (() => {
        const remaining = effectiveLimit - chatEngine.messageCountRef.current
        const urgency = remaining < 5 ? 'critical' : remaining <= 10 ? 'warning' : 'normal'
        return remaining > 0 ? (
          <div className={`ka-msg-counter ka-msg-counter--${urgency}`}>
            {t('messagesLeft', { count: remaining })}
          </div>
        ) : null
      })()}

      {/* Message usage counter */}
      {!messageUsage.loading && !isAdmin && (
        <div className={`ka-usage-counter${messageUsage.used >= messageUsage.limit ? ' ka-usage-counter--limit' : messageUsage.used >= messageUsage.limit * 0.7 ? ' ka-usage-counter--warn' : ''}`}>
          {messageUsage.used} / {messageUsage.limit}
        </div>
      )}

      {/* Input bar */}
      <form ref={inputBarRef} className="ka-input-bar" onSubmit={chatEngine.handleSubmit}>
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
              </div>
            )}
          </div>
        ) : (
          <button type="button" className={`ka-attach-btn${isStreaming ? ' ka-attach-btn--disabled' : ''}`} aria-label={t('aria.attachFile', { ns: 'common' })} onClick={() => fileAttachments.fileInputRef.current?.click()}>
            <IconAttach size={18} />
          </button>
        )}

        <textarea
          ref={chatEngine.inputRef}
          className="ka-input"
          data-testid="chat-input"
          value={chatEngine.input}
          onChange={e => {
            chatEngine.setInput(e.target.value)
            const el = e.target
            el.style.height = 'auto'
            el.style.height = Math.min(el.scrollHeight, 200) + 'px'
          }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); chatEngine.handleSubmit(e) } }}
          onPaste={fileAttachments.handlePaste}
          placeholder={t('placeholder')}
          disabled={isStreaming}
          rows={1}
        />
        {voiceInput.isSupported && !isStreaming && (
          <button
            type="button"
            className={`ka-voice-btn${voiceInput.isRecording ? ' ka-voice-btn--recording' : ''}`}
            onClick={() => {
              if (voiceInput.isRecording) {
                voiceInput.stopRecording()
                // Auto-submit if there's a final transcript
                if (voiceInput.finalTranscript.trim()) {
                  chatEngine.setInput(voiceInput.finalTranscript.trim())
                  setTimeout(() => chatEngine.handleSubmit(new Event('submit') as any), 50)
                }
              } else {
                voiceInput.startRecording()
              }
            }}
            onContextMenu={(e) => {
              // Long-press on mobile: start voice loop (Pro only)
              if (isPro) {
                e.preventDefault()
                voiceLoop.start()
              }
            }}
            aria-label={voiceInput.isRecording ? 'Stop recording' : 'Start voice input'}
          >
            <IconMic size={18} />
          </button>
        )}
        {isStreaming ? (
          <button type="button" className="ka-stop" onClick={chatEngine.stopStreaming} aria-label={t('aria.stopGenerating', { ns: 'common' })}><IconStop size={16} /></button>
        ) : (
          <button type="submit" className="ka-send" data-testid="chat-send" disabled={!chatEngine.input.trim() && fileAttachments.attachedFiles.length === 0} aria-label={t('aria.sendMessage', { ns: 'common' })}><IconSend size={18} /></button>
        )}
      </form>

      {!isOnline && <div className="ka-offline-banner">{t('offline', { ns: 'common' })}</div>}

      <VoiceLoopOverlay
        isActive={voiceLoop.isActive}
        state={voiceLoop.state}
        transcript={voiceLoop.transcript}
        onStop={voiceLoop.stop}
      />

      <BottomTabBar activeTab={panels.activeTab} onTabChange={panels.handleTabChange} />
      <AnimatePresence>
        {panels.showMoreMenu && (
          <Suspense fallback={null}>
            <MoreMenu isOpen={panels.showMoreMenu} onClose={() => panels.closePanel('settings')} onSelect={panels.handleSettingsAction} onUpgrade={billing.handleUpgrade} upgradeLoading={billing.upgradeLoading} isPro={isPro} isSubscribed={isSubscribed} isAdmin={isAdmin} theme={theme} onSetTheme={setTheme} />
          </Suspense>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div className="ka-toast" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}>{toast}</motion.div>
        )}
      </AnimatePresence>

      {/* Image Lightbox */}
      <AnimatePresence>
        {lightboxSrc && (
          <motion.div
            className="ka-lightbox"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setLightboxSrc(null)}
            onKeyDown={(e) => { if (e.key === 'Escape') setLightboxSrc(null) }}
            tabIndex={0}
            role="dialog"
            aria-label="Image viewer"
          >
            <motion.img
              src={lightboxSrc}
              className="ka-lightbox-img"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              alt="Full size preview"
            />
            <button className="ka-lightbox-close" onClick={() => setLightboxSrc(null)} aria-label="Close image viewer">
              <IconClose size={20} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tag Modal */}
      <AnimatePresence>
        {taggingConvId && (
          <Suspense fallback={null}>
            <TagModal
              isOpen={!!taggingConvId}
              onClose={() => setTaggingConvId(null)}
              currentTags={getConvTags(taggingConvId)}
              onSave={handleSaveTags}
            />
          </Suspense>
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
        dragConstraints={{ top: 0 }}
        dragElastic={{ top: 0, bottom: 0.2 }}
        onDragEnd={(_, info) => { if (info.offset.y > 80 || info.velocity.y > 300) onClose() }}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <div className="ka-kg-drag-handle" onPointerDown={(e) => dragControls.start(e)} />
        {children}
      </motion.div>
    </motion.div>
  )
}
