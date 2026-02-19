// ─── GoalsPanel ──────────────────────────────────────────
//
// Bottom-sheet panel for viewing and managing goals.
// Lists active goals with progress bars, milestones, add/edit form.

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Plus, Target, Check, ChevronDown, ChevronRight, Trash2 } from 'lucide-react'
import {
  getUserGoals,
  upsertUserGoal,
  deleteUserGoal,
} from '../engine/SupabaseClient'
import type { UserGoal, GoalMilestone } from '../engine/GoalTracker'

interface GoalsPanelProps {
  userId: string
  onClose: () => void
  onToast: (msg: string) => void
}

export function GoalsPanel({ userId, onClose, onToast }: GoalsPanelProps) {
  const { t } = useTranslation('panels')
  const [goals, setGoals] = useState<UserGoal[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Form state
  const [formTitle, setFormTitle] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formCategory, setFormCategory] = useState('general')
  const [formPriority, setFormPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [formTargetDate, setFormTargetDate] = useState('')
  const [formFrequency, setFormFrequency] = useState<'daily' | 'weekly' | 'biweekly' | 'monthly'>('weekly')

  const loadGoals = useCallback(async () => {
    const data = await getUserGoals(userId)
    setGoals(data)
    setLoading(false)
  }, [userId])

  useEffect(() => { loadGoals() }, [loadGoals])

  const handleAddGoal = async () => {
    if (!formTitle.trim()) return
    try {
      await upsertUserGoal({
        user_id: userId,
        title: formTitle.trim(),
        description: formDesc.trim(),
        category: formCategory,
        status: 'active',
        priority: formPriority,
        target_date: formTargetDate || null,
        milestones: [],
        progress_notes: [],
        check_in_frequency: formFrequency,
        last_check_in_at: null,
      })
      setFormTitle('')
      setFormDesc('')
      setFormCategory('general')
      setFormPriority('medium')
      setFormTargetDate('')
      setShowForm(false)
      loadGoals()
    } catch {
      onToast(t('goals.errors.addFailed'))
    }
  }

  const toggleMilestone = async (goal: UserGoal, milestoneId: string) => {
    try {
      const updated = {
        ...goal,
        milestones: goal.milestones.map(m =>
          m.id === milestoneId
            ? { ...m, completed: !m.completed, completed_at: !m.completed ? new Date().toISOString() : undefined }
            : m
        ),
      }
      await upsertUserGoal(updated)
      loadGoals()
    } catch {
      onToast(t('goals.errors.updateFailed'))
    }
  }

  const handleComplete = async (goal: UserGoal) => {
    try {
      await upsertUserGoal({ ...goal, status: 'completed' })
      loadGoals()
    } catch {
      onToast(t('goals.errors.completeFailed'))
    }
  }

  const handleDelete = async (goalId: string) => {
    if (!window.confirm(t('goals.deleteConfirm'))) return
    try {
      await deleteUserGoal(goalId)
      loadGoals()
    } catch {
      onToast(t('goals.errors.deleteFailed'))
    }
  }

  const activeGoals = goals.filter(g => g.status === 'active')
  const completedGoals = goals.filter(g => g.status === 'completed')

  return (
    <div className="ka-goals-panel">
      <div className="ka-goals-header">
        <h2 className="ka-goals-title">
          <Target size={18} />
          {t('goals.title')}
        </h2>
        <button className="ka-goals-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
      </div>

      {loading ? (
        <div className="ka-goals-loading">Loading goals...</div>
      ) : (
        <div className="ka-goals-list">
          {activeGoals.length === 0 && !showForm && (
            <div className="ka-empty-state">
              <Target size={48} className="ka-empty-state-icon" />
              <div className="ka-empty-state-title">{t('goals.emptyTitle')}</div>
              <div className="ka-empty-state-desc">{t('goals.emptyDesc')}</div>
              <button className="ka-empty-state-cta" onClick={() => setShowForm(true)}>{t('goals.createGoal')}</button>
            </div>
          )}

          {activeGoals.map(goal => {
            const totalMs = goal.milestones.length
            const doneMs = goal.milestones.filter(m => m.completed).length
            const progress = totalMs > 0 ? (doneMs / totalMs) * 100 : 0
            const expanded = expandedId === goal.id

            return (
              <div key={goal.id} className="ka-goal-card">
                <div className="ka-goal-card-header" onClick={() => setExpandedId(expanded ? null : goal.id!)}>
                  <div className="ka-goal-card-left">
                    {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <span className="ka-goal-card-title">{goal.title}</span>
                    <span className={`ka-goal-priority ka-goal-priority--${goal.priority}`}>{goal.priority}</span>
                  </div>
                  {totalMs > 0 && (
                    <span className="ka-goal-progress-text">{doneMs}/{totalMs}</span>
                  )}
                </div>

                {totalMs > 0 && (
                  <div className="ka-goal-progress-bar">
                    <div className="ka-goal-progress-fill" style={{ width: `${progress}%` }} />
                  </div>
                )}

                {expanded && (
                  <div className="ka-goal-details">
                    {goal.description && (
                      <p className="ka-goal-desc">{goal.description}</p>
                    )}
                    {goal.target_date && (
                      <p className="ka-goal-target">{t('goals.target', { date: new Date(goal.target_date).toLocaleDateString() })}</p>
                    )}
                    {goal.milestones.length > 0 && (
                      <div className="ka-goal-milestones">
                        {goal.milestones.map(ms => (
                          <label key={ms.id} className="ka-goal-milestone">
                            <input
                              type="checkbox"
                              checked={ms.completed}
                              onChange={() => toggleMilestone(goal, ms.id)}
                            />
                            <span className={ms.completed ? 'ka-goal-milestone--done' : ''}>{ms.title}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    <div className="ka-goal-actions">
                      <button className="ka-goal-action-btn" onClick={() => handleComplete(goal)}>
                        <Check size={12} /> {t('complete', { ns: 'common' })}
                      </button>
                      <button className="ka-goal-action-btn ka-goal-action-btn--danger" onClick={() => handleDelete(goal.id!)}>
                        <Trash2 size={12} /> {t('delete', { ns: 'common' })}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {completedGoals.length > 0 && (
            <div className="ka-goals-completed-section">
              <h3 className="ka-goals-section-label">{t('goals.completed', { count: completedGoals.length })}</h3>
              {completedGoals.slice(0, 5).map(goal => (
                <div key={goal.id} className="ka-goal-card ka-goal-card--completed">
                  <div className="ka-goal-card-header">
                    <div className="ka-goal-card-left">
                      <Check size={14} />
                      <span className="ka-goal-card-title">{goal.title}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showForm ? (
        <div className="ka-goal-form">
          <input
            className="ka-goal-form-input"
            placeholder="Goal title..."
            value={formTitle}
            onChange={e => setFormTitle(e.target.value)}
            autoFocus
          />
          <textarea
            className="ka-goal-form-textarea"
            placeholder="Description (optional)..."
            value={formDesc}
            onChange={e => setFormDesc(e.target.value)}
            rows={2}
          />
          <div className="ka-goal-form-row">
            <select className="ka-goal-form-select" value={formPriority} onChange={e => setFormPriority(e.target.value as 'low' | 'medium' | 'high')}>
              <option value="low">{t('goals.priority.low')}</option>
              <option value="medium">{t('goals.priority.medium')}</option>
              <option value="high">{t('goals.priority.high')}</option>
            </select>
            <select className="ka-goal-form-select" value={formFrequency} onChange={e => setFormFrequency(e.target.value as 'daily' | 'weekly' | 'biweekly' | 'monthly')}>
              <option value="daily">{t('goals.frequency.daily')}</option>
              <option value="weekly">{t('goals.frequency.weekly')}</option>
              <option value="biweekly">{t('goals.frequency.biweekly')}</option>
              <option value="monthly">{t('goals.frequency.monthly')}</option>
            </select>
          </div>
          <input
            className="ka-goal-form-input"
            type="date"
            value={formTargetDate}
            onChange={e => setFormTargetDate(e.target.value)}
            placeholder="Target date (optional)"
          />
          <div className="ka-goal-form-btns">
            <button className="ka-goal-form-submit" onClick={handleAddGoal}>{t('goals.addGoal')}</button>
            <button className="ka-goal-form-cancel" onClick={() => setShowForm(false)}>{t('cancel', { ns: 'common' })}</button>
          </div>
        </div>
      ) : (
        <button className="ka-goal-add-btn" onClick={() => setShowForm(true)}>
          <Plus size={16} /> {t('goals.addGoal')}
        </button>
      )}
    </div>
  )
}
