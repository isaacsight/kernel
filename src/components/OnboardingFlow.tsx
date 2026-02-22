import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { IconArrowRight, IconCheck } from './KernelIcons'
import { SPRING, DURATION, EASE, TRANSITION } from '../constants/motion'
import { SPECIALISTS } from '../agents/specialists'

// ─── Types ──────────────────────────────────────────────

interface OnboardingFlowProps {
  onComplete: (interests?: string[]) => void
  userName?: string
}

type Stage =
  | 'idle'
  | 'welcome'
  | 'awaiting_welcome_reply'
  | 'capabilities'
  | 'awaiting_capabilities_reply'
  | 'interests'
  | 'awaiting_interests'
  | 'ready'
  | 'awaiting_start'

interface ChatMessage {
  id: string
  role: 'kernel' | 'user'
  content: string
  widget?: 'agent-showcase' | 'interest-picker' | 'start-cta'
}

interface QuickReply {
  id: string
  labelKey: string
  nextStage: Stage
}

// ─── Constants ──────────────────────────────────────────

const INTERESTS = [
  { id: 'tech', emoji: '\u2699\ufe0f' },
  { id: 'business', emoji: '\ud83d\udcbc' },
  { id: 'creative', emoji: '\u270f\ufe0f' },
  { id: 'science', emoji: '\ud83d\udd2c' },
  { id: 'health', emoji: '\ud83c\udfcb\ufe0f' },
  { id: 'finance', emoji: '\ud83d\udcb0' },
  { id: 'design', emoji: '\ud83c\udfa8' },
  { id: 'coding', emoji: '\ud83d\udcbb' },
  { id: 'music', emoji: '\ud83c\udfb5' },
  { id: 'philosophy', emoji: '\ud83e\udde0' },
  { id: 'travel', emoji: '\u2708\ufe0f' },
  { id: 'education', emoji: '\ud83d\udcda' },
]

const CORE_AGENT_IDS = ['kernel', 'researcher', 'coder', 'writer', 'analyst']

const WELCOME_REPLIES: QuickReply[] = [
  { id: 'what-can', labelKey: 'replies.whatCanYouDo', nextStage: 'capabilities' },
  { id: 'tell-more', labelKey: 'replies.tellMeMore', nextStage: 'capabilities' },
  { id: 'lets-start', labelKey: 'replies.letsStart', nextStage: 'interests' },
]

const CAPABILITIES_REPLIES: QuickReply[] = [
  { id: 'cool', labelKey: 'replies.thatsCool', nextStage: 'interests' },
  { id: 'memory', labelKey: 'replies.howMemory', nextStage: 'interests' },
  { id: 'skip-chat', labelKey: 'replies.skipToChat', nextStage: 'interests' },
]

// ─── Component ──────────────────────────────────────────

export function OnboardingFlow({ onComplete, userName }: OnboardingFlowProps) {
  const { t } = useTranslation('onboarding')
  const [stage, setStage] = useState<Stage>('idle')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [selectedInterests, setSelectedInterests] = useState<string[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const [quickReplies, setQuickReplies] = useState<QuickReply[] | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const timeoutRefs = useRef<ReturnType<typeof setTimeout>[]>([])
  const msgCounter = useRef(0)

  // ─── Helpers ──────────────────────────────────────────

  const addTimeout = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms)
    timeoutRefs.current.push(id)
    return id
  }, [])

  const pushKernelMsg = useCallback((content: string, widget?: ChatMessage['widget']) => {
    const id = `k-${++msgCounter.current}`
    setMessages(prev => [...prev, { id, role: 'kernel', content, widget }])
  }, [])

  const pushUserMsg = useCallback((content: string) => {
    const id = `u-${++msgCounter.current}`
    setMessages(prev => [...prev, { id, role: 'user', content }])
  }, [])

  // Queue kernel messages with typing gaps
  const queueMessages = useCallback((
    msgs: Array<{ content: string; widget?: ChatMessage['widget'] }>,
    startDelay: number,
    onDone?: () => void
  ) => {
    let cumulative = startDelay
    msgs.forEach((msg) => {
      const typingDuration = 800 + Math.min(msg.content.length * 6, 800)
      addTimeout(() => setIsTyping(true), cumulative)
      cumulative += typingDuration
      addTimeout(() => {
        setIsTyping(false)
        pushKernelMsg(msg.content, msg.widget)
      }, cumulative)
      cumulative += 300
    })
    if (onDone) {
      addTimeout(onDone, cumulative + 100)
    }
  }, [addTimeout, pushKernelMsg])

  // ─── Auto-scroll ──────────────────────────────────────

  useEffect(() => {
    if (scrollRef.current?.scrollTo) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    }
  }, [messages.length, isTyping])

  // ─── Stage Effects ────────────────────────────────────

  // Start welcome sequence after mount
  useEffect(() => {
    addTimeout(() => setStage('welcome'), 800)
    return () => {
      timeoutRefs.current.forEach(clearTimeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Drive the conversation based on stage changes
  useEffect(() => {
    // Only clear replies when entering content stages (not awaiting states)
    if (!stage.startsWith('awaiting')) {
      setQuickReplies(null)
    }

    switch (stage) {
      case 'welcome': {
        const displayName = userName?.split('@')[0]
        const greeting = displayName
          ? t('welcome.greetingUser', { name: displayName })
          : t('welcome.greeting')

        queueMessages(
          [
            { content: greeting },
            { content: t('welcome.intro') },
          ],
          200,
          () => {
            setStage('awaiting_welcome_reply')
            setQuickReplies(WELCOME_REPLIES)
          }
        )
        break
      }

      case 'capabilities': {
        queueMessages(
          [
            { content: t('capabilities.agents') },
            { content: '', widget: 'agent-showcase' },
            { content: t('capabilities.agentsDetail') },
          ],
          300,
          () => {
            setStage('awaiting_capabilities_reply')
            setQuickReplies(CAPABILITIES_REPLIES)
          }
        )
        break
      }

      case 'interests': {
        queueMessages(
          [
            { content: t('interests.prompt') },
            { content: '', widget: 'interest-picker' },
          ],
          300,
          () => setStage('awaiting_interests')
        )
        break
      }

      case 'ready': {
        const notedKey = selectedInterests.length > 0 ? 'ready.noted' : 'ready.notedNoInterests'
        queueMessages(
          [
            { content: t(notedKey) },
            { content: t('ready.freeMessages') },
            { content: '', widget: 'start-cta' },
          ],
          300,
          () => setStage('awaiting_start')
        )
        break
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage])

  // ─── Handlers ─────────────────────────────────────────

  const handleQuickReply = useCallback((reply: QuickReply) => {
    const label = t(reply.labelKey)
    pushUserMsg(label)
    setQuickReplies(null)
    addTimeout(() => setStage(reply.nextStage), 400)
  }, [t, pushUserMsg, addTimeout])

  const handleInterestsConfirm = useCallback(() => {
    addTimeout(() => setStage('ready'), 200)
  }, [addTimeout])

  const handleStart = useCallback(() => {
    onComplete(selectedInterests.length > 0 ? selectedInterests : undefined)
  }, [onComplete, selectedInterests])

  const handleSkip = useCallback(() => {
    onComplete(selectedInterests.length > 0 ? selectedInterests : undefined)
  }, [onComplete, selectedInterests])

  const toggleInterest = useCallback((id: string) => {
    setSelectedInterests(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }, [])

  // ─── Render ───────────────────────────────────────────

  return (
    <div className="ka-onb-page">
      {/* Minimal header */}
      <div className="ka-onb-header">
        <img src={`${import.meta.env.BASE_URL}logo-mark.svg`} alt="Kernel" className="ka-onb-logo" />
      </div>

      {/* Skip link */}
      <button className="ka-onb-skip" onClick={handleSkip}>
        {t('skipIntro')}
      </button>

      {/* Chat area */}
      <div className="ka-onb-chat" ref={scrollRef} role="log" aria-live="polite">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              className={`ka-msg ${msg.role === 'kernel' ? 'ka-msg--kernel' : 'ka-msg--user'}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DURATION.NORMAL, ease: EASE.OUT }}
              style={{ animation: 'none' }} // override CSS ka-ink-appear, use framer instead
            >
              {msg.role === 'kernel' && (
                <div className="ka-msg-avatar" data-agent="kernel">
                  <img
                    src={`${import.meta.env.BASE_URL}${SPECIALISTS.kernel.emblem}`}
                    alt=""
                    className="ka-msg-avatar-img"
                    aria-hidden="true"
                  />
                </div>
              )}
              <div className="ka-msg-bubble">
                {/* Text content */}
                {msg.content && <span>{msg.content}</span>}

                {/* Inline widgets */}
                {msg.widget === 'agent-showcase' && <AgentShowcase />}
                {msg.widget === 'interest-picker' && (
                  <InterestPicker
                    selected={selectedInterests}
                    onToggle={toggleInterest}
                    onConfirm={handleInterestsConfirm}
                    locked={stage === 'ready' || stage === 'awaiting_start'}
                    t={t}
                  />
                )}
                {msg.widget === 'start-cta' && (
                  <motion.button
                    className="ka-onb-start-cta"
                    onClick={handleStart}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={TRANSITION.CARD}
                  >
                    {t('ready.startCta')}
                    <IconArrowRight size={16} />
                  </motion.button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        <AnimatePresence>
          {isTyping && (
            <motion.div
              className="ka-msg ka-msg--kernel"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: DURATION.FAST }}
              style={{ animation: 'none' }}
            >
              <div className="ka-msg-avatar" data-agent="kernel">
                <img
                  src={`${import.meta.env.BASE_URL}${SPECIALISTS.kernel.emblem}`}
                  alt=""
                  className="ka-msg-avatar-img"
                  aria-hidden="true"
                />
              </div>
              <div className="ka-msg-bubble">
                <div className="ka-typing">
                  <span /><span /><span />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Quick reply bar — uses CSS animations for reliable rendering */}
      {quickReplies && (
        <div
          className="ka-onb-quick-replies ka-onb-quick-replies--visible"
          role="group"
          aria-label={t('replies.whatCanYouDo')}
        >
          {quickReplies.map((reply, i) => (
            <button
              key={reply.id}
              className="ka-onb-quick-reply"
              onClick={() => handleQuickReply(reply)}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              {t(reply.labelKey)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Agent Showcase ─────────────────────────────────────

function AgentShowcase() {
  return (
    <div className="ka-onb-agent-showcase">
      {CORE_AGENT_IDS.map((id, i) => {
        const spec = SPECIALISTS[id]
        if (!spec) return null
        return (
          <motion.div
            key={id}
            className="ka-onb-agent-item"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ ...SPRING.GENTLE, delay: i * 0.08 }}
          >
            <div
              className="ka-onb-agent-circle"
              style={{ borderColor: spec.color, color: spec.color }}
            >
              {spec.emblem ? (
                <img src={`${import.meta.env.BASE_URL}${spec.emblem}`} alt="" className="ka-msg-avatar-img" />
              ) : (
                <span>{spec.icon}</span>
              )}
            </div>
            <span className="ka-onb-agent-label" style={{ color: spec.color }}>
              {spec.name}
            </span>
          </motion.div>
        )
      })}
    </div>
  )
}

// ─── Interest Picker ────────────────────────────────────

function InterestPicker({
  selected,
  onToggle,
  onConfirm,
  locked,
  t,
}: {
  selected: string[]
  onToggle: (id: string) => void
  onConfirm: () => void
  locked: boolean
  t: (key: string) => string
}) {
  return (
    <div className={`ka-onb-interest-wrap${locked ? ' ka-onb-interest-wrap--locked' : ''}`}>
      <div className="onboarding-interests">
        {INTERESTS.map((interest, i) => (
          <motion.button
            key={interest.id}
            className={`onboarding-interest${selected.includes(interest.id) ? ' onboarding-interest--selected' : ''}`}
            onClick={() => !locked && onToggle(interest.id)}
            disabled={locked}
            role="checkbox"
            aria-checked={selected.includes(interest.id)}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ ...SPRING.GENTLE, delay: i * 0.03 }}
          >
            <span>{interest.emoji}</span>
            <span>{t(`interests.${interest.id}`)}</span>
            {selected.includes(interest.id) && <IconCheck size={14} />}
          </motion.button>
        ))}
      </div>
      {!locked && selected.length > 0 && (
        <motion.button
          className="ka-onb-continue-btn"
          onClick={onConfirm}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: DURATION.QUICK, ease: EASE.OUT }}
        >
          {t('continue')}
          <IconArrowRight size={14} />
        </motion.button>
      )}
    </div>
  )
}
