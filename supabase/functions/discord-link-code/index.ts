// Discord Link Code — issue a one-time code that the user pastes into
// Discord's /link command to bind their Discord account to this Supabase
// user. Closes the link-hijack hole identified in the discord review.
//
// Deploy: npx supabase functions deploy discord-link-code --project-ref eoxxpyixdieprsxlpwcs
// Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handlePreflight, SECURITY_HEADERS } from '../_shared/cors.ts'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { logAudit, getClientIP, getUA } from '../_shared/audit.ts'

const TOKEN_TTL_MINUTES = 15
const TOKEN_LENGTH = 8
// Crockford base32 minus ambiguous chars (0/O, 1/I/L) — readable + easy
// to type into Discord on a phone keyboard.
const TOKEN_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'

function generateToken(): string {
  const bytes = new Uint8Array(TOKEN_LENGTH)
  crypto.getRandomValues(bytes)
  let out = ''
  for (const b of bytes) out += TOKEN_ALPHABET[b % TOKEN_ALPHABET.length]
  return out
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handlePreflight(req)

  const CORS_HEADERS = { ...corsHeaders(req), ...SECURITY_HEADERS }

  try {
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

    const rl = await checkRateLimit(svc, user.id, 'discord-link-code', 'paid')
    if (!rl.allowed) return rateLimitResponse(rl, CORS_HEADERS)

    // Drop any existing tokens for this user so a fresh request supersedes
    // a stale one. Avoids accumulating unused tokens if the user clicks
    // the button multiple times.
    await svc.from('discord_link_tokens').delete().eq('user_id', user.id)

    // Retry on the astronomical chance of a token collision.
    let code = ''
    let attempt = 0
    while (attempt++ < 5) {
      code = generateToken()
      const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60_000).toISOString()
      const { error: insertErr } = await svc.from('discord_link_tokens').insert({
        token: code,
        user_id: user.id,
        expires_at: expiresAt,
      })
      if (!insertErr) break
      if (attempt === 5) {
        console.error('[discord-link-code] insert failed after retries:', insertErr)
        return new Response(JSON.stringify({ error: 'Failed to generate code' }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        })
      }
    }

    await logAudit(svc, {
      actorId: user.id, eventType: 'user.action', action: 'discord.link-code.generate',
      source: 'discord-link-code', status: 'success', statusCode: 200,
      metadata: { ttl_minutes: TOKEN_TTL_MINUTES },
      ip: getClientIP(req), userAgent: getUA(req),
    })

    return new Response(JSON.stringify({
      code,
      expires_in_seconds: TOKEN_TTL_MINUTES * 60,
    }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } })

  } catch (err: any) {
    console.error('[discord-link-code] error:', err)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    })
  }
})
