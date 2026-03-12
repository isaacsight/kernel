// ─── MemoryPanel ───────────────────────────────────────────
//
// "What I Remember About You" — friendly memory transparency panel.
// Shows what Kernel has learned, organized for an 8th grader.

import { useState } from 'react'
import { IconClose, IconBrain, IconTrash } from './KernelIcons'
import type { UserMemoryProfile } from '../engine/MemoryAgent'

interface MemoryPanelProps {
  userMemory: UserMemoryProfile | null
  onDeleteItem: (category: keyof UserMemoryProfile, index: number) => void
  onClearAll: () => void
  onClose: () => void
}

// Friendly category labels (8th-grade reading level)
const CATEGORIES = [
  { key: 'facts' as const, label: 'Things I Know About You', icon: '📋' },
  { key: 'preferences' as const, label: 'Things You Like', icon: '💜' },
  { key: 'interests' as const, label: 'What Catches Your Eye', icon: '✨' },
  { key: 'goals' as const, label: 'What You\'re Working Toward', icon: '🎯' },
]

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return `${Math.floor(days / 7)}w ago`
}

export function MemoryPanel({ userMemory, onDeleteItem, onClearAll, onClose }: MemoryPanelProps) {
  const [confirmClear, setConfirmClear] = useState(false)

  const isEmpty = !userMemory || (
    !userMemory.facts?.length &&
    !userMemory.preferences?.length &&
    !userMemory.interests?.length &&
    !userMemory.goals?.length
  )

  return (
    <div className="ka-memory-panel">
      <div className="ka-panel-header">
        <h2 className="ka-panel-title">
          <IconBrain size={18} aria-hidden="true" />
          What I Remember About You
        </h2>
        <button className="ka-panel-close" onClick={onClose} aria-label="Close">
          <IconClose size={18} />
        </button>
      </div>

      <div className="ka-memory-body">
        {isEmpty ? (
          <div className="ka-memory-empty">
            <div className="ka-memory-empty-icon">🧠</div>
            <p className="ka-memory-empty-text">
              I haven't learned anything about you yet. Keep chatting and I'll pick up on your preferences!
            </p>
          </div>
        ) : (
          <>
            {/* Communication style badge */}
            {userMemory?.communication_style && (
              <div className="ka-memory-vibe">
                <span className="ka-memory-vibe-label">Your vibe:</span>
                <span className="ka-memory-vibe-value">{userMemory.communication_style}</span>
              </div>
            )}

            {/* Category sections */}
            {CATEGORIES.map(({ key, label, icon }) => {
              const items = userMemory?.[key]
              if (!items || !Array.isArray(items) || items.length === 0) return null

              return (
                <div key={key} className="ka-memory-section">
                  <h3 className="ka-memory-section-title">
                    <span>{icon}</span> {label}
                  </h3>
                  <ul className="ka-memory-list">
                    {items.map((item, i) => {
                      const warmth = userMemory?.warmth?.[item]
                      return (
                        <li key={`${key}-${i}`} className="ka-memory-item">
                          <div className="ka-memory-item-content">
                            <span className="ka-memory-item-text">{item}</span>
                            {warmth && (
                              <span className="ka-memory-item-meta">
                                {timeAgo(warmth.lastReinforced)}
                                {warmth.mentions > 1 && ` · mentioned ${warmth.mentions}x`}
                              </span>
                            )}
                          </div>
                          <button
                            className="ka-memory-item-delete"
                            onClick={() => onDeleteItem(key, i)}
                            aria-label={`Forget "${item}"`}
                            title="Forget this"
                          >
                            <IconTrash size={14} />
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}

            {/* Clear all */}
            <div className="ka-memory-footer">
              {confirmClear ? (
                <div className="ka-memory-confirm">
                  <p>Are you sure? This will erase everything I've learned about you.</p>
                  <div className="ka-memory-confirm-actions">
                    <button className="ka-memory-confirm-yes" onClick={() => { onClearAll(); setConfirmClear(false) }}>
                      Yes, clear everything
                    </button>
                    <button className="ka-memory-confirm-no" onClick={() => setConfirmClear(false)}>
                      Never mind
                    </button>
                  </div>
                </div>
              ) : (
                <button className="ka-memory-clear-btn" onClick={() => setConfirmClear(true)}>
                  <IconTrash size={14} />
                  Clear All Memories
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
