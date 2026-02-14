// Supabase Edge Function: create-checkout
// Creates a Stripe Checkout session for $20/mo Kernel Agent subscription.
// Now accepts user_id to correlate Stripe → Supabase user via client_reference_id.
//
// Deploy: npx supabase functions deploy create-checkout --project-ref eoxxpyixdieprsxlpwcs
// Secrets: STRIPE_SECRET_KEY

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CheckoutPayload {
  email: string
  user_id?: string
  mode?: 'subscription' | 'payment'
  price_id?: string
  success_url: string
  cancel_url: string
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) {
      return new Response(
        JSON.stringify({ error: 'Missing STRIPE_SECRET_KEY' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    const payload = (await req.json()) as CheckoutPayload
    const { email, user_id, mode = 'subscription', price_id, success_url, cancel_url } = payload

    if (!email?.trim()) {
      return new Response(
        JSON.stringify({ error: 'email is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    // Build Stripe Checkout Session params
    const params = new URLSearchParams()
    params.set('customer_email', email.trim())
    params.set('mode', mode)
    params.set('success_url', success_url)
    params.set('cancel_url', cancel_url)

    // Link Stripe checkout to Supabase user
    if (user_id) {
      params.set('client_reference_id', user_id)
      params.set('metadata[supabase_user_id]', user_id)
      if (mode === 'subscription') {
        params.set('subscription_data[metadata][supabase_user_id]', user_id)
      }
    }

    if (price_id) {
      // Use existing Price from Stripe dashboard
      params.set('line_items[0][price]', price_id)
      params.set('line_items[0][quantity]', '1')
    } else {
      // Create price inline — $20/mo subscription
      params.set('line_items[0][price_data][currency]', 'usd')
      params.set('line_items[0][price_data][unit_amount]', '2000')
      params.set('line_items[0][price_data][product_data][name]', 'Kernel Agent — Pro')
      params.set('line_items[0][price_data][product_data][description]', 'Full access to the Antigravity Kernel. Chat, observe, and control the cognitive engine.')
      if (mode === 'subscription') {
        params.set('line_items[0][price_data][recurring][interval]', 'month')
      }
      params.set('line_items[0][quantity]', '1')
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
