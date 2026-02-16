// Supabase Edge Function: send-inquiry-email
// Sends email notification via Resend when a new inquiry is submitted.
//
// Deploy: npx supabase functions deploy send-inquiry-email
// Set secret: npx supabase secrets set RESEND_API_KEY=re_xxxxx NOTIFY_EMAIL=your@email.com

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const RESEND_API = 'https://api.resend.com/emails'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Escape HTML to prevent injection in email templates
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

interface InquiryPayload {
  inquiry: {
    id: string
    name: string
    email: string
    details: string
    description: string
    evaluation_score: number
    evaluation_tier: string
    quote_total: number | null
    quote_type: string | null
    quote_complexity: string | null
  }
  paymentLink: string | null
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const resendKey = Deno.env.get('RESEND_API_KEY')
    const notifyEmail = Deno.env.get('NOTIFY_EMAIL')

    if (!resendKey || !notifyEmail) {
      return new Response(
        JSON.stringify({ error: 'Missing RESEND_API_KEY or NOTIFY_EMAIL' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    const { inquiry, paymentLink } = (await req.json()) as InquiryPayload

    // Validate email format
    if (!inquiry?.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inquiry.email)) {
      return new Response(
        JSON.stringify({ error: 'Valid email is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    // Sanitize all user-provided fields before HTML interpolation
    const safe = {
      name: escapeHtml(inquiry.name || ''),
      email: escapeHtml(inquiry.email),
      details: escapeHtml(inquiry.details || ''),
      description: escapeHtml(inquiry.description || ''),
      id: escapeHtml(inquiry.id || ''),
      evaluation_score: Number(inquiry.evaluation_score) || 0,
      evaluation_tier: escapeHtml(String(inquiry.evaluation_tier || '')),
      quote_total: inquiry.quote_total ? Number(inquiry.quote_total) : null,
      quote_type: escapeHtml(String(inquiry.quote_type || '')),
      quote_complexity: escapeHtml(String(inquiry.quote_complexity || '')),
    }
    const safePaymentLink = paymentLink ? escapeHtml(paymentLink) : null

    const quoteInfo = safe.quote_total
      ? `$${safe.quote_total.toLocaleString()} (${safe.quote_type} / ${safe.quote_complexity})`
      : 'No quote generated'

    // 1. Send notification to YOU
    const notifyResponse = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: 'Kernel <notifications@yourdomain.com>',
        to: [notifyEmail],
        subject: `New Inquiry: ${safe.name || 'Anonymous'} — ${quoteInfo}`,
        html: `
          <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 2rem; color: #1F1E1D;">
            <h2 style="font-weight: 400; margin-bottom: 0.5rem;">New Project Inquiry</h2>
            <hr style="border: none; border-top: 1px solid #e5e5e0; margin: 1rem 0;" />

            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr><td style="padding: 0.5rem 0; opacity: 0.5; width: 120px;">Name</td><td>${safe.name || '—'}</td></tr>
              <tr><td style="padding: 0.5rem 0; opacity: 0.5;">Email</td><td>${safe.email}</td></tr>
              <tr><td style="padding: 0.5rem 0; opacity: 0.5;">Quote</td><td>${quoteInfo}</td></tr>
              <tr><td style="padding: 0.5rem 0; opacity: 0.5;">Score</td><td>${safe.evaluation_score}/100 (${safe.evaluation_tier})</td></tr>
            </table>

            <hr style="border: none; border-top: 1px solid #e5e5e0; margin: 1rem 0;" />

            <p style="font-size: 14px; opacity: 0.7;"><strong>Description:</strong></p>
            <p style="font-size: 14px; line-height: 1.6;">${safe.description}</p>

            ${safe.details ? `
              <p style="font-size: 14px; opacity: 0.7; margin-top: 1rem;"><strong>Additional Details:</strong></p>
              <p style="font-size: 14px; line-height: 1.6;">${safe.details}</p>
            ` : ''}

            ${safePaymentLink ? `
              <hr style="border: none; border-top: 1px solid #e5e5e0; margin: 1rem 0;" />
              <p style="font-size: 13px; opacity: 0.5;">Payment link sent to client: ${safePaymentLink}</p>
            ` : ''}

            <hr style="border: none; border-top: 1px solid #e5e5e0; margin: 1.5rem 0;" />
            <p style="font-size: 11px; opacity: 0.3; font-family: monospace;">inquiry_id: ${safe.id}</p>
          </div>
        `,
      }),
    })

    if (!notifyResponse.ok) {
      const err = await notifyResponse.text()
      console.error('Resend notification failed:', err)
    }

    // 2. Send confirmation to the CLIENT
    const confirmResponse = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: 'Kernel <hello@yourdomain.com>',
        to: [inquiry.email], // Use raw email for Resend recipient (not HTML context)
        subject: 'Your project inquiry has been received',
        html: `
          <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 2rem; color: #1F1E1D;">
            <h2 style="font-weight: 400;">Got it${safe.name ? `, ${safe.name}` : ''}.</h2>
            <p style="font-size: 15px; line-height: 1.7; opacity: 0.7;">
              Your project inquiry has been received. I'll review it and get back to you shortly.
            </p>

            ${safe.quote_total ? `
              <div style="background: #FAF9F6; padding: 1.5rem; border-radius: 8px; margin: 1.5rem 0;">
                <p style="font-size: 13px; opacity: 0.5; margin: 0 0 0.5rem; font-family: monospace;">PROJECT ESTIMATE</p>
                <p style="font-size: 28px; margin: 0; font-weight: 400;">$${safe.quote_total.toLocaleString()}</p>
                <p style="font-size: 13px; opacity: 0.5; margin: 0.25rem 0 0;">${safe.quote_type} / ${safe.quote_complexity}</p>
              </div>
            ` : ''}

            ${safePaymentLink ? `
              <p style="font-size: 15px; line-height: 1.7;">
                Ready to move forward?
                <a href="${safePaymentLink}" style="color: #1F1E1D; font-weight: 600;">Secure your spot with a deposit &rarr;</a>
              </p>
            ` : ''}

            <hr style="border: none; border-top: 1px solid #e5e5e0; margin: 2rem 0 1rem;" />
            <p style="font-size: 12px; opacity: 0.3; font-family: monospace;">Kernel</p>
          </div>
        `,
      }),
    })

    if (!confirmResponse.ok) {
      const err = await confirmResponse.text()
      console.error('Resend confirmation failed:', err)
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  }
})
