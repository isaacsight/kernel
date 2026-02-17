// Supabase Edge Function: claude-proxy (multi-provider)
// Unified LLM proxy — supports Anthropic, OpenAI, Gemini.
// All streaming output is normalized to Anthropic SSE format.
//
// Deploy: npx supabase functions deploy claude-proxy --project-ref eoxxpyixdieprsxlpwcs
// Secrets: ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY, NVIDIA_API_KEY

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── Model tier mapping ──────────────────────────────────────

type Provider = 'anthropic' | 'openai' | 'gemini' | 'nvidia'

const TIER_MODELS: Record<Provider, Record<string, string>> = {
  anthropic: {
    fast: 'claude-haiku-4-5-20251001',
    strong: 'claude-sonnet-4-5-20250929',
  },
  openai: {
    fast: 'gpt-4o-mini',
    strong: 'gpt-4o',
  },
  gemini: {
    fast: 'gemini-2.0-flash',
    strong: 'gemini-2.5-pro',
  },
  nvidia: {
    fast: 'meta/llama-3.1-8b-instruct',
    strong: 'meta/llama-3.3-70b-instruct',
  },
}

// Legacy model names (backward compat with existing 'sonnet'/'haiku' callers)
const LEGACY_MODEL_MAP: Record<string, string> = {
  sonnet: 'claude-sonnet-4-5-20250929',
  haiku: 'claude-haiku-4-5-20251001',
}

function resolveModel(provider: Provider, tier?: string, model?: string, legacyModel?: string): string {
  // Explicit model override takes priority
  if (model) return model
  // Legacy 'sonnet'/'haiku' for backward compat (anthropic only)
  if (legacyModel && provider === 'anthropic' && LEGACY_MODEL_MAP[legacyModel]) {
    return LEGACY_MODEL_MAP[legacyModel]
  }
  // Tier-based resolution
  const tierMap = TIER_MODELS[provider]
  return tierMap[tier ?? 'strong'] ?? tierMap.strong
}

// ─── Payload type ────────────────────────────────────────────

interface ProxyPayload {
  mode: 'json' | 'text' | 'stream'
  provider?: Provider
  tier?: 'fast' | 'strong'
  model?: string               // explicit model override
  system?: string
  messages: { role: string; content: string | unknown[] }[]
  max_tokens?: number
  web_search?: boolean
  // Legacy field (backward compat)
  // deno-lint-ignore no-explicit-any
  [key: string]: any
}

// ─── Anthropic handler ───────────────────────────────────────

async function handleAnthropic(
  payload: ProxyPayload,
  resolvedModel: string,
  isStream: boolean,
): Promise<Response> {
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!anthropicKey) {
    return new Response(
      JSON.stringify({ error: 'Missing ANTHROPIC_API_KEY' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  }

  const body: Record<string, unknown> = {
    model: resolvedModel,
    max_tokens: payload.max_tokens ?? 4096,
    messages: payload.messages.map(m => ({ role: m.role, content: m.content })),
  }
  if (payload.system) body.system = payload.system
  if (isStream) body.stream = true
  if (payload.web_search) {
    body.tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }]
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'pdfs-2024-09-25',
    },
    body: JSON.stringify(body),
  })

  if (res.status === 429) {
    const retryAfter = res.headers.get('retry-after') || '60'
    return new Response(
      JSON.stringify({ error: 'rate_limited', retry_after: parseInt(retryAfter), model: resolvedModel }),
      { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': retryAfter, ...CORS_HEADERS } }
    )
  }

  if (!res.ok) {
    const errText = await res.text()
    console.error('Anthropic API error:', res.status, errText)
    return new Response(
      JSON.stringify({ error: 'Anthropic API error', details: errText }),
      { status: res.status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  }

  // Streaming: Anthropic SSE is already in our normalized format — pipe through
  if (isStream) {
    return new Response(res.body, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', ...CORS_HEADERS },
    })
  }

  // Non-streaming: extract text
  const result = await res.json()
  const textContent = result.content
    ?.filter((c: { type: string }) => c.type === 'text')
    .map((c: { text: string }) => c.text)
    .join('') || ''

  return new Response(
    JSON.stringify({ text: textContent }),
    { headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
  )
}

// ─── OpenAI handler ──────────────────────────────────────────

async function handleOpenAI(
  payload: ProxyPayload,
  resolvedModel: string,
  isStream: boolean,
): Promise<Response> {
  const openaiKey = Deno.env.get('OPENAI_API_KEY')
  if (!openaiKey) {
    return new Response(
      JSON.stringify({ error: 'Missing OPENAI_API_KEY' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  }

  const messages: { role: string; content: string | unknown[] }[] = []
  if (payload.system) {
    messages.push({ role: 'system', content: payload.system })
  }
  for (const m of payload.messages) {
    messages.push({ role: m.role, content: m.content })
  }

  const body: Record<string, unknown> = {
    model: resolvedModel,
    max_tokens: payload.max_tokens ?? 4096,
    messages,
    stream: isStream,
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (res.status === 429) {
    const retryAfter = res.headers.get('retry-after') || '60'
    return new Response(
      JSON.stringify({ error: 'rate_limited', retry_after: parseInt(retryAfter), model: resolvedModel }),
      { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': retryAfter, ...CORS_HEADERS } }
    )
  }

  if (!res.ok) {
    const errText = await res.text()
    console.error('OpenAI API error:', res.status, errText)
    return new Response(
      JSON.stringify({ error: 'OpenAI API error', details: errText }),
      { status: res.status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  }

  // Non-streaming: extract text, return normalized
  if (!isStream) {
    const result = await res.json()
    const text = result.choices?.[0]?.message?.content ?? ''
    return new Response(
      JSON.stringify({ text }),
      { headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  }

  // Streaming: transform OpenAI SSE → normalized Anthropic SSE format
  const reader = res.body?.getReader()
  if (!reader) {
    return new Response(
      JSON.stringify({ error: 'No readable stream from OpenAI' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  }

  const stream = new ReadableStream({
    async start(controller) {
      const decoder = new TextDecoder()
      const encoder = new TextEncoder()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n')
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6).trim()
            if (data === '[DONE]') {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'))
              continue
            }
            try {
              const event = JSON.parse(data)
              const delta = event.choices?.[0]?.delta?.content
              if (delta) {
                const normalized = JSON.stringify({
                  type: 'content_block_delta',
                  delta: { text: delta },
                })
                controller.enqueue(encoder.encode(`data: ${normalized}\n\n`))
              }
            } catch {
              // skip
            }
          }
        }
      } finally {
        reader.releaseLock()
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', ...CORS_HEADERS },
  })
}

// ─── Gemini handler ──────────────────────────────────────────

async function handleGemini(
  payload: ProxyPayload,
  resolvedModel: string,
  isStream: boolean,
): Promise<Response> {
  const geminiKey = Deno.env.get('GEMINI_API_KEY')
  if (!geminiKey) {
    return new Response(
      JSON.stringify({ error: 'Missing GEMINI_API_KEY' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  }

  // Build Gemini-format messages
  const contents: { role: string; parts: { text: string }[] }[] = []
  for (const m of payload.messages) {
    const text = typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
    contents.push({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text }],
    })
  }

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      maxOutputTokens: payload.max_tokens ?? 4096,
    },
  }

  if (payload.system) {
    body.systemInstruction = { parts: [{ text: payload.system }] }
  }

  const action = isStream ? 'streamGenerateContent' : 'generateContent'
  const streamParam = isStream ? '&alt=sse' : ''
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${resolvedModel}:${action}?key=${geminiKey}${streamParam}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (res.status === 429) {
    return new Response(
      JSON.stringify({ error: 'rate_limited', retry_after: 60, model: resolvedModel }),
      { status: 429, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  }

  if (!res.ok) {
    const errText = await res.text()
    console.error('Gemini API error:', res.status, errText)
    return new Response(
      JSON.stringify({ error: 'Gemini API error', details: errText }),
      { status: res.status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  }

  // Non-streaming
  if (!isStream) {
    const result = await res.json()
    const text = result.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text ?? '')
      .join('') ?? ''
    return new Response(
      JSON.stringify({ text }),
      { headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  }

  // Streaming: transform Gemini SSE → normalized Anthropic SSE format
  const reader = res.body?.getReader()
  if (!reader) {
    return new Response(
      JSON.stringify({ error: 'No readable stream from Gemini' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  }

  const stream = new ReadableStream({
    async start(controller) {
      const decoder = new TextDecoder()
      const encoder = new TextEncoder()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n')
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6).trim()
            if (data === '[DONE]' || !data) continue
            try {
              const event = JSON.parse(data)
              const parts = event.candidates?.[0]?.content?.parts
              if (parts) {
                for (const part of parts) {
                  if (part.text) {
                    const normalized = JSON.stringify({
                      type: 'content_block_delta',
                      delta: { text: part.text },
                    })
                    controller.enqueue(encoder.encode(`data: ${normalized}\n\n`))
                  }
                }
              }
            } catch {
              // skip
            }
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      } finally {
        reader.releaseLock()
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', ...CORS_HEADERS },
  })
}

// ─── NVIDIA handler (OpenAI-compatible) ──────────────────────

async function handleNvidia(
  payload: ProxyPayload,
  resolvedModel: string,
  isStream: boolean,
): Promise<Response> {
  const nvidiaKey = Deno.env.get('NVIDIA_API_KEY')
  if (!nvidiaKey) {
    return new Response(
      JSON.stringify({ error: 'Missing NVIDIA_API_KEY' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  }

  const messages: { role: string; content: string | unknown[] }[] = []
  if (payload.system) {
    messages.push({ role: 'system', content: payload.system })
  }
  for (const m of payload.messages) {
    messages.push({ role: m.role, content: m.content })
  }

  const body: Record<string, unknown> = {
    model: resolvedModel,
    max_tokens: payload.max_tokens ?? 4096,
    messages,
    stream: isStream,
  }

  const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${nvidiaKey}`,
    },
    body: JSON.stringify(body),
  })

  if (res.status === 429) {
    const retryAfter = res.headers.get('retry-after') || '60'
    return new Response(
      JSON.stringify({ error: 'rate_limited', retry_after: parseInt(retryAfter), model: resolvedModel }),
      { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': retryAfter, ...CORS_HEADERS } }
    )
  }

  if (!res.ok) {
    const errText = await res.text()
    console.error('NVIDIA API error:', res.status, errText)
    return new Response(
      JSON.stringify({ error: 'NVIDIA API error', details: errText }),
      { status: res.status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  }

  // Non-streaming
  if (!isStream) {
    const result = await res.json()
    const text = result.choices?.[0]?.message?.content ?? ''
    return new Response(
      JSON.stringify({ text }),
      { headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  }

  // Streaming: transform OpenAI-format SSE → normalized Anthropic SSE
  const reader = res.body?.getReader()
  if (!reader) {
    return new Response(
      JSON.stringify({ error: 'No readable stream from NVIDIA' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  }

  const stream = new ReadableStream({
    async start(controller) {
      const decoder = new TextDecoder()
      const encoder = new TextEncoder()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n')
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6).trim()
            if (data === '[DONE]') {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'))
              continue
            }
            try {
              const event = JSON.parse(data)
              const delta = event.choices?.[0]?.delta?.content
              if (delta) {
                const normalized = JSON.stringify({
                  type: 'content_block_delta',
                  delta: { text: delta },
                })
                controller.enqueue(encoder.encode(`data: ${normalized}\n\n`))
              }
            } catch {
              // skip
            }
          }
        }
      } finally {
        reader.releaseLock()
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', ...CORS_HEADERS },
  })
}

// ─── Main handler ────────────────────────────────────────────

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

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const botSecret = Deno.env.get('BOT_API_SECRET')
    const isServiceCall = (serviceRoleKey && token === serviceRoleKey) || (botSecret && token === botSecret)

    let user: { id: string; app_metadata?: Record<string, unknown> } | null = null

    if (isServiceCall) {
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

    // ── Free-tier limit: 10 messages for non-subscribers ───
    const isAdmin = !!user.app_metadata?.is_admin
    if (!isServiceCall && !isAdmin) {
      const svc = createClient(supabaseUrl, serviceRoleKey!, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
      const [{ data: mem }, { data: sub }] = await Promise.all([
        svc.from('user_memory').select('message_count').eq('user_id', user.id).maybeSingle(),
        svc.from('subscriptions').select('status').eq('user_id', user.id).eq('status', 'active').maybeSingle(),
      ])
      if (!sub) {
        const used = mem?.message_count ?? 0
        if (used >= 10) {
          return new Response(
            JSON.stringify({ error: 'free_limit_reached', limit: 10, used }),
            { status: 403, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
          )
        }
      }
    }

    // ── Parse payload ──────────────────────────────────────
    const payload = (await req.json()) as ProxyPayload
    const { mode = 'text', messages } = payload

    if (!messages?.length) {
      return new Response(
        JSON.stringify({ error: 'messages array is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    // Determine provider (default: anthropic for backward compat)
    const provider: Provider = (payload.provider as Provider) || 'anthropic'
    const isStream = mode === 'stream'

    // Resolve model: check if payload.model is a legacy name ('sonnet'/'haiku')
    // or an explicit model ID. Legacy names are handled by resolveModel.
    const rawModel = payload.model as string | undefined
    const isLegacyName = rawModel && LEGACY_MODEL_MAP[rawModel]
    const resolvedModel = resolveModel(
      provider,
      payload.tier,
      isLegacyName ? undefined : rawModel,  // explicit model (not legacy)
      isLegacyName ? rawModel : undefined,   // legacy model name
    )

    console.log(`[proxy] provider=${provider} model=${resolvedModel} mode=${mode}`)

    // ── Dispatch to provider handler ───────────────────────
    switch (provider) {
      case 'anthropic':
        return handleAnthropic(payload, resolvedModel, isStream)
      case 'openai':
        return handleOpenAI(payload, resolvedModel, isStream)
      case 'gemini':
        return handleGemini(payload, resolvedModel, isStream)
      case 'nvidia':
        return handleNvidia(payload, resolvedModel, isStream)
      default:
        return new Response(
          JSON.stringify({ error: `Unknown provider: ${provider}` }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
        )
    }
  } catch (error) {
    console.error('claude-proxy error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  }
})
