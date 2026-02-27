// Supabase Edge Function: stripe-webhook
// Verifies Stripe webhook signatures and upserts subscription status.
//
// Deploy: npx supabase functions deploy stripe-webhook --project-ref eoxxpyixdieprsxlpwcs
// Secrets: STRIPE_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { logAudit, getClientIP, getUA } from '../_shared/audit.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST',
  'Access-Control-Allow-Headers': 'content-type, stripe-signature',
}

/** Safe epoch-seconds → ISO string. Returns null if input is falsy/NaN. */
function safeEpochToISO(epoch: number | undefined | null): string | null {
  if (!epoch || isNaN(epoch)) return null
  return new Date(epoch * 1000).toISOString()
}

// HMAC-SHA256 signature verification (Deno-compatible, no Stripe SDK needed)
async function verifyStripeSignature(
  payload: string,
  sigHeader: string,
  secret: string,
): Promise<boolean> {
  const parts = sigHeader.split(',').reduce((acc, part) => {
    const [key, value] = part.split('=')
    if (key === 't') acc.timestamp = value
    if (key === 'v1') acc.signatures.push(value)
    return acc
  }, { timestamp: '', signatures: [] as string[] })

  if (!parts.timestamp || parts.signatures.length === 0) return false

  // Reject timestamps older than 5 minutes
  const age = Math.floor(Date.now() / 1000) - parseInt(parts.timestamp, 10)
  if (age > 300) return false

  const signedPayload = `${parts.timestamp}.${payload}`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signatureBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload))
  const expectedSig = Array.from(new Uint8Array(signatureBytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  return parts.signatures.some(sig => sig === expectedSig)
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  if (!webhookSecret) {
    console.error('Missing STRIPE_WEBHOOK_SECRET')
    return new Response('Server misconfigured', { status: 500 })
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return new Response('Missing stripe-signature header', { status: 400 })
  }

  const body = await req.text()

  const valid = await verifyStripeSignature(body, signature, webhookSecret)
  if (!valid) {
    console.error('Invalid Stripe signature')
    return new Response('Invalid signature', { status: 400 })
  }

  try {
    const event = JSON.parse(body)
    console.log(`Stripe event: ${event.type} (${event.id})`)

    // Supabase admin client (bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
      return new Response('Server misconfigured', { status: 500 })
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey)
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        const userId = session.client_reference_id
        if (!userId) {
          console.error('No client_reference_id on checkout session')
          break
        }

        // Handle one-time image credit purchases
        if (session.mode === 'payment') {
          const credits = parseInt(session.metadata?.credits || '0', 10)
          if (credits > 0 && userId) {
            const { error: creditErr } = await supabase.rpc('add_image_credits', {
              p_user_id: userId,
              p_amount: credits,
            })
            if (creditErr) console.error('Failed to add image credits:', creditErr)
            else console.log(`Added ${credits} image credits for user ${userId}`)
          }

          // Store Stripe customer ID for future off-session charges (auto-reload)
          if (session.customer && userId) {
            const customerId = typeof session.customer === 'string'
              ? session.customer
              : session.customer.id
            const { error: cidErr } = await supabase.rpc('set_stripe_customer_id', {
              p_user_id: userId,
              p_customer_id: customerId,
            })
            if (cidErr) console.error('Failed to store stripe_customer_id:', cidErr)
            else console.log(`Stored stripe_customer_id for user ${userId}`)
          }

          break // Don't process as subscription
        }

        // Extract plan + status from Stripe subscription metadata
        let plan = 'pro_monthly'
        let subStatus: string = 'active'
        let trialEnd: string | null = null
        const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
        if (stripeKey && session.subscription) {
          try {
            const subRes = await fetch(`https://api.stripe.com/v1/subscriptions/${session.subscription}`, {
              headers: { Authorization: `Bearer ${stripeKey}` },
            })
            if (subRes.ok) {
              const stripeSub = await subRes.json()
              plan = stripeSub.metadata?.plan || 'pro_monthly'
              // Use real Stripe status (trialing, active, etc.)
              if (stripeSub.status === 'trialing') subStatus = 'trialing'
              // Set trial end as period end so scheduler doesn't expire it early
              if (stripeSub.trial_end) trialEnd = safeEpochToISO(stripeSub.trial_end)
              // Fallback: check price ID if no metadata
              if (!stripeSub.metadata?.plan) {
                const priceId = stripeSub.items?.data?.[0]?.price?.id
                if (priceId === Deno.env.get('STRIPE_ANNUAL_PRICE_ID')) plan = 'pro_annual'
              }
            }
          } catch (e) {
            console.error('Failed to fetch subscription for plan:', e)
          }
        }

        const { error } = await supabase.from('subscriptions').upsert({
          user_id: userId,
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
          status: subStatus,
          plan,
          current_period_end: trialEnd, // Trial end or null (invoice.paid sets real period)
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })

        if (error) console.error('Upsert error (checkout.session.completed):', error)
        else console.log(`Subscription activated for user ${userId}`)

        // Send welcome email
        const customerEmail = session.customer_details?.email || session.customer_email
        if (customerEmail) {
          const resendKey = Deno.env.get('RESEND_API_KEY')
          if (resendKey) {
            try {
              const emailRes = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${resendKey}`,
                },
                body: JSON.stringify({
                  from: 'Antigravity Kernel <notifications@yourdomain.com>',
                  to: [customerEmail],
                  subject: 'Welcome to the Antigravity Kernel',
                  html: `
                    <div style="font-family: Georgia, 'EB Garamond', serif; max-width: 600px; margin: 0 auto; padding: 2.5rem; color: #1F1E1D; background: #FAF9F6;">
                      <div style="text-align: center; margin-bottom: 2rem;">
                        <div style="width: 56px; height: 56px; background: #7B8CDE; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: white; font-size: 24px; font-weight: 600;">K</div>
                      </div>

                      <h1 style="font-weight: 400; font-size: 28px; text-align: center; margin-bottom: 0.5rem;">Welcome to the Kernel.</h1>
                      <p style="text-align: center; font-size: 15px; opacity: 0.6; margin-bottom: 2rem;">Your subscription is now active.</p>

                      <hr style="border: none; border-top: 1px solid #e5e5e0; margin: 1.5rem 0;" />

                      <p style="font-size: 15px; line-height: 1.8;">
                        You now have full access to the Antigravity Kernel — a personal AI that remembers you, thinks with you, and gets better over time.
                      </p>

                      <div style="background: white; padding: 1.5rem; border-radius: 8px; margin: 1.5rem 0; border: 1px solid #e5e5e0;">
                        <p style="font-size: 13px; opacity: 0.5; margin: 0 0 0.75rem; font-family: 'Courier New', monospace; text-transform: uppercase; letter-spacing: 0.05em;">What you can do</p>
                        <p style="font-size: 14px; line-height: 1.8; margin: 0;">
                          &bull; Conversational AI with web search<br/>
                          &bull; Upload images, PDFs, and documents<br/>
                          &bull; Export code, text, and files<br/>
                          &bull; Persistent memory across conversations<br/>
                          &bull; Real-time cognitive engine observability
                        </p>
                      </div>

                      <div style="text-align: center; margin: 2rem 0;">
                        <a href="https://kernel.chat/" style="display: inline-block; padding: 12px 32px; background: #1F1E1D; color: #FAF9F6; text-decoration: none; border-radius: 6px; font-size: 14px; font-family: 'Courier New', monospace;">Open the Kernel &rarr;</a>
                      </div>

                      <hr style="border: none; border-top: 1px solid #e5e5e0; margin: 2rem 0 1rem;" />
                      <p style="font-size: 11px; opacity: 0.3; font-family: 'Courier New', monospace; text-align: center;">Antigravity Kernel &mdash; A cognitive architecture by Isaac Hernandez</p>
                    </div>
                  `,
                }),
              })
              if (!emailRes.ok) {
                const err = await emailRes.text()
                console.error('Welcome email failed:', err)
              } else {
                console.log(`Welcome email sent to ${customerEmail}`)
              }
            } catch (emailErr) {
              console.error('Welcome email error:', emailErr)
            }
          }
        }

        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object
        const subId = invoice.subscription
        if (!subId) break

        // Try to get user_id + plan from subscription metadata
        const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
        let userId: string | null = null
        let plan = 'pro_monthly'

        if (stripeKey) {
          const subRes = await fetch(`https://api.stripe.com/v1/subscriptions/${subId}`, {
            headers: { Authorization: `Bearer ${stripeKey}` },
          })
          if (subRes.ok) {
            const sub = await subRes.json()
            userId = sub.metadata?.supabase_user_id || null
            plan = sub.metadata?.plan || 'pro_monthly'
            if (!sub.metadata?.plan) {
              const priceId = sub.items?.data?.[0]?.price?.id
              if (priceId === Deno.env.get('STRIPE_ANNUAL_PRICE_ID')) plan = 'pro_annual'
            }
          }
        }

        const periodEnd = safeEpochToISO(invoice.lines?.data?.[0]?.period?.end)

        if (userId) {
          const { error } = await supabase.from('subscriptions').upsert({
            user_id: userId,
            stripe_customer_id: invoice.customer,
            stripe_subscription_id: subId,
            status: 'active',
            plan,
            current_period_end: periodEnd,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' })

          if (error) console.error('Upsert error (invoice.paid):', error)
        } else {
          // Fallback: update by stripe_subscription_id
          const { error } = await supabase.from('subscriptions')
            .update({
              status: 'active',
              plan,
              current_period_end: periodEnd,
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_subscription_id', subId)

          if (error) console.error('Update error (invoice.paid fallback):', error)
        }
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object
        const userId = sub.metadata?.supabase_user_id
        const status = sub.cancel_at_period_end ? 'canceled'
          : sub.status === 'active' ? 'active'
          : sub.status === 'trialing' ? 'trialing'
          : 'past_due'
        const subPeriodEnd = safeEpochToISO(sub.current_period_end)
        // Extract plan from metadata or price ID
        let plan = sub.metadata?.plan || 'pro_monthly'
        if (!sub.metadata?.plan) {
          const priceId = sub.items?.data?.[0]?.price?.id
          if (priceId === Deno.env.get('STRIPE_ANNUAL_PRICE_ID')) plan = 'pro_annual'
        }

        if (userId) {
          const { error } = await supabase.from('subscriptions').upsert({
            user_id: userId,
            stripe_customer_id: sub.customer,
            stripe_subscription_id: sub.id,
            status,
            plan,
            current_period_end: subPeriodEnd,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' })

          if (error) console.error('Upsert error (subscription.updated):', error)
        } else {
          const { error } = await supabase.from('subscriptions')
            .update({
              status,
              plan,
              current_period_end: subPeriodEnd,
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_subscription_id', sub.id)

          if (error) console.error('Update error (subscription.updated fallback):', error)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object
        const userId = sub.metadata?.supabase_user_id

        if (userId) {
          const { error } = await supabase.from('subscriptions')
            .update({ status: 'canceled', updated_at: new Date().toISOString() })
            .eq('user_id', userId)

          if (error) console.error('Update error (subscription.deleted):', error)
        } else {
          const { error } = await supabase.from('subscriptions')
            .update({ status: 'canceled', updated_at: new Date().toISOString() })
            .eq('stripe_subscription_id', sub.id)

          if (error) console.error('Update error (subscription.deleted fallback):', error)
        }
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    // Audit log payment events
    const auditEventType = event.type.startsWith('checkout')
      ? 'payment.checkout'
      : event.type.includes('subscription')
        ? 'payment.subscription'
        : 'payment.invoice'
    logAudit(supabase, {
      actorType: 'service',
      eventType: auditEventType,
      action: event.type,
      source: 'stripe-webhook',
      status: 'success',
      statusCode: 200,
      metadata: { stripeEventId: event.id, stripeType: event.type },
      ip: getClientIP(req),
      userAgent: getUA(req),
    })
  } catch (err) {
    console.error('Webhook handler error:', err)
    return new Response('Webhook handler error', { status: 500 })
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
})
