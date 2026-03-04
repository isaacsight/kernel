// ─── MasterPlanPanel — Plan Visualization Bottom Sheet ───────
//
// Shows the Master Agent's current execution plan as a step graph.
// Each step displays its engine, action, status, and data flow.

import { motion, useDragControls } from 'motion/react'
import { SPRING } from '../constants/motion'
import type { EnginePlan, EnginePlanStep } from '../engine/master/types'

interface MasterPlanPanelProps {
  plan: EnginePlan
  activeStepId: string | null
  onClose: () => void
}

// ─── Step Status Icons ────────────────────────────────────────

function StepStatusIcon({ status }: { status: EnginePlanStep['status'] }) {
  switch (status) {
    case 'completed':
      return <span className="ka-master-step-icon ka-master-step-icon--done">&#10003;</span>
    case 'failed':
      return <span className="ka-master-step-icon ka-master-step-icon--failed">&#10007;</span>
    case 'running':
      return <span className="ka-master-step-icon ka-master-step-icon--active" />
    case 'skipped':
      return <span className="ka-master-step-icon ka-master-step-icon--skipped">&mdash;</span>
    default:
      return <span className="ka-master-step-icon ka-master-step-icon--pending" />
  }
}

// ─── Engine Labels ────────────────────────────────────────────

const ENGINE_LABELS: Record<string, string> = {
  content: 'Content',
  knowledge: 'Knowledge',
  algorithm: 'Algorithm',
  platform: 'Platform',
  research: 'Research',
  swarm: 'Swarm',
  memory: 'Memory',
  image: 'Image',
  publishing: 'Publishing',
  agents: 'Agents',
  autonomous: 'Autonomous',
  architecture: 'Architecture',
  design: 'Design',
  system: 'System',
  computer: 'Computer',
}

const ENGINE_COLORS: Record<string, string> = {
  content: '#B8875C',
  knowledge: '#5B8BA0',
  algorithm: '#A0768C',
  platform: '#6B5B95',
  research: '#5B8BA0',
  swarm: '#6B8E6B',
  memory: '#6B5B95',
  image: '#F59E0B',
  publishing: '#8B5CF6',
  agents: '#10B981',
  autonomous: '#F472B6',
  architecture: '#6B8E6B',
  design: '#F472B6',
  system: '#A0768C',
  computer: '#6B8E6B',
}

// ─── Duration formatter ───────────────────────────────────────

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

// ─── Component ────────────────────────────────────────────────

export function MasterPlanPanel({ plan, activeStepId, onClose }: MasterPlanPanelProps) {
  const dragControls = useDragControls()

  const completedSteps = plan.steps.filter(s => s.status === 'completed').length
  const totalSteps = plan.steps.length
  const progressPct = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0

  return (
    <motion.div
      className="ka-master-panel"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={SPRING}
      drag="y"
      dragControls={dragControls}
      dragConstraints={{ top: 0 }}
      dragElastic={0.1}
      onDragEnd={(_, info) => {
        if (info.offset.y > 100) onClose()
      }}
    >
      {/* Handle */}
      <div
        className="ka-master-panel-handle"
        onPointerDown={(e) => dragControls.start(e)}
      >
        <div className="ka-master-panel-handle-bar" />
      </div>

      {/* Header */}
      <div className="ka-master-panel-header">
        <div className="ka-master-panel-header-top">
          <h3 className="ka-master-panel-title">Execution Plan</h3>
          <span className={`ka-master-panel-state ka-master-panel-state--${plan.state}`}>
            {plan.state}
          </span>
        </div>
        {plan.reasoning && (
          <p className="ka-master-panel-reasoning">{plan.reasoning}</p>
        )}
        {totalSteps > 0 && (
          <div className="ka-master-panel-progress">
            <div className="ka-master-panel-progress-track">
              <div
                className="ka-master-panel-progress-fill"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="ka-master-panel-progress-label">
              {completedSteps}/{totalSteps} steps
            </span>
          </div>
        )}
      </div>

      {/* Steps */}
      <div className="ka-master-panel-steps">
        {plan.steps.map((step, i) => {
          const isActive = step.id === activeStepId
          const color = ENGINE_COLORS[step.engineId] || '#6B5B95'
          const duration = step.startedAt && step.completedAt
            ? formatDuration(step.completedAt - step.startedAt)
            : null

          return (
            <div key={step.id}>
              {/* Connector line */}
              {i > 0 && (
                <div className="ka-master-step-connector">
                  <div
                    className="ka-master-step-connector-line"
                    style={{
                      backgroundColor: step.status === 'completed' ? color : 'var(--dark-border-subtle, #e0e0e0)',
                    }}
                  />
                </div>
              )}

              {/* Step card */}
              <div
                className={`ka-master-step ${isActive ? 'ka-master-step--active' : ''} ka-master-step--${step.status}`}
                style={{ '--step-color': color } as React.CSSProperties}
              >
                <div className="ka-master-step-header">
                  <StepStatusIcon status={step.status} />
                  <div className="ka-master-step-engine" style={{ color }}>
                    {ENGINE_LABELS[step.engineId] || step.engineId}
                  </div>
                  <div className="ka-master-step-action">{step.action}</div>
                  {duration && (
                    <span className="ka-master-step-duration">{duration}</span>
                  )}
                </div>
                {step.error && (
                  <div className="ka-master-step-error">{step.error}</div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Timing */}
      {plan.completedAt && (
        <div className="ka-master-panel-footer">
          Total: {formatDuration(plan.completedAt - plan.createdAt)}
        </div>
      )}
    </motion.div>
  )
}
