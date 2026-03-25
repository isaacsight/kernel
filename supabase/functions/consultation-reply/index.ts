// consultation-reply — Process inbound consultation emails via kbot
//
// Called by receive-email when a consultation email arrives.
// Routes through kbot's consultation pipeline, then sends branded reply via Resend.
//
// Expects: { from_email, from_name, subject, body_text, thread_subject? }
// Returns: { ok, reply, agent, thread_status, eval }

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { OPEN_CORS_HEADERS, SECURITY_HEADERS } from '../_shared/cors.ts'
import { logAudit, getClientIP, getUA } from '../_shared/audit.ts'

const HEADERS = { ...OPEN_CORS_HEADERS, ...SECURITY_HEADERS, 'Content-Type': 'application/json' }

// ── Domain Guardrails (duplicated from kbot for edge function use) ──

const RESTRICTED_DOMAINS = [
  {
    domain: 'legal',
    patterns: [
      /\b(legal advice|lawyer|attorney|lawsuit|sue|litigation|court|plaintiff|defendant|statute|liability|tort|contract law|intellectual property law|patent law|legal obligation|legal rights|legal counsel)\b/i,
      /\b(should i sue|can i be sued|is this legal|legally binding|NDA review|employment law|labor law)\b/i,
    ],
    professional: 'lawyer or legal counsel',
    suggestion: 'business strategy, contract negotiation approach, or risk assessment from a business perspective',
  },
  {
    domain: 'medical',
    patterns: [
      /\b(medical advice|diagnosis|treatment|prescription|medication|symptoms|disease|illness|health condition|clinical|therapy|dosage|side effects|medical condition)\b/i,
      /\b(should i take|what medication|am i sick|health risk|medical opinion)\b/i,
    ],
    professional: 'qualified healthcare provider',
    suggestion: 'health tech strategy, wellness program design, or healthcare business operations',
  },
  {
    domain: 'financial',
    patterns: [
      /\b(investment advice|stock picks|buy or sell|portfolio allocation|financial planning|retirement planning|tax-loss harvesting|securities|hedge fund|mutual fund|cryptocurrency investment|forex trading)\b/i,
      /\b(should i invest|which stocks|financial advisor|fiduciary|wealth management|estate planning)\b/i,
    ],
    professional: 'licensed financial advisor',
    suggestion: 'business financial strategy, revenue modeling, pricing strategy, or fundraising approach',
  },
  {
    domain: 'tax',
    patterns: [
      /\b(tax advice|tax filing|tax deduction|tax return|tax liability|tax shelter|tax evasion|tax avoidance|IRS|tax audit|tax code|capital gains tax|estate tax|income tax filing)\b/i,
      /\b(how to file taxes|tax write-off|can i deduct|tax bracket|tax-exempt)\b/i,
    ],
    professional: 'certified accountant or tax professional',
    suggestion: 'business expense planning, financial modeling, or revenue optimization',
  },
]

function checkGuardrails(message: string): { blocked: boolean; domain?: string; reply?: string } {
  for (const domain of RESTRICTED_DOMAINS) {
    for (const pattern of domain.patterns) {
      if (pattern.test(message)) {
        return {
          blocked: true,
          domain: domain.domain,
          reply: `This touches on ${domain.domain} territory. I'd recommend consulting a ${domain.professional} for this specific question.\n\nI can definitely help with ${domain.suggestion} instead — would you like to explore that?`,
        }
      }
    }
  }
  return { blocked: false }
}

// ── Database Helpers ──

interface Client {
  id: string
  email: string
  name: string | null
  industry: string | null
  goals: string | null
  challenges: string | null
  context: Record<string, unknown>
  intake_complete: boolean
}

interface Thread {
  id: string
  client_id: string
  subject: string
  status: string
  reply_count: number
  max_replies: number
  agent: string | null
  paid: boolean
  stripe_payment_link: string | null
  consultation_fee: number | null
}

async function getOrCreateClient(svc: SupabaseClient, email: string, name: string | null): Promise<Client> {
  const { data: existing } = await svc
    .from('consultation_clients')
    .select('*')
    .eq('email', email)
    .single()

  if (existing) return existing as Client

  const { data: created, error } = await svc
    .from('consultation_clients')
    .insert({ email, name })
    .select()
    .single()

  if (error) throw new Error(`Failed to create client: ${error.message}`)
  return created as Client
}

async function getActiveThread(svc: SupabaseClient, clientId: string): Promise<Thread | null> {
  const { data } = await svc
    .from('consultation_threads')
    .select('*')
    .eq('client_id', clientId)
    .in('status', ['intake', 'valuation', 'awaiting_payment', 'active'])
    .order('started_at', { ascending: false })
    .limit(1)
    .single()

  return data as Thread | null
}

async function createThread(svc: SupabaseClient, clientId: string, subject: string, status: string): Promise<Thread> {
  const { data, error } = await svc
    .from('consultation_threads')
    .insert({ client_id: clientId, subject, status })
    .select()
    .single()

  if (error) throw new Error(`Failed to create thread: ${error.message}`)
  return data as Thread
}

async function addMessage(svc: SupabaseClient, threadId: string, role: string, content: string, agent?: string) {
  await svc.from('consultation_messages').insert({ thread_id: threadId, role, content, agent })
}

async function getThreadMessages(svc: SupabaseClient, threadId: string): Promise<Array<{ role: string; content: string }>> {
  const { data } = await svc
    .from('consultation_messages')
    .select('role, content')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })

  return (data || []) as Array<{ role: string; content: string }>
}

async function incrementReplyCount(svc: SupabaseClient, threadId: string, agent: string) {
  // Fetch current count, increment
  const { data } = await svc.from('consultation_threads').select('reply_count').eq('id', threadId).single()
  const count = (data?.reply_count || 0) + 1
  await svc.from('consultation_threads').update({ reply_count: count, agent }).eq('id', threadId)
}

// ── Intake Flow ──

const INTAKE_MESSAGE = `Thank you for reaching out to Kernel Consultation.

Before I can give you the best possible advice, I'd love to learn a bit about your business. Could you answer these quick questions?

1. What industry are you in? (e.g., SaaS, e-commerce, healthcare, fintech, agency)
2. What does your business do? (one sentence is fine)
3. What's your biggest challenge right now?
4. What are you hoping to achieve in the next 3-6 months?
5. Is there anything specific you'd like help with today?

Just reply to this email with your answers and we'll get started right away.`

function parseIntakeAnswers(message: string): Partial<Client> {
  const lines = message.split('\n').filter(l => l.trim())
  const numbered = lines.filter(l => /^\s*\d+[\.\)]\s*/.test(l))
  const answers: Partial<Client> = { context: {} }

  if (numbered.length >= 3) {
    const clean = numbered.map(l => l.replace(/^\s*\d+[\.\)]\s*/, '').trim())
    answers.industry = clean[0] || null
    answers.goals = clean[1] || null
    answers.challenges = clean[2] || null
    if (clean[3]) (answers.context as Record<string, string>).timeline = clean[3]
    if (clean[4]) (answers.context as Record<string, string>).specific_request = clean[4]
  } else {
    answers.context = { raw_intake: message }
    const industryMatch = message.match(/\b(SaaS|e-commerce|ecommerce|healthcare|fintech|agency|consulting|retail|manufacturing|education|real estate|media|tech|startup)\b/i)
    if (industryMatch) answers.industry = industryMatch[1]
  }

  return answers
}

// ── Value-Based Pricing ──

const PRICING_TIERS = [
  { maxValue: 10_000,    fee: 2500,  label: '$25' },   // < $10K idea → $25
  { maxValue: 50_000,    fee: 7500,  label: '$75' },   // $10K-$50K → $75
  { maxValue: 250_000,   fee: 15000, label: '$150' },  // $50K-$250K → $150
  { maxValue: 1_000_000, fee: 30000, label: '$300' },  // $250K-$1M → $300
  { maxValue: Infinity,  fee: 50000, label: '$500' },  // $1M+ → $500
]

function getFeeForValue(marketValueHigh: number): { fee: number; label: string } {
  for (const tier of PRICING_TIERS) {
    if (marketValueHigh <= tier.maxValue) {
      return { fee: tier.fee, label: tier.label }
    }
  }
  return PRICING_TIERS[PRICING_TIERS.length - 1]
}

interface ValuationResult {
  idea_summary: string
  market_value_low: number
  market_value_high: number
  market_size: string
  competitors: string
  revenue_model: string
  confidence: string
}

async function valuateIdea(ideaText: string, clientContext: string): Promise<ValuationResult> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) {
    return {
      idea_summary: ideaText.slice(0, 200),
      market_value_low: 10000,
      market_value_high: 50000,
      market_size: 'Unable to assess — API unavailable',
      competitors: 'Unable to assess',
      revenue_model: 'Unable to assess',
      confidence: 'low',
    }
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: `You are a business valuation analyst. Analyze ideas and estimate their market value potential. Be realistic and data-driven. Always respond in the exact JSON format requested.`,
      messages: [{
        role: 'user',
        content: `Analyze this business idea and estimate its market value potential.

Client context: ${clientContext}

Idea/Question: ${ideaText}

Respond in this EXACT JSON format (no markdown, just raw JSON):
{
  "idea_summary": "one sentence summary of the idea",
  "market_value_low": 0,
  "market_value_high": 0,
  "market_size": "estimated total addressable market",
  "competitors": "key competitors or alternatives",
  "revenue_model": "likely revenue model",
  "confidence": "low|medium|high"
}

For market_value_low and market_value_high, estimate the annual revenue potential in USD.
- A simple freelance service idea: $5,000-$20,000
- A local business improvement: $10,000-$100,000
- A SaaS product: $50,000-$500,000
- A platform/marketplace: $100,000-$5,000,000
- A major enterprise solution: $500,000-$10,000,000+

Be realistic. Most ideas are in the $10K-$100K range.`,
      }],
    }),
  })

  if (!res.ok) {
    return {
      idea_summary: ideaText.slice(0, 200),
      market_value_low: 10000,
      market_value_high: 50000,
      market_size: 'Unable to assess',
      competitors: 'Unable to assess',
      revenue_model: 'Unable to assess',
      confidence: 'low',
    }
  }

  const data = await res.json()
  const text = (data.content || []).filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('')

  try {
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as ValuationResult
    }
  } catch {
    // Parse failed
  }

  return {
    idea_summary: ideaText.slice(0, 200),
    market_value_low: 10000,
    market_value_high: 50000,
    market_size: 'Unable to assess',
    competitors: 'Unable to assess',
    revenue_model: 'Unable to assess',
    confidence: 'low',
  }
}

async function createStripePaymentLink(
  clientEmail: string,
  fee: number,
  feeLabel: string,
  ideaSummary: string,
  threadId: string,
): Promise<{ url: string; sessionId: string } | null> {
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
  if (!stripeKey) {
    console.error('STRIPE_SECRET_KEY not set')
    return null
  }

  const params = new URLSearchParams()
  params.set('mode', 'payment')
  params.set('customer_email', clientEmail)
  params.set('success_url', `https://kernel.chat/consultation/success?thread=${threadId}`)
  params.set('cancel_url', `https://kernel.chat/consultation/cancel?thread=${threadId}`)
  params.set('metadata[thread_id]', threadId)
  params.set('metadata[type]', 'consultation')
  params.set('line_items[0][price_data][currency]', 'usd')
  params.set('line_items[0][price_data][unit_amount]', String(fee))
  params.set('line_items[0][price_data][product_data][name]', 'Kernel Consultation')
  params.set('line_items[0][price_data][product_data][description]', `Business consultation: ${ideaSummary.slice(0, 100)}. Up to 15 exchanges including market analysis, strategy, and action items.`)
  params.set('line_items[0][quantity]', '1')

  try {
    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('Stripe checkout error:', err)
      return null
    }

    const session = await res.json()
    return { url: session.url, sessionId: session.id }
  } catch (err) {
    console.error('Stripe call failed:', err)
    return null
  }
}

function buildValuationEmail(
  valuation: ValuationResult,
  feeLabel: string,
  paymentUrl: string | null,
): string {
  const valueLow = valuation.market_value_low >= 1_000_000
    ? `$${(valuation.market_value_low / 1_000_000).toFixed(1)}M`
    : `$${(valuation.market_value_low / 1_000).toFixed(0)}K`

  const valueHigh = valuation.market_value_high >= 1_000_000
    ? `$${(valuation.market_value_high / 1_000_000).toFixed(1)}M`
    : `$${(valuation.market_value_high / 1_000).toFixed(0)}K`

  let email = `Thank you for sharing your idea. Here's my initial assessment:

**Your Idea:** ${valuation.idea_summary}

**Market Analysis:**
- Estimated revenue potential: ${valueLow} - ${valueHigh} annually
- Market size: ${valuation.market_size}
- Key competitors: ${valuation.competitors}
- Revenue model: ${valuation.revenue_model}
- Confidence: ${valuation.confidence}

**Consultation Fee: ${feeLabel}**

This covers a full strategy session (up to 15 exchanges) including:
- Detailed market analysis and competitive landscape
- Go-to-market strategy recommendations
- Revenue modeling and pricing strategy
- Actionable next steps with a written summary`

  if (paymentUrl) {
    email += `\n\nReady to dive deeper? Pay here to start your consultation:\n${paymentUrl}`
  } else {
    email += `\n\nReply to this email to proceed with payment and start your consultation.`
  }

  return email
}

// ── kbot Agent Call ──

async function callKbot(message: string, clientContext: string, threadHistory: string): Promise<{ reply: string; agent: string }> {
  // Call kbot's HTTP server if running locally, or use the API directly
  const kbotUrl = Deno.env.get('KBOT_SERVER_URL') || 'http://localhost:7437'

  const systemPrompt = `You are a professional business consultant responding via email on behalf of Kernel. Be concise, actionable, and specific to the client's business.

${clientContext}

Thread History:
${threadHistory}

Respond to the client's latest message. Be professional but warm. Give specific, actionable advice. Do NOT give legal, medical, financial investment, or tax advice.`

  try {
    const res = await fetch(`${kbotUrl}/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `${systemPrompt}\n\nClient's message: ${message}`,
        agent: 'strategist',
      }),
    })

    if (!res.ok) throw new Error(`kbot returned ${res.status}`)

    // Parse SSE response — collect all data events
    const text = await res.text()
    const lines = text.split('\n')
    let reply = ''
    let agent = 'strategist'

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6))
          if (data.type === 'text') reply += data.content || ''
          if (data.type === 'done' && data.agent) agent = data.agent
        } catch {
          // Skip non-JSON data lines
          reply += line.slice(6)
        }
      }
    }

    return { reply: reply.trim() || 'Thank you for your message. Let me look into this and get back to you shortly.', agent }
  } catch (err) {
    console.error('kbot call failed:', err)
    // Fallback: use Claude directly via the existing proxy
    return await callClaudeDirect(message, clientContext, threadHistory)
  }
}

async function callClaudeDirect(message: string, clientContext: string, threadHistory: string): Promise<{ reply: string; agent: string }> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) {
    return { reply: 'Thank you for your message. Our team will review and respond shortly.', agent: 'fallback' }
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: `You are a professional business consultant for Kernel. Be concise, actionable, and specific. Do NOT give legal, medical, financial investment, or tax advice.\n\n${clientContext}`,
      messages: [
        ...(threadHistory ? [{ role: 'user' as const, content: `Previous conversation:\n${threadHistory}` }, { role: 'assistant' as const, content: 'I have the context. Please share the client\'s latest message.' }] : []),
        { role: 'user' as const, content: message },
      ],
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    console.error('Claude API error:', errText)
    return { reply: 'Thank you for your message. Our team will review and respond shortly.', agent: 'fallback' }
  }

  const data = await res.json()
  const blocks = data.content || []
  const reply = blocks.filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('')

  return { reply: reply || 'Thank you for your message.', agent: 'claude-direct' }
}

// ── Email Template ──

function consultationEmailTemplate(body: string, clientName: string | null): string {
  const greeting = clientName ? `Hi ${clientName.split(' ')[0]},` : 'Hello,'

  return `
<div style="font-family: 'EB Garamond', Georgia, serif; max-width: 600px; margin: 0 auto; padding: 32px; color: #1F1E1D; background: #FAF9F6;">
  <div style="text-align: center; margin-bottom: 24px;">
    <div style="display: inline-block; width: 40px; height: 40px; background: #6B5B95; border-radius: 50%; line-height: 40px; color: white; font-family: 'Courier Prime', monospace; font-size: 18px; font-weight: bold;">K</div>
  </div>

  <p style="margin: 0 0 16px;">${greeting}</p>

  <div style="line-height: 1.7; white-space: pre-wrap;">${escapeHtml(body)}</div>

  <hr style="border: none; border-top: 1px solid #E8E5E0; margin: 32px 0 16px;" />

  <p style="font-family: 'Courier Prime', Courier, monospace; font-size: 11px; color: #8A8580; margin: 0;">
    Kernel Consultation &middot; Powered by kbot<br/>
    Reply to this email to continue the conversation.
  </p>
</div>`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // Convert markdown bold to HTML
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Convert markdown bullets
    .replace(/^- (.+)$/gm, '&bull; $1')
    // Convert markdown headers
    .replace(/^## (.+)$/gm, '<strong style="font-size: 16px;">$1</strong>')
    .replace(/^### (.+)$/gm, '<strong>$1</strong>')
}

// ── Send Reply ──

async function sendConsultationReply(
  toEmail: string,
  toName: string | null,
  subject: string,
  body: string,
): Promise<boolean> {
  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) {
    console.error('RESEND_API_KEY not set')
    return false
  }

  const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: 'Kernel Consultation <consult@kernel.chat>',
        to: toEmail,
        subject: replySubject,
        html: consultationEmailTemplate(body, toName),
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('Resend error:', err)
      return false
    }

    return true
  } catch (err) {
    console.error('Email send failed:', err)
    return false
  }
}

// ── Main Handler ──

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: OPEN_CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: HEADERS })
  }

  // Auth: service role key required (internal only)
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

    const svc = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )

    // 1. Guardrail check
    const guardrail = checkGuardrails(body_text)
    if (guardrail.blocked) {
      await sendConsultationReply(from_email, from_name, subject, guardrail.reply!)

      logAudit(svc, {
        actorId: '00000000-0000-0000-0000-000000000000',
        eventType: 'consultation',
        action: 'guardrail-block',
        source: 'consultation-reply',
        status: 'blocked',
        statusCode: 200,
        metadata: { from_email, domain: guardrail.domain },
        ip: getClientIP(req),
        userAgent: getUA(req),
      })

      return new Response(JSON.stringify({
        ok: true,
        guardrail_blocked: true,
        domain: guardrail.domain,
      }), { headers: HEADERS })
    }

    // 2. Client lookup/creation
    const client = await getOrCreateClient(svc, from_email, from_name)

    // 3. Intake flow
    if (!client.intake_complete) {
      const existingThread = await getActiveThread(svc, client.id)

      if (!existingThread) {
        // First contact — send intake questions
        const thread = await createThread(svc, client.id, subject, 'intake')
        await addMessage(svc, thread.id, 'client', body_text)
        await addMessage(svc, thread.id, 'kbot', INTAKE_MESSAGE, 'intake')
        await sendConsultationReply(from_email, from_name, subject, INTAKE_MESSAGE)

        return new Response(JSON.stringify({
          ok: true,
          status: 'intake_sent',
          thread_id: thread.id,
        }), { headers: HEADERS })
      }

      if (existingThread.status === 'intake') {
        // Parse intake answers
        await addMessage(svc, existingThread.id, 'client', body_text)
        const answers = parseIntakeAnswers(body_text)
        await svc.from('consultation_clients').update({
          ...answers,
          intake_complete: true,
        }).eq('id', client.id)

        // Move to valuation phase
        await svc.from('consultation_threads').update({ status: 'valuation' }).eq('id', existingThread.id)
        Object.assign(client, answers, { intake_complete: true })

        // Run valuation on the client's idea/goals
        const clientContext = [
          client.name ? `Name: ${client.name}` : '',
          answers.industry ? `Industry: ${answers.industry}` : '',
          answers.goals ? `Goals: ${answers.goals}` : '',
          answers.challenges ? `Challenges: ${answers.challenges}` : '',
        ].filter(Boolean).join('\n')

        const valuation = await valuateIdea(body_text, clientContext)
        const { fee, label: feeLabel } = getFeeForValue(valuation.market_value_high)

        // Create Stripe payment link
        const payment = await createStripePaymentLink(
          from_email, fee, feeLabel, valuation.idea_summary, existingThread.id
        )

        // Save valuation to thread
        await svc.from('consultation_threads').update({
          status: 'awaiting_payment',
          idea_summary: valuation.idea_summary,
          market_value_low: valuation.market_value_low,
          market_value_high: valuation.market_value_high,
          consultation_fee: fee,
          valuation_analysis: valuation,
          stripe_payment_link: payment?.url || null,
          stripe_session_id: payment?.sessionId || null,
        }).eq('id', existingThread.id)

        // Send valuation email with payment link
        const valuationEmail = buildValuationEmail(valuation, feeLabel, payment?.url || null)
        await addMessage(svc, existingThread.id, 'kbot', valuationEmail, 'analyst')
        await sendConsultationReply(from_email, from_name, subject, valuationEmail)

        logAudit(svc, {
          actorId: '00000000-0000-0000-0000-000000000000',
          eventType: 'consultation',
          action: 'valuation-sent',
          source: 'consultation-reply',
          status: 'success',
          statusCode: 200,
          metadata: {
            from_email,
            market_value_low: valuation.market_value_low,
            market_value_high: valuation.market_value_high,
            fee,
            fee_label: feeLabel,
            thread_id: existingThread.id,
          },
          ip: getClientIP(req),
          userAgent: getUA(req),
        })

        return new Response(JSON.stringify({
          ok: true,
          status: 'valuation_sent',
          thread_id: existingThread.id,
          valuation,
          fee,
          fee_label: feeLabel,
          payment_url: payment?.url || null,
        }), { headers: HEADERS })
      }
    }

    // 4. Get/create active thread
    let thread = await getActiveThread(svc, client.id)
    if (!thread) {
      thread = await createThread(svc, client.id, subject, 'active')
    }

    // 4.5. Payment gate — block consultation if not paid
    if (thread.status === 'awaiting_payment') {
      // Check if payment has been received (Stripe webhook sets paid=true)
      const { data: threadData } = await svc
        .from('consultation_threads')
        .select('paid, stripe_payment_link, consultation_fee')
        .eq('id', thread.id)
        .single()

      if (!threadData?.paid) {
        // Remind them to pay
        const reminderMsg = `Thanks for your message! Before we can start the consultation, please complete the payment using the link below:\n\n${threadData?.stripe_payment_link || 'Payment link unavailable — please contact support@kernel.chat'}\n\nOnce payment is confirmed, I'll begin working on your strategy right away. Payments are processed securely via Stripe.`

        await addMessage(svc, thread.id, 'client', body_text)
        await addMessage(svc, thread.id, 'kbot', reminderMsg, 'billing')
        await sendConsultationReply(from_email, from_name, subject, reminderMsg)

        return new Response(JSON.stringify({
          ok: true,
          status: 'awaiting_payment',
          thread_id: thread.id,
        }), { headers: HEADERS })
      }

      // Payment confirmed — activate thread
      await svc.from('consultation_threads').update({ status: 'active' }).eq('id', thread.id)
      thread.status = 'active'
    }

    // 5. Reply cap check
    if (thread.reply_count >= thread.max_replies) {
      const capMsg = `We've reached the end of this consultation thread (${thread.max_replies} exchanges). To continue, simply send a new email to start a fresh thread.\n\nThank you for choosing Kernel Consultation.`
      await svc.from('consultation_threads').update({
        status: 'capped',
        completed_at: new Date().toISOString(),
      }).eq('id', thread.id)
      await sendConsultationReply(from_email, from_name, subject, capMsg)

      return new Response(JSON.stringify({ ok: true, status: 'capped' }), { headers: HEADERS })
    }

    // 6. Record client message
    await addMessage(svc, thread.id, 'client', body_text)

    // 7. Build context
    const messages = await getThreadMessages(svc, thread.id)
    const threadHistory = messages.slice(-10)
      .map(m => `${m.role === 'client' ? 'Client' : 'Consultant'}: ${m.content}`)
      .join('\n\n')

    const clientContext = [
      client.name ? `Name: ${client.name}` : '',
      client.industry ? `Industry: ${client.industry}` : '',
      client.goals ? `Goals: ${client.goals}` : '',
      client.challenges ? `Challenges: ${client.challenges}` : '',
    ].filter(Boolean).join('\n')

    // 8. Call kbot / Claude for response
    const { reply, agent } = await callKbot(body_text, clientContext, threadHistory)

    // 9. Record kbot response + send email
    await addMessage(svc, thread.id, 'kbot', reply, agent)
    await incrementReplyCount(svc, thread.id, agent)
    const sent = await sendConsultationReply(from_email, from_name, subject, reply)

    // 10. Audit
    logAudit(svc, {
      actorId: '00000000-0000-0000-0000-000000000000',
      eventType: 'consultation',
      action: 'reply-sent',
      source: 'consultation-reply',
      status: sent ? 'success' : 'error',
      statusCode: 200,
      metadata: { from_email, agent, thread_id: thread.id, reply_count: thread.reply_count + 1 },
      ip: getClientIP(req),
      userAgent: getUA(req),
    })

    return new Response(JSON.stringify({
      ok: true,
      status: 'replied',
      agent,
      thread_id: thread.id,
      reply_count: thread.reply_count + 1,
      email_sent: sent,
    }), { headers: HEADERS })

  } catch (error) {
    console.error('consultation-reply error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal error' }),
      { status: 500, headers: HEADERS }
    )
  }
})
