// Supabase Edge Function: content-engine
// Backend orchestration for content pipeline operations.
// CRUD for content items, version snapshots, algorithm scoring.
//
// Deploy: npx supabase functions deploy content-engine --project-ref eoxxpyixdieprsxlpwcs --no-verify-jwt

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handlePreflight, SECURITY_HEADERS } from '../_shared/cors.ts'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { logAudit, getClientIP, getUA } from '../_shared/audit.ts'
import { requireContentType } from '../_shared/validate.ts'
import { PLAN_LIMITS, resolvePlanId, ACTIVE_STATUSES } from '../_shared/plan-limits.ts'

type Action =
  | 'create_item'
  | 'update_item'
  | 'get_item'
  | 'list_items'
  | 'save_version'
  | 'save_score'
  | 'get_weights'
  | 'save_weights'
  | 'save_performance'
  | 'save_feedback'
  | 'publish_item'
  | 'unpublish_item'

interface ContentPayload {
  action: Action
  data?: Record<string, unknown>
}

// ─── Slug Helpers ───────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
    || 'untitled'
}

async function ensureUniqueSlug(svc: any, base: string): Promise<string> {
  let slug = base
  let suffix = 0
  for (let i = 0; i < 20; i++) {
    const candidate = suffix === 0 ? slug : `${slug}-${suffix}`
    const { data } = await svc.from('content_items')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle()
    if (!data) return candidate
    suffix++
  }
  // Fallback: append random suffix
  return `${base}-${Date.now().toString(36)}`
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handlePreflight(req)
  const CORS = { ...corsHeaders(req), ...SECURITY_HEADERS }

  try {
    const ctErr = requireContentType(req)
    if (ctErr) return ctErr(CORS)

    // Auth
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
    const { data: { user }, error: authError } = await authClient.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    // Service role client for privileged operations
    const svc = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    // Determine tier
    const { data: sub } = await svc
      .from('subscriptions')
      .select('status, plan')
      .eq('user_id', user.id)
      .maybeSingle()
    const isPro = sub && ACTIVE_STATUSES.includes(sub.status)

    if (!isPro) {
      return new Response(JSON.stringify({ error: 'pro_required', message: 'Content Engine requires a Pro subscription' }), {
        status: 403, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    // Rate limit
    const planId = resolvePlanId(sub)
    const tier = planId === 'free' ? 'free' : planId.startsWith('max') ? 'max' : 'pro'
    const rl = await checkRateLimit(svc, user.id, 'content-engine', tier as 'free' | 'paid' | 'pro' | 'max')
    if (!rl.allowed) return rateLimitResponse(rl, CORS)

    // Parse body
    const rawBody = await req.text()
    if (rawBody.length > 524_288) {
      return new Response(JSON.stringify({ error: 'Payload too large' }), {
        status: 413, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }
    const payload = JSON.parse(rawBody) as ContentPayload

    if (!payload.action) {
      return new Response(JSON.stringify({ error: 'action is required' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    // Route by action
    let result: Record<string, unknown> = {}

    switch (payload.action) {
      case 'create_item': {
        const d = payload.data || {}
        const { data, error } = await svc.from('content_items').insert({
          user_id: user.id,
          brief: d.brief || '',
          format: d.format || 'blog_post',
          title: d.title || null,
          tags: d.tags || [],
          current_stage: d.current_stage || 'ideation',
          stages: d.stages || [],
        }).select().single()
        if (error) throw error
        result = { item: data }
        break
      }

      case 'update_item': {
        const d = payload.data || {}
        if (!d.id) throw new Error('id is required')
        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
        if (d.title !== undefined) updates.title = d.title
        if (d.tags !== undefined) updates.tags = d.tags
        if (d.current_stage !== undefined) updates.current_stage = d.current_stage
        if (d.stages !== undefined) updates.stages = d.stages
        if (d.final_content !== undefined) updates.final_content = d.final_content

        const { data, error } = await svc.from('content_items')
          .update(updates)
          .eq('id', d.id)
          .eq('user_id', user.id)
          .select()
          .single()
        if (error) throw error
        result = { item: data }
        break
      }

      case 'get_item': {
        const d = payload.data || {}
        if (!d.id) throw new Error('id is required')
        const { data, error } = await svc.from('content_items')
          .select('*, content_versions(*), algorithm_scores(*)')
          .eq('id', d.id)
          .eq('user_id', user.id)
          .single()
        if (error) throw error
        result = { item: data }
        break
      }

      case 'list_items': {
        const { data, error } = await svc.from('content_items')
          .select('id, brief, format, title, tags, current_stage, created_at, updated_at')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(50)
        if (error) throw error
        result = { items: data }
        break
      }

      case 'save_version': {
        const d = payload.data || {}
        if (!d.content_id || !d.stage || !d.content) throw new Error('content_id, stage, content required')
        // Verify ownership
        const { data: ownerCheck } = await svc.from('content_items').select('id').eq('id', d.content_id).eq('user_id', user.id).maybeSingle()
        if (!ownerCheck) throw new Error('Content not found or access denied')
        const { data, error } = await svc.from('content_versions').insert({
          content_id: d.content_id,
          stage: d.stage,
          content: d.content,
          metadata: d.metadata || {},
        }).select().single()
        if (error) throw error
        result = { version: data }
        break
      }

      case 'save_score': {
        const d = payload.data || {}
        if (!d.content_id) throw new Error('content_id required')
        // Verify ownership
        const { data: ownerCheck2 } = await svc.from('content_items').select('id').eq('id', d.content_id).eq('user_id', user.id).maybeSingle()
        if (!ownerCheck2) throw new Error('Content not found or access denied')
        const { data, error } = await svc.from('algorithm_scores').insert({
          content_id: d.content_id,
          composite: d.composite || 0,
          dimensions: d.dimensions || [],
        }).select().single()
        if (error) throw error
        result = { score: data }
        break
      }

      case 'get_weights': {
        const { data } = await svc.from('algorithm_weights')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle()
        result = { weights: data }
        break
      }

      case 'save_weights': {
        const d = payload.data || {}
        const { data, error } = await svc.from('algorithm_weights')
          .upsert({
            user_id: user.id,
            weights: d.weights || {},
            learning_rate: d.learning_rate || 0.1,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' })
          .select()
          .single()
        if (error) throw error
        result = { weights: data }
        break
      }

      case 'save_performance': {
        const d = payload.data || {}
        if (!d.content_id || !d.platform || !d.metric) throw new Error('content_id, platform, metric required')
        // Verify ownership
        const { data: ownerCheck3 } = await svc.from('content_items').select('id').eq('id', d.content_id).eq('user_id', user.id).maybeSingle()
        if (!ownerCheck3) throw new Error('Content not found or access denied')
        const { data, error } = await svc.from('content_performance').insert({
          content_id: d.content_id,
          platform: d.platform,
          metric: d.metric,
          value: d.value || 0,
        }).select().single()
        if (error) throw error
        result = { performance: data }
        break
      }

      case 'save_feedback': {
        const d = payload.data || {}
        if (!d.content_id) throw new Error('content_id required')
        // Verify ownership
        const { data: ownerCheck4 } = await svc.from('content_items').select('id').eq('id', d.content_id).eq('user_id', user.id).maybeSingle()
        if (!ownerCheck4) throw new Error('Content not found or access denied')
        const { data, error } = await svc.from('algorithm_feedback').insert({
          content_id: d.content_id,
          predicted_score: d.predicted_score || 0,
          actual_performance: d.actual_performance || 0,
          weight_delta: d.weight_delta || {},
        }).select().single()
        if (error) throw error
        result = { feedback: data }
        break
      }

      case 'publish_item': {
        const d = payload.data || {}
        if (!d.id) throw new Error('id is required')

        // Fetch the item to generate slug from title/brief
        const { data: item, error: fetchErr } = await svc.from('content_items')
          .select('title, brief, tags, final_content')
          .eq('id', d.id)
          .eq('user_id', user.id)
          .single()
        if (fetchErr || !item) throw new Error('Content item not found')

        const baseText = item.title || item.brief || 'untitled'
        const baseSlug = slugify(baseText)
        const slug = await ensureUniqueSlug(svc, baseSlug)

        // Set initial moderation status
        const updates: Record<string, unknown> = {
          is_published: true,
          published_at: new Date().toISOString(),
          slug,
          moderation_status: 'pending',
          updated_at: new Date().toISOString(),
        }
        if (d.meta_description) updates.meta_description = String(d.meta_description).slice(0, 150)
        if (d.author_name) updates.author_name = d.author_name
        if (d.is_unlisted !== undefined) updates.is_unlisted = Boolean(d.is_unlisted)

        const { data, error } = await svc.from('content_items')
          .update(updates)
          .eq('id', d.id)
          .eq('user_id', user.id)
          .select()
          .single()
        if (error) throw error

        // Run content moderation (synchronous gate)
        let moderationStatus = 'pending'
        try {
          const modRes = await fetch(
            `${Deno.env.get('SUPABASE_URL')}/functions/v1/content-moderation`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              },
              body: JSON.stringify({
                content_id: d.id,
                title: item.title || '',
                content: item.final_content || item.brief || '',
                tags: item.tags || [],
              }),
            }
          )
          if (modRes.ok) {
            const modData = await modRes.json()
            moderationStatus = modData.verdict?.status || 'pending'
          }
        } catch (modErr) {
          console.warn('[publish] Moderation check failed (non-blocking):', modErr)
          // Fail-open: content stays as 'pending', will be flagged for review
        }

        result = {
          item: { ...data, moderation_status: moderationStatus },
          slug,
          publicUrl: `https://kernel.chat/#/p/${slug}`,
          moderationStatus,
        }
        break
      }

      case 'unpublish_item': {
        const d = payload.data || {}
        if (!d.id) throw new Error('id is required')
        const { data, error } = await svc.from('content_items')
          .update({
            is_published: false,
            slug: null,
            published_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', d.id)
          .eq('user_id', user.id)
          .select()
          .single()
        if (error) throw error
        result = { item: data }
        break
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${payload.action}` }), {
          status: 400, headers: { 'Content-Type': 'application/json', ...CORS },
        })
    }

    // Audit (fire-and-forget)
    logAudit(svc, {
      actorId: user.id,
      eventType: 'edge_function.call',
      action: `content-engine.${payload.action}`,
      source: 'content-engine',
      status: 'success',
      statusCode: 200,
      metadata: { action: payload.action },
      ip: getClientIP(req),
      userAgent: getUA(req),
    })

    return new Response(JSON.stringify({ ok: true, ...result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS },
    })

  } catch (error) {
    console.error('content-engine error:', error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }
})
