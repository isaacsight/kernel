import { useRef } from 'react'
import { motion, useScroll, useTransform, useSpring, type MotionValue } from 'framer-motion'
import { SectionWrapper } from './SectionWrapper'

const MAX_TOKENS = 200000
const GRID_CELLS = 80 // visual token slots in the grid

export function ContextWindowSection() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: scrollRef,
    offset: ["start end", "end start"],
  })

  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  })

  // Map scroll to fill percentage (0 to 1)
  const fillRatio = useTransform(smoothProgress, [0.25, 0.75], [0, 1])

  // Counter value
  const tokenCount = useTransform(fillRatio, (v) =>
    Math.round(Math.max(0, Math.min(1, v)) * MAX_TOKENS),
  )

  return (
    <div ref={scrollRef}>
      <SectionWrapper
        label="05 — Context Window"
        title="200,000 Tokens of Memory"
        subtitle="Claude can hold an entire novel in working memory — about 200K tokens at once. Scroll to watch the context window fill."
      >
        {/* Counter */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <motion.span
            className="mono"
            style={{
              fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
              letterSpacing: '0.05em',
            }}
          >
            <CounterDisplay value={tokenCount} />
          </motion.span>
          <div
            className="mono"
            style={{ fontSize: '0.65rem', opacity: 0.35, marginTop: '0.25rem' }}
          >
            tokens
          </div>
        </div>

        {/* Token grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(16px, 3vw, 24px), 1fr))',
            gap: '3px',
            padding: '1.5rem',
            background: 'var(--rubin-ivory-med)',
            borderRadius: 'var(--radius-md)',
            maxWidth: '600px',
            margin: '0 auto',
          }}
        >
          {Array.from({ length: GRID_CELLS }, (_, i) => (
            <TokenCell key={i} index={i} total={GRID_CELLS} fillRatio={fillRatio} />
          ))}
        </div>

        {/* Progress bar */}
        <div
          style={{
            maxWidth: '600px',
            margin: '1.5rem auto 0',
            height: '2px',
            background: 'var(--rubin-ivory-dark)',
            borderRadius: '1px',
            overflow: 'hidden',
          }}
        >
          <motion.div
            style={{
              height: '100%',
              background: 'var(--rubin-accent)',
              scaleX: fillRatio,
              transformOrigin: 'left',
            }}
          />
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
          scroll to fill context window
        </div>
      </SectionWrapper>
    </div>
  )
}

function TokenCell({
  index,
  total,
  fillRatio,
}: {
  index: number
  total: number
  fillRatio: MotionValue<number>
}) {
  const threshold = index / total
  const cellOpacity = useTransform(fillRatio, (v) =>
    v > threshold ? 0.6 : 0.08,
  )
  const cellScale = useTransform(fillRatio, (v) =>
    v > threshold && v < threshold + 0.02 ? 1.3 : 1,
  )

  return (
    <motion.div
      style={{
        opacity: cellOpacity,
        scale: cellScale,
        aspectRatio: '1',
        background: 'var(--rubin-slate)',
        borderRadius: '2px',
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    />
  )
}

function CounterDisplay({ value }: { value: MotionValue<number> }) {
  const displayValue = useTransform(value, (v) => v.toLocaleString())

  return <motion.span>{displayValue}</motion.span>
}
