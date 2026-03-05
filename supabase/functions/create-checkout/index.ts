// Supabase Edge Function: create-checkout
// Creates a Stripe Checkout session for Kernel Pro subscription ($29/mo or $290/yr).
// Now accepts user_id to correlate Stripe → Supabase user via client_reference_id.
//
// Deploy: npx supabase functions deploy create-checkout --project-ref eoxxpyixdieprsxlpwcs
// Secrets: STRIPE_SECRET_KEY

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handlePreflight, SECURITY_HEADERS } from '../_shared/cors.ts'
import { logAudit, getClientIP, getUA } from '../_shared/audit.ts'
import { requireContentType } from '../_shared/validate.ts'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'

interface CheckoutPayload {
  mode?: 'subscription' | 'payment'
  plan?: 'pro_monthly' | 'pro_annual' | 'max_monthly' | 'max_annual'
  price_id?: string
  success_url: string
  cancel_url: string
  // API subscription fields
  type?: 'web' | 'api'
  api_tier?: 'pro' | 'growth'
}

// API tier pricing — base + metered overage
const API_TIER_PRICES: Record<string, { base_price_id: string; overage_price_id: string }> = {
  pro: {
    base_price_id: 'price_1T7PITIWIar0uqwKgOv8fVQY',
    overage_price_id: 'price_1T7PJ5IWIar0uqwKUoLaqmgo',
  },
  growth: {
    base_price_id: 'price_1T7PJLIWIar0uqwKSG1BrHOn',
    overage_price_id: 'price_1T7PJLIWIar0uqwKbeyO1lhf',
  },
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return handlePreflight(req)
  }

  const CORS_HEADERS = { ...corsHeaders(req), ...SECURITY_HEADERS }

  try {
    // ── Content-type check ──────────────────────────────
    const ctErr = requireContentType(req)
    if (ctErr) return ctErr(CORS_HEADERS)

    // ── Auth: verify JWT ────────────────────────────────
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    // Derive email and user_id from verified JWT — never trust the client body
    const email = user.email!
    const user_id = user.id

    // ── Rate limit: 5 per hour ────────────────────────
    const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const rl = await checkRateLimit(svc, user_id, 'create-checkout', 'free')
    if (!rl.allowed) return rateLimitResponse(rl, CORS_HEADERS)

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) {
      return new Response(
        JSON.stringify({ error: 'Missing STRIPE_SECRET_KEY' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    const payload = (await req.json()) as CheckoutPayload
    const { mode = 'subscription', plan, price_id, success_url, cancel_url, type = 'web', api_tier } = payload

    // Build Stripe Checkout Session params
    const params = new URLSearchParams()
    params.set('customer_email', email)
    params.set('mode', mode)
    params.set('success_url', success_url)
    params.set('cancel_url', cancel_url)

    // Link Stripe checkout to Supabase user (from verified JWT)
    params.set('client_reference_id', user_id)
    params.set('metadata[supabase_user_id]', user_id)

    if (type === 'api' && api_tier && api_tier in API_TIER_PRICES) {
      // ── API subscription: base price + metered overage ──
      const tierPrices = API_TIER_PRICES[api_tier]

      // Line item 0: base subscription
      params.set('line_items[0][price]', tierPrices.base_price_id)
      params.set('line_items[0][quantity]', '1')

      // Line item 1: metered overage (no quantity — usage-based)
      params.set('line_items[1][price]', tierPrices.overage_price_id)

      // Subscription metadata for webhook processing
      params.set('metadata[type]', 'api')
      params.set('metadata[api_tier]', api_tier)
      params.set('subscription_data[metadata][supabase_user_id]', user_id)
      params.set('subscription_data[metadata][type]', 'api')
      params.set('subscription_data[metadata][api_tier]', api_tier)
    } else {
      // ── Web subscription (existing flow) ──
      const PRICE_MAP: Record<string, string | undefined> = {
        pro_monthly: Deno.env.get('STRIPE_MONTHLY_PRICE_ID'),
        pro_annual: Deno.env.get('STRIPE_ANNUAL_PRICE_ID'),
        max_monthly: Deno.env.get('STRIPE_MAX_MONTHLY_PRICE_ID'),
        max_annual: Deno.env.get('STRIPE_MAX_ANNUAL_PRICE_ID'),
      }
      const selectedPlan = plan || 'pro_monthly'
      const resolvedPriceId = price_id || PRICE_MAP[selectedPlan]

      if (mode === 'subscription') {
        params.set('subscription_data[metadata][supabase_user_id]', user_id)
        params.set('subscription_data[metadata][plan]', selectedPlan)
      }

      if (resolvedPriceId) {
        params.set('line_items[0][price]', resolvedPriceId)
        params.set('line_items[0][quantity]', '1')
      } else {
        // Fallback: create inline subscription
        const isMax = selectedPlan.startsWith('max_')
        const isAnnual = selectedPlan.endsWith('_annual')
        params.set('line_items[0][price_data][currency]', 'usd')
        params.set('line_items[0][price_data][unit_amount]', isMax ? (isAnnual ? '49000' : '4900') : (isAnnual ? '29000' : '2900'))
        params.set('line_items[0][price_data][product_data][name]', isMax ? 'Kernel Max' : 'Kernel Pro')
        params.set('line_items[0][price_data][product_data][description]', isMax
          ? 'Generous messaging, 25 agent calls/day, 100 extended thinking/mo, and 50 file analyses/mo.'
          : 'Full access to Kernel — memory, goals, briefings, extended thinking, voice, and file analysis.')
        if (mode === 'subscription') {
          params.set('line_items[0][price_data][recurring][interval]', isAnnual ? 'year' : 'month')
        }
        params.set('line_items[0][quantity]', '1')
      }
    }

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('Stripe API error:', response.status, errText)
      return new Response(
        JSON.stringify({ error: 'Stripe error', details: errText }),
        { status: response.status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    const session = await response.json()

    // Audit log
    const svcAudit = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    logAudit(svcAudit, {
      actorId: user_id, eventType: 'payment.checkout', action: 'create-checkout',
      source: 'create-checkout', status: 'success', statusCode: 200,
      metadata: { mode },
      ip: getClientIP(req), userAgent: getUA(req),
    })

    return new Response(
      JSON.stringify({ url: session.url, session_id: session.id }),
      { headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  } catch (error) {
    console.error('create-checkout error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  }
})
