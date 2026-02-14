import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { SectionWrapper } from './SectionWrapper'

const PARTICLE_COUNT = 40

function seededRandom(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 49297
  return x - Math.floor(x)
}

export function TemperatureSection() {
  const [temperature, setTemperature] = useState(0.3)

  // Generate stable base positions for particles
  const particles = useMemo(
    () =>
      Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
        id: i,
        baseX: seededRandom(i * 2) * 100,
        baseY: seededRandom(i * 2 + 1) * 100,
        angle: seededRandom(i * 3) * Math.PI * 2,
      })),
    [],
  )

  const tempLabel =
    temperature < 0.2
      ? 'Deterministic'
      : temperature < 0.5
        ? 'Focused'
        : temperature < 0.8
          ? 'Creative'
          : 'Chaotic'

  return (
    <SectionWrapper
      label="04 — Temperature"
      title="Controlled Randomness"
      subtitle="Temperature controls how 'creative' Claude's responses are. Low temperature means predictable outputs. High temperature introduces beautiful chaos."
    >
      {/* Particle field */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: 'clamp(200px, 35vw, 300px)',
          background: 'var(--rubin-ivory-med)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          marginBottom: '1.5rem',
        }}
      >
        {/* Center target */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: '4px',
            height: '4px',
            borderRadius: '50%',
            background: 'var(--rubin-accent)',
            opacity: 0.3,
          }}
        />

        {particles.map((p) => {
          // At temp 0: cluster at center. At temp 1: full spread
          const spread = temperature
          const cx = 50 // center %
          const cy = 50
          const offsetX = (p.baseX - 50) * spread
          const offsetY = (p.baseY - 50) * spread
          // Add jitter that increases with temperature
          const jitterX = Math.cos(p.angle + temperature * 4) * temperature * 15
          const jitterY = Math.sin(p.angle + temperature * 4) * temperature * 15

          return (
            <motion.div
              key={p.id}
              animate={{
                left: `${cx + offsetX + jitterX}%`,
                top: `${cy + offsetY + jitterY}%`,
              }}
              transition={{
                type: 'spring',
                stiffness: 150 - temperature * 100,
                damping: 20 - temperature * 10,
                mass: 0.5 + temperature * 0.5,
              }}
              style={{
                position: 'absolute',
                width: 'clamp(5px, 1vw, 8px)',
                height: 'clamp(5px, 1vw, 8px)',
                borderRadius: '50%',
                background: 'var(--rubin-slate)',
                opacity: 0.15 + temperature * 0.4,
                transform: 'translate(-50%, -50%)',
              }}
            />
          )
        })}
      </div>

      {/* Slider */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          maxWidth: '500px',
          margin: '0 auto',
        }}
      >
        <span
          className="mono"
          style={{ fontSize: '0.65rem', opacity: 0.4, flexShrink: 0 }}
        >
          0
        </span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={temperature}
          onChange={(e) => setTemperature(parseFloat(e.target.value))}
          style={{
            flex: 1,
            appearance: 'none',
            height: '2px',
            background: 'var(--rubin-ivory-dark)',
            outline: 'none',
            cursor: 'pointer',
            accentColor: 'var(--rubin-accent)',
          }}
        />
        <span
          className="mono"
          style={{ fontSize: '0.65rem', opacity: 0.4, flexShrink: 0 }}
        >
          1
        </span>
      </div>

      <div style={{ textAlign: 'center', marginTop: '1rem' }}>
        <span
          className="mono"
          style={{ fontSize: '0.7rem', opacity: 0.5 }}
        >
          T = {temperature.toFixed(2)}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '0.85rem',
            opacity: 0.4,
            marginLeft: '1rem',
            fontStyle: 'italic',
          }}
        >
          {tempLabel}
        </span>
      </div>
    </SectionWrapper>
  )
}
