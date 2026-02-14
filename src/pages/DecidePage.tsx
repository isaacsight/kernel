import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'

const ease = [0.16, 1, 0.3, 1]

const STAKES_OPTIONS = ['Low', 'Medium', 'High', 'Life-changing'] as const
type Stakes = typeof STAKES_OPTIONS[number]

interface OptionScore {
  option: string
  scores: { upside: number; risk: number; effort: number; alignment: number }
  reasoning: string
}

interface DecisionAnalysis {
  recommendation: string
  confidence: number
  options: OptionScore[]
  narrative: string
}

interface ChatMessage {
  id: string
  role: 'user' | 'ai'
  content: string
}

export function DecidePage() {
  // Phase 1: Structured Input
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [stakes, setStakes] = useState<Stakes>('Medium')

  // Phase 2: Results + Chat
  const [analysis, setAnalysis] = useState<DecisionAnalysis | null>(null)
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [error, setError] = useState('')

  // Chat
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const validOptions = options.filter(o => o.trim())
  const canEvaluate = question.trim() && validOptions.length >= 2

  const addOption = () => {
    if (options.length < 6) setOptions([...options, ''])
  }

  const removeOption = (index: number) => {
    if (options.length > 2) setOptions(options.filter((_, i) => i !== index))
  }

  const updateOption = (index: number, value: string) => {
    const updated = [...options]
    updated[index] = value
    setOptions(updated)
  }

  const handleEvaluate = async () => {
    if (!canEvaluate || isEvaluating) return
    setIsEvaluating(true)
    setError('')
    setAnalysis(null)
    setMessages([])

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY
      if (!apiKey) throw new Error('No API key configured')

      const { GoogleGenerativeAI } = await import('@google/generative-ai')
      const genAI = new GoogleGenerativeAI(apiKey)
      const model = genAI.getGenerativeModel({
        model: import.meta.env.VITE_GEMINI_MODEL_PRO || 'gemini-2.5-pro'
      })

      const numberedOptions = validOptions.map((o, i) => `${i + 1}. ${o.trim()}`).join('\n')

      const prompt = `You are a sharp, experienced decision advisor. You think clearly under uncertainty.

DECISION: "${question.trim()}"
OPTIONS:
${numberedOptions}
STAKES: ${stakes}

Respond ONLY with JSON (no markdown fences):
{
  "recommendation": "<which option and why in 1 sentence>",
  "confidence": <50-95>,
  "options": [
    {
      "option": "<name>",
      "scores": { "upside": <0-100>, "risk": <0-100>, "effort": <0-100>, "alignment": <0-100> },
      "reasoning": "<1-2 sentences>"
    }
  ],
  "narrative": "<3-4 paragraph honest, gut-level analysis>"
}`

      const result = await model.generateContent(prompt)
      const text = result.response.text()

      const jsonMatch = text.match(/\{[\s\S]*\}/)?.[0]
      if (!jsonMatch) throw new Error('Failed to parse response')

      const data: DecisionAnalysis = JSON.parse(jsonMatch)
      data.confidence = Math.max(50, Math.min(95, data.confidence))
      data.options = data.options.map(opt => ({
        ...opt,
        scores: {
          upside: Math.max(0, Math.min(100, opt.scores.upside)),
          risk: Math.max(0, Math.min(100, opt.scores.risk)),
          effort: Math.max(0, Math.min(100, opt.scores.effort)),
          alignment: Math.max(0, Math.min(100, opt.scores.alignment)),
        }
      }))

      setAnalysis(data)
    } catch (err) {
      console.error('Decision evaluation failed:', err)
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsEvaluating(false)
    }
  }

  const handleChatSend = async () => {
    const content = chatInput.trim()
    if (!content || isStreaming || !analysis) return

    const userMsg: ChatMessage = { id: `user_${Date.now()}`, role: 'user', content }
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setChatInput('')
    setIsStreaming(true)

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY
      if (!apiKey) throw new Error('No API key')

      const { GoogleGenerativeAI } = await import('@google/generative-ai')
      const genAI = new GoogleGenerativeAI(apiKey)
      const model = genAI.getGenerativeModel({
        model: import.meta.env.VITE_GEMINI_MODEL_PRO || 'gemini-2.5-pro'
      })

      const numberedOptions = validOptions.map((o, i) => `${i + 1}. ${o.trim()}`).join('\n')

      const systemContext = `You are a sharp decision advisor continuing a conversation. Be direct and insightful. No fluff.

ORIGINAL DECISION: "${question.trim()}"
OPTIONS:
${numberedOptions}
STAKES: ${stakes}

YOUR INITIAL ANALYSIS:
Recommendation: ${analysis.recommendation}
Confidence: ${analysis.confidence}%
${analysis.options.map(o => `- ${o.option}: Upside ${o.scores.upside}, Risk ${o.scores.risk}, Effort ${o.scores.effort}, Alignment ${o.scores.alignment}. ${o.reasoning}`).join('\n')}

Respond naturally in prose. Be honest and specific.`

      const recentHistory = updatedMessages.slice(-10)
      const chatHistory = recentHistory.map(m => ({
        role: m.role === 'user' ? 'user' as const : 'model' as const,
        parts: [{ text: m.content }],
      }))

      const contents = [
        { role: 'user' as const, parts: [{ text: systemContext }] },
        { role: 'model' as const, parts: [{ text: 'Understood. I have full context on the decision and my analysis. What would you like to explore?' }] },
        ...chatHistory,
      ]

      const aiMsgId = `ai_${Date.now()}`
      setMessages(prev => [...prev, { id: aiMsgId, role: 'ai', content: '' }])

      const result = await model.generateContentStream({ contents })
      let accumulated = ''

      for await (const chunk of result.stream) {
        const text = chunk.text()
        accumulated += text
        setMessages(prev =>
          prev.map(m => m.id === aiMsgId ? { ...m, content: accumulated } : m)
        )
      }

      if (!accumulated.trim()) {
        setMessages(prev =>
          prev.map(m => m.id === aiMsgId ? { ...m, content: 'I couldn\'t generate a response. Try rephrasing your question.' } : m)
        )
      }
    } catch (err) {
      console.error('Chat failed:', err)
      setMessages(prev => [...prev, {
        id: `err_${Date.now()}`,
        role: 'ai',
        content: 'Something went wrong. Try again.',
      }])
    } finally {
      setIsStreaming(false)
    }
  }

  const handleChatKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleChatSend()
    }
  }

  const handleReset = () => {
    setQuestion('')
    setOptions(['', ''])
    setStakes('Medium')
    setAnalysis(null)
    setError('')
    setMessages([])
    setChatInput('')
  }

  const scoreBarColor = (label: string) => {
    switch (label) {
      case 'upside': return '#4A7C59'
      case 'risk': return '#B85C38'
      case 'effort': return '#8B7355'
      case 'alignment': return '#5B6E8C'
      default: return 'var(--rubin-slate)'
    }
  }

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '4rem 2rem 6rem' }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease }}
          style={{ marginBottom: '3rem' }}
        >
          <Link to="/" className="mono" style={{
            fontSize: '0.65rem', color: 'var(--rubin-accent)', textDecoration: 'none', opacity: 0.7
          }}>
            &larr; back
          </Link>
          <div className="mono" style={{ opacity: 0.4, marginBottom: '0.75rem', marginTop: '1.5rem', fontSize: '0.7rem' }}>
            Decision Engine
          </div>
          <h1 style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '2.8rem',
            fontWeight: 400,
            letterSpacing: '0.02em',
            marginBottom: '1rem',
            lineHeight: 1.2,
          }}>
            /decide
          </h1>
          <p style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '1.1rem',
            opacity: 0.5,
            lineHeight: 1.7,
            maxWidth: '520px',
          }}>
            Frame your decision. Get a structured analysis. Then go deeper in conversation.
          </p>
        </motion.div>

        {/* Phase 1: Structured Input */}
        {!analysis && !isEvaluating && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease }}
          >
            {/* Question */}
            <div style={{ marginBottom: '2rem' }}>
              <label className="mono" style={{ fontSize: '0.65rem', opacity: 0.5, display: 'block', marginBottom: '0.5rem' }}>
                What decision are you facing?
              </label>
              <textarea
                value={question}
                onChange={e => setQuestion(e.target.value)}
                placeholder="Should I leave my job to start a company? Which tech stack should we use for the rebuild? Should I move to a new city?"
                rows={3}
                style={{
                  width: '100%',
                  fontFamily: 'var(--font-serif)',
                  fontSize: '1rem',
                  lineHeight: 1.7,
                  padding: '1.25rem',
                  border: '1px solid var(--rubin-ivory-dark)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--rubin-ivory)',
                  color: 'var(--rubin-slate)',
                  resize: 'vertical',
                  outline: 'none',
                  transition: 'border-color var(--duration-normal) var(--ease-out)',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--rubin-accent)'}
                onBlur={e => e.target.style.borderColor = 'var(--rubin-ivory-dark)'}
              />
            </div>

            {/* Options */}
            <div style={{ marginBottom: '2rem' }}>
              <label className="mono" style={{ fontSize: '0.65rem', opacity: 0.5, display: 'block', marginBottom: '0.5rem' }}>
                What are your options?
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {options.map((opt, i) => (
                  <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span className="mono" style={{ fontSize: '0.6rem', opacity: 0.3, width: '1.5rem', textAlign: 'right', flexShrink: 0 }}>
                      {i + 1}.
                    </span>
                    <input
                      type="text"
                      value={opt}
                      onChange={e => updateOption(i, e.target.value)}
                      placeholder={i === 0 ? 'e.g. Stay and negotiate a raise' : i === 1 ? 'e.g. Leave and start the company' : 'Another option...'}
                      style={{
                        flex: 1,
                        fontFamily: 'var(--font-serif)',
                        fontSize: '0.95rem',
                        padding: '0.75rem 1rem',
                        border: '1px solid var(--rubin-ivory-dark)',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--rubin-ivory)',
                        color: 'var(--rubin-slate)',
                        outline: 'none',
                        transition: 'border-color var(--duration-normal) var(--ease-out)',
                      }}
                      onFocus={e => e.target.style.borderColor = 'var(--rubin-accent)'}
                      onBlur={e => e.target.style.borderColor = 'var(--rubin-ivory-dark)'}
                    />
                    {options.length > 2 && (
                      <button
                        onClick={() => removeOption(i)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '1rem',
                          opacity: 0.25,
                          color: 'var(--rubin-slate)',
                          padding: '0.25rem',
                          transition: 'opacity var(--duration-fast)',
                        }}
                        onMouseEnter={e => e.currentTarget.style.opacity = '0.6'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '0.25'}
                      >
                        &times;
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {options.length < 6 && (
                <button
                  onClick={addOption}
                  className="mono"
                  style={{
                    marginTop: '0.5rem',
                    fontSize: '0.6rem',
                    padding: '0.35rem 0.75rem',
                    background: 'transparent',
                    border: '1px dashed var(--rubin-ivory-dark)',
                    borderRadius: 'var(--radius-full)',
                    color: 'var(--rubin-slate)',
                    opacity: 0.4,
                    cursor: 'pointer',
                    transition: 'opacity var(--duration-fast)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '0.4'}
                >
                  + add option
                </button>
              )}
            </div>

            {/* Stakes */}
            <div style={{ marginBottom: '2rem' }}>
              <label className="mono" style={{ fontSize: '0.65rem', opacity: 0.5, display: 'block', marginBottom: '0.5rem' }}>
                What's at stake?
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {STAKES_OPTIONS.map(level => (
                  <button
                    key={level}
                    onClick={() => setStakes(level)}
                    className="mono"
                    style={{
                      fontSize: '0.65rem',
                      padding: '0.4rem 0.8rem',
                      border: '1px solid',
                      borderColor: stakes === level ? 'var(--rubin-slate)' : 'var(--rubin-ivory-dark)',
                      borderRadius: 'var(--radius-full)',
                      background: stakes === level ? 'var(--rubin-slate)' : 'transparent',
                      color: stakes === level ? 'var(--rubin-ivory)' : 'var(--rubin-slate)',
                      cursor: 'pointer',
                      transition: 'all var(--duration-fast) var(--ease-out)',
                      opacity: stakes === level ? 1 : 0.5,
                    }}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            {/* Evaluate Button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button
                onClick={handleEvaluate}
                disabled={!canEvaluate}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  padding: '0.75rem 2rem',
                  background: canEvaluate ? 'var(--rubin-slate)' : 'var(--rubin-ivory-dark)',
                  color: canEvaluate ? 'var(--rubin-ivory)' : 'var(--rubin-slate)',
                  border: 'none',
                  borderRadius: 'var(--radius-full)',
                  cursor: canEvaluate ? 'pointer' : 'default',
                  transition: 'all var(--duration-normal) var(--ease-out)',
                  opacity: canEvaluate ? 1 : 0.4,
                }}
              >
                Evaluate
              </button>
            </div>

            {/* Error */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  marginTop: '1.5rem',
                  padding: '1rem 1.25rem',
                  background: '#fef2f2',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid #fecaca',
                }}
              >
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: '0.9rem', color: '#991b1b', marginBottom: '0.5rem' }}>
                  {error}
                </div>
                <button
                  onClick={handleEvaluate}
                  className="mono"
                  style={{
                    fontSize: '0.6rem',
                    padding: '0.35rem 0.75rem',
                    background: '#991b1b',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 'var(--radius-full)',
                    cursor: 'pointer',
                  }}
                >
                  Retry
                </button>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Loading State */}
        {isEvaluating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ textAlign: 'center', padding: '4rem 0' }}
          >
            <div style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '1.1rem',
              opacity: 0.6,
              marginBottom: '1rem',
            }}>
              Thinking through your decision...
            </div>
            <motion.div
              animate={{ opacity: [0.3, 0.8, 0.3] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                width: '40px',
                height: '2px',
                background: 'var(--rubin-slate)',
                margin: '0 auto',
                borderRadius: '1px',
              }}
            />
          </motion.div>
        )}

        {/* Phase 2: Results */}
        <AnimatePresence mode="wait">
          {analysis && !isEvaluating && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.6, ease }}
            >
              {/* Verdict Card */}
              <div style={{
                padding: '1.5rem',
                background: 'var(--rubin-ivory-med)',
                borderRadius: 'var(--radius-md)',
                marginBottom: '2rem',
              }}>
                <div className="mono" style={{ fontSize: '0.6rem', opacity: 0.4, marginBottom: '0.75rem' }}>
                  VERDICT
                </div>
                <div style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '1.15rem',
                  lineHeight: 1.6,
                  marginBottom: '0.75rem',
                  color: 'var(--rubin-slate)',
                }}>
                  {analysis.recommendation}
                </div>
                <div className="mono" style={{ fontSize: '0.65rem', opacity: 0.5 }}>
                  Confidence: {analysis.confidence}%
                </div>
              </div>

              {/* Option Breakdown */}
              <div style={{ marginBottom: '2.5rem' }}>
                <div className="mono" style={{ fontSize: '0.65rem', opacity: 0.4, marginBottom: '1.25rem' }}>
                  OPTION BREAKDOWN
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {analysis.options.map((opt, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 * i, duration: 0.4, ease }}
                      style={{
                        padding: '1.25rem',
                        border: '1px solid var(--rubin-ivory-dark)',
                        borderRadius: 'var(--radius-md)',
                      }}
                    >
                      <div style={{
                        fontFamily: 'var(--font-serif)',
                        fontSize: '1.05rem',
                        marginBottom: '0.75rem',
                        color: 'var(--rubin-slate)',
                      }}>
                        {opt.option}
                      </div>

                      {/* Score Bars */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        {(Object.entries(opt.scores) as [string, number][]).map(([label, value]) => (
                          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span className="mono" style={{
                              fontSize: '0.55rem',
                              opacity: 0.5,
                              width: '60px',
                              textTransform: 'capitalize',
                              flexShrink: 0,
                            }}>
                              {label}
                            </span>
                            <div style={{
                              flex: 1,
                              height: '4px',
                              background: 'var(--rubin-ivory-dark)',
                              borderRadius: '2px',
                              overflow: 'hidden',
                            }}>
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${value}%` }}
                                transition={{ duration: 0.8, delay: 0.2 + i * 0.1, ease }}
                                style={{
                                  height: '100%',
                                  background: scoreBarColor(label),
                                  borderRadius: '2px',
                                }}
                              />
                            </div>
                            <span className="mono" style={{ fontSize: '0.55rem', opacity: 0.4, width: '24px', textAlign: 'right', flexShrink: 0 }}>
                              {value}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div style={{
                        fontFamily: 'var(--font-serif)',
                        fontSize: '0.9rem',
                        lineHeight: 1.6,
                        opacity: 0.7,
                      }}>
                        {opt.reasoning}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Narrative */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3, ease }}
                style={{ marginBottom: '2.5rem' }}
              >
                <div className="mono" style={{ fontSize: '0.65rem', opacity: 0.4, marginBottom: '1rem' }}>
                  THE HONEST TAKE
                </div>
                <div style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '1rem',
                  lineHeight: 1.8,
                  opacity: 0.85,
                }}>
                  {analysis.narrative.split('\n\n').map((paragraph, i) => (
                    <p key={i} style={{ marginBottom: '1.25rem' }}>
                      {paragraph}
                    </p>
                  ))}
                </div>
              </motion.div>

              {/* Start Over */}
              <button
                onClick={handleReset}
                className="mono"
                style={{
                  fontSize: '0.65rem',
                  padding: '0.5rem 1rem',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--rubin-slate)',
                  opacity: 0.4,
                  cursor: 'pointer',
                  transition: 'opacity var(--duration-fast)',
                  marginBottom: '3rem',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                onMouseLeave={e => e.currentTarget.style.opacity = '0.4'}
              >
                Start Over
              </button>

              {/* Chat Section */}
              <div style={{
                borderTop: '1px solid var(--rubin-ivory-dark)',
                paddingTop: '2rem',
              }}>
                <div className="mono" style={{ fontSize: '0.65rem', opacity: 0.4, marginBottom: '1.25rem' }}>
                  GO DEEPER
                </div>

                {/* Chat Messages */}
                {messages.length > 0 && (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.25rem',
                    marginBottom: '1.5rem',
                  }}>
                    <AnimatePresence initial={false}>
                      {messages.map((msg) => (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, ease }}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                          }}
                        >
                          {msg.role === 'ai' && (
                            <div className="mono" style={{ fontSize: '0.6rem', opacity: 0.35, marginBottom: '0.35rem', marginLeft: '0.25rem' }}>
                              ADVISOR
                            </div>
                          )}
                          <div style={{
                            maxWidth: '580px',
                            padding: '1rem 1.25rem',
                            borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                            background: msg.role === 'user' ? 'var(--rubin-slate)' : 'var(--rubin-ivory-med)',
                            color: msg.role === 'user' ? 'var(--rubin-ivory)' : 'var(--rubin-slate)',
                            fontFamily: 'var(--font-serif)',
                            fontSize: '0.95rem',
                            lineHeight: 1.65,
                            whiteSpace: 'pre-wrap',
                          }}>
                            {msg.content}
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>

                    {/* Typing indicator */}
                    <AnimatePresence>
                      {isStreaming && messages[messages.length - 1]?.role === 'user' && (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                        >
                          <div className="mono" style={{ fontSize: '0.6rem', opacity: 0.35 }}>ADVISOR</div>
                          <div style={{
                            display: 'flex',
                            gap: '4px',
                            padding: '0.75rem 1rem',
                            background: 'var(--rubin-ivory-med)',
                            borderRadius: '16px 16px 16px 4px',
                          }}>
                            {[0, 1, 2].map(i => (
                              <motion.div
                                key={i}
                                animate={{ opacity: [0.3, 1, 0.3] }}
                                transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                                style={{
                                  width: '6px',
                                  height: '6px',
                                  borderRadius: '50%',
                                  background: 'var(--rubin-slate)',
                                }}
                              />
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div ref={messagesEndRef} />
                  </div>
                )}

                {/* Chat Input */}
                <div style={{
                  display: 'flex',
                  gap: '0.75rem',
                  alignItems: 'flex-end',
                }}>
                  <textarea
                    ref={chatInputRef}
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={handleChatKeyDown}
                    placeholder="Ask anything about this decision..."
                    rows={1}
                    style={{
                      flex: 1,
                      padding: '0.85rem 1.25rem',
                      background: 'var(--rubin-ivory-med)',
                      border: 'none',
                      borderRadius: 'var(--radius-md)',
                      fontFamily: 'var(--font-serif)',
                      fontSize: '0.95rem',
                      color: 'var(--rubin-slate)',
                      outline: 'none',
                      resize: 'none',
                      minHeight: '44px',
                      maxHeight: '120px',
                    }}
                  />
                  <button
                    onClick={handleChatSend}
                    disabled={!chatInput.trim() || isStreaming}
                    className="mono"
                    style={{
                      padding: '0.85rem 1.5rem',
                      background: chatInput.trim() && !isStreaming ? 'var(--rubin-slate)' : 'var(--rubin-ivory-dark)',
                      color: chatInput.trim() && !isStreaming ? 'var(--rubin-ivory)' : 'var(--rubin-slate)',
                      border: 'none',
                      borderRadius: 'var(--radius-md)',
                      cursor: chatInput.trim() && !isStreaming ? 'pointer' : 'default',
                      fontSize: '0.75rem',
                      transition: 'all 0.2s ease',
                      opacity: chatInput.trim() && !isStreaming ? 1 : 0.4,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Send
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
