// ─── useDiscovery Hook ──────────────────────────────────────────
//
// Discover feed, engagement actions, and author profiles.

import { useCallback, useMemo } from 'react'
import { useDiscoveryStore, type FeedMode, type FeedItem, type AuthorProfile } from '../stores/discoveryStore'
import { useShallow } from 'zustand/react/shallow'

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

async function callEdge(fn: string, body: Record<string, unknown>, auth?: boolean): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY,
  }

  if (auth) {
    const token = await getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(err.error || `${fn} failed`)
  }

  return res.json()
}

export function useDiscovery() {
  // Select only the state slices we need for rendering
  const { feed, feedMode, feedTopic, feedSearch, feedOffset, feedHasMore, feedLoading, topics, engagement, bookmarks, bookmarksLoading } = useDiscoveryStore(
    useShallow(s => ({
      feed: s.feed,
      feedMode: s.feedMode,
      feedTopic: s.feedTopic,
      feedSearch: s.feedSearch,
      feedOffset: s.feedOffset,
      feedHasMore: s.feedHasMore,
      feedLoading: s.feedLoading,
      topics: s.topics,
      engagement: s.engagement,
      bookmarks: s.bookmarks,
      bookmarksLoading: s.bookmarksLoading,
    }))
  )

  // Get actions directly (stable references, no re-render)
  const actions = useMemo(() => ({
    setFeed: useDiscoveryStore.getState().setFeed,
    appendFeed: useDiscoveryStore.getState().appendFeed,
    setFeedMode: useDiscoveryStore.getState().setFeedMode,
    setFeedTopic: useDiscoveryStore.getState().setFeedTopic,
    setFeedSearch: useDiscoveryStore.getState().setFeedSearch,
    setFeedLoading: useDiscoveryStore.getState().setFeedLoading,
    setTopics: useDiscoveryStore.getState().setTopics,
    setLiked: useDiscoveryStore.getState().setLiked,
    setBookmarked: useDiscoveryStore.getState().setBookmarked,
    setFollowing: useDiscoveryStore.getState().setFollowing,
    updateFeedItemCounts: useDiscoveryStore.getState().updateFeedItemCounts,
    setBookmarks: useDiscoveryStore.getState().setBookmarks,
    setBookmarksLoading: useDiscoveryStore.getState().setBookmarksLoading,
  }), [])

  // ─── Feed ─────────────────────────────────────────────────────

  const loadFeed = useCallback(async (mode?: FeedMode, opts?: { topic?: string; search?: string; reset?: boolean }) => {
    const s = useDiscoveryStore.getState()
    const fm = mode || s.feedMode
    const topic = opts?.topic ?? s.feedTopic
    const search = opts?.search ?? s.feedSearch
    const offset = opts?.reset ? 0 : s.feedOffset

    actions.setFeedLoading(true)
    try {
      const data = await callEdge('discover-feed', {
        mode: fm,
        topic,
        search,
        limit: 20,
        offset,
      }, fm === 'personalized')

      if (opts?.reset || offset === 0) {
        actions.setFeed(data.items || [], data.hasMore || false)
      } else {
        actions.appendFeed(data.items || [], data.hasMore || false)
      }

      if (data.topics?.length) {
        actions.setTopics(data.topics)
      }
    } finally {
      actions.setFeedLoading(false)
    }
  }, [actions])

  const loadMore = useCallback(async () => {
    const s = useDiscoveryStore.getState()
    if (s.feedLoading || !s.feedHasMore) return
    await loadFeed(undefined, { reset: false })
  }, [loadFeed])

  const switchMode = useCallback(async (mode: FeedMode) => {
    actions.setFeedMode(mode)
    actions.setFeedSearch(null)
    actions.setFeedTopic(null)
    await loadFeed(mode, { reset: true })
  }, [actions, loadFeed])

  const searchContent = useCallback(async (query: string) => {
    if (!query) {
      // Empty search — return to trending
      actions.setFeedMode('trending')
      actions.setFeedSearch(null)
      await loadFeed('trending', { reset: true })
      return
    }
    actions.setFeedMode('search')
    actions.setFeedSearch(query)
    await loadFeed('search', { search: query, reset: true })
  }, [actions, loadFeed])

  const filterByTopic = useCallback(async (topic: string) => {
    actions.setFeedMode('topic')
    actions.setFeedTopic(topic)
    await loadFeed('topic', { topic, reset: true })
  }, [actions, loadFeed])

  // ─── Engagement ───────────────────────────────────────────────

  const toggleLike = useCallback(async (contentId: string) => {
    const wasLiked = useDiscoveryStore.getState().engagement.liked[contentId] || false

    // Optimistic update
    actions.setLiked(contentId, !wasLiked)
    actions.updateFeedItemCounts(contentId, { like_count: wasLiked ? -1 : 1 })

    try {
      await callEdge('engagement', {
        action: 'toggle_like',
        data: { content_id: contentId },
      }, true)
    } catch {
      // Revert on error
      actions.setLiked(contentId, wasLiked)
      actions.updateFeedItemCounts(contentId, { like_count: wasLiked ? 1 : -1 })
    }
  }, [actions])

  const toggleBookmark = useCallback(async (contentId: string) => {
    const wasBookmarked = useDiscoveryStore.getState().engagement.bookmarked[contentId] || false

    actions.setBookmarked(contentId, !wasBookmarked)
    actions.updateFeedItemCounts(contentId, { bookmark_count: wasBookmarked ? -1 : 1 })

    try {
      await callEdge('engagement', {
        action: 'toggle_bookmark',
        data: { content_id: contentId },
      }, true)
    } catch {
      actions.setBookmarked(contentId, wasBookmarked)
      actions.updateFeedItemCounts(contentId, { bookmark_count: wasBookmarked ? 1 : -1 })
    }
  }, [actions])

  const toggleFollow = useCallback(async (authorId: string) => {
    const wasFollowing = useDiscoveryStore.getState().engagement.following[authorId] || false

    actions.setFollowing(authorId, !wasFollowing)

    try {
      await callEdge('engagement', {
        action: 'toggle_follow',
        data: { author_id: authorId },
      }, true)
    } catch {
      actions.setFollowing(authorId, wasFollowing)
    }
  }, [actions])

  const getEngagementStatus = useCallback(async (contentId?: string, authorId?: string) => {
    try {
      const { status } = await callEdge('engagement', {
        action: 'get_status',
        data: { content_id: contentId, author_id: authorId },
      }, true)

      if (contentId && status.liked !== undefined) actions.setLiked(contentId, status.liked)
      if (contentId && status.bookmarked !== undefined) actions.setBookmarked(contentId, status.bookmarked)
      if (authorId && status.following !== undefined) actions.setFollowing(authorId, status.following)

      return status
    } catch {
      return {}
    }
  }, [actions])

  const loadBookmarks = useCallback(async () => {
    actions.setBookmarksLoading(true)
    try {
      const { bookmarks: bm } = await callEdge('engagement', {
        action: 'list_bookmarks',
        data: { limit: 50, offset: 0 },
      }, true)
      actions.setBookmarks(bm || [])
    } finally {
      actions.setBookmarksLoading(false)
    }
  }, [actions])

  // ─── Author Profile ───────────────────────────────────────────

  const getAuthorProfile = useCallback(async (authorId: string): Promise<{ profile: AuthorProfile | null; articles: FeedItem[] }> => {
    const data = await callEdge('author-profile', {
      action: 'get_profile',
      data: { author_id: authorId },
    })
    return { profile: data.profile, articles: data.articles || [] }
  }, [])

  const getOwnProfile = useCallback(async (): Promise<AuthorProfile | null> => {
    const data = await callEdge('author-profile', {
      action: 'get_own_profile',
    }, true)
    return data.profile
  }, [])

  const updateProfile = useCallback(async (updates: Partial<AuthorProfile>): Promise<AuthorProfile> => {
    const data = await callEdge('author-profile', {
      action: 'update_profile',
      data: updates,
    }, true)
    return data.profile
  }, [])

  const addPenName = useCallback(async (penName: string): Promise<string[]> => {
    const data = await callEdge('author-profile', {
      action: 'add_pen_name',
      data: { pen_name: penName },
    }, true)
    return data.pen_names
  }, [])

  return {
    // Feed state
    feed,
    feedMode,
    feedTopic,
    feedSearch,
    feedLoading,
    feedHasMore,
    topics,

    // Feed actions
    loadFeed,
    loadMore,
    switchMode,
    searchContent,
    filterByTopic,

    // Engagement state
    engagement,

    // Engagement actions
    toggleLike,
    toggleBookmark,
    toggleFollow,
    getEngagementStatus,
    loadBookmarks,
    bookmarks,
    bookmarksLoading,

    // Author profile
    getAuthorProfile,
    getOwnProfile,
    updateProfile,
    addPenName,
  }
}
