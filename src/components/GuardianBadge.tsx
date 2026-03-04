// ═══════════════════════════════════════════════════════════════
//  Guardian Badge — Security/quality review indicator for artifacts
// ═══════════════════════════════════════════════════════════════
//
//  Renders as a colored pill badge on artifact cards. Triggers a
//  background fast-tier review on mount, shows "Reviewing..." state,
//  then displays severity with expandable findings.

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { IconShield, IconChevronDown } from './KernelIcons'
import { reviewCodeArtifact, type GuardianReview } from '../engine/GuardianReview'
import { DURATION, EASE } from '../constants/motion'

// ─── Constants ──────────────────────────────────────────────

const SEVERITY_COLORS: Record<string, string> = {
  clean: 'var(--kernel-success, #22C55E)',
  advisory: 'var(--kernel-info, #3B82F6)',
  warning: 'var(--kernel-warning, #F59E0B)',
  critical: '#EF4444',
}

const SEVERITY_LABELS: Record<string, string> = {
  clean: 'Clean',
  advisory: 'Advisory',
  warning: 'Warning',
  critical: 'Critical',
}

// ─── Component ──────────────────────────────────────────────

export function GuardianBadge({ code, filename, language }: {
  code: string
  filename: string
  language: string
}) {
  const [review, setReview] = useState<GuardianReview | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    reviewCodeArtifact(code, filename, language).then(result => {
      if (!cancelled) {
        setReview(result)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [code, filename, language])

  if (loading) {
    return (
      <div className="ka-guardian-badge ka-guardian-badge--loading">
        <IconShield size={12} />
        <span className="ka-guardian-badge-text">Reviewing...</span>
      </div>
    )
  }

  if (!review) return null

  const color = SEVERITY_COLORS[review.severity]
  const label = SEVERITY_LABELS[review.severity]
  const hasFindings = review.findings.length > 0

  return (
    <div className="ka-guardian-wrap">
      <button
        className={`ka-guardian-badge ka-guardian-badge--${review.severity}`}
        onClick={() => hasFindings && setExpanded(!expanded)}
        style={{ '--guardian-color': color } as React.CSSProperties}
        aria-label={`Guardian review: ${label}`}
        disabled={!hasFindings}
      >
        <IconShield size={12} />
        <span className="ka-guardian-badge-text">{label}</span>
        {hasFindings && (
          <IconChevronDown size={10} className={`ka-guardian-chevron${expanded ? ' ka-guardian-chevron--open' : ''}`} />
        )}
      </button>
      <AnimatePresence>
        {expanded && hasFindings && (
          <motion.div
            className="ka-guardian-findings"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: DURATION.QUICK, ease: EASE.OUT }}
          >
            <p className="ka-guardian-summary">{review.summary}</p>
            <ul className="ka-guardian-list">
              {review.findings.map((f, i) => (
                <li key={i} className={`ka-guardian-finding ka-guardian-finding--${f.severity}`}>
                  {f.line != null && <span className="ka-guardian-line">L{f.line}</span>}
                  <span>{f.message}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
