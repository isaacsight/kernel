import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'motion/react'
import { SPRING, DURATION } from '../constants/motion'
import {
  IconPlus, IconClose, IconSearch, IconChevronRight, IconUnarchive,
} from './KernelIcons'
import { supabase } from '../engine/SupabaseClient'
import type { DBConversation } from '../engine/SupabaseClient'

interface ConversationDrawerProps {
  isOpen: boolean
  onClose: () => void
  conversations: DBConversation[]
  activeId: string | null
  onSelect: (id: string) => void
  onNewChat: () => void
  onDelete: (id: string) => void
  isLoading?: boolean
  autoFocusSearch?: boolean
  // Archive view
  onUnarchive?: (id: string) => void
  showArchive?: boolean
  onCloseArchive?: () => void
  archivedConversations?: DBConversation[]
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
  isLoading,
  autoFocusSearch,
  onUnarchive,
  showArchive,
  onCloseArchive,
  archivedConversations,
}: ConversationDrawerProps) {
  const { t } = useTranslation('common')
  const bottomSearchRef = useRef<HTMLInputElement>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ conv_id: string; content: string }[]>([])
  const [searching, setSearching] = useState(false)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [archiveSearch, setArchiveSearch] = useState('')

  useEffect(() => {
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current) }
  }, [])

  useEffect(() => {
    if (isOpen && autoFocusSearch) {
      requestAnimationFrame(() => bottomSearchRef.current?.focus())
    }
  }, [isOpen, autoFocusSearch])

  const executeSearch = useCallback(async (query: string) => {
    setSearching(true)
    try {
      const q = query.trim()
      const [messagesRes, titlesRes] = await Promise.all([
        supabase
          .from('messages')
          .select('channel_id, content')
          .ilike('content', `%${q}%`)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('conversations')
          .select('id, title')
          .ilike('title', `%${q}%`)
          .limit(20),
      ])
      const seen = new Set<string>()
      const results: { conv_id: string; content: string }[] = []
      for (const row of titlesRes.data || []) {
        if (!seen.has(row.id)) {
          seen.add(row.id)
          results.push({ conv_id: row.id, content: row.title })
        }
      }
      for (const row of messagesRes.data || []) {
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

  const clearSearch = useCallback(() => {
    setSearchQuery('')
    setSearchResults([])
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
  }, [])

  const highlightMatch = useCallback((text: string, query: string) => {
    if (!query || query.trim().length < 2) return text
    const idx = text.toLowerCase().indexOf(query.toLowerCase())
    if (idx === -1) return text
    const before = text.slice(0, idx)
    const match = text.slice(idx, idx + query.length)
    const after = text.slice(idx + query.length)
    return <>{before}<mark>{match}</mark>{after}</>
  }, [])

  const filteredConversations = searchQuery.trim().length >= 2
    ? conversations.filter(c =>
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        searchResults.some(r => r.conv_id === c.id)
      )
    : conversations

  const filteredArchived = useMemo(() => {
    if (!archivedConversations) return []
    if (!archiveSearch.trim()) return archivedConversations
    const q = archiveSearch.toLowerCase()
    return archivedConversations.filter(c => c.title.toLowerCase().includes(q))
  }, [archivedConversations, archiveSearch])

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  const dragValue = useMotionValue(0)
  const overlayOpacity = useTransform(
    dragValue,
    isMobile ? [0, 400] : [-320, 0],
    isMobile ? [1, 0] : [0, 1],
  )

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (isMobile) {
      if (info.offset.y > 100 || info.velocity.y > 300) onClose()
    } else {
      if (info.offset.x < -80 || info.velocity.x < -300) onClose()
    }
  }

  const isSearching = searchQuery.trim().length >= 2

  const renderConvItem = (conv: DBConversation, opts?: { inArchive?: boolean }) => {
    const matchSnippet = searchResults.find(r => r.conv_id === conv.id)
    const inArchive = opts?.inArchive
    return (
      <div
        key={conv.id}
        className={`conv-item${activeId === conv.id ? ' conv-item--active' : ''}`}
        onClick={() => {
          onSelect(conv.id)
          setSearchQuery('')
          setSearchResults([])
          onCloseArchive?.()
          onClose()
        }}
      >
        <div className="conv-item-content">
          <span className="conv-item-title">
            {isSearching ? highlightMatch(conv.title, searchQuery) : conv.title}
          </span>
          {matchSnippet && (
            <span className="conv-item-snippet">{highlightMatch(matchSnippet.content.slice(0, 80), searchQuery)}...</span>
          )}
          <span className="conv-item-time">{relativeTime(conv.updated_at, t)}</span>
        </div>
        {inArchive && onUnarchive ? (
          <button
            className="conv-item-action"
            onClick={(e) => { e.stopPropagation(); onUnarchive(conv.id) }}
            aria-label={t('conversations.unarchive')}
          >
            <IconUnarchive size={14} />
          </button>
        ) : (
          <IconChevronRight size={14} className="conv-item-chevron" />
        )}
      </div>
    )
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
            initial={isMobile ? { y: '100%' } : { x: '-100%' }}
            animate={isMobile ? { y: 0 } : { x: 0 }}
            exit={isMobile ? { y: '100%' } : { x: '-100%' }}
            transition={SPRING.DEFAULT}
            drag={isMobile ? 'y' : 'x'}
            dragConstraints={isMobile ? { top: 0, bottom: 400 } : { left: -320, right: 0 }}
            dragElastic={0.1}
            onDragEnd={handleDragEnd}
            style={isMobile ? { y: dragValue } : { x: dragValue }}
          >
            {/* Drag handle (mobile only) */}
            <div className="conv-drawer-handle" />

            {/* Header — just close + title */}
            <div className="conv-drawer-header">
              <button className="conv-drawer-close-mobile" onClick={onClose} aria-label={t('close')}>
                <IconClose size={18} />
              </button>
              <span className="conv-drawer-title">Chats</span>
            </div>

            {/* Main conversation list */}
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

              {/* Conversations — flat list */}
              {filteredConversations.length > 0 && (
                <div className="conv-section">
                  {filteredConversations.map(conv => renderConvItem(conv))}
                </div>
              )}

              {/* Search status */}
              {isSearching && !searching && (
                <div className="conv-search-count">
                  {filteredConversations.length > 0
                    ? t('conversations.resultCount', { count: filteredConversations.length })
                    : t('conversations.noResults')}
                </div>
              )}

              {filteredConversations.length === 0 && searchQuery && (
                <div className="conv-empty">
                  <span>{searching ? t('conversations.searching') : t('conversations.noMatches')}</span>
                  {!searching && (
                    <button className="conv-empty-clear" onClick={clearSearch}>
                      {t('conversations.clearSearch')}
                    </button>
                  )}
                </div>
              )}
              {conversations.length === 0 && !searchQuery && (
                <div className="conv-empty">{t('conversations.empty')}</div>
              )}
            </div>

            {/* Bottom bar: search + new chat FAB */}
            <div className="conv-bottom-bar">
              <div className="conv-bottom-search">
                <IconSearch size={14} className="conv-search-icon" />
                <input
                  ref={bottomSearchRef}
                  className="conv-bottom-search-input"
                  data-testid="conv-search"
                  type="search"
                  aria-label={t('conversations.searchPlaceholder')}
                  placeholder={t('conversations.searchPlaceholder')}
                  value={searchQuery}
                  onChange={e => handleSearch(e.target.value)}
                />
                {searchQuery && (
                  <button className="conv-search-clear" onClick={clearSearch} aria-label={t('conversations.clearSearch')}>
                    <IconClose size={12} />
                  </button>
                )}
              </div>
              <button
                className="conv-new-chat-fab"
                data-testid="new-chat-btn"
                onClick={() => { onNewChat(); onClose() }}
                aria-label={t('conversations.newChat')}
              >
                <IconPlus size={20} />
              </button>
            </div>

            {/* Archive overlay */}
            <AnimatePresence>
              {showArchive && (
                <motion.div
                  className="conv-archive-overlay"
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  transition={SPRING.DEFAULT}
                >
                  <div className="conv-archive-header">
                    <button className="conv-drawer-close" onClick={onCloseArchive} aria-label={t('close')}>
                      <IconClose size={18} />
                    </button>
                    <span className="conv-drawer-title">{t('conversations.archive')}</span>
                  </div>
                  <div className="conv-search" style={{ margin: '0 12px 8px' }}>
                    <IconSearch size={14} className="conv-search-icon" />
                    <input
                      className="conv-search-input"
                      type="search"
                      placeholder={t('conversations.searchPlaceholder')}
                      value={archiveSearch}
                      onChange={e => setArchiveSearch(e.target.value)}
                    />
                    {archiveSearch && (
                      <button className="conv-search-clear" onClick={() => setArchiveSearch('')} aria-label={t('conversations.clearSearch')}>
                        <IconClose size={12} />
                      </button>
                    )}
                  </div>
                  <div className="conv-list">
                    {filteredArchived.length === 0 ? (
                      <div className="conv-archive-empty">{t('conversations.noArchived')}</div>
                    ) : (
                      filteredArchived.map(conv => renderConvItem(conv, { inArchive: true }))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
