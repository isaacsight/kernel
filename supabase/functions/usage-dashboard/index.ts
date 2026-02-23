// Supabase Edge Function: usage-dashboard
// Returns aggregated usage data for Pro subscribers.
// Powered by get_usage_summary RPC (queries audit_events + usage_logs).
//
// Deploy: npx supabase functions deploy usage-dashboard --project-ref eoxxpyixdieprsxlpwcs

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handlePreflight, SECURITY_HEADERS } from '../_shared/cors.ts'
import { logAudit, getClientIP, getUA } from '../_shared/audit.ts'

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return handlePreflight(req)
  }

  const CORS_HEADERS = { ...corsHeaders(req), ...SECURITY_HEADERS }

  try {
    // ── Auth: verify JWT ────────────────────────────────
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    // ── Pro check: require active subscription ──────────
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const svc = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const isAdmin = !!user.app_metadata?.is_admin
    if (!isAdmin) {
      const { data: sub } = await svc
        .from('subscriptions')
        .select('status')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle()

      if (!sub) {
        return new Response(
          JSON.stringify({ error: 'Pro subscription required' }),
          { status: 403, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
        )
      }
    }

    // ── Parse optional query params ─────────────────────
    const url = new URL(req.url)
    const days = Math.min(parseInt(url.searchParams.get('days') || '30', 10), 90)

    // ── Fetch usage summary via RPC ─────────────────────
    const { data, error: rpcError } = await svc.rpc('get_usage_summary', {
      p_user_id: user.id,
      p_days: days,
    })

    if (rpcError) {
      console.error('[usage-dashboard] RPC error:', rpcError.message)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch usage data' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    // Audit log
    logAudit(svc, {
      actorId: user.id, eventType: 'edge_function.call', action: 'usage-dashboard',
      source: 'usage-dashboard', status: 'success', statusCode: 200,
      metadata: { days },
      ip: getClientIP(req), userAgent: getUA(req),
    })

    return new Response(
      JSON.stringify(data),
      { headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  } catch (error) {
    console.error('usage-dashboard error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  }
})
