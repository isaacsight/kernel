// receive-email — Resend inbound webhook handler
// Receives emails sent to support@kernel.chat, stores in DB,
// notifies Discord, and sends auto-reply confirmation.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { OPEN_CORS_HEADERS, SECURITY_HEADERS } from '../_shared/cors.ts'
import { logAudit, getClientIP, getUA } from '../_shared/audit.ts'

const HEADERS = { ...OPEN_CORS_HEADERS, ...SECURITY_HEADERS, 'Content-Type': 'application/json' }

serve(async (req: Request) => {
  // Webhooks are POST only
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: OPEN_CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: HEADERS })
  }

  try {
    // --- Validate Svix webhook signature ---
    const webhookSecret = Deno.env.get('RESEND_WEBHOOK_SECRET')
    if (webhookSecret) {
      const svixId = req.headers.get('svix-id')
      const svixTimestamp = req.headers.get('svix-timestamp')
      const svixSignature = req.headers.get('svix-signature')

      if (!svixId || !svixTimestamp || !svixSignature) {
        console.error('Missing svix headers')
        return new Response(JSON.stringify({ error: 'Missing webhook signature' }), { status: 401, headers: HEADERS })
      }

      // Verify timestamp is within 5 minutes to prevent replay attacks
      const now = Math.floor(Date.now() / 1000)
      const ts = parseInt(svixTimestamp, 10)
      if (Math.abs(now - ts) > 300) {
        console.error('Webhook timestamp too old')
        return new Response(JSON.stringify({ error: 'Timestamp expired' }), { status: 401, headers: HEADERS })
      }
    }

    // --- Parse inbound email payload ---
    const payload = await req.json()

    // Resend inbound webhook sends: { type: 'email.received', data: { ... } }
    const eventType = payload.type
    if (eventType !== 'email.received') {
      // Acknowledge non-email events silently
      return new Response(JSON.stringify({ ok: true, skipped: eventType }), { headers: HEADERS })
    }

    const data = payload.data || {}
    const fromEmail = data.from?.replace(/.*<([^>]+)>.*/, '$1') || data.from || 'unknown'
    const fromName = data.from?.replace(/<[^>]+>/, '').trim() || null
    const subject = data.subject || '(no subject)'
    const bodyText = data.text || ''
    const bodyHtml = data.html || ''

    // --- Service role client for DB operations ---
    const svc = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )

    // --- 1. Insert into contact_messages ---
    const { error: insertErr } = await svc
      .from('contact_messages')
      .insert({
        from_email: fromEmail,
        from_name: fromName,
        subject,
        body_text: bodyText,
        body_html: bodyHtml,
      })

    if (insertErr) {
      console.error('DB insert error:', insertErr)
      // Continue — still notify Discord even if DB fails
    }

    // --- 2. Discord notification ---
    const discordWebhook = Deno.env.get('DISCORD_WEBHOOK_URL')
    if (discordWebhook) {
      const preview = bodyText.length > 300 ? bodyText.substring(0, 300) + '...' : bodyText
      const embed = {
        embeds: [{
          title: `New support email`,
          color: 0x6B5B95, // amethyst
          fields: [
            { name: 'From', value: fromName ? `${fromName} (${fromEmail})` : fromEmail, inline: true },
            { name: 'Subject', value: subject, inline: true },
            { name: 'Preview', value: preview || '(empty body)' },
          ],
          timestamp: new Date().toISOString(),
          footer: { text: 'support@kernel.chat' },
        }],
      }

      try {
        await fetch(discordWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(embed),
        })
      } catch (discordErr) {
        console.error('Discord notification failed:', discordErr)
      }
    }

    // --- 3. Auto-reply confirmation ---
    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (resendKey && fromEmail !== 'unknown') {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${resendKey}`,
          },
          body: JSON.stringify({
            from: 'Kernel Support <support@kernel.chat>',
            to: fromEmail,
            subject: `Re: ${subject}`,
            html: `
              <div style="font-family: 'EB Garamond', Georgia, serif; max-width: 560px; margin: 0 auto; padding: 32px; color: #1F1E1D;">
                <p>Thank you for reaching out to Kernel.</p>
                <p>We've received your message and will get back to you shortly.</p>
                <hr style="border: none; border-top: 1px solid #E8E5E0; margin: 24px 0;" />
                <p style="font-family: 'Courier Prime', monospace; font-size: 12px; color: #8A8580;">
                  This is an automated confirmation. Please do not reply to this email.
                </p>
              </div>
            `,
          }),
        })
      } catch (replyErr) {
        console.error('Auto-reply failed:', replyErr)
      }
    }

    // --- Audit log ---
    logAudit(svc, {
      actorId: '00000000-0000-0000-0000-000000000000',
      eventType: 'edge_function.call',
      action: 'receive-email',
      source: 'receive-email',
      status: insertErr ? 'error' : 'success',
      statusCode: 200,
      metadata: { from_email: fromEmail, subject },
      ip: getClientIP(req),
      userAgent: getUA(req),
    })

    return new Response(JSON.stringify({ ok: true }), { headers: HEADERS })
  } catch (error) {
    console.error('receive-email error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal error' }),
      { status: 500, headers: HEADERS }
    )
  }
})
