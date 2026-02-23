// Supabase Edge Function: claude-proxy (multi-provider)
// Unified LLM proxy — supports Anthropic, OpenAI, Gemini.
// All streaming output is normalized to Anthropic SSE format.
// Tracks token usage per call and alerts on high daily spend.
//
// Deploy: npx supabase functions deploy claude-proxy --project-ref eoxxpyixdieprsxlpwcs
// Secrets: ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY, NVIDIA_API_KEY

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handlePreflight, SECURITY_HEADERS } from '../_shared/cors.ts'
import { checkRateLimit as checkRL, rateLimitResponse, type Tier } from '../_shared/rate-limit.ts'
import { logAudit, getClientIP, getUA } from '../_shared/audit.ts'
import { requireContentType } from '../_shared/validate.ts'

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
  opus: 'claude-opus-4-6',
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

// ─── Pricing per 1M tokens ──────────────────────────────────

const PRICING_PER_M_TOKENS: Record<string, { input: number; output: number }> = {
  'claude-opus-4-6': { input: 15.00, output: 75.00 },
  'claude-sonnet-4-5-20250929': { input: 3.00, output: 15.00 },
  'claude-haiku-4-5-20251001': { input: 0.80, output: 4.00 },
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gemini-2.5-pro': { input: 1.25, output: 10.00 },
  'gemini-2.0-flash': { input: 0.10, output: 0.40 },
}

const DAILY_COST_ALERT_THRESHOLD = 5.00
const DAILY_COST_HARD_LIMIT = 10.00
const MAX_TOKENS_CAP = 8192
const MAX_MESSAGE_SIZE_BYTES = 32_768   // 32KB per message
const MAX_PAYLOAD_SIZE_BYTES = 262_144  // 256KB total
const MAX_SYSTEM_PROMPT_BYTES = 16_384  // 16KB system prompt cap
const STREAM_IDLE_TIMEOUT_MS = 30_000   // 30s max idle between stream chunks

// Read from a stream reader with an idle timeout per chunk.
// Rejects with an error if no data arrives within timeoutMs.
function readWithTimeout(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  timeoutMs: number,
): Promise<ReadableStreamReadResult<Uint8Array>> {
  return Promise.race([
    reader.read(),
    new Promise<never>((_, reject) => {
      const id = setTimeout(() => reject(new Error('Stream idle timeout')), timeoutMs)
      // Prevent the timer from keeping the process alive
      if (typeof id === 'object' && 'unref' in id) (id as { unref: () => void }).unref()
    }),
  ])
}

// ─── Rate limiting via Postgres RPC (replaces in-memory) ──

// ─── Pre-request daily cost check ─────────────────────────

async function checkDailyCostLimit(userId: string): Promise<{ blocked: boolean; dailyCost: number }> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const svc = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: agg } = await svc
      .from('usage_logs')
      .select('estimated_cost_usd, model')
      .eq('user_id', userId)
      .gte('created_at', since)

    if (!agg) return { blocked: false, dailyCost: 0 }

    const usageRows = agg.filter((r: { model: string }) => r.model !== '__alert_sent__')
    const dailyCost = usageRows.reduce(
      (sum: number, r: { estimated_cost_usd: number }) => sum + Number(r.estimated_cost_usd), 0,
    )

    return { blocked: dailyCost >= DAILY_COST_HARD_LIMIT, dailyCost }
  } catch {
    // Fail-open: if check fails, allow request for availability
    return { blocked: false, dailyCost: 0 }
  }
}

function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = PRICING_PER_M_TOKENS[model]
  if (!pricing) return 0
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000
}

// deno-lint-ignore no-explicit-any
function summarizeUsage(rows: any[]): string {
  const byModel: Record<string, { input: number; output: number; cost: number; calls: number }> = {}
  for (const r of rows) {
    const m = r.model
    if (!byModel[m]) byModel[m] = { input: 0, output: 0, cost: 0, calls: 0 }
    byModel[m].input += Number(r.input_tokens)
    byModel[m].output += Number(r.output_tokens)
    byModel[m].cost += Number(r.estimated_cost_usd)
    byModel[m].calls += 1
  }
  return Object.entries(byModel)
    .sort((a, b) => b[1].cost - a[1].cost)
    .map(([model, d]) => `${model}: ${d.calls} calls, ${d.input}in/${d.output}out, $${d.cost.toFixed(4)}`)
    .join('\n')
}

async function logUsageAndCheckThreshold(
  userId: string,
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
): Promise<void> {
  if (inputTokens === 0 && outputTokens === 0) return

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const cost = calculateCost(model, inputTokens, outputTokens)

  try {
    const svc = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    await svc.from('usage_logs').insert({
      user_id: userId,
      provider,
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      estimated_cost_usd: cost,
    })

    // Check daily aggregate for threshold alert
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: agg } = await svc
      .from('usage_logs')
      .select('estimated_cost_usd, model, input_tokens, output_tokens')
      .eq('user_id', userId)
      .gte('created_at', since)

    if (!agg) return

    const usageRows = agg.filter((r: { model: string }) => r.model !== '__alert_sent__')
    const dailyCost = usageRows.reduce(
      (sum: number, r: { estimated_cost_usd: number }) => sum + Number(r.estimated_cost_usd), 0,
    )
    const alreadyAlerted = agg.some((r: { model: string }) => r.model === '__alert_sent__')

    if (dailyCost >= DAILY_COST_ALERT_THRESHOLD && !alreadyAlerted) {
      // Insert cooldown marker (1 alert per user per 24h)
      await svc.from('usage_logs').insert({
        user_id: userId,
        provider: 'system',
        model: '__alert_sent__',
        input_tokens: 0,
        output_tokens: 0,
        estimated_cost_usd: 0,
      })

      // Look up user email
      const { data: { user } } = await svc.auth.admin.getUserById(userId)
      const email = user?.email ?? userId

      // Fire Discord alert via notify-webhook
      const notifyUrl = `${supabaseUrl}/functions/v1/notify-webhook`
      await fetch(notifyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          event_type: 'usage_alert',
          email,
          daily_cost_usd: dailyCost.toFixed(2),
          breakdown: summarizeUsage(usageRows),
        }),
      })

      console.log(`[usage-alert] Sent for ${email}: $${dailyCost.toFixed(2)}/day`)
    }
  } catch (err) {
    // Non-blocking — never fail the user's request
    console.error('[usage-tracking] Error:', err)
  }
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
  tools?: any[]
  // Legacy field (backward compat)
  // deno-lint-ignore no-explicit-any
  [key: string]: any
}

// ─── Anthropic handler ───────────────────────────────────────

async function handleAnthropic(
  payload: ProxyPayload,
  resolvedModel: string,
  isStream: boolean,
  userId: string | null,
  CORS_HEADERS: Record<string, string>,
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
    if (!body.tools) body.tools = []
    body.tools.push({ type: 'web_search_20250305', name: 'web_search', max_uses: 3 })
  }
  if (payload.tools && payload.tools.length > 0) {
    if (!body.tools) body.tools = []
    body.tools.push(...payload.tools)
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
      JSON.stringify({ error: 'Upstream API error', status: res.status }),
      { status: res.status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  }

  // Streaming: passthrough with usage capture from SSE events
  if (isStream) {
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let inputTokens = 0
    let outputTokens = 0

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        try {
          while (true) {
            const { done, value } = await readWithTimeout(reader, STREAM_IDLE_TIMEOUT_MS)
            if (done) break
            controller.enqueue(value)
            // Parse SSE events for usage (message_start has input, message_delta has output)
            const text = decoder.decode(value, { stream: true })
            for (const line of text.split('\n')) {
              if (!line.startsWith('data: ')) continue
              try {
                const event = JSON.parse(line.slice(6))
                if (event.type === 'message_start') {
                  inputTokens = event.message?.usage?.input_tokens ?? 0
                }
                if (event.type === 'message_delta') {
                  outputTokens = event.usage?.output_tokens ?? 0
                }
              } catch { /* non-JSON line */ }
            }
          }
        } catch (err) {
          console.error('[anthropic-stream] Error:', (err as Error).message)
          const errEvent = JSON.stringify({ type: 'error', error: { message: 'Stream timeout — upstream took too long' } })
          controller.enqueue(encoder.encode(`data: ${errEvent}\n\n`))
        } finally {
          reader.releaseLock()
          controller.close()
          if (userId) {
            logUsageAndCheckThreshold(userId, 'anthropic', resolvedModel, inputTokens, outputTokens)
              .catch(err => console.error('[usage-tracking] Stream error:', err))
          }
        }
      },
    })

    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', ...CORS_HEADERS },
    })
  }

  // Non-streaming: extract text and usage
  const result = await res.json()
  const textContent = result.content
    ?.filter((c: { type: string }) => c.type === 'text')
    .map((c: { text: string }) => c.text)
    .join('') || ''

  if (userId) {
    const inputTokens = result.usage?.input_tokens ?? 0
    const outputTokens = result.usage?.output_tokens ?? 0
    logUsageAndCheckThreshold(userId, 'anthropic', resolvedModel, inputTokens, outputTokens)
      .catch(err => console.error('[usage-tracking] Error:', err))
  }

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
  userId: string | null,
  CORS_HEADERS: Record<string, string>,
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
  if (isStream) body.stream_options = { include_usage: true }

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
      JSON.stringify({ error: 'Upstream API error', status: res.status }),
      { status: res.status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  }

  // Non-streaming: extract text and usage
  if (!isStream) {
    const result = await res.json()
    const text = result.choices?.[0]?.message?.content ?? ''

    if (userId) {
      const inputTokens = result.usage?.prompt_tokens ?? 0
      const outputTokens = result.usage?.completion_tokens ?? 0
      logUsageAndCheckThreshold(userId, 'openai', resolvedModel, inputTokens, outputTokens)
        .catch(err => console.error('[usage-tracking] Error:', err))
    }

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

  let streamInputTokens = 0
  let streamOutputTokens = 0

  const stream = new ReadableStream({
    async start(controller) {
      const decoder = new TextDecoder()
      const encoder = new TextEncoder()
      try {
        while (true) {
          const { done, value } = await readWithTimeout(reader, STREAM_IDLE_TIMEOUT_MS)
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
              // Capture usage from final chunk (stream_options.include_usage)
              if (event.usage) {
                streamInputTokens = event.usage.prompt_tokens ?? 0
                streamOutputTokens = event.usage.completion_tokens ?? 0
              }
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
      } catch (err) {
        console.error('[openai-stream] Error:', (err as Error).message)
        const errEvent = JSON.stringify({ type: 'error', error: { message: 'Stream timeout — upstream took too long' } })
        controller.enqueue(encoder.encode(`data: ${errEvent}\n\n`))
      } finally {
        reader.releaseLock()
        controller.close()
        if (userId) {
          logUsageAndCheckThreshold(userId, 'openai', resolvedModel, streamInputTokens, streamOutputTokens)
            .catch(err => console.error('[usage-tracking] Stream error:', err))
        }
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
  userId: string | null,
  CORS_HEADERS: Record<string, string>,
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
      JSON.stringify({ error: 'Upstream API error', status: res.status }),
      { status: res.status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  }

  // Non-streaming
  if (!isStream) {
    const result = await res.json()
    const text = result.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text ?? '')
      .join('') ?? ''

    if (userId) {
      const inputTokens = result.usageMetadata?.promptTokenCount ?? 0
      const outputTokens = result.usageMetadata?.candidatesTokenCount ?? 0
      logUsageAndCheckThreshold(userId, 'gemini', resolvedModel, inputTokens, outputTokens)
        .catch(err => console.error('[usage-tracking] Error:', err))
    }

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

  let streamInputTokens = 0
  let streamOutputTokens = 0

  const stream = new ReadableStream({
    async start(controller) {
      const decoder = new TextDecoder()
      const encoder = new TextEncoder()
      try {
        while (true) {
          const { done, value } = await readWithTimeout(reader, STREAM_IDLE_TIMEOUT_MS)
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n')
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6).trim()
            if (data === '[DONE]' || !data) continue
            try {
              const event = JSON.parse(data)
              // Capture usage (last chunk has totals)
              if (event.usageMetadata) {
                streamInputTokens = event.usageMetadata.promptTokenCount ?? 0
                streamOutputTokens = event.usageMetadata.candidatesTokenCount ?? 0
              }
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
      } catch (err) {
        console.error('[gemini-stream] Error:', (err as Error).message)
        const errEvent = JSON.stringify({ type: 'error', error: { message: 'Stream timeout — upstream took too long' } })
        controller.enqueue(encoder.encode(`data: ${errEvent}\n\n`))
      } finally {
        reader.releaseLock()
        controller.close()
        if (userId) {
          logUsageAndCheckThreshold(userId, 'gemini', resolvedModel, streamInputTokens, streamOutputTokens)
            .catch(err => console.error('[usage-tracking] Stream error:', err))
        }
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
  userId: string | null,
  CORS_HEADERS: Record<string, string>,
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
      JSON.stringify({ error: 'Upstream API error', status: res.status }),
      { status: res.status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  }

  // Non-streaming
  if (!isStream) {
    const result = await res.json()
    const text = result.choices?.[0]?.message?.content ?? ''

    if (userId) {
      const inputTokens = result.usage?.prompt_tokens ?? 0
      const outputTokens = result.usage?.completion_tokens ?? 0
      logUsageAndCheckThreshold(userId, 'nvidia', resolvedModel, inputTokens, outputTokens)
        .catch(err => console.error('[usage-tracking] Error:', err))
    }

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

  let streamInputTokens = 0
  let streamOutputTokens = 0

  const stream = new ReadableStream({
    async start(controller) {
      const decoder = new TextDecoder()
      const encoder = new TextEncoder()
      try {
        while (true) {
          const { done, value } = await readWithTimeout(reader, STREAM_IDLE_TIMEOUT_MS)
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
              if (event.usage) {
                streamInputTokens = event.usage.prompt_tokens ?? 0
                streamOutputTokens = event.usage.completion_tokens ?? 0
              }
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
      } catch (err) {
        console.error('[nvidia-stream] Error:', (err as Error).message)
        const errEvent = JSON.stringify({ type: 'error', error: { message: 'Stream timeout — upstream took too long' } })
        controller.enqueue(encoder.encode(`data: ${errEvent}\n\n`))
      } finally {
        reader.releaseLock()
        controller.close()
        if (userId) {
          logUsageAndCheckThreshold(userId, 'nvidia', resolvedModel, streamInputTokens, streamOutputTokens)
            .catch(err => console.error('[usage-tracking] Stream error:', err))
        }
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
    return handlePreflight(req)
  }

  const CORS_HEADERS = { ...corsHeaders(req), ...SECURITY_HEADERS }

  try {
    // ── Origin validation ──────────────────────────────
    // corsHeaders(req) already validates origin — if it's not allowed,
    // the response will default to 'https://kernel.chat'. The browser's
    // CORS enforcement handles rejection (mismatched ACAO vs Origin).
    // We log unknown origins but don't hard-reject, because returning
    // a response without matching CORS headers causes iOS Safari to
    // throw opaque "Load failed" TypeError instead of a readable error.
    const origin = req.headers.get('origin')
    if (origin && CORS_HEADERS['Access-Control-Allow-Origin'] !== origin) {
      console.warn(`[cors] Rejected origin: ${origin}`)
    }

    // ── Content-type check ───────────────────────────────
    const ctErr = requireContentType(req)
    if (ctErr) return ctErr(CORS_HEADERS)

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
    let isPaidUser = false
    if (!isServiceCall && !isAdmin) {
      const svc = createClient(supabaseUrl, serviceRoleKey!, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
      const { data: sub } = await svc
        .from('subscriptions')
        .select('status')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle()

      isPaidUser = !!sub
      if (!sub) {
        // Atomic increment-and-check via Postgres function
        // Prevents race conditions AND client-side count manipulation
        const { data: newCount, error: rpcError } = await svc.rpc('increment_message_count', {
          p_user_id: user.id,
        })
        if (rpcError) {
          console.error('[free-limit] RPC error (function may not exist yet):', rpcError.message)
          // Fallback to non-atomic read if function doesn't exist yet
          const { data: mem } = await svc
            .from('user_memory')
            .select('message_count')
            .eq('user_id', user.id)
            .maybeSingle()
          const used = mem?.message_count ?? 0
          if (used >= 10) {
            return new Response(
              JSON.stringify({ error: 'free_limit_reached', limit: 10, used }),
              { status: 403, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
            )
          }
        } else if (newCount > 10) {
          return new Response(
            JSON.stringify({ error: 'free_limit_reached', limit: 10, used: newCount }),
            { status: 403, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
          )
        }
      }
    }

    // ── Rate limiting (Postgres-backed fixed window) ────────
    if (!isServiceCall) {
      const tier: Tier = isAdmin ? 'pro' : isPaidUser ? 'paid' : 'free'
      const svcRL = createClient(supabaseUrl, serviceRoleKey!, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
      const rateCheck = await checkRL(svcRL, user.id, 'claude-proxy', tier)
      if (!rateCheck.allowed) {
        logAudit(svcRL, {
          actorId: user.id, eventType: 'edge_function.call', action: 'claude-proxy',
          source: 'claude-proxy', status: 'rate_limited', statusCode: 429,
          ip: getClientIP(req), userAgent: getUA(req),
        })
        return rateLimitResponse(rateCheck, CORS_HEADERS)
      }
    }

    // ── Daily cost hard limit ──────────────────────────────
    if (!isServiceCall && !isAdmin) {
      const costCheck = await checkDailyCostLimit(user.id)
      if (costCheck.blocked) {
        return new Response(
          JSON.stringify({
            error: 'daily_cost_limit_reached',
            daily_cost_usd: costCheck.dailyCost.toFixed(2),
            limit_usd: DAILY_COST_HARD_LIMIT.toFixed(2),
          }),
          { status: 429, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
        )
      }
    }

    // ── Parse payload ──────────────────────────────────────
    const rawBody = await req.text()
    if (rawBody.length > MAX_PAYLOAD_SIZE_BYTES) {
      return new Response(
        JSON.stringify({ error: 'Payload too large', max_bytes: MAX_PAYLOAD_SIZE_BYTES }),
        { status: 413, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }
    const payload = JSON.parse(rawBody) as ProxyPayload
    const { mode = 'text', messages } = payload

    if (!messages?.length) {
      return new Response(
        JSON.stringify({ error: 'messages array is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    // ── Validate individual message sizes ──────────────────
    for (const msg of messages) {
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
      if (content.length > MAX_MESSAGE_SIZE_BYTES) {
        return new Response(
          JSON.stringify({ error: 'Individual message too large', max_bytes: MAX_MESSAGE_SIZE_BYTES }),
          { status: 413, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
        )
      }
    }

    // ── Validate system prompt size ────────────────────────
    if (payload.system && payload.system.length > MAX_SYSTEM_PROMPT_BYTES) {
      return new Response(
        JSON.stringify({ error: 'System prompt too large', max_bytes: MAX_SYSTEM_PROMPT_BYTES }),
        { status: 413, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    // ── Cap max_tokens server-side ─────────────────────────
    if (payload.max_tokens) {
      payload.max_tokens = Math.min(payload.max_tokens, MAX_TOKENS_CAP)
    }

    // ── Enforce model tiers: free users locked to fast tier ─
    if (!isServiceCall && !isPaidUser && !isAdmin) {
      payload.tier = 'fast'
      // Override any explicit model to the fast-tier equivalent
      if (payload.model && !['haiku', 'gpt-4o-mini', 'gemini-2.0-flash'].includes(payload.model as string)) {
        payload.model = undefined
      }
      // Disable web_search for free users (extra API cost)
      payload.web_search = false
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

    // Only track usage for real authenticated users (skip service/bot calls)
    const trackUserId = isServiceCall ? null : user.id

    // ── Audit log ────────────────────────────────────────
    {
      const svcAudit = createClient(supabaseUrl, serviceRoleKey!, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
      logAudit(svcAudit, {
        actorId: isServiceCall ? undefined : user.id,
        actorType: isServiceCall ? 'service' : 'user',
        eventType: 'edge_function.call',
        action: 'claude-proxy',
        source: 'claude-proxy',
        status: 'success',
        statusCode: 200,
        metadata: { provider, model: resolvedModel, mode, tier: payload.tier },
        ip: getClientIP(req),
        userAgent: getUA(req),
      })
    }

    // ── Dispatch to provider handler ───────────────────────
    switch (provider) {
      case 'anthropic':
        return handleAnthropic(payload, resolvedModel, isStream, trackUserId, CORS_HEADERS)
      case 'openai':
        return handleOpenAI(payload, resolvedModel, isStream, trackUserId, CORS_HEADERS)
      case 'gemini':
        return handleGemini(payload, resolvedModel, isStream, trackUserId, CORS_HEADERS)
      case 'nvidia':
        return handleNvidia(payload, resolvedModel, isStream, trackUserId, CORS_HEADERS)
      default:
        return new Response(
          JSON.stringify({ error: `Unknown provider: ${provider}` }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
        )
    }
  } catch (error) {
    console.error('claude-proxy error:', error)
    try {
      const svcErr = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
      logAudit(svcErr, {
        eventType: 'system.alert', action: 'claude-proxy-error',
        source: 'claude-proxy', status: 'error', statusCode: 500,
        metadata: { error: (error as Error).message },
        ip: getClientIP(req), userAgent: getUA(req),
      })
    } catch { /* audit best-effort */ }
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  }
})
