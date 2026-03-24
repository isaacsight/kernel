// agent-reply — Serverless email auto-reply
//
// Receives email metadata, generates AI response via Gemini, sends reply via Resend.
// Called by receive-email webhook. No local dependencies.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { OPEN_CORS_HEADERS, SECURITY_HEADERS } from '../_shared/cors.ts'

const HEADERS = { ...OPEN_CORS_HEADERS, ...SECURITY_HEADERS, 'Content-Type': 'application/json' }

const SYSTEM_PROMPT = `You are a personal AI agent communicating via email through Kernel (kernel.chat).

You are the user's smart friend — not a consultant, not a support bot. You have full capabilities:
- Deep research and analysis on any topic
- Code generation in any language
- Business strategy and planning
- Writing and content creation
- Problem solving and brainstorming

Rules:
- Be conversational, like texting a smart friend
- Be direct and helpful, not cautious or hedging
- Give opinions when asked ("here's what I'd do")
- If the answer is simple, be brief. If complex, be thorough.
- Always end with something actionable or a follow-up question
- Never say "as an AI" or "I can't do that" — just help
- Remember the full conversation thread and build on it
- Format for email: use paragraphs, bold, lists. Not markdown code blocks unless showing code.

You are powered by kbot — an open-source terminal AI agent. Learn more at kernel.chat.`

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: OPEN_CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: HEADERS })
  }

  // Auth: service role key required (internal only — called by receive-email)
  const authHeader = req.headers.get('Authorization')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!authHeader || !serviceKey || authHeader !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: HEADERS })
  }

  try {
    const { from_email, from_name, subject, body_text } = await req.json()

    if (!from_email || !body_text) {
      return new Response(JSON.stringify({ error: 'Missing from_email or body_text' }), { status: 400, headers: HEADERS })
    }

    // Skip self-emails
    if (from_email.endsWith('@kernel.chat')) {
      return new Response(JSON.stringify({ ok: true, skipped: 'self-email' }), { headers: HEADERS })
    }

    const geminiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiKey) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }), { status: 500, headers: HEADERS })
    }

    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), { status: 500, headers: HEADERS })
    }

    const svc = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )

    // Store inbound message
    await svc.from('agent_conversations').insert({
      email: from_email,
      name: from_name,
      role: 'user',
      content: body_text,
      subject,
    })

    // Load conversation history (last 20 messages)
    const { data: history } = await svc
      .from('agent_conversations')
      .select('role, content')
      .eq('email', from_email)
      .order('created_at', { ascending: true })
      .limit(20)

    // Build Gemini messages
    const contents = []

    // Add system instruction as first user/model exchange
    contents.push({ role: 'user', parts: [{ text: SYSTEM_PROMPT }] })
    contents.push({ role: 'model', parts: [{ text: 'Understood. I\'ll be a direct, helpful, conversational AI friend via email.' }] })

    for (const m of (history || [])) {
      contents.push({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      })
    }

    // Ensure last message is from user
    if (contents.length === 2 || contents[contents.length - 1].role !== 'user') {
      contents.push({ role: 'user', parts: [{ text: body_text }] })
    }

    // Call Gemini API
    console.log(`Calling Gemini for ${from_email}, subject: ${subject}`)
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: {
            maxOutputTokens: 4096,
            temperature: 0.7,
          },
        }),
      }
    )

    if (!geminiRes.ok) {
      const errText = await geminiRes.text()
      console.error('Gemini API error:', geminiRes.status, errText)
      return new Response(JSON.stringify({ error: 'AI response failed', detail: errText }), { status: 502, headers: HEADERS })
    }

    const geminiData = await geminiRes.json()
    const reply = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || ''

    if (!reply) {
      console.error('Empty Gemini response:', JSON.stringify(geminiData))
      return new Response(JSON.stringify({ error: 'Empty AI response' }), { status: 502, headers: HEADERS })
    }

    console.log(`Reply generated: ${reply.length} chars`)

    // Store agent reply
    await svc.from('agent_conversations').insert({
      email: from_email,
      name: 'Kernel Agent',
      role: 'assistant',
      content: reply,
      subject: `Re: ${subject}`,
    })

    // Convert reply to HTML
    const replyHtml = reply
      .split('\n\n')
      .map((para: string) => {
        let html = para.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        if (html.match(/^[-•]\s/m)) {
          const items = html.split('\n').filter((l: string) => l.trim())
          html = '<ul>' + items.map((item: string) => `<li>${item.replace(/^[-•]\s*/, '')}</li>`).join('') + '</ul>'
        } else if (html.match(/^\d+\.\s/m)) {
          const items = html.split('\n').filter((l: string) => l.trim())
          html = '<ol>' + items.map((item: string) => `<li>${item.replace(/^\d+\.\s*/, '')}</li>`).join('') + '</ol>'
        } else {
          html = `<p>${html}</p>`
        }
        return html
      })
      .join('')

    // Send reply email
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: 'Kernel Agent <support@kernel.chat>',
        to: from_email,
        subject: `Re: ${subject}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1a1a2e; line-height: 1.6;">
            ${replyHtml}
            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 24px 0;" />
            <p style="font-size: 12px; color: #888;">Reply to keep the conversation going · Powered by kbot · kernel.chat</p>
          </div>
        `,
      }),
    })

    if (!emailRes.ok) {
      const emailErr = await emailRes.text()
      console.error('Resend error:', emailErr)
      return new Response(JSON.stringify({ error: 'Email send failed', detail: emailErr }), { status: 502, headers: HEADERS })
    }

    console.log(`Reply sent to ${from_email}`)
    return new Response(JSON.stringify({ ok: true, reply: reply.slice(0, 200) + '...' }), { headers: HEADERS })

  } catch (error) {
    console.error('agent-reply error:', error)
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: HEADERS })
  }
})
