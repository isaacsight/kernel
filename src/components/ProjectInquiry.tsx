import { useState } from 'react'
import { motion } from 'framer-motion'
import type { Evaluation } from '../engine/EvaluationEngine'
import { generateQuote, type ProjectQuote } from '../engine/PricingEngine'
import { submitInquiry } from '../engine/InquiryService'

const ease = [0.16, 1, 0.3, 1]

interface Props {
  evaluation: Evaluation
}

type InquiryState = 'cta' | 'quote' | 'submitting' | 'submitted'

export function ProjectInquiry({ evaluation }: Props) {
  const [state, setState] = useState<InquiryState>('cta')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [details, setDetails] = useState('')
  const [quote, setQuote] = useState<ProjectQuote | null>(null)
  const [submitError, setSubmitError] = useState(false)

  const handleGenerateQuote = () => {
    const q = generateQuote(evaluation.entityDescription, undefined, evaluation.weightedScore)
    setQuote(q)
    setState('quote')
  }

  const handleSubmit = async () => {
    if (!email.trim()) return
    setState('submitting')
    setSubmitError(false)

    const result = await submitInquiry({
      name: name.trim(),
      email: email.trim(),
      details: details.trim(),
      description: evaluation.entityDescription,
      evaluationScore: evaluation.weightedScore,
      evaluationTier: evaluation.tier,
      quote,
    })

    if (result?.checkoutUrl) {
      // Redirect to Stripe hosted checkout
      window.location.href = result.checkoutUrl
      return
    }

    // Fallback: show confirmation if checkout creation failed
    setState('submitted')
    if (!result) setSubmitError(true)
  }

  if (state === 'cta') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        style={{
          marginTop: '2rem',
          padding: '2rem',
          background: 'var(--rubin-ivory-med)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        <p style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '1.1rem',
          marginBottom: '0.5rem',
        }}>
          Want this built?
        </p>
        <p style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '0.9rem',
          opacity: 0.5,
          lineHeight: 1.6,
          marginBottom: '1.25rem',
        }}>
          Get an instant quote and start a conversation about bringing this to life.
        </p>
        <button
          onClick={handleGenerateQuote}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.7rem',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            padding: '0.65rem 1.8rem',
            background: 'var(--rubin-slate)',
            color: 'var(--rubin-ivory)',
            border: 'none',
            borderRadius: 'var(--radius-full)',
            cursor: 'pointer',
            transition: 'opacity var(--duration-normal) var(--ease-out)',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          Get a Quote
        </button>
      </motion.div>
    )
  }

  if ((state === 'quote' || state === 'submitting') && quote) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
        style={{
          marginTop: '2rem',
          padding: '2rem',
          background: 'var(--rubin-ivory-med)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        {/* Quote Header */}
        <div className="mono" style={{ fontSize: '0.65rem', opacity: 0.4, marginBottom: '1.25rem' }}>
          Project Estimate
        </div>

        {/* Price + Type */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem', marginBottom: '1.5rem' }}>
          <span style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '2.5rem',
            fontWeight: 400,
            letterSpacing: '-0.02em',
          }}>
            ${quote.total.toLocaleString()}
          </span>
          <div>
            <div className="mono" style={{ fontSize: '0.6rem', opacity: 0.5 }}>
              {quote.type.replace(/_/g, ' ')} / {quote.complexity}
            </div>
            <div className="mono" style={{ fontSize: '0.55rem', opacity: 0.3, marginTop: '0.2rem' }}>
              ~{quote.estimatedHours} hours
            </div>
          </div>
        </div>

        {/* Deliverables */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div className="mono" style={{ fontSize: '0.6rem', opacity: 0.4, marginBottom: '0.5rem' }}>
            Deliverables
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {quote.deliverables.map((d, i) => (
              <span
                key={i}
                className="mono"
                style={{
                  fontSize: '0.55rem',
                  padding: '0.25rem 0.6rem',
                  background: 'var(--rubin-ivory)',
                  borderRadius: 'var(--radius-full)',
                  opacity: 0.6,
                }}
              >
                {d}
              </span>
            ))}
          </div>
        </div>

        {/* Breakdown */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '0.5rem 2rem',
          marginBottom: '2rem',
          paddingTop: '1rem',
          borderTop: '1px solid var(--rubin-ivory-dark)',
        }}>
          {[
            ['Design', quote.breakdown.design],
            ['Development', quote.breakdown.development],
            ['Testing', quote.breakdown.testing],
            ['Deployment', quote.breakdown.deployment],
          ].map(([label, amount]) => (
            <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="mono" style={{ fontSize: '0.55rem', opacity: 0.4 }}>{label}</span>
              <span className="mono" style={{ fontSize: '0.55rem', opacity: 0.5 }}>${(amount as number).toLocaleString()}</span>
            </div>
          ))}
        </div>

        {/* Contact Form */}
        <div style={{
          paddingTop: '1.5rem',
          borderTop: '1px solid var(--rubin-ivory-dark)',
        }}>
          <p style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '0.95rem',
            marginBottom: '1rem',
            opacity: 0.7,
          }}>
            Interested? Leave your details and proceed to payment.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={e => setName(e.target.value)}
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '0.95rem',
                padding: '0.75rem 1rem',
                border: '1px solid var(--rubin-ivory-dark)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--rubin-ivory)',
                color: 'var(--rubin-slate)',
                outline: 'none',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--rubin-accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--rubin-ivory-dark)'}
            />
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '0.95rem',
                padding: '0.75rem 1rem',
                border: '1px solid var(--rubin-ivory-dark)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--rubin-ivory)',
                color: 'var(--rubin-slate)',
                outline: 'none',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--rubin-accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--rubin-ivory-dark)'}
            />
            <textarea
              placeholder="Any additional details or questions..."
              value={details}
              onChange={e => setDetails(e.target.value)}
              rows={3}
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '0.95rem',
                padding: '0.75rem 1rem',
                border: '1px solid var(--rubin-ivory-dark)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--rubin-ivory)',
                color: 'var(--rubin-slate)',
                outline: 'none',
                resize: 'vertical',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--rubin-accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--rubin-ivory-dark)'}
            />
            <button
              onClick={handleSubmit}
              disabled={!email.trim() || state === 'submitting'}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.7rem',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                padding: '0.7rem 2rem',
                background: email.trim() && state !== 'submitting' ? 'var(--rubin-slate)' : 'var(--rubin-ivory-dark)',
                color: email.trim() && state !== 'submitting' ? 'var(--rubin-ivory)' : 'var(--rubin-slate)',
                border: 'none',
                borderRadius: 'var(--radius-full)',
                cursor: email.trim() && state !== 'submitting' ? 'pointer' : 'default',
                transition: 'all var(--duration-normal) var(--ease-out)',
                opacity: email.trim() && state !== 'submitting' ? 1 : 0.4,
                alignSelf: 'flex-start',
              }}
            >
              {state === 'submitting' ? 'Preparing Checkout...' : 'Proceed to Payment'}
            </button>
          </div>
        </div>
      </motion.div>
    )
  }

  if (state === 'submitted') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
        style={{
          marginTop: '2rem',
          padding: '2.5rem 2rem',
          background: 'var(--rubin-ivory-med)',
          borderRadius: 'var(--radius-md)',
          textAlign: 'center',
        }}
      >
        <p style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '1.2rem',
          marginBottom: '0.5rem',
        }}>
          Inquiry sent.
        </p>
        <p style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '0.9rem',
          opacity: 0.5,
          lineHeight: 1.6,
        }}>
          {submitError
            ? 'There was an issue creating checkout. I\'ll review your project and be in touch with payment details.'
            : 'I\'ll review your project and be in touch soon.'}
        </p>
      </motion.div>
    )
  }

  return null
}
