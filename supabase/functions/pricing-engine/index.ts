// Supabase Edge Function: pricing-engine
// Cost attribution, usage forecasting, and tier recommendations.
//
// Deploy: npx supabase functions deploy pricing-engine --project-ref eoxxpyixdieprsxlpwcs --no-verify-jwt

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handlePreflight, SECURITY_HEADERS } from '../_shared/cors.ts'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { requireContentType } from '../_shared/validate.ts'

// ─── Plan definitions ────────────────────────────────────────

const PLAN_LIMITS: Record<string, { name: string; monthly_messages: number; features: string[] }> = {
  free: {
    name: 'Free',
    monthly_messages: 600,
    features: ['chat', 'routing', 'memory_extraction', 'convergence'],
  },
  pro: {
    name: 'Pro',
    monthly_messages: 3000,
    features: ['chat', 'routing', 'swarm', 'swarm_synthesis', 'research', 'workflow', 'memory_extraction', 'convergence', 'task_planning', 'content_pipeline', 'algorithm_scoring', 'briefing', 'master_agent'],
  },
  max: {
    name: 'Max',
    monthly_messages: 10000,
    features: ['chat', 'routing', 'swarm', 'swarm_synthesis', 'research', 'workflow', 'memory_extraction', 'convergence', 'task_planning', 'content_pipeline', 'algorithm_scoring', 'platform_workflow', 'knowledge_ingestion', 'briefing', 'master_agent', 'evaluation'],
  },
}

// ─── Admin user IDs ──────────────────────────────────────────

function getAdminIds(): Set<string> {
  const raw = Deno.env.get('ADMIN_USER_IDS') || ''
  return new Set(raw.split(',').map(s => s.trim()).filter(Boolean))
}

// ─── Tier recommendation logic ───────────────────────────────

function recommendTier(
  currentPlan: string,
  monthlyRequests: number,
  featuresUsed: string[],
): { recommended_plan: string; reason: string; usage_ratio: number; projected_savings: number | null; feature_gaps: string[] } {
  const plan = PLAN_LIMITS[currentPlan] || PLAN_LIMITS.free
  const usageRatio = monthlyRequests / plan.monthly_messages

  // Check what features the user uses that their plan doesn't include
  const featureGaps = featuresUsed.filter(f => !plan.features.includes(f))

  // Recommend upgrade if usage ratio > 0.8 or feature gaps exist
  if (currentPlan === 'free') {
    if (usageRatio > 0.8 || featureGaps.length > 0) {
      return {
        recommended_plan: 'pro',
        reason: usageRatio > 0.8
          ? `You're using ${Math.round(usageRatio * 100)}% of your free message limit. Pro gives you 5x more messages.`
          : `You're trying to use features (${featureGaps.join(', ')}) that require Pro.`,
        usage_ratio: usageRatio,
        projected_savings: null,
        feature_gaps: featureGaps,
      }
    }
  }

  if (currentPlan === 'pro') {
    if (usageRatio > 0.8) {
      return {
        recommended_plan: 'max',
        reason: `You're using ${Math.round(usageRatio * 100)}% of your Pro limit. Max gives you 3x more messages and full platform access.`,
        usage_ratio: usageRatio,
        projected_savings: null,
        feature_gaps: featureGaps,
      }
    }
    // Suggest downgrade if barely using
    if (usageRatio < 0.15 && featureGaps.length === 0) {
      return {
        recommended_plan: 'free',
        reason: `You're only using ${Math.round(usageRatio * 100)}% of your Pro limit. You could save by switching to Free.`,
        usage_ratio: usageRatio,
        projected_savings: 19.99,
        feature_gaps: [],
      }
    }
  }

  // Stay on current plan
  return {
    recommended_plan: currentPlan,
    reason: `Your ${plan.name} plan fits your usage well (${Math.round(usageRatio * 100)}% of limit).`,
    usage_ratio: usageRatio,
    projected_savings: null,
    feature_gaps: featureGaps,
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handlePreflight(req)

  const CORS_HEADERS = { ...corsHeaders(req), ...SECURITY_HEADERS }
  const ctErr = requireContentType(req)
  if (ctErr) return new Response(JSON.stringify({ error: ctErr }), { status: 415, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Auth: extract user from JWT
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace('Bearer ', '')

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      })
    }

    // Rate limit: 30 req/min
    const rl = await checkRateLimit(user.id, 'pricing_engine', 30, 60)
    if (!rl.allowed) return rateLimitResponse(rl, CORS_HEADERS)

    const body = await req.json()
    const action = body.action as string

    const svc = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const isAdmin = getAdminIds().has(user.id)

    switch (action) {
      case 'get_user_cost_summary': {
        const days = body.days ?? 30
        const { data, error } = await svc.rpc('get_user_cost_summary', {
          p_user_id: user.id,
          p_days: days,
        })
        if (error) throw error
        return new Response(JSON.stringify(data), {
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        })
      }

      case 'get_usage_forecast': {
        const { data, error } = await svc.rpc('get_usage_forecast', {
          p_user_id: user.id,
        })
        if (error) throw error
        return new Response(JSON.stringify(data), {
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        })
      }

      case 'get_tier_recommendation': {
        // Get forecast first
        const { data: forecast, error } = await svc.rpc('get_usage_forecast', {
          p_user_id: user.id,
        })
        if (error) throw error

        // Determine current plan
        const { data: sub } = await svc
          .from('subscriptions')
          .select('plan_id, status')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle()

        const currentPlan = sub?.plan_id || 'free'
        const featuresUsed = (forecast?.by_feature || []).map((f: { feature: string }) => f.feature)
        const projectedMonthly = forecast?.projected_monthly_requests || 0

        const recommendation = recommendTier(currentPlan, projectedMonthly, featuresUsed)

        return new Response(JSON.stringify({
          current_plan: currentPlan,
          ...recommendation,
        }), {
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        })
      }

      case 'get_platform_analytics': {
        if (!isAdmin) {
          return new Response(JSON.stringify({ error: 'Admin only' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
          })
        }
        const days = body.days ?? 30
        const { data, error } = await svc.rpc('get_platform_cost_analytics', {
          p_days: days,
        })
        if (error) throw error

        // Enrich top users with emails
        if (data?.top_users) {
          for (const u of data.top_users) {
            try {
              const { data: { user: authUser } } = await svc.auth.admin.getUserById(u.user_id)
              u.email = authUser?.email || u.user_id
            } catch {
              u.email = u.user_id
            }
          }
        }

        return new Response(JSON.stringify(data), {
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        })
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        })
    }
  } catch (err) {
    console.error('[pricing-engine] Error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    })
  }
})
