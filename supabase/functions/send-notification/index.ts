// Supabase Edge Function: send-notification
// Unified notification sender — in_app (writes to notifications table),
// email (Resend), discord (webhook), push (Web Push API).
//
// Deploy: npx supabase functions deploy send-notification --project-ref eoxxpyixdieprsxlpwcs --no-verify-jwt

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { logAudit, getClientIP, getUA } from '../_shared/audit.ts'
import { requireContentType } from '../_shared/validate.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── Web Push Crypto (RFC 8291 — aes128gcm) ───

function b64url2bytes(s: string): Uint8Array {
  const b = s.replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b + '='.repeat((4 - b.length % 4) % 4))
  return Uint8Array.from(raw, c => c.charCodeAt(0))
}

function bytes2b64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function concat(...arrs: Uint8Array[]): Uint8Array {
  const len = arrs.reduce((n, a) => n + a.length, 0)
  const out = new Uint8Array(len)
  let off = 0
  for (const a of arrs) { out.set(a, off); off += a.length }
  return out
}

async function hkdfSha256(ikm: Uint8Array, salt: Uint8Array, info: Uint8Array, len: number): Promise<Uint8Array> {
  // Extract
  const extractKey = await crypto.subtle.importKey('raw', salt.length ? salt : new Uint8Array(32), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const prk = new Uint8Array(await crypto.subtle.sign('HMAC', extractKey, ikm))
  // Expand (single block — works for len <= 32)
  const expandKey = await crypto.subtle.importKey('raw', prk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const okm = new Uint8Array(await crypto.subtle.sign('HMAC', expandKey, concat(info, new Uint8Array([1]))))
  return okm.slice(0, len)
}

async function createVapidAuth(
  endpoint: string,
  vapidPub: string,
  vapidPriv: string
): Promise<string> {
  const url = new URL(endpoint)
  const aud = `${url.protocol}//${url.host}`
  const pubBytes = b64url2bytes(vapidPub)

  const key = await crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', x: bytes2b64url(pubBytes.slice(1, 33)), y: bytes2b64url(pubBytes.slice(33, 65)), d: vapidPriv },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  )

  const enc = new TextEncoder()
  const header = bytes2b64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const payload = bytes2b64url(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 43200, sub: 'mailto:noreply@kernel.chat' })))
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${header}.${payload}`)))

  return `vapid t=${header}.${payload}.${bytes2b64url(sig)}, k=${vapidPub}`
}

async function encryptPushPayload(
  sub: { keys: { p256dh: string; auth: string } },
  data: Uint8Array
): Promise<{ body: Uint8Array; encoding: string }> {
  const clientPub = b64url2bytes(sub.keys.p256dh)
  const authSecret = b64url2bytes(sub.keys.auth)

  // Ephemeral ECDH key pair
  const ephemeral = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const ephPubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', ephemeral.publicKey))

  // ECDH shared secret
  const clientKey = await crypto.subtle.importKey('raw', clientPub, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: clientKey }, ephemeral.privateKey, 256))

  const enc = new TextEncoder()
  // IKM
  const ikm = await hkdfSha256(shared, authSecret, concat(enc.encode('WebPush: info\0'), clientPub, ephPubRaw), 32)
  // Salt, CEK, Nonce
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const cek = await hkdfSha256(ikm, salt, enc.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdfSha256(ikm, salt, enc.encode('Content-Encoding: nonce\0'), 12)

  // Encrypt (payload + 0x02 delimiter)
  const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt'])
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, concat(data, new Uint8Array([2]))))

  // aes128gcm body: salt(16) | rs(4) | idlen(1) | keyid(65) | ciphertext
  const rs = new Uint8Array(4)
  new DataView(rs.buffer).setUint32(0, 4096, false)
  return { body: concat(salt, rs, new Uint8Array([65]), ephPubRaw, encrypted), encoding: 'aes128gcm' }
}

async function sendWebPush(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: object
): Promise<{ ok: boolean; status?: number }> {
  const vapidPub = Deno.env.get('VAPID_PUBLIC_KEY')
  const vapidPriv = Deno.env.get('VAPID_PRIVATE_KEY')
  if (!vapidPub || !vapidPriv) return { ok: false, status: 0 }

  const auth = await createVapidAuth(subscription.endpoint, vapidPub, vapidPriv)
  const { body, encoding } = await encryptPushPayload(subscription, new TextEncoder().encode(JSON.stringify(payload)))

  const res = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      Authorization: auth,
      'Content-Encoding': encoding,
      'Content-Type': 'application/octet-stream',
      TTL: '86400',
      Urgency: 'normal',
    },
    body,
  })
  return { ok: res.status === 201, status: res.status }
}

// ─── Main handler ───

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    // ── Content-type check ──────────────────────────────
    const ctErr = requireContentType(req)
    if (ctErr) return ctErr(CORS_HEADERS)

    // ── Auth: require service role key (internal-only function) ──
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!token || !serviceKey || token !== serviceKey) {
      return new Response(JSON.stringify({ error: 'Unauthorized: service key required' }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const { channel, user_id, title, body, type, url: actionUrl } = await req.json()

    if (!channel || !user_id || !title) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const channels = channel === 'all' ? ['in_app', 'email', 'push'] : [channel]

    // Always create in-app notification
    await supabase.from('notifications').insert({
      user_id,
      title,
      body: body || '',
      type: type || 'info',
      action_url: actionUrl || null,
    })

    // Channel-specific delivery
    if (channels.includes('email')) {
      const resendKey = Deno.env.get('RESEND_API_KEY')
      if (resendKey) {
        const { data: userData } = await supabase.auth.admin.getUserById(user_id)
        if (userData?.user?.email) {
          const emailRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${resendKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'Kernel <noreply@kernel.chat>',
              to: userData.user.email,
              subject: title,
              text: body || title,
            }),
          })
          if (!emailRes.ok) {
            const errText = await emailRes.text().catch(() => 'unknown')
            console.error(`Resend email failed (${emailRes.status}):`, errText)
          }
        }
      }
    }

    if (channels.includes('discord')) {
      const webhookUrl = Deno.env.get('DISCORD_WEBHOOK_URL')
      if (webhookUrl) {
        const discordRes = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: `**${title}**\n${body || ''}` }),
        })
        if (!discordRes.ok) {
          console.error(`Discord webhook failed (${discordRes.status})`)
        }
      }
    }

    if (channels.includes('push')) {
      const { data: pushSub } = await supabase
        .from('push_subscriptions')
        .select('subscription')
        .eq('user_id', user_id)
        .single()

      if (pushSub?.subscription) {
        const pushPayload = { title, body: body || '', url: actionUrl || '/', icon: '/logo-mark-192.png' }
        const result = await sendWebPush(pushSub.subscription, pushPayload)
        if (!result.ok) {
          console.error(`Web push failed (${result.status}) for user ${user_id}`)
          // If subscription expired (410/404), clean it up
          if (result.status === 410 || result.status === 404) {
            await supabase.from('push_subscriptions').delete().eq('user_id', user_id)
          }
        }
      }
    }

    // Audit log
    logAudit(supabase, {
      actorId: user_id, actorType: 'service', eventType: 'system.notification',
      action: `send-notification:${channel}`,
      source: 'send-notification', status: 'success', statusCode: 200,
      metadata: { channel, type },
      ip: getClientIP(req), userAgent: getUA(req),
    })

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Notification error:', err)
    return new Response(JSON.stringify({ error: 'Failed to send notification' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
})
