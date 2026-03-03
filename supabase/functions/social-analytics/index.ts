// Supabase Edge Function: social-analytics
// Collects engagement metrics for published posts.
// Actions: collect, dashboard, sync_to_algorithm
//
// Deploy: npx supabase functions deploy social-analytics --project-ref eoxxpyixdieprsxlpwcs --no-verify-jwt

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handlePreflight, SECURITY_HEADERS } from '../_shared/cors.ts'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { logAudit, getClientIP, getUA } from '../_shared/audit.ts'
import { requireContentType } from '../_shared/validate.ts'
import { resolvePlanId, ACTIVE_STATUSES } from '../_shared/plan-limits.ts'
import { getAdapter } from '../_shared/social/registry.ts'

type Action = 'collect' | 'dashboard' | 'sync_to_algorithm'

interface Payload {
  action: Action
  data?: Record<string, unknown>
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handlePreflight(req)
  const CORS = { ...corsHeaders(req), ...SECURITY_HEADERS }

  try {
    const ctErr = requireContentType(req)
    if (ctErr) return ctErr(CORS)

    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing auth' }), {
        status: 401, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    const authClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!)
    const { data: { user }, error: authError } = await authClient.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    const svc = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    const { data: sub } = await svc.from('subscriptions').select('status, plan').eq('user_id', user.id).maybeSingle()
    if (!sub || !ACTIVE_STATUSES.includes(sub.status)) {
      return new Response(JSON.stringify({ error: 'pro_required' }), {
        status: 403, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    const planId = resolvePlanId(sub)
    const tier = planId === 'free' ? 'free' : planId.startsWith('max') ? 'max' : 'pro'
    const rl = await checkRateLimit(svc, user.id, 'social-analytics', tier as 'free' | 'paid' | 'pro' | 'max')
    if (!rl.allowed) return rateLimitResponse(rl, CORS)

    const payload = await req.json() as Payload
    let result: Record<string, unknown> = {}

    switch (payload.action) {
      case 'collect': {
        const d = payload.data || {}
        const postId = d.post_id as string
        if (!postId) throw new Error('post_id required')

        const { data: post } = await svc.from('social_posts')
          .select('*, social_accounts(*)')
          .eq('id', postId).eq('user_id', user.id).single()
        if (!post || post.status !== 'published') throw new Error('Post not found or not published')

        const account = post.social_accounts
        if (!account) throw new Error('Account not found')

        const { data: accessToken } = await svc.rpc('decrypt_social_token', { encrypted: account.access_token_enc })
        const adapter = getAdapter(post.platform)
        const analytics = await adapter.getPostAnalytics(accessToken, post.platform_post_id)

        const { data: entry } = await svc.from('social_analytics').insert({
          post_id: postId,
          user_id: user.id,
          platform: post.platform,
          impressions: analytics.impressions,
          likes: analytics.likes,
          reposts: analytics.reposts,
          replies: analytics.replies,
          clicks: analytics.clicks,
          saves: analytics.saves,
          reach: analytics.reach,
          engagement_rate: analytics.engagementRate,
        }).select().single()

        result = { analytics: entry }
        break
      }

      case 'dashboard': {
        // Aggregate analytics for all user's published posts
        const { data: posts } = await svc.from('social_posts')
          .select('id, platform, body, platform_url, published_at, social_analytics(impressions, likes, reposts, replies, clicks, saves, engagement_rate, collected_at)')
          .eq('user_id', user.id)
          .eq('status', 'published')
          .order('published_at', { ascending: false })
          .limit(20)

        // Calculate totals
        let totalImpressions = 0, totalLikes = 0, totalReposts = 0, totalReplies = 0

        const postSummaries = (posts || []).map((p: any) => {
          const latestAnalytics = p.social_analytics?.sort(
            (a: any, b: any) => new Date(b.collected_at).getTime() - new Date(a.collected_at).getTime()
          )[0] || null

          if (latestAnalytics) {
            totalImpressions += latestAnalytics.impressions
            totalLikes += latestAnalytics.likes
            totalReposts += latestAnalytics.reposts
            totalReplies += latestAnalytics.replies
          }

          return {
            id: p.id,
            platform: p.platform,
            body: p.body?.slice(0, 100),
            platformUrl: p.platform_url,
            publishedAt: p.published_at,
            latestAnalytics,
          }
        })

        result = {
          totals: { impressions: totalImpressions, likes: totalLikes, reposts: totalReposts, replies: totalReplies },
          posts: postSummaries,
        }
        break
      }

      case 'sync_to_algorithm': {
        // Sync social metrics into content_performance for AlgorithmEngine feedback
        const d = payload.data || {}
        const postId = d.post_id as string
        if (!postId) throw new Error('post_id required')

        const { data: post } = await svc.from('social_posts')
          .select('content_id, platform')
          .eq('id', postId).eq('user_id', user.id).single()
        if (!post?.content_id) throw new Error('Post has no linked content item')

        // Get latest analytics
        const { data: latest } = await svc.from('social_analytics')
          .select('*')
          .eq('post_id', postId)
          .order('collected_at', { ascending: false })
          .limit(1)
          .single()

        if (!latest) throw new Error('No analytics data')

        // Normalize to 0-1 scale (rough heuristic)
        const normalize = (value: number, max: number) => Math.min(1, value / max)
        const normalizedEngagement = normalize(latest.engagement_rate, 0.1) // 10% engagement = 1.0

        // Insert into content_performance
        await svc.from('content_performance').insert([
          { content_id: post.content_id, platform: post.platform, metric: 'engagement_rate', value: normalizedEngagement },
          { content_id: post.content_id, platform: post.platform, metric: 'impressions', value: normalize(latest.impressions, 10000) },
          { content_id: post.content_id, platform: post.platform, metric: 'likes', value: normalize(latest.likes, 500) },
        ])

        result = { synced: true, normalizedEngagement }
        break
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${payload.action}` }), {
          status: 400, headers: { 'Content-Type': 'application/json', ...CORS },
        })
    }

    return new Response(JSON.stringify({ ok: true, ...result }), {
      status: 200, headers: { 'Content-Type': 'application/json', ...CORS },
    })

  } catch (error) {
    console.error('social-analytics error:', error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(req), ...SECURITY_HEADERS },
    })
  }
})
