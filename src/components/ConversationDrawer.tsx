import { useState, useCallback, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'framer-motion'
import { SPRING, DURATION } from '../constants/motion'
import { IconPlus, IconTrash, IconClose, IconSearch, IconPencil, IconCheck, IconShare } from './KernelIcons'
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
  onShare?: (id: string) => void
  isLoading?: boolean
}

/** Highlight matched query text in a snippet string */
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query || query.trim().length < 2) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="conv-highlight">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

function relativeTime(dateStr: string, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return t('relativeTime.justNow')
  if (mins < 60) return t('relativeTime.minutesAgo', { count: mins })
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return t('relativeTime.hoursAgo', { count: hrs })
  const days = Math.floor(hrs / 24)
  if (days < 7) return t('relativeTime.daysAgo', { count: days })
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
  onShare,
  isLoading,
}: ConversationDrawerProps) {
  const { t } = useTranslation('common')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ conv_id: string; content: string }[]>([])
  const [searching, setSearching] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renamingRef = useRef(false) // Guard against double-fire from onSubmit + onBlur
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current) }
  }, [])

  const executeSearch = useCallback(async (query: string) => {
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

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    if (query.trim().length < 2) {
      setSearchResults([])
      return
    }
    searchTimerRef.current = setTimeout(() => executeSearch(query), 300)
  }, [executeSearch])

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

  // Swipe-to-close: drag left to dismiss
  const dragX = useMotionValue(0)
  const overlayOpacity = useTransform(dragX, [-320, 0], [0, 1])

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    // Close if dragged more than 80px left or velocity is high
    if (info.offset.x < -80 || info.velocity.x < -300) {
      onClose()
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="conv-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DURATION.QUICK }}
            style={{ opacity: overlayOpacity }}
            onClick={onClose}
          />
          <motion.aside
            className="conv-drawer"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={SPRING.DEFAULT}
            drag="x"
            dragConstraints={{ left: -320, right: 0 }}
            dragElastic={0.1}
            onDragEnd={handleDragEnd}
            style={{ x: dragX }}
          >
            <div className="conv-drawer-header">
              <span className="conv-drawer-title">{t('conversations.title', { count: conversations.length })}</span>
              <button className="conv-drawer-close" onClick={onClose} aria-label={t('close')}>
                <IconClose size={18} />
              </button>
            </div>

            <div className="conv-search">
              <IconSearch size={14} className="conv-search-icon" />
              <input
                className="conv-search-input"
                type="text"
                placeholder={t('conversations.searchPlaceholder')}
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
              />
              {searchQuery && (
                <button className="conv-search-clear" onClick={() => { setSearchQuery(''); setSearchResults([]) }} aria-label={t('close')}>
                  <IconClose size={12} />
                </button>
              )}
              {searching && <span className="conv-search-spinner" />}
              {!searching && searchQuery.trim().length >= 2 && (
                <span className="conv-search-count">{filteredConversations.length}</span>
              )}
            </div>

            <button className="conv-new-btn" onClick={() => { onNewChat(); onClose(); }}>
              <IconPlus size={16} />
              {t('conversations.newChat')}
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
                      <span className="conv-item-snippet">{highlightMatch(matchSnippet.content.slice(0, 80), searchQuery)}...</span>
                    )}
                    {!isRenaming && <span className="conv-item-time">{relativeTime(conv.updated_at, t)}</span>}
                  </div>
                  {!isRenaming && (
                    <div className="conv-item-actions">
                      {onShare && (
                        <button
                          className="conv-item-action"
                          onClick={(e) => { e.stopPropagation(); onShare(conv.id) }}
                          aria-label="Share conversation"
                        >
                          <IconShare size={13} />
                        </button>
                      )}
                      <button
                        className="conv-item-action"
                        onClick={(e) => { e.stopPropagation(); setRenamingId(conv.id); setRenameValue(conv.title) }}
                        aria-label="Rename conversation"
                      >
                        <IconPencil size={13} />
                      </button>
                      <button
                        className="conv-item-action conv-item-action--delete"
                        onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}
                        aria-label="Delete conversation"
                      >
                        <IconTrash size={13} />
                      </button>
                    </div>
                  )}
                </div>
              )})}
              {filteredConversations.length === 0 && searchQuery && (
                <div className="conv-empty">{searching ? t('conversations.searching') : t('conversations.noMatches')}</div>
              )}
              {conversations.length === 0 && !searchQuery && (
                <div className="conv-empty">{t('conversations.empty')}</div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
