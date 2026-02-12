// Supabase Edge Function: create-checkout
// Creates a Stripe Checkout Session with the AI-calculated price.
//
// Deploy: npx supabase functions deploy create-checkout --project-ref kqsixkorzaulmeuynfkp
// Set secrets:
//   npx supabase secrets set STRIPE_SECRET_KEY=sk_live_... --project-ref kqsixkorzaulmeuynfkp
//   npx supabase secrets set APP_BASE_URL=https://isaacsight.github.io/does-this-feel-right- --project-ref kqsixkorzaulmeuynfkp

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import Stripe from 'npm:stripe@14'

interface CheckoutPayload {
  inquiryId: string
  email: string
  name: string
  amount: number // total in dollars
  description: string
  score: number
  tier: string
  quoteType: string | null
}

serve(async (req: Request) => {
  // CORS headers for browser requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    const appBaseUrl = Deno.env.get('APP_BASE_URL')

    if (!stripeKey) {
      return new Response(
        JSON.stringify({ error: 'Missing STRIPE_SECRET_KEY' }),
        { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      )
    }

    if (!appBaseUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing APP_BASE_URL' }),
        { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      )
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' })
    const payload = (await req.json()) as CheckoutPayload

    const unitAmount = Math.round(payload.amount * 100) // dollars → cents

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: payload.email,
      client_reference_id: payload.inquiryId,
      metadata: {
        inquiry_id: payload.inquiryId,
        score: String(payload.score),
        tier: payload.tier,
        type: payload.quoteType ?? 'unknown',
      },
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: unitAmount,
            product_data: {
              name: `Project — ${payload.tier}`,
              description: payload.description.slice(0, 500),
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${appBaseUrl}/#/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appBaseUrl}/#/prototype`,
    })

    return new Response(
      JSON.stringify({ sessionId: session.id, url: session.url }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  } catch (error) {
    console.error('create-checkout error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to create checkout session' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  }
})
