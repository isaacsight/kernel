// ─── Engagement Buttons ────────────────────────────────────────
//
// Reusable like / bookmark / share button group.
// Used in FeedCard and PublishedContentPage.

import { useState, useCallback, memo } from 'react'
import { useAuthContext } from '../../providers/AuthProvider'

interface EngagementButtonsProps {
  contentId: string
  likeCount: number
  bookmarkCount: number
  commentCount?: number
  isLiked: boolean
  isBookmarked: boolean
  onToggleLike: (contentId: string) => void
  onToggleBookmark: (contentId: string) => void
  onShare?: (contentId: string) => void
  compact?: boolean
}

const BASE = import.meta.env.BASE_URL

export const EngagementButtons = memo(function EngagementButtons({
  contentId,
  likeCount,
  bookmarkCount,
  commentCount,
  isLiked,
  isBookmarked,
  onToggleLike,
  onToggleBookmark,
  onShare,
  compact,
}: EngagementButtonsProps) {
  const { isAuthenticated } = useAuthContext()
  const [shareText, setShareText] = useState<string | null>(null)

  const handleShare = useCallback(() => {
    if (onShare) {
      onShare(contentId)
    } else {
      const url = `${window.location.origin}/#/p/${contentId}`
      navigator.clipboard.writeText(url)
      setShareText('Copied')
      setTimeout(() => setShareText(null), 2000)
    }
  }, [contentId, onShare])

  const handleAuthAction = useCallback((action: (id: string) => void) => {
    return (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (!isAuthenticated) {
        window.location.hash = '#/'
        return
      }
      action(contentId)
    }
  }, [contentId, isAuthenticated])

  return (
    <div className={`ka-engagement ${compact ? 'ka-engagement--compact' : ''}`}>
      <button
        className={`ka-engagement-btn ${isLiked ? 'ka-engagement-btn--active' : ''}`}
        onClick={handleAuthAction(onToggleLike)}
        aria-label={isAuthenticated ? (isLiked ? 'Unlike' : 'Like') : 'Sign in to like'}
        aria-pressed={isLiked}
      >
        <span className="ka-engagement-icon">{isLiked ? '\u2665' : '\u2661'}</span>
        {likeCount > 0 && <span className="ka-engagement-count">{likeCount}</span>}
      </button>

      <button
        className={`ka-engagement-btn ${isBookmarked ? 'ka-engagement-btn--active' : ''}`}
        onClick={handleAuthAction(onToggleBookmark)}
        aria-label={isAuthenticated ? (isBookmarked ? 'Remove bookmark' : 'Bookmark') : 'Sign in to bookmark'}
        aria-pressed={isBookmarked}
      >
        <span className="ka-engagement-icon">{isBookmarked ? '\u2605' : '\u2606'}</span>
        {bookmarkCount > 0 && <span className="ka-engagement-count">{bookmarkCount}</span>}
      </button>

      {commentCount !== undefined && commentCount > 0 && (
        <span className="ka-engagement-stat">
          <span className="ka-engagement-icon">{'\u2709'}</span>
          <span className="ka-engagement-count">{commentCount}</span>
        </span>
      )}

      <button
        className="ka-engagement-btn ka-engagement-btn--share"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleShare() }}
        aria-label="Share"
      >
        <span className="ka-engagement-icon">{shareText || '\u2197'}</span>
      </button>
    </div>
  )
})
