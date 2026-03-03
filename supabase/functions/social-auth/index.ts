// Supabase Edge Function: social-auth
// OAuth lifecycle for social media accounts.
// Actions: init_oauth, exchange_code, refresh, disconnect
//
// Deploy: npx supabase functions deploy social-auth --project-ref eoxxpyixdieprsxlpwcs --no-verify-jwt

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handlePreflight, SECURITY_HEADERS } from '../_shared/cors.ts'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { logAudit, getClientIP, getUA } from '../_shared/audit.ts'
import { requireContentType } from '../_shared/validate.ts'
import { resolvePlanId, ACTIVE_STATUSES, PLAN_LIMITS } from '../_shared/plan-limits.ts'
import { getAdapter, getSupportedPlatforms } from '../_shared/social/registry.ts'

// PKCE helper
function generateCodeVerifier(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

type Action = 'init_oauth' | 'exchange_code' | 'refresh' | 'disconnect' | 'list_accounts'

interface Payload {
  action: Action
  platform?: string
  code?: string
  state?: string
  account_id?: string
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handlePreflight(req)
  const CORS = { ...corsHeaders(req), ...SECURITY_HEADERS }

  try {
    const ctErr = requireContentType(req)
    if (ctErr) return ctErr(CORS)

    // Auth
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing auth' }), {
        status: 401, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    const authClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
    )
    const { data: { user }, error: authError } = await authClient.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    const svc = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    // Check Pro
    const { data: sub } = await svc
      .from('subscriptions')
      .select('status, plan')
      .eq('user_id', user.id)
      .maybeSingle()
    const isPro = sub && ACTIVE_STATUSES.includes(sub.status)
    if (!isPro) {
      return new Response(JSON.stringify({ error: 'pro_required' }), {
        status: 403, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    // Rate limit
    const planId = resolvePlanId(sub)
    const tier = planId === 'free' ? 'free' : planId.startsWith('max') ? 'max' : 'pro'
    const rl = await checkRateLimit(svc, user.id, 'social-auth', tier as 'free' | 'paid' | 'pro' | 'max')
    if (!rl.allowed) return rateLimitResponse(rl, CORS)

    const payload = await req.json() as Payload
    if (!payload.action) {
      return new Response(JSON.stringify({ error: 'action required' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    let result: Record<string, unknown> = {}

    switch (payload.action) {
      case 'init_oauth': {
        const platform = payload.platform
        if (!platform || !getSupportedPlatforms().includes(platform)) {
          return new Response(JSON.stringify({ error: `Unsupported platform. Available: ${getSupportedPlatforms().join(', ')}` }), {
            status: 400, headers: { 'Content-Type': 'application/json', ...CORS },
          })
        }

        // Check account limit
        const { count } = await svc.from('social_accounts')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_active', true)
        const limits = PLAN_LIMITS[planId] as Record<string, unknown>
        const maxAccounts = (limits.socialAccountsMax as number) || 3
        if ((count || 0) >= maxAccounts) {
          return new Response(JSON.stringify({ error: 'account_limit_reached', limit: maxAccounts }), {
            status: 403, headers: { 'Content-Type': 'application/json', ...CORS },
          })
        }

        const adapter = getAdapter(platform)
        const stateUuid = crypto.randomUUID()
        const codeVerifier = generateCodeVerifier()
        const codeChallenge = await generateCodeChallenge(codeVerifier)

        // Store OAuth state
        await svc.from('social_oauth_states').insert({
          user_id: user.id,
          platform,
          state: stateUuid,
          code_verifier: codeVerifier,
        })

        const authUrl = adapter.buildAuthUrl(stateUuid, codeChallenge)
        result = { authUrl, state: stateUuid }
        break
      }

      case 'exchange_code': {
        if (!payload.code || !payload.state) {
          return new Response(JSON.stringify({ error: 'code and state required' }), {
            status: 400, headers: { 'Content-Type': 'application/json', ...CORS },
          })
        }

        // Validate state
        const { data: oauthState, error: stateErr } = await svc
          .from('social_oauth_states')
          .select('*')
          .eq('state', payload.state)
          .eq('user_id', user.id)
          .single()

        if (stateErr || !oauthState) {
          return new Response(JSON.stringify({ error: 'Invalid or expired state' }), {
            status: 400, headers: { 'Content-Type': 'application/json', ...CORS },
          })
        }

        // Check TTL (10 min)
        const stateAge = Date.now() - new Date(oauthState.created_at).getTime()
        if (stateAge > 600_000) {
          await svc.from('social_oauth_states').delete().eq('id', oauthState.id)
          return new Response(JSON.stringify({ error: 'OAuth state expired' }), {
            status: 400, headers: { 'Content-Type': 'application/json', ...CORS },
          })
        }

        const adapter = getAdapter(oauthState.platform)

        // Exchange code for tokens
        const tokens = await adapter.exchangeCode(payload.code, oauthState.code_verifier)

        // Fetch profile
        const profile = await adapter.getUserProfile(tokens.access_token)

        // Encrypt tokens
        const { data: accessEnc } = await svc.rpc('encrypt_social_token', { token: tokens.access_token })
        const refreshEnc = tokens.refresh_token
          ? (await svc.rpc('encrypt_social_token', { token: tokens.refresh_token })).data
          : null

        // Upsert account
        const { data: account, error: insertErr } = await svc.from('social_accounts').upsert({
          user_id: user.id,
          platform: oauthState.platform,
          platform_user_id: profile.id,
          platform_username: profile.username,
          platform_display_name: profile.displayName,
          platform_avatar_url: profile.avatarUrl,
          access_token_enc: accessEnc,
          refresh_token_enc: refreshEnc,
          token_expires_at: tokens.expires_in
            ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
            : null,
          scopes: tokens.scope?.split(' ') || [],
          is_active: true,
          connected_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,platform,platform_user_id',
        }).select().single()

        if (insertErr) throw insertErr

        // Clean up OAuth state
        await svc.from('social_oauth_states').delete().eq('id', oauthState.id)

        result = {
          account: {
            id: account.id,
            platform: account.platform,
            platformUsername: account.platform_username,
            platformDisplayName: account.platform_display_name,
            platformAvatarUrl: account.platform_avatar_url,
            connectedAt: account.connected_at,
          },
        }

        // Audit
        logAudit(svc, {
          actorId: user.id,
          eventType: 'social.connected',
          action: `social-auth.exchange_code`,
          source: 'social-auth',
          status: 'success',
          statusCode: 200,
          metadata: { platform: oauthState.platform, username: profile.username },
          ip: getClientIP(req),
          userAgent: getUA(req),
        })
        break
      }

      case 'refresh': {
        if (!payload.account_id) {
          return new Response(JSON.stringify({ error: 'account_id required' }), {
            status: 400, headers: { 'Content-Type': 'application/json', ...CORS },
          })
        }

        const { data: account } = await svc.from('social_accounts')
          .select('*')
          .eq('id', payload.account_id)
          .eq('user_id', user.id)
          .single()

        if (!account || !account.refresh_token_enc) {
          return new Response(JSON.stringify({ error: 'Account not found or no refresh token' }), {
            status: 400, headers: { 'Content-Type': 'application/json', ...CORS },
          })
        }

        const adapter = getAdapter(account.platform)
        const { data: refreshToken } = await svc.rpc('decrypt_social_token', { encrypted: account.refresh_token_enc })
        const tokens = await adapter.refreshToken(refreshToken)

        const { data: newAccessEnc } = await svc.rpc('encrypt_social_token', { token: tokens.access_token })
        const newRefreshEnc = tokens.refresh_token
          ? (await svc.rpc('encrypt_social_token', { token: tokens.refresh_token })).data
          : account.refresh_token_enc

        await svc.from('social_accounts').update({
          access_token_enc: newAccessEnc,
          refresh_token_enc: newRefreshEnc,
          token_expires_at: tokens.expires_in
            ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
            : null,
        }).eq('id', account.id)

        result = { refreshed: true }
        break
      }

      case 'disconnect': {
        if (!payload.account_id) {
          return new Response(JSON.stringify({ error: 'account_id required' }), {
            status: 400, headers: { 'Content-Type': 'application/json', ...CORS },
          })
        }

        const { error: delErr } = await svc.from('social_accounts')
          .update({ is_active: false, access_token_enc: '', refresh_token_enc: null })
          .eq('id', payload.account_id)
          .eq('user_id', user.id)

        if (delErr) throw delErr

        logAudit(svc, {
          actorId: user.id,
          eventType: 'social.disconnected',
          action: `social-auth.disconnect`,
          source: 'social-auth',
          status: 'success',
          statusCode: 200,
          metadata: { account_id: payload.account_id },
          ip: getClientIP(req),
          userAgent: getUA(req),
        })

        result = { disconnected: true }
        break
      }

      case 'list_accounts': {
        const { data: accounts } = await svc.from('social_accounts')
          .select('id, platform, platform_username, platform_display_name, platform_avatar_url, is_active, connected_at, last_used_at')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .order('connected_at', { ascending: false })

        result = { accounts: accounts || [] }
        break
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${payload.action}` }), {
          status: 400, headers: { 'Content-Type': 'application/json', ...CORS },
        })
    }

    return new Response(JSON.stringify({ ok: true, ...result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS },
    })

  } catch (error) {
    console.error('social-auth error:', error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(req), ...SECURITY_HEADERS },
    })
  }
})
