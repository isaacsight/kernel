// Supabase Edge Function: create-checkout
// Creates a Stripe Checkout session for message pack purchases (one-time payments).
//
// Packs:
//   100 messages  = $15
//   500 messages  = $50
//   2,000 messages = $150
//
// Deploy: npx supabase functions deploy create-checkout --project-ref eoxxpyixdieprsxlpwcs --no-verify-jwt
// Secrets: STRIPE_SECRET_KEY

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handlePreflight, SECURITY_HEADERS } from '../_shared/cors.ts'
import { logAudit, getClientIP, getUA } from '../_shared/audit.ts'
import { requireContentType } from '../_shared/validate.ts'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'

interface CheckoutPayload {
  pack: 'pack_100' | 'pack_500' | 'pack_2000'
  success_url: string
  cancel_url: string
}

const MESSAGE_PACKS = {
  pack_100: { messages: 100, amount: 1500, name: '100 Messages', description: '100 Kernel messages — never expire' },
  pack_500: { messages: 500, amount: 5000, name: '500 Messages', description: '500 Kernel messages — never expire' },
  pack_2000: { messages: 2000, amount: 15000, name: '2,000 Messages', description: '2,000 Kernel messages — never expire' },
} as const

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return handlePreflight(req)
  }

  const CORS_HEADERS = { ...corsHeaders(req), ...SECURITY_HEADERS }

  try {
    const ctErr = requireContentType(req)
    if (ctErr) return ctErr(CORS_HEADERS)

    // Auth: verify JWT
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

    const email = user.email!
    const user_id = user.id

    // Rate limit: 5 per hour
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
    const { pack, success_url, cancel_url } = payload

    if (!pack || !(pack in MESSAGE_PACKS)) {
      return new Response(
        JSON.stringify({ error: 'Invalid pack. Use: pack_100, pack_500, or pack_2000' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    const packInfo = MESSAGE_PACKS[pack]

    // Build Stripe Checkout (one-time payment)
    const params = new URLSearchParams()
    params.set('customer_email', email)
    params.set('mode', 'payment')
    params.set('success_url', success_url)
    params.set('cancel_url', cancel_url)
    params.set('client_reference_id', user_id)
    params.set('metadata[supabase_user_id]', user_id)
    params.set('metadata[pack]', pack)
    params.set('metadata[messages]', String(packInfo.messages))
    params.set('payment_intent_data[metadata][supabase_user_id]', user_id)
    params.set('payment_intent_data[metadata][pack]', pack)
    params.set('payment_intent_data[metadata][messages]', String(packInfo.messages))

    // Inline price (no need for pre-created Stripe products)
    params.set('line_items[0][price_data][currency]', 'usd')
    params.set('line_items[0][price_data][unit_amount]', String(packInfo.amount))
    params.set('line_items[0][price_data][product_data][name]', packInfo.name)
    params.set('line_items[0][price_data][product_data][description]', packInfo.description)
    params.set('line_items[0][quantity]', '1')

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

    logAudit(svc, {
      actorId: user_id, eventType: 'payment.checkout', action: 'create-checkout',
      source: 'create-checkout', status: 'success', statusCode: 200,
      metadata: { pack, messages: packInfo.messages },
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
