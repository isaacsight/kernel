import { motion } from 'framer-motion'
import type { Evaluation, CategoryType, Tier } from '../engine/EvaluationEngine'

const ease = [0.16, 1, 0.3, 1]

const CATEGORY_LABELS: Record<CategoryType, string> = {
  complexity: 'Complexity',
  market_demand: 'Market Demand',
  risk: 'Risk',
  profitability: 'Profitability',
  time_efficiency: 'Time Efficiency',
  innovation: 'Innovation',
}

const TIER_STYLES: Record<Tier, { label: string; color: string; bg: string }> = {
  bronze: { label: 'Bronze', color: '#8B6914', bg: 'rgba(205, 127, 50, 0.08)' },
  silver: { label: 'Silver', color: '#6B6B6B', bg: 'rgba(192, 192, 192, 0.08)' },
  gold: { label: 'Gold', color: '#8B7A2E', bg: 'rgba(255, 215, 0, 0.08)' },
  platinum: { label: 'Platinum', color: '#4A4A4A', bg: 'rgba(229, 228, 226, 0.12)' },
}

interface Props {
  evaluation: Evaluation
}

export function EvaluationResults({ evaluation }: Props) {
  const tierStyle = TIER_STYLES[evaluation.tier]

  return (
    <div>
      {/* Overall Score + Tier */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease }}
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: '1.5rem',
          marginBottom: '2rem',
        }}
      >
        <div style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '4rem',
          fontWeight: 400,
          letterSpacing: '-0.02em',
          lineHeight: 1,
        }}>
          {evaluation.weightedScore}
        </div>
        <div>
          <span
            className="mono"
            style={{
              fontSize: '0.65rem',
              padding: '0.3rem 0.7rem',
              borderRadius: 'var(--radius-full)',
              background: tierStyle.bg,
              color: tierStyle.color,
              border: `1px solid ${tierStyle.color}22`,
            }}
          >
            {tierStyle.label}
          </span>
          <div className="mono" style={{
            fontSize: '0.6rem',
            opacity: 0.35,
            marginTop: '0.5rem',
          }}>
            {Math.round(evaluation.confidence * 100)}% confidence
          </div>
        </div>
      </motion.div>

      {/* Category Breakdown */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {evaluation.categoryScores.map((cs, i) => (
          <motion.div
            key={cs.category}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.1 + i * 0.08, ease }}
          >
            {/* Label + Score */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: '0.35rem',
            }}>
              <span className="mono" style={{ fontSize: '0.6rem', opacity: 0.6 }}>
                {CATEGORY_LABELS[cs.category]}
              </span>
              <span className="mono" style={{ fontSize: '0.6rem', opacity: 0.4 }}>
                {cs.score}
              </span>
            </div>

            {/* Bar */}
            <div style={{
              width: '100%',
              height: '3px',
              background: 'var(--rubin-ivory-dark)',
              borderRadius: '2px',
              overflow: 'hidden',
            }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${cs.score}%` }}
                transition={{ duration: 0.8, delay: 0.2 + i * 0.08, ease }}
                style={{
                  height: '100%',
                  background: 'var(--rubin-slate)',
                  borderRadius: '2px',
                  opacity: 0.6,
                }}
              />
            </div>

            {/* Factors */}
            {cs.factors.length > 0 && (
              <div style={{
                marginTop: '0.3rem',
                display: 'flex',
                gap: '0.4rem',
                flexWrap: 'wrap',
              }}>
                {cs.factors.slice(0, 4).map((factor, fi) => (
                  <span
                    key={fi}
                    className="mono"
                    style={{
                      fontSize: '0.5rem',
                      opacity: 0.3,
                      padding: '0.15rem 0.4rem',
                      background: factor.startsWith('+') ? 'rgba(31, 30, 29, 0.04)' : 'rgba(180, 60, 60, 0.04)',
                      borderRadius: '3px',
                    }}
                  >
                    {factor}
                  </span>
                ))}
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Weight Distribution */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7, duration: 0.4 }}
        style={{
          marginTop: '1.5rem',
          paddingTop: '1rem',
          borderTop: '1px solid var(--rubin-ivory-dark)',
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        {evaluation.categoryScores.map(cs => (
          <span key={cs.category} className="mono" style={{ fontSize: '0.5rem', opacity: 0.25 }}>
            {CATEGORY_LABELS[cs.category]} {Math.round(cs.weight * 100)}%
          </span>
        ))}
      </motion.div>
    </div>
  )
}
