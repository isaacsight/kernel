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
const MAX_MESSAGE_SIZE_BYTES = 52_428_800  // 50MB per message (base64 files)
const MAX_PAYLOAD_SIZE_BYTES = 52_428_800  // 50MB total payload
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

// ─── Error classification & auto-refund ─────────────────────

type ErrorType = 'upstream_5xx' | 'timeout' | 'missing_key' | 'internal' | 'user_error'

function classifyError(status: number, message: string): ErrorType {
  if (message.includes('timeout') || message.includes('Timeout') || message.includes('idle timeout')) return 'timeout'
  if (message.includes('Missing') && message.includes('KEY')) return 'missing_key'
  if (status >= 500 && status < 600) return 'upstream_5xx'
  // 400-level errors from upstream are still platform errors if they're
  // not caused by user input (e.g. Anthropic overloaded returns 529)
  if (status === 529) return 'upstream_5xx'
  // 401/403 from upstream = our key is bad, not user's fault
  if (status === 401 || status === 403) return 'missing_key'
  // Content policy / bad request = user error, no refund
  if (status === 400) return 'user_error'
  if (status === 413) return 'user_error'
  return 'internal'
}

function isPlatformError(errorType: ErrorType): boolean {
  return errorType !== 'user_error'
}

/**
 * Record a platform error and auto-refund the user's daily message if it was our fault.
 * Fire-and-forget — never blocks or throws.
 */
async function recordErrorAndRefund(
  userId: string | null,
  provider: string,
  model: string,
  errorType: ErrorType,
  errorMessage: string,
  httpStatus: number,
): Promise<{ refunded: boolean; dailyCount?: number; resetsAt?: string }> {
  if (!userId || userId === 'service-bot') return { refunded: false }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const svc = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const shouldRefund = isPlatformError(errorType)

    // Record the error
    await svc.from('platform_errors').insert({
      user_id: userId,
      provider,
      model,
      error_type: errorType,
      error_message: errorMessage.slice(0, 500),
      http_status: httpStatus,
      refunded: shouldRefund,
    })

    // Refund if platform error
    if (shouldRefund) {
      const { data: refundResult } = await svc.rpc('refund_message', { p_user_id: userId })

      // Notify user of the refund (in-app)
      await svc.from('notifications').insert({
        user_id: userId,
        title: 'Message refunded',
        body: `Something went wrong on our end. Your message has been refunded automatically.`,
        type: 'refund',
      })

      console.log(`[refund] user=${userId} provider=${provider} error=${errorType} refunded=true daily_count=${refundResult?.daily_count}`)
      return {
        refunded: true,
        dailyCount: refundResult?.daily_count,
        resetsAt: refundResult?.resets_at,
      }
    }

    return { refunded: false }
  } catch (err) {
    console.error('[refund] Error recording/refunding:', err)
    return { refunded: false }
  }
}

// ─── Smart retry matrix ─────────────────────────────────────

interface RetryConfig {
  retry: boolean
  maxRetries: number
  baseDelayMs: number
  switchProvider: boolean
}

const RETRY_MATRIX: Record<ErrorType, RetryConfig> = {
  upstream_5xx:  { retry: true,  maxRetries: 1, baseDelayMs: 300,  switchProvider: false },
  timeout:       { retry: true,  maxRetries: 1, baseDelayMs: 500,  switchProvider: true },
  internal:      { retry: true,  maxRetries: 1, baseDelayMs: 0,    switchProvider: true },
  missing_key:   { retry: false, maxRetries: 0, baseDelayMs: 0,    switchProvider: false },
  user_error:    { retry: false, maxRetries: 0, baseDelayMs: 0,    switchProvider: false },
}

// Provider fallback order: prefer highest-quality alternatives
const PROVIDER_FALLBACKS: Record<Provider, Provider[]> = {
  anthropic: ['openai', 'gemini'],
  openai:    ['anthropic', 'gemini'],
  gemini:    ['anthropic', 'openai'],
  nvidia:    ['openai', 'anthropic'],
}

function jitteredDelay(baseMs: number): number {
  return baseMs + Math.floor(Math.random() * baseMs)
}

// ─── Provider health scoring ────────────────────────────────

interface ProviderScore {
  score: number
  total: number
  errors: number
  timeouts: number
  refunds: number
}

// In-memory cache — refreshed every 60s to avoid DB round-trip per request
let _providerScoresCache: Record<string, ProviderScore> = {}
let _providerScoresCacheTime = 0
const SCORE_CACHE_TTL_MS = 60_000  // 1 minute

async function getProviderScores(): Promise<Record<string, ProviderScore>> {
  if (Date.now() - _providerScoresCacheTime < SCORE_CACHE_TTL_MS && Object.keys(_providerScoresCache).length > 0) {
    return _providerScoresCache
  }

  try {
    const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data } = await svc.rpc('get_provider_scores', { p_window: '15m' })
    if (data && typeof data === 'object') {
      _providerScoresCache = data as Record<string, ProviderScore>
      _providerScoresCacheTime = Date.now()
    }
  } catch (err) {
    console.warn('[provider-health] Failed to fetch scores (using cache):', err)
  }

  return _providerScoresCache
}

/**
 * Pick the best fallback provider based on health scores.
 * Returns null if no healthy fallback available.
 */
async function pickFallbackProvider(
  failedProvider: Provider,
  tier: string,
): Promise<{ provider: Provider; model: string } | null> {
  const fallbacks = PROVIDER_FALLBACKS[failedProvider]
  if (!fallbacks.length) return null

  const scores = await getProviderScores()

  // Filter to providers that have the API key configured and score > 50
  const candidates: { provider: Provider; score: number }[] = []
  for (const p of fallbacks) {
    const keyName = p === 'anthropic' ? 'ANTHROPIC_API_KEY'
      : p === 'openai' ? 'OPENAI_API_KEY'
      : p === 'gemini' ? 'GEMINI_API_KEY'
      : 'NVIDIA_API_KEY'
    if (!Deno.env.get(keyName)) continue

    const pScore = scores[p]?.score ?? 100
    if (pScore > 50) {
      candidates.push({ provider: p, score: pScore })
    }
  }

  if (candidates.length === 0) return null

  // Sort by score descending — pick the healthiest
  candidates.sort((a, b) => b.score - a.score)
  const best = candidates[0]
  const model = resolveModel(best.provider, tier)

  return { provider: best.provider, model }
}

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
    const errType = classifyError(res.status, errText)
    const refund = await recordErrorAndRefund(userId, 'anthropic', resolvedModel, errType, errText, res.status)
    return new Response(
      JSON.stringify({ error: 'Upstream API error', status: res.status, refunded: refund.refunded, daily_count: refund.dailyCount }),
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
          const errMsg = (err as Error).message || 'Stream timeout'
          const errType = classifyError(0, errMsg)
          const refund = await recordErrorAndRefund(userId, 'anthropic', resolvedModel, errType, errMsg, 0)
          const errEvent = JSON.stringify({ type: 'error', error: { message: 'Stream timeout — upstream took too long', refunded: refund.refunded, daily_count: refund.dailyCount } })
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
    const errType = classifyError(res.status, errText)
    const refund = await recordErrorAndRefund(userId, 'openai', resolvedModel, errType, errText, res.status)
    return new Response(
      JSON.stringify({ error: 'Upstream API error', status: res.status, refunded: refund.refunded, daily_count: refund.dailyCount }),
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
        const errMsg = (err as Error).message || 'Stream timeout'
        const errType = classifyError(0, errMsg)
        const refund = await recordErrorAndRefund(userId, 'openai', resolvedModel, errType, errMsg, 0)
        const errEvent = JSON.stringify({ type: 'error', error: { message: 'Stream timeout — upstream took too long', refunded: refund.refunded, daily_count: refund.dailyCount } })
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
    const errType = classifyError(res.status, errText)
    const refund = await recordErrorAndRefund(userId, 'gemini', resolvedModel, errType, errText, res.status)
    return new Response(
      JSON.stringify({ error: 'Upstream API error', status: res.status, refunded: refund.refunded, daily_count: refund.dailyCount }),
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
        const errMsg = (err as Error).message || 'Stream timeout'
        const errType = classifyError(0, errMsg)
        const refund = await recordErrorAndRefund(userId, 'gemini', resolvedModel, errType, errMsg, 0)
        const errEvent = JSON.stringify({ type: 'error', error: { message: 'Stream timeout — upstream took too long', refunded: refund.refunded, daily_count: refund.dailyCount } })
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
    const errType = classifyError(res.status, errText)
    const refund = await recordErrorAndRefund(userId, 'nvidia', resolvedModel, errType, errText, res.status)
    return new Response(
      JSON.stringify({ error: 'Upstream API error', status: res.status, refunded: refund.refunded, daily_count: refund.dailyCount }),
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
        const errMsg = (err as Error).message || 'Stream timeout'
        const errType = classifyError(0, errMsg)
        const refund = await recordErrorAndRefund(userId, 'nvidia', resolvedModel, errType, errMsg, 0)
        const errEvent = JSON.stringify({ type: 'error', error: { message: 'Stream timeout — upstream took too long', refunded: refund.refunded, daily_count: refund.dailyCount } })
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

    // ── Parse payload early (needed for free-tier streak check) ──
    const rawBody = await req.text()
    if (rawBody.length > MAX_PAYLOAD_SIZE_BYTES) {
      return new Response(
        JSON.stringify({ error: 'Payload too large', max_bytes: MAX_PAYLOAD_SIZE_BYTES }),
        { status: 413, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }
    const payload = JSON.parse(rawBody) as ProxyPayload

    // ── Grace Shield: check limit WITHOUT charging (charge on success) ───
    // Streak bonus: +1 message for users with 3+ day companion streak
    const clientStreak = typeof payload.streak === 'number' ? Math.max(0, Math.min(payload.streak, 365)) : 0
    const FREE_LIMIT = 20 + (clientStreak >= 3 ? 1 : 0)
    const isAdmin = !!user.app_metadata?.is_admin
    let isPaidUser = false
    let isFreeUser = false
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
      isFreeUser = !sub
      if (isFreeUser) {
        // Grace Shield: READ-ONLY check — don't charge yet
        // Message will be charged AFTER successful provider response
        const { data: limitCheck, error: limitErr } = await svc.rpc('check_message_limit', {
          p_user_id: user.id,
        })
        if (limitErr) {
          console.error('[grace-shield] check_message_limit error:', limitErr.message)
          // Fallback to direct read
          const { data: mem } = await svc
            .from('user_memory')
            .select('daily_message_count')
            .eq('user_id', user.id)
            .maybeSingle()
          const used = mem?.daily_message_count ?? 0
          if (used >= FREE_LIMIT) {
            return new Response(
              JSON.stringify({ error: 'free_limit_reached', limit: FREE_LIMIT, used }),
              { status: 403, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
            )
          }
        } else if (limitCheck?.daily_count >= FREE_LIMIT) {
          // Already at limit — block before even trying
          const resetTime = limitCheck.resets_at
            ? new Date(limitCheck.resets_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
            : 'soon'
          // Notify on first overage attempt
          svc.from('notifications').insert({
            user_id: user.id,
            title: 'Daily messages used',
            body: `You've used all ${FREE_LIMIT} free messages. They reset at ${resetTime}.`,
            type: 'info',
          }).then(() => {}).catch(() => {})
          const notifUrl = `${supabaseUrl}/functions/v1/send-notification`
          fetch(notifUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceRoleKey}` },
            body: JSON.stringify({
              channel: 'push', user_id: user.id,
              title: 'Your messages reset ' + resetTime,
              body: `Your ${FREE_LIMIT} daily messages will be available again at ${resetTime}.`,
              type: 'info',
            }),
          }).catch(() => {})
          return new Response(
            JSON.stringify({ error: 'free_limit_reached', limit: FREE_LIMIT, used: limitCheck.daily_count, resets_at: limitCheck.resets_at }),
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

    // ── Validate parsed payload ─────────────────────────────
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

    // ── Message state tracking + post-success charge ────────

    const msgStartTime = Date.now()
    let messageStateId: string | null = null

    // Record message state: PENDING
    async function recordMessageState(state: string, extra: Record<string, unknown> = {}): Promise<string | null> {
      try {
        const svcState = createClient(supabaseUrl, serviceRoleKey!, { auth: { persistSession: false, autoRefreshToken: false } })
        if (messageStateId) {
          await svcState.from('message_states').update({
            state, resolved_at: state === 'pending' || state === 'streaming' ? null : new Date().toISOString(),
            duration_ms: Date.now() - msgStartTime, ...extra,
          }).eq('id', messageStateId)
          return messageStateId
        }
        const { data } = await svcState.from('message_states').insert({
          user_id: isServiceCall ? null : user.id, provider, model: resolvedModel,
          state, attempt: 1, ...extra,
        }).select('id').single()
        return data?.id ?? null
      } catch { return null }
    }

    // Charge message AFTER success (Grace Shield)
    async function chargeMessageOnSuccess(): Promise<void> {
      if (!isFreeUser || isServiceCall || isAdmin) return
      try {
        const svcCharge = createClient(supabaseUrl, serviceRoleKey!, { auth: { persistSession: false, autoRefreshToken: false } })
        await svcCharge.rpc('increment_message_count', { p_user_id: user.id })
        console.log(`[grace-shield] Charged message post-success for user=${user.id}`)
      } catch (err) {
        console.error('[grace-shield] Post-success charge failed:', err)
      }
    }

    messageStateId = await recordMessageState('pending')

    // ── Dispatch to provider handler (with smart retry) ────

    function dispatchProvider(p: Provider, m: string): Promise<Response> {
      switch (p) {
        case 'anthropic': return handleAnthropic(payload, m, isStream, trackUserId, CORS_HEADERS)
        case 'openai':    return handleOpenAI(payload, m, isStream, trackUserId, CORS_HEADERS)
        case 'gemini':    return handleGemini(payload, m, isStream, trackUserId, CORS_HEADERS)
        case 'nvidia':    return handleNvidia(payload, m, isStream, trackUserId, CORS_HEADERS)
        default:
          return Promise.resolve(new Response(
            JSON.stringify({ error: `Unknown provider: ${p}` }),
            { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
          ))
      }
    }

    // First attempt with the requested provider
    await recordMessageState('streaming')
    const firstResponse = await dispatchProvider(provider, resolvedModel)

    // If successful: charge the message and return
    if (firstResponse.ok) {
      await recordMessageState('success')
      chargeMessageOnSuccess().catch(() => {})  // fire-and-forget
      return firstResponse
    }

    // Streaming errors are handled within the stream handlers
    if (isStream) return firstResponse

    // Parse the error to determine if we should retry
    const errBody = await firstResponse.clone().text()
    let errParsed: { error?: string; status?: number; refunded?: boolean } = {}
    try { errParsed = JSON.parse(errBody) } catch { /* raw text */ }

    const errStatus = errParsed.status ?? firstResponse.status
    const errMsg = errParsed.error ?? errBody
    const errType = classifyError(errStatus, errMsg)
    const retryConfig = RETRY_MATRIX[errType]

    // If not retryable, return the original error response
    if (!retryConfig.retry) return firstResponse

    console.log(`[retry] ${provider}/${resolvedModel} failed (${errType}), attempting retry...`)

    // Delay with jitter before retry
    if (retryConfig.baseDelayMs > 0) {
      await new Promise(r => setTimeout(r, jitteredDelay(retryConfig.baseDelayMs)))
    }

    // Decide: retry same provider or switch?
    let retryProvider = provider
    let retryModel = resolvedModel

    if (retryConfig.switchProvider) {
      const fallback = await pickFallbackProvider(provider, payload.tier ?? 'strong')
      if (fallback) {
        retryProvider = fallback.provider
        retryModel = fallback.model
        console.log(`[retry] Switching to fallback: ${retryProvider}/${retryModel}`)
      } else {
        console.log(`[retry] No healthy fallback — retrying same provider`)
      }
    }

    const retryResponse = await dispatchProvider(retryProvider, retryModel)

    if (retryResponse.ok) {
      console.log(`[retry] SUCCESS on retry with ${retryProvider}/${retryModel}`)
      await recordMessageState('success', { attempt: 2, retry_provider: retryProvider })
      chargeMessageOnSuccess().catch(() => {})
    } else {
      await recordMessageState('failed_platform', { attempt: 2, retry_provider: retryProvider, error_type: errType })
    }

    return retryResponse
  } catch (error) {
    console.error('claude-proxy error:', error)
    // Try to extract userId from the request context for refund
    let refundResult = { refunded: false, dailyCount: undefined as number | undefined }
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
      // Attempt refund — extract user from JWT if possible
      const token = req.headers.get('authorization')?.replace('Bearer ', '')
      if (token) {
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
        const tmpClient = createClient(Deno.env.get('SUPABASE_URL')!, anonKey)
        const { data: { user: errUser } } = await tmpClient.auth.getUser(token)
        if (errUser) {
          refundResult = await recordErrorAndRefund(errUser.id, 'unknown', 'unknown', 'internal', (error as Error).message, 500)
        }
      }
    } catch { /* audit/refund best-effort */ }
    return new Response(
      JSON.stringify({ error: 'Internal server error', refunded: refundResult.refunded, daily_count: refundResult.dailyCount }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  }
})
