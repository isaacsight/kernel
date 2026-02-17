// ─── WorkflowBuilder ─────────────────────────────────────
//
// Step-by-step builder for creating workflows.
// Each step: description + agent picker. Drag to reorder.

import { useState } from 'react'
import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import type { ProcedureStep, Procedure } from '../engine/ProceduralMemory'
import { getSpecialist } from '../agents/specialists'

interface WorkflowBuilderProps {
  userId: string
  onSave: (procedure: Omit<Procedure, 'id' | 'times_executed' | 'last_executed_at'>) => void
  onCancel: () => void
}

const AGENTS = [
  { id: 'kernel', label: 'Kernel' },
  { id: 'researcher', label: 'Researcher' },
  { id: 'coder', label: 'Coder' },
  { id: 'writer', label: 'Writer' },
  { id: 'analyst', label: 'Analyst' },
]

export function WorkflowBuilder({ userId, onSave, onCancel }: WorkflowBuilderProps) {
  const [name, setName] = useState('')
  const [trigger, setTrigger] = useState('')
  const [description, setDescription] = useState('')
  const [steps, setSteps] = useState<ProcedureStep[]>([
    { description: '', agentId: 'kernel' },
  ])

  const addStep = () => {
    setSteps(prev => [...prev, { description: '', agentId: 'kernel' }])
  }

  const removeStep = (index: number) => {
    if (steps.length <= 1) return
    setSteps(prev => prev.filter((_, i) => i !== index))
  }

  const updateStep = (index: number, field: keyof ProcedureStep, value: string) => {
    setSteps(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s))
  }

  const moveStep = (from: number, to: number) => {
    if (to < 0 || to >= steps.length) return
    setSteps(prev => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  const handleSave = () => {
    if (!name.trim() || steps.every(s => !s.description.trim())) return
    onSave({
      user_id: userId,
      name: name.trim(),
      trigger_phrase: trigger.trim() || name.trim().toLowerCase(),
      steps: steps.filter(s => s.description.trim()),
      source: 'defined',
    })
  }

  return (
    <div className="ka-wf-builder">
      <input
        className="ka-wf-builder-input"
        placeholder="Workflow name..."
        value={name}
        onChange={e => setName(e.target.value)}
        autoFocus
      />
      <input
        className="ka-wf-builder-input ka-wf-builder-input--small"
        placeholder="Trigger phrase (e.g. 'morning briefing')..."
        value={trigger}
        onChange={e => setTrigger(e.target.value)}
      />
      <textarea
        className="ka-wf-builder-textarea"
        placeholder="Description (optional)..."
        value={description}
        onChange={e => setDescription(e.target.value)}
        rows={2}
      />

      <div className="ka-wf-steps-label">Steps</div>
      <div className="ka-wf-steps">
        {steps.map((step, i) => (
          <div key={i} className="ka-wf-step">
            <div className="ka-wf-step-reorder">
              <button
                className="ka-wf-step-move"
                onClick={() => moveStep(i, i - 1)}
                disabled={i === 0}
                aria-label="Move up"
              >
                <ChevronUp size={12} />
              </button>
              <button
                className="ka-wf-step-move"
                onClick={() => moveStep(i, i + 1)}
                disabled={i === steps.length - 1}
                aria-label="Move down"
              >
                <ChevronDown size={12} />
              </button>
            </div>
            <span className="ka-wf-step-num">{i + 1}</span>
            <input
              className="ka-wf-step-input"
              placeholder="What should this step do?"
              value={step.description}
              onChange={e => updateStep(i, 'description', e.target.value)}
            />
            <select
              className="ka-wf-step-agent"
              value={step.agentId}
              onChange={e => updateStep(i, 'agentId', e.target.value)}
            >
              {AGENTS.map(a => (
                <option key={a.id} value={a.id}>{a.label}</option>
              ))}
            </select>
            {steps.length > 1 && (
              <button className="ka-wf-step-remove" onClick={() => removeStep(i)}>
                <Trash2 size={12} />
              </button>
            )}
          </div>
        ))}
      </div>

      <button className="ka-wf-add-step" onClick={addStep}>
        <Plus size={14} /> Add step
      </button>

      <div className="ka-wf-builder-btns">
        <button className="ka-wf-builder-save" onClick={handleSave} disabled={!name.trim()}>
          Create Workflow
        </button>
        <button className="ka-wf-builder-cancel" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}
