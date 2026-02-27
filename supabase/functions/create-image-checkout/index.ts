// Supabase Edge Function: create-image-checkout
// Creates a one-time Stripe Checkout session for image credit packs.
// Packs: starter (25 credits), standard (75 credits), power (200 credits).
//
// Deploy: npx supabase functions deploy create-image-checkout --project-ref eoxxpyixdieprsxlpwcs
// Secrets: STRIPE_SECRET_KEY, STRIPE_IMAGE_STARTER_PRICE_ID, STRIPE_IMAGE_STANDARD_PRICE_ID, STRIPE_IMAGE_POWER_PRICE_ID

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handlePreflight, SECURITY_HEADERS } from '../_shared/cors.ts'
import { logAudit, getClientIP, getUA } from '../_shared/audit.ts'
import { requireContentType, requireJsonBody, requireFields } from '../_shared/validate.ts'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'

type PackType = 'starter' | 'standard' | 'power'

interface CheckoutPayload {
  pack: PackType
  success_url: string
  cancel_url: string
}

const PACK_CREDITS: Record<PackType, number> = {
  starter: 25,
  standard: 75,
  power: 200,
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return handlePreflight(req)
  }

  const CORS = { ...corsHeaders(req), ...SECURITY_HEADERS }

  try {
    // ── Content-type check ──────────────────────────────
    const ctErr = requireContentType(req)
    if (ctErr) return ctErr(CORS)

    // ── Auth: verify JWT ────────────────────────────────
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } }
      )
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } }
      )
    }

    const email = user.email!
    const userId = user.id

    // ── Rate limit: 5 per hour ──────────────────────────
    const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const rl = await checkRateLimit(svc, userId, 'create-image-checkout', 'free')
    if (!rl.allowed) return rateLimitResponse(rl, CORS)

    // ── Parse body ──────────────────────────────────────
    const { body, error: bodyErr } = await requireJsonBody<CheckoutPayload>(req, 4 * 1024)
    if (bodyErr) return bodyErr(CORS)

    const fieldsErr = requireFields(body as Record<string, unknown>, ['pack', 'success_url', 'cancel_url'])
    if (fieldsErr) return fieldsErr(CORS)

    const { pack, success_url, cancel_url } = body!

    // Validate pack type
    if (!PACK_CREDITS[pack]) {
      return new Response(
        JSON.stringify({ error: `Invalid pack type: ${pack}. Must be starter, standard, or power.` }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } }
      )
    }

    // ── Resolve price ID ────────────────────────────────
    const PRICE_MAP: Record<PackType, string | undefined> = {
      starter: Deno.env.get('STRIPE_IMAGE_STARTER_PRICE_ID'),
      standard: Deno.env.get('STRIPE_IMAGE_STANDARD_PRICE_ID'),
      power: Deno.env.get('STRIPE_IMAGE_POWER_PRICE_ID'),
    }

    const priceId = PRICE_MAP[pack]
    if (!priceId) {
      console.error(`Missing Stripe price ID for pack: ${pack}`)
      return new Response(
        JSON.stringify({ error: 'Image credit pack not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } }
      )
    }

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) {
      return new Response(
        JSON.stringify({ error: 'Missing STRIPE_SECRET_KEY' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } }
      )
    }

    // ── Create Stripe Checkout Session (one-time payment) ──
    const credits = PACK_CREDITS[pack]

    const params = new URLSearchParams()
    params.set('customer_email', email)
    params.set('mode', 'payment')
    params.set('success_url', success_url)
    params.set('cancel_url', cancel_url)
    params.set('client_reference_id', userId)
    params.set('metadata[supabase_user_id]', userId)
    params.set('metadata[pack]', pack)
    params.set('metadata[credits]', String(credits))
    params.set('line_items[0][price]', priceId)
    params.set('line_items[0][quantity]', '1')
    params.set('payment_intent_data[setup_future_usage]', 'off_session')

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
        { status: response.status, headers: { 'Content-Type': 'application/json', ...CORS } }
      )
    }

    const session = await response.json()

    // ── Audit log ───────────────────────────────────────
    logAudit(svc, {
      actorId: userId,
      eventType: 'payment.checkout',
      action: 'create-image-checkout',
      source: 'create-image-checkout',
      status: 'success',
      statusCode: 200,
      metadata: { pack, credits },
      ip: getClientIP(req),
      userAgent: getUA(req),
    })

    return new Response(
      JSON.stringify({ url: session.url, session_id: session.id }),
      { headers: { 'Content-Type': 'application/json', ...CORS } }
    )
  } catch (error) {
    console.error('create-image-checkout error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } }
    )
  }
})
