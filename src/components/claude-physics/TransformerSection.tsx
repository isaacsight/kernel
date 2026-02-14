import { useRef } from 'react'
import { motion, useScroll, useTransform, useSpring, type MotionValue } from 'framer-motion'
import { SectionWrapper } from './SectionWrapper'
import { TRANSFORMER_LAYERS } from './data/tokens'

export function TransformerSection() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: scrollRef,
    offset: ["start end", "end start"],
  })

  // Smooth progress for the glowing dot
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  })

  // Map scroll to active layer index (0 to layers.length - 1)
  const activeLayerFloat = useTransform(smoothProgress, [0.2, 0.8], [0, TRANSFORMER_LAYERS.length - 1])

  return (
    <div ref={scrollRef}>
      <SectionWrapper
        label="03 — Transformer Layers"
        title="Signal Propagating Through Depth"
        subtitle="Claude has 80 transformer layers. As you scroll, watch a signal propagate from raw embeddings to abstract reasoning."
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          {TRANSFORMER_LAYERS.map((layer, i) => (
            <TransformerLayer
              key={i}
              layer={layer}
              index={i}
              activeLayerFloat={activeLayerFloat}
            />
          ))}
        </div>

        <div
          className="mono"
          style={{
            fontSize: '0.65rem',
            opacity: 0.35,
            marginTop: '1.5rem',
            textAlign: 'center',
          }}
        >
          scroll to propagate signal through layers
        </div>
      </SectionWrapper>
    </div>
  )
}

function TransformerLayer({
  layer,
  index,
  activeLayerFloat,
}: {
  layer: { name: string; description: string }
  index: number
  activeLayerFloat: MotionValue<number>
}) {
  // Compute opacity based on proximity to active layer
  const opacity = useTransform(activeLayerFloat, (val) => {
    const distance = Math.abs(val - index)
    return distance < 0.5 ? 1 : Math.max(0.25, 1 - distance * 0.3)
  })

  const glowOpacity = useTransform(activeLayerFloat, (val) => {
    const distance = Math.abs(val - index)
    return distance < 0.5 ? 0.8 : 0
  })

  const scale = useTransform(activeLayerFloat, (val) => {
    const distance = Math.abs(val - index)
    return distance < 0.5 ? 1.02 : 1
  })

  const inactiveOpacity = useTransform(glowOpacity, (v) => v > 0.1 ? 0 : 0.3)

  return (
    <motion.div
      style={{
        opacity,
        scale,
        display: 'flex',
        alignItems: 'center',
        gap: '1.25rem',
        padding: '1rem 1.25rem',
        borderRadius: 'var(--radius-sm)',
        position: 'relative',
      }}
    >
      {/* Glowing dot */}
      <motion.div
        style={{
          opacity: glowOpacity,
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          background: 'var(--rubin-accent)',
          boxShadow: '0 0 12px rgba(139, 115, 85, 0.6)',
          flexShrink: 0,
        }}
      />
      {/* Inactive dot */}
      <motion.div
        style={{
          opacity: inactiveOpacity,
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          background: 'var(--rubin-slate)',
          position: 'absolute',
          left: '1.25rem',
          flexShrink: 0,
        }}
      />

      <div style={{ flex: 1 }}>
        <div
          className="mono"
          style={{ fontSize: '0.7rem', marginBottom: '0.2rem' }}
        >
          {layer.name}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 'clamp(0.85rem, 1.8vw, 0.95rem)',
            opacity: 0.6,
          }}
        >
          {layer.description}
        </div>
      </div>

      {/* Connecting line to next layer */}
      {index < TRANSFORMER_LAYERS.length - 1 && (
        <div
          style={{
            position: 'absolute',
            left: 'calc(1.25rem + 4.5px)',
            bottom: '-0.5rem',
            width: '1px',
            height: '1rem',
            background: 'var(--rubin-ivory-dark)',
          }}
        />
      )}
    </motion.div>
  )
}
