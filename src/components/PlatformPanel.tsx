// ─── PlatformPanel — Unified Content Orchestrator UI ─────────────
//
// Bottom-sheet panel showing the platform engine's 6-phase pipeline.
// Phase-specific views: brief editor, content pipeline, score card,
// adapted content cards, distribution summary, and analytics.

import { useState } from 'react'
import { motion, AnimatePresence, useDragControls } from 'motion/react'
import { SPRING } from '../constants/motion'
import { ContentPipeline } from './ContentPipeline'
import type {
  PlatformPhase,
  PlatformPhaseState,
  PlatformPhaseStatus,
  BriefPhaseOutput,
  ScorePhaseOutput,
  AdaptPhaseOutput,
  DistributePhaseOutput,
  MonitorPhaseOutput,
} from '../engine/platform/types'
import type { ContentStage, ContentStageState } from '../engine/content/types'

// ─── Phase Labels & Icons ──────────────────────────────────────

const PHASE_LABELS: Record<PlatformPhase, string> = {
  brief: 'Brief',
  create: 'Create',
  score: 'Score',
  adapt: 'Adapt',
  distribute: 'Distribute',
  monitor: 'Monitor',
}

const PHASE_DESCRIPTIONS: Record<PlatformPhase, string> = {
  brief: 'Knowledge-enriched ideation',
  create: 'Multi-stage content pipeline',
  score: 'Algorithm scoring & recommendations',
  adapt: 'Platform-specific adaptation',
  distribute: 'Publish to platforms',
  monitor: 'Analytics & feedback loop',
}

function PhaseStatusIcon({ status }: { status: PlatformPhaseStatus }) {
  switch (status) {
    case 'approved':
      return <span className="ka-platform-phase-icon ka-platform-phase-icon--done">&#10003;</span>
    case 'failed':
      return <span className="ka-platform-phase-icon ka-platform-phase-icon--failed">&#10007;</span>
    case 'active':
      return <span className="ka-platform-phase-icon ka-platform-phase-icon--active" />
    case 'awaiting_approval':
      return <span className="ka-platform-phase-icon ka-platform-phase-icon--review" />
    case 'skipped':
      return <span className="ka-platform-phase-icon ka-platform-phase-icon--skipped">&mdash;</span>
    default:
      return <span className="ka-platform-phase-icon ka-platform-phase-icon--pending" />
  }
}

// ─── Score Card ────────────────────────────────────────────────

function ScoreCard({ output }: { output: ScorePhaseOutput }) {
  const { score, recommendations } = output
  return (
    <div className="ka-platform-score-card">
      <div className="ka-platform-score-composite">
        <span className="ka-platform-score-value">{Math.round(score.composite * 100)}</span>
        <span className="ka-platform-score-label">/ 100</span>
      </div>
      <div className="ka-platform-score-dimensions">
        {score.dimensions.map(d => (
          <div key={d.dimension} className="ka-platform-score-bar">
            <span className="ka-platform-score-bar-label">{d.dimension}</span>
            <div className="ka-platform-score-bar-track">
              <div className="ka-platform-score-bar-fill" style={{ width: `${d.score * 100}%` }} />
            </div>
            <span className="ka-platform-score-bar-value">{Math.round(d.score * 100)}</span>
          </div>
        ))}
      </div>
      {recommendations.length > 0 && (
        <div className="ka-platform-recommendations">
          <h4 className="ka-platform-recommendations-title">Distribution recommendations</h4>
          {recommendations.map(r => (
            <div key={r.platform} className="ka-platform-recommendation">
              <span className="ka-platform-recommendation-platform">{r.platform}</span>
              <span className="ka-platform-recommendation-score">{Math.round(r.score * 100)}%</span>
              <p className="ka-platform-recommendation-reason">{r.reasoning}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Adapt Cards ───────────────────────────────────────────────

function AdaptCards({
  output,
  onEdit,
}: {
  output: AdaptPhaseOutput
  onEdit: (platform: string, body: string) => void
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  return (
    <div className="ka-platform-adapt-cards">
      {output.adaptations.map(a => (
        <div key={a.platform} className="ka-platform-adapt-card">
          <div className="ka-platform-adapt-card-header">
            <span className="ka-platform-adapt-card-platform">{a.platform}</span>
            {a.approved && <span className="ka-platform-adapt-card-badge">Approved</span>}
          </div>
          {editing === a.platform ? (
            <div className="ka-platform-adapt-card-edit">
              <textarea
                className="ka-platform-adapt-textarea"
                value={editText}
                onChange={e => setEditText(e.target.value)}
                rows={4}
              />
              <div className="ka-platform-adapt-card-actions">
                <button className="ka-platform-btn ka-platform-btn--sm" onClick={() => { onEdit(a.platform, editText); setEditing(null) }}>Save</button>
                <button className="ka-platform-btn ka-platform-btn--sm ka-platform-btn--ghost" onClick={() => setEditing(null)}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <p className="ka-platform-adapt-card-body">{a.adapted.body}</p>
              {a.adapted.hashtags.length > 0 && (
                <div className="ka-platform-adapt-card-tags">
                  {a.adapted.hashtags.map(h => <span key={h} className="ka-platform-adapt-tag">#{h}</span>)}
                </div>
              )}
              <button className="ka-platform-btn ka-platform-btn--sm ka-platform-btn--ghost" onClick={() => { setEditing(a.platform); setEditText(a.adapted.body) }}>Edit</button>
            </>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Distribute Summary ────────────────────────────────────────

function DistributeSummary({ output }: { output: DistributePhaseOutput }) {
  return (
    <div className="ka-platform-distribute-summary">
      {output.published.map((r, i) => (
        <div key={i} className={`ka-platform-distribute-item ka-platform-distribute-item--${r.status}`}>
          <span className="ka-platform-distribute-platform">{r.platform}</span>
          <span className={`ka-platform-distribute-status ka-platform-distribute-status--${r.status}`}>{r.status}</span>
          {r.platformUrl && (
            <a className="ka-platform-distribute-link" href={r.platformUrl} target="_blank" rel="noopener noreferrer">View</a>
          )}
          {r.error && <span className="ka-platform-distribute-error">{r.error}</span>}
        </div>
      ))}
    </div>
  )
}

// ─── Monitor Snapshot ──────────────────────────────────────────

function MonitorView({ output }: { output: MonitorPhaseOutput }) {
  if (output.snapshots.length === 0) {
    return <p className="ka-platform-monitor-empty">Analytics will appear once content accumulates engagement.</p>
  }
  return (
    <div className="ka-platform-monitor-grid">
      {output.snapshots.map((s, i) => (
        <div key={i} className="ka-platform-monitor-card">
          <span className="ka-platform-monitor-platform">{s.platform}</span>
          <div className="ka-platform-monitor-stats">
            <span>{s.impressions} views</span>
            <span>{s.likes} likes</span>
            <span>{s.reposts} reposts</span>
            <span>{s.replies} replies</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main Panel ────────────────────────────────────────────────

interface PlatformPanelProps {
  isOpen: boolean
  onClose: () => void
  phases: PlatformPhaseState[]
  contentStages: ContentStageState[]
  onApprovePhase: (phase: PlatformPhase) => void
  onEditPhase: (phase: PlatformPhase, feedback: string) => void
  onSkipPhase: (phase: PlatformPhase) => void
  onApproveContentStage: () => void
  onEditContentStage: (feedback: string) => void
  onUpdateAdaptation: (platform: string, body: string) => void
  onCancel: () => void
}

export function PlatformPanel({
  isOpen,
  onClose,
  phases,
  contentStages,
  onApprovePhase,
  onEditPhase,
  onSkipPhase,
  onApproveContentStage,
  onEditContentStage,
  onUpdateAdaptation,
  onCancel,
}: PlatformPanelProps) {
  const dragControls = useDragControls()
  const [editingPhase, setEditingPhase] = useState<PlatformPhase | null>(null)
  const [editFeedback, setEditFeedback] = useState('')

  if (!isOpen) return null

  const activePhase = phases.find(p => p.status === 'active' || p.status === 'awaiting_approval')
  const completedCount = phases.filter(p => p.status === 'approved' || p.status === 'skipped').length
  const isComplete = phases.every(p => p.status === 'approved' || p.status === 'skipped' || p.status === 'failed')

  return (
    <>
      <motion.div
        className="ka-platform-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="ka-platform-panel"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={SPRING.DEFAULT}
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0 }}
        dragElastic={{ top: 0, bottom: 0.2 }}
        onDragEnd={(_, info) => { if (info.offset.y > 80 || info.velocity.y > 300) onClose() }}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <div className="ka-platform-drag-handle" onPointerDown={(e) => dragControls.start(e)} />

        <div className="ka-platform-header">
          <h3 className="ka-platform-title">Content Pipeline</h3>
          <span className="ka-platform-progress">
            {isComplete ? 'Complete' : activePhase ? PHASE_LABELS[activePhase.phase] : `${completedCount}/${phases.length}`}
          </span>
        </div>

        {/* Phase Timeline */}
        <div className="ka-platform-timeline" role="status" aria-live="polite">
          {phases.map((p, i) => (
            <div key={p.phase} className={`ka-platform-phase ka-platform-phase--${p.status}`}>
              {i > 0 && <div className={`ka-platform-connector${p.status === 'approved' || p.status === 'skipped' ? ' ka-platform-connector--done' : ''}`} />}
              <div className="ka-platform-phase-row">
                <PhaseStatusIcon status={p.status} />
                <div className="ka-platform-phase-info">
                  <span className="ka-platform-phase-label">{PHASE_LABELS[p.phase]}</span>
                  <span className="ka-platform-phase-desc">{PHASE_DESCRIPTIONS[p.phase]}</span>
                </div>
              </div>

              {/* Phase-specific content */}
              <AnimatePresence>
                {(p.status === 'active' || p.status === 'awaiting_approval') && (
                  <motion.div
                    className="ka-platform-phase-detail"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                  >
                    {/* Create phase: embed ContentPipeline */}
                    {p.phase === 'create' && contentStages.length > 0 && (
                      <ContentPipeline
                        stages={contentStages}
                        isActive={p.status === 'active'}
                        onApprove={() => onApproveContentStage()}
                        onEdit={(_stage: ContentStage, feedback: string) => onEditContentStage(feedback)}
                        onSkip={() => onApproveContentStage()}
                      />
                    )}

                    {/* Score phase */}
                    {p.phase === 'score' && p.output && (
                      <ScoreCard output={p.output as ScorePhaseOutput} />
                    )}

                    {/* Adapt phase */}
                    {p.phase === 'adapt' && p.output && (
                      <AdaptCards
                        output={p.output as AdaptPhaseOutput}
                        onEdit={onUpdateAdaptation}
                      />
                    )}

                    {/* Distribute phase */}
                    {p.phase === 'distribute' && p.output && (
                      <DistributeSummary output={p.output as DistributePhaseOutput} />
                    )}

                    {/* Monitor phase */}
                    {p.phase === 'monitor' && p.output && (
                      <MonitorView output={p.output as MonitorPhaseOutput} />
                    )}

                    {/* Approval actions */}
                    {p.status === 'awaiting_approval' && p.phase !== 'create' && (
                      <div className="ka-platform-actions">
                        {editingPhase === p.phase ? (
                          <div className="ka-platform-edit-area">
                            <textarea
                              className="ka-platform-edit-textarea"
                              value={editFeedback}
                              onChange={e => setEditFeedback(e.target.value)}
                              placeholder="Your feedback..."
                              rows={3}
                            />
                            <div className="ka-platform-edit-btns">
                              <button className="ka-platform-btn" onClick={() => { onEditPhase(p.phase, editFeedback); setEditingPhase(null); setEditFeedback('') }}>Submit</button>
                              <button className="ka-platform-btn ka-platform-btn--ghost" onClick={() => setEditingPhase(null)}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <button className="ka-platform-btn" onClick={() => onApprovePhase(p.phase)}>Approve</button>
                            <button className="ka-platform-btn ka-platform-btn--ghost" onClick={() => setEditingPhase(p.phase)}>Edit</button>
                            <button className="ka-platform-btn ka-platform-btn--ghost" onClick={() => onSkipPhase(p.phase)}>Skip</button>
                          </>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>

        {/* Cancel button */}
        {!isComplete && (
          <button className="ka-platform-cancel" onClick={onCancel}>Cancel workflow</button>
        )}
      </motion.div>
    </>
  )
}
