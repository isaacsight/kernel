// Supabase Edge Function: knowledge-engine
// Backend orchestration for Knowledge Engine operations.
// CRUD for knowledge items, topics, contradictions, search, stats.
//
// Deploy: npx supabase functions deploy knowledge-engine --project-ref eoxxpyixdieprsxlpwcs --no-verify-jwt

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handlePreflight, SECURITY_HEADERS } from '../_shared/cors.ts'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { logAudit, getClientIP, getUA } from '../_shared/audit.ts'
import { requireContentType } from '../_shared/validate.ts'
import { PLAN_LIMITS, resolvePlanId, ACTIVE_STATUSES } from '../_shared/plan-limits.ts'

type Action =
  | 'ingest'
  | 'search'
  | 'query'
  | 'get_topics'
  | 'get_item'
  | 'update_item'
  | 'delete_item'
  | 'resolve_contradiction'
  | 'get_stats'

interface KnowledgePayload {
  action: Action
  data?: Record<string, unknown>
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

    // Service role client
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
      return new Response(JSON.stringify({ error: 'pro_required', message: 'Knowledge Engine requires a Pro subscription' }), {
        status: 403, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    // Rate limit
    const planId = resolvePlanId(sub)
    const tier = planId === 'free' ? 'free' : planId.startsWith('max') ? 'max' : 'pro'
    const rl = await checkRateLimit(svc, user.id, 'knowledge-engine', tier as 'free' | 'paid' | 'pro' | 'max')
    if (!rl.allowed) return rateLimitResponse(rl, CORS)

    // Parse body
    const rawBody = await req.text()
    if (rawBody.length > 524_288) {
      return new Response(JSON.stringify({ error: 'Payload too large' }), {
        status: 413, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }
    const payload = JSON.parse(rawBody) as KnowledgePayload

    if (!payload.action) {
      return new Response(JSON.stringify({ error: 'action is required' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    // Check knowledge item limits
    const limits = PLAN_LIMITS[planId]
    const knowledgeLimit = planId.startsWith('max') ? 50000 : 5000

    let result: Record<string, unknown> = {}

    switch (payload.action) {
      case 'ingest': {
        // Check item count limit
        const { count } = await svc.from('knowledge_items')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .is('superseded_by', null)
        if ((count || 0) >= knowledgeLimit) {
          return new Response(JSON.stringify({ error: 'knowledge_limit_reached', limit: knowledgeLimit }), {
            status: 403, headers: { 'Content-Type': 'application/json', ...CORS },
          })
        }

        const d = payload.data || {}
        if (!d.items || !Array.isArray(d.items)) throw new Error('items array required')

        const rows = (d.items as Record<string, unknown>[]).map(item => ({
          user_id: user.id,
          content: item.content || '',
          summary: item.summary || null,
          topic: item.topic || null,
          subtopic: item.subtopic || null,
          domain: item.domain || 'general',
          item_type: item.item_type || 'fact',
          source_type: item.source_type || 'conversation',
          source_id: item.source_id || null,
          source_title: item.source_title || null,
          confidence: item.confidence || 0.5,
          keywords: item.keywords || [],
          entity_ids: item.entity_ids || [],
        }))

        const { data, error } = await svc.from('knowledge_items')
          .insert(rows)
          .select('id')
        if (error) throw error
        result = { inserted: data?.length || 0 }
        break
      }

      case 'search': {
        const d = payload.data || {}
        if (!d.query) throw new Error('query required')
        const { data, error } = await svc.rpc('search_knowledge', {
          p_user_id: user.id,
          p_query: d.query as string,
          p_limit: Math.min((d.limit as number) || 20, 50),
        })
        if (error) throw error
        result = { items: data }
        break
      }

      case 'query': {
        // For knowledge queries, just return search results
        // Synthesis happens on the client side
        const d = payload.data || {}
        if (!d.query) throw new Error('query required')
        const { data, error } = await svc.rpc('search_knowledge', {
          p_user_id: user.id,
          p_query: d.query as string,
          p_limit: 15,
        })
        if (error) throw error
        result = { items: data }
        break
      }

      case 'get_topics': {
        const { data, error } = await svc.from('knowledge_topics')
          .select('*')
          .eq('user_id', user.id)
          .order('item_count', { ascending: false })
          .limit(100)
        if (error) throw error
        result = { topics: data }
        break
      }

      case 'get_item': {
        const d = payload.data || {}
        if (!d.id) throw new Error('id required')
        const { data, error } = await svc.from('knowledge_items')
          .select('*')
          .eq('id', d.id)
          .eq('user_id', user.id)
          .single()
        if (error) throw error
        result = { item: data }
        break
      }

      case 'update_item': {
        const d = payload.data || {}
        if (!d.id) throw new Error('id required')
        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
        if (d.content !== undefined) updates.content = d.content
        if (d.summary !== undefined) updates.summary = d.summary
        if (d.topic !== undefined) updates.topic = d.topic
        if (d.domain !== undefined) updates.domain = d.domain
        if (d.confidence !== undefined) updates.confidence = d.confidence

        const { data, error } = await svc.from('knowledge_items')
          .update(updates)
          .eq('id', d.id)
          .eq('user_id', user.id)
          .select()
          .single()
        if (error) throw error
        result = { item: data }
        break
      }

      case 'delete_item': {
        const d = payload.data || {}
        if (!d.id) throw new Error('id required')
        const { error } = await svc.from('knowledge_items')
          .delete()
          .eq('id', d.id)
          .eq('user_id', user.id)
        if (error) throw error
        result = { deleted: true }
        break
      }

      case 'resolve_contradiction': {
        const d = payload.data || {}
        if (!d.id || !d.resolution) throw new Error('id and resolution required')
        const resolution = d.resolution as string
        if (!['user_confirmed_existing', 'user_confirmed_new'].includes(resolution)) {
          throw new Error('resolution must be user_confirmed_existing or user_confirmed_new')
        }

        const { data: contradiction, error: fetchErr } = await svc.from('knowledge_contradictions')
          .select('*')
          .eq('id', d.id)
          .eq('user_id', user.id)
          .single()
        if (fetchErr || !contradiction) throw new Error('Contradiction not found')

        await svc.from('knowledge_contradictions')
          .update({ resolution, resolved_at: new Date().toISOString() })
          .eq('id', d.id)

        if (resolution === 'user_confirmed_new') {
          const c = contradiction as { existing_item_id: string; new_content: string; new_source_type: string }
          const { data: newItem } = await svc.from('knowledge_items')
            .insert({
              user_id: user.id,
              content: c.new_content,
              source_type: c.new_source_type,
              confidence: 0.9,
            })
            .select()
            .single()

          if (newItem) {
            await svc.from('knowledge_items')
              .update({ superseded_by: (newItem as { id: string }).id })
              .eq('id', c.existing_item_id)
          }
        }

        result = { resolved: true }
        break
      }

      case 'get_stats': {
        const [
          { count: totalItems },
          { count: topicCount },
          { data: domainData },
          { count: pendingContradictions },
        ] = await Promise.all([
          svc.from('knowledge_items').select('*', { count: 'exact', head: true }).eq('user_id', user.id).is('superseded_by', null),
          svc.from('knowledge_topics').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
          svc.from('knowledge_items').select('domain').eq('user_id', user.id).is('superseded_by', null),
          svc.from('knowledge_contradictions').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('resolution', 'pending'),
        ])

        const domainBreakdown: Record<string, number> = {}
        for (const row of (domainData || []) as { domain: string }[]) {
          domainBreakdown[row.domain] = (domainBreakdown[row.domain] || 0) + 1
        }

        result = {
          stats: {
            totalItems: totalItems || 0,
            topicCount: topicCount || 0,
            domainBreakdown,
            pendingContradictions: pendingContradictions || 0,
          }
        }
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
      action: `knowledge-engine.${payload.action}`,
      source: 'knowledge-engine',
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
    console.error('knowledge-engine error:', error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }
})
