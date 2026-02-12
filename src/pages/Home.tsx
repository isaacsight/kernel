import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { evaluationEngine, type Evaluation, type EntityType } from '../engine/EvaluationEngine'
import { EvaluationResults } from '../components/EvaluationResults'
import { DeepAnalysis } from '../components/DeepAnalysis'
import { ProjectInquiry } from '../components/ProjectInquiry'

const ease = [0.16, 1, 0.3, 1]

const ENTITY_OPTIONS: { value: EntityType; label: string }[] = [
  { value: 'project', label: 'Project' },
  { value: 'opportunity', label: 'Opportunity' },
  { value: 'income_stream', label: 'Income Stream' },
  { value: 'trade', label: 'Trade' },
]

export function Home() {
  const [description, setDescription] = useState('')
  const [entityType, setEntityType] = useState<EntityType>('project')
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null)
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [showDeepAnalysis, setShowDeepAnalysis] = useState(false)

  const handleEvaluate = () => {
    if (!description.trim() || isEvaluating) return
    setIsEvaluating(true)
    setShowDeepAnalysis(false)

    // Small delay for the animation feel
    setTimeout(() => {
      const result = evaluationEngine.evaluate(
        `visitor_${Date.now()}`,
        entityType,
        { description: description.trim() }
      )
      setEvaluation(result)
      setIsEvaluating(false)
    }, 600)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.metaKey) {
      handleEvaluate()
    }
  }

  const handleReset = () => {
    setDescription('')
    setEvaluation(null)
    setShowDeepAnalysis(false)
  }

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '4rem 2rem 6rem' }}>
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease }}
          style={{ marginBottom: '3rem' }}
        >
          <div className="mono" style={{ opacity: 0.4, marginBottom: '0.75rem', fontSize: '0.7rem' }}>
            Evaluation Engine
          </div>
          <h1 style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '2.8rem',
            fontWeight: 400,
            letterSpacing: '0.02em',
            marginBottom: '1rem',
            lineHeight: 1.2,
          }}>
            Does This Feel Right?
          </h1>
          <p style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '1.1rem',
            opacity: 0.5,
            lineHeight: 1.7,
            maxWidth: '520px',
          }}>
            Describe your idea, project, or opportunity. The engine evaluates it across six dimensions and tells you whether it feels right.
          </p>
        </motion.div>

        {/* Input Section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease }}
        >
          {/* Entity Type Selector */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            {ENTITY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setEntityType(opt.value)}
                className="mono"
                style={{
                  fontSize: '0.65rem',
                  padding: '0.4rem 0.8rem',
                  border: '1px solid',
                  borderColor: entityType === opt.value ? 'var(--rubin-slate)' : 'var(--rubin-ivory-dark)',
                  borderRadius: 'var(--radius-full)',
                  background: entityType === opt.value ? 'var(--rubin-slate)' : 'transparent',
                  color: entityType === opt.value ? 'var(--rubin-ivory)' : 'var(--rubin-slate)',
                  cursor: 'pointer',
                  transition: 'all var(--duration-fast) var(--ease-out)',
                  opacity: entityType === opt.value ? 1 : 0.5,
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Textarea */}
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what you're building, evaluating, or considering..."
            rows={5}
            style={{
              width: '100%',
              fontFamily: 'var(--font-serif)',
              fontSize: '1rem',
              lineHeight: 1.7,
              padding: '1.25rem',
              border: '1px solid var(--rubin-ivory-dark)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--rubin-ivory)',
              color: 'var(--rubin-slate)',
              resize: 'vertical',
              outline: 'none',
              transition: 'border-color var(--duration-normal) var(--ease-out)',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--rubin-accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--rubin-ivory-dark)'}
          />

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
            <button
              onClick={handleEvaluate}
              disabled={!description.trim() || isEvaluating}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                padding: '0.75rem 2rem',
                background: description.trim() ? 'var(--rubin-slate)' : 'var(--rubin-ivory-dark)',
                color: description.trim() ? 'var(--rubin-ivory)' : 'var(--rubin-slate)',
                border: 'none',
                borderRadius: 'var(--radius-full)',
                cursor: description.trim() ? 'pointer' : 'default',
                transition: 'all var(--duration-normal) var(--ease-out)',
                opacity: description.trim() ? (isEvaluating ? 0.6 : 1) : 0.4,
              }}
            >
              {isEvaluating ? 'Evaluating...' : 'Evaluate'}
            </button>

            {evaluation && (
              <button
                onClick={handleReset}
                className="mono"
                style={{
                  fontSize: '0.65rem',
                  padding: '0.5rem 1rem',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--rubin-slate)',
                  opacity: 0.4,
                  cursor: 'pointer',
                  transition: 'opacity var(--duration-fast)',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                onMouseLeave={e => e.currentTarget.style.opacity = '0.4'}
              >
                Start Over
              </button>
            )}

            <span className="mono" style={{ fontSize: '0.6rem', opacity: 0.3, marginLeft: 'auto' }}>
              {'\u2318'} + Enter
            </span>
          </div>
        </motion.div>

        {/* Results */}
        <AnimatePresence mode="wait">
          {evaluation && !isEvaluating && (
            <motion.div
              key={evaluation.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.6, ease }}
              style={{ marginTop: '3rem' }}
            >
              <EvaluationResults evaluation={evaluation} />

              {/* Deep Analysis CTA */}
              {!showDeepAnalysis && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8, duration: 0.4 }}
                  style={{
                    marginTop: '2.5rem',
                    padding: '2rem',
                    border: '1px solid var(--rubin-ivory-dark)',
                    borderRadius: 'var(--radius-md)',
                    textAlign: 'center',
                  }}
                >
                  <p style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: '1.1rem',
                    marginBottom: '0.5rem',
                  }}>
                    Want a deeper take?
                  </p>
                  <p style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: '0.9rem',
                    opacity: 0.5,
                    marginBottom: '1.5rem',
                    lineHeight: 1.6,
                  }}>
                    AI-powered narrative analysis with specific risks, opportunities, and recommendations.
                  </p>
                  <button
                    onClick={() => setShowDeepAnalysis(true)}
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.7rem',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      padding: '0.65rem 1.8rem',
                      background: 'transparent',
                      color: 'var(--rubin-slate)',
                      border: '1px solid var(--rubin-slate)',
                      borderRadius: 'var(--radius-full)',
                      cursor: 'pointer',
                      transition: 'all var(--duration-normal) var(--ease-out)',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'var(--rubin-slate)'
                      e.currentTarget.style.color = 'var(--rubin-ivory)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.color = 'var(--rubin-slate)'
                    }}
                  >
                    Go Deeper — $2
                  </button>
                </motion.div>
              )}

              {/* Deep Analysis Panel */}
              {showDeepAnalysis && (
                <DeepAnalysis
                  description={description}
                  entityType={entityType}
                  evaluation={evaluation}
                />
              )}

              {/* Project Inquiry */}
              <ProjectInquiry evaluation={evaluation} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer Nav */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6, ease }}
          style={{
            marginTop: '4rem',
            paddingTop: '2rem',
            borderTop: '1px solid var(--rubin-ivory-dark)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Link
            to="/blog"
            className="mono"
            style={{
              fontSize: '0.65rem',
              color: 'var(--rubin-accent)',
              textDecoration: 'none',
              opacity: 0.7,
              transition: 'opacity var(--duration-fast)',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
            onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}
          >
            Read the Writing &rarr;
          </Link>
          <span className="mono" style={{ fontSize: '0.6rem', opacity: 0.3 }}>
            Antigravity Kernel
          </span>
        </motion.div>
      </div>
    </div>
  )
}
