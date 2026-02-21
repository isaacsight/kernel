// Supabase Edge Function: send-notification
// Unified notification sender — in_app (writes to notifications table),
// email (Resend), discord (webhook).
//
// Deploy: npx supabase functions deploy send-notification --project-ref eoxxpyixdieprsxlpwcs

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    // ── Auth: require service role key (internal-only function) ──
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!token || !serviceKey || token !== serviceKey) {
      return new Response(JSON.stringify({ error: 'Unauthorized: service key required' }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const { channel, user_id, title, body, type } = await req.json()

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

    // Always create in-app notification
    await supabase.from('notifications').insert({
      user_id,
      title,
      body: body || '',
      type: type || 'info',
    })

    // Channel-specific delivery
    if (channel === 'email') {
      const resendKey = Deno.env.get('RESEND_API_KEY')
      if (resendKey) {
        // Look up user email
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
    } else if (channel === 'discord') {
      const webhookUrl = Deno.env.get('DISCORD_WEBHOOK_URL')
      if (webhookUrl) {
        const discordRes = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: `**${title}**\n${body || ''}`,
          }),
        })
        if (!discordRes.ok) {
          console.error(`Discord webhook failed (${discordRes.status})`)
        }
      }
    }

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
