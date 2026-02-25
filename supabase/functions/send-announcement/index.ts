// Supabase Edge Function: send-announcement
// Sends a styled email to all registered users via Resend.
// Requires RESEND_API_KEY and SUPABASE_SERVICE_ROLE_KEY.
//
// Deploy: npx supabase functions deploy send-announcement --project-ref eoxxpyixdieprsxlpwcs

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { logAudit, getClientIP, getUA } from '../_shared/audit.ts'
import { requireContentType } from '../_shared/validate.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Admin user IDs allowed to send announcements
const ADMIN_IDS = new Set(
  (Deno.env.get('ADMIN_USER_IDS') || '').split(',').map(s => s.trim()).filter(Boolean)
)

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    // ── Content-type check ──────────────────────────────
    const ctErr = requireContentType(req)
    if (ctErr) return ctErr(CORS_HEADERS)

    // ── Auth: verify JWT + admin role ────────────────────
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const authClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    )
    const { data: { user }, error: authError } = await authClient.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    // Only allow admin users to send announcements
    if (!ADMIN_IDS.has(user.id)) {
      return new Response(JSON.stringify({ error: 'Forbidden: admin access required' }), {
        status: 403,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const { subject, html } = await req.json()

    if (!subject || !html) {
      return new Response(JSON.stringify({ error: 'Missing subject or html' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    if (subject.length > 200) {
      return new Response(JSON.stringify({ error: 'Subject too long (max 200 chars)' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    if (html.length > 102400) {
      return new Response(JSON.stringify({ error: 'HTML body too large (max 100KB)' }), {
        status: 413,
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

    // Get all users (paginated — listUsers returns max 1000 per page)
    const allEmails: string[] = []
    let page = 1
    const perPage = 1000
    while (true) {
      const { data: usersData, error: usersErr } = await supabase.auth.admin.listUsers({ page, perPage })
      if (usersErr) {
        return new Response(JSON.stringify({ error: 'Failed to list users' }), {
          status: 500,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        })
      }
      const users = usersData?.users || []
      for (const u of users) {
        if (u.email) allEmails.push(u.email)
      }
      if (users.length < perPage) break // no more pages
      page++
    }
    const emails = allEmails

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

    // Audit log
    logAudit(supabase, {
      actorId: user.id, eventType: 'system.email', action: 'send-announcement',
      source: 'send-announcement', status: 'success', statusCode: 200,
      metadata: { recipientCount: emails.length, subject: subject.substring(0, 100) },
      ip: getClientIP(req), userAgent: getUA(req),
    })

    return new Response(JSON.stringify({ sent: emails.length, result }), {
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
