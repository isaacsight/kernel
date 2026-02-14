import { motion } from 'framer-motion'

const TITLE_WORDS = "The Physics & Neuroscience of Claude".split(" ")

export function HeroSection() {
  return (
    <section
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 'clamp(2rem, 5vw, 4rem) clamp(1.5rem, 5vw, 2rem)',
        textAlign: 'center',
      }}
    >
      <div
        className="mono"
        style={{ opacity: 0.4, marginBottom: '1.5rem', fontSize: '0.7rem' }}
      >
        Interactive Guide
      </div>

      <h1
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 'clamp(2rem, 6vw, 3.5rem)',
          fontWeight: 400,
          letterSpacing: '0.02em',
          lineHeight: 1.2,
          maxWidth: '700px',
          marginBottom: '1.5rem',
        }}
      >
        {TITLE_WORDS.map((word, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.6,
              delay: 0.3 + i * 0.08,
              ease: [0.16, 1, 0.3, 1],
            }}
            style={{ display: 'inline-block', marginRight: '0.3em' }}
          >
            {word}
          </motion.span>
        ))}
      </h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.55 }}
        transition={{ duration: 0.8, delay: 1.0 }}
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 'clamp(0.95rem, 2vw, 1.1rem)',
          lineHeight: 1.7,
          maxWidth: '500px',
          marginBottom: '4rem',
        }}
      >
        Scroll through seven interactive explorations of how a large language model
        transforms text into understanding.
      </motion.p>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.4 }}
        transition={{ duration: 0.6, delay: 1.4 }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        <span className="mono" style={{ fontSize: '0.6rem' }}>Scroll</span>
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            width: '1px',
            height: '24px',
            background: 'var(--rubin-slate)',
            opacity: 0.3,
          }}
        />
      </motion.div>
    </section>
  )
}
