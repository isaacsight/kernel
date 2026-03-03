// ─── AgentWorkflowBuilder — Visual Workflow Editor ───────────
//
// Bottom-sheet for creating multi-step agent workflows.
// Users can add steps, reorder them, and configure each step.

import { useState } from 'react'
import { motion, useDragControls, Reorder } from 'framer-motion'
import { SPRING } from '../constants/motion'
import type { CustomAgent } from '../engine/agent/types'

interface WorkflowStep {
  id: string
  agent_id: string
  action: string
  input_map: Record<string, string>
  order: number
}

interface AgentWorkflowBuilderProps {
  availableAgents: CustomAgent[]
  onSave: (data: {
    name: string
    description: string
    steps: WorkflowStep[]
  }) => void
  onClose: () => void
}

function generateStepId(): string {
  return `step_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function AgentWorkflowBuilder({
  availableAgents,
  onSave,
  onClose,
}: AgentWorkflowBuilderProps) {
  const dragControls = useDragControls()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [steps, setSteps] = useState<WorkflowStep[]>([])
  const [expandedStep, setExpandedStep] = useState<string | null>(null)

  const addStep = () => {
    const newStep: WorkflowStep = {
      id: generateStepId(),
      agent_id: availableAgents[0]?.id ?? '',
      action: '',
      input_map: {},
      order: steps.length,
    }
    setSteps(prev => [...prev, newStep])
    setExpandedStep(newStep.id)
  }

  const removeStep = (id: string) => {
    setSteps(prev =>
      prev.filter(s => s.id !== id).map((s, i) => ({ ...s, order: i }))
    )
    if (expandedStep === id) setExpandedStep(null)
  }

  const updateStep = (id: string, updates: Partial<WorkflowStep>) => {
    setSteps(prev =>
      prev.map(s => s.id === id ? { ...s, ...updates } : s)
    )
  }

  const handleReorder = (reordered: WorkflowStep[]) => {
    setSteps(reordered.map((s, i) => ({ ...s, order: i })))
  }

  const handleSave = () => {
    if (!name.trim() || steps.length === 0) return
    onSave({
      name: name.trim(),
      description: description.trim(),
      steps: steps.map((s, i) => ({ ...s, order: i })),
    })
  }

  const isValid = name.trim().length > 0 && steps.length > 0

  const getAgentName = (agentId: string): string => {
    return availableAgents.find(a => a.id === agentId)?.name ?? 'Unknown'
  }

  return (
    <motion.div
      className="ka-agent-workflow-panel"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={SPRING.DEFAULT}
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
        className="ka-agent-workflow-handle"
        onPointerDown={(e) => dragControls.start(e)}
      >
        <div className="ka-agent-workflow-handle-bar" />
      </div>

      {/* Header */}
      <div className="ka-agent-workflow-header">
        <h3 className="ka-agent-workflow-title">Build Workflow</h3>
        <button className="ka-agent-workflow-close" onClick={onClose}>
          Cancel
        </button>
      </div>

      <div className="ka-agent-workflow-body">
        {/* Name & Description */}
        <div className="ka-agent-workflow-section">
          <input
            className="ka-agent-workflow-name-input"
            type="text"
            placeholder="Workflow name"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={60}
          />
          <textarea
            className="ka-agent-workflow-desc-input"
            placeholder="Describe what this workflow does..."
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
          />
        </div>

        {/* Steps */}
        <div className="ka-agent-workflow-section">
          <div className="ka-agent-workflow-steps-header">
            <label className="ka-agent-workflow-label">Steps</label>
            <button className="ka-agent-workflow-add-step" onClick={addStep}>
              + Add Step
            </button>
          </div>

          {steps.length === 0 ? (
            <div className="ka-agent-workflow-empty">
              Add steps to build your workflow
            </div>
          ) : (
            <Reorder.Group
              axis="y"
              values={steps}
              onReorder={handleReorder}
              className="ka-agent-workflow-step-list"
            >
              {steps.map((step, index) => (
                <Reorder.Item
                  key={step.id}
                  value={step}
                  className="ka-agent-workflow-step"
                >
                  <div
                    className="ka-agent-workflow-step-header"
                    onClick={() => setExpandedStep(
                      expandedStep === step.id ? null : step.id
                    )}
                  >
                    <span className="ka-agent-workflow-step-number">
                      {index + 1}
                    </span>
                    <span className="ka-agent-workflow-step-summary">
                      {step.agent_id
                        ? `${getAgentName(step.agent_id)}${step.action ? `: ${step.action}` : ''}`
                        : 'Configure step...'}
                    </span>
                    <button
                      className="ka-agent-workflow-step-remove"
                      onClick={(e) => { e.stopPropagation(); removeStep(step.id) }}
                    >
                      x
                    </button>
                  </div>

                  {expandedStep === step.id && (
                    <div className="ka-agent-workflow-step-config">
                      <select
                        className="ka-agent-workflow-step-select"
                        value={step.agent_id}
                        onChange={e => updateStep(step.id, { agent_id: e.target.value })}
                      >
                        <option value="">Select agent</option>
                        {availableAgents.map(a => (
                          <option key={a.id} value={a.id}>
                            {a.icon} {a.name}
                          </option>
                        ))}
                      </select>
                      <input
                        className="ka-agent-workflow-step-action"
                        type="text"
                        placeholder="Action description"
                        value={step.action}
                        onChange={e => updateStep(step.id, { action: e.target.value })}
                      />
                      {index > 0 && (
                        <div className="ka-agent-workflow-step-mapping">
                          <label className="ka-agent-workflow-step-mapping-label">
                            Input from step {index}:
                          </label>
                          <input
                            className="ka-agent-workflow-step-mapping-input"
                            type="text"
                            placeholder="e.g. output, summary"
                            value={step.input_map['previous'] ?? ''}
                            onChange={e => updateStep(step.id, {
                              input_map: { ...step.input_map, previous: e.target.value },
                            })}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </Reorder.Item>
              ))}
            </Reorder.Group>
          )}
        </div>

        {/* Submit */}
        <button
          className="ka-agent-workflow-submit"
          disabled={!isValid}
          onClick={handleSave}
        >
          Create Workflow
        </button>
      </div>
    </motion.div>
  )
}
