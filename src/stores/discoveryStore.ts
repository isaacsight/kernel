// ─── Discovery Store — Feed, Engagement & Author State ──────────
//
// Persists engagement cache (liked/bookmarked) and bookmarks list.
// Feed items are transient (not persisted).

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface FeedItem {
  id: string
  user_id: string
  title: string | null
  slug: string | null
  tags: string[]
  meta_description: string | null
  author_name: string | null
  format: string
  published_at: string | null
  view_count: number
  like_count: number
  bookmark_count: number
  comment_count: number
  discovery_score: number
  search_rank?: number
}

export interface AuthorProfile {
  display_name: string | null
  bio: string | null
  avatar_url: string | null
  pen_names: string[]
  follower_count: number
  following_count: number
  created_at: string
  is_public?: boolean
  user_id?: string
}

export type FeedMode = 'trending' | 'recent' | 'personalized' | 'topic' | 'search'

interface EngagementCache {
  liked: Record<string, boolean>
  bookmarked: Record<string, boolean>
  following: Record<string, boolean>
}

interface DiscoveryState {
  feed: FeedItem[]
  feedMode: FeedMode
  feedTopic: string | null
  feedSearch: string | null
  feedOffset: number
  feedHasMore: boolean
  feedLoading: boolean
  topics: string[]

  engagement: EngagementCache

  bookmarks: FeedItem[]
  bookmarksLoading: boolean
}

interface DiscoveryActions {
  setFeed: (items: FeedItem[], hasMore: boolean) => void
  appendFeed: (items: FeedItem[], hasMore: boolean) => void
  setFeedMode: (mode: FeedMode) => void
  setFeedTopic: (topic: string | null) => void
  setFeedSearch: (search: string | null) => void
  setFeedOffset: (offset: number) => void
  setFeedLoading: (loading: boolean) => void
  setTopics: (topics: string[]) => void

  setLiked: (contentId: string, liked: boolean) => void
  setBookmarked: (contentId: string, bookmarked: boolean) => void
  setFollowing: (authorId: string, following: boolean) => void

  /** Optimistically update feed item counts */
  updateFeedItemCounts: (contentId: string, delta: { like_count?: number; bookmark_count?: number }) => void

  setBookmarks: (items: FeedItem[]) => void
  setBookmarksLoading: (loading: boolean) => void

  clearFeed: () => void
}

type DiscoveryStore = DiscoveryState & DiscoveryActions

export const useDiscoveryStore = create<DiscoveryStore>()(
  persist(
    (set, get) => ({
      feed: [],
      feedMode: 'trending',
      feedTopic: null,
      feedSearch: null,
      feedOffset: 0,
      feedHasMore: false,
      feedLoading: false,
      topics: [],

      engagement: { liked: {}, bookmarked: {}, following: {} },

      bookmarks: [],
      bookmarksLoading: false,

      setFeed: (items, hasMore) => set({ feed: items, feedHasMore: hasMore, feedOffset: items.length }),
      appendFeed: (items, hasMore) => set(s => ({
        feed: [...s.feed, ...items],
        feedHasMore: hasMore,
        feedOffset: s.feedOffset + items.length,
      })),
      setFeedMode: (mode) => set({ feedMode: mode, feedOffset: 0, feed: [], feedHasMore: false }),
      setFeedTopic: (topic) => set({ feedTopic: topic }),
      setFeedSearch: (search) => set({ feedSearch: search }),
      setFeedOffset: (offset) => set({ feedOffset: offset }),
      setFeedLoading: (loading) => set({ feedLoading: loading }),
      setTopics: (topics) => set({ topics }),

      setLiked: (contentId, liked) => set(s => ({
        engagement: { ...s.engagement, liked: { ...s.engagement.liked, [contentId]: liked } },
      })),
      setBookmarked: (contentId, bookmarked) => set(s => ({
        engagement: { ...s.engagement, bookmarked: { ...s.engagement.bookmarked, [contentId]: bookmarked } },
      })),
      setFollowing: (authorId, following) => set(s => ({
        engagement: { ...s.engagement, following: { ...s.engagement.following, [authorId]: following } },
      })),

      updateFeedItemCounts: (contentId, delta) => set(s => ({
        feed: s.feed.map(item =>
          item.id === contentId
            ? {
                ...item,
                like_count: item.like_count + (delta.like_count || 0),
                bookmark_count: item.bookmark_count + (delta.bookmark_count || 0),
              }
            : item
        ),
      })),

      setBookmarks: (items) => set({ bookmarks: items }),
      setBookmarksLoading: (loading) => set({ bookmarksLoading: loading }),

      clearFeed: () => set({
        feed: [],
        feedOffset: 0,
        feedHasMore: false,
        feedSearch: null,
        feedTopic: null,
      }),
    }),
    {
      name: 'kernel-discovery',
      partialize: (state) => ({
        // Only persist engagement cache, not feed items
        engagement: state.engagement,
        feedMode: state.feedMode,
      }),
    },
  ),
)
