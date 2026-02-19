// Supabase Edge Function: send-announcement
// Sends a styled email to all registered users via Resend.
// Requires RESEND_API_KEY and SUPABASE_SERVICE_ROLE_KEY.
//
// Deploy: npx supabase functions deploy send-announcement --project-ref eoxxpyixdieprsxlpwcs

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
    const { subject, html } = await req.json()

    if (!subject || !html) {
      return new Response(JSON.stringify({ error: 'Missing subject or html' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Get all users
    const { data: usersData, error: usersErr } = await supabase.auth.admin.listUsers()
    if (usersErr) {
      return new Response(JSON.stringify({ error: 'Failed to list users' }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const emails = (usersData?.users || [])
      .map(u => u.email)
      .filter((e): e is string => !!e)

    if (emails.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: 'No users found' }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    // Send via Resend batch API
    const batchPayload = emails.map(email => ({
      from: 'Kernel <noreply@kernel.chat>',
      to: email,
      subject,
      html,
    }))

    const resendRes = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(batchPayload),
    })

    if (!resendRes.ok) {
      const errText = await resendRes.text().catch(() => 'unknown')
      console.error(`Resend batch failed (${resendRes.status}):`, errText)
      return new Response(JSON.stringify({ error: 'Email send failed', detail: errText }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const result = await resendRes.json()
    console.log(`Announcement sent to ${emails.length} users:`, result)

    return new Response(JSON.stringify({ sent: emails.length, emails, result }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Announcement error:', err)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
})
