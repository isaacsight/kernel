import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSearchParams } from 'react-router-dom'
import { evaluationEngine, type Evaluation, type CategoryScore, type CategoryType } from '../engine/EvaluationEngine'
import { SectionWrapper } from '../components/claude-physics/SectionWrapper'
import { supabase } from '../engine/SupabaseClient'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''

const ALL_CATEGORIES: CategoryType[] = ['complexity', 'market_demand', 'risk', 'profitability', 'time_efficiency', 'innovation']

const DEFAULT_WEIGHTS: Record<CategoryType, number> = {
    complexity: 0.25,
    market_demand: 0.20,
    profitability: 0.20,
    risk: 0.15,
    time_efficiency: 0.10,
    innovation: 0.10,
}

const EVALUATION_PRICE = 5 // dollars

const GREETING = "I evaluate projects across six dimensions — complexity, demand, risk, profitability, speed, and innovation. Most people oversimplify at least two of these. Tell me what you're building and I'll tell you which ones you're probably not thinking about."

const CONVERSATION_CAP = 6
const SESSION_KEY = 'prototype_session_id'

interface ChatMessage {
    role: 'user' | 'assistant'
    content: string
    /** Full text including <evaluation> block — sent to API so Claude remembers its scores */
    apiContent?: string
}

function parseEvaluation(text: string): { narrative: string; cleanText: string; scores: CategoryScore[] } | null {
    const match = text.match(/<evaluation>([\s\S]*?)<\/evaluation>/)
    if (!match) return null

    try {
        const data = JSON.parse(match[1].trim())
        const cleanText = text.replace(/<evaluation>[\s\S]*?<\/evaluation>/, '').trim()

        const scores: CategoryScore[] = ALL_CATEGORIES.map(cat => {
            const found = data.categoryScores?.find((s: any) => s.category === cat)
            return {
                category: cat,
                score: Math.max(0, Math.min(100, found?.score ?? 50)),
                weight: DEFAULT_WEIGHTS[cat],
                reasoning: found?.reasoning ?? 'Baseline assessment',
                factors: found?.factors ?? [],
            }
        })

        return { narrative: data.narrative || '', cleanText, scores }
    } catch {
        return null
    }
}

function buildEvaluation(scores: CategoryScore[], description: string): Evaluation {
    const weightedScore = Math.round(
        scores.reduce((sum, cs) => sum + cs.score * cs.weight, 0)
    )
    const { multiplier, tier } = evaluationEngine.getPricingMultiplier(weightedScore)
    const totalFactors = scores.reduce((sum, cs) => sum + cs.factors.length, 0)
    const confidence = Math.min(0.95, 0.6 + totalFactors * 0.03)

    return {
        id: `eval_proto_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        entityId: `proto_${Date.now()}`,
        entityType: 'project',
        entityDescription: description,
        timestamp: new Date(),
        categoryScores: scores,
        weightedScore,
        tier,
        pricingMultiplier: multiplier,
        confidence,
    }
}

export function PrototypePage() {
    const [searchParams, setSearchParams] = useSearchParams()
    const [isPaid, setIsPaid] = useState(false)
    const [isCheckingOut, setIsCheckingOut] = useState(false)
    const [email, setEmail] = useState('')
    const [checkoutError, setCheckoutError] = useState('')

    const [messages, setMessages] = useState<ChatMessage[]>([
        { role: 'assistant', content: GREETING }
    ])
    const [input, setInput] = useState('')
    const [isStreaming, setIsStreaming] = useState(false)
    const [evaluation, setEvaluation] = useState<Evaluation | null>(null)
    const [aiNarrative, setAiNarrative] = useState('')
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    // Check for payment on mount
    useEffect(() => {
        const sessionId = searchParams.get('session_id')
        if (sessionId) {
            // Came back from Stripe — store and unlock
            sessionStorage.setItem(SESSION_KEY, sessionId)
            setIsPaid(true)
            // Clean the URL
            setSearchParams({}, { replace: true })
            return
        }

        // Check if already paid this session
        const stored = sessionStorage.getItem(SESSION_KEY)
        if (stored) {
            setIsPaid(true)
        }
    }, [searchParams, setSearchParams])

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [])

    useEffect(() => {
        scrollToBottom()
    }, [messages, scrollToBottom])

    const userMessageCount = messages.filter(m => m.role === 'user').length

    const getPlaceholder = () => {
        if (evaluation) return 'Ask a follow-up — dig deeper into any dimension...'
        if (userMessageCount === 0) return 'Describe what you\'re building...'
        if (userMessageCount === 1) return 'Answer the questions above...'
        return 'Continue the conversation...'
    }

    const handleCheckout = async () => {
        if (!email.trim() || isCheckingOut) return
        setIsCheckingOut(true)
        setCheckoutError('')

        try {
            const id = `eval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

            // Store email for the edge function to use for returning user detection
            sessionStorage.setItem('prototype_email', email.trim())

            const { data, error } = await supabase.functions.invoke('create-checkout', {
                body: {
                    inquiryId: id,
                    email: email.trim(),
                    name: '',
                    amount: EVALUATION_PRICE,
                    description: 'Intelligence Synthesis — Conversational Evaluation',
                    score: 0,
                    tier: 'evaluation',
                    quoteType: 'evaluation',
                    returnPath: '/prototype',
                },
            })

            if (error) throw error
            if (data?.url) {
                window.location.href = data.url
                return
            }
            throw new Error('No checkout URL returned')
        } catch (err) {
            console.error('Checkout failed:', err)
            setCheckoutError('Unable to create checkout. Try again.')
            setIsCheckingOut(false)
        }
    }

    // Stable conversation ID for this session
    const conversationIdRef = useRef(`eval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)

    // Retrieve email stored during checkout
    const storedEmail = sessionStorage.getItem('prototype_email') || ''

    const sendMessage = async () => {
        const text = input.trim()
        if (!text || isStreaming) return

        const userMessage: ChatMessage = { role: 'user', content: text }
        const updatedMessages = [...messages, userMessage]
        setMessages(updatedMessages)
        setInput('')
        setIsStreaming(true)

        try {
            // Build messages for the API (skip the static greeting)
            // Use apiContent when available so Claude sees its own evaluation scores
            const apiMessages = updatedMessages.slice(1).map(m => ({
                role: m.role,
                content: m.apiContent || m.content,
            }))

            // If at conversation cap and haven't evaluated yet, push for final evaluation
            const atCap = !evaluation && updatedMessages.filter(m => m.role === 'user').length >= CONVERSATION_CAP / 2
            if (atCap && apiMessages.length > 0) {
                const last = apiMessages[apiMessages.length - 1]
                last.content = `${last.content}\n\n[System note: You have enough context now. Deliver your final evaluation with the <evaluation> JSON block.]`
            }

            // Call the evaluate-chat edge function
            const response = await fetch(`${SUPABASE_URL}/functions/v1/evaluate-chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_KEY}`,
                },
                body: JSON.stringify({
                    messages: apiMessages,
                    conversationId: conversationIdRef.current,
                    email: storedEmail || undefined,
                }),
            })

            if (!response.ok) {
                const errBody = await response.text()
                throw new Error(`Edge function error ${response.status}: ${errBody}`)
            }

            // Parse Anthropic SSE stream
            const reader = response.body!.getReader()
            const decoder = new TextDecoder()
            let fullText = ''
            let buffer = ''

            setMessages(prev => [...prev, { role: 'assistant', content: '' }])

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''

                for (const line of lines) {
                    const trimmed = line.trim()
                    if (!trimmed || !trimmed.startsWith('data: ')) continue

                    const data = trimmed.slice(6)
                    if (data === '[DONE]') continue

                    try {
                        const parsed = JSON.parse(data)

                        // Anthropic SSE: content_block_delta events carry text
                        if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
                            fullText += parsed.delta.text
                            setMessages(prev => {
                                const next = [...prev]
                                next[next.length - 1] = { role: 'assistant', content: fullText }
                                return next
                            })
                        }
                    } catch {
                        // Skip malformed chunks
                    }
                }
            }

            const parsed = parseEvaluation(fullText)
            if (parsed) {
                // Store clean text for display, full text for API continuity
                setMessages(prev => {
                    const next = [...prev]
                    next[next.length - 1] = { role: 'assistant', content: parsed.cleanText, apiContent: fullText }
                    return next
                })

                const description = updatedMessages
                    .filter(m => m.role === 'user')
                    .map(m => m.content)
                    .join(' ')

                const eval_ = buildEvaluation(parsed.scores, description)
                setEvaluation(eval_)
                setAiNarrative(parsed.narrative)

                // Fire-and-forget: extract insights for the learning loop
                fetch(`${SUPABASE_URL}/functions/v1/extract-insights`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_KEY}`,
                    },
                    body: JSON.stringify({
                        conversationId: conversationIdRef.current,
                        messages: updatedMessages.slice(1).concat([{ role: 'assistant', content: parsed.cleanText }]),
                        evaluationResult: {
                            description,
                            tier: eval_.tier,
                            score: eval_.weightedScore,
                            categoryScores: eval_.categoryScores,
                            narrative: parsed.narrative,
                        },
                        email: storedEmail || undefined,
                    }),
                }).catch(e => console.error('Insight extraction failed:', e))
            }

            setIsStreaming(false)
        } catch (err) {
            console.error('AI conversation failed, falling back to heuristics:', err)

            const description = updatedMessages
                .filter(m => m.role === 'user')
                .map(m => m.content)
                .join(' ')

            const result = evaluationEngine.evaluate(
                `proto_${Date.now()}`,
                'project',
                { description }
            )

            setMessages(prev => {
                const next = [...prev]
                const fallbackMsg = "I wasn't able to complete the full analysis, but I've run the numbers through the evaluation engine. Here's what the data says."
                if (next[next.length - 1]?.role === 'assistant' && !next[next.length - 1].content) {
                    next[next.length - 1] = { role: 'assistant', content: fallbackMsg }
                } else {
                    next.push({ role: 'assistant', content: fallbackMsg })
                }
                return next
            })

            setEvaluation(result)
            setAiNarrative('')
            setIsStreaming(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            sendMessage()
        }
    }

    // ─── PAYWALL ───────────────────────────────────────────────
    if (!isPaid) {
        return (
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <SectionWrapper
                    label="Intelligence Synthesis"
                    title="Prototype"
                    subtitle="A conversational evaluation engine. Six dimensions. No shortcuts."
                >
                    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                        {/* Greeting as hook */}
                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                            style={{
                                fontFamily: 'var(--font-serif)',
                                fontSize: '0.95rem',
                                lineHeight: 1.8,
                                opacity: 0.85,
                                marginBottom: '2.5rem',
                            }}
                        >
                            <p>{GREETING}</p>
                        </motion.div>

                        {/* Paywall card */}
                        <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                            style={{
                                background: 'var(--rubin-ivory-med)',
                                borderRadius: 'var(--radius-md)',
                                padding: '2rem',
                            }}
                        >
                            <p style={{
                                fontFamily: 'var(--font-serif)',
                                fontSize: '1.1rem',
                                marginBottom: '0.5rem',
                            }}>
                                Unlock the evaluation
                            </p>
                            <p style={{
                                fontFamily: 'var(--font-serif)',
                                fontSize: '0.9rem',
                                opacity: 0.5,
                                lineHeight: 1.7,
                                marginBottom: '1.5rem',
                            }}>
                                A multi-turn conversation with an AI advisor that probes your idea across complexity, demand, risk, profitability, speed, and innovation. You get a scored evaluation and an honest take on whether it's worth building.
                            </p>

                            <div style={{
                                display: 'flex',
                                alignItems: 'baseline',
                                gap: '0.5rem',
                                marginBottom: '1.5rem',
                            }}>
                                <span style={{
                                    fontFamily: 'var(--font-serif)',
                                    fontSize: '2rem',
                                    fontWeight: 400,
                                    letterSpacing: '-0.02em',
                                }}>
                                    ${EVALUATION_PRICE}
                                </span>
                                <span className="mono" style={{ fontSize: '0.6rem', opacity: 0.4 }}>
                                    one-time
                                </span>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') handleCheckout() }}
                                    placeholder="Your email"
                                    style={{
                                        fontFamily: 'var(--font-serif)',
                                        fontSize: '0.95rem',
                                        padding: '0.75rem 1rem',
                                        border: '1px solid var(--rubin-ivory-dark)',
                                        borderRadius: 'var(--radius-sm)',
                                        background: 'var(--rubin-ivory)',
                                        color: 'var(--rubin-slate)',
                                        outline: 'none',
                                    }}
                                    onFocus={e => e.target.style.borderColor = 'var(--rubin-accent)'}
                                    onBlur={e => e.target.style.borderColor = 'var(--rubin-ivory-dark)'}
                                />
                                <button
                                    onClick={handleCheckout}
                                    disabled={!email.trim() || isCheckingOut}
                                    className="mono"
                                    style={{
                                        padding: '0.75rem 2rem',
                                        background: email.trim() && !isCheckingOut ? 'var(--rubin-slate)' : 'var(--rubin-ivory-dark)',
                                        color: email.trim() && !isCheckingOut ? 'var(--rubin-ivory)' : 'var(--rubin-slate)',
                                        border: 'none',
                                        borderRadius: 'var(--radius-full)',
                                        fontSize: '0.7rem',
                                        letterSpacing: '0.1em',
                                        textTransform: 'uppercase' as const,
                                        cursor: email.trim() && !isCheckingOut ? 'pointer' : 'default',
                                        opacity: email.trim() && !isCheckingOut ? 1 : 0.4,
                                        transition: 'all 0.3s ease',
                                        alignSelf: 'flex-start',
                                    }}
                                >
                                    {isCheckingOut ? 'Redirecting to checkout...' : `Start Evaluation — $${EVALUATION_PRICE}`}
                                </button>
                                {checkoutError && (
                                    <p style={{ fontFamily: 'var(--font-serif)', fontSize: '0.8rem', opacity: 0.6, color: '#b44' }}>
                                        {checkoutError}
                                    </p>
                                )}
                            </div>
                        </motion.div>
                    </div>
                </SectionWrapper>
            </div>
        )
    }

    // ─── CONVERSATION (paid) ──────────────────────────────────
    return (
        <div className="flex-1 overflow-y-auto custom-scrollbar">
            <SectionWrapper
                label="Intelligence Synthesis"
                title="Prototype"
                subtitle="A conversational evaluation. Describe your project and I'll probe, clarify, and score it across six dimensions."
            >
                <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>

                    {/* Chat Messages */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1.5rem' }}>
                        <AnimatePresence initial={false}>
                            {messages.map((msg, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                                    style={msg.role === 'user' ? {
                                        fontFamily: 'var(--font-mono)',
                                        fontSize: '0.8rem',
                                        lineHeight: 1.7,
                                        padding: '0.75rem 1rem',
                                        background: 'var(--rubin-ivory-med)',
                                        borderRadius: 'var(--radius-sm)',
                                    } : {
                                        fontFamily: 'var(--font-serif)',
                                        fontSize: '0.95rem',
                                        lineHeight: 1.8,
                                        opacity: 0.85,
                                    }}
                                >
                                    {msg.content.split('\n\n').map((paragraph, j) => (
                                        <p key={j} style={{ marginBottom: j < msg.content.split('\n\n').length - 1 ? '0.75rem' : 0 }}>
                                            {paragraph}
                                        </p>
                                    ))}
                                </motion.div>
                            ))}
                        </AnimatePresence>

                        {/* Streaming indicator */}
                        {isStreaming && messages[messages.length - 1]?.role === 'assistant' && messages[messages.length - 1]?.content === '' && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                style={{
                                    width: '20px',
                                    height: '2px',
                                    background: 'var(--rubin-slate)',
                                    opacity: 0.3,
                                    borderRadius: '1px',
                                    animation: 'pulse 1.5s ease-in-out infinite',
                                }}
                            />
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Evaluation Results */}
                    <AnimatePresence mode="wait">
                        {evaluation && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                                style={{
                                    background: 'var(--rubin-ivory-med)',
                                    borderRadius: 'var(--radius-md)',
                                    padding: '2rem',
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '1.5rem' }}>
                                    <div>
                                        <div className="mono" style={{ fontSize: '0.7rem', opacity: 0.4 }}>Resulting Tier</div>
                                        <div style={{ fontSize: '1.5rem', fontFamily: 'var(--font-serif)', color: evaluation.tier === 'platinum' ? 'var(--rubin-accent)' : 'inherit' }}>
                                            {evaluation.tier.charAt(0).toUpperCase() + evaluation.tier.slice(1)}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div className="mono" style={{ fontSize: '0.7rem', opacity: 0.4 }}>Unified Score</div>
                                        <div style={{ fontSize: '1.5rem', fontFamily: 'var(--font-mono)' }}>{evaluation.weightedScore}</div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                    {evaluation.categoryScores.map((cat, i) => (
                                        <motion.div
                                            key={cat.category}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.1 }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                                                <span className="mono" style={{ fontSize: '0.65rem', opacity: 0.6 }}>{cat.category.replace('_', ' ').toUpperCase()}</span>
                                                <span className="mono" style={{ fontSize: '0.65rem', opacity: 0.4 }}>{cat.score}%</span>
                                            </div>
                                            <div style={{ height: '3px', background: 'rgba(0,0,0,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${cat.score}%` }}
                                                    transition={{ duration: 1, delay: 0.5 + i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                                                    style={{ height: '100%', background: 'var(--rubin-accent)', borderRadius: '2px' }}
                                                />
                                            </div>
                                            <p style={{ fontSize: '0.85rem', opacity: 0.5, fontStyle: 'italic', marginTop: '0.4rem' }}>
                                                {cat.reasoning}
                                            </p>
                                        </motion.div>
                                    ))}
                                </div>

                                {aiNarrative && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.5, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                                        style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(0,0,0,0.05)' }}
                                    >
                                        <div className="mono" style={{ fontSize: '0.65rem', opacity: 0.4, marginBottom: '0.75rem' }}>
                                            Final Take
                                        </div>
                                        <div style={{
                                            fontFamily: 'var(--font-serif)',
                                            fontSize: '0.95rem',
                                            lineHeight: 1.8,
                                            opacity: 0.75,
                                        }}>
                                            {aiNarrative.split('\n\n').map((paragraph, i) => (
                                                <p key={i} style={{ marginBottom: '1rem' }}>
                                                    {paragraph}
                                                </p>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}

                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 1.2 }}
                                    style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(0,0,0,0.05)', textAlign: 'center' }}
                                >
                                    <p style={{ fontFamily: 'var(--font-serif)', fontSize: '0.85rem', opacity: 0.5, lineHeight: 1.7 }}>
                                        The evaluation is in. Now we can talk about it — ask me to dig into any score, challenge my reasoning, or explore what to do next.
                                    </p>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Input — always visible, conversation continues after evaluation */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        style={{
                            position: 'sticky',
                            bottom: '1rem',
                            background: 'var(--rubin-ivory)',
                            paddingTop: '0.75rem',
                        }}
                    >
                        <div style={{
                            display: 'flex',
                            gap: '0.5rem',
                            alignItems: 'center',
                        }}>
                            <input
                                ref={inputRef}
                                type="text"
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={getPlaceholder()}
                                disabled={isStreaming}
                                style={{
                                    flex: 1,
                                    fontFamily: 'var(--font-serif)',
                                    fontSize: '0.95rem',
                                    padding: '0.85rem 1.25rem',
                                    background: 'var(--rubin-ivory-med)',
                                    border: 'none',
                                    borderRadius: 'var(--radius-full)',
                                    color: 'var(--rubin-slate)',
                                    outline: 'none',
                                    opacity: isStreaming ? 0.5 : 1,
                                    transition: 'opacity 0.3s ease',
                                }}
                            />
                            <button
                                onClick={sendMessage}
                                disabled={isStreaming || !input.trim()}
                                className="mono"
                                style={{
                                    padding: '0.85rem 1.25rem',
                                    background: 'var(--rubin-slate)',
                                    color: 'var(--rubin-ivory)',
                                    border: 'none',
                                    borderRadius: 'var(--radius-full)',
                                    fontSize: '0.7rem',
                                    cursor: (isStreaming || !input.trim()) ? 'default' : 'pointer',
                                    opacity: (isStreaming || !input.trim()) ? 0.3 : 1,
                                    transition: 'opacity 0.3s ease',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                ↵
                            </button>
                        </div>
                    </motion.div>
                </div>
            </SectionWrapper>
        </div>
    )
}
