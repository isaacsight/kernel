// ─── PublishPanel — Bottom-sheet for publishing content ──────────
//
// Preview, slug editor, meta description, tags, publish button,
// and post-publish link. Uses the content-engine publish_item action.

import { useState, useCallback } from 'react'
import { motion, useDragControls } from 'motion/react'
import { SPRING } from '../constants/motion'
import { IconClose, IconLink, IconCheck, IconGlobe } from './KernelIcons'

interface PublishPanelProps {
  onClose: () => void
  /** Content item ID to publish */
  contentId: string
  /** Current title (for preview) */
  title: string
  /** Current body preview snippet */
  bodyPreview?: string
  /** Current tags */
  initialTags?: string[]
  /** Author display name */
  authorName?: string
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

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'untitled'
}

export function PublishPanel({
  onClose,
  contentId,
  title,
  bodyPreview,
  initialTags,
  authorName,
}: PublishPanelProps) {
  const dragControls = useDragControls()

  const [slug, setSlug] = useState(slugify(title || 'untitled'))
  const [metaDescription, setMetaDescription] = useState('')
  const [tags, setTags] = useState<string[]>(initialTags || [])
  const [tagInput, setTagInput] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [published, setPublished] = useState(false)
  const [publicUrl, setPublicUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const addTag = useCallback(() => {
    const t = tagInput.trim().toLowerCase()
    if (t && !tags.includes(t) && tags.length < 10) {
      setTags(prev => [...prev, t])
      setTagInput('')
    }
  }, [tagInput, tags])

  const removeTag = useCallback((tag: string) => {
    setTags(prev => prev.filter(t => t !== tag))
  }, [])

  const handlePublish = useCallback(async () => {
    setPublishing(true)
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
        body: JSON.stringify({
          action: 'publish_item',
          data: {
            id: contentId,
            meta_description: metaDescription || undefined,
            author_name: authorName || undefined,
          },
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Publish failed' }))
        throw new Error(err.error || 'Publish failed')
      }

      const data = await res.json()
      setPublished(true)
      setPublicUrl(data.publicUrl || `https://kernel.chat/#/p/${data.slug}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setPublishing(false)
    }
  }, [contentId, metaDescription, authorName])

  const copyLink = useCallback(() => {
    if (publicUrl) {
      navigator.clipboard.writeText(publicUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [publicUrl])

  return (
    <>
      <motion.div
        className="ka-publish-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="ka-publish-panel"
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
        <div className="ka-publish-drag-handle" onPointerDown={(e) => dragControls.start(e)} />

        <div className="ka-publish-header">
          <h3 className="ka-publish-title">
            <IconGlobe size={18} /> Publish
          </h3>
          <button className="ka-publish-close" onClick={onClose}>
            <IconClose size={14} />
          </button>
        </div>

        {!published ? (
          <div className="ka-publish-body">
            {/* Preview */}
            <div className="ka-publish-preview">
              <h4 className="ka-publish-preview-title">{title || 'Untitled'}</h4>
              {bodyPreview && (
                <p className="ka-publish-preview-body">{bodyPreview.slice(0, 200)}{bodyPreview.length > 200 ? '...' : ''}</p>
              )}
            </div>

            {/* Slug */}
            <div className="ka-publish-field">
              <label className="ka-publish-label">Slug</label>
              <div className="ka-publish-slug-row">
                <span className="ka-publish-slug-prefix">kernel.chat/#/p/</span>
                <input
                  type="text"
                  className="ka-publish-slug-input"
                  value={slug}
                  onChange={(e) => setSlug(slugify(e.target.value))}
                  maxLength={80}
                />
              </div>
            </div>

            {/* Meta Description */}
            <div className="ka-publish-field">
              <label className="ka-publish-label">Meta description</label>
              <textarea
                className="ka-publish-textarea"
                value={metaDescription}
                onChange={(e) => setMetaDescription(e.target.value)}
                placeholder="Brief summary for search engines and social previews..."
                maxLength={150}
                rows={2}
              />
              <span className="ka-publish-char-count">{metaDescription.length}/150</span>
            </div>

            {/* Tags */}
            <div className="ka-publish-field">
              <label className="ka-publish-label">Tags</label>
              <div className="ka-publish-tags">
                {tags.map(tag => (
                  <span key={tag} className="ka-publish-tag">
                    {tag}
                    <button className="ka-publish-tag-remove" onClick={() => removeTag(tag)} aria-label="Remove tag">&times;</button>
                  </span>
                ))}
              </div>
              {tags.length < 10 && (
                <div className="ka-publish-tag-input-row">
                  <input
                    type="text"
                    className="ka-publish-tag-input"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    placeholder="Add tag..."
                    maxLength={30}
                  />
                  <button className="ka-publish-tag-add" onClick={addTag} disabled={!tagInput.trim()}>Add</button>
                </div>
              )}
            </div>

            {error && <div className="ka-publish-error">{error}</div>}

            <button
              className="ka-publish-btn"
              onClick={handlePublish}
              disabled={publishing}
            >
              {publishing ? 'Publishing...' : 'Publish'}
            </button>
          </div>
        ) : (
          <div className="ka-publish-success">
            <div className="ka-publish-success-icon"><IconCheck size={24} /></div>
            <h4 className="ka-publish-success-title">Published!</h4>
            <p className="ka-publish-success-desc">Your content is now live.</p>
            {publicUrl && (
              <div className="ka-publish-link-row">
                <a className="ka-publish-link" href={publicUrl} target="_blank" rel="noopener noreferrer">
                  <IconLink size={14} /> {publicUrl}
                </a>
                <button className="ka-publish-copy-btn" onClick={copyLink}>
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            )}
            <button className="ka-publish-done-btn" onClick={onClose}>Done</button>
          </div>
        )}
      </motion.div>
    </>
  )
}
