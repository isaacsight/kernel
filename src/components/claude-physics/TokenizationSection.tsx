import { useState } from 'react'
import { motion, useMotionValue } from 'framer-motion'
import { SectionWrapper } from './SectionWrapper'
import { EXAMPLE_SENTENCE, TOKENS } from './data/tokens'

export function TokenizationSection() {
  const [hasInteracted, setHasInteracted] = useState(false)

  return (
    <SectionWrapper
      label="01 — Tokenization"
      title="Breaking Language into Pieces"
      subtitle="Before Claude reads a single word, your sentence is split into tokens — atomic units of meaning. Drag them around to feel how language becomes discrete."
    >
      {/* Original sentence */}
      <div
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 'clamp(1rem, 2.5vw, 1.15rem)',
          opacity: 0.4,
          marginBottom: '1.5rem',
          fontStyle: 'italic',
        }}
      >
        "{EXAMPLE_SENTENCE}"
      </div>

      {/* Draggable tokens */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.75rem',
          minHeight: '120px',
          padding: '1.5rem',
          background: 'var(--rubin-ivory-med)',
          borderRadius: 'var(--radius-md)',
          position: 'relative',
        }}
      >
        {TOKENS.map((token, i) => (
          <DraggableToken
            key={token.id}
            token={token}
            index={i}
            onDragStart={() => setHasInteracted(true)}
          />
        ))}
      </div>

      {/* Hint */}
      <motion.div
        animate={{ opacity: hasInteracted ? 0 : 0.35 }}
        className="mono"
        style={{
          fontSize: '0.65rem',
          marginTop: '1rem',
          textAlign: 'center',
        }}
      >
        drag tokens to rearrange
      </motion.div>
    </SectionWrapper>
  )
}

function DraggableToken({
  token,
  index,
  onDragStart,
}: {
  token: { id: number; text: string }
  index: number
  onDragStart: () => void
}) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const [isDragging, setIsDragging] = useState(false)

  return (
    <motion.div
      drag
      dragMomentum={false}
      dragElastic={0.1}
      dragConstraints={{ top: -60, bottom: 60, left: -100, right: 100 }}
      onDragStart={() => {
        setIsDragging(true)
        onDragStart()
      }}
      onDragEnd={() => {
        setIsDragging(false)
        x.set(0)
        y.set(0)
      }}
      style={{
        x,
        y,
        fontFamily: 'var(--font-mono)',
        fontSize: 'clamp(0.7rem, 1.5vw, 0.8rem)',
        padding: '0.5rem 0.85rem',
        background: isDragging ? 'var(--rubin-slate)' : 'var(--rubin-ivory)',
        color: isDragging ? 'var(--rubin-ivory)' : 'var(--rubin-slate)',
        borderRadius: 'var(--radius-sm)',
        boxShadow: isDragging ? 'var(--shadow-lg)' : 'var(--shadow-sm)',
        cursor: 'grab',
        userSelect: 'none',
        zIndex: isDragging ? 10 : 1,
        letterSpacing: '0.05em',
      }}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        delay: index * 0.05,
        type: 'spring',
        stiffness: 300,
        damping: 20,
      }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95, cursor: 'grabbing' }}
    >
      {token.text}
    </motion.div>
  )
}
