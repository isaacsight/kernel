// Supabase Edge Function: web-search
// Searches the web via Claude's built-in web_search tool and returns grounded results.
//
// Deploy: npx supabase functions deploy web-search --project-ref eoxxpyixdieprsxlpwcs
// Secrets: ANTHROPIC_API_KEY

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handlePreflight, SECURITY_HEADERS } from '../_shared/cors.ts'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'
import { logAudit, getClientIP, getUA } from '../_shared/audit.ts'
import { requireContentType, requireJsonBody } from '../_shared/validate.ts'

interface SearchPayload {
  query: string
  max_tokens?: number
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return handlePreflight(req)
  }

  const CORS_HEADERS = { ...corsHeaders(req), ...SECURITY_HEADERS }

  // ── Content-Type check ────────────────────────────────
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

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    // ── Rate limit (Postgres RPC) ─────────────────────────
    const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const rlCheck = await checkRateLimit(svc, user.id, 'web-search')
    if (!rlCheck.allowed) return rateLimitResponse(rlCheck, CORS_HEADERS)

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) {
      return new Response(
        JSON.stringify({ error: 'Missing ANTHROPIC_API_KEY' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    // ── Parse body with 16KB size limit ───────────────────
    const { body: payload, error: bodyErr } = await requireJsonBody<SearchPayload>(req, 16 * 1024)
    if (bodyErr) return bodyErr(CORS_HEADERS)

    const { query, max_tokens = 800 } = payload

    if (!query?.trim()) {
      return new Response(
        JSON.stringify({ error: 'query is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    const anthropicHeaders = {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
    }

    const searchBody = {
      model: 'claude-haiku-4-5-20251001',
      max_tokens,
      tools: [
        { type: 'web_search_20250305', name: 'web_search', max_uses: 3 }
      ],
      system: 'You are a web research assistant. Search the web for the user\'s query. Return factual, sourced information with URLs when available. Be concise and cite your sources.',
      messages: [
        { role: 'user', content: query },
      ],
    }

    let response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: anthropicHeaders,
      body: JSON.stringify(searchBody),
    })

    // Fallback: if haiku hits rate limit, retry with sonnet
    if (response.status === 429) {
      console.log('Haiku rate-limited, falling back to sonnet')
      searchBody.model = 'claude-sonnet-4-5-20250929'
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: anthropicHeaders,
        body: JSON.stringify(searchBody),
      })
    }

    if (!response.ok) {
      const errText = await response.text()
      console.error('Anthropic API error:', response.status, errText)
      return new Response(
        JSON.stringify({ error: 'Claude API error', details: errText }),
        { status: response.status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    const data = await response.json()

    // Extract text and citations from Claude's response
    const textBlocks = data.content?.filter((c: { type: string }) => c.type === 'text') || []
    const text = textBlocks.map((c: { text: string }) => c.text).join('')

    // Extract URLs from web_search_tool_result blocks
    const citations: string[] = []
    for (const block of data.content || []) {
      if (block.type === 'web_search_tool_result' && block.content) {
        for (const result of block.content) {
          if (result.type === 'web_search_result' && result.url) {
            citations.push(result.url)
          }
        }
      }
    }

    // ── Audit log (fire-and-forget) ───────────────────────
    logAudit(svc, {
      actorId: user.id, eventType: 'edge_function.call', action: 'web-search',
      source: 'web-search', status: 'success', statusCode: 200,
      metadata: { query: query?.substring(0, 100) },
      ip: getClientIP(req), userAgent: getUA(req),
    })

    return new Response(
      JSON.stringify({ text, citations }),
      { headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  } catch (error) {
    console.error('web-search error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  }
})
