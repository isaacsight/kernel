// Supabase Edge Function: engagement
// Social engagement actions: like, bookmark, follow, status check, list bookmarks.
//
// Deploy: npx supabase functions deploy engagement --project-ref eoxxpyixdieprsxlpwcs --no-verify-jwt

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handlePreflight, SECURITY_HEADERS } from '../_shared/cors.ts'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { logAudit, getClientIP, getUA } from '../_shared/audit.ts'
import { requireContentType } from '../_shared/validate.ts'
import { resolvePlanId, ACTIVE_STATUSES } from '../_shared/plan-limits.ts'

type Action = 'toggle_like' | 'toggle_bookmark' | 'toggle_follow' | 'get_status' | 'list_bookmarks'

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handlePreflight(req)
  const CORS = { ...corsHeaders(req), ...SECURITY_HEADERS }

  try {
    const ctErr = requireContentType(req)
    if (ctErr) return ctErr(CORS)

    // Auth required
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing auth' }), {
        status: 401, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    const authClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
    )
    const { data: { user }, error: authErr } = await authClient.auth.getUser(token)
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    const svc = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    // Rate limit
    const { data: sub } = await svc.from('subscriptions')
      .select('status, plan')
      .eq('user_id', user.id)
      .maybeSingle()
    const planId = resolvePlanId(sub)
    const tier = planId === 'free' ? 'free' : planId.startsWith('max') ? 'max' : 'pro'
    const rl = await checkRateLimit(svc, user.id, 'engagement', tier as 'free' | 'paid' | 'pro' | 'max')
    if (!rl.allowed) return rateLimitResponse(rl, CORS)

    const body = await req.json()
    const action = body.action as Action
    const data = body.data || {}

    let result: Record<string, unknown> = {}

    switch (action) {
      case 'toggle_like': {
        const { content_id } = data
        if (!content_id) throw new Error('content_id required')

        // Check if already liked
        const { data: existing } = await svc.from('content_likes')
          .select('id')
          .eq('content_id', content_id)
          .eq('user_id', user.id)
          .maybeSingle()

        if (existing) {
          await svc.from('content_likes').delete().eq('id', existing.id)
          result = { liked: false }
        } else {
          await svc.from('content_likes').insert({ content_id, user_id: user.id })
          result = { liked: true }
        }
        break
      }

      case 'toggle_bookmark': {
        const { content_id } = data
        if (!content_id) throw new Error('content_id required')

        const { data: existing } = await svc.from('content_bookmarks')
          .select('id')
          .eq('content_id', content_id)
          .eq('user_id', user.id)
          .maybeSingle()

        if (existing) {
          await svc.from('content_bookmarks').delete().eq('id', existing.id)
          result = { bookmarked: false }
        } else {
          await svc.from('content_bookmarks').insert({ content_id, user_id: user.id })
          result = { bookmarked: true }
        }
        break
      }

      case 'toggle_follow': {
        const { author_id } = data
        if (!author_id) throw new Error('author_id required')
        if (author_id === user.id) throw new Error('Cannot follow yourself')

        const { data: existing } = await svc.from('author_follows')
          .select('id')
          .eq('follower_id', user.id)
          .eq('following_id', author_id)
          .maybeSingle()

        if (existing) {
          await svc.from('author_follows').delete().eq('id', existing.id)
          result = { following: false }
        } else {
          await svc.from('author_follows').insert({ follower_id: user.id, following_id: author_id })
          result = { following: true }
        }
        break
      }

      case 'get_status': {
        const { content_id, author_id } = data

        const status: Record<string, boolean> = {}

        if (content_id) {
          const { data: liked } = await svc.from('content_likes')
            .select('id')
            .eq('content_id', content_id)
            .eq('user_id', user.id)
            .maybeSingle()
          status.liked = !!liked

          const { data: bookmarked } = await svc.from('content_bookmarks')
            .select('id')
            .eq('content_id', content_id)
            .eq('user_id', user.id)
            .maybeSingle()
          status.bookmarked = !!bookmarked
        }

        if (author_id) {
          const { data: following } = await svc.from('author_follows')
            .select('id')
            .eq('follower_id', user.id)
            .eq('following_id', author_id)
            .maybeSingle()
          status.following = !!following
        }

        result = { status }
        break
      }

      case 'list_bookmarks': {
        const limit = Math.min(Math.max(Number(data.limit) || 20, 1), 50)
        const offset = Math.max(Number(data.offset) || 0, 0)

        const { data: bookmarks, error } = await svc
          .from('content_bookmarks')
          .select(`
            id,
            created_at,
            content_items!inner (
              id, title, slug, tags, meta_description, author_name,
              format, published_at, view_count, like_count, bookmark_count, comment_count
            )
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1)

        if (error) throw error

        result = {
          bookmarks: (bookmarks || []).map((b: any) => ({
            bookmarkedAt: b.created_at,
            ...b.content_items,
          })),
          hasMore: (bookmarks?.length || 0) === limit,
        }
        break
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400, headers: { 'Content-Type': 'application/json', ...CORS },
        })
    }

    // Audit
    logAudit(svc, {
      actorId: user.id,
      eventType: 'engagement.action',
      action: `engagement.${action}`,
      source: 'engagement',
      status: 'success',
      statusCode: 200,
      metadata: { action, ...data },
      ip: getClientIP(req),
      userAgent: getUA(req),
    })

    return new Response(JSON.stringify({ ok: true, ...result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS },
    })

  } catch (error) {
    console.error('engagement error:', error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(req), ...SECURITY_HEADERS },
    })
  }
})
