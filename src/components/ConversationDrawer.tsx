import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, X, Search, Pencil, Check } from 'lucide-react'
import { supabase } from '../engine/SupabaseClient'
import { updateConversationTitle } from '../engine/SupabaseClient'
import type { DBConversation } from '../engine/SupabaseClient'

interface ConversationDrawerProps {
  isOpen: boolean
  onClose: () => void
  conversations: DBConversation[]
  activeId: string | null
  onSelect: (id: string) => void
  onNewChat: () => void
  onDelete: (id: string) => void
  onRename?: (id: string, title: string) => void
  isLoading?: boolean
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
  onRename,
  isLoading,
}: ConversationDrawerProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ conv_id: string; content: string }[]>([])
  const [searching, setSearching] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renamingRef = useRef(false) // Guard against double-fire from onSubmit + onBlur

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query)
    if (query.trim().length < 2) {
      setSearchResults([])
      return
    }

    setSearching(true)
    try {
      const { data } = await supabase
        .from('messages')
        .select('channel_id, content')
        .ilike('content', `%${query.trim()}%`)
        .order('created_at', { ascending: false })
        .limit(20)

      // Dedupe by conversation, keep first match
      const seen = new Set<string>()
      const results: { conv_id: string; content: string }[] = []
      for (const row of data || []) {
        if (!seen.has(row.channel_id)) {
          seen.add(row.channel_id)
          results.push({ conv_id: row.channel_id, content: row.content })
        }
      }
      setSearchResults(results)
    } catch {
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }, [])

  const handleRename = useCallback(async (convId: string) => {
    if (renamingRef.current) return // Prevent double-fire
    const trimmed = renameValue.trim()
    if (!trimmed) { setRenamingId(null); return }
    renamingRef.current = true
    await updateConversationTitle(convId, trimmed)
    onRename?.(convId, trimmed)
    setRenamingId(null)
    setRenameValue('')
    renamingRef.current = false
  }, [renameValue, onRename])

  const filteredConversations = searchQuery.trim().length >= 2
    ? conversations.filter(c =>
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        searchResults.some(r => r.conv_id === c.id)
      )
    : conversations

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
              <span className="conv-drawer-title">Conversations ({conversations.length})</span>
              <button className="conv-drawer-close" onClick={onClose} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="conv-search">
              <Search size={14} className="conv-search-icon" />
              <input
                className="conv-search-input"
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
              />
            </div>

            <button className="conv-new-btn" onClick={() => { onNewChat(); onClose(); }}>
              <Plus size={16} />
              New Chat
            </button>

            <div className="conv-list">
              {isLoading && conversations.length === 0 && (
                <>
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="conv-skeleton">
                      <div className="conv-skeleton-line" />
                      <div className="conv-skeleton-line" />
                    </div>
                  ))}
                </>
              )}
              {filteredConversations.map(conv => {
                const matchSnippet = searchResults.find(r => r.conv_id === conv.id)
                const isRenaming = renamingId === conv.id
                return (
                <div
                  key={conv.id}
                  className={`conv-item ${activeId === conv.id ? 'conv-item--active' : ''}`}
                  onClick={() => { if (!isRenaming) { onSelect(conv.id); setSearchQuery(''); setSearchResults([]); onClose(); } }}
                >
                  <div className="conv-item-content">
                    {isRenaming ? (
                      <form className="conv-rename-form" onSubmit={(e) => { e.preventDefault(); handleRename(conv.id) }} onClick={e => e.stopPropagation()}>
                        <input
                          className="conv-rename-input"
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          autoFocus
                          onKeyDown={e => { if (e.key === 'Escape') setRenamingId(null) }}
                          onBlur={() => handleRename(conv.id)}
                        />
                      </form>
                    ) : (
                      <span className="conv-item-title">{conv.title}</span>
                    )}
                    {matchSnippet && !isRenaming && (
                      <span className="conv-item-snippet">{matchSnippet.content.slice(0, 80)}...</span>
                    )}
                    {!isRenaming && <span className="conv-item-time">{relativeTime(conv.updated_at)}</span>}
                  </div>
                  {!isRenaming && (
                    <div className="conv-item-actions">
                      <button
                        className="conv-item-action"
                        onClick={(e) => { e.stopPropagation(); setRenamingId(conv.id); setRenameValue(conv.title) }}
                        aria-label="Rename conversation"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        className="conv-item-action conv-item-action--delete"
                        onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}
                        aria-label="Delete conversation"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              )})}
              {filteredConversations.length === 0 && searchQuery && (
                <div className="conv-empty">{searching ? 'Searching...' : 'No matches found'}</div>
              )}
              {conversations.length === 0 && !searchQuery && (
                <div className="conv-empty">No conversations yet</div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
