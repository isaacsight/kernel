import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, X } from 'lucide-react'
import type { DBConversation } from '../engine/SupabaseClient'

interface ConversationDrawerProps {
  isOpen: boolean
  onClose: () => void
  conversations: DBConversation[]
  activeId: string | null
  onSelect: (id: string) => void
  onNewChat: () => void
  onDelete: (id: string) => void
}

function relativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

export function ConversationDrawer({
  isOpen,
  onClose,
  conversations,
  activeId,
  onSelect,
  onNewChat,
  onDelete,
}: ConversationDrawerProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="conv-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.aside
            className="conv-drawer"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            <div className="conv-drawer-header">
              <span className="conv-drawer-title">Conversations</span>
              <button className="conv-drawer-close" onClick={onClose} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <button className="conv-new-btn" onClick={() => { onNewChat(); onClose(); }}>
              <Plus size={16} />
              New Chat
            </button>

            <div className="conv-list">
              {conversations.map(conv => (
                <div
                  key={conv.id}
                  className={`conv-item ${activeId === conv.id ? 'conv-item--active' : ''}`}
                  onClick={() => { onSelect(conv.id); onClose(); }}
                >
                  <div className="conv-item-content">
                    <span className="conv-item-title">{conv.title}</span>
                    <span className="conv-item-time">{relativeTime(conv.updated_at)}</span>
                  </div>
                  <button
                    className="conv-item-delete"
                    onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}
                    aria-label="Delete conversation"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {conversations.length === 0 && (
                <div className="conv-empty">No conversations yet</div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
