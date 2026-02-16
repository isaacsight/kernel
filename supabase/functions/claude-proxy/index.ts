// Supabase Edge Function: claude-proxy
// Unified Claude API proxy — supports json, text, streaming, and web search.
//
// Deploy: npx supabase functions deploy claude-proxy --project-ref eoxxpyixdieprsxlpwcs
// Secrets: ANTHROPIC_API_KEY

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MODEL_MAP: Record<string, string> = {
  sonnet: 'claude-sonnet-4-5-20250929',
  haiku: 'claude-haiku-4-5-20251001',
}

interface ProxyPayload {
  mode: 'json' | 'text' | 'stream'
  model?: 'sonnet' | 'haiku'
  system?: string
  messages: { role: string; content: string | unknown[] }[]
  max_tokens?: number
  web_search?: boolean
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) {
      return new Response(
        JSON.stringify({ error: 'Missing ANTHROPIC_API_KEY' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    const payload = (await req.json()) as ProxyPayload
    const { mode = 'text', model = 'sonnet', system, messages, max_tokens = 4096, web_search = false } = payload

    if (!messages?.length) {
      return new Response(
        JSON.stringify({ error: 'messages array is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    const resolvedModel = MODEL_MAP[model] || MODEL_MAP.sonnet
    const isStream = mode === 'stream'

    const body: Record<string, unknown> = {
      model: resolvedModel,
      max_tokens,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    }
    if (system) body.system = system
    if (isStream) body.stream = true

    // Add web search tool when requested
    if (web_search) {
      body.tools = [
        { type: 'web_search_20250305', name: 'web_search', max_uses: 3 }
      ]
    }

    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'pdfs-2024-09-25',
      },
      body: JSON.stringify(body),
    })

    if (!anthropicResponse.ok) {
      const errText = await anthropicResponse.text()
      console.error('Anthropic API error:', anthropicResponse.status, errText)
      return new Response(
        JSON.stringify({ error: 'Claude API error', details: errText }),
        { status: anthropicResponse.status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    // Streaming: pipe SSE directly through
    if (isStream) {
      return new Response(anthropicResponse.body, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          ...CORS_HEADERS,
        },
      })
    }

    // Non-streaming: extract text content and return
    const result = await anthropicResponse.json()
    const textContent = result.content
      ?.filter((c: { type: string }) => c.type === 'text')
      .map((c: { text: string }) => c.text)
      .join('') || ''

    return new Response(
      JSON.stringify({ text: textContent }),
      { headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  } catch (error) {
    console.error('claude-proxy error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  }
})
