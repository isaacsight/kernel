// ─── Feed Card ─────────────────────────────────────────────────
//
// Article card for the explore feed. Shows title, excerpt, tags,
// author info, and engagement buttons.

import { memo } from 'react'
import type { FeedItem } from '../../stores/discoveryStore'
import { EngagementButtons } from './EngagementButtons'

interface FeedCardProps {
  item: FeedItem
  isLiked: boolean
  isBookmarked: boolean
  onToggleLike: (contentId: string) => void
  onToggleBookmark: (contentId: string) => void
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatViews(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`
  return String(count)
}

export const FeedCard = memo(function FeedCard({ item, isLiked, isBookmarked, onToggleLike, onToggleBookmark }: FeedCardProps) {
  const handleShare = () => {
    if (item.slug) {
      navigator.clipboard.writeText(`https://kernel.chat/#/p/${item.slug}`)
    }
  }

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking an interactive element
    if ((e.target as HTMLElement).closest('button, a')) return
    if (item.slug) window.location.hash = `#/p/${item.slug}`
  }

  return (
    <div
      className="ka-feed-card"
      onClick={handleCardClick}
      role="article"
      aria-label={item.title || 'Untitled'}
    >
      {/* Tags */}
      {item.tags.length > 0 && (
        <div className="ka-feed-card-tags">
          {item.tags.slice(0, 3).map(tag => (
            <span key={tag} className="ka-feed-card-tag">{tag}</span>
          ))}
        </div>
      )}

      {/* Title */}
      <h3 className="ka-feed-card-title">
        <a href={item.slug ? `/#/p/${item.slug}` : undefined}>
          {item.title || 'Untitled'}
        </a>
      </h3>

      {/* Excerpt */}
      {item.meta_description && (
        <p className="ka-feed-card-excerpt">{item.meta_description}</p>
      )}

      {/* Meta row */}
      <div className="ka-feed-card-meta">
        <a
          href={`/#/author/${item.user_id}`}
          className="ka-feed-card-author"
        >
          {item.author_name || 'Anonymous'}
        </a>
        <span className="ka-feed-card-sep">{'\u00B7'}</span>
        <span className="ka-feed-card-date">{formatDate(item.published_at)}</span>
        {item.view_count > 0 && (
          <>
            <span className="ka-feed-card-sep">{'\u00B7'}</span>
            <span className="ka-feed-card-views">{formatViews(item.view_count)} views</span>
          </>
        )}
      </div>

      {/* Engagement */}
      <EngagementButtons
        contentId={item.id}
        likeCount={item.like_count}
        bookmarkCount={item.bookmark_count}
        commentCount={item.comment_count}
        isLiked={isLiked}
        isBookmarked={isBookmarked}
        onToggleLike={onToggleLike}
        onToggleBookmark={onToggleBookmark}
        onShare={handleShare}
        compact
      />
    </div>
  )
})
