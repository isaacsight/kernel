// ─── MyContentPanel — Dashboard of published items with stats ────
//
// Shows the user's published content items with view, like,
// and bookmark counts. Uses content-engine list_items action.

import { useState, useEffect, useCallback } from 'react'
import { motion, useDragControls } from 'motion/react'
import { SPRING } from '../constants/motion'
import { IconClose, IconFileText, IconEye, IconThumbsUp, IconLink } from './KernelIcons'

interface ContentItem {
  id: string
  title: string | null
  slug: string | null
  format: string
  tags: string[]
  current_stage: string
  created_at: string
  updated_at: string
  is_published?: boolean
  view_count?: number
  like_count?: number
  bookmark_count?: number
}

interface MyContentPanelProps {
  onClose: () => void
  onPublish?: (contentId: string, title: string) => void
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://eoxxpyixdieprsxlpwcs.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || ''

async function getToken(): Promise<string | null> {
  try {
    const { getAccessToken } = await import('../engine/SupabaseClient')
    return await getAccessToken()
  } catch {
    return null
  }
}

export function MyContentPanel({ onClose, onPublish }: MyContentPanelProps) {
  const dragControls = useDragControls()

  const [items, setItems] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadItems = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const token = await getToken()
      const res = await fetch(`${SUPABASE_URL}/functions/v1/content-engine`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action: 'list_items' }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Load failed' }))
        throw new Error(err.error || 'Failed to load content')
      }

      const data = await res.json()
      setItems(data.items || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    } catch {
      return dateStr
    }
  }

  return (
    <>
      <motion.div
        className="ka-my-content-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="ka-my-content-panel"
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
        <div className="ka-my-content-drag-handle" onPointerDown={(e) => dragControls.start(e)} />

        <div className="ka-my-content-header">
          <h3 className="ka-my-content-title">
            <IconFileText size={18} /> My Content
          </h3>
          <button className="ka-my-content-close" onClick={onClose}>
            <IconClose size={14} />
          </button>
        </div>

        {loading ? (
          <div className="ka-my-content-loading">Loading your content...</div>
        ) : error ? (
          <div className="ka-my-content-error">{error}</div>
        ) : items.length === 0 ? (
          <div className="ka-empty-state">
            <img className="ka-empty-state-illustration" src={`${import.meta.env.BASE_URL}concepts/empty-briefings.svg`} alt="" />
            <div className="ka-empty-state-title">No content yet</div>
            <div className="ka-empty-state-desc">Use the Content Engine to create your first piece.</div>
          </div>
        ) : (
          <div className="ka-my-content-list">
            {items.map(item => (
              <div key={item.id} className="ka-my-content-item">
                <div className="ka-my-content-item-header">
                  <span className="ka-my-content-item-title">{item.title || 'Untitled'}</span>
                  <span className="ka-my-content-item-format">{item.format.replace(/_/g, ' ')}</span>
                </div>
                <div className="ka-my-content-item-meta">
                  <span className="ka-my-content-item-stage">{item.current_stage}</span>
                  <span className="ka-my-content-item-date">{formatDate(item.updated_at)}</span>
                </div>
                {/* Stats row */}
                <div className="ka-my-content-item-stats">
                  {item.view_count !== undefined && (
                    <span className="ka-my-content-stat"><IconEye size={12} /> {item.view_count}</span>
                  )}
                  {item.like_count !== undefined && (
                    <span className="ka-my-content-stat"><IconThumbsUp size={12} /> {item.like_count}</span>
                  )}
                  {item.slug && (
                    <a
                      className="ka-my-content-stat ka-my-content-stat--link"
                      href={`https://kernel.chat/#/p/${item.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <IconLink size={12} /> View
                    </a>
                  )}
                  {!item.slug && onPublish && (
                    <button
                      className="ka-my-content-publish-btn"
                      onClick={() => onPublish(item.id, item.title || 'Untitled')}
                    >
                      Publish
                    </button>
                  )}
                </div>
                {item.tags.length > 0 && (
                  <div className="ka-my-content-item-tags">
                    {item.tags.map(tag => (
                      <span key={tag} className="ka-my-content-tag">{tag}</span>
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
