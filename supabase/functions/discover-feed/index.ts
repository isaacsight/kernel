// Supabase Edge Function: discover-feed
// Public endpoint for browsing published content. Supports trending, recent,
// personalized (followed authors), topic, and full-text search modes.
//
// Deploy: npx supabase functions deploy discover-feed --project-ref eoxxpyixdieprsxlpwcs --no-verify-jwt

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { OPEN_CORS_HEADERS, SECURITY_HEADERS } from '../_shared/cors.ts'
import { logAudit, getClientIP, getUA } from '../_shared/audit.ts'

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: OPEN_CORS_HEADERS })
  }
  const CORS = { ...OPEN_CORS_HEADERS, ...SECURITY_HEADERS }

  try {
    const svc = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    // IP-based rate limit (60/min for public endpoint)
    const clientIP = getClientIP(req) || 'unknown'
    const rlKey = `discover-feed:${clientIP}`
    const { data: rl } = await svc.rpc('check_rate_limit', {
      p_key: rlKey,
      p_endpoint: 'discover-feed',
      p_limit: 60,
      p_window_seconds: 60,
    })
    if (rl && !rl.allowed) {
      return new Response(JSON.stringify({ error: 'rate_limited', retry_after: rl.retry_after_seconds }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': String(rl.retry_after_seconds), ...CORS },
      })
    }

    // Parse body
    const body = await req.json().catch(() => ({}))
    const mode = body.mode || 'trending'
    const topic = body.topic || null
    const search = body.search || null
    const limit = Math.min(Math.max(Number(body.limit) || 20, 1), 50)
    const offset = Math.max(Number(body.offset) || 0, 0)

    // Optional auth for personalized feed
    let userId: string | null = null
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (token) {
      const authClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
      )
      const { data: { user } } = await authClient.auth.getUser(token)
      if (user) userId = user.id
    }

    if (mode === 'personalized' && !userId) {
      return new Response(JSON.stringify({ error: 'Authentication required for personalized feed' }), {
        status: 401, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    // Call the RPC
    const { data, error } = await svc.rpc('discover_feed', {
      p_mode: mode,
      p_topic: topic,
      p_user_id: userId,
      p_search: search,
      p_limit: limit,
      p_offset: offset,
    })

    if (error) {
      console.error('[discover-feed] RPC error:', error)
      throw error
    }

    // Get popular topics (top tags across published content)
    let topics: string[] = []
    if (mode === 'trending' && offset === 0) {
      const { data: tagData } = await svc.rpc('discover_feed', {
        p_mode: 'recent',
        p_topic: null,
        p_user_id: null,
        p_search: null,
        p_limit: 50,
        p_offset: 0,
      })
      if (tagData) {
        const tagCounts: Record<string, number> = {}
        for (const item of tagData) {
          for (const tag of (item.tags || [])) {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1
          }
        }
        topics = Object.entries(tagCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 12)
          .map(([tag]) => tag)
      }
    }

    // Audit (fire-and-forget)
    logAudit(svc, {
      actorId: userId || undefined,
      actorType: userId ? 'user' : 'anonymous',
      eventType: 'edge_function.call',
      action: `discover-feed.${mode}`,
      source: 'discover-feed',
      status: 'success',
      statusCode: 200,
      metadata: { mode, topic, search: search ? true : false, limit, offset, resultCount: data?.length || 0 },
      ip: clientIP,
      userAgent: getUA(req),
    })

    return new Response(JSON.stringify({
      ok: true,
      items: data || [],
      topics,
      hasMore: (data?.length || 0) === limit,
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': mode === 'trending' ? 'public, max-age=60' : 'no-cache',
        ...CORS,
      },
    })

  } catch (error) {
    console.error('discover-feed error:', error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...OPEN_CORS_HEADERS, ...SECURITY_HEADERS },
    })
  }
})
