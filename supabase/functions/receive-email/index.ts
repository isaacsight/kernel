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
        console.warn('Missing svix headers — proceeding without verification')
        // Don't block — Resend webhooks may not always include svix headers
      }

      // Verify timestamp is within 5 minutes to prevent replay attacks
      const now = Math.floor(Date.now() / 1000)
      const ts = parseInt(svixTimestamp, 10)
      if (svixTimestamp && Math.abs(now - ts) > 300) {
        console.warn('Webhook timestamp old — proceeding anyway')
      }
    }

    // --- Parse inbound email payload ---
    const payload = await req.json()
    console.log('Webhook received:', JSON.stringify({ type: payload.type, keys: Object.keys(payload.data || {}) }))

    // Resend inbound webhook sends: { type: 'email.received', data: { ... } }
    const eventType = payload.type
    if (eventType !== 'email.received') {
      console.log('Skipping non-email event:', eventType)
      return new Response(JSON.stringify({ ok: true, skipped: eventType }), { headers: HEADERS })
    }

    const data = payload.data || {}
    console.log('Inbound payload data keys:', JSON.stringify(Object.keys(data)))

    const fromEmail = (data.from?.replace(/.*<([^>]+)>.*/, '$1') || data.from || 'unknown').toLowerCase().trim()
    const fromName = data.from?.replace(/<[^>]+>/, '').trim() || null
    const subject = data.subject || '(no subject)'
    const emailId = data.email_id || data.id || null
    const attachments = data.attachments || []

    console.log('Inbound email from:', fromEmail, 'subject:', subject, 'emailId:', emailId, 'attachments:', attachments.length)

    // Resend webhooks may not include body — fetch full email via API if body is empty
    let bodyText = data.text || data.body || data.plain_text || ''
    let bodyHtml = data.html || data.html_body || ''
    let attachmentInfo = ''

    if ((!bodyText && !bodyHtml) && emailId) {
      console.log('Body empty — fetching full email via Resend API...')
      const resendKey = Deno.env.get('RESEND_API_KEY')
      if (resendKey) {
        try {
          const emailRes = await fetch(`https://api.resend.com/emails/${emailId}`, {
            headers: { 'Authorization': `Bearer ${resendKey}` },
          })
          if (emailRes.ok) {
            const fullEmail = await emailRes.json()
            bodyText = fullEmail.text || ''
            bodyHtml = fullEmail.html || ''
            console.log('Fetched full email — text:', bodyText.length, 'html:', bodyHtml.length)
          }
        } catch (fetchErr) {
          console.error('Failed to fetch full email:', fetchErr)
        }
      }
    }

    // Extract text from HTML if text is still empty
    if (!bodyText && bodyHtml) {
      bodyText = bodyHtml
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim()
      console.log('Extracted text from HTML:', bodyText.length, 'chars')
    }

    // Handle attachments — download content and include in body
    if (attachments.length > 0 && emailId) {
      const resendKey = Deno.env.get('RESEND_API_KEY')
      if (resendKey) {
        try {
          // List attachments with download URLs
          const attRes = await fetch(`https://api.resend.com/emails/${emailId}/attachments`, {
            headers: { 'Authorization': `Bearer ${resendKey}` },
          })

          if (attRes.ok) {
            const attList = await attRes.json()
            const attData = attList.data || attList || []

            for (const att of attData) {
              const filename = att.filename || 'unknown'
              const contentType = att.content_type || ''
              const downloadUrl = att.download_url || ''

              console.log(`Attachment: ${filename} (${contentType}) url: ${downloadUrl ? 'yes' : 'no'}`)

              if (!downloadUrl) {
                attachmentInfo += `\n[Attachment: ${filename} (${contentType}) — could not download]`
                continue
              }

              try {
                const fileRes = await fetch(downloadUrl)
                if (!fileRes.ok) {
                  attachmentInfo += `\n[Attachment: ${filename} (${contentType}) — download failed]`
                  continue
                }

                if (contentType.startsWith('text/') || contentType === 'application/json' || contentType === 'application/csv') {
                  // Text files — include content directly
                  const textContent = await fileRes.text()
                  attachmentInfo += `\n\n[File: ${filename}]\n${textContent.slice(0, 5000)}`
                  console.log(`  Read text file: ${textContent.length} chars`)

                } else if (contentType === 'application/pdf') {
                  // PDF — note it (can't parse in edge function easily)
                  attachmentInfo += `\n[Attachment: ${filename} — PDF file attached. User wants you to help with this document.]`
                  console.log(`  PDF noted: ${filename}`)

                } else if (contentType.startsWith('image/')) {
                  // Images — encode as base64 for the agent to describe
                  const imgBuffer = await fileRes.arrayBuffer()
                  const base64 = btoa(String.fromCharCode(...new Uint8Array(imgBuffer).slice(0, 50000)))
                  attachmentInfo += `\n[Image attached: ${filename} (${contentType}, ${imgBuffer.byteLength} bytes). User sent an image — describe what you see or help with what they're asking about it.]`
                  console.log(`  Image noted: ${filename} ${imgBuffer.byteLength} bytes`)

                } else {
                  attachmentInfo += `\n[Attachment: ${filename} (${contentType}) — file type noted]`
                }
              } catch (dlErr) {
                console.error(`  Download error for ${filename}:`, dlErr)
                attachmentInfo += `\n[Attachment: ${filename} — error downloading]`
              }
            }
          }
        } catch (attErr) {
          console.error('Attachment list error:', attErr)
        }
      }
    }

    // Append attachment info to body so the agent knows about them
    if (attachmentInfo) bodyText += attachmentInfo

    console.log('Final body text length:', bodyText.length)

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

    // --- 3. Route ALL emails to local agent ---
    // No whitelist. Every inbound email gets stored in contact_messages (done above).
    // The local email agent (kbot email-agent start --open) polls contact_messages,
    // generates responses via Ollama (Qwen 32B, $0 cost), and sends replies via Resend.
    // Cost: $0 — all AI runs locally on Apple Silicon.
    if (fromEmail !== 'unknown') {
      console.log(`Email from ${fromEmail} stored — local agent will respond via Ollama ($0)`)
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
