import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Menu, Copy, Check, ThumbsUp, ThumbsDown, Paperclip, X, Download, Moon, Sun, Pencil, Share2, FileDown, Mic, MicOff, Square, ChevronDown, EllipsisVertical, Trash2, Crown, Shield, Brain, BarChart3, Target, Zap, Clock, Newspaper, MessageCircle, LogOut, Settings } from 'lucide-react'
import { BottomTabBar } from '../components/BottomTabBar'
import { MoreMenu } from '../components/MoreMenu'
import KGPanel from '../components/kernel-agent/KGPanel'
import StatsPanel from '../components/kernel-agent/StatsPanel'
import { GoalsPanel } from '../components/GoalsPanel'
import { WorkflowsPanel } from '../components/WorkflowsPanel'
import { ScheduledTasksPanel } from '../components/ScheduledTasksPanel'
import { BriefingPanel } from '../components/BriefingPanel'
import { NotificationBell } from '../components/NotificationBell'
import { KERNEL_TOPICS } from '../agents/kernel'
import { getSpecialist } from '../agents/specialists'
import { useAuthContext } from '../providers/AuthProvider'
import { upsertKGEntity } from '../engine/SupabaseClient'
import { ShareModal } from '../components/ShareModal'
import { ConversationDrawer } from '../components/ConversationDrawer'
import { OnboardingFlow } from '../components/OnboardingFlow'
import { LoginGate } from '../components/LoginGate'
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

  const onboardingKey = `kernel-onboarded-${user?.id || 'anon'}`
  const [onboarded, setOnboarded] = useState(() => localStorage.getItem(onboardingKey) === 'true')

  if (!onboarded) {
    return (
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
    )
  }

  return <EngineChat />
}

// ─── Engine Chat (post-auth) ────────────────────────────

const FREE_MSG_LIMIT = 10

function EngineChat() {
  const { user, isAdmin, isSubscribed, signOut, refreshSubscription } = useAuthContext()
  const isPro = isSubscribed || isAdmin
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  // ─── Hooks ────────────────────────────────────────────
  const { darkMode, setDarkMode } = useDarkMode()
  const { toast, showToast } = useToast()

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
          showToast('Welcome to Kernel Pro!')
        }
        const cleanHash = hash.replace(/[?&]checkout=complete/, '').replace(/\?$/, '')
        window.location.hash = cleanHash || '#/'
      }
    }, 2000)
    return () => clearInterval(poll)
  }, [refreshSubscription, billing, showToast])

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

  // ─── Render ───────────────────────────────────────────
  return (
    <div className="ka-page">
      {/* Panel Bottom Sheets */}
      <AnimatePresence>
        {panels.showKGPanel && (
          <BottomSheet onClose={() => { panels.setShowKGPanel(false); panels.setActiveTab('home') }}>
            <KGPanel entities={chatEngine.kgEntities} relations={chatEngine.kgRelations} onClose={() => { panels.setShowKGPanel(false); panels.setActiveTab('home') }} />
          </BottomSheet>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {panels.showStatsPanel && user && (
          <BottomSheet onClose={() => { panels.setShowStatsPanel(false); panels.setActiveTab('home') }}>
            <StatsPanel userId={user.id} onClose={() => { panels.setShowStatsPanel(false); panels.setActiveTab('home') }} />
          </BottomSheet>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {panels.showGoalsPanel && user && (
          <BottomSheet onClose={() => { panels.setShowGoalsPanel(false); panels.setActiveTab('home') }}>
            <GoalsPanel userId={user.id} onClose={() => { panels.setShowGoalsPanel(false); panels.setActiveTab('home') }} onToast={showToast} />
          </BottomSheet>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {panels.showWorkflowsPanel && user && (
          <BottomSheet onClose={() => { panels.setShowWorkflowsPanel(false); panels.setActiveTab('home') }}>
            <WorkflowsPanel
              userId={user.id}
              onClose={() => { panels.setShowWorkflowsPanel(false); panels.setActiveTab('home') }}
              onToast={showToast}
              onRunWorkflow={(proc) => {
                panels.setShowWorkflowsPanel(false)
                chatEngine.sendMessage(`Run workflow: ${proc.name}`)
              }}
            />
          </BottomSheet>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {panels.showScheduledPanel && user && (
          <BottomSheet onClose={() => { panels.setShowScheduledPanel(false); panels.setActiveTab('home') }}>
            <ScheduledTasksPanel userId={user.id} onClose={() => { panels.setShowScheduledPanel(false); panels.setActiveTab('home') }} onToast={showToast} />
          </BottomSheet>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {panels.showBriefingPanel && user && (
          <BottomSheet onClose={() => { panels.setShowBriefingPanel(false); panels.setActiveTab('home') }}>
            <BriefingPanel
              userId={user.id}
              userMemory={chatEngine.userMemory}
              kgEntities={chatEngine.kgEntities}
              onClose={() => { panels.setShowBriefingPanel(false); panels.setActiveTab('home') }}
              onToast={showToast}
              onGoDeeper={(title, content) => { panels.setShowBriefingPanel(false); panels.setActiveTab('home'); chatEngine.handleBriefingGoDeeper(title, content) }}
              onAddGoal={chatEngine.handleBriefingAddGoal}
            />
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
        isLoading={convs.convsLoading}
      />

      {/* Header */}
      <header className="ka-header">
        <div className="ka-header-left">
          <button className="ka-menu-btn" onClick={() => setIsDrawerOpen(true)} aria-label="Conversations">
            <Menu size={18} />
          </button>
          <button className="ka-home-btn" onClick={() => { panels.closeAllPanels(); convs.handleNewChat() }} aria-label="New chat">
            <img className="ka-logo" src={`${import.meta.env.BASE_URL}logo-mark.svg`} alt="Kernel" />
            <span className="ka-title">
              {convs.activeConversation ? convs.activeConversation.title : 'kernel.chat'}
            </span>
          </button>
        </div>
        <div className="ka-header-right">
          {isAdmin && <span className="ka-admin-badge"><Shield size={12} /> Admin</span>}
          {!isAdmin && isSubscribed && <span className="ka-pro-badge"><Crown size={12} /> Pro</span>}
          {user && <NotificationBell userId={user.id} />}
          <button className="ka-header-icon-btn" onClick={() => setDarkMode(!darkMode)} aria-label="Toggle dark mode">
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <div className="ka-header-menu-wrap" ref={headerMenuRef}>
            <button className="ka-header-icon-btn" onClick={() => panels.setHeaderMenuOpen(!panels.headerMenuOpen)} aria-label="More options">
              <EllipsisVertical size={16} />
            </button>
            {panels.headerMenuOpen && (
              <div className="ka-header-menu">
                {messages.length > 0 && (
                  <>
                    <div className="ka-header-menu-label">Conversation</div>
                    <button className="ka-header-menu-item" onClick={() => { msgActions.setShowShareModal(true); panels.setHeaderMenuOpen(false) }}>
                      <Share2 size={14} /> Share conversation
                    </button>
                    <button className="ka-header-menu-item" onClick={() => { msgActions.handleExportConversation(); panels.setHeaderMenuOpen(false) }}>
                      <FileDown size={14} /> Export as Markdown
                    </button>
                  </>
                )}
                <div className="ka-header-menu-divider ka-menu-tabbed" />
                <div className="ka-header-menu-label ka-menu-tabbed">Features</div>
                <button className="ka-header-menu-item ka-menu-tabbed" onClick={() => { panels.closeAllPanels(); panels.setShowGoalsPanel(true); panels.setHeaderMenuOpen(false) }}>
                  <Target size={14} /> Goals
                </button>
                <button className="ka-header-menu-item ka-menu-tabbed" onClick={() => { panels.closeAllPanels(); panels.setShowWorkflowsPanel(true); panels.setHeaderMenuOpen(false) }}>
                  <Zap size={14} /> Workflows
                </button>
                <button className="ka-header-menu-item ka-menu-tabbed" onClick={() => { panels.closeAllPanels(); panels.setShowScheduledPanel(true); panels.setHeaderMenuOpen(false) }}>
                  <Clock size={14} /> Scheduled tasks
                </button>
                <button className="ka-header-menu-item ka-menu-tabbed" onClick={() => { panels.closeAllPanels(); panels.setShowBriefingPanel(true); panels.setHeaderMenuOpen(false) }}>
                  <Newspaper size={14} /> Daily briefing
                </button>
                <button className="ka-header-menu-item ka-menu-tabbed" onClick={() => { panels.closeAllPanels(); panels.setShowKGPanel(true); panels.setHeaderMenuOpen(false) }}>
                  <Brain size={14} /> What Kernel knows
                </button>
                <button className="ka-header-menu-item ka-menu-tabbed" onClick={() => { panels.closeAllPanels(); panels.setShowStatsPanel(true); panels.setHeaderMenuOpen(false) }}>
                  <BarChart3 size={14} /> Your stats
                </button>
                <div className="ka-header-menu-divider" />
                <div className="ka-header-menu-label ka-menu-tabbed">Account</div>
                {!isPro && (
                  <button className="ka-header-menu-item ka-header-menu-item--upgrade ka-menu-tabbed" onClick={() => { billing.handleUpgrade(); panels.setHeaderMenuOpen(false) }}>
                    <Crown size={14} /> Upgrade to Pro
                  </button>
                )}
                {!isAdmin && isSubscribed && (
                  <button className="ka-header-menu-item ka-menu-tabbed" onClick={() => { billing.handleManageSubscription(); panels.setHeaderMenuOpen(false) }} disabled={billing.portalLoading}>
                    <Settings size={14} className={billing.portalLoading ? 'ka-spin' : ''} /> Manage subscription
                  </button>
                )}
                <button className="ka-header-menu-item ka-menu-tabbed" onClick={() => { signOut(); panels.setHeaderMenuOpen(false) }}>
                  <LogOut size={14} /> Sign out
                </button>
                <button className="ka-header-menu-item ka-header-menu-item--danger ka-menu-tabbed" onClick={() => { billing.setShowDeleteConfirm(true); panels.setHeaderMenuOpen(false) }}>
                  <Trash2 size={14} /> Delete account
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
            <div className="ka-empty-icon">K</div>
            <h1 className="ka-empty-title">kernel.chat</h1>
            <p className="ka-empty-subtitle">A personal AI that remembers you, thinks with you, and gets better over time.</p>
            {chatEngine.todayBriefing && (
              <div className="ka-home-briefing-card">
                <div className="ka-home-briefing-info">
                  <Newspaper size={16} className="ka-home-briefing-icon" />
                  <div className="ka-home-briefing-text">
                    <span className="ka-home-briefing-label">Today's briefing</span>
                    <span className="ka-home-briefing-title">{chatEngine.todayBriefing.title}</span>
                  </div>
                </div>
                <div className="ka-home-briefing-actions">
                  <button className="ka-home-briefing-btn" onClick={() => { panels.closeOtherPanels('briefings'); panels.setShowBriefingPanel(true); panels.setActiveTab('briefings') }}>Read</button>
                  <button className="ka-home-briefing-btn ka-home-briefing-btn--discuss" onClick={() => chatEngine.handleBriefingGoDeeper(chatEngine.todayBriefing!.title, chatEngine.todayBriefing!.content)}>
                    <MessageCircle size={12} /> Discuss
                  </button>
                </div>
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
                  <motion.span key={thinkingAgent} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="ka-thinking-text">{thinkingAgent} is working...</motion.span>
                ) : (
                  <span className="ka-thinking-text">Routing to specialist...</span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {messages.map(msg => (
            <motion.div key={msg.id} className={`ka-msg ka-msg--${msg.role}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
              {msg.role === 'kernel' && (
                <div className="ka-msg-avatar-col">
                  <div className="ka-msg-avatar">{msg.agentId ? getSpecialist(msg.agentId).icon : 'K'}</div>
                  {msg.agentName && msg.agentName !== 'Kernel' && (
                    <span className="ka-agent-badge" style={{ color: getSpecialist(msg.agentId || 'kernel').color }}>{msg.agentName}</span>
                  )}
                </div>
              )}
              <div className="ka-msg-col">
                <div className="ka-msg-bubble">
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="ka-msg-attachments">
                      {msg.attachments.map((a, i) => <span key={i} className="ka-msg-attachment">{a.name}</span>)}
                    </div>
                  )}
                  {msgActions.editingMsgId === msg.id ? (
                    <form className="ka-edit-form" onSubmit={(e) => { e.preventDefault(); msgActions.handleEditMessage(msg.id, msgActions.editingContent) }}>
                      <input className="ka-edit-input" value={msgActions.editingContent} onChange={e => msgActions.setEditingContent(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { msgActions.setEditingMsgId(null); msgActions.setEditingContent('') } }} />
                      <button type="submit" className="ka-edit-save">Save</button>
                      <button type="button" className="ka-edit-cancel" onClick={() => { msgActions.setEditingMsgId(null); msgActions.setEditingContent('') }}>Cancel</button>
                    </form>
                  ) : msg.content ? (
                    msg.role === 'kernel' ? <MessageContent text={msg.content} /> : <Linkify text={msg.content} />
                  ) : (
                    <span className="ka-typing"><span /><span /><span /></span>
                  )}
                </div>
                {msg.role === 'user' && msg.content && !isStreaming && msgActions.editingMsgId !== msg.id && (
                  <div className="ka-msg-actions">
                    <button className="ka-msg-action-btn" onClick={() => { msgActions.setEditingMsgId(msg.id); msgActions.setEditingContent(msg.content) }} aria-label="Edit message">
                      <Pencil size={14} />
                    </button>
                  </div>
                )}
                {msg.role === 'kernel' && msg.content && (
                  <div className="ka-msg-actions">
                    <button className="ka-msg-action-btn" onClick={() => msgActions.handleCopyMessage(msg.id, msg.content)} aria-label="Copy message">
                      {msgActions.copiedMsgId === msg.id ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                    <button className="ka-msg-action-btn" onClick={() => downloadFile(msg.content, `kernel-${new Date(msg.timestamp).toISOString().slice(0, 10)}.md`)} aria-label="Download response">
                      <Download size={14} />
                    </button>
                    {msg.signalId && !msg.feedback && (
                      <>
                        <button className="ka-msg-action-btn ka-msg-action-btn--up" onClick={() => msgActions.handleFeedback(msg, 'helpful')} aria-label="Helpful"><ThumbsUp size={14} /></button>
                        <button className="ka-msg-action-btn ka-msg-action-btn--down" onClick={() => msgActions.handleFeedback(msg, 'poor')} aria-label="Not helpful"><ThumbsDown size={14} /></button>
                      </>
                    )}
                    {msg.feedback && (
                      <span className="ka-msg-feedback-done">{msg.feedback === 'helpful' ? <ThumbsUp size={14} /> : <ThumbsDown size={14} />}</span>
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
        {scroll.showScrollBtn && (
          <motion.button className="ka-scroll-btn" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} onClick={scroll.scrollToBottom} aria-label="Scroll to bottom">
            <ChevronDown size={18} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* File chips */}
      {fileAttachments.attachedFiles.length > 0 && (
        <div className="ka-file-chips">
          {fileAttachments.attachedFiles.map((f, i) => (
            <span key={i} className={`ka-file-chip${isStreaming ? ' ka-file-chip--sending' : ''}`}>
              <Paperclip size={12} />
              <span className="ka-file-chip-name">{f.name}</span>
              <span className="ka-file-chip-size">{f.size < 1024 ? `${f.size}B` : f.size < 1048576 ? `${(f.size / 1024).toFixed(0)}KB` : `${(f.size / 1048576).toFixed(1)}MB`}</span>
              {!isStreaming && (
                <button type="button" className="ka-file-chip-x" onClick={() => fileAttachments.removeFile(i)}><X size={12} /></button>
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
              <div className="ka-upgrade-icon">K</div>
              <h2 className="ka-upgrade-title">You've used your {FREE_MSG_LIMIT} free messages</h2>
              <p className="ka-upgrade-subtitle">Upgrade to Kernel Pro to keep the conversation going.</p>
              <ul className="ka-upgrade-features">
                <li>Unlimited messages</li><li>Deep research mode</li><li>Multi-agent collaboration</li><li>Multi-step task planning</li><li>Persistent memory across sessions</li>
              </ul>
              <button className="ka-upgrade-btn" onClick={billing.handleUpgrade} disabled={billing.upgradeLoading}>
                {billing.upgradeLoading ? 'Opening checkout...' : 'Upgrade to Pro \u2014 $20/mo'}
              </button>
              <button className="ka-upgrade-dismiss" onClick={() => billing.setShowUpgradeWall(false)}>Maybe later</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Share Modal */}
      <AnimatePresence>
        {msgActions.showShareModal && convs.activeConversationId && user && (
          <ShareModal
            conversationId={convs.activeConversationId}
            conversationTitle={convs.activeConversation?.title || 'Kernel Conversation'}
            messages={messages.map(m => ({ role: m.role, content: m.content, agentName: m.agentName, timestamp: m.timestamp }))}
            userId={user.id}
            onClose={() => msgActions.setShowShareModal(false)}
            onToast={showToast}
          />
        )}
      </AnimatePresence>

      {/* Delete Account Confirmation */}
      <AnimatePresence>
        {billing.showDeleteConfirm && (
          <motion.div className="ka-upgrade-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="ka-upgrade-modal" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}>
              <div className="ka-upgrade-icon" style={{ background: '#DC2626' }}><Trash2 size={22} /></div>
              <h2 className="ka-upgrade-title">Delete your account?</h2>
              <p className="ka-upgrade-subtitle">
                This permanently deletes all your data: conversations, memory, and preferences. This cannot be undone.
                {isSubscribed && ' Your subscription will also be cancelled.'}
              </p>
              <button className="ka-upgrade-btn" style={{ background: '#DC2626' }} onClick={billing.handleDeleteAccount} disabled={billing.deleteLoading}>
                {billing.deleteLoading ? 'Deleting...' : 'Yes, delete my account'}
              </button>
              <button className="ka-upgrade-dismiss" onClick={() => billing.setShowDeleteConfirm(false)}>Cancel</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Free-tier hint */}
      <AnimatePresence>
        {!isPro && chatEngine.messageCountRef.current >= 7 && chatEngine.messageCountRef.current < FREE_MSG_LIMIT && !billing.showUpgradeWall && (
          <motion.div className="ka-msg-hint" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            {FREE_MSG_LIMIT - chatEngine.messageCountRef.current === 1 ? 'Last free message' : `${FREE_MSG_LIMIT - chatEngine.messageCountRef.current} messages remaining`}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input bar */}
      <form className="ka-input-bar" onSubmit={chatEngine.handleSubmit}>
        <input id="ka-file-input" ref={fileAttachments.fileInputRef} type="file" accept={ACCEPTED_FILES} multiple onChange={fileAttachments.handleFileSelect} className="ka-attach-input" />
        <label htmlFor="ka-file-input" className={`ka-attach-btn${isStreaming ? ' ka-attach-btn--disabled' : ''}`} aria-label="Attach file">
          <Paperclip size={18} />
        </label>
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
          placeholder="Talk to kernel.chat..."
          disabled={isStreaming}
          rows={1}
        />
        <button type="button" className={`ka-voice-btn${isListening ? ' ka-voice-btn--active' : ''}`} onClick={toggleVoice} disabled={isStreaming} aria-label={isListening ? 'Stop listening' : 'Voice input'}>
          {isListening ? <MicOff size={18} /> : <Mic size={18} />}
        </button>
        {isStreaming ? (
          <button type="button" className="ka-stop" onClick={chatEngine.stopStreaming} aria-label="Stop generating"><Square size={16} /></button>
        ) : (
          <button type="submit" className="ka-send" disabled={!chatEngine.input.trim() && fileAttachments.attachedFiles.length === 0}><Send size={18} /></button>
        )}
      </form>

      <BottomTabBar activeTab={panels.activeTab} onTabChange={panels.handleTabChange} />
      <AnimatePresence>
        {panels.showMoreMenu && (
          <MoreMenu isOpen={panels.showMoreMenu} onClose={() => { panels.setShowMoreMenu(false); panels.setActiveTab('home') }} onSelect={panels.handleMoreAction} isPro={isPro} isAdmin={isAdmin} />
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

// ─── Shared Bottom Sheet Component ──────────────────────

function BottomSheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div className="ka-kg-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        className="ka-kg-sheet"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
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
