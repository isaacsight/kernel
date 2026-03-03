// ─── PublishedContentPage ──────────────────────────────────────
//
// Public reading page for published content at /#/p/{slug}.
// Literary layout with EB Garamond prose, drop cap, TOC.
// Includes comments section for authenticated users.
// Pattern follows SharedConversationPage (public data fetch).

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageContent } from '../components/MessageContent'
import { useAuthContext } from '../providers/AuthProvider'
import { EngagementButtons } from '../components/discovery/EngagementButtons'
import { useDiscovery } from '../hooks/useDiscovery'

interface PublishedContent {
  id: string
  user_id: string
  title: string
  slug: string
  final_content: string
  tags: string[]
  format: string
  meta_description: string
  author_name: string
  view_count: number
  like_count: number
  bookmark_count: number
  comment_count: number
  published_at: string
  created_at: string
}

interface Comment {
  id: string
  content_id: string
  user_id: string
  parent_id: string | null
  body: string
  author_name: string
  is_deleted: boolean
  created_at: string
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://eoxxpyixdieprsxlpwcs.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || ''
const BASE = import.meta.env.BASE_URL

function estimateReadingTime(text: string): number {
  const words = text.split(/\s+/).length
  return Math.max(1, Math.ceil(words / 230))
}

function extractHeadings(text: string): { level: number; text: string; id: string }[] {
  const headings: { level: number; text: string; id: string }[] = []
  const regex = /^(#{1,3})\s+(.+)$/gm
  let match
  while ((match = regex.exec(text)) !== null) {
    const hText = match[2].replace(/[*_`~\[\]#]/g, '').trim()
    const id = hText.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    headings.push({ level: match[1].length, text: hText, id })
  }
  return headings
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function relativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return formatDate(dateStr)
}

// ─── Comments Section ──────────────────────────────────────────

function CommentsSection({ contentId }: { contentId: string }) {
  const { user, isAuthenticated } = useAuthContext()
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/content_comments?content_id=eq.${contentId}&is_deleted=eq.false&order=created_at.asc`,
        { headers: { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' } },
      )
      if (res.ok) {
        setComments(await res.json())
      }
    } catch {
      // fail silently — comments are non-critical
    } finally {
      setLoading(false)
    }
  }, [contentId])

  useEffect(() => { fetchComments() }, [fetchComments])

  const submitComment = useCallback(async (body: string, parentId?: string | null) => {
    if (!user || !body.trim() || submitting) return
    setSubmitting(true)

    try {
      const { getAccessToken } = await import('../engine/SupabaseClient')
      const token = await getAccessToken()
      if (!token) return

      const authorName = user.user_metadata?.name || user.email?.split('@')[0] || 'Anonymous'
      const res = await fetch(`${SUPABASE_URL}/rest/v1/content_comments`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify({
          content_id: contentId,
          user_id: user.id,
          parent_id: parentId || null,
          body: body.trim(),
          author_name: authorName,
        }),
      })

      if (res.ok) {
        const [comment] = await res.json()
        setComments(prev => [...prev, comment])
        setNewComment('')
        setReplyTo(null)
        setReplyText('')
      }
    } catch {
      // fail silently
    } finally {
      setSubmitting(false)
    }
  }, [user, contentId, submitting])

  // Build thread tree
  const topLevel = comments.filter(c => !c.parent_id)
  const replies = (parentId: string) => comments.filter(c => c.parent_id === parentId)

  return (
    <section className="ka-published-comments" aria-label="Comments">
      <h2 className="ka-published-comments-title">
        Comments {comments.length > 0 && `(${comments.length})`}
      </h2>

      {isAuthenticated ? (
        <div className="ka-published-comment-form">
          <textarea
            className="ka-published-comment-input"
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            placeholder="Share your thoughts..."
            rows={3}
            maxLength={2000}
          />
          <button
            className="ka-published-comment-submit"
            onClick={() => submitComment(newComment)}
            disabled={!newComment.trim() || submitting}
          >
            {submitting ? 'Posting...' : 'Post Comment'}
          </button>
        </div>
      ) : (
        <p className="ka-published-comments-login">
          <a href={`${BASE}#/`}>Sign in</a> to join the conversation.
        </p>
      )}

      {loading ? (
        <p className="ka-published-comments-loading">Loading comments...</p>
      ) : comments.length === 0 ? (
        <p className="ka-published-comments-empty">No comments yet. Be the first to share your thoughts.</p>
      ) : (
        <div className="ka-published-comment-list">
          {topLevel.map(comment => (
            <div key={comment.id} className="ka-published-comment-thread">
              <CommentItem
                comment={comment}
                onReply={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
                isAuthenticated={isAuthenticated}
              />

              {/* Replies */}
              {replies(comment.id).map(reply => (
                <div key={reply.id} className="ka-published-comment-reply">
                  <CommentItem comment={reply} isAuthenticated={isAuthenticated} />
                </div>
              ))}

              {/* Reply form */}
              <AnimatePresence>
                {replyTo === comment.id && isAuthenticated && (
                  <motion.div
                    className="ka-published-reply-form"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                  >
                    <textarea
                      className="ka-published-comment-input ka-published-comment-input--reply"
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      placeholder={`Reply to ${comment.author_name}...`}
                      rows={2}
                      maxLength={2000}
                      autoFocus
                    />
                    <div className="ka-published-reply-actions">
                      <button
                        className="ka-published-comment-submit"
                        onClick={() => submitComment(replyText, comment.id)}
                        disabled={!replyText.trim() || submitting}
                      >
                        Reply
                      </button>
                      <button
                        className="ka-published-comment-cancel"
                        onClick={() => { setReplyTo(null); setReplyText('') }}
                      >
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function CommentItem({
  comment,
  onReply,
  isAuthenticated,
}: {
  comment: Comment
  onReply?: () => void
  isAuthenticated: boolean
}) {
  return (
    <div className="ka-published-comment">
      <div className="ka-published-comment-header">
        <span className="ka-published-comment-author">{comment.author_name}</span>
        <span className="ka-published-comment-time">{relativeTime(comment.created_at)}</span>
      </div>
      <p className="ka-published-comment-body">{comment.body}</p>
      {onReply && isAuthenticated && (
        <button className="ka-published-comment-reply-btn" onClick={onReply}>
          Reply
        </button>
      )}
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────

export function PublishedContentPage() {
  const { slug } = useParams<{ slug: string }>()
  const [data, setData] = useState<PublishedContent | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const { engagement, toggleLike, toggleBookmark, getEngagementStatus } = useDiscovery()

  // Enable scrolling (override body fixed positioning)
  useEffect(() => {
    document.body.classList.add('ka-scrollable-page')
    return () => { document.body.classList.remove('ka-scrollable-page') }
  }, [])

  useEffect(() => {
    if (!slug) return
    fetch(`${SUPABASE_URL}/functions/v1/published-content?slug=${encodeURIComponent(slug)}`)
      .then(async res => {
        if (res.status === 429) {
          throw new Error('Too many requests. Please wait a moment and try again.')
        }
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: 'Not found' }))
          throw new Error(body.error || 'Not found')
        }
        return res.json()
      })
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [slug])

  // Load engagement status when data is available
  useEffect(() => {
    if (data?.id) {
      getEngagementStatus(data.id, data.user_id)
    }
  }, [data?.id, data?.user_id, getEngagementStatus])

  const headings = useMemo(() => {
    if (!data?.final_content) return []
    return extractHeadings(data.final_content)
  }, [data?.final_content])

  const readingTime = useMemo(() => {
    if (!data?.final_content) return 0
    return estimateReadingTime(data.final_content)
  }, [data?.final_content])

  if (loading) {
    return (
      <div className="ka-published-page">
        <div className="ka-published-loading">Loading...</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="ka-published-page">
        <div className="ka-published-error">
          <h1>Content not found</h1>
          <p>This page may have been unpublished or the link is invalid.</p>
          <a href={`${BASE}#/`} className="ka-published-cta">
            Try Kernel
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="ka-published-page">
      <header className="ka-published-header">
        <a href={`${BASE}#/`} className="ka-published-logo-link">
          <img className="ka-logo" src={`${BASE}logo-mark.svg`} alt="Kernel" />
        </a>
      </header>

      <motion.article
        className="ka-published-article"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      >
        <h1 className="ka-published-title">{data.title}</h1>

        <div className="ka-published-meta">
          {data.author_name && (
            <span className="ka-published-author">{data.author_name}</span>
          )}
          <span className="ka-published-date">{formatDate(data.published_at)}</span>
          <span className="ka-published-reading-time">{readingTime} min read</span>
          <span className="ka-published-views">{data.view_count.toLocaleString()} view{data.view_count !== 1 ? 's' : ''}</span>
        </div>

        {data.tags.length > 0 && (
          <div className="ka-published-tags">
            {data.tags.map(tag => (
              <span key={tag} className="ka-published-tag">{tag}</span>
            ))}
          </div>
        )}

        {headings.length > 2 && (
          <nav className="ka-published-toc" aria-label="Table of contents">
            <span className="ka-published-toc-title">Contents</span>
            <ul>
              {headings.map(h => (
                <li key={h.id} className={`ka-published-toc-item ka-published-toc-item--${h.level}`}>
                  <a href={`#${h.id}`}>{h.text}</a>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <div className="ka-published-body">
          <MessageContent text={data.final_content} />
        </div>

        {/* Engagement bar */}
        <div className="ka-published-engagement">
          <EngagementButtons
            contentId={data.id}
            likeCount={data.like_count || 0}
            bookmarkCount={data.bookmark_count || 0}
            commentCount={data.comment_count || 0}
            isLiked={engagement.liked[data.id] || false}
            isBookmarked={engagement.bookmarked[data.id] || false}
            onToggleLike={toggleLike}
            onToggleBookmark={toggleBookmark}
            onShare={() => {
              navigator.clipboard.writeText(`https://kernel.chat/#/p/${data.slug}`)
            }}
          />
          {data.author_name && (
            <a
              href={`/#/author/${data.user_id}`}
              className="ka-published-author-link"
            >
              More by {data.author_name}
            </a>
          )}
        </div>
      </motion.article>

      <CommentsSection contentId={data.id} />

      <footer className="ka-published-footer">
        <p>
          Published on <a href={`${BASE}#/`}><strong>Kernel</strong></a> — AI that learns you.
        </p>
      </footer>
    </div>
  )
}
