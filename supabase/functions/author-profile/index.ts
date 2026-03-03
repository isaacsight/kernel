// Supabase Edge Function: author-profile
// Public read (GET) for author profile + published articles.
// Auth-required write (POST) for updating own profile.
//
// Deploy: npx supabase functions deploy author-profile --project-ref eoxxpyixdieprsxlpwcs --no-verify-jwt

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { OPEN_CORS_HEADERS, corsHeaders, handlePreflight, SECURITY_HEADERS } from '../_shared/cors.ts'
import { logAudit, getClientIP, getUA } from '../_shared/audit.ts'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { resolvePlanId, ACTIVE_STATUSES } from '../_shared/plan-limits.ts'

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handlePreflight(req)
  const CORS = { ...OPEN_CORS_HEADERS, ...SECURITY_HEADERS }

  try {
    const svc = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    const body = await req.json().catch(() => ({}))
    const action = body.action as string

    // ─── Public: get_profile ─────────────────────────────────────
    if (action === 'get_profile') {
      const authorId = body.data?.author_id
      if (!authorId) {
        return new Response(JSON.stringify({ error: 'author_id required' }), {
          status: 400, headers: { 'Content-Type': 'application/json', ...CORS },
        })
      }

      // IP rate limit
      const clientIP = getClientIP(req) || 'unknown'
      const { data: rl } = await svc.rpc('check_rate_limit', {
        p_key: `author-profile:${clientIP}`,
        p_endpoint: 'author-profile',
        p_limit: 60,
        p_window_seconds: 60,
      })
      if (rl && !rl.allowed) {
        return new Response(JSON.stringify({ error: 'rate_limited' }), {
          status: 429, headers: { 'Content-Type': 'application/json', ...CORS },
        })
      }

      // Fetch profile
      const { data: profile } = await svc.from('author_profiles')
        .select('display_name, bio, avatar_url, pen_names, follower_count, following_count, created_at')
        .eq('user_id', authorId)
        .eq('is_public', true)
        .maybeSingle()

      // Fetch published articles
      const { data: articles } = await svc.from('content_items')
        .select('id, title, slug, tags, meta_description, author_name, format, published_at, view_count, like_count, bookmark_count, comment_count')
        .eq('user_id', authorId)
        .eq('is_published', true)
        .eq('is_unlisted', false)
        .eq('moderation_status', 'approved')
        .order('published_at', { ascending: false })
        .limit(50)

      return new Response(JSON.stringify({
        ok: true,
        profile: profile || null,
        articles: articles || [],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=120', ...CORS },
      })
    }

    // ─── Auth required for all other actions ──────────────────────
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

    // Rate limit
    const { data: sub } = await svc.from('subscriptions')
      .select('status, plan')
      .eq('user_id', user.id)
      .maybeSingle()
    const planId = resolvePlanId(sub)
    const tier = planId === 'free' ? 'free' : planId.startsWith('max') ? 'max' : 'pro'
    const rl = await checkRateLimit(svc, user.id, 'author-profile', tier as 'free' | 'paid' | 'pro' | 'max')
    if (!rl.allowed) return rateLimitResponse(rl, CORS)

    let result: Record<string, unknown> = {}

    switch (action) {
      case 'get_own_profile': {
        const { data: profile } = await svc.from('author_profiles')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle()
        result = { profile: profile || null }
        break
      }

      case 'update_profile': {
        const d = body.data || {}
        const updates: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        }
        if (d.display_name !== undefined) updates.display_name = String(d.display_name).slice(0, 100)
        if (d.bio !== undefined) updates.bio = String(d.bio).slice(0, 500)
        if (d.avatar_url !== undefined) {
          if (d.avatar_url) {
            try {
              const parsed = new URL(d.avatar_url)
              if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Invalid')
              if (parsed.hostname === 'localhost' || /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.)/.test(parsed.hostname)) {
                throw new Error('Blocked host')
              }
              updates.avatar_url = d.avatar_url
            } catch {
              // Skip invalid/blocked URLs silently
            }
          } else {
            updates.avatar_url = null
          }
        }
        if (d.is_public !== undefined) updates.is_public = Boolean(d.is_public)

        // Pen names: validate array of strings, max 5
        if (d.pen_names !== undefined) {
          const names = Array.isArray(d.pen_names) ? d.pen_names : []
          updates.pen_names = names
            .filter((n: unknown) => typeof n === 'string' && n.trim().length > 0)
            .slice(0, 5)
            .map((n: string) => n.trim().slice(0, 50))
        }

        // Upsert — create if doesn't exist
        const { data: profile, error } = await svc.from('author_profiles')
          .upsert({
            user_id: user.id,
            ...updates,
          }, { onConflict: 'user_id' })
          .select()
          .single()

        if (error) throw error
        result = { profile }
        break
      }

      case 'add_pen_name': {
        const penName = String(body.data?.pen_name || '').trim().slice(0, 50)
        if (!penName) throw new Error('pen_name required')

        // Get current pen names
        const { data: current } = await svc.from('author_profiles')
          .select('pen_names')
          .eq('user_id', user.id)
          .maybeSingle()

        const existing = current?.pen_names || []
        if (existing.includes(penName)) {
          result = { pen_names: existing }
        } else if (existing.length >= 5) {
          throw new Error('Maximum 5 pen names allowed')
        } else {
          const updated = [...existing, penName]
          await svc.from('author_profiles')
            .upsert({
              user_id: user.id,
              pen_names: updated,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id' })
          result = { pen_names: updated }
        }
        break
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400, headers: { 'Content-Type': 'application/json', ...CORS },
        })
    }

    logAudit(svc, {
      actorId: user.id,
      eventType: 'edge_function.call',
      action: `author-profile.${action}`,
      source: 'author-profile',
      status: 'success',
      statusCode: 200,
      metadata: { action },
      ip: getClientIP(req),
      userAgent: getUA(req),
    })

    return new Response(JSON.stringify({ ok: true, ...result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS },
    })

  } catch (error) {
    console.error('author-profile error:', error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...OPEN_CORS_HEADERS, ...SECURITY_HEADERS },
    })
  }
})
