import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { Link } from 'react-router-dom'

export function ClosingSection() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })

  return (
    <section
      ref={ref}
      style={{
        minHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 'clamp(2rem, 5vw, 4rem) clamp(1.5rem, 5vw, 2rem)',
        textAlign: 'center',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        style={{ maxWidth: '550px' }}
      >
        <div
          style={{
            width: '40px',
            height: '1px',
            background: 'var(--rubin-accent)',
            margin: '0 auto 2.5rem',
            opacity: 0.5,
          }}
        />

        <p
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 'clamp(1.1rem, 3vw, 1.4rem)',
            lineHeight: 1.7,
            fontStyle: 'italic',
            opacity: 0.7,
            marginBottom: '1rem',
          }}
        >
          Tokens become vectors. Vectors attend to one another.
          Layers refine meaning. Temperature adds breath.
        </p>

        <p
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 'clamp(1.1rem, 3vw, 1.4rem)',
            lineHeight: 1.7,
            fontStyle: 'italic',
            opacity: 0.7,
            marginBottom: '3rem',
          }}
        >
          And from all of this — language, understanding, something
          that feels almost like thought.
        </p>

        <div
          style={{
            width: '40px',
            height: '1px',
            background: 'var(--rubin-ivory-dark)',
            margin: '0 auto 2.5rem',
          }}
        />

        <Link
          to="/blog"
          className="mono"
          style={{
            textDecoration: 'none',
            color: 'var(--rubin-accent)',
            fontSize: '0.7rem',
            display: 'inline-block',
            padding: '0.6rem 1.5rem',
            border: '1px solid var(--rubin-ivory-dark)',
            borderRadius: 'var(--radius-full)',
            transition: 'all var(--duration-normal) var(--ease-out)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--rubin-accent)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--rubin-ivory-dark)'
          }}
        >
          ← Back to writing
        </Link>
      </motion.div>
    </section>
  )
}
