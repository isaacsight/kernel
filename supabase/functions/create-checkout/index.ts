// Supabase Edge Function: create-checkout
// Creates a Stripe Checkout session for credit pack purchases or API subscriptions.
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
  success_url: string
  cancel_url: string
  // Credit pack purchase
  credit_pack?: 'starter' | 'standard' | 'pro' | 'max'
  // API subscription fields (preserved for API key billing)
  type?: 'web' | 'api'
  api_tier?: 'pro' | 'growth'
  // Legacy fields (ignored)
  plan?: string
  price_id?: string
}

// Credit pack definitions: amount in cents
const CREDIT_PACKS: Record<string, { amount_cents: number; price_cents: number; label: string }> = {
  starter:  { amount_cents: 500,   price_cents: 500,   label: '$5 Credit Pack' },
  standard: { amount_cents: 2000,  price_cents: 2000,  label: '$20 Credit Pack' },
  pro:      { amount_cents: 5000,  price_cents: 5000,  label: '$50 Credit Pack' },
  max:      { amount_cents: 10000, price_cents: 10000, label: '$100 Credit Pack' },
}

// API tier pricing — base + metered overage (preserved)
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
    const { success_url, cancel_url, type = 'web', api_tier, credit_pack } = payload

    // Build Stripe Checkout Session params
    const params = new URLSearchParams()
    params.set('customer_email', email)
    params.set('success_url', success_url)
    params.set('cancel_url', cancel_url)

    // Link Stripe checkout to Supabase user (from verified JWT)
    params.set('client_reference_id', user_id)
    params.set('metadata[supabase_user_id]', user_id)

    if (type === 'api' && api_tier && api_tier in API_TIER_PRICES) {
      // ── API subscription: base price + metered overage ──
      params.set('mode', 'subscription')
      const tierPrices = API_TIER_PRICES[api_tier]
      params.set('line_items[0][price]', tierPrices.base_price_id)
      params.set('line_items[0][quantity]', '1')
      params.set('line_items[1][price]', tierPrices.overage_price_id)
      params.set('metadata[type]', 'api')
      params.set('metadata[api_tier]', api_tier)
      params.set('subscription_data[metadata][supabase_user_id]', user_id)
      params.set('subscription_data[metadata][type]', 'api')
      params.set('subscription_data[metadata][api_tier]', api_tier)
    } else {
      // ── Credit pack purchase (one-time payment) ──
      params.set('mode', 'payment')
      const packId = credit_pack || 'starter'
      const pack = CREDIT_PACKS[packId]
      if (!pack) {
        return new Response(
          JSON.stringify({ error: 'Invalid credit pack', valid_packs: Object.keys(CREDIT_PACKS) }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
        )
      }

      params.set('line_items[0][price_data][currency]', 'usd')
      params.set('line_items[0][price_data][unit_amount]', pack.price_cents.toString())
      params.set('line_items[0][price_data][product_data][name]', pack.label)
      params.set('line_items[0][price_data][product_data][description]',
        `${(pack.amount_cents / 100).toFixed(0)} credits for Kernel API usage. Pay only for what you use.`)
      params.set('line_items[0][quantity]', '1')
      params.set('metadata[type]', 'credits')
      params.set('metadata[credit_pack]', packId)
      params.set('metadata[credits_cents]', pack.amount_cents.toString())
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
      metadata: { type, credit_pack },
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
