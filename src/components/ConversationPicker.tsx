// ─── ConversationPicker ─────────────────────────────────
//
// Modal that appears when a user uploads a large conversation
// export (ChatGPT, Claude, Gemini). Shows list of conversations
// with message counts, lets user select which ones to import.

import { useState, useEffect, useRef, useMemo } from 'react'
import { motion } from 'framer-motion'
import { IconClose, IconSearch, IconMessageCircle, IconCheck } from './KernelIcons'
import type { ParsedConversation } from '../engine/conversationImport'

// Threshold: show picker when import has more than this many conversations
export const PICKER_THRESHOLD = 10

interface ConversationPickerProps {
  conversations: ParsedConversation[]
  onConfirm: (selected: ParsedConversation[]) => void
  onCancel: () => void
}

export function ConversationPicker({ conversations, onConfirm, onCancel }: ConversationPickerProps) {
  const [selected, setSelected] = useState<Set<number>>(() => {
    // Pre-select all by default
    return new Set(conversations.map((_, i) => i))
  })
  const [search, setSearch] = useState('')
  const modalRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Focus search on mount
  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  // Focus trap + keyboard handling
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations.map((c, i) => ({ conv: c, idx: i }))
    const q = search.toLowerCase()
    return conversations
      .map((c, i) => ({ conv: c, idx: i }))
      .filter(({ conv }) =>
        conv.title.toLowerCase().includes(q) ||
        conv.messages.some(m => m.content.toLowerCase().includes(q))
      )
  }, [conversations, search])

  const toggle = (idx: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  const selectAll = () => {
    if (selected.size === conversations.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(conversations.map((_, i) => i)))
    }
  }

  const handleConfirm = () => {
    const picked = conversations.filter((_, i) => selected.has(i))
    onConfirm(picked)
  }

  const source = conversations[0]?.source || 'unknown'
  const sourceLabel = source === 'chatgpt' ? 'ChatGPT'
    : source === 'claude' ? 'Claude'
    : source === 'gemini' ? 'Gemini'
    : 'AI'

  return (
    <motion.div
      className="ka-upgrade-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onCancel}
    >
      <motion.div
        ref={modalRef}
        className="ka-picker-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="picker-title"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="ka-picker-header">
          <div>
            <h2 id="picker-title" className="ka-picker-title">
              Import from {sourceLabel}
            </h2>
            <p className="ka-picker-subtitle">
              {conversations.length} conversations found — select which to import
            </p>
          </div>
          <button className="ka-panel-close" onClick={onCancel} aria-label="Close">
            <IconClose size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="ka-picker-search">
          <IconSearch size={14} />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search conversations..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Select all toggle */}
        <div className="ka-picker-controls">
          <button className="ka-picker-select-all" onClick={selectAll}>
            {selected.size === conversations.length ? 'Deselect all' : 'Select all'}
          </button>
          <span className="ka-picker-count">
            {selected.size} of {conversations.length} selected
          </span>
        </div>

        {/* Conversation list */}
        <div className="ka-picker-list">
          {filtered.map(({ conv, idx }) => (
            <button
              key={idx}
              className={`ka-picker-item${selected.has(idx) ? ' ka-picker-item--selected' : ''}`}
              onClick={() => toggle(idx)}
            >
              <div className={`ka-picker-check${selected.has(idx) ? ' ka-picker-check--on' : ''}`}>
                {selected.has(idx) && <IconCheck size={12} />}
              </div>
              <div className="ka-picker-item-body">
                <span className="ka-picker-item-title">{conv.title}</span>
                <span className="ka-picker-item-meta">
                  <IconMessageCircle size={12} />
                  {conv.messages.length} messages
                </span>
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="ka-picker-empty">No conversations match "{search}"</p>
          )}
        </div>

        {/* Actions */}
        <div className="ka-picker-actions">
          <button className="ka-picker-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="ka-picker-confirm"
            onClick={handleConfirm}
            disabled={selected.size === 0}
          >
            Import {selected.size} conversation{selected.size !== 1 ? 's' : ''}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
