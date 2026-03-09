// Admin Invoice — create and send Stripe invoices for client projects
//
// Deploy: npx supabase functions deploy admin-invoice --project-ref eoxxpyixdieprsxlpwcs --no-verify-jwt
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handlePreflight, SECURITY_HEADERS } from '../_shared/cors.ts'

async function stripeAPI(path: string, params: URLSearchParams, stripeKey: string): Promise<{ ok: boolean; data: any; status: number }> {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${stripeKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })
  const data = await res.json()
  return { ok: res.ok, data, status: res.status }
}

async function stripeGET(path: string, query: string, stripeKey: string): Promise<{ ok: boolean; data: any }> {
  const res = await fetch(`https://api.stripe.com/v1${path}?${query}`, {
    headers: { 'Authorization': `Bearer ${stripeKey}` },
  })
  return { ok: res.ok, data: await res.json() }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handlePreflight(req)

  const CORS = { ...corsHeaders(req), ...SECURITY_HEADERS }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }

  try {
    // ── Auth: verify admin ──
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return new Response(JSON.stringify({ error: 'No auth token' }), {
        status: 401, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) {
      return new Response(JSON.stringify({ error: 'Missing STRIPE_SECRET_KEY' }), {
        status: 500, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') || serviceKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })
    const { data: { user }, error: authErr } = await userClient.auth.getUser()
    if (authErr || !user || user.app_metadata?.is_admin !== true) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    // ── Parse request ──
    const body = await req.json()
    const { email, amount_cents, description, metadata } = body

    if (!email || !amount_cents) {
      return new Response(JSON.stringify({ error: 'Missing email or amount_cents' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    // ── 1. Find or create Stripe customer ──
    const { ok: searchOk, data: searchData } = await stripeGET(
      '/customers/search',
      `query=${encodeURIComponent(`email:'${email}'`)}`,
      stripeKey,
    )

    let customerId: string
    if (searchOk && searchData.data?.length > 0) {
      customerId = searchData.data[0].id
    } else {
      // Create new customer
      const custParams = new URLSearchParams()
      custParams.set('email', email)
      custParams.set('name', email.split('@')[0])
      custParams.set('metadata[source]', 'kernel_admin_invoice')
      const { ok: custOk, data: custData } = await stripeAPI('/customers', custParams, stripeKey)
      if (!custOk) {
        return new Response(JSON.stringify({ error: 'Failed to create Stripe customer', detail: custData }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...CORS },
        })
      }
      customerId = custData.id
    }

    // ── 2. Create invoice ──
    const invParams = new URLSearchParams()
    invParams.set('customer', customerId)
    invParams.set('collection_method', 'send_invoice')
    invParams.set('days_until_due', '30')
    invParams.set('description', description || 'Kernel Project Invoice')
    invParams.set('auto_advance', 'false')
    // Attach metadata
    if (metadata) {
      for (const [k, v] of Object.entries(metadata)) {
        invParams.set(`metadata[${k}]`, String(v))
      }
    }

    const { ok: invOk, data: invData } = await stripeAPI('/invoices', invParams, stripeKey)
    if (!invOk) {
      return new Response(JSON.stringify({ error: 'Failed to create invoice', detail: invData }), {
        status: 500, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    // ── 3. Add line item (subtotal — pre-tax amount) ──
    // The amount_cents includes tax + stripe fee. Break it down.
    const subtotalCents = metadata?.subtotal ? metadata.subtotal * 100 : amount_cents
    const taxCents = metadata?.tax ? metadata.tax * 100 : 0

    const itemParams = new URLSearchParams()
    itemParams.set('invoice', invData.id)
    itemParams.set('amount', String(subtotalCents))
    itemParams.set('currency', 'usd')
    itemParams.set('description', `${metadata?.tier || 'Standard'} Tier — Project Work`)

    const { ok: itemOk, data: itemData } = await stripeAPI('/invoiceitems', itemParams, stripeKey)
    if (!itemOk) {
      return new Response(JSON.stringify({ error: 'Failed to add line item', detail: itemData }), {
        status: 500, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    // ── 4. Add tax line item ──
    if (taxCents > 0) {
      const taxParams = new URLSearchParams()
      taxParams.set('invoice', invData.id)
      taxParams.set('amount', String(taxCents))
      taxParams.set('currency', 'usd')
      taxParams.set('description', 'Sales Tax (CA 8.75%)')
      await stripeAPI('/invoiceitems', taxParams, stripeKey)
    }

    // ── 5. Return draft invoice for admin approval ──
    // Invoice stays as DRAFT — admin reviews in Stripe dashboard and manually finalizes/sends.
    // auto_advance is false, so Stripe will not auto-send.

    return new Response(JSON.stringify({
      success: true,
      invoice_id: invData.id,
      status: 'draft',
      dashboard_url: `https://dashboard.stripe.com/invoices/${invData.id}`,
      customer_id: customerId,
      message: 'Invoice created as draft. Review and send from Stripe dashboard.',
    }), {
      status: 200, headers: { 'Content-Type': 'application/json', ...CORS },
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal error', detail: String(err) }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }
})
