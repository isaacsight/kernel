import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'motion/react'
import { SPRING, DURATION } from '../constants/motion'
import {
  IconPlus, IconTrash, IconClose, IconSearch, IconPencil, IconShare,
  IconDownload, IconBookOpen, IconChevronRight, IconFolderPlus, IconFolder,
  IconStar, IconStarFilled, IconArchive, IconUnarchive,
} from './KernelIcons'
import { supabase } from '../engine/SupabaseClient'
import { updateConversationTitle } from '../engine/SupabaseClient'
import type { DBConversation } from '../engine/SupabaseClient'
import type { Folder } from '../hooks/useFolders'
import type { DrawerTab } from '../hooks/useDrawerTabs'

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
  onImport?: () => void
  isLoading?: boolean
  autoFocusSearch?: boolean
  onTag?: (id: string) => void
  allTags?: string[]
  selectedTags?: string[]
  onToggleTag?: (tag: string) => void
  getConvTags?: (id: string) => string[]
  // Folder support
  folders?: Folder[]
  onCreateFolder?: (name: string) => void
  onRenameFolder?: (id: string, name: string) => void
  onDeleteFolder?: (id: string) => void
  onMoveToFolder?: (convId: string, folderId: string | null) => void
  // Star / Archive
  onStar?: (id: string) => void
  onUnstar?: (id: string) => void
  onArchive?: (id: string) => void
  onUnarchive?: (id: string) => void
  // Archive view
  showArchive?: boolean
  onOpenArchive?: () => void
  onCloseArchive?: () => void
  onLoadArchive?: () => void
  archivedConversations?: DBConversation[]
  // Tabs
  activeTab?: DrawerTab
  onTabChange?: (tab: DrawerTab) => void
  // Shared data
  sharedConversations?: DBConversation[]
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

type DateGroup = 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'earlier'

function getDateGroup(dateStr: string): DateGroup {
  const now = new Date()
  const then = new Date(dateStr)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const weekAgo = new Date(today.getTime() - 6 * 86400000)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  if (then >= today) return 'today'
  if (then >= yesterday) return 'yesterday'
  if (then >= weekAgo) return 'thisWeek'
  if (then >= monthStart) return 'thisMonth'
  return 'earlier'
}

const DATE_GROUP_KEYS: Record<DateGroup, string> = {
  today: 'conversations.today',
  yesterday: 'conversations.yesterday',
  thisWeek: 'conversations.thisWeek',
  thisMonth: 'conversations.thisMonth',
  earlier: 'conversations.earlier',
}

function groupConversations(convs: DBConversation[]): { group: DateGroup; items: DBConversation[] }[] {
  const groups: Record<DateGroup, DBConversation[]> = { today: [], yesterday: [], thisWeek: [], thisMonth: [], earlier: [] }
  for (const c of convs) {
    groups[getDateGroup(c.updated_at)].push(c)
  }
  const order: DateGroup[] = ['today', 'yesterday', 'thisWeek', 'thisMonth', 'earlier']
  return order.filter(g => groups[g].length > 0).map(g => ({ group: g, items: groups[g] }))
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
  onImport,
  isLoading,
  autoFocusSearch,
  onTag,
  allTags,
  selectedTags,
  onToggleTag,
  getConvTags,
  folders,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveToFolder,
  onStar,
  onUnstar,
  onArchive,
  onUnarchive,
  showArchive,
  onOpenArchive,
  onCloseArchive,
  onLoadArchive,
  archivedConversations,
  activeTab = 'yours',
  onTabChange,
  sharedConversations,
}: ConversationDrawerProps) {
  const { t } = useTranslation('common')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const bottomSearchRef = useRef<HTMLInputElement>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ conv_id: string; content: string }[]>([])
  const [searching, setSearching] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renamingRef = useRef(false)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Folder state
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set())
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null)
  const [folderRenameValue, setFolderRenameValue] = useState('')
  const [moveMenuConvId, setMoveMenuConvId] = useState<string | null>(null)
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null)

  // Archive search
  const [archiveSearch, setArchiveSearch] = useState('')

  const hasFolders = folders && folders.length > 0

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current) }
  }, [])

  // Auto-focus search input when opened via Cmd+K
  useEffect(() => {
    if (isOpen && autoFocusSearch) {
      requestAnimationFrame(() => bottomSearchRef.current?.focus())
    }
  }, [isOpen, autoFocusSearch])

  // Close move menu on outside click
  useEffect(() => {
    if (!moveMenuConvId) return
    const handler = () => setMoveMenuConvId(null)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [moveMenuConvId])

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

  const handleRename = useCallback(async (convId: string) => {
    if (renamingRef.current) return
    const trimmed = renameValue.trim()
    if (!trimmed) { setRenamingId(null); return }
    renamingRef.current = true
    await updateConversationTitle(convId, trimmed)
    onRename?.(convId, trimmed)
    setRenamingId(null)
    setRenameValue('')
    renamingRef.current = false
  }, [renameValue, onRename])

  const toggleFolderCollapse = useCallback((folderId: string) => {
    setCollapsedFolders(prev => {
      const next = new Set(prev)
      if (next.has(folderId)) next.delete(folderId)
      else next.add(folderId)
      return next
    })
  }, [])

  const handleCreateFolder = useCallback(() => {
    const trimmed = newFolderName.trim()
    if (!trimmed || !onCreateFolder) return
    onCreateFolder(trimmed)
    setNewFolderName('')
    setCreatingFolder(false)
  }, [newFolderName, onCreateFolder])

  const handleRenameFolder = useCallback((folderId: string) => {
    const trimmed = folderRenameValue.trim()
    if (!trimmed || !onRenameFolder) { setRenamingFolderId(null); return }
    onRenameFolder(folderId, trimmed)
    setRenamingFolderId(null)
    setFolderRenameValue('')
  }, [folderRenameValue, onRenameFolder])

  // Pick the conversation list based on active tab
  const tabConversations = activeTab === 'shared'
    ? (sharedConversations || [])
    : conversations

  const tagFiltered = selectedTags && selectedTags.length > 0 && getConvTags
    ? tabConversations.filter(c => {
        const convTags = getConvTags(c.id)
        return selectedTags.some(t => convTags.includes(t))
      })
    : tabConversations

  const filteredConversations = searchQuery.trim().length >= 2
    ? tagFiltered.filter(c =>
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        searchResults.some(r => r.conv_id === c.id)
      )
    : tagFiltered

  // Split starred vs recents (only on yours tab)
  const starredConversations = useMemo(() =>
    activeTab === 'yours'
      ? filteredConversations.filter(c => c.starred_at != null).sort((a, b) =>
          new Date(b.starred_at!).getTime() - new Date(a.starred_at!).getTime()
        )
      : [],
    [filteredConversations, activeTab],
  )

  const recentConversations = useMemo(() =>
    activeTab === 'yours'
      ? filteredConversations.filter(c => c.starred_at == null)
      : filteredConversations,
    [filteredConversations, activeTab],
  )

  // Filtered archived conversations
  const filteredArchived = useMemo(() => {
    if (!archivedConversations) return []
    if (!archiveSearch.trim()) return archivedConversations
    const q = archiveSearch.toLowerCase()
    return archivedConversations.filter(c => c.title.toLowerCase().includes(q))
  }, [archivedConversations, archiveSearch])

  // Desktop drag handlers for moving conversations to folders
  const handleConvDragStart = useCallback((e: React.DragEvent, convId: string) => {
    e.dataTransfer.setData('text/plain', convId)
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleFolderDragOver = useCallback((e: React.DragEvent, folderId: string | null) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverFolderId(folderId)
  }, [])

  const handleFolderDragLeave = useCallback(() => {
    setDragOverFolderId(null)
  }, [])

  const handleFolderDrop = useCallback((e: React.DragEvent, folderId: string | null) => {
    e.preventDefault()
    setDragOverFolderId(null)
    const convId = e.dataTransfer.getData('text/plain')
    if (convId && onMoveToFolder) {
      onMoveToFolder(convId, folderId)
    }
  }, [onMoveToFolder])

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  // Build folder map for Yours tab (folders are sub-organization within Recents)
  const folderConvsMap = new Map<string, DBConversation[]>()
  const unfolderedRecents: DBConversation[] = []
  if (hasFolders && activeTab === 'yours') {
    for (const f of folders!) folderConvsMap.set(f.id, [])
    for (const c of recentConversations) {
      if (c.folder_id && folderConvsMap.has(c.folder_id)) {
        folderConvsMap.get(c.folder_id)!.push(c)
      } else {
        unfolderedRecents.push(c)
      }
    }
  }

  const renderConvItem = (conv: DBConversation, opts?: { inArchive?: boolean }) => {
    const matchSnippet = searchResults.find(r => r.conv_id === conv.id)
    const isRenaming = renamingId === conv.id
    const isStarred = conv.starred_at != null
    const inArchive = opts?.inArchive
    const isMoveOpen = moveMenuConvId === conv.id
    return (
      <div key={conv.id} className={`conv-item-wrapper${isMoveOpen ? ' conv-item-wrapper--expanded' : ''}`}>
        <div
          className={`conv-item${activeId === conv.id ? ' conv-item--active' : ''}${isStarred ? ' conv-item--starred' : ''}`}
          onClick={() => {
            if (!isRenaming) {
              onSelect(conv.id)
              setSearchQuery('')
              setSearchResults([])
              onCloseArchive?.()
              onClose()
            }
          }}
          draggable={!isMobile && !!onMoveToFolder && !inArchive}
          onDragStart={(e) => handleConvDragStart(e, conv.id)}
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
              <span className="conv-item-title">
                {searchQuery.trim().length >= 2 ? highlightMatch(conv.title, searchQuery) : conv.title}
              </span>
            )}
            {matchSnippet && !isRenaming && (
              <span className="conv-item-snippet">{highlightMatch(matchSnippet.content.slice(0, 80), searchQuery)}...</span>
            )}
            {!isRenaming && <span className="conv-item-time">{relativeTime(conv.updated_at, t)}</span>}
            {!isRenaming && getConvTags && (() => {
              const convTags = getConvTags(conv.id)
              return convTags.length > 0 ? (
                <div className="ka-conv-tags">
                  {convTags.map(tag => <span key={tag} className="ka-conv-tag-badge">{tag}</span>)}
                </div>
              ) : null
            })()}
          </div>
          {!isRenaming && (
            <div className="conv-item-right">
              <div className="conv-item-actions">
                {/* Star / Unstar */}
                {!inArchive && onStar && onUnstar && (
                  <button
                    className="conv-item-action"
                    onClick={(e) => { e.stopPropagation(); isStarred ? onUnstar(conv.id) : onStar(conv.id) }}
                    aria-label={isStarred ? t('conversations.unstar') : t('conversations.star')}
                  >
                    {isStarred ? <IconStarFilled size={13} /> : <IconStar size={13} />}
                  </button>
                )}
                {/* Archive / Unarchive */}
                {inArchive && onUnarchive ? (
                  <button
                    className="conv-item-action"
                    onClick={(e) => { e.stopPropagation(); onUnarchive(conv.id) }}
                    aria-label={t('conversations.unarchive')}
                  >
                    <IconUnarchive size={13} />
                  </button>
                ) : onArchive && (
                  <button
                    className="conv-item-action"
                    onClick={(e) => { e.stopPropagation(); onArchive(conv.id) }}
                    aria-label={t('conversations.archiveAction')}
                  >
                    <IconArchive size={13} />
                  </button>
                )}
                {!inArchive && onShare && (
                  <button
                    className="conv-item-action"
                    onClick={(e) => { e.stopPropagation(); onShare(conv.id) }}
                    aria-label={t('aria.shareableLink')}
                  >
                    <IconShare size={13} />
                  </button>
                )}
                {!inArchive && (
                  <button
                    className="conv-item-action"
                    onClick={(e) => { e.stopPropagation(); setRenamingId(conv.id); setRenameValue(conv.title) }}
                    aria-label={t('aria.editMessage')}
                  >
                    <IconPencil size={13} />
                  </button>
                )}
                <button
                  className="conv-item-action conv-item-action--delete"
                  onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}
                  aria-label={t('delete')}
                >
                  <IconTrash size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderFolderSection = (folder: Folder, folderConvs: DBConversation[]) => {
    const isCollapsed = collapsedFolders.has(folder.id)
    const isRenaming = renamingFolderId === folder.id
    const isDragOver = dragOverFolderId === folder.id
    return (
      <div
        key={folder.id}
        className={`conv-folder${isDragOver ? ' conv-folder--drag-over' : ''}`}
        onDragOver={(e) => handleFolderDragOver(e, folder.id)}
        onDragLeave={handleFolderDragLeave}
        onDrop={(e) => handleFolderDrop(e, folder.id)}
      >
        <div
          className="conv-folder-header"
          onClick={() => toggleFolderCollapse(folder.id)}
        >
          <IconChevronRight
            size={12}
            style={{ transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)', transition: 'transform 0.15s' }}
          />
          {isRenaming ? (
            <form
              className="conv-rename-form"
              onSubmit={(e) => { e.preventDefault(); handleRenameFolder(folder.id) }}
              onClick={e => e.stopPropagation()}
            >
              <input
                className="conv-rename-input"
                value={folderRenameValue}
                onChange={e => setFolderRenameValue(e.target.value)}
                autoFocus
                onKeyDown={e => { if (e.key === 'Escape') setRenamingFolderId(null) }}
                onBlur={() => handleRenameFolder(folder.id)}
              />
            </form>
          ) : (
            <span className="conv-folder-name">{folder.name}</span>
          )}
          <span className="conv-folder-count">{folderConvs.length}</span>
          {!isRenaming && (
            <div className="conv-folder-actions" onClick={e => e.stopPropagation()}>
              {onRenameFolder && (
                <button
                  className="conv-item-action"
                  onClick={() => { setRenamingFolderId(folder.id); setFolderRenameValue(folder.name) }}
                  aria-label="Rename folder"
                >
                  <IconPencil size={11} />
                </button>
              )}
              {onDeleteFolder && (
                <button
                  className="conv-item-action conv-item-action--delete"
                  onClick={() => onDeleteFolder(folder.id)}
                  aria-label="Delete folder"
                >
                  <IconTrash size={11} />
                </button>
              )}
            </div>
          )}
        </div>
        {!isCollapsed && folderConvs.length > 0 && (
          <div className="conv-folder-items">
            {folderConvs.map(c => renderConvItem(c))}
          </div>
        )}
      </div>
    )
  }

  // Swipe-to-close: drag left to dismiss
  const dragX = useMotionValue(0)
  const overlayOpacity = useTransform(dragX, [-320, 0], [0, 1])

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x < -80 || info.velocity.x < -300) {
      onClose()
    }
  }

  const isSearching = searchQuery.trim().length >= 2

  const renderRecentsContent = () => {
    if (isSearching) {
      return filteredConversations.map(conv => renderConvItem(conv))
    }

    // Shared tab: flat list sorted by updated_at
    if (activeTab === 'shared') {
      if (filteredConversations.length === 0) {
        return <div className="conv-empty">{t('conversations.empty')}</div>
      }
      return filteredConversations.map(conv => renderConvItem(conv))
    }

    // Yours tab: folders inline within recents, then unfoldered date-grouped
    if (activeTab === 'yours') {
      const hasAnyFolderConvs = hasFolders && Array.from(folderConvsMap.values()).some(arr => arr.length > 0)
      return (
        <>
          {/* Folder sections inline */}
          {hasFolders && folders!.map(folder => {
            const folderConvs = folderConvsMap.get(folder.id) || []
            if (folderConvs.length === 0) return null
            return renderFolderSection(folder, folderConvs)
          })}
          {/* Unfoldered conversations, date-grouped */}
          {hasFolders ? (
            groupConversations(unfolderedRecents).map(({ group, items }) => (
              <div key={group} className="conv-date-group">
                <div className="conv-date-label">{t(DATE_GROUP_KEYS[group])}</div>
                {items.map(conv => renderConvItem(conv))}
              </div>
            ))
          ) : (
            groupConversations(recentConversations).map(({ group, items }) => (
              <div key={group} className="conv-date-group">
                <div className="conv-date-label">{t(DATE_GROUP_KEYS[group])}</div>
                {items.map(conv => renderConvItem(conv))}
              </div>
            ))
          )}
        </>
      )
    }

    return null
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
            {/* Header */}
            <div className="conv-drawer-header">
              <button className="conv-drawer-close-mobile" onClick={onClose} aria-label={t('close')}>
                <IconClose size={18} />
              </button>
              <span className="conv-drawer-title">Chats</span>
            </div>

            {/* Tab bar: Yours / Team / Shared */}
            {onTabChange && (
              <div className="conv-tabs">
                <button
                  className={`conv-tab${activeTab === 'yours' ? ' conv-tab--active' : ''}`}
                  onClick={() => onTabChange('yours')}
                >
                  {t('conversations.yours')}
                </button>
                <button
                  className={`conv-tab${activeTab === 'shared' ? ' conv-tab--active' : ''}`}
                  onClick={() => onTabChange('shared')}
                >
                  {t('conversations.shared')}
                </button>
              </div>
            )}

            {/* Tag filter (only on Yours tab) */}
            {activeTab === 'yours' && allTags && allTags.length > 0 && onToggleTag && (
              <div className="ka-tag-filter-bar">
                {allTags.map(tag => (
                  <button
                    key={tag}
                    className={`ka-tag-pill${selectedTags?.includes(tag) ? ' ka-tag-pill--active' : ''}`}
                    onClick={() => onToggleTag(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}

            {/* Create folder inline form */}
            {creatingFolder && (
              <div className="conv-folder-create">
                <form onSubmit={(e) => { e.preventDefault(); handleCreateFolder() }}>
                  <input
                    className="conv-rename-input"
                    placeholder="Folder name..."
                    value={newFolderName}
                    onChange={e => setNewFolderName(e.target.value)}
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Escape') { setCreatingFolder(false); setNewFolderName('') } }}
                    onBlur={() => { if (!newFolderName.trim()) { setCreatingFolder(false); setNewFolderName('') } }}
                  />
                </form>
              </div>
            )}

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

              {/* Starred section (only on Yours tab) */}
              {starredConversations.length > 0 && !isSearching && activeTab === 'yours' && (
                <div className="conv-section">
                  <div className="conv-section-label">{t('conversations.starred')}</div>
                  {starredConversations.map(conv => renderConvItem(conv))}
                </div>
              )}

              {/* Recents section */}
              {(recentConversations.length > 0 || isSearching || activeTab !== 'yours') && (
                <div className="conv-section">
                  {activeTab === 'yours' && !isSearching && (
                    <div className="conv-section-label">{t('conversations.recents')}</div>
                  )}
                  {renderRecentsContent()}
                </div>
              )}

              {/* Search result count */}
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
              {tabConversations.length === 0 && !searchQuery && (
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
