// ─── ScheduledTasksPanel ─────────────────────────────────
//
// Bottom-sheet panel for viewing and managing scheduled tasks.

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { IconClose, IconClock, IconPlus, IconTrash, IconPlay, IconPause } from './KernelIcons'
import { supabase } from '../engine/SupabaseClient'
import { calculateNextRunAt, type ScheduledTask, type TaskSchedule } from '../engine/Scheduler'

interface ScheduledTasksPanelProps {
  userId: string
  onClose: () => void
  onToast: (msg: string) => void
}

const SCHEDULE_PRESETS: { labelKey: string; schedule: TaskSchedule }[] = [
  { labelKey: 'scheduled.presets.daily', schedule: { type: 'daily', time: '09:00' } },
  { labelKey: 'scheduled.presets.weekdays', schedule: { type: 'weekdays', time: '09:00' } },
  { labelKey: 'scheduled.presets.weekly', schedule: { type: 'weekly', time: '09:00', dayOfWeek: 1 } },
  { labelKey: 'scheduled.presets.once', schedule: { type: 'once', time: '09:00' } },
]

const TASK_TYPES = [
  { id: 'reminder', labelKey: 'scheduled.taskTypes.reminder' },
  { id: 'workflow', labelKey: 'scheduled.taskTypes.workflow' },
  { id: 'briefing', labelKey: 'scheduled.taskTypes.briefing' },
  { id: 'goal_checkin', labelKey: 'scheduled.taskTypes.goalCheckin' },
]

export function ScheduledTasksPanel({ userId, onClose, onToast }: ScheduledTasksPanelProps) {
  const { t } = useTranslation('panels')
  const [tasks, setTasks] = useState<ScheduledTask[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  // Form state
  const [formTitle, setFormTitle] = useState('')
  const [formType, setFormType] = useState<string>('reminder')
  const [formScheduleIdx, setFormScheduleIdx] = useState(0)
  const [formTime, setFormTime] = useState('09:00')
  const [formChannel, setFormChannel] = useState<'in_app' | 'email' | 'discord'>('in_app')

  // Force re-render every 60s to keep relative times fresh
  const [, setTick] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(interval)
  }, [])

  const loadTasks = useCallback(async () => {
    const { data, error } = await supabase
      .from('scheduled_tasks')
      .select('*')
      .eq('user_id', userId)
      .order('next_run_at', { ascending: true })
    if (error) console.error('Error loading scheduled tasks:', error)
    setTasks((data || []) as ScheduledTask[])
    setLoading(false)
  }, [userId])

  useEffect(() => { loadTasks() }, [loadTasks])

  const handleAdd = async () => {
    if (!formTitle.trim()) return
    try {
      const schedule = { ...SCHEDULE_PRESETS[formScheduleIdx].schedule, time: formTime }
      const nextRun = calculateNextRunAt(schedule)

      const { error } = await supabase
        .from('scheduled_tasks')
        .insert({
          user_id: userId,
          title: formTitle.trim(),
          task_type: formType,
          schedule,
          next_run_at: nextRun.toISOString(),
          notification_channel: formChannel,
        })
      if (error) throw error
      setFormTitle('')
      setShowForm(false)
      loadTasks()
    } catch {
      onToast(t('scheduled.errors.createFailed'))
    }
  }

  const handleToggle = async (task: ScheduledTask) => {
    try {
      const { error } = await supabase
        .from('scheduled_tasks')
        .update({ is_active: !task.is_active, updated_at: new Date().toISOString() })
        .eq('id', task.id)
      if (error) throw error
      loadTasks()
    } catch {
      onToast(t('scheduled.errors.updateFailed'))
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('scheduled.deleteConfirm'))) return
    try {
      const { error } = await supabase.from('scheduled_tasks').delete().eq('id', id)
      if (error) throw error
      loadTasks()
    } catch {
      onToast(t('scheduled.errors.deleteFailed'))
    }
  }

  const formatNextRun = (dateStr: string) => {
    const d = new Date(dateStr)
    const now = new Date()
    const diffH = (d.getTime() - now.getTime()) / (1000 * 60 * 60)
    if (diffH < 0) return t('time.overdue', { ns: 'common' })
    if (diffH < 1) return t('time.minutesShort', { count: Math.round(diffH * 60), ns: 'common' })
    if (diffH < 24) return t('time.hoursShort', { count: Math.round(diffH), ns: 'common' })
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  return (
    <div className="ka-sched-panel">
      <div className="ka-panel-header">
        <h2 className="ka-panel-title">
          <IconClock size={18} aria-hidden="true" />
          {t('scheduled.title')}
        </h2>
        <button className="ka-panel-close" onClick={onClose} aria-label="Close">
          <IconClose size={18} />
        </button>
      </div>

      {loading ? (
        <div className="ka-sched-loading">{t('scheduled.loading')}</div>
      ) : (
        <div className="ka-sched-list">
          {tasks.length === 0 && !showForm && (
            <div className="ka-empty-state">
              <img className="ka-empty-state-illustration" src={`${import.meta.env.BASE_URL}concepts/empty-scheduled.svg`} alt="" aria-hidden="true" />
              <div className="ka-empty-state-title">{t('scheduled.emptyTitle')}</div>
              <div className="ka-empty-state-desc">{t('scheduled.emptyDesc')}</div>
              <button className="ka-empty-state-cta" onClick={() => setShowForm(true)}>{t('scheduled.createTask')}</button>
            </div>
          )}

          {tasks.map(task => (
            <div key={task.id} className={`ka-sched-card${task.is_active ? '' : ' ka-sched-card--inactive'}`}>
              <div className="ka-sched-card-header">
                <div className="ka-sched-card-left">
                  <span className="ka-sched-card-title">{task.title}</span>
                  <span className="ka-sched-card-type">{task.task_type.replace('_', ' ')}</span>
                </div>
                <div className="ka-sched-card-actions">
                  <button className="ka-sched-card-btn" onClick={() => handleToggle(task)} aria-label={task.is_active ? 'Pause' : 'Resume'}>
                    {task.is_active ? <IconPause size={12} /> : <IconPlay size={12} />}
                  </button>
                  <button className="ka-sched-card-btn ka-sched-card-btn--danger" onClick={() => handleDelete(task.id!)} aria-label="Delete">
                    <IconTrash size={12} />
                  </button>
                </div>
              </div>
              <div className="ka-sched-card-meta">
                <span>{(task.schedule as TaskSchedule).type} at {(task.schedule as TaskSchedule).time || '09:00'}</span>
                <span>&middot;</span>
                <span>Next: {formatNextRun(task.next_run_at)}</span>
                <span>&middot;</span>
                <span>{task.notification_channel}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <div className="ka-sched-form">
          <input
            className="ka-sched-form-input"
            placeholder="Task title..."
            value={formTitle}
            onChange={e => setFormTitle(e.target.value)}
            autoFocus
          />
          <div className="ka-sched-form-row">
            <select className="ka-sched-form-select" value={formType} onChange={e => setFormType(e.target.value)}>
              {TASK_TYPES.map(tt => <option key={tt.id} value={tt.id}>{t(tt.labelKey)}</option>)}
            </select>
            <select className="ka-sched-form-select" value={formChannel} onChange={e => setFormChannel(e.target.value as 'in_app' | 'email' | 'discord')}>
              <option value="in_app">{t('scheduled.channels.inApp')}</option>
              <option value="email">{t('scheduled.channels.email')}</option>
              <option value="discord">{t('scheduled.channels.discord')}</option>
            </select>
          </div>
          <div className="ka-sched-form-row">
            <div className="ka-sched-presets">
              {SCHEDULE_PRESETS.map((p, i) => (
                <button
                  key={p.labelKey}
                  className={`ka-sched-preset${formScheduleIdx === i ? ' ka-sched-preset--active' : ''}`}
                  onClick={() => setFormScheduleIdx(i)}
                >
                  {t(p.labelKey)}
                </button>
              ))}
            </div>
            <input
              type="time"
              className="ka-sched-form-time"
              value={formTime}
              onChange={e => setFormTime(e.target.value)}
            />
            <span className="ka-sched-tz-hint">
              {Intl.DateTimeFormat().resolvedOptions().timeZone.split('/').pop()?.replace(/_/g, ' ')}
            </span>
          </div>
          <div className="ka-sched-form-btns">
            <button className="ka-sched-form-submit" onClick={handleAdd} disabled={!formTitle.trim()}>{t('scheduled.schedule')}</button>
            <button className="ka-sched-form-cancel" onClick={() => setShowForm(false)}>{t('cancel', { ns: 'common' })}</button>
          </div>
        </div>
      ) : (
        <button className="ka-sched-create-btn" onClick={() => setShowForm(true)}>
          <IconPlus size={16} /> {t('scheduled.createTask')}
        </button>
      )}
    </div>
  )
}
