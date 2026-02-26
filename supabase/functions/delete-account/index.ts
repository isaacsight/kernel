// Supabase Edge Function: delete-account
// Permanently deletes a user's account and all associated data.
// Cancels active Stripe subscription if one exists.
//
// Deploy: npx supabase functions deploy delete-account --project-ref eoxxpyixdieprsxlpwcs
// Secrets: STRIPE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handlePreflight, SECURITY_HEADERS } from '../_shared/cors.ts'
import { logAudit, getClientIP, getUA } from '../_shared/audit.ts'
import { requireContentType } from '../_shared/validate.ts'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return handlePreflight(req)
  }

  const CORS_HEADERS = { ...corsHeaders(req), ...SECURITY_HEADERS }
  const jsonResponse = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    })

  try {
    // ── Content-type check ──────────────────────────────
    const ctErr = requireContentType(req)
    if (ctErr) return ctErr(CORS_HEADERS)

    // ── Auth: verify user JWT ───────────────────────────
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return jsonResponse({ error: 'Missing authorization header' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Verify the user
    const userClient = createClient(supabaseUrl, anonKey)
    const { data: { user }, error: authError } = await userClient.auth.getUser(token)
    if (authError || !user) return jsonResponse({ error: 'Unauthorized' }, 401)

    // Service-role client for admin operations
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // ── Rate limit: 3 per 24h ─────────────────────────
    const rl = await checkRateLimit(admin, user.id, 'delete-account', 'free')
    if (!rl.allowed) return rateLimitResponse(rl, CORS_HEADERS)

    // ── Cancel Stripe subscription if active ────────────
    const { data: sub } = await admin
      .from('subscriptions')
      .select('stripe_subscription_id, status')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()

    if (sub?.stripe_subscription_id) {
      const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
      if (stripeKey) {
        try {
          const stripeRes = await fetch(`https://api.stripe.com/v1/subscriptions/${sub.stripe_subscription_id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${stripeKey}` },
          })
          if (stripeRes.ok) {
            console.log('Cancelled Stripe subscription:', sub.stripe_subscription_id)
          } else {
            const errText = await stripeRes.text().catch(() => 'unknown')
            console.warn(`Stripe cancellation failed (${stripeRes.status}):`, errText)
          }
        } catch (err) {
          console.warn('Stripe cancellation failed (continuing with deletion):', err)
        }
      }
    }

    // ── Delete auth user (cascades all public tables) ───
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id)
    if (deleteError) {
      console.error('Failed to delete user:', deleteError)
      // Audit the failure
      logAudit(admin, {
        actorId: user.id, eventType: 'user.action', action: 'delete-account',
        source: 'delete-account', status: 'error', statusCode: 500,
        metadata: { email: user.email, error: deleteError.message },
        ip: getClientIP(req), userAgent: getUA(req),
      })
      return jsonResponse({ error: 'Failed to delete account' }, 500)
    }

    // Audit AFTER successful deletion
    logAudit(admin, {
      actorId: user.id, eventType: 'user.action', action: 'delete-account',
      source: 'delete-account', status: 'success', statusCode: 200,
      metadata: { email: user.email },
      ip: getClientIP(req), userAgent: getUA(req),
    })

    console.log('Account deleted:', user.id, user.email)
    return jsonResponse({ success: true })
  } catch (error) {
    console.error('delete-account error:', error)
    return jsonResponse({ error: 'Internal server error' }, 500)
  }
})
