import { motion } from 'motion/react'
import type { ReactNode } from 'react'

export type NodeType = 'input' | 'specialist' | 'model' | 'output'

export interface NodeData {
  value?: string
  agentId?: string
  modelId?: string
  output?: string
  label?: string
}

export interface CanvasNodeProps {
  id: string
  type: NodeType
  x: number
  y: number
  data: NodeData
  isSelected: boolean
  isActive: boolean
  onDrag: (id: string, dx: number, dy: number) => void
  onSelect: (id: string) => void
  onRemove: (id: string) => void
  onUpdateData: (id: string, updates: Partial<NodeData>) => void
  availableAgents: Array<{ id: string; label: string }>
  availableModels: Array<{ id: string; label: string }>
}

export function CanvasNode({
  id,
  type,
  x,
  y,
  data,
  isSelected,
  isActive,
  onDrag,
  onSelect,
  onRemove,
  onUpdateData,
  availableAgents,
  availableModels,
}: CanvasNodeProps) {
  // Determine color theme classes
  const typeClass = `ka-canvas-node--${type}`
  const selectedClass = isSelected ? ' ka-canvas-node--selected' : ''
  const activeClass = isActive ? ' ka-canvas-node--active' : ''

  // Drag handler
  const handleDrag = (_event: any, info: any) => {
    onDrag(id, info.delta.x, info.delta.y)
  }

  const renderBody = () => {
    switch (type) {
      case 'input':
        return (
          <>
            <span className="ka-canvas-node-label">Prompt Input</span>
            <textarea
              className="ka-canvas-node-input"
              rows={3}
              value={data.value || ''}
              onChange={(e) => onUpdateData(id, { value: e.target.value })}
              placeholder="Type starting prompt..."
              onPointerDown={(e) => e.stopPropagation()} // Stop canvas pan when editing text
            />
          </>
        )
      case 'specialist':
        return (
          <>
            <span className="ka-canvas-node-label">Agent Role</span>
            <select
              className="ka-canvas-node-select"
              value={data.agentId || availableAgents[0]?.id || ''}
              onChange={(e) => onUpdateData(id, { agentId: e.target.value })}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {availableAgents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
            <span className="ka-canvas-node-label">Instruction Override</span>
            <input
              className="ka-canvas-node-input"
              type="text"
              value={data.value || ''}
              onChange={(e) => onUpdateData(id, { value: e.target.value })}
              placeholder="e.g. Summarize search results"
              onPointerDown={(e) => e.stopPropagation()}
            />
          </>
        )
      case 'model':
        return (
          <>
            <span className="ka-canvas-node-label">Foundation Model</span>
            <select
              className="ka-canvas-node-select"
              value={data.modelId || availableModels[0]?.id || ''}
              onChange={(e) => onUpdateData(id, { modelId: e.target.value })}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {availableModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            <span className="ka-canvas-node-label">Context Modifier</span>
            <input
              className="ka-canvas-node-input"
              type="text"
              value={data.value || ''}
              onChange={(e) => onUpdateData(id, { value: e.target.value })}
              placeholder="e.g. Focus on cybersecurity"
              onPointerDown={(e) => e.stopPropagation()}
            />
          </>
        )
      case 'output':
        return (
          <>
            <span className="ka-canvas-node-label">Final Result</span>
            {data.output ? (
              <div 
                className="ka-canvas-node-text-preview"
                onPointerDown={(e) => e.stopPropagation()}
              >
                {data.output}
              </div>
            ) : (
              <div className="ka-canvas-node-text-preview ka-canvas-node-text-preview--empty">
                *Result will render here...*
              </div>
            )}
          </>
        )
    }
  }

  return (
    <motion.div
      className={`ka-canvas-node ${typeClass}${selectedClass}${activeClass}`}
      style={{ left: x, top: y }}
      drag
      dragMomentum={false}
      dragElastic={0}
      onDrag={handleDrag}
      onPointerDown={() => onSelect(id)}
    >
      {/* Ports / Handles */}
      {type !== 'input' && (
        <div 
          className="ka-canvas-port ka-canvas-port--input"
          data-port-id={`${id}-input`}
        />
      )}
      {type !== 'output' && (
        <div 
          className="ka-canvas-port ka-canvas-port--output"
          data-port-id={`${id}-output`}
        />
      )}

      {/* Header */}
      <div className="ka-canvas-node-header">
        <span className="ka-canvas-node-title">{type}</span>
        <button
          type="button"
          className="ka-canvas-node-remove"
          onClick={(e) => {
            e.stopPropagation()
            onRemove(id)
          }}
          title="Remove Node"
        >
          x
        </button>
      </div>

      {/* Body */}
      <div className="ka-canvas-node-body">{renderBody()}</div>
    </motion.div>
  )
}
