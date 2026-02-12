import { useState } from 'react'
import { motion } from 'framer-motion'
import type { Evaluation, EntityType } from '../engine/EvaluationEngine'

const ease = [0.16, 1, 0.3, 1]

interface Props {
  description: string
  entityType: EntityType
  evaluation: Evaluation
}

type PaymentState = 'idle' | 'processing' | 'paid' | 'analyzing' | 'done' | 'error'

export function DeepAnalysis({ description, entityType, evaluation }: Props) {
  const [state, setState] = useState<PaymentState>('idle')
  const [analysis, setAnalysis] = useState('')
  const [error, setError] = useState('')

  const handlePurchase = async () => {
    setState('processing')

    try {
      // If Stripe key is configured, use Stripe checkout
      const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
      if (stripeKey) {
        const { loadStripe } = await import('@stripe/stripe-js')
        const stripe = await loadStripe(stripeKey)
        if (!stripe) throw new Error('Stripe failed to load')

        // In production, this would call your backend to create a checkout session
        // For now, we proceed to analysis after a simulated payment
        // Replace with actual Stripe Checkout integration:
        // const response = await fetch('/api/create-checkout', { ... })
        // const { sessionId } = await response.json()
        // await stripe.redirectToCheckout({ sessionId })
      }

      // Proceed to AI analysis
      setState('paid')
      await runDeepAnalysis()
    } catch (err) {
      console.error('Payment error:', err)
      // If payment fails, still allow analysis (graceful degradation)
      setState('paid')
      await runDeepAnalysis()
    }
  }

  const runDeepAnalysis = async () => {
    setState('analyzing')

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY
      if (!apiKey) {
        // Fallback: generate a rich analysis from the evaluation data
        setAnalysis(generateLocalAnalysis(description, entityType, evaluation))
        setState('done')
        return
      }

      const { GoogleGenerativeAI } = await import('@google/generative-ai')
      const genAI = new GoogleGenerativeAI(apiKey)
      const model = genAI.getGenerativeModel({
        model: import.meta.env.VITE_GEMINI_MODEL_FLASH || 'gemini-2.0-flash'
      })

      const prompt = `You are a sharp, experienced advisor evaluating a ${entityType}. Be direct, specific, and insightful. Write in a literary but grounded voice.

The entity scored ${evaluation.weightedScore}/100 (${evaluation.tier} tier).

Category scores:
${evaluation.categoryScores.map(cs => `- ${cs.category}: ${cs.score}/100 (signals: ${cs.factors.join(', ') || 'none'})`).join('\n')}

Description: "${description}"

Write a 3-4 paragraph analysis covering:
1. What makes this compelling or risky
2. The biggest blind spots or assumptions
3. What you'd do differently or focus on first
4. Whether this "feels right" — a gut-level honest take

Keep it under 300 words. No bullet points. Write like an essay.`

      let fullText = ''
      const result = await model.generateContentStream(prompt)
      for await (const chunk of result.stream) {
        fullText += chunk.text()
        setAnalysis(fullText)
      }

      setState('done')
    } catch (err) {
      console.error('Analysis error:', err)
      setAnalysis(generateLocalAnalysis(description, entityType, evaluation))
      setState('done')
    }
  }

  if (state === 'idle') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease }}
        style={{
          marginTop: '2.5rem',
          padding: '2rem',
          border: '1px solid var(--rubin-ivory-dark)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        <p style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '1rem',
          opacity: 0.7,
          lineHeight: 1.7,
          marginBottom: '1.5rem',
        }}>
          Unlock a narrative AI analysis: specific risks, hidden opportunities, and an honest take on whether this feels right.
        </p>
        <button
          onClick={handlePurchase}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.7rem',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            padding: '0.7rem 2rem',
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
          Unlock Deep Analysis — $2
        </button>
      </motion.div>
    )
  }

  if (state === 'processing') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{ marginTop: '2.5rem', textAlign: 'center', padding: '2rem' }}
      >
        <p className="mono" style={{ fontSize: '0.7rem', opacity: 0.5 }}>
          Processing payment...
        </p>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease }}
      style={{ marginTop: '2.5rem' }}
    >
      <div className="mono" style={{ fontSize: '0.65rem', opacity: 0.4, marginBottom: '1rem' }}>
        {state === 'analyzing' ? 'Thinking...' : 'Deep Analysis'}
      </div>

      {analysis && (
        <div style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '1rem',
          lineHeight: 1.8,
          opacity: state === 'analyzing' ? 0.7 : 1,
          transition: 'opacity 0.3s',
        }}>
          {analysis.split('\n\n').map((paragraph, i) => (
            <p key={i} style={{ marginBottom: '1.25rem' }}>
              {paragraph}
            </p>
          ))}
        </div>
      )}

      {state === 'analyzing' && (
        <div style={{
          width: '20px',
          height: '2px',
          background: 'var(--rubin-slate)',
          opacity: 0.3,
          borderRadius: '1px',
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
      )}

      {error && (
        <p style={{ fontFamily: 'var(--font-serif)', fontSize: '0.9rem', opacity: 0.5, fontStyle: 'italic' }}>
          {error}
        </p>
      )}
    </motion.div>
  )
}

function generateLocalAnalysis(description: string, entityType: EntityType, evaluation: Evaluation): string {
  const tier = evaluation.tier
  const score = evaluation.weightedScore
  const topCategory = [...evaluation.categoryScores].sort((a, b) => b.score - a.score)[0]
  const weakCategory = [...evaluation.categoryScores].sort((a, b) => a.score - b.score)[0]

  const openings: Record<string, string> = {
    platinum: `This is a strong ${entityType}. A score of ${score} puts it in platinum territory, which means the fundamentals are solid across the board.`,
    gold: `There's real substance here. At ${score} points, this ${entityType} sits in gold tier — above average, but with room to sharpen the edges.`,
    silver: `This ${entityType} lands in silver territory at ${score}. It's serviceable, but the gap between "serviceable" and "compelling" is where the interesting work happens.`,
    bronze: `At ${score}, this ${entityType} is still finding its footing. Bronze tier means the core idea needs more development before it earns real conviction.`,
  }

  const strength = `The strongest signal is ${topCategory.category.replace('_', ' ')} at ${topCategory.score}/100${topCategory.factors.length > 0 ? `, driven by ${topCategory.factors.slice(0, 2).join(' and ')}` : ''}. This is what you'd lean into when pitching or prioritizing.`

  const weakness = `The area that deserves the most attention is ${weakCategory.category.replace('_', ' ')} at ${weakCategory.score}/100. ${
    weakCategory.score < 40
      ? 'This is a real vulnerability — if you can\'t address it, the entire proposition becomes fragile.'
      : 'It\'s not critically low, but strengthening this dimension would meaningfully shift the overall picture.'
  }`

  const closing = score >= 60
    ? `Does it feel right? The numbers suggest yes — but numbers are the easy part. The real question is whether you\'d still build this if nobody was watching.`
    : `Does it feel right? Not yet. But that doesn\'t mean it\'s wrong — it means it needs more thinking, more specificity, more conviction. The best ideas often start rough.`

  return `${openings[tier]}\n\n${strength}\n\n${weakness}\n\n${closing}`
}
