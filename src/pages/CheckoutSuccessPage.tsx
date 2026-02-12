import { motion } from 'framer-motion'
import { useSearchParams, Link } from 'react-router-dom'

export function CheckoutSuccessPage() {
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session_id')

  return (
    <div style={{
      maxWidth: '600px',
      margin: '0 auto',
      padding: '4rem 2rem',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        style={{
          padding: '3rem 2.5rem',
          background: 'var(--rubin-ivory-med)',
          borderRadius: 'var(--radius-md)',
          textAlign: 'center',
        }}
      >
        <p style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '1.6rem',
          fontWeight: 400,
          marginBottom: '1rem',
        }}>
          Payment received.
        </p>

        <p style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '1rem',
          opacity: 0.6,
          lineHeight: 1.7,
          marginBottom: '2rem',
        }}>
          Your project inquiry has been confirmed. I'll begin reviewing and be in touch shortly.
        </p>

        {sessionId && (
          <p className="mono" style={{
            fontSize: '0.55rem',
            opacity: 0.25,
            marginBottom: '2rem',
          }}>
            session: {sessionId}
          </p>
        )}

        <Link
          to="/"
          style={{
            display: 'inline-block',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.7rem',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            padding: '0.7rem 2rem',
            background: 'var(--rubin-slate)',
            color: 'var(--rubin-ivory)',
            border: 'none',
            borderRadius: 'var(--radius-full)',
            textDecoration: 'none',
            transition: 'opacity var(--duration-normal) var(--ease-out)',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          Back to Home
        </Link>
      </motion.div>
    </div>
  )
}
