import { useState, useRef, useEffect } from 'react'
import { getAllSpecialists, type Specialist } from '../agents/specialists'

interface AgentPickerProps {
  selectedAgent: string | null
  onSelect: (agentId: string | null) => void
  disabled?: boolean
}

// Show only the most interesting agents — not all 20
const FEATURED_IDS = ['kernel', 'researcher', 'coder', 'writer', 'analyst', 'hacker', 'operator', 'dreamer', 'investigator', 'strategist']

export function AgentPicker({ selectedAgent, onSelect, disabled }: AgentPickerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const allSpecs = getAllSpecialists()
  const featured = FEATURED_IDS.map(id => allSpecs.find(s => s.id === id)).filter(Boolean) as Specialist[]
  const selected = selectedAgent ? allSpecs.find(s => s.id === selectedAgent) : null

  return (
    <div className="ka-agent-picker" ref={ref}>
      <button
        type="button"
        className={`ka-agent-picker-btn${selected ? ' ka-agent-picker-btn--active' : ''}`}
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        aria-label="Choose agent"
        title={selected ? `Agent: ${selected.name}` : 'Auto-route (default)'}
        style={selected ? { color: selected.color } : undefined}
      >
        {selected ? selected.icon : '\u2295'}
      </button>
      {open && (
        <div className="ka-agent-picker-dropdown">
          <button
            className={`ka-agent-picker-item${!selectedAgent ? ' ka-agent-picker-item--active' : ''}`}
            onClick={() => { onSelect(null); setOpen(false) }}
          >
            <span className="ka-agent-picker-icon">{'\u2295'}</span>
            <span className="ka-agent-picker-label">Auto</span>
            <span className="ka-agent-picker-desc">Router picks the best agent</span>
          </button>
          {featured.map(spec => (
            <button
              key={spec.id}
              className={`ka-agent-picker-item${selectedAgent === spec.id ? ' ka-agent-picker-item--active' : ''}`}
              onClick={() => { onSelect(spec.id); setOpen(false) }}
            >
              <span className="ka-agent-picker-icon" style={{ color: spec.color }}>{spec.icon}</span>
              <span className="ka-agent-picker-label">{spec.name}</span>
              <span className="ka-agent-picker-desc">{getShortDesc(spec.id)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function getShortDesc(id: string): string {
  const descs: Record<string, string> = {
    kernel: 'General chat',
    researcher: 'Deep research',
    coder: 'Programming',
    writer: 'Writing & editing',
    analyst: 'Strategy & analysis',
    hacker: 'Security & CTFs',
    operator: 'Full delegation',
    dreamer: 'Dreams & worldbuilding',
    investigator: 'OSINT & forensics',
    strategist: 'Market strategy',
  }
  return descs[id] || ''
}
