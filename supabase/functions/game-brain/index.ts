// Supabase Edge Function: game-brain
// Lightweight AI proxy for SYNTH game — the partner's brain.
// Receives compact game state, calls Claude Haiku, returns a combat directive.
// Designed for speed: Haiku is fast + cheap, response is tiny JSON.
//
// Deploy: npx supabase functions deploy game-brain --project-ref eoxxpyixdieprsxlpwcs

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders, handlePreflight, SECURITY_HEADERS } from '../_shared/cors.ts'

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-haiku-4-5-20251001'
const MAX_TOKENS = 150 // Directives are tiny JSON

interface GameBrainRequest {
  prompt: string          // Full brain prompt (state + personality + memory)
  personality?: string    // Personality ID for logging
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handlePreflight(req)

  const RESP_HEADERS = { 'Content-Type': 'application/json', ...corsHeaders(req), ...SECURITY_HEADERS }

  try {
    // Auth: require either JWT (from logged-in user) or origin check (from kernel.chat)
    const origin = req.headers.get('origin') || ''
    const referer = req.headers.get('referer') || ''
    const allowedOrigins = ['https://kernel.chat', 'https://isaacsight.github.io', 'http://localhost:5173']
    const isAllowedOrigin = allowedOrigins.some(o => origin.startsWith(o) || referer.startsWith(o))

    if (!isAllowedOrigin) {
      // Fallback: check for service role key (internal calls)
      const authHeader = req.headers.get('Authorization')
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      if (!authHeader || !serviceKey || authHeader !== `Bearer ${serviceKey}`) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: RESP_HEADERS })
      }
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 500,
        headers: RESP_HEADERS,
      })
    }

    const body = await req.json() as GameBrainRequest
    if (!body.prompt) {
      return new Response(JSON.stringify({ error: 'Missing prompt' }), {
        status: 400,
        headers: RESP_HEADERS,
      })
    }

    // Call Haiku — fast, cheap, perfect for real-time game decisions
    const anthropicRes = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        messages: [
          {
            role: 'user',
            content: body.prompt,
          },
        ],
      }),
    })

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text()
      console.error('Anthropic error:', anthropicRes.status, errText)
      return new Response(JSON.stringify({ error: 'AI unavailable' }), {
        status: 502,
        headers: RESP_HEADERS,
      })
    }

    const result = await anthropicRes.json() as {
      content: Array<{ type: string; text?: string }>
    }

    // Extract the text response
    const text = result.content?.find(b => b.type === 'text')?.text ?? ''

    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: RESP_HEADERS,
    })
  } catch (err) {
    console.error('game-brain error:', err)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: RESP_HEADERS,
    })
  }
})
