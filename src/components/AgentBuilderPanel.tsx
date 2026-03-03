// ─── AgentBuilderPanel — Create / Edit Custom Agents ─────────
//
// Bottom-sheet for building custom agents with persona,
// tools, knowledge, starters, icon, and color.

import { useState, useEffect } from 'react'
import { motion, useDragControls } from 'framer-motion'
import { SPRING } from '../constants/motion'
import type { CustomAgent } from '../engine/agent/types'

const AVAILABLE_TOOLS = [
  { id: 'content', label: 'Content Engine' },
  { id: 'knowledge', label: 'Knowledge Base' },
  { id: 'research', label: 'Deep Research' },
  { id: 'algorithm', label: 'Algorithm Scoring' },
  { id: 'swarm', label: 'Swarm Collaboration' },
  { id: 'computer', label: 'Code Sandbox' },
  { id: 'image', label: 'Image Generation' },
]

const PRESET_COLORS = [
  '#6B5B95', '#5B8BA0', '#6B8E6B', '#B8875C', '#A0768C',
  '#D4A574', '#7B9E89', '#8B7EC8', '#C97B84', '#5C9EAD',
]

const PRESET_ICONS = [
  '🤖', '🧠', '🎯', '📝', '🔬', '💡', '🎨', '📊',
  '🛡️', '🚀', '🔮', '🌟', '⚡', '🎭', '📚', '🧩',
]

interface AgentBuilderPanelProps {
  editingAgent?: CustomAgent | null
  onSave: (data: {
    name: string
    persona: string
    tools: string[]
    knowledge_ids: string[]
    starters: string[]
    icon: string
    color: string
    is_public: boolean
  }) => void
  onClose: () => void
}

export function AgentBuilderPanel({
  editingAgent,
  onSave,
  onClose,
}: AgentBuilderPanelProps) {
  const dragControls = useDragControls()

  const [name, setName] = useState(editingAgent?.name ?? '')
  const [persona, setPersona] = useState(editingAgent?.persona ?? '')
  const [tools, setTools] = useState<string[]>(editingAgent?.tools ?? [])
  const [starters, setStarters] = useState<string[]>(editingAgent?.starters ?? [''])
  const [icon, setIcon] = useState(editingAgent?.icon ?? '🤖')
  const [color, setColor] = useState(editingAgent?.color ?? '#6B5B95')
  const [isPublic, setIsPublic] = useState(editingAgent?.is_public ?? false)
  const [showIconPicker, setShowIconPicker] = useState(false)

  // Reset form when editing agent changes
  useEffect(() => {
    if (editingAgent) {
      setName(editingAgent.name)
      setPersona(editingAgent.persona)
      setTools(editingAgent.tools)
      setStarters(editingAgent.starters.length > 0 ? editingAgent.starters : [''])
      setIcon(editingAgent.icon)
      setColor(editingAgent.color)
      setIsPublic(editingAgent.is_public)
    }
  }, [editingAgent])

  const toggleTool = (toolId: string) => {
    setTools(prev =>
      prev.includes(toolId)
        ? prev.filter(t => t !== toolId)
        : [...prev, toolId]
    )
  }

  const updateStarter = (index: number, value: string) => {
    setStarters(prev => prev.map((s, i) => i === index ? value : s))
  }

  const addStarter = () => {
    if (starters.length < 4) setStarters(prev => [...prev, ''])
  }

  const removeStarter = (index: number) => {
    setStarters(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = () => {
    if (!name.trim() || !persona.trim()) return
    onSave({
      name: name.trim(),
      persona: persona.trim(),
      tools,
      knowledge_ids: editingAgent?.knowledge_ids ?? [],
      starters: starters.filter(s => s.trim()),
      icon,
      color,
      is_public: isPublic,
    })
  }

  const isValid = name.trim().length > 0 && persona.trim().length > 0

  return (
    <motion.div
      className="ka-agent-builder-panel"
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
        className="ka-agent-builder-handle"
        onPointerDown={(e) => dragControls.start(e)}
      >
        <div className="ka-agent-builder-handle-bar" />
      </div>

      {/* Header */}
      <div className="ka-agent-builder-header">
        <h3 className="ka-agent-builder-title">
          {editingAgent ? 'Edit Agent' : 'Create Agent'}
        </h3>
        <button className="ka-agent-builder-close" onClick={onClose}>
          Cancel
        </button>
      </div>

      <div className="ka-agent-builder-body">
        {/* Identity row: icon + name */}
        <div className="ka-agent-builder-identity">
          <div className="ka-agent-builder-icon-wrapper">
            <button
              className="ka-agent-builder-icon-btn"
              style={{ background: `${color}18`, borderColor: `${color}40` }}
              onClick={() => setShowIconPicker(!showIconPicker)}
            >
              <span className="ka-agent-builder-icon-emoji">{icon}</span>
            </button>
            {showIconPicker && (
              <div className="ka-agent-builder-icon-picker">
                {PRESET_ICONS.map(emoji => (
                  <button
                    key={emoji}
                    className={`ka-agent-builder-icon-option ${icon === emoji ? 'ka-agent-builder-icon-option--active' : ''}`}
                    onClick={() => { setIcon(emoji); setShowIconPicker(false) }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
          <input
            className="ka-agent-builder-name-input"
            type="text"
            placeholder="Agent name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
          />
        </div>

        {/* Color picker */}
        <div className="ka-agent-builder-section">
          <label className="ka-agent-builder-label">Color</label>
          <div className="ka-agent-builder-colors">
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                className={`ka-agent-builder-color-swatch ${color === c ? 'ka-agent-builder-color-swatch--active' : ''}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>

        {/* Persona */}
        <div className="ka-agent-builder-section">
          <label className="ka-agent-builder-label">Persona</label>
          <textarea
            className="ka-agent-builder-persona"
            placeholder="Describe your agent's personality, expertise, and how it should respond..."
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            rows={5}
          />
        </div>

        {/* Tools */}
        <div className="ka-agent-builder-section">
          <label className="ka-agent-builder-label">Engines</label>
          <div className="ka-agent-builder-tools">
            {AVAILABLE_TOOLS.map(tool => (
              <button
                key={tool.id}
                className={`ka-agent-builder-tool-chip ${tools.includes(tool.id) ? 'ka-agent-builder-tool-chip--active' : ''}`}
                onClick={() => toggleTool(tool.id)}
              >
                {tool.label}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation Starters */}
        <div className="ka-agent-builder-section">
          <label className="ka-agent-builder-label">Conversation Starters</label>
          <div className="ka-agent-builder-starters">
            {starters.map((starter, i) => (
              <div key={i} className="ka-agent-builder-starter-row">
                <input
                  className="ka-agent-builder-starter-input"
                  type="text"
                  placeholder={`Starter ${i + 1}`}
                  value={starter}
                  onChange={(e) => updateStarter(i, e.target.value)}
                  maxLength={100}
                />
                {starters.length > 1 && (
                  <button
                    className="ka-agent-builder-starter-remove"
                    onClick={() => removeStarter(i)}
                  >
                    x
                  </button>
                )}
              </div>
            ))}
            {starters.length < 4 && (
              <button
                className="ka-agent-builder-add-starter"
                onClick={addStarter}
              >
                + Add starter
              </button>
            )}
          </div>
        </div>

        {/* Public toggle */}
        <div className="ka-agent-builder-section ka-agent-builder-toggle-row">
          <label className="ka-agent-builder-label">Public</label>
          <button
            className={`ka-agent-builder-toggle ${isPublic ? 'ka-agent-builder-toggle--on' : ''}`}
            onClick={() => setIsPublic(!isPublic)}
          >
            <span className="ka-agent-builder-toggle-thumb" />
          </button>
        </div>

        {/* Submit */}
        <button
          className="ka-agent-builder-submit"
          disabled={!isValid}
          onClick={handleSubmit}
          style={{ background: isValid ? color : undefined }}
        >
          {editingAgent ? 'Save Changes' : 'Create Agent'}
        </button>
      </div>
    </motion.div>
  )
}
