// API Key Management — create, list, rotate, revoke API keys
//
// Deploy: npx supabase functions deploy api-keys --project-ref eoxxpyixdieprsxlpwcs
// Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handlePreflight, SECURITY_HEADERS } from '../_shared/cors.ts'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { logAudit, getClientIP, getUA } from '../_shared/audit.ts'
import { requireContentType, requireJsonBody } from '../_shared/validate.ts'

const MAX_ACTIVE_KEYS = 5

/** Generate a kn_live_ prefixed API key: 48 chars of hex after prefix */
function generateApiKey(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
  return `kn_live_${hex}`
}

/** SHA-256 hash a key string, return hex digest */
async function hashKey(key: string): Promise<string> {
  const encoded = new TextEncoder().encode(key)
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
}

/** Tier defaults for new keys — limits are now inherited from user's subscription
 *  via validate_api_key() RPC. These defaults only apply to token budget (per-key safety net). */
const TIER_DEFAULTS: Record<string, { monthly_message_limit: number; rate_limit_per_min: number; swarm_enabled: boolean; all_agents_enabled: boolean; streaming_enabled: boolean; monthly_token_budget: number; overage_enabled: boolean; overage_rate_millicents: number }> = {
  free:       { monthly_message_limit: 30,     rate_limit_per_min: 10,  swarm_enabled: false, all_agents_enabled: false, streaming_enabled: false, monthly_token_budget: 100000,    overage_enabled: false, overage_rate_millicents: 0 },
  pro:        { monthly_message_limit: 1000,   rate_limit_per_min: 60,  swarm_enabled: true,  all_agents_enabled: true,  streaming_enabled: true,  monthly_token_budget: 3000000,   overage_enabled: true,  overage_rate_millicents: 50 },
  max:        { monthly_message_limit: 6000,   rate_limit_per_min: 180, swarm_enabled: true,  all_agents_enabled: true,  streaming_enabled: true,  monthly_token_budget: 25000000,  overage_enabled: true,  overage_rate_millicents: 40 },
  enterprise: { monthly_message_limit: 999999, rate_limit_per_min: 180, swarm_enabled: true,  all_agents_enabled: true,  streaming_enabled: true,  monthly_token_budget: 999999999, overage_enabled: false, overage_rate_millicents: 0 },
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handlePreflight(req)

  const CORS_HEADERS = { ...corsHeaders(req), ...SECURITY_HEADERS }

  const ctErr = requireContentType(req)
  if (ctErr) return ctErr(CORS_HEADERS)

  try {
    // ── JWT Auth (users manage their own keys) ──
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      })
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      })
    }

    const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // ── Rate limit ──
    const rl = await checkRateLimit(svc, user.id, 'api-keys', 'paid')
    if (!rl.allowed) return rateLimitResponse(rl, CORS_HEADERS)

    // ── Parse body ──
    const { body, error: bodyErr } = await requireJsonBody<{ action: string; key_id?: string; name?: string; tier?: string; max_monthly_spend_cents?: number | null }>(req, 4096)
    if (bodyErr) return bodyErr(CORS_HEADERS)

    const { action, key_id, name, tier, max_monthly_spend_cents } = body as { action: string; key_id?: string; name?: string; tier?: string; max_monthly_spend_cents?: number | null }

    // ── Action router ──
    switch (action) {
      case 'create': {
        // Check active key count
        const { count } = await svc
          .from('api_keys')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('status', 'active')
        if ((count ?? 0) >= MAX_ACTIVE_KEYS) {
          return new Response(JSON.stringify({ error: `Maximum ${MAX_ACTIVE_KEYS} active keys allowed` }), {
            status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
          })
        }

        const keyTier = (tier && tier in TIER_DEFAULTS) ? tier : 'free'
        const defaults = TIER_DEFAULTS[keyTier]
        const fullKey = generateApiKey()
        const keyHash = await hashKey(fullKey)
        const keyPrefix = fullKey.substring(0, 20)

        const { data: created, error: insertErr } = await svc
          .from('api_keys')
          .insert({
            user_id: user.id,
            name: name || 'Default',
            key_prefix: keyPrefix,
            key_hash: keyHash,
            tier: keyTier,
            ...defaults,
          })
          .select()
          .single()

        if (insertErr) {
          console.error('[api-keys] create error:', insertErr)
          return new Response(JSON.stringify({ error: 'Failed to create API key' }), {
            status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
          })
        }

        await logAudit(svc, {
          actorId: user.id, eventType: 'user.action', action: 'api-key.create',
          source: 'api-keys', status: 'success', statusCode: 200,
          metadata: { key_id: created.id, tier: keyTier },
          ip: getClientIP(req), userAgent: getUA(req),
        })

        return new Response(JSON.stringify({
          key: fullKey, // Only returned once!
          id: created.id,
          name: created.name,
          prefix: keyPrefix,
          tier: keyTier,
          created_at: created.created_at,
        }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } })
      }

      case 'list': {
        const { data: keys, error: listErr } = await svc
          .from('api_keys')
          .select('id, name, key_prefix, tier, status, monthly_message_limit, rate_limit_per_min, swarm_enabled, all_agents_enabled, streaming_enabled, monthly_message_count, monthly_window_start, overage_enabled, overage_rate_millicents, overage_count, max_monthly_spend_cents, last_used_at, revoked_at, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        if (listErr) {
          return new Response(JSON.stringify({ error: 'Failed to list keys' }), {
            status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
          })
        }

        return new Response(JSON.stringify({ keys: keys || [] }), {
          status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        })
      }

      case 'rotate': {
        if (!key_id) {
          return new Response(JSON.stringify({ error: 'key_id is required' }), {
            status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
          })
        }

        // Verify ownership and get old key metadata
        const { data: oldKey } = await svc
          .from('api_keys')
          .select('*')
          .eq('id', key_id)
          .eq('user_id', user.id)
          .eq('status', 'active')
          .single()

        if (!oldKey) {
          return new Response(JSON.stringify({ error: 'Key not found or already revoked' }), {
            status: 404, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
          })
        }

        // Generate new key
        const fullKey = generateApiKey()
        const keyHash = await hashKey(fullKey)
        const keyPrefix = fullKey.substring(0, 20)

        // Revoke old, create new — atomically-ish
        await svc.from('api_keys').update({ status: 'revoked', revoked_at: new Date().toISOString() }).eq('id', key_id)

        const { data: newKey, error: rotateErr } = await svc
          .from('api_keys')
          .insert({
            user_id: user.id,
            name: oldKey.name,
            key_prefix: keyPrefix,
            key_hash: keyHash,
            tier: oldKey.tier,
            monthly_message_limit: oldKey.monthly_message_limit,
            rate_limit_per_min: oldKey.rate_limit_per_min,
            swarm_enabled: oldKey.swarm_enabled,
            all_agents_enabled: oldKey.all_agents_enabled,
            streaming_enabled: oldKey.streaming_enabled,
            overage_enabled: oldKey.overage_enabled,
            overage_rate_millicents: oldKey.overage_rate_millicents,
            max_monthly_spend_cents: oldKey.max_monthly_spend_cents,
            stripe_subscription_id: oldKey.stripe_subscription_id,
            stripe_item_id: oldKey.stripe_item_id,
          })
          .select()
          .single()

        if (rotateErr) {
          return new Response(JSON.stringify({ error: 'Failed to rotate key' }), {
            status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
          })
        }

        await logAudit(svc, {
          actorId: user.id, eventType: 'user.action', action: 'api-key.rotate',
          source: 'api-keys', status: 'success', statusCode: 200,
          metadata: { old_key_id: key_id, new_key_id: newKey.id },
          ip: getClientIP(req), userAgent: getUA(req),
        })

        return new Response(JSON.stringify({
          key: fullKey,
          id: newKey.id,
          name: newKey.name,
          prefix: keyPrefix,
          tier: newKey.tier,
          old_key_id: key_id,
        }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } })
      }

      case 'revoke': {
        if (!key_id) {
          return new Response(JSON.stringify({ error: 'key_id is required' }), {
            status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
          })
        }

        // Verify the key exists, belongs to user, and is active
        const { data: keyToRevoke } = await svc
          .from('api_keys')
          .select('id')
          .eq('id', key_id)
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle()

        if (!keyToRevoke) {
          return new Response(JSON.stringify({ error: 'Key not found or already revoked' }), {
            status: 404, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
          })
        }

        const { error: revokeErr } = await svc
          .from('api_keys')
          .update({ status: 'revoked', revoked_at: new Date().toISOString() })
          .eq('id', key_id)

        if (revokeErr) {
          return new Response(JSON.stringify({ error: 'Failed to revoke key' }), {
            status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
          })
        }

        await logAudit(svc, {
          actorId: user.id, eventType: 'user.action', action: 'api-key.revoke',
          source: 'api-keys', status: 'success', statusCode: 200,
          metadata: { key_id },
          ip: getClientIP(req), userAgent: getUA(req),
        })

        return new Response(JSON.stringify({ success: true, key_id }), {
          status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        })
      }

      case 'set-ceiling': {
        if (!key_id) {
          return new Response(JSON.stringify({ error: 'key_id is required' }), {
            status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
          })
        }

        // Validate ceiling value — null removes ceiling, otherwise must be positive integer
        if (max_monthly_spend_cents !== undefined && max_monthly_spend_cents !== null) {
          if (!Number.isInteger(max_monthly_spend_cents) || max_monthly_spend_cents < 0) {
            return new Response(JSON.stringify({ error: 'max_monthly_spend_cents must be a non-negative integer or null' }), {
              status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
            })
          }
        }

        // Verify ownership and that overage is enabled
        const { data: ceilKey } = await svc
          .from('api_keys')
          .select('id, overage_enabled')
          .eq('id', key_id)
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle()

        if (!ceilKey) {
          return new Response(JSON.stringify({ error: 'Key not found or not active' }), {
            status: 404, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
          })
        }

        if (!ceilKey.overage_enabled) {
          return new Response(JSON.stringify({ error: 'Spending ceiling requires overage billing (Pro or Growth tier)' }), {
            status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
          })
        }

        const ceilingValue = max_monthly_spend_cents === undefined ? null : max_monthly_spend_cents
        const { error: ceilErr } = await svc
          .from('api_keys')
          .update({ max_monthly_spend_cents: ceilingValue })
          .eq('id', key_id)

        if (ceilErr) {
          return new Response(JSON.stringify({ error: 'Failed to set spending ceiling' }), {
            status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
          })
        }

        await logAudit(svc, {
          actorId: user.id, eventType: 'user.action', action: 'api-key.set-ceiling',
          source: 'api-keys', status: 'success', statusCode: 200,
          metadata: { key_id, max_monthly_spend_cents: ceilingValue },
          ip: getClientIP(req), userAgent: getUA(req),
        })

        return new Response(JSON.stringify({
          success: true,
          key_id,
          max_monthly_spend_cents: ceilingValue,
        }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } })
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        })
    }
  } catch (err) {
    console.error('[api-keys]', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    })
  }
})
