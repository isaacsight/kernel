// Supabase Edge Function: create-portal
// Creates a Stripe Billing Portal session so users can manage/cancel their subscription.
// Fully self-contained: extracts user from JWT, queries DB, finds Stripe customer.
//
// Deploy: npx supabase functions deploy create-portal --project-ref eoxxpyixdieprsxlpwcs
// Secrets: STRIPE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  console.log('create-portal invoked:', req.method)

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) {
      console.error('STRIPE_SECRET_KEY not set')
      return jsonResponse({ error: 'Billing not configured' }, 500)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    let body: Record<string, string> = {}
    try { body = await req.json() } catch { /* empty body ok */ }
    const return_url = body.return_url

    // ── Step 1: Identify user from JWT ──────────────────────
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '')

    if (!token || token.length < 20) {
      console.error('Missing or invalid auth token')
      return jsonResponse({ error: 'Missing authorization' }, 401)
    }

    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || serviceRoleKey
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })
    const { data: { user }, error: userError } = await userClient.auth.getUser(token)

    if (userError || !user) {
      console.error('Auth error:', userError?.message || 'No user returned')
      return jsonResponse({ error: 'Not authenticated' }, 401)
    }

    const userEmail = user.email
    console.log(`Portal request from user ${user.id} (${userEmail})`)

    // ── Step 2: Look up subscription in DB (service role bypasses RLS) ──
    const adminClient = createClient(supabaseUrl, serviceRoleKey)
    const { data: sub } = await adminClient
      .from('subscriptions')
      .select('stripe_customer_id, stripe_subscription_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()

    let customerId: string | null = null

    // ── Strategy 1: Direct customer ID from DB ──
    if (sub?.stripe_customer_id) {
      customerId = sub.stripe_customer_id
      console.log('Strategy 1 (DB customer_id):', customerId)
    }

    // ── Strategy 2: Look up customer via subscription ID ──
    if (!customerId && sub?.stripe_subscription_id) {
      const subRes = await fetch(`https://api.stripe.com/v1/subscriptions/${sub.stripe_subscription_id}`, {
        headers: { Authorization: `Bearer ${stripeKey}` },
      })
      if (subRes.ok) {
        const stripeSub = await subRes.json()
        customerId = stripeSub.customer
        console.log('Strategy 2 (subscription lookup):', customerId)

        // Backfill the customer ID in DB for next time
        if (customerId) {
          await adminClient
            .from('subscriptions')
            .update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
            .eq('user_id', user.id)
        }
      }
    }

    // ── Strategy 3: Search Stripe by email ──
    if (!customerId && userEmail) {
      const searchParams = new URLSearchParams()
      searchParams.set('query', `email:"${userEmail}"`)
      searchParams.set('limit', '1')

      const searchRes = await fetch(`https://api.stripe.com/v1/customers/search?${searchParams}`, {
        headers: { Authorization: `Bearer ${stripeKey}` },
      })
      if (searchRes.ok) {
        const { data: customers } = await searchRes.json()
        if (customers?.length > 0) {
          customerId = customers[0].id
          console.log('Strategy 3 (email search):', customerId)

          // Backfill
          if (customerId) {
            await adminClient
              .from('subscriptions')
              .update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
              .eq('user_id', user.id)
          }
        }
      }
    }

    // ── Strategy 4: List all customers, match by email ──
    if (!customerId && userEmail) {
      const listParams = new URLSearchParams()
      listParams.set('email', userEmail)
      listParams.set('limit', '1')

      const listRes = await fetch(`https://api.stripe.com/v1/customers?${listParams}`, {
        headers: { Authorization: `Bearer ${stripeKey}` },
      })
      if (listRes.ok) {
        const { data: customers } = await listRes.json()
        if (customers?.length > 0) {
          customerId = customers[0].id
          console.log('Strategy 4 (customer list):', customerId)
        }
      }
    }

    if (!customerId) {
      console.error('All strategies failed for user', user.id, userEmail)
      return jsonResponse({ error: `No Stripe customer found for ${userEmail}. Contact support.` }, 404)
    }

    console.log('Creating portal session for customer:', customerId)

    // ── Step 3: Ensure Billing Portal configuration exists ──
    // Stripe requires at least one portal configuration before sessions can be created.
    const configCheck = await fetch('https://api.stripe.com/v1/billing_portal/configurations?limit=1', {
      headers: { Authorization: `Bearer ${stripeKey}` },
    })
    if (configCheck.ok) {
      const configs = await configCheck.json()
      if (!configs.data || configs.data.length === 0) {
        console.log('No portal configuration found — creating default')
        const configParams = new URLSearchParams()
        configParams.set('business_profile[headline]', 'Manage your Kernel subscription')
        configParams.set('features[subscription_cancel][enabled]', 'true')
        configParams.set('features[subscription_cancel][mode]', 'at_period_end')
        configParams.set('features[payment_method_update][enabled]', 'true')
        configParams.set('features[invoice_history][enabled]', 'true')
        const configRes = await fetch('https://api.stripe.com/v1/billing_portal/configurations', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${stripeKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: configParams.toString(),
        })
        if (!configRes.ok) {
          const err = await configRes.text()
          console.error('Failed to create portal config:', configRes.status, err)
        } else {
          console.log('Portal configuration created successfully')
        }
      }
    }

    // ── Step 4: Create Billing Portal session ──────────────
    const portalParams = new URLSearchParams()
    portalParams.set('customer', customerId)
    portalParams.set('return_url', return_url || 'https://isaacsight.github.io/does-this-feel-right-/')

    const portalRes = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: portalParams.toString(),
    })

    if (!portalRes.ok) {
      const errBody = await portalRes.text()
      console.error('Stripe portal error:', portalRes.status, errBody)
      let detail = 'Failed to create portal session'
      try {
        const parsed = JSON.parse(errBody)
        if (parsed?.error?.message) detail = parsed.error.message
      } catch { /* use default */ }
      return jsonResponse({ error: detail }, portalRes.status)
    }

    const portal = await portalRes.json()
    console.log('Portal session created:', portal.url ? 'success' : 'no url')
    return jsonResponse({ url: portal.url })
  } catch (error) {
    console.error('create-portal error:', error)
    return jsonResponse({ error: `Server error: ${error instanceof Error ? error.message : 'Unknown'}` }, 500)
  }
})
