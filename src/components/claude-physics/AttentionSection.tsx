import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SectionWrapper } from './SectionWrapper'
import { TOKENS, ATTENTION_WEIGHTS } from './data/tokens'

export function AttentionSection() {
  const [activeToken, setActiveToken] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const tokenRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const [lines, setLines] = useState<{ x1: number; y1: number; x2: number; y2: number; weight: number }[]>([])

  const computeLines = useCallback(() => {
    if (activeToken === null || !containerRef.current) {
      setLines([])
      return
    }

    const connections = ATTENTION_WEIGHTS[activeToken] ?? []
    const containerRect = containerRef.current.getBoundingClientRect()

    const newLines = connections
      .map(({ target, weight }) => {
        const sourceEl = tokenRefs.current.get(activeToken)
        const targetEl = tokenRefs.current.get(target)
        if (!sourceEl || !targetEl) return null

        const sourceRect = sourceEl.getBoundingClientRect()
        const targetRect = targetEl.getBoundingClientRect()

        return {
          x1: sourceRect.left + sourceRect.width / 2 - containerRect.left,
          y1: sourceRect.top + sourceRect.height / 2 - containerRect.top,
          x2: targetRect.left + targetRect.width / 2 - containerRect.left,
          y2: targetRect.top + targetRect.height / 2 - containerRect.top,
          weight,
        }
      })
      .filter((l): l is NonNullable<typeof l> => l !== null)

    setLines(newLines)
  }, [activeToken])

  useEffect(() => {
    computeLines()
  }, [computeLines])

  const setTokenRef = useCallback((id: number, el: HTMLDivElement | null) => {
    if (el) tokenRefs.current.set(id, el)
    else tokenRefs.current.delete(id)
  }, [])

  return (
    <SectionWrapper
      label="02 — Self-Attention"
      title="Every Word Listens to Every Other"
      subtitle="Self-attention lets each token decide which other tokens matter most. Hover or tap a token to see its attention pattern light up."
    >
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          padding: '2rem 1.5rem',
          background: 'var(--rubin-ivory-med)',
          borderRadius: 'var(--radius-md)',
          minHeight: '140px',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* SVG overlay for attention lines */}
        <svg
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            overflow: 'visible',
          }}
        >
          <AnimatePresence>
            {lines.map((line, i) => (
              <motion.line
                key={`${activeToken}-${i}`}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke="var(--rubin-accent)"
                strokeWidth={line.weight * 3}
                strokeLinecap="round"
                initial={{ opacity: 0, pathLength: 0 }}
                animate={{ opacity: line.weight * 0.7, pathLength: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              />
            ))}
          </AnimatePresence>
        </svg>

        {/* Token chips */}
        {TOKENS.map((token) => {
          const isSource = activeToken === token.id
          const isTarget = activeToken !== null &&
            (ATTENTION_WEIGHTS[activeToken] ?? []).some((c) => c.target === token.id)
          const targetWeight = isTarget
            ? (ATTENTION_WEIGHTS[activeToken!] ?? []).find((c) => c.target === token.id)?.weight ?? 0
            : 0

          return (
            <motion.div
              key={token.id}
              ref={(el) => setTokenRef(token.id, el)}
              onMouseEnter={() => setActiveToken(token.id)}
              onMouseLeave={() => setActiveToken(null)}
              onTouchStart={() => setActiveToken(token.id === activeToken ? null : token.id)}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'clamp(0.7rem, 1.5vw, 0.8rem)',
                padding: '0.5rem 0.85rem',
                background: isSource
                  ? 'var(--rubin-slate)'
                  : isTarget
                    ? `rgba(139, 115, 85, ${0.15 + targetWeight * 0.35})`
                    : 'var(--rubin-ivory)',
                color: isSource ? 'var(--rubin-ivory)' : 'var(--rubin-slate)',
                borderRadius: 'var(--radius-sm)',
                boxShadow: isSource ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                cursor: 'pointer',
                userSelect: 'none',
                letterSpacing: '0.05em',
                position: 'relative',
                zIndex: isSource ? 5 : isTarget ? 3 : 1,
              }}
              whileHover={{ scale: 1.05 }}
              animate={{
                scale: isTarget ? 1 + targetWeight * 0.1 : 1,
              }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              {token.text}
              {isTarget && (
                <span
                  className="mono"
                  style={{
                    position: 'absolute',
                    top: '-0.6rem',
                    right: '-0.3rem',
                    fontSize: '0.5rem',
                    opacity: 0.6,
                  }}
                >
                  {Math.round(targetWeight * 100)}%
                </span>
              )}
            </motion.div>
          )
        })}
      </div>

      <div
        className="mono"
        style={{
          fontSize: '0.65rem',
          opacity: 0.35,
          marginTop: '1rem',
          textAlign: 'center',
        }}
      >
        {activeToken !== null
          ? `"${TOKENS[activeToken].text}" attends to ${(ATTENTION_WEIGHTS[activeToken] ?? []).length} tokens`
          : 'hover or tap a token to see attention'}
      </div>
    </SectionWrapper>
  )
}
