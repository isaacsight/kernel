// Supabase Edge Function: identity-recovery
//
// Identity Governance Engine — progressive trust recovery for credential changes.
// All recovery flows transition through: INITIATED → CHALLENGED → VERIFIED → EXECUTED
//
// Endpoints (via `action` field):
//   initiate    — Start a recovery request (password_reset, email_change, username_change)
//   challenge   — Send verification challenge (email code)
//   verify      — Validate challenge response (token)
//   execute     — Commit the credential change
//   status      — Get recovery request status
//   audit       — Get identity event history
//   devices     — List user's known devices
//
// Deploy: npx supabase functions deploy identity-recovery --project-ref eoxxpyixdieprsxlpwcs --no-verify-jwt

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handlePreflight, SECURITY_HEADERS } from '../_shared/cors.ts'
import { logAudit, getClientIP, getUA } from '../_shared/audit.ts'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { requireContentType, requireJsonBody } from '../_shared/validate.ts'

// ─── Constants ───────────────────────────────────────
const VALID_ACTIONS = ['initiate', 'challenge', 'verify', 'execute', 'status', 'audit', 'devices'] as const
const VALID_REQUEST_TYPES = ['password_reset', 'email_change', 'username_change'] as const

type Action = typeof VALID_ACTIONS[number]
type RequestType = typeof VALID_REQUEST_TYPES[number]

// ─── Token Generation ────────────────────────────────
// Generates a cryptographically secure 6-digit code and its SHA-256 hash.
// The raw code is sent to the user; only the hash is stored.
async function generateChallengeToken(): Promise<{ raw: string; hash: string }> {
  const array = new Uint8Array(4)
  crypto.getRandomValues(array)
  const raw = String(((array[0] << 16) | (array[1] << 8) | array[2]) % 1000000).padStart(6, '0')
  const hash = await sha256(raw)
  return { raw, hash }
}

async function sha256(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// ─── Geo lookup (lightweight, IP-based) ──────────────
// Uses Deno's request headers for Cloudflare/Supabase geo data.
function extractGeo(req: Request): { country: string | null; region: string | null } {
  return {
    country: req.headers.get('cf-ipcountry') || req.headers.get('x-country-code') || null,
    region: req.headers.get('cf-region') || req.headers.get('x-region') || null,
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handlePreflight(req)

  const CORS = { ...corsHeaders(req), ...SECURITY_HEADERS }
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json', ...CORS },
    })

  try {
    // ── Content-type ──────────────────────────────────
    const ctErr = requireContentType(req)
    if (ctErr) return ctErr(CORS)

    // ── Auth ──────────────────────────────────────────
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return json({ error: 'Missing authorization' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(supabaseUrl, anonKey)
    const { data: { user }, error: authErr } = await userClient.auth.getUser(token)
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // ── Rate limit ────────────────────────────────────
    const rl = await checkRateLimit(admin, user.id, 'identity-recovery', 'free')
    if (!rl.allowed) return rateLimitResponse(rl, CORS)

    // ── Parse body ────────────────────────────────────
    const { body, error: bodyErr } = await requireJsonBody<{
      action: string
      request_type?: string
      request_id?: string
      token?: string      // raw challenge code
      new_value?: string   // new email or username
      device_id?: string
      device_name?: string
      limit?: number
      offset?: number
    }>(req)
    if (bodyErr) return bodyErr(CORS)

    const action = body.action as Action
    if (!VALID_ACTIONS.includes(action)) {
      return json({ error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(', ')}` }, 400)
    }

    const ip = getClientIP(req)
    const ua = getUA(req)
    const geo = extractGeo(req)
    const ipInet = ip || null

    // ══════════════════════════════════════════════════
    // ACTION: initiate
    // Start a new recovery request with risk scoring.
    // Never reveals whether account exists (returns same shape regardless).
    // ══════════════════════════════════════════════════
    if (action === 'initiate') {
      const requestType = body.request_type as RequestType
      if (!requestType || !VALID_REQUEST_TYPES.includes(requestType)) {
        return json({ error: 'Invalid request_type' }, 400)
      }

      // For email_change and username_change, new_value is required
      if ((requestType === 'email_change' || requestType === 'username_change') && !body.new_value?.trim()) {
        return json({ error: 'new_value is required' }, 400)
      }

      const oldValue = requestType === 'email_change'
        ? user.email || null
        : requestType === 'username_change'
          ? user.user_metadata?.username || null
          : null

      const { data, error } = await admin.rpc('create_recovery_request', {
        p_user_id: user.id,
        p_request_type: requestType,
        p_ip_address: ipInet,
        p_user_agent: ua,
        p_device_id: body.device_id || null,
        p_geo_country: geo.country,
        p_geo_region: geo.region,
        p_old_value: oldValue,
        p_new_value: body.new_value?.trim() || null,
      })

      if (error) {
        console.error('[identity-recovery] create_recovery_request error:', error)
        return json({ error: 'Failed to initiate recovery' }, 500)
      }

      return json({
        request_id: data.request_id,
        trust_tier: data.trust_tier,
        expires_at: data.expires_at,
        max_attempts: data.max_attempts,
      })
    }

    // ══════════════════════════════════════════════════
    // ACTION: challenge
    // Generate and send a verification code to the user's email.
    // ══════════════════════════════════════════════════
    if (action === 'challenge') {
      if (!body.request_id) return json({ error: 'request_id required' }, 400)

      // Verify the request belongs to this user and is in 'initiated' state
      const { data: reqData, error: reqErr } = await admin
        .from('recovery_requests')
        .select('id, user_id, state, request_type, trust_tier')
        .eq('id', body.request_id)
        .single()

      if (reqErr || !reqData) return json({ error: 'Request not found' }, 404)
      if (reqData.user_id !== user.id) return json({ error: 'Unauthorized' }, 403)
      if (reqData.state !== 'initiated') return json({ error: 'Request already challenged or completed' }, 409)

      // Generate one-time code
      const { raw, hash } = await generateChallengeToken()

      // Record challenge in DB (hashed)
      const { data: recorded, error: recErr } = await admin.rpc('record_challenge_sent', {
        p_request_id: body.request_id,
        p_method: 'email_code',
        p_token_hash: hash,
      })

      if (recErr || !recorded) {
        console.error('[identity-recovery] record_challenge error:', recErr)
        return json({ error: 'Failed to create challenge' }, 500)
      }

      // Send the code via email (using Supabase Auth's email infrastructure)
      // For now, we use the user's email and the send-notification function
      try {
        const emailBody = `Your Kernel verification code is: ${raw}\n\nThis code expires in 15 minutes. If you didn't request this, ignore this message.`

        await fetch(`${supabaseUrl}/functions/v1/send-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${serviceKey}`,
            apikey: anonKey,
          },
          body: JSON.stringify({
            channel: 'all',
            user_id: user.id,
            title: 'Kernel — Verification Code',
            body: emailBody,
            type: 'identity_verification',
          }),
        })
      } catch (emailErr) {
        console.warn('[identity-recovery] notification send failed (non-blocking):', emailErr)
      }

      logAudit(admin, {
        actorId: user.id,
        eventType: 'user.action',
        action: 'identity-recovery.challenge',
        source: 'identity-recovery',
        status: 'success',
        statusCode: 200,
        metadata: { request_id: body.request_id, method: 'email_code' },
        ip, userAgent: ua,
      })

      return json({
        challenged: true,
        method: 'email_code',
        trust_tier: reqData.trust_tier,
      })
    }

    // ══════════════════════════════════════════════════
    // ACTION: verify
    // Validate the challenge code against the stored hash.
    // ══════════════════════════════════════════════════
    if (action === 'verify') {
      if (!body.request_id) return json({ error: 'request_id required' }, 400)
      if (!body.token) return json({ error: 'token required' }, 400)

      // Hash the submitted code to compare
      const submittedHash = await sha256(body.token.trim())

      const { data, error } = await admin.rpc('verify_challenge', {
        p_request_id: body.request_id,
        p_token_hash: submittedHash,
        p_ip_address: ipInet,
      })

      if (error) {
        console.error('[identity-recovery] verify_challenge error:', error)
        return json({ error: 'Verification failed' }, 500)
      }

      if (!data.success) {
        const statusCode = data.error === 'expired' ? 410
          : data.error === 'max_attempts' ? 429
          : 400
        return json({ error: data.error, verified: false }, statusCode)
      }

      return json({ verified: true })
    }

    // ══════════════════════════════════════════════════
    // ACTION: execute
    // Commit the credential change. The actual mutation happens here.
    // All sessions are invalidated after credential change.
    // ══════════════════════════════════════════════════
    if (action === 'execute') {
      if (!body.request_id) return json({ error: 'request_id required' }, 400)

      // Fetch request details
      const { data: reqData, error: reqErr } = await admin
        .from('recovery_requests')
        .select('*')
        .eq('id', body.request_id)
        .single()

      if (reqErr || !reqData) return json({ error: 'Request not found' }, 404)
      if (reqData.user_id !== user.id) return json({ error: 'Unauthorized' }, 403)
      if (reqData.state !== 'verified') return json({ error: 'Request not verified' }, 409)

      // Execute the credential change via Supabase Admin API
      let executionError: string | null = null

      switch (reqData.request_type) {
        case 'password_reset': {
          // Password is submitted fresh during execution (not stored in request)
          if (!body.new_value || body.new_value.length < 8) {
            return json({ error: 'Password must be at least 8 characters' }, 400)
          }
          const { error } = await admin.auth.admin.updateUser(user.id, {
            password: body.new_value,
          })
          if (error) executionError = error.message
          break
        }
        case 'email_change': {
          const newEmail = reqData.new_value
          if (!newEmail) {
            return json({ error: 'No new email specified in request' }, 400)
          }
          const { error } = await admin.auth.admin.updateUser(user.id, {
            email: newEmail,
            email_confirm: true,
          })
          if (error) executionError = error.message
          break
        }
        case 'username_change': {
          const newUsername = reqData.new_value
          if (!newUsername) {
            return json({ error: 'No new username specified in request' }, 400)
          }
          // Check uniqueness via user_profiles table (fail closed — block on RPC error)
          const { data: available, error: checkErr } = await admin.rpc('check_name_available', {
            p_field: 'username',
            p_value: newUsername,
          })
          if (checkErr) {
            console.error('[identity-recovery] check_name_available error:', checkErr)
            return json({ error: 'Unable to verify username availability. Please try again.' }, 503)
          }
          if (available === false) {
            return json({ error: 'username_taken' }, 409)
          }
          // Update auth metadata
          const { error: usernameErr } = await admin.auth.admin.updateUser(user.id, {
            user_metadata: {
              ...user.user_metadata,
              username: newUsername,
            },
          })
          if (usernameErr) {
            executionError = usernameErr.message
            break
          }
          // Sync user_profiles table
          const { error: syncErr } = await admin
            .from('user_profiles')
            .upsert({
              user_id: user.id,
              username: newUsername.trim(),
              updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id' })
          if (syncErr) {
            console.warn('[identity-recovery] user_profiles sync error:', syncErr)
          }
          break
        }
      }

      if (executionError) {
        logAudit(admin, {
          actorId: user.id,
          eventType: 'user.action',
          action: `identity-recovery.execute.failed`,
          source: 'identity-recovery',
          status: 'error',
          statusCode: 500,
          metadata: { request_id: body.request_id, error: executionError },
          ip, userAgent: ua,
        })
        return json({ error: executionError }, 500)
      }

      // Mark request as executed
      const { data: execResult, error: execErr } = await admin.rpc('execute_recovery', {
        p_request_id: body.request_id,
        p_ip_address: ipInet,
      })

      if (execErr || !execResult?.success) {
        console.error('[identity-recovery] execute_recovery error:', execErr || execResult?.error)
      }

      // Invalidate all other sessions (Supabase handles via admin API)
      // The current session remains valid; user must re-authenticate on other devices.
      // Note: Supabase doesn't expose a "sign out all sessions" admin API directly,
      // but changing password/email inherently invalidates refresh tokens.

      // Log session invalidation event
      await admin.rpc('touch_device', {
        p_user_id: user.id,
        p_device_id: body.device_id || 'unknown',
        p_device_name: body.device_name || ua?.substring(0, 100) || null,
        p_ip_address: ipInet,
        p_country: geo.country,
      }).catch(() => {})

      logAudit(admin, {
        actorId: user.id,
        eventType: 'user.action',
        action: `identity-recovery.execute.${reqData.request_type}`,
        source: 'identity-recovery',
        status: 'success',
        statusCode: 200,
        metadata: {
          request_id: body.request_id,
          request_type: reqData.request_type,
          trust_tier: reqData.trust_tier,
          risk_score: reqData.risk_score,
        },
        ip, userAgent: ua,
      })

      return json({
        executed: true,
        request_type: reqData.request_type,
        trust_tier: reqData.trust_tier,
      })
    }

    // ══════════════════════════════════════════════════
    // ACTION: status
    // Get the current state of a recovery request.
    // ══════════════════════════════════════════════════
    if (action === 'status') {
      if (!body.request_id) return json({ error: 'request_id required' }, 400)

      const { data, error } = await admin
        .from('recovery_requests')
        .select('id, request_type, state, trust_tier, risk_score, challenge_method, challenge_attempts, max_challenge_attempts, expires_at, created_at, executed_at')
        .eq('id', body.request_id)
        .eq('user_id', user.id)
        .single()

      if (error || !data) return json({ error: 'Request not found' }, 404)

      return json(data)
    }

    // ══════════════════════════════════════════════════
    // ACTION: audit
    // Get identity event history for the current user.
    // ══════════════════════════════════════════════════
    if (action === 'audit') {
      const { data, error } = await admin.rpc('get_identity_events', {
        p_user_id: user.id,
        p_limit: Math.min(body.limit || 50, 100),
        p_offset: body.offset || 0,
      })

      if (error) {
        console.error('[identity-recovery] get_identity_events error:', error)
        return json({ error: 'Failed to fetch audit trail' }, 500)
      }

      return json(data)
    }

    // ══════════════════════════════════════════════════
    // ACTION: devices
    // List user's known device fingerprints.
    // ══════════════════════════════════════════════════
    if (action === 'devices') {
      const { data, error } = await admin
        .from('device_fingerprints')
        .select('id, device_id, device_name, first_seen_at, last_seen_at, last_ip, last_country, is_trusted, seen_count')
        .eq('user_id', user.id)
        .order('last_seen_at', { ascending: false })
        .limit(20)

      if (error) {
        console.error('[identity-recovery] devices error:', error)
        return json({ error: 'Failed to fetch devices' }, 500)
      }

      return json({ devices: data })
    }

    return json({ error: 'Unhandled action' }, 400)
  } catch (err) {
    console.error('[identity-recovery] unhandled error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})
