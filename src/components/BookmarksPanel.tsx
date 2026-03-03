// ─── BookmarksPanel — Saved articles list ───────────────────────
//
// Shows bookmarked content items. Uses the useDiscovery hook
// for loading bookmarks and toggling bookmark state.

import { useEffect } from 'react'
import { motion, useDragControls } from 'framer-motion'
import { SPRING } from '../constants/motion'
import { IconClose, IconBookOpen, IconEye, IconThumbsUp } from './KernelIcons'
import { useDiscovery } from '../hooks/useDiscovery'

interface BookmarksPanelProps {
  onClose: () => void
  onOpenContent?: (slug: string) => void
}

export function BookmarksPanel({ onClose, onOpenContent }: BookmarksPanelProps) {
  const dragControls = useDragControls()
  const { bookmarks, bookmarksLoading, loadBookmarks, toggleBookmark } = useDiscovery()

  useEffect(() => {
    loadBookmarks()
  }, [loadBookmarks])

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return ''
    try {
      return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    } catch {
      return ''
    }
  }

  return (
    <>
      <motion.div
        className="ka-bookmarks-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="ka-bookmarks-panel"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={SPRING.DEFAULT}
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0 }}
        dragElastic={{ top: 0, bottom: 0.2 }}
        onDragEnd={(_, info) => { if (info.offset.y > 80 || info.velocity.y > 300) onClose() }}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <div className="ka-bookmarks-drag-handle" onPointerDown={(e) => dragControls.start(e)} />

        <div className="ka-bookmarks-header">
          <h3 className="ka-bookmarks-title">
            <IconBookOpen size={18} /> Bookmarks
          </h3>
          <button className="ka-bookmarks-close" onClick={onClose}>
            <IconClose size={14} />
          </button>
        </div>

        {bookmarksLoading ? (
          <div className="ka-bookmarks-loading">Loading bookmarks...</div>
        ) : bookmarks.length === 0 ? (
          <div className="ka-empty-state">
            <img className="ka-empty-state-illustration" src={`${import.meta.env.BASE_URL}concepts/empty-knowledge.svg`} alt="" />
            <div className="ka-empty-state-title">No bookmarks yet</div>
            <div className="ka-empty-state-desc">Save articles from the Explore feed to build your reading list.</div>
          </div>
        ) : (
          <div className="ka-bookmarks-list">
            {bookmarks.map(item => (
              <div key={item.id} className="ka-bookmarks-item">
                <div className="ka-bookmarks-item-header">
                  <span
                    className="ka-bookmarks-item-title"
                    onClick={() => item.slug && onOpenContent?.(item.slug)}
                    role={item.slug ? 'button' : undefined}
                    tabIndex={item.slug ? 0 : undefined}
                  >
                    {item.title || 'Untitled'}
                  </span>
                  {item.author_name && (
                    <span className="ka-bookmarks-item-author">{item.author_name}</span>
                  )}
                </div>
                {item.meta_description && (
                  <p className="ka-bookmarks-item-desc">{item.meta_description}</p>
                )}
                <div className="ka-bookmarks-item-footer">
                  <div className="ka-bookmarks-item-stats">
                    <span className="ka-bookmarks-stat"><IconEye size={12} /> {item.view_count}</span>
                    <span className="ka-bookmarks-stat"><IconThumbsUp size={12} /> {item.like_count}</span>
                    {item.published_at && (
                      <span className="ka-bookmarks-stat">{formatDate(item.published_at)}</span>
                    )}
                  </div>
                  <button
                    className="ka-bookmarks-remove-btn"
                    onClick={() => toggleBookmark(item.id)}
                    title="Remove bookmark"
                  >
                    Remove
                  </button>
                </div>
                {item.tags.length > 0 && (
                  <div className="ka-bookmarks-item-tags">
                    {item.tags.map(tag => (
                      <span key={tag} className="ka-bookmarks-tag">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </>
  )
}
