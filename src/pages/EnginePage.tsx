import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Square, RotateCcw, Eye, Brain, Zap, MessageCircle, Sparkles } from 'lucide-react'
import { useAIEngine } from '../hooks/useAIEngine'
import type { CognitivePhase } from '../engine/AIEngine'

const PHASE_META: Record<CognitivePhase, { label: string; icon: typeof Eye; color: string }> = {
  idle:       { label: 'Resting',    icon: Eye,           color: '#8B7355' },
  perceiving: { label: 'Perceiving', icon: Eye,           color: '#5B7B8C' },
  thinking:   { label: 'Thinking',   icon: Brain,         color: '#6366F1' },
  deciding:   { label: 'Deciding',   icon: Zap,           color: '#E07B53' },
  acting:     { label: 'Speaking',   icon: MessageCircle, color: '#4A9B7F' },
  reflecting: { label: 'Reflecting', icon: Sparkles,      color: '#8C5B5B' },
}

export function EnginePage() {
  const {
    phase,
    messages,
    turnCount,
    cycleCount,
    isRunning,
    totalInteractions,
    reflections,
    topicHistory,
    thinkingSteps,
    streamingText,
    perceive,
    startDiscussion,
    injectMessage,
    stop,
    reset,
  } = useAIEngine()

  const [input, setInput] = useState('')
  const [mode, setMode] = useState<'engine' | 'discuss'>('engine')
  const [topicInput, setTopicInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, streamingText, thinkingSteps])

  const handleSubmit = () => {
    if (!input.trim()) return
    if (mode === 'discuss') {
      injectMessage(input)
    } else {
      perceive(input)
    }
    setInput('')
  }

  const handleStartDiscussion = () => {
    if (!topicInput.trim()) return
    startDiscussion(topicInput)
    setTopicInput('')
  }

  const phaseMeta = PHASE_META[phase]
  const PhaseIcon = phaseMeta.icon

  return (
    <>
      {/* ── Header ── */}
      <header className="engine-header">
        <div className="engine-header-left">
          <div className="mono" style={{ opacity: 0.8 }}># engine</div>
          <div className="engine-phase-badge" style={{ borderColor: phaseMeta.color }}>
            <motion.div
              animate={{ scale: isRunning ? [1, 1.2, 1] : 1 }}
              transition={{ repeat: isRunning ? Infinity : 0, duration: 1.5 }}
            >
              <PhaseIcon size={14} style={{ color: phaseMeta.color }} />
            </motion.div>
            <span className="mono" style={{ fontSize: '0.65rem', color: phaseMeta.color }}>
              {phaseMeta.label}
            </span>
          </div>
        </div>
        <div className="engine-header-right">
          <span className="mono engine-stat">Cycles {cycleCount}</span>
          <span className="mono engine-stat">Turns {turnCount}</span>
          <span className="mono engine-stat">Lifetime {totalInteractions}</span>
          {isRunning && (
            <button onClick={stop} className="engine-stop-btn">
              <Square size={14} />
              <span className="mono" style={{ fontSize: '0.65rem' }}>Stop</span>
            </button>
          )}
          <button onClick={reset} className="engine-reset-btn" title="Reset engine">
            <RotateCcw size={14} />
          </button>
        </div>
      </header>

      {/* ── Mode Toggle ── */}
      <div className="engine-mode-bar">
        <button
          className={`engine-mode-tab ${mode === 'engine' ? 'active' : ''}`}
          onClick={() => setMode('engine')}
        >
          Cognitive Loop
        </button>
        <button
          className={`engine-mode-tab ${mode === 'discuss' ? 'active' : ''}`}
          onClick={() => setMode('discuss')}
        >
          Discussion
        </button>
      </div>

      {/* ── Main Content ── */}
      <div className="engine-body" ref={scrollRef}>
        {mode === 'engine' ? (
          <>
            {/* ── Cognitive Architecture Diagram ── */}
            {messages.length === 0 && !isRunning && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="engine-intro"
              >
                <h1 className="engine-title">The Antigravity Kernel</h1>
                <p className="engine-subtitle">
                  A unified AI engine. Five cognitive phases.
                  <br />
                  One loop: perceive, think, decide, act, reflect.
                </p>

                <div className="engine-diagram">
                  {(['perceiving', 'thinking', 'deciding', 'acting', 'reflecting'] as CognitivePhase[]).map((p, i) => {
                    const meta = PHASE_META[p]
                    const Icon = meta.icon
                    return (
                      <div key={p} className="engine-diagram-node">
                        <div
                          className="engine-diagram-circle"
                          style={{ borderColor: meta.color }}
                        >
                          <Icon size={20} style={{ color: meta.color }} />
                        </div>
                        <span className="mono engine-diagram-label">{meta.label}</span>
                        {i < 4 && <span className="engine-diagram-arrow">&rarr;</span>}
                      </div>
                    )
                  })}
                </div>

                <div className="engine-memory-diagram">
                  <div className="mono engine-memory-title">Memory Layers</div>
                  <div className="engine-memory-layers">
                    <div className="engine-memory-layer ephemeral">
                      <span className="engine-memory-layer-name">Ephemeral</span>
                      <span className="engine-memory-layer-desc">Vanishes each cycle</span>
                    </div>
                    <div className="engine-memory-layer working">
                      <span className="engine-memory-layer-name">Working</span>
                      <span className="engine-memory-layer-desc">Persists for session</span>
                    </div>
                    <div className="engine-memory-layer lasting">
                      <span className="engine-memory-layer-name">Lasting</span>
                      <span className="engine-memory-layer-desc">Survives across sessions</span>
                    </div>
                  </div>
                </div>

                {/* Topic History */}
                {topicHistory.length > 0 && (
                  <div className="engine-history">
                    <div className="mono engine-history-title">Past Conversations</div>
                    {topicHistory.slice(-5).map((t, i) => (
                      <div key={i} className="engine-history-item">"{t}"</div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* ── Live Thinking Steps ── */}
            <AnimatePresence>
              {thinkingSteps.map((event, i) => (
                event.type === 'thinking_step' && (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="engine-thinking-step"
                  >
                    <div className="engine-thinking-type mono">
                      {event.step.type}
                    </div>
                    <div className="engine-thinking-text">
                      {event.step.thought}
                    </div>
                  </motion.div>
                )
              ))}
            </AnimatePresence>

            {/* ── Message Stream ── */}
            <AnimatePresence initial={false}>
              {messages.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="engine-message"
                >
                  <div className="engine-message-header">
                    <span
                      className="engine-message-avatar"
                      style={{
                        backgroundColor: m.agentId === 'human' ? '#1F1E1D' : (PHASE_META.acting.color),
                      }}
                    >
                      {m.agentId === 'human' ? 'I' : m.agentName[0]}
                    </span>
                    <span className="engine-message-name">{m.agentName}</span>
                    <span className="mono engine-message-time">
                      {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="engine-message-content">
                    {m.content}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* ── Streaming indicator ── */}
            {streamingText && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="engine-message engine-streaming"
              >
                <div className="engine-message-content">{streamingText}</div>
              </motion.div>
            )}

            {/* ── Reflections sidebar ── */}
            {reflections.length > 0 && !isRunning && messages.length > 0 && (
              <div className="engine-reflections">
                <div className="mono engine-reflections-title">Engine Reflections</div>
                {reflections.slice(-3).map((r, i) => (
                  <div key={i} className="engine-reflection-card">
                    <div className="engine-reflection-quality">
                      <div
                        className="engine-reflection-bar"
                        style={{ width: `${r.quality * 100}%` }}
                      />
                    </div>
                    <div className="engine-reflection-lesson">{r.lesson}</div>
                    <div className="mono engine-reflection-meta">
                      {r.agentUsed} &middot; {r.durationMs}ms
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          /* ── Discussion Mode ── */
          <>
            {messages.length === 0 && !isRunning && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="engine-intro"
              >
                <h1 className="engine-title">Discussion Mode</h1>
                <p className="engine-subtitle">
                  Three minds, one topic. Watch them think together.
                </p>
                <div className="engine-discuss-start">
                  <input
                    type="text"
                    value={topicInput}
                    onChange={(e) => setTopicInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleStartDiscussion()}
                    placeholder="Enter a topic..."
                    className="engine-topic-input"
                  />
                  <button
                    onClick={handleStartDiscussion}
                    disabled={!topicInput.trim()}
                    className="engine-discuss-btn"
                  >
                    Begin
                  </button>
                </div>
              </motion.div>
            )}

            <AnimatePresence initial={false}>
              {messages.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="engine-message"
                >
                  <div className="engine-message-header">
                    <span
                      className="engine-message-avatar"
                      style={{
                        backgroundColor: m.agentId === 'human' ? '#1F1E1D' : '#8B7355',
                      }}
                    >
                      {m.agentId === 'human' ? 'I' : m.agentName[0]}
                    </span>
                    <span className="engine-message-name">{m.agentName}</span>
                    <span className="mono engine-message-time">
                      {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className={`engine-message-content ${m.agentId !== 'human' ? 'italic' : ''}`}>
                    {m.content}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {streamingText && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="engine-message engine-streaming"
              >
                <div className="engine-message-content italic">{streamingText}</div>
              </motion.div>
            )}
          </>
        )}
      </div>

      {/* ── Input Footer ── */}
      <footer className="engine-footer">
        <div className="engine-input-row">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit()
              }
            }}
            placeholder={mode === 'engine' ? 'Ask the engine anything...' : 'Inject a thought...'}
            className="engine-input"
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isRunning}
            className="engine-send-btn"
          >
            <Send size={18} />
          </button>
        </div>
        <div className="mono engine-input-hint">
          {mode === 'engine'
            ? 'The engine will perceive, think, decide, act, and reflect.'
            : 'Press Enter to inject your thought into the discussion.'}
        </div>
      </footer>
    </>
  )
}
