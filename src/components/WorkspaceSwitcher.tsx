import { useState, useRef, useEffect } from 'react'
import { IconChevronDown, IconPlus } from './KernelIcons'
import type { Workspace } from '../hooks/useWorkspace'

interface WorkspaceSwitcherProps {
  workspaces: Workspace[]
  activeWorkspace: Workspace | null
  onSelect: (id: string | null) => void
  onCreate: (name: string) => void
}

export function WorkspaceSwitcher({ workspaces, activeWorkspace, onSelect, onCreate }: WorkspaceSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen])

  // Focus input when creating
  useEffect(() => {
    if (creating) inputRef.current?.focus()
  }, [creating])

  if (workspaces.length === 0 && !creating) return null

  return (
    <div className="ka-workspace-switcher" ref={ref}>
      <button className="ka-workspace-trigger" onClick={() => setIsOpen(!isOpen)}>
        <span className="ka-workspace-name">{activeWorkspace?.name || 'Personal'}</span>
        <IconChevronDown size={14} />
      </button>

      {isOpen && (
        <div className="ka-workspace-dropdown">
          <button
            className={`ka-workspace-option${!activeWorkspace ? ' ka-workspace-option--active' : ''}`}
            onClick={() => { onSelect(null); setIsOpen(false) }}
          >
            Personal
          </button>
          {workspaces.map(w => (
            <button
              key={w.id}
              className={`ka-workspace-option${activeWorkspace?.id === w.id ? ' ka-workspace-option--active' : ''}`}
              onClick={() => { onSelect(w.id); setIsOpen(false) }}
            >
              {w.name}
            </button>
          ))}
          <div className="ka-workspace-divider" />
          {creating ? (
            <form className="ka-workspace-create-form" onSubmit={e => {
              e.preventDefault()
              if (newName.trim()) {
                onCreate(newName.trim())
                setNewName('')
                setCreating(false)
                setIsOpen(false)
              }
            }}>
              <input
                ref={inputRef}
                className="ka-workspace-create-input"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Workspace name"
                maxLength={50}
              />
            </form>
          ) : (
            <button className="ka-workspace-option ka-workspace-option--create" onClick={() => setCreating(true)}>
              <IconPlus size={14} /> New workspace
            </button>
          )}
        </div>
      )}
    </div>
  )
}
