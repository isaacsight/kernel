// ─── Workflow Timeline ─────────────────────────────────────
//
// Displays agentic workflow execution progress as a vertical timeline.
// Each step shows its status (pending, active, complete, failed, skipped)
// with animated transitions. Collapsible for compact viewing.

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import type { WorkflowStepState } from '../hooks/useChatEngine'

interface WorkflowTimelineProps {
  steps: WorkflowStepState[]
  isActive: boolean
  onCancel?: () => void
}

const stepVariants = {
  initial: { opacity: 0, x: -8 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 8 },
}

function StepIndicator({ status }: { status: WorkflowStepState['status'] }) {
  switch (status) {
    case 'complete':
      return <span className="ka-workflow-step-indicator ka-workflow-step-indicator--complete" aria-label="Complete">{'\u2713'}</span>
    case 'failed':
      return <span className="ka-workflow-step-indicator ka-workflow-step-indicator--failed" aria-label="Failed">{'\u2717'}</span>
    case 'active':
      return <span className="ka-workflow-step-indicator ka-workflow-step-indicator--active" aria-label="Active" />
    case 'skipped':
      return <span className="ka-workflow-step-indicator ka-workflow-step-indicator--skipped" aria-label="Skipped">{'\u2014'}</span>
    default:
      return <span className="ka-workflow-step-indicator ka-workflow-step-indicator--pending" aria-label="Pending" />
  }
}

export function WorkflowTimeline({ steps, isActive, onCancel }: WorkflowTimelineProps) {
  const { t } = useTranslation('home')
  const [collapsed, setCollapsed] = useState(false)

  if (steps.length === 0) return null

  const completedCount = steps.filter(s => s.status === 'complete').length
  const failedCount = steps.filter(s => s.status === 'failed').length
  const activeStep = steps.find(s => s.status === 'active')

  return (
    <div className="ka-workflow-timeline" role="status" aria-live="polite">
      <button
        className="ka-workflow-timeline-header"
        onClick={() => setCollapsed(c => !c)}
        aria-expanded={!collapsed}
      >
        <span className="ka-workflow-timeline-title">
          {isActive
            ? activeStep
              ? t('workflow.executing', { step: activeStep.name })
              : t('workflow.planning')
            : failedCount > 0
              ? t('workflow.failed', { step: `${failedCount} step${failedCount > 1 ? 's' : ''}` })
              : t('workflow.complete')
          }
        </span>
        <span className="ka-workflow-timeline-count">
          {completedCount}/{steps.length}
        </span>
        <span className={`ka-workflow-timeline-chevron ${collapsed ? '' : 'ka-workflow-timeline-chevron--open'}`}>
          {'\u25B8'}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            className="ka-workflow-steps"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
          >
            {steps.map((step, i) => (
              <motion.div
                key={`${step.name}-${i}`}
                className={`ka-workflow-step ka-workflow-step--${step.status}`}
                variants={stepVariants}
                initial="initial"
                animate="animate"
                transition={{ delay: i * 0.05, duration: 0.2 }}
              >
                <div className="ka-workflow-step-line-wrap">
                  <StepIndicator status={step.status} />
                  {i < steps.length - 1 && (
                    <div className={`ka-workflow-step-connector ${
                      step.status === 'complete' ? 'ka-workflow-step-connector--done' : ''
                    }`} />
                  )}
                </div>
                <div className="ka-workflow-step-content">
                  <span className="ka-workflow-step-name">{step.name}</span>
                  {step.result && step.status === 'complete' && (
                    <span className="ka-workflow-step-result">
                      {step.result.length > 120 ? step.result.slice(0, 120) + '...' : step.result}
                    </span>
                  )}
                  {step.error && step.status === 'failed' && (
                    <span className="ka-workflow-step-error">{step.error}</span>
                  )}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {isActive && onCancel && (
        <button
          className="ka-workflow-cancel"
          onClick={onCancel}
          aria-label={t('workflow.cancel')}
        >
          {t('workflow.cancel')}
        </button>
      )}
    </div>
  )
}
