// ─── SocialAnalyticsCard ────────────────────────────────────────
// Per-post metrics card used in the analytics tab.

import { PLATFORM_META } from '../engine/social/types'
import type { SocialPlatform } from '../engine/social/types'

interface PostSummary {
  id: string
  platform: SocialPlatform
  body: string
  platformUrl: string
  publishedAt: string
  latestAnalytics: {
    impressions: number
    likes: number
    reposts: number
    replies: number
    clicks: number
    engagement_rate: number
    collected_at: string
  } | null
}

interface Props {
  post: PostSummary
  onRefresh: () => void
}

export function SocialAnalyticsCard({ post, onRefresh }: Props) {
  const meta = PLATFORM_META[post.platform]
  const a = post.latestAnalytics

  return (
    <div className="ka-social-analytics-card">
      <div className="ka-social-analytics-card-header">
        <span className="ka-social-analytics-card-platform" style={{ color: meta?.color }}>
          {meta?.label}
        </span>
        <span className="ka-social-analytics-card-date">
          {new Date(post.publishedAt).toLocaleDateString()}
        </span>
        <button className="ka-social-analytics-card-refresh" onClick={onRefresh}>
          Refresh
        </button>
      </div>

      <p className="ka-social-analytics-card-body">
        {post.body?.slice(0, 100)}{post.body?.length > 100 ? '...' : ''}
      </p>

      {a ? (
        <div className="ka-social-analytics-card-metrics">
          <span>{a.impressions.toLocaleString()} impressions</span>
          <span>{a.likes.toLocaleString()} likes</span>
          <span>{a.reposts.toLocaleString()} reposts</span>
          <span>{a.replies.toLocaleString()} replies</span>
          {a.clicks > 0 && <span>{a.clicks.toLocaleString()} clicks</span>}
          <span>{(a.engagement_rate * 100).toFixed(1)}% engagement</span>
        </div>
      ) : (
        <p className="ka-social-analytics-card-empty">No metrics yet</p>
      )}

      {post.platformUrl && (
        <a
          href={post.platformUrl}
          className="ka-social-analytics-card-link"
          target="_blank"
          rel="noopener noreferrer"
        >
          View post
        </a>
      )}
    </div>
  )
}
