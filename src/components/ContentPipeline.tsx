// ─── Content Pipeline ───────────────────────────────────────────
//
// Stage visualization for the Content Engine. Renders as a vertical
// timeline in chat, similar to WorkflowTimeline. Shows pipeline stages
// with approve/edit/skip actions at pause points.

import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import type { ContentStageState, ContentStage } from '../engine/content/types'

interface ContentPipelineProps {
  stages: ContentStageState[]
  isActive: boolean
  onApprove?: (stage: ContentStage) => void
  onEdit?: (stage: ContentStage, feedback: string) => void
  onSkip?: (stage: ContentStage) => void
  onCancel?: () => void
  onPublish?: () => void
  publishedSlug?: string | null
  isPublishing?: boolean
  onDistribute?: () => void
}

const STAGE_LABELS: Record<ContentStage, string> = {
  ideation: 'Ideation',
  research: 'Research',
  outline: 'Outline',
  draft: 'Draft',
  edit: 'Edit & Polish',
  publish: 'Publish Strategy',
}

const STAGE_DESCRIPTIONS: Record<ContentStage, string> = {
  ideation: 'Brainstorming angles and hooks',
  research: 'Gathering facts and evidence',
  outline: 'Structuring the content',
  draft: 'Writing the full piece',
  edit: 'Polishing for publication',
  publish: 'Distribution strategy',
}

const stepVariants = {
  initial: { opacity: 0, x: -8 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 8 },
}

function StageIndicator({ status }: { status: ContentStageState['status'] }) {
  switch (status) {
    case 'approved':
      return <span className="ka-content-stage-indicator ka-content-stage-indicator--approved" aria-label="Approved">{'\u2713'}</span>
    case 'failed':
      return <span className="ka-content-stage-indicator ka-content-stage-indicator--failed" aria-label="Failed">{'\u2717'}</span>
    case 'active':
      return <span className="ka-content-stage-indicator ka-content-stage-indicator--active" aria-label="Active" />
    case 'awaiting_approval':
      return <span className="ka-content-stage-indicator ka-content-stage-indicator--awaiting" aria-label="Awaiting approval">{'\u25CF'}</span>
    case 'skipped':
      return <span className="ka-content-stage-indicator ka-content-stage-indicator--skipped" aria-label="Skipped">{'\u2014'}</span>
    default:
      return <span className="ka-content-stage-indicator ka-content-stage-indicator--pending" aria-label="Pending" />
  }
}

export function ContentPipeline({
  stages,
  isActive,
  onApprove,
  onEdit,
  onSkip,
  onCancel,
  onPublish,
  publishedSlug,
  isPublishing,
  onDistribute,
}: ContentPipelineProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [editingStage, setEditingStage] = useState<ContentStage | null>(null)
  const [editFeedback, setEditFeedback] = useState('')
  const [copied, setCopied] = useState(false)

  if (stages.length === 0) return null

  const approvedCount = stages.filter(s => s.status === 'approved').length
  const awaitingStage = stages.find(s => s.status === 'awaiting_approval')
  const activeStage = stages.find(s => s.status === 'active')
  const failedCount = stages.filter(s => s.status === 'failed').length

  const handleEditSubmit = (stage: ContentStage) => {
    if (editFeedback.trim()) {
      onEdit?.(stage, editFeedback.trim())
      setEditingStage(null)
      setEditFeedback('')
    }
  }

  return (
    <div className="ka-content-pipeline" role="status" aria-live="polite">
      <button
        className="ka-content-pipeline-header"
        onClick={() => setCollapsed(c => !c)}
        aria-expanded={!collapsed}
      >
        <span className="ka-content-pipeline-title">
          {isActive
            ? activeStage
              ? `Creating: ${STAGE_LABELS[activeStage.stage]}`
              : awaitingStage
                ? `Review: ${STAGE_LABELS[awaitingStage.stage]}`
                : 'Content Pipeline'
            : failedCount > 0
              ? 'Pipeline Failed'
              : 'Content Complete'
          }
        </span>
        <span className="ka-content-pipeline-count">
          {approvedCount}/{stages.length}
        </span>
        <span className={`ka-content-pipeline-chevron ${collapsed ? '' : 'ka-content-pipeline-chevron--open'}`}>
          {'\u25B8'}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            className="ka-content-pipeline-stages"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
          >
            {stages.map((stage, i) => (
              <motion.div
                key={stage.stage}
                className={`ka-content-stage ka-content-stage--${stage.status}`}
                variants={stepVariants}
                initial="initial"
                animate="animate"
                transition={{ delay: i * 0.05, duration: 0.2 }}
              >
                <div className="ka-content-stage-line-wrap">
                  <StageIndicator status={stage.status} />
                  {i < stages.length - 1 && (
                    <div className={`ka-content-stage-connector ${
                      stage.status === 'approved' ? 'ka-content-stage-connector--done' : ''
                    }`} />
                  )}
                </div>
                <div className="ka-content-stage-content">
                  <span className="ka-content-stage-name">{STAGE_LABELS[stage.stage]}</span>
                  <span className="ka-content-stage-desc">{STAGE_DESCRIPTIONS[stage.stage]}</span>

                  {/* Show output preview for completed or awaiting stages */}
                  {stage.output && (stage.status === 'approved' || stage.status === 'awaiting_approval') && (
                    <span className="ka-content-stage-result">
                      {stage.output.length > 200 ? stage.output.slice(0, 200) + '...' : stage.output}
                    </span>
                  )}

                  {/* Support agent perspectives */}
                  {stage.supportOutputs && Object.keys(stage.supportOutputs).length > 0 && (
                    <div className="ka-content-stage-support">
                      {Object.entries(stage.supportOutputs).map(([agentId, output]) => (
                        <span key={agentId} className="ka-content-stage-support-item">
                          <strong>{agentId}:</strong> {output}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Error display */}
                  {stage.error && stage.status === 'failed' && (
                    <span className="ka-content-stage-error">{stage.error}</span>
                  )}

                  {/* Approval actions */}
                  {stage.status === 'awaiting_approval' && editingStage !== stage.stage && (
                    <div className="ka-content-stage-actions">
                      <button
                        className="ka-content-stage-btn ka-content-stage-btn--approve"
                        onClick={() => onApprove?.(stage.stage)}
                      >
                        Approve
                      </button>
                      <button
                        className="ka-content-stage-btn ka-content-stage-btn--edit"
                        onClick={() => setEditingStage(stage.stage)}
                      >
                        Edit
                      </button>
                      <button
                        className="ka-content-stage-btn ka-content-stage-btn--skip"
                        onClick={() => onSkip?.(stage.stage)}
                      >
                        Skip
                      </button>
                    </div>
                  )}

                  {/* Inline edit feedback */}
                  {editingStage === stage.stage && (
                    <div className="ka-content-stage-edit">
                      <textarea
                        className="ka-content-stage-textarea"
                        value={editFeedback}
                        onChange={e => setEditFeedback(e.target.value)}
                        placeholder="What would you like changed?"
                        rows={3}
                        autoFocus
                      />
                      <div className="ka-content-stage-edit-actions">
                        <button
                          className="ka-content-stage-btn ka-content-stage-btn--approve"
                          onClick={() => handleEditSubmit(stage.stage)}
                          disabled={!editFeedback.trim()}
                        >
                          Submit
                        </button>
                        <button
                          className="ka-content-stage-btn ka-content-stage-btn--skip"
                          onClick={() => { setEditingStage(null); setEditFeedback('') }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {isActive && onCancel && (
        <button
          className="ka-content-pipeline-cancel"
          onClick={onCancel}
          aria-label="Cancel pipeline"
        >
          Cancel Pipeline
        </button>
      )}

      {/* Publish button — shown when pipeline is complete */}
      {!isActive && failedCount === 0 && approvedCount === stages.length && !publishedSlug && onPublish && (
        <button
          className="ka-content-pipeline-publish"
          onClick={onPublish}
          disabled={isPublishing}
        >
          {isPublishing ? 'Publishing...' : 'Publish to Kernel'}
        </button>
      )}

      {/* Published URL with copy button */}
      {publishedSlug && (
        <div className="ka-content-pipeline-published">
          <span className="ka-content-pipeline-published-label">Published</span>
          <a
            href={`/#/p/${publishedSlug}`}
            className="ka-content-pipeline-published-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            kernel.chat/#/p/{publishedSlug}
          </a>
          <button
            className="ka-content-pipeline-copy"
            onClick={() => {
              navigator.clipboard.writeText(`https://kernel.chat/#/p/${publishedSlug}`)
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      )}

      {/* Distribute to social media */}
      {publishedSlug && onDistribute && (
        <button
          className="ka-content-pipeline-distribute"
          onClick={onDistribute}
        >
          Distribute to Social
        </button>
      )}
    </div>
  )
}
