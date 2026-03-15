// One-time setup: Create Stripe Billing Meter for overage billing.
// Run once, then delete this function.
//
// Deploy: npx supabase functions deploy setup-billing-meter --project-ref eoxxpyixdieprsxlpwcs --no-verify-jwt
// Invoke: curl -X POST https://eoxxpyixdieprsxlpwcs.supabase.co/functions/v1/setup-billing-meter

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } })
  }

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
  if (!stripeKey) {
    return new Response(JSON.stringify({ error: 'No STRIPE_SECRET_KEY' }), { status: 500 })
  }

  const results: string[] = []

  try {
    // ── Step 1: Check if meter already exists ──
    const listRes = await fetch('https://api.stripe.com/v1/billing/meters?limit=10', {
      headers: { Authorization: `Bearer ${stripeKey}` },
    })

    if (!listRes.ok) {
      const err = await listRes.text()
      return new Response(JSON.stringify({ error: 'Failed to list meters', details: err }), { status: 500 })
    }

    const meters = await listRes.json()
    const existing = meters.data?.find((m: any) => m.event_name === 'kernel_pro_overage')

    let meterId: string

    if (existing) {
      meterId = existing.id
      results.push(`Meter already exists: ${meterId} (event: kernel_pro_overage)`)
    } else {
      // ── Step 2: Create the billing meter ──
      const meterParams = new URLSearchParams()
      meterParams.set('display_name', 'Pro Overage Messages')
      meterParams.set('event_name', 'kernel_pro_overage')
      meterParams.set('default_aggregation[formula]', 'sum')

      const meterRes = await fetch('https://api.stripe.com/v1/billing/meters', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: meterParams.toString(),
      })

      if (!meterRes.ok) {
        const err = await meterRes.text()
        return new Response(JSON.stringify({ error: 'Failed to create meter', details: err }), { status: 500 })
      }

      const meter = await meterRes.json()
      meterId = meter.id
      results.push(`Created meter: ${meterId} (event: kernel_pro_overage)`)
    }

    // ── Step 3: Check if metered price exists ──
    const priceListRes = await fetch('https://api.stripe.com/v1/prices?limit=20&active=true', {
      headers: { Authorization: `Bearer ${stripeKey}` },
    })
    const prices = await priceListRes.json()
    const existingPrice = prices.data?.find((p: any) =>
      p.recurring?.meter === meterId || p.metadata?.meter_event === 'kernel_pro_overage'
    )

    let priceId: string

    if (existingPrice && existingPrice.unit_amount === 10) {
      priceId = existingPrice.id
      results.push(`Metered price already exists: ${priceId} ($0.10/msg)`)
    } else {
      // Archive old price if wrong amount
      if (existingPrice && existingPrice.unit_amount !== 10) {
        await fetch(`https://api.stripe.com/v1/prices/${existingPrice.id}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${stripeKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: 'active=false',
        })
        results.push(`Archived old price ${existingPrice.id} ($${existingPrice.unit_amount / 100}/msg — wrong rate)`)
      }
      // ── Step 4: Create a product for overage ──
      const productParams = new URLSearchParams()
      productParams.set('name', 'Pro Overage Messages')
      productParams.set('description', 'Additional messages beyond the 200 included in Kernel Pro')

      const productRes = await fetch('https://api.stripe.com/v1/products', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: productParams.toString(),
      })
      const product = await productRes.json()
      results.push(`Created product: ${product.id} (Pro Overage Messages)`)

      // ── Step 5: Create metered price at $0.10/message ──
      const priceParams = new URLSearchParams()
      priceParams.set('currency', 'usd')
      priceParams.set('unit_amount', '10') // $0.10 = 10 cents
      priceParams.set('product', product.id)
      priceParams.set('recurring[interval]', 'month')
      priceParams.set('recurring[usage_type]', 'metered')
      priceParams.set('recurring[meter]', meterId)
      priceParams.set('billing_scheme', 'per_unit')
      priceParams.set('metadata[meter_event]', 'kernel_pro_overage')

      const priceRes = await fetch('https://api.stripe.com/v1/prices', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: priceParams.toString(),
      })

      if (!priceRes.ok) {
        const err = await priceRes.text()
        results.push(`Failed to create price: ${err}`)
        return new Response(JSON.stringify({ results, error: 'Price creation failed', details: err }), { status: 500 })
      }

      const price = await priceRes.json()
      priceId = price.id
      results.push(`Created metered price: ${priceId} ($0.10/message, linked to meter ${meterId})`)
    }

    // ── Step 6: Summary ──
    results.push('')
    results.push('=== SETUP COMPLETE ===')
    results.push(`Meter ID: ${meterId}`)
    results.push(`Price ID: ${priceId}`)
    results.push('')
    results.push('NEXT STEP: Update create-checkout to include this metered price')
    results.push(`as a second line item on Pro subscriptions.`)
    results.push(`Price ID to use: ${priceId}`)

    return new Response(JSON.stringify({ success: true, results, meterId, priceId }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err), results }), { status: 500 })
  }
})
