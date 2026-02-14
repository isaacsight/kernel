import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'

interface SectionWrapperProps {
  children: React.ReactNode
  label: string
  title: string
  subtitle?: string
}

export function SectionWrapper({ children, label, title, subtitle }: SectionWrapperProps) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })

  return (
    <section
      ref={ref}
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: 'clamp(2rem, 5vw, 4rem) clamp(1.5rem, 5vw, 2rem)',
        maxWidth: '900px',
        margin: '0 auto',
        width: '100%',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        <div
          className="mono"
          style={{
            opacity: 0.4,
            marginBottom: '0.75rem',
            fontSize: '0.7rem',
          }}
        >
          {label}
        </div>
        <h2
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 'clamp(1.5rem, 4vw, 2rem)',
            fontWeight: 400,
            letterSpacing: '0.02em',
            marginBottom: '0.75rem',
          }}
        >
          {title}
        </h2>
        {subtitle && (
          <p
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 'clamp(0.9rem, 2vw, 1.05rem)',
              opacity: 0.55,
              lineHeight: 1.7,
              marginBottom: '2.5rem',
              maxWidth: '600px',
            }}
          >
            {subtitle}
          </p>
        )}
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.div>
    </section>
  )
}
