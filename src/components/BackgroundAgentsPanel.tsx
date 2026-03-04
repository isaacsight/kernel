// ─── BackgroundAgentsPanel — Background Agent Management ─────────
//
// Bottom-sheet panel listing background agents with toggle,
// create form, and run history.

import { useState, useMemo } from 'react'
import { motion, useDragControls } from 'motion/react'
import { SPRING } from '../constants/motion'
import {
  IconClose,
  IconPlus,
  IconPlay,
  IconClock,
  IconZap,
  IconCheck,
  IconAlertCircle,
} from './KernelIcons'
import type { BackgroundAgent, BackgroundAgentRun, BackgroundTrigger } from '../engine/autonomous/types'

interface BackgroundAgentsPanelProps {
  agents: BackgroundAgent[]
  runs: BackgroundAgentRun[]
  onToggle: (agentId: string, enabled: boolean) => void
  onCreate: (config: {
    name: string
    description: string
    trigger: BackgroundTrigger
    agent_config: { persona: string; tools: string[] }
  }) => void
  onRunAgent: (agentId: string) => void
  onClose: () => void
}

export function BackgroundAgentsPanel({
  agents,
  runs,
  onToggle,
  onCreate,
  onRunAgent,
  onClose,
}: BackgroundAgentsPanelProps) {
  const dragControls = useDragControls()
  const [showCreate, setShowCreate] = useState(false)
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)

  // Create form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [triggerType, setTriggerType] = useState<'schedule' | 'event' | 'condition'>('schedule')
  const [triggerValue, setTriggerValue] = useState('every_1h')
  const [persona, setPersona] = useState('')

  const selectedRuns = useMemo(() =>
    selectedAgentId
      ? runs.filter(r => r.agent_id === selectedAgentId).slice(0, 10)
      : [],
    [runs, selectedAgentId]
  )

  const handleCreate = () => {
    if (!name.trim() || !description.trim()) return

    let trigger: BackgroundTrigger
    switch (triggerType) {
      case 'schedule':
        trigger = { type: 'schedule', cron: triggerValue }
        break
      case 'event':
        trigger = { type: 'event', event_name: triggerValue }
        break
      case 'condition':
        trigger = { type: 'condition', check: triggerValue }
        break
    }

    onCreate({
      name: name.trim(),
      description: description.trim(),
      trigger,
      agent_config: {
        persona: persona.trim() || `You are ${name.trim()}, a background agent.`,
        tools: [],
      },
    })

    // Reset form
    setName('')
    setDescription('')
    setTriggerValue('every_1h')
    setPersona('')
    setShowCreate(false)
  }

  return (
    <motion.div
      className="ka-bg-agents-panel"
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
      <div className="ka-bg-agents-handle" onPointerDown={(e) => dragControls.start(e)}>
        <div className="ka-bg-agents-handle-bar" />
      </div>

      {/* Header */}
      <div className="ka-bg-agents-header">
        <h3 className="ka-bg-agents-title">Background Agents</h3>
        <div className="ka-bg-agents-header-actions">
          <button
            className="ka-bg-agents-btn ka-bg-agents-btn--create"
            onClick={() => setShowCreate(!showCreate)}
          >
            <IconPlus size={14} />
            New
          </button>
          <button className="ka-bg-agents-close" onClick={onClose} aria-label="Close">
            <IconClose size={14} />
          </button>
        </div>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="ka-bg-agents-create">
          <input
            className="ka-bg-agents-input"
            placeholder="Agent name"
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <textarea
            className="ka-bg-agents-textarea"
            placeholder="What should this agent do?"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
          />
          <div className="ka-bg-agents-trigger-row">
            <select
              className="ka-bg-agents-select"
              value={triggerType}
              onChange={e => setTriggerType(e.target.value as 'schedule' | 'event' | 'condition')}
            >
              <option value="schedule">Schedule</option>
              <option value="event">Event</option>
              <option value="condition">Condition</option>
            </select>
            <input
              className="ka-bg-agents-input ka-bg-agents-input--trigger"
              placeholder={triggerType === 'schedule' ? 'every_1h' : triggerType === 'event' ? 'event_name' : 'condition_check'}
              value={triggerValue}
              onChange={e => setTriggerValue(e.target.value)}
            />
          </div>
          <textarea
            className="ka-bg-agents-textarea"
            placeholder="Agent persona / system prompt (optional)"
            value={persona}
            onChange={e => setPersona(e.target.value)}
            rows={2}
          />
          <div className="ka-bg-agents-create-actions">
            <button className="ka-bg-agents-btn" onClick={() => setShowCreate(false)}>Cancel</button>
            <button
              className="ka-bg-agents-btn ka-bg-agents-btn--primary"
              onClick={handleCreate}
              disabled={!name.trim() || !description.trim()}
            >
              Create Agent
            </button>
          </div>
        </div>
      )}

      {/* Agent List */}
      <div className="ka-bg-agents-list">
        {agents.length === 0 ? (
          <div className="ka-bg-agents-empty">
            <IconZap size={24} />
            <p>No background agents yet</p>
            <p className="ka-bg-agents-empty-sub">Create agents that run on schedules, events, or conditions.</p>
          </div>
        ) : (
          agents.map(agent => (
            <div
              key={agent.id}
              className={`ka-bg-agents-item${selectedAgentId === agent.id ? ' ka-bg-agents-item--selected' : ''}`}
              onClick={() => setSelectedAgentId(selectedAgentId === agent.id ? null : agent.id)}
            >
              <div className="ka-bg-agents-item-header">
                <div className="ka-bg-agents-item-info">
                  <span className={`ka-bg-agents-status-dot${agent.enabled ? ' ka-bg-agents-status-dot--active' : ''}`} />
                  <span className="ka-bg-agents-item-name">{agent.name}</span>
                  <span className="ka-bg-agents-item-trigger">{formatTrigger(agent.trigger)}</span>
                </div>
                <div className="ka-bg-agents-item-actions">
                  <button
                    className="ka-bg-agents-btn ka-bg-agents-btn--run"
                    onClick={(e) => { e.stopPropagation(); onRunAgent(agent.id) }}
                    title="Run now"
                  >
                    <IconPlay size={12} />
                  </button>
                  <label className="ka-bg-agents-toggle" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={agent.enabled}
                      onChange={() => onToggle(agent.id, !agent.enabled)}
                    />
                    <span className="ka-bg-agents-toggle-track" />
                  </label>
                </div>
              </div>
              <p className="ka-bg-agents-item-desc">{agent.description}</p>
              <div className="ka-bg-agents-item-meta">
                <span className="ka-bg-agents-item-stat">
                  <IconClock size={10} /> {agent.run_count} runs
                </span>
                {agent.last_run_at && (
                  <span className="ka-bg-agents-item-stat">
                    Last: {formatRelativeTime(agent.last_run_at)}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Run History for selected agent */}
      {selectedAgentId && selectedRuns.length > 0 && (
        <div className="ka-bg-agents-runs">
          <h4 className="ka-bg-agents-runs-title">Run History</h4>
          {selectedRuns.map(run => (
            <div key={run.id} className={`ka-bg-agents-run ka-bg-agents-run--${run.status}`}>
              <div className="ka-bg-agents-run-header">
                <span className="ka-bg-agents-run-status">
                  {run.status === 'completed' && <IconCheck size={10} />}
                  {run.status === 'failed' && <IconAlertCircle size={10} />}
                  {run.status === 'running' && <span className="ka-bg-agents-run-spinner" />}
                  {run.status}
                </span>
                <span className="ka-bg-agents-run-time">
                  {run.duration_ms > 0 ? `${(run.duration_ms / 1000).toFixed(1)}s` : '...'}
                </span>
              </div>
              {run.output && (
                <p className="ka-bg-agents-run-output">{run.output.slice(0, 200)}{run.output.length > 200 ? '...' : ''}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────

function formatTrigger(trigger: BackgroundTrigger): string {
  switch (trigger.type) {
    case 'schedule': return trigger.cron
    case 'event': return `on: ${trigger.event_name}`
    case 'condition': return `if: ${trigger.check}`
  }
}

function formatRelativeTime(isoString: string): string {
  const ms = Date.now() - new Date(isoString).getTime()
  const minutes = Math.floor(ms / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
