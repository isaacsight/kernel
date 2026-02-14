import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SectionWrapper } from './SectionWrapper'

const REASONING_CATEGORIES = [
    { id: 'complexity', label: 'Complexity', weight: 0.25, description: 'Measures architectural depth and technical overhead.' },
    { id: 'market_demand', label: 'Market Demand', weight: 0.20, description: 'Signals from the external world: what does the void want?' },
    { id: 'profitability', label: 'Profitability', weight: 0.20, description: 'The alchemy of turning compute into sustainable value.' },
    { id: 'risk', label: 'Risk', weight: 0.15, description: 'Deterministic uncertainty and the potential for entropy.' },
    { id: 'time_efficiency', label: 'Time Efficiency', weight: 0.10, description: 'The compression of labor into high-leverage outputs.' },
    { id: 'innovation', label: 'Innovation', weight: 0.10, description: 'Novel patterns that break established cognitive local minima.' },
]

export function ReasoningSection() {
    const [hoveredId, setHoveredId] = useState<string | null>(null)

    const totalPoints = 100
    const maxBarWidth = 100 // percent

    return (
        <SectionWrapper
            label="07 — Intelligence Synthesis"
            title="The Reasoner's Calculus"
            subtitle="Claude doesn't just predict; it evaluates. Our system uses this 6-dimensional tensor to weigh the soul of every project."
        >
            <div
                style={{
                    background: 'var(--rubin-ivory-med)',
                    borderRadius: 'var(--radius-md)',
                    padding: '2rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.5rem',
                    minHeight: '400px',
                }}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {REASONING_CATEGORIES.map((cat) => {
                        const isHovered = hoveredId === cat.id
                        const isActive = hoveredId === null || isHovered

                        return (
                            <div
                                key={cat.id}
                                onMouseEnter={() => setHoveredId(cat.id)}
                                onMouseLeave={() => setHoveredId(null)}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.5rem',
                                    opacity: isActive ? 1 : 0.4,
                                    transition: 'opacity 0.3s ease',
                                    cursor: 'default',
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                    <span
                                        className="mono"
                                        style={{
                                            fontSize: '0.75rem',
                                            letterSpacing: '0.05em',
                                            color: isHovered ? 'var(--rubin-accent)' : 'var(--rubin-slate)',
                                        }}
                                    >
                                        {cat.label.toUpperCase()}
                                    </span>
                                    <span className="mono" style={{ fontSize: '0.7rem', opacity: 0.5 }}>
                                        {(cat.weight * 100).toFixed(0)}% WEIGHT
                                    </span>
                                </div>

                                <div
                                    style={{
                                        height: '4px',
                                        background: 'rgba(0,0,0,0.05)',
                                        borderRadius: '2px',
                                        position: 'relative',
                                        overflow: 'hidden',
                                    }}
                                >
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${cat.weight * 100}%` }}
                                        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                                        style={{
                                            height: '100%',
                                            background: isHovered ? 'var(--rubin-accent)' : 'var(--rubin-slate)',
                                            borderRadius: '2px',
                                        }}
                                    />
                                </div>

                                <AnimatePresence>
                                    {isHovered && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -5 }}
                                            transition={{ duration: 0.2 }}
                                            style={{
                                                fontFamily: 'var(--font-serif)',
                                                fontSize: '0.85rem',
                                                lineHeight: '1.4',
                                                color: 'var(--rubin-slate)',
                                                opacity: 0.8,
                                                fontStyle: 'italic',
                                            }}
                                        >
                                            {cat.description}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )
                    })}
                </div>

                <div
                    style={{
                        marginTop: 'auto',
                        paddingTop: '2rem',
                        borderTop: '1px solid rgba(0,0,0,0.05)',
                        display: 'flex',
                        justifyContent: 'center',
                    }}
                >
                    <div
                        className="mono"
                        style={{
                            fontSize: '0.65rem',
                            opacity: 0.35,
                            textAlign: 'center',
                            maxWidth: '300px',
                        }}
                    >
                        THE SUM OF ALL DIMENSIONS EQUALS ONE UNIFIED INTELLIGENCE SCORE.
                    </div>
                </div>
            </div>
        </SectionWrapper>
    )
}
