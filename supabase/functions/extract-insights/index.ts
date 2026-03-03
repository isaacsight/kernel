// Supabase Edge Function: extract-insights
// Called after a conversation completes. Saves conversation + extracts reusable insights via Claude.
//
// Deploy: npx supabase functions deploy extract-insights --project-ref kqsixkorzaulmeuynfkp

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handlePreflight, SECURITY_HEADERS } from '../_shared/cors.ts'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { logAudit, getClientIP, getUA } from '../_shared/audit.ts'
import { requireContentType } from '../_shared/validate.ts'

interface InsightPayload {
  conversationId: string
  messages: { role: 'user' | 'assistant'; content: string }[]
  evaluationResult: {
    description?: string
    tier?: string
    score?: number
    categoryScores?: { category: string; score: number; reasoning: string }[]
    narrative?: string
  }
  email?: string
}

const EXTRACTION_PROMPT = `You are an insight extraction engine. Given a completed project evaluation conversation, extract 2-3 reusable patterns or insights that would help evaluate FUTURE projects better.

Each insight should be:
- A specific, actionable observation (not generic advice)
- Grounded in something concrete from this conversation
- Useful for evaluating other projects in the future

Categorize each as one of: technical_pattern, market_signal, risk_factor, founder_behavior, pricing_insight

Respond with ONLY a JSON array:
[{"insight": "...", "category": "..."}]`

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return handlePreflight(req)
  }

  const CORS_HEADERS = { ...corsHeaders(req), ...SECURITY_HEADERS }

  // ── Content-Type check ──────────────────────────────
  const ctErr = requireContentType(req)
  if (ctErr) return ctErr(CORS_HEADERS)

  try {
    // ── Auth: verify JWT ────────────────────────────────
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    const authClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!)
    const { data: { user }, error: authError } = await authClient.auth.getUser(token)
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    // ── Rate limit (Postgres RPC) ─────────────────────
    const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const rlCheck = await checkRateLimit(svc, user.id, 'extract-insights')
    if (!rlCheck.allowed) return rateLimitResponse(rlCheck, CORS_HEADERS)

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!anthropicKey || !supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: 'Missing required secrets' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // ── Body size limit (512KB) ───────────────────────
    const rawBody = await req.text()
    if (rawBody.length > 524288) {
      return new Response(
        JSON.stringify({ error: 'Request body too large (max 512KB)' }),
        { status: 413, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }
    const payload = JSON.parse(rawBody) as InsightPayload

    const { conversationId, messages, evaluationResult } = payload
    const email = user.email // Use email from JWT, not from body

    if (!conversationId || !messages?.length) {
      return new Response(
        JSON.stringify({ error: 'conversationId and messages are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    // ── Save the full conversation ────────────────────────────
    const userMessages = messages.filter(m => m.role === 'user').map(m => m.content).join(' ')
    const projectType = userMessages.length > 50 ? userMessages.slice(0, 100) : userMessages

    await supabase.from('evaluation_conversations').upsert({
      id: conversationId,
      user_id: user.id,
      email: email || null,
      messages,
      evaluation_result: evaluationResult || null,
      project_type: projectType,
      tier: evaluationResult?.tier || null,
      score: evaluationResult?.score || null,
    })

    // ── Extract insights via Claude ───────────────────────────
    const conversationSummary = messages
      .map(m => `${m.role === 'user' ? 'User' : 'Advisor'}: ${m.content}`)
      .join('\n\n')

    const evalSummary = evaluationResult
      ? `\n\nFinal evaluation: Score ${evaluationResult.score}, Tier: ${evaluationResult.tier}\nNarrative: ${evaluationResult.narrative || 'N/A'}`
      : ''

    // NOTE: Direct Anthropic call — feature:'evaluation' not tracked in usage_logs.
    // To track costs, migrate to claude-proxy with feature: 'evaluation'.
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `${EXTRACTION_PROMPT}\n\n--- CONVERSATION ---\n${conversationSummary}${evalSummary}`,
        }],
      }),
    })

    if (!anthropicResponse.ok) {
      console.error('Insight extraction failed:', await anthropicResponse.text())
      return new Response(
        JSON.stringify({ ok: true, insights: 0, note: 'Conversation saved but insight extraction failed' }),
        { headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    const result = await anthropicResponse.json()
    const text = result.content?.[0]?.text || ''

    let insights: { insight: string; category: string }[] = []
    try {
      // Extract JSON array from response (may be wrapped in markdown code block)
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        insights = JSON.parse(jsonMatch[0])
      }
    } catch {
      console.error('Failed to parse insights JSON:', text)
    }

    // ── Store extracted insights ──────────────────────────────
    if (insights.length) {
      const rows = insights.map((item, i) => ({
        id: `insight_${conversationId}_${i}`,
        insight: item.insight,
        category: item.category || 'general',
        source_conversation_id: conversationId,
      }))

      const { error: insertError } = await supabase.from('agent_insights').upsert(rows)
      if (insertError) {
        console.error('Failed to insert insights:', insertError)
      }
    }

    // ── Audit log ─────────────────────────────────────────────
    logAudit(svc, {
      actorId: user.id, eventType: 'edge_function.call', action: 'extract-insights',
      source: 'extract-insights', status: 'success', statusCode: 200,
      ip: getClientIP(req), userAgent: getUA(req),
    })

    return new Response(
      JSON.stringify({ ok: true, insights: insights.length }),
      { headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  } catch (error) {
    console.error('extract-insights error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  }
})
