// ─── Social Media Client Types ──────────────────────────────────

export type SocialPlatform = 'twitter' | 'linkedin' | 'instagram' | 'threads' | 'bluesky' | 'mastodon'

export type PostStatus = 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed' | 'cancelled'

export interface SocialAccount {
  id: string
  platform: SocialPlatform
  platformUsername: string
  platformDisplayName: string
  platformAvatarUrl?: string
  isActive: boolean
  connectedAt: string
  lastUsedAt?: string
}

export interface SocialPost {
  id: string
  contentId?: string
  accountId: string
  platform: SocialPlatform
  body: string
  mediaUrls: string[]
  threadParts?: string[]
  hashtags: string[]
  status: PostStatus
  scheduledAt?: string
  publishedAt?: string
  platformPostId?: string
  platformUrl?: string
  publishError?: string
  retryCount: number
  createdAt: string
  updatedAt: string
}

export interface SocialAnalyticsSnapshot {
  id: string
  postId: string
  platform: SocialPlatform
  impressions: number
  likes: number
  reposts: number
  replies: number
  clicks: number
  saves: number
  reach: number
  engagementRate: number
  collectedAt: string
}

export interface AdaptedContent {
  body: string
  hashtags: string[]
  threadParts?: string[]
}

export interface AnalyticsTotals {
  impressions: number
  likes: number
  reposts: number
  replies: number
}

export interface PostSummary {
  id: string
  platform: SocialPlatform
  body: string
  platformUrl: string
  publishedAt: string
  latestAnalytics: SocialAnalyticsSnapshot | null
}

export interface DashboardData {
  totals: AnalyticsTotals
  posts: PostSummary[]
}

export const PLATFORM_META: Record<SocialPlatform, { label: string; charLimit: number; color: string; supportsThreads: boolean }> = {
  twitter: { label: 'X (Twitter)', charLimit: 280, color: '#000000', supportsThreads: true },
  linkedin: { label: 'LinkedIn', charLimit: 3000, color: '#0A66C2', supportsThreads: false },
  instagram: { label: 'Instagram', charLimit: 2200, color: '#E4405F', supportsThreads: false },
  threads: { label: 'Threads', charLimit: 500, color: '#000000', supportsThreads: true },
  bluesky: { label: 'Bluesky', charLimit: 300, color: '#0085FF', supportsThreads: true },
  mastodon: { label: 'Mastodon', charLimit: 500, color: '#6364FF', supportsThreads: false },
}
