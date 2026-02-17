// Supabase Edge Function: delete-account
// Permanently deletes a user's account and all associated data.
// Cancels active Stripe subscription if one exists.
//
// Deploy: npx supabase functions deploy delete-account --project-ref eoxxpyixdieprsxlpwcs
// Secrets: STRIPE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
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
          await fetch(`https://api.stripe.com/v1/subscriptions/${sub.stripe_subscription_id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${stripeKey}` },
          })
          console.log('Cancelled Stripe subscription:', sub.stripe_subscription_id)
        } catch (err) {
          console.warn('Stripe cancellation failed (continuing with deletion):', err)
        }
      }
    }

    // ── Delete auth user (cascades all public tables) ───
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id)
    if (deleteError) {
      console.error('Failed to delete user:', deleteError)
      return jsonResponse({ error: 'Failed to delete account' }, 500)
    }

    console.log('Account deleted:', user.id, user.email)
    return jsonResponse({ success: true })
  } catch (error) {
    console.error('delete-account error:', error)
    return jsonResponse({ error: 'Internal server error' }, 500)
  }
})
