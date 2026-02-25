// ─── WorkflowsPanel ──────────────────────────────────────
//
// Bottom-sheet panel listing saved workflows with enable/disable,
// run history, and "Create workflow" form.

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { IconClose, IconZap, IconPlay, IconTrash, IconPlus, IconClock } from './KernelIcons'
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
  const { t } = useTranslation('panels')
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
      onToast(t('workflows.errors.saveFailed'))
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('workflows.deleteConfirm'))) return
    try {
      await deleteProcedure(id)
      loadData()
    } catch {
      onToast(t('workflows.errors.deleteFailed'))
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
      <div className="ka-panel-header">
        <h2 className="ka-panel-title">
          <IconZap size={18} aria-hidden="true" />
          {t('workflows.title')}
        </h2>
        <button className="ka-panel-close" onClick={onClose} aria-label="Close">
          <IconClose size={18} />
        </button>
      </div>

      {loading ? (
        <div className="ka-wf-loading">{t('workflows.loading')}</div>
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
              <div className="ka-empty-state">
                <img className="ka-empty-state-illustration" src={`${import.meta.env.BASE_URL}concepts/empty-workflows.svg`} alt="" aria-hidden="true" />
                <div className="ka-empty-state-title">{t('workflows.emptyTitle')}</div>
                <div className="ka-empty-state-desc">{t('workflows.emptyDesc')}</div>
                <button className="ka-empty-state-cta" onClick={() => setShowBuilder(true)}>{t('workflows.newWorkflow')}</button>
              </div>
            )}

            {procedures.map(proc => {
              const procRuns = runs.get(proc.id || '') || []

              return (
                <div key={proc.id} className="ka-wf-card">
                  <div className="ka-wf-card-header">
                    <div className="ka-wf-card-left">
                      <IconZap size={14} />
                      <span className="ka-wf-card-name">{proc.name}</span>
                      <span className="ka-wf-card-source">{proc.source}</span>
                    </div>
                    <div className="ka-wf-card-actions">
                      <button
                        className="ka-wf-card-run"
                        onClick={() => onRunWorkflow(proc)}
                        aria-label="Run workflow"
                      >
                        <IconPlay size={12} /> {t('run', { ns: 'common' })}
                      </button>
                      <button
                        className="ka-wf-card-delete"
                        onClick={() => handleDelete(proc.id!)}
                        aria-label="Delete"
                      >
                        <IconTrash size={12} />
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
                      <IconClock size={10} />
                      {t('workflows.runCount', { count: proc.times_executed })}
                      {proc.last_executed_at && ` \u00B7 last ${new Date(proc.last_executed_at).toLocaleDateString()}`}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <button className="ka-wf-create-btn" onClick={() => setShowBuilder(true)}>
            <IconPlus size={16} /> {t('workflows.createWorkflow')}
          </button>
        </>
      )}
    </div>
  )
}
