// Supabase Edge Function: platform-engine
// Backend CRUD for platform workflow orchestration + content suggestions.
//
// Deploy: npx supabase functions deploy platform-engine --project-ref eoxxpyixdieprsxlpwcs --no-verify-jwt

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handlePreflight, SECURITY_HEADERS } from '../_shared/cors.ts'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { logAudit, getClientIP, getUA } from '../_shared/audit.ts'
import { requireContentType } from '../_shared/validate.ts'
import { PLAN_LIMITS, resolvePlanId, ACTIVE_STATUSES } from '../_shared/plan-limits.ts'

type Action =
  | 'create_workflow'
  | 'update_workflow'
  | 'get_workflow'
  | 'list_workflows'
  | 'delete_workflow'
  | 'get_suggestions'

interface PlatformPayload {
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
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    )

    const { data: { user }, error: userErr } = await authClient.auth.getUser()
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    // Service-role client for privileged DB operations
    const svc = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Pro-tier gate
    const { data: sub } = await svc
      .from('subscriptions')
      .select('status, plan')
      .eq('user_id', user.id)
      .maybeSingle()

    const planId = resolvePlanId(sub)
    if (planId === 'free') {
      return new Response(JSON.stringify({ error: 'Pro subscription required' }), {
        status: 403, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    // Rate limit
    const tier = planId.startsWith('max') ? 'max' as const : 'pro' as const
    const rl = await checkRateLimit(svc, user.id, 'platform-engine', tier)
    if (!rl.allowed) return rateLimitResponse(rl, CORS)

    // Parse body
    const raw = await req.text()
    if (raw.length > 524288) {
      return new Response(JSON.stringify({ error: 'Body too large' }), {
        status: 413, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    const payload: PlatformPayload = JSON.parse(raw)
    const { action, data = {} } = payload

    switch (action) {
      // ─── Create Workflow ──────────────────────────────────
      case 'create_workflow': {
        const limits = PLAN_LIMITS[planId]

        // Check monthly limit
        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        startOfMonth.setHours(0, 0, 0, 0)

        const { count } = await svc
          .from('platform_workflows')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('created_at', startOfMonth.toISOString())

        if ((count || 0) >= (limits.platformWorkflowsPerMonth || 5)) {
          return new Response(JSON.stringify({ error: 'Monthly platform workflow limit reached' }), {
            status: 429, headers: { 'Content-Type': 'application/json', ...CORS },
          })
        }

        const { data: wf, error } = await svc
          .from('platform_workflows')
          .insert({
            user_id: user.id,
            config: data.config || {},
            phases: data.phases || [],
            state: data.state || 'idle',
          })
          .select()
          .single()

        if (error) throw error

        logAudit(svc, { userId: user.id, action: 'platform_workflow_create', resource: wf.id, ip: getClientIP(req), ua: getUA(req) })

        return new Response(JSON.stringify(wf), {
          status: 201, headers: { 'Content-Type': 'application/json', ...CORS },
        })
      }

      // ─── Update Workflow ──────────────────────────────────
      case 'update_workflow': {
        const { id, ...rawUpdates } = data as { id: string; [k: string]: unknown }
        if (!id) {
          return new Response(JSON.stringify({ error: 'Missing workflow id' }), {
            status: 400, headers: { 'Content-Type': 'application/json', ...CORS },
          })
        }

        // Whitelist allowed fields to prevent privilege escalation
        const ALLOWED_FIELDS = ['config', 'phases', 'state', 'content_id']
        const updates = Object.fromEntries(
          Object.entries(rawUpdates).filter(([k]) => ALLOWED_FIELDS.includes(k))
        )

        // Ownership check
        const { data: existing } = await svc
          .from('platform_workflows')
          .select('user_id')
          .eq('id', id)
          .single()

        if (!existing || existing.user_id !== user.id) {
          return new Response(JSON.stringify({ error: 'Not found' }), {
            status: 404, headers: { 'Content-Type': 'application/json', ...CORS },
          })
        }

        const { data: wf, error } = await svc
          .from('platform_workflows')
          .update(updates)
          .eq('id', id)
          .select()
          .single()

        if (error) throw error

        return new Response(JSON.stringify(wf), {
          headers: { 'Content-Type': 'application/json', ...CORS },
        })
      }

      // ─── Get Workflow ─────────────────────────────────────
      case 'get_workflow': {
        const { id } = data as { id: string }
        if (!id) {
          return new Response(JSON.stringify({ error: 'Missing workflow id' }), {
            status: 400, headers: { 'Content-Type': 'application/json', ...CORS },
          })
        }

        const { data: wf, error } = await svc
          .from('platform_workflows')
          .select('*')
          .eq('id', id)
          .eq('user_id', user.id)
          .single()

        if (error || !wf) {
          return new Response(JSON.stringify({ error: 'Not found' }), {
            status: 404, headers: { 'Content-Type': 'application/json', ...CORS },
          })
        }

        return new Response(JSON.stringify(wf), {
          headers: { 'Content-Type': 'application/json', ...CORS },
        })
      }

      // ─── List Workflows ───────────────────────────────────
      case 'list_workflows': {
        const limit = Math.min(Number(data.limit) || 20, 50)
        const offset = Number(data.offset) || 0

        const { data: workflows, error } = await svc
          .from('platform_workflows')
          .select('id, config, state, created_at, updated_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1)

        if (error) throw error

        return new Response(JSON.stringify({ workflows }), {
          headers: { 'Content-Type': 'application/json', ...CORS },
        })
      }

      // ─── Delete Workflow ──────────────────────────────────
      case 'delete_workflow': {
        const { id } = data as { id: string }
        if (!id) {
          return new Response(JSON.stringify({ error: 'Missing workflow id' }), {
            status: 400, headers: { 'Content-Type': 'application/json', ...CORS },
          })
        }

        const { error } = await svc
          .from('platform_workflows')
          .delete()
          .eq('id', id)
          .eq('user_id', user.id)

        if (error) throw error

        return new Response(JSON.stringify({ deleted: true }), {
          headers: { 'Content-Type': 'application/json', ...CORS },
        })
      }

      // ─── Get Suggestions ──────────────────────────────────
      // "What should I write next?" — knowledge base + trends
      case 'get_suggestions': {
        const claudeUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/claude-proxy`
        const svcKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

        // Gather knowledge base topics
        const { data: kbItems } = await svc
          .from('knowledge_items')
          .select('content, topics')
          .eq('user_id', user.id)
          .order('last_accessed_at', { ascending: false, nullsFirst: false })
          .limit(10)

        const knowledgeContext = (kbItems || [])
          .map((i: { content: string }) => i.content.slice(0, 200))
          .join('\n')

        // Gather recent content
        const { data: recentContent } = await svc
          .from('content_items')
          .select('brief, title')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5)

        const recentContext = (recentContent || [])
          .map((c: { title?: string; brief: string }) => c.title || c.brief)
          .join(', ')

        // Ask Claude for suggestions
        const prompt = `Based on the user's knowledge base and recent content, suggest 5 content ideas they should write about next.

Knowledge base topics:
${knowledgeContext || 'No knowledge base items yet.'}

Recent content created:
${recentContext || 'No recent content.'}

For each suggestion provide:
1. Title
2. Format (blog post, newsletter, twitter thread, linkedin post, essay)
3. Why this topic (1 sentence)
4. Angle/hook

Format as a JSON array: [{"title": "...", "format": "...", "why": "...", "angle": "..."}]
Return ONLY the JSON array, no other text.`

        const claudeRes = await fetch(claudeUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${svcKey}`,
            'apikey': Deno.env.get('SUPABASE_ANON_KEY')!,
          },
          body: JSON.stringify({
            messages: [{ role: 'user', content: prompt }],
            model: 'haiku',
            mode: 'json',
          }),
        })

        let suggestions = []
        if (claudeRes.ok) {
          try {
            const body = await claudeRes.json()
            const text = typeof body === 'string' ? body : body.content || body.text || JSON.stringify(body)
            suggestions = JSON.parse(text)
          } catch {
            suggestions = [{ title: 'Getting started with content', format: 'blog_post', why: 'Build your content library', angle: 'Share your expertise' }]
          }
        }

        return new Response(JSON.stringify({ suggestions }), {
          headers: { 'Content-Type': 'application/json', ...CORS },
        })
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400, headers: { 'Content-Type': 'application/json', ...CORS },
        })
    }
  } catch (err) {
    console.error('[platform-engine]', err)
    return new Response(JSON.stringify({ error: (err as Error).message || 'Internal error' }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }
})
