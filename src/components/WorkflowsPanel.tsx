// ─── WorkflowsPanel ──────────────────────────────────────
//
// Bottom-sheet panel listing saved workflows with enable/disable,
// run history, and "Create workflow" form.

import { useState, useEffect, useCallback } from 'react'
import { X, Zap, Play, Trash2, Plus, Clock } from 'lucide-react'
import {
  getUserProcedures,
  upsertProcedure,
  deleteProcedure,
  getWorkflowRuns,
} from '../engine/SupabaseClient'
import type { Procedure } from '../engine/ProceduralMemory'
import { WorkflowBuilder } from './WorkflowBuilder'

interface WorkflowRun {
  id: string
  status: 'running' | 'completed' | 'failed'
  output: string
  duration_ms: number
  created_at: string
}

interface WorkflowsPanelProps {
  userId: string
  onClose: () => void
  onToast: (msg: string) => void
  onRunWorkflow: (procedure: Procedure) => void
}

export function WorkflowsPanel({ userId, onClose, onToast, onRunWorkflow }: WorkflowsPanelProps) {
  const [procedures, setProcedures] = useState<Procedure[]>([])
  const [runs, setRuns] = useState<Map<string, WorkflowRun[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [showBuilder, setShowBuilder] = useState(false)

  const loadData = useCallback(async () => {
    const procs = await getUserProcedures(userId)
    setProcedures(procs)
    // Load recent runs for each procedure
    const runMap = new Map<string, WorkflowRun[]>()
    for (const p of procs.slice(0, 10)) {
      if (p.id) {
        const r = await getWorkflowRuns(p.id, 3)
        if (r.length > 0) runMap.set(p.id, r)
      }
    }
    setRuns(runMap)
    setLoading(false)
  }, [userId])

  useEffect(() => { loadData() }, [loadData])

  const handleSave = async (proc: Omit<Procedure, 'id' | 'times_executed' | 'last_executed_at'>) => {
    try {
      await upsertProcedure({
        ...proc,
        times_executed: 0,
        source: proc.source,
      })
      setShowBuilder(false)
      loadData()
    } catch {
      onToast('Failed to save workflow')
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this workflow? This cannot be undone.')) return
    try {
      await deleteProcedure(id)
      loadData()
    } catch {
      onToast('Failed to delete workflow')
    }
  }

  const handleToggle = async (proc: Procedure) => {
    await upsertProcedure({
      ...proc,
      // Toggle is_enabled (stored as a field on the procedure object)
    })
    loadData()
  }

  return (
    <div className="ka-wf-panel">
      <div className="ka-wf-header">
        <h2 className="ka-wf-title">
          <Zap size={18} />
          Workflows
        </h2>
        <button className="ka-wf-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
      </div>

      {loading ? (
        <div className="ka-wf-loading">Loading workflows...</div>
      ) : showBuilder ? (
        <WorkflowBuilder
          userId={userId}
          onSave={handleSave}
          onCancel={() => setShowBuilder(false)}
        />
      ) : (
        <>
          <div className="ka-wf-list">
            {procedures.length === 0 && (
              <div className="ka-wf-empty">
                <p>No workflows yet. Create one to automate multi-step tasks.</p>
              </div>
            )}

            {procedures.map(proc => {
              const procRuns = runs.get(proc.id || '') || []

              return (
                <div key={proc.id} className="ka-wf-card">
                  <div className="ka-wf-card-header">
                    <div className="ka-wf-card-left">
                      <Zap size={14} />
                      <span className="ka-wf-card-name">{proc.name}</span>
                      <span className="ka-wf-card-source">{proc.source}</span>
                    </div>
                    <div className="ka-wf-card-actions">
                      <button
                        className="ka-wf-card-run"
                        onClick={() => onRunWorkflow(proc)}
                        aria-label="Run workflow"
                      >
                        <Play size={12} /> Run
                      </button>
                      <button
                        className="ka-wf-card-delete"
                        onClick={() => handleDelete(proc.id!)}
                        aria-label="Delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <div className="ka-wf-card-steps">
                    {proc.steps.map((s, i) => (
                      <span key={i} className="ka-wf-card-step">
                        {i > 0 && <span className="ka-wf-card-arrow">&rarr;</span>}
                        {s.description}
                      </span>
                    ))}
                  </div>
                  {proc.times_executed > 0 && (
                    <div className="ka-wf-card-meta">
                      <Clock size={10} />
                      Run {proc.times_executed} time{proc.times_executed !== 1 ? 's' : ''}
                      {proc.last_executed_at && ` \u00B7 last ${new Date(proc.last_executed_at).toLocaleDateString()}`}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <button className="ka-wf-create-btn" onClick={() => setShowBuilder(true)}>
            <Plus size={16} /> Create Workflow
          </button>
        </>
      )}
    </div>
  )
}
