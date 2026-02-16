// Supabase Edge Function: claude-proxy
// Unified Claude API proxy — supports json, text, streaming, and web search.
//
// Deploy: npx supabase functions deploy claude-proxy --project-ref eoxxpyixdieprsxlpwcs
// Secrets: ANTHROPIC_API_KEY

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    // ── Auth: verify JWT or service key ─────────────────
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!

    // Allow service role key for server-to-server calls (e.g. Discord bot)
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const isServiceCall = serviceKey && token === serviceKey

    let user: { id: string; app_metadata?: Record<string, unknown> } | null = null

    if (isServiceCall) {
      // Service calls bypass user auth — use a synthetic user identity
      user = { id: 'service-bot', app_metadata: { is_admin: true } }
    } else {
      const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!)
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token)
      if (authError || !authUser) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
        )
      }
      user = authUser
    }

    // ── Rate limit: check daily message count ───────────
    const FREE_DAILY_LIMIT = 10
    const PRO_DAILY_LIMIT = 150
    const isAdmin = user.app_metadata?.is_admin === true

    if (!isAdmin) {
      const adminClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
      const { data: sub } = await adminClient
        .from('subscriptions')
        .select('status')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle()

      const dailyLimit = sub ? PRO_DAILY_LIMIT : FREE_DAILY_LIMIT
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const { count } = await adminClient
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', today.toISOString())

      if ((count ?? 0) >= dailyLimit) {
        const resetTime = new Date(today)
        resetTime.setDate(resetTime.getDate() + 1)
        return new Response(
          JSON.stringify({
            error: sub ? 'Daily message limit reached' : 'Free daily limit reached. Subscribe for 150 messages/day.',
            limit: dailyLimit,
            resets_at: resetTime.toISOString(),
          }),
          { status: 429, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
        )
      }
    }

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

    const anthropicHeaders = {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'pdfs-2024-09-25',
    }

    let anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: anthropicHeaders,
      body: JSON.stringify(body),
    })

    // Fallback: if haiku hits rate limit, retry with sonnet
    if (anthropicResponse.status === 429 && body.model === MODEL_MAP.haiku) {
      console.log('Haiku rate-limited, falling back to sonnet')
      body.model = MODEL_MAP.sonnet
      anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: anthropicHeaders,
        body: JSON.stringify(body),
      })
    }

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
