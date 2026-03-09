import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { VARIANT, EASE, DURATION } from '../constants/motion'
import { supabase } from '../engine/SupabaseClient'

// ─── Secret trigger ──────────────────────────────────
// Client types "kernel.hat" in the chat to open this modal
export const SCORING_TRIGGER = 'kernel.hat'

export function isScoreTrigger(input: string): boolean {
  return input.trim().toLowerCase() === SCORING_TRIGGER
}

// ─── Types ──────────────────────────────────────────
type ScoreType = 'project' | 'session' | 'work'

interface ScoringModalProps {
  open: boolean
  onClose: () => void
  userId: string
  conversationId?: string
}

const SCORE_LABELS: Record<ScoreType, string> = {
  project: 'Project',
  session: 'Session',
  work: 'Piece of Work',
}

const SCORE_DESCRIPTIONS: Record<ScoreType, string> = {
  project: 'Rate the overall project — all chats, files, and deliverables.',
  session: 'Rate this particular session or interaction.',
  work: 'Rate a specific deliverable or piece of work in your account.',
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#5a7a5a' // sage green
  if (score >= 60) return '#8B7355' // warm brown
  if (score >= 40) return '#B8875C' // amber
  return '#a05050' // muted red
}

function getScoreLabel(score: number): string {
  if (score >= 90) return 'Exceptional'
  if (score >= 80) return 'Excellent'
  if (score >= 70) return 'Very Good'
  if (score >= 60) return 'Good'
  if (score >= 50) return 'Satisfactory'
  if (score >= 40) return 'Fair'
  if (score >= 30) return 'Below Average'
  if (score >= 20) return 'Poor'
  return 'Unsatisfactory'
}

export function ScoringModal({ open, onClose, userId, conversationId }: ScoringModalProps) {
  const [scoreType, setScoreType] = useState<ScoreType>('project')
  const [score, setScore] = useState(75)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      await supabase.from('client_scores').insert({
        user_id: userId,
        conversation_id: conversationId || null,
        score_type: scoreType,
        score,
        notes: notes.trim() || null,
      })
      setSubmitted(true)
      setTimeout(() => {
        setSubmitted(false)
        setScore(75)
        setNotes('')
        setScoreType('project')
        onClose()
      }, 1800)
    } catch {
      // silent fail — don't reveal the scoring system exists
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    if (submitting) return
    setSubmitted(false)
    setScore(75)
    setNotes('')
    setScoreType('project')
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="scoring-overlay"
          variants={VARIANT.FADE}
          initial="hidden"
          animate="visible"
          exit="hidden"
          transition={{ duration: DURATION.FAST, ease: EASE.OUT }}
          onClick={handleClose}
        >
          <motion.div
            className="scoring-modal"
            variants={VARIANT.FADE_SCALE}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: DURATION.NORMAL, ease: EASE.OVERSHOOT }}
            onClick={e => e.stopPropagation()}
          >
            {submitted ? (
              <div className="scoring-success">
                <div className="scoring-success-check">&#10003;</div>
                <p className="scoring-success-text">Score submitted</p>
              </div>
            ) : (
              <>
                <header className="scoring-header">
                  <h2 className="scoring-title">Rate Your Experience</h2>
                  <p className="scoring-subtitle mono">Covers everything in your account — chats, files, and deliverables.</p>
                </header>

                {/* Score Type Selector */}
                <div className="scoring-type-row">
                  {(Object.keys(SCORE_LABELS) as ScoreType[]).map(type => (
                    <button
                      key={type}
                      className={`scoring-type-btn${scoreType === type ? ' active' : ''}`}
                      onClick={() => setScoreType(type)}
                    >
                      {SCORE_LABELS[type]}
                    </button>
                  ))}
                </div>

                <p className="scoring-description">{SCORE_DESCRIPTIONS[scoreType]}</p>

                {/* Score Display */}
                <div className="scoring-display">
                  <span
                    className="scoring-number"
                    style={{ color: getScoreColor(score) }}
                  >
                    {score}
                  </span>
                  <span className="scoring-out-of mono">/100</span>
                </div>
                <p className="scoring-label" style={{ color: getScoreColor(score) }}>
                  {getScoreLabel(score)}
                </p>

                {/* Slider */}
                <div className="scoring-slider-wrap">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={score}
                    onChange={e => setScore(Number(e.target.value))}
                    className="scoring-slider"
                    style={{
                      background: `linear-gradient(to right, ${getScoreColor(score)} ${score}%, var(--rubin-border, #e5e5e5) ${score}%)`,
                    }}
                  />
                  <div className="scoring-slider-labels mono">
                    <span>0</span>
                    <span>25</span>
                    <span>50</span>
                    <span>75</span>
                    <span>100</span>
                  </div>
                </div>

                {/* Notes */}
                <textarea
                  className="scoring-notes"
                  placeholder="Additional notes (optional)"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  maxLength={500}
                />

                {/* Actions */}
                <div className="scoring-actions">
                  <button
                    className="scoring-btn scoring-btn--cancel"
                    onClick={handleClose}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    className="scoring-btn scoring-btn--submit"
                    onClick={handleSubmit}
                    disabled={submitting}
                  >
                    {submitting ? 'Submitting...' : 'Submit Score'}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
