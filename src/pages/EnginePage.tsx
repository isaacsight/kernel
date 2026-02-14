import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Square, RotateCcw, Eye, Brain, Zap, MessageCircle,
  Sparkles, Focus, TrendingUp, TrendingDown, Minus, X,
} from 'lucide-react'
import { useAIEngine } from '../hooks/useAIEngine'
import type { CognitivePhase } from '../engine/AIEngine'

const PHASE_META: Record<CognitivePhase, { label: string; icon: typeof Eye; color: string }> = {
  idle:       { label: 'Resting',    icon: Eye,           color: '#8B7355' },
  perceiving: { label: 'Perceiving', icon: Eye,           color: '#5B7B8C' },
  attending:  { label: 'Attending',  icon: Focus,         color: '#7B68EE' },
  thinking:   { label: 'Thinking',   icon: Brain,         color: '#6366F1' },
  deciding:   { label: 'Deciding',   icon: Zap,           color: '#E07B53' },
  acting:     { label: 'Speaking',   icon: MessageCircle, color: '#4A9B7F' },
  reflecting: { label: 'Reflecting', icon: Sparkles,      color: '#8C5B5B' },
}

const SCORE_LABELS: Record<string, string> = {
  substance: 'Substance',
  coherence: 'Coherence',
  relevance: 'Relevance',
  brevity: 'Brevity',
  craft: 'Craft',
}

export function EnginePage() {
  const {
    phase, messages, turnCount, cycleCount, isRunning,
    totalInteractions, reflections, topicHistory,
    thinkingSteps, streamingText,
    perception, attention,
    beliefs, conviction, convictionTrend,
    patternNotes, agentPerformance,
    perceive, startDiscussion, injectMessage,
    addBelief, challengeBelief, stop, reset,
  } = useAIEngine()

  const [input, setInput] = useState('')
  const [mode, setMode] = useState<'engine' | 'discuss' | 'world'>('engine')
  const [topicInput, setTopicInput] = useState('')
  const [beliefInput, setBeliefInput] = useState('')
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

  const handleAddBelief = () => {
    if (!beliefInput.trim()) return
    addBelief(beliefInput, 0.7)
    setBeliefInput('')
  }

  const phaseMeta = PHASE_META[phase]
  const PhaseIcon = phaseMeta.icon
  const TrendIcon = convictionTrend === 'rising' ? TrendingUp
    : convictionTrend === 'falling' ? TrendingDown
    : Minus

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

          {/* Conviction Meter */}
          <div className="engine-conviction" title={`Conviction: ${(conviction * 100).toFixed(0)}%`}>
            <div className="engine-conviction-bar">
              <motion.div
                className="engine-conviction-fill"
                animate={{ width: `${conviction * 100}%` }}
                transition={{ duration: 0.6 }}
              />
            </div>
            <TrendIcon size={10} style={{ opacity: 0.4 }} />
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
        {(['engine', 'discuss', 'world'] as const).map((m) => (
          <button
            key={m}
            className={`engine-mode-tab ${mode === m ? 'active' : ''}`}
            onClick={() => setMode(m)}
          >
            {m === 'engine' ? 'Cognitive Loop' : m === 'discuss' ? 'Discussion' : 'World Model'}
          </button>
        ))}
      </div>

      {/* ── Main Content ── */}
      <div className="engine-body" ref={scrollRef}>

        {/* ═══ COGNITIVE LOOP MODE ═══ */}
        {mode === 'engine' && (
          <>
            {messages.length === 0 && !isRunning && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="engine-intro"
              >
                <h1 className="engine-title">The Antigravity Kernel</h1>
                <p className="engine-subtitle">
                  A cognitive architecture. Six phases. Three memory layers.
                  <br />
                  One world model that updates with every cycle.
                </p>

                {/* Phase Diagram */}
                <div className="engine-diagram">
                  {(['perceiving', 'attending', 'thinking', 'deciding', 'acting', 'reflecting'] as CognitivePhase[]).map((p, i) => {
                    const meta = PHASE_META[p]
                    const Icon = meta.icon
                    return (
                      <div key={p} className="engine-diagram-node">
                        <div className="engine-diagram-circle" style={{ borderColor: meta.color }}>
                          <Icon size={18} style={{ color: meta.color }} />
                        </div>
                        <span className="mono engine-diagram-label">{meta.label}</span>
                        {i < 5 && <span className="engine-diagram-arrow">&rarr;</span>}
                      </div>
                    )
                  })}
                </div>

                {/* Memory Layers */}
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

            {/* Live Perception */}
            {perception && isRunning && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="engine-perception-card"
              >
                <div className="mono engine-perception-title">Perception</div>
                <div className="engine-perception-grid">
                  <div className="engine-perception-item">
                    <span className="engine-perception-label">Intent</span>
                    <span className="engine-perception-value">{perception.intent.type}</span>
                  </div>
                  <div className="engine-perception-item">
                    <span className="engine-perception-label">Urgency</span>
                    <span className="engine-perception-value">{(perception.urgency * 100).toFixed(0)}%</span>
                  </div>
                  <div className="engine-perception-item">
                    <span className="engine-perception-label">Complexity</span>
                    <span className="engine-perception-value">{(perception.complexity * 100).toFixed(0)}%</span>
                  </div>
                  <div className="engine-perception-item">
                    <span className="engine-perception-label">Sentiment</span>
                    <span className="engine-perception-value">
                      {perception.sentiment > 0.1 ? '+' : ''}{perception.sentiment.toFixed(2)}
                    </span>
                  </div>
                  <div className="engine-perception-item" style={{ gridColumn: '1 / -1' }}>
                    <span className="engine-perception-label">Implied Need</span>
                    <span className="engine-perception-value italic">{perception.impliedNeed}</span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Attention State */}
            {attention && isRunning && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="engine-attention-card"
              >
                <div className="mono engine-perception-title">Attention</div>
                <div className="engine-attention-focus">
                  <Focus size={14} style={{ opacity: 0.4 }} />
                  <span>{attention.primaryFocus}</span>
                </div>
                <div className="mono" style={{ fontSize: '0.6rem', opacity: 0.4, marginTop: 4 }}>
                  Depth: {attention.depth}
                </div>
                {Object.keys(attention.salience).length > 0 && (
                  <div className="engine-salience-list">
                    {Object.entries(attention.salience)
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 4)
                      .map(([entity, weight]) => (
                        <div key={entity} className="engine-salience-item">
                          <span>{entity}</span>
                          <div className="engine-salience-bar">
                            <div style={{ width: `${weight * 100}%` }} />
                          </div>
                        </div>
                      ))
                    }
                  </div>
                )}
              </motion.div>
            )}

            {/* Thinking Steps */}
            <AnimatePresence>
              {thinkingSteps.map((event, i) => (
                event.type === 'thinking_step' && (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="engine-thinking-step"
                  >
                    <div className="engine-thinking-type mono">{event.step.type}</div>
                    <div className="engine-thinking-text">{event.step.thought}</div>
                  </motion.div>
                )
              ))}
            </AnimatePresence>

            {/* Messages */}
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
                      style={{ backgroundColor: m.agentId === 'human' ? '#1F1E1D' : PHASE_META.acting.color }}
                    >
                      {m.agentId === 'human' ? 'I' : m.agentName[0]}
                    </span>
                    <span className="engine-message-name">{m.agentName}</span>
                    <span className="mono engine-message-time">
                      {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="engine-message-content">{m.content}</div>
                </motion.div>
              ))}
            </AnimatePresence>

            {streamingText && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="engine-message engine-streaming">
                <div className="engine-message-content">{streamingText}</div>
              </motion.div>
            )}

            {/* Reflections */}
            {reflections.length > 0 && !isRunning && messages.length > 0 && (
              <div className="engine-reflections">
                <div className="mono engine-reflections-title">Engine Reflections</div>
                {reflections.slice(-3).map((r, i) => (
                  <div key={i} className="engine-reflection-card">
                    <div className="engine-reflection-scores">
                      {r.scores && Object.entries(r.scores).map(([key, value]) => (
                        <div key={key} className="engine-score-row">
                          <span className="engine-score-label mono">{SCORE_LABELS[key] || key}</span>
                          <div className="engine-reflection-quality">
                            <div className="engine-reflection-bar" style={{ width: `${value * 100}%` }} />
                          </div>
                          <span className="engine-score-value mono">{(value * 100).toFixed(0)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="engine-reflection-lesson">{r.lesson}</div>
                    <div className="mono engine-reflection-meta">
                      {r.agentUsed} &middot; {r.durationMs}ms &middot; quality {(r.quality * 100).toFixed(0)}%
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ═══ DISCUSSION MODE ═══ */}
        {mode === 'discuss' && (
          <>
            {messages.length === 0 && !isRunning && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="engine-intro">
                <h1 className="engine-title">Discussion Mode</h1>
                <p className="engine-subtitle">Three minds, one topic. Watch them think together.</p>
                <div className="engine-discuss-start">
                  <input
                    type="text" value={topicInput}
                    onChange={(e) => setTopicInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleStartDiscussion()}
                    placeholder="Enter a topic..."
                    className="engine-topic-input"
                  />
                  <button onClick={handleStartDiscussion} disabled={!topicInput.trim()} className="engine-discuss-btn">
                    Begin
                  </button>
                </div>
              </motion.div>
            )}

            <AnimatePresence initial={false}>
              {messages.map((m) => (
                <motion.div key={m.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="engine-message">
                  <div className="engine-message-header">
                    <span className="engine-message-avatar" style={{ backgroundColor: m.agentId === 'human' ? '#1F1E1D' : '#8B7355' }}>
                      {m.agentId === 'human' ? 'I' : m.agentName[0]}
                    </span>
                    <span className="engine-message-name">{m.agentName}</span>
                    <span className="mono engine-message-time">
                      {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className={`engine-message-content ${m.agentId !== 'human' ? 'italic' : ''}`}>{m.content}</div>
                </motion.div>
              ))}
            </AnimatePresence>

            {streamingText && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="engine-message engine-streaming">
                <div className="engine-message-content italic">{streamingText}</div>
              </motion.div>
            )}
          </>
        )}

        {/* ═══ WORLD MODEL MODE ═══ */}
        {mode === 'world' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="engine-intro" style={{ textAlign: 'left', maxWidth: '100%' }}>
              <h1 className="engine-title" style={{ textAlign: 'center' }}>World Model</h1>
              <p className="engine-subtitle" style={{ textAlign: 'center' }}>
                What the engine believes. How sure it is. What it has learned.
              </p>

              {/* Conviction */}
              <div className="engine-world-section">
                <div className="mono engine-world-label">Conviction</div>
                <div className="engine-conviction-large">
                  <div className="engine-conviction-large-bar">
                    <motion.div
                      className="engine-conviction-large-fill"
                      animate={{ width: `${conviction * 100}%` }}
                      transition={{ duration: 0.8 }}
                    />
                  </div>
                  <div className="engine-conviction-large-meta">
                    <span>{(conviction * 100).toFixed(0)}%</span>
                    <span className="engine-conviction-trend">
                      <TrendIcon size={14} />
                      {convictionTrend}
                    </span>
                  </div>
                </div>
              </div>

              {/* Beliefs */}
              <div className="engine-world-section">
                <div className="mono engine-world-label">
                  Beliefs ({beliefs.length})
                </div>
                {beliefs.length === 0 ? (
                  <div className="engine-world-empty">No beliefs formed yet. Start a conversation.</div>
                ) : (
                  <div className="engine-beliefs-list">
                    {beliefs.map((b) => (
                      <div key={b.id} className="engine-belief-card">
                        <div className="engine-belief-content">{b.content}</div>
                        <div className="engine-belief-meta">
                          <div className="engine-belief-confidence">
                            <div className="engine-belief-confidence-bar">
                              <div style={{ width: `${b.confidence * 100}%` }} />
                            </div>
                            <span className="mono">{(b.confidence * 100).toFixed(0)}%</span>
                          </div>
                          <span className="mono">{b.source}</span>
                          <span className="mono">+{b.reinforcedCount} -{b.challengedCount}</span>
                          <button
                            className="engine-belief-challenge"
                            onClick={() => challengeBelief(b.id)}
                            title="Challenge this belief"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="engine-belief-add">
                  <input
                    type="text" value={beliefInput}
                    onChange={(e) => setBeliefInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddBelief()}
                    placeholder="Teach the engine something..."
                    className="engine-topic-input"
                  />
                  <button onClick={handleAddBelief} disabled={!beliefInput.trim()} className="engine-discuss-btn">
                    Add
                  </button>
                </div>
              </div>

              {/* Agent Performance */}
              {Object.keys(agentPerformance).length > 0 && (
                <div className="engine-world-section">
                  <div className="mono engine-world-label">Agent Performance</div>
                  <div className="engine-agent-perf">
                    {Object.entries(agentPerformance)
                      .sort(([, a], [, b]) => b.avgQuality - a.avgQuality)
                      .map(([id, data]) => (
                        <div key={id} className="engine-agent-perf-row">
                          <span className="engine-agent-perf-name">{id}</span>
                          <div className="engine-agent-perf-bar">
                            <div style={{ width: `${data.avgQuality * 100}%` }} />
                          </div>
                          <span className="mono engine-agent-perf-stat">
                            {(data.avgQuality * 100).toFixed(0)}% / {data.uses} uses
                          </span>
                        </div>
                      ))
                    }
                  </div>
                </div>
              )}

              {/* Pattern Notes */}
              {patternNotes.length > 0 && (
                <div className="engine-world-section">
                  <div className="mono engine-world-label">Pattern Notes</div>
                  {patternNotes.slice(-5).map((note, i) => (
                    <div key={i} className="engine-pattern-note">{note}</div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>

      {/* ── Input Footer ── */}
      {mode !== 'world' && (
        <footer className="engine-footer">
          <div className="engine-input-row">
            <input
              type="text" value={input}
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
            <button onClick={handleSubmit} disabled={!input.trim() || isRunning} className="engine-send-btn">
              <Send size={18} />
            </button>
          </div>
          <div className="mono engine-input-hint">
            {mode === 'engine'
              ? 'Perceive \u2192 Attend \u2192 Think \u2192 Decide \u2192 Act \u2192 Reflect'
              : 'Press Enter to inject your thought into the discussion.'}
          </div>
        </footer>
      )}
    </>
  )
}
