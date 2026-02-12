import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { assistantManager } from '../agents/assistant'
import type { Evaluation } from '../engine/EvaluationEngine'

const ease = [0.16, 1, 0.3, 1]

interface Props {
  evaluation: Evaluation
}

export function AssistantBrief({ evaluation }: Props) {
  const triage = useMemo(
    () => assistantManager.triageEvaluation(evaluation.weightedScore, evaluation.tier),
    [evaluation.weightedScore, evaluation.tier]
  )

  const priorityColors: Record<string, string> = {
    urgent: '#8C5B5B',
    high: '#8B7355',
    normal: '#6B8C72',
    low: '#5B7B8C',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.2, duration: 0.5, ease }}
      style={{
        marginTop: '2rem',
        padding: '1.25rem 1.5rem',
        borderLeft: `3px solid ${priorityColors[triage.priority]}`,
        background: 'var(--rubin-ivory-med)',
        borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
        <span style={{
          width: '22px',
          height: '22px',
          borderRadius: 'var(--radius-full)',
          background: priorityColors[triage.priority],
          color: 'var(--rubin-ivory)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.55rem',
          fontWeight: 700,
        }}>
          I
        </span>
        <span className="mono" style={{ fontSize: '0.6rem', opacity: 0.5 }}>
          Assistant — {triage.priority} priority
        </span>
      </div>
      <p style={{
        fontFamily: 'var(--font-serif)',
        fontSize: '0.9rem',
        lineHeight: 1.6,
        opacity: 0.7,
      }}>
        {triage.action}
      </p>
    </motion.div>
  )
}
