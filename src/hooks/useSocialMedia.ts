// ─── useSocialMedia Hook ────────────────────────────────────────
//
// Connect accounts, adapt content, publish, schedule, analytics.

import { useCallback } from 'react'
import { useSocialStore } from '../stores/socialStore'
import type { SocialAccount, SocialPost, AdaptedContent, SocialPlatform, DashboardData } from '../engine/social/types'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://eoxxpyixdieprsxlpwcs.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || ''

async function getToken(): Promise<string> {
  const { getAccessToken } = await import('../engine/SupabaseClient')
  const token = await getAccessToken()
  if (!token) throw new Error('Not authenticated')
  return token
}

async function callEdge(fn: string, body: Record<string, unknown>): Promise<any> {
  const token = await getToken()
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'apikey': SUPABASE_KEY,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(err.error || `${fn} failed`)
  }
  return res.json()
}

export function useSocialMedia() {
  const store = useSocialStore()

  // ─── Account Management ───────────────────────────────────

  const connectAccount = useCallback(async (platform: SocialPlatform) => {
    const { authUrl } = await callEdge('social-auth', {
      action: 'init_oauth',
      platform,
    })
    // Open OAuth flow in new window
    window.open(authUrl, 'social-auth', 'width=600,height=700')
  }, [])

  const disconnectAccount = useCallback(async (accountId: string) => {
    await callEdge('social-auth', { action: 'disconnect', account_id: accountId })
    store.removeAccount(accountId)
  }, [store])

  const refreshAccounts = useCallback(async () => {
    store.setLoading(true)
    try {
      const { accounts } = await callEdge('social-auth', { action: 'list_accounts' })
      const mapped: SocialAccount[] = (accounts || []).map((a: any) => ({
        id: a.id,
        platform: a.platform,
        platformUsername: a.platform_username,
        platformDisplayName: a.platform_display_name,
        platformAvatarUrl: a.platform_avatar_url,
        isActive: a.is_active,
        connectedAt: a.connected_at,
        lastUsedAt: a.last_used_at,
      }))
      store.setAccounts(mapped)
    } finally {
      store.setLoading(false)
    }
  }, [store])

  // ─── Content Adaptation ───────────────────────────────────

  const adaptContent = useCallback(async (
    content: string,
    platform: SocialPlatform,
    accountId: string,
  ): Promise<AdaptedContent> => {
    const { adapted } = await callEdge('social-publish', {
      action: 'adapt_content',
      data: { content, platform, account_id: accountId },
    })
    return adapted
  }, [])

  // ─── Publishing ───────────────────────────────────────────

  const publishPost = useCallback(async (
    accountId: string,
    body: string,
    opts?: {
      contentId?: string
      threadParts?: string[]
      hashtags?: string[]
      postId?: string
    },
  ) => {
    const result = await callEdge('social-publish', {
      action: 'publish',
      data: {
        account_id: accountId,
        body,
        content_id: opts?.contentId,
        thread_parts: opts?.threadParts,
        hashtags: opts?.hashtags,
        post_id: opts?.postId,
      },
    })
    // Refresh posts list
    await refreshPosts()
    return result
  }, [])

  const schedulePost = useCallback(async (
    accountId: string,
    platform: SocialPlatform,
    body: string,
    scheduledAt: string,
    opts?: {
      contentId?: string
      threadParts?: string[]
      hashtags?: string[]
    },
  ) => {
    const { post } = await callEdge('social-publish', {
      action: 'schedule',
      data: {
        account_id: accountId,
        platform,
        body,
        scheduled_at: scheduledAt,
        content_id: opts?.contentId,
        thread_parts: opts?.threadParts,
        hashtags: opts?.hashtags,
      },
    })
    if (post) store.addPost(mapPost(post))
    return post
  }, [store])

  const cancelScheduled = useCallback(async (postId: string) => {
    await callEdge('social-publish', { action: 'cancel', data: { post_id: postId } })
    store.updatePost(postId, { status: 'cancelled' })
  }, [store])

  const refreshPosts = useCallback(async () => {
    const { posts } = await callEdge('social-publish', { action: 'list_posts', data: {} })
    store.setPosts((posts || []).map(mapPost))
  }, [store])

  // ─── Analytics ────────────────────────────────────────────

  const collectAnalytics = useCallback(async (postId: string) => {
    return await callEdge('social-analytics', {
      action: 'collect',
      data: { post_id: postId },
    })
  }, [])

  const refreshDashboard = useCallback(async () => {
    const data = await callEdge('social-analytics', { action: 'dashboard', data: {} })
    store.setDashboard({
      totals: data.totals,
      posts: data.posts,
    })
  }, [store])

  const syncToAlgorithm = useCallback(async (postId: string) => {
    return await callEdge('social-analytics', {
      action: 'sync_to_algorithm',
      data: { post_id: postId },
    })
  }, [])

  return {
    // State
    accounts: store.accounts,
    posts: store.posts,
    dashboard: store.dashboard,
    isLoading: store.isLoading,

    // Account ops
    connectAccount,
    disconnectAccount,
    refreshAccounts,

    // Content
    adaptContent,

    // Publishing
    publishPost,
    schedulePost,
    cancelScheduled,
    refreshPosts,

    // Analytics
    collectAnalytics,
    refreshDashboard,
    syncToAlgorithm,
  }
}

function mapPost(p: any): SocialPost {
  return {
    id: p.id,
    contentId: p.content_id,
    accountId: p.account_id,
    platform: p.platform,
    body: p.body,
    mediaUrls: p.media_urls || [],
    threadParts: p.thread_parts ? (typeof p.thread_parts === 'string' ? JSON.parse(p.thread_parts) : p.thread_parts) : undefined,
    hashtags: p.hashtags || [],
    status: p.status,
    scheduledAt: p.scheduled_at,
    publishedAt: p.published_at,
    platformPostId: p.platform_post_id,
    platformUrl: p.platform_url,
    publishError: p.publish_error,
    retryCount: p.retry_count || 0,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  }
}
