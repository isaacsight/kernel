// kbot Self-Evaluation Loop — Ragas-inspired response quality assessment
//
// Evaluates agent responses on two axes (inspired by Ragas framework):
//   1. FAITHFULNESS — does the response stay true to the provided context?
//   2. RELEVANCY — does the response actually address the user's question?
//
// Uses the provider's fast/cheap model to minimize cost (~200 token prompt).
// Disabled by default. Enable via --self-eval flag or config.
//
// Flow: generate → evaluate → retry if below threshold → return best attempt

import {
  getByokKey, getByokProvider, getProvider, getProviderModel,
  type ByokProvider, type ProviderConfig,
} from './auth.js'

// ── Types ──

export interface EvalResult {
  /** 0-1: does the response contradict or fabricate beyond the context? */
  faithfulness: number
  /** 0-1: does the response address the user's question? */
  relevancy: number
  /** 0-1: weighted average (faithfulness 0.4, relevancy 0.6) */
  overall: number
  /** true if overall < 0.4 — response should be regenerated */
  shouldRetry: boolean
  /** Actionable feedback for retry (only present when shouldRetry is true) */
  feedback?: string
}

/** Function signature for an LLM call used by the evaluator */
export type EvalCallFn = (prompt: string) => Promise<string>

// ── State ──

let selfEvalEnabled = false

/** Enable or disable the self-evaluation loop */
export function setSelfEvalEnabled(enabled: boolean): void {
  selfEvalEnabled = enabled
}

/** Check if self-evaluation is currently enabled */
export function isSelfEvalEnabled(): boolean {
  return selfEvalEnabled
}

// ── Evaluation Prompt ──

const RETRY_THRESHOLD = 0.4

/** Build the ~200-token evaluation prompt */
function buildEvalPrompt(query: string, response: string, context?: string): string {
  // Truncate inputs aggressively to keep the eval call cheap
  const q = query.slice(0, 300)
  const r = response.slice(0, 800)
  const c = context ? context.slice(0, 500) : ''

  const contextLine = c
    ? `Context: ${c}\n`
    : ''

  return `Score this response on a 1-5 scale for each criterion.
${contextLine}Question: ${q}
Response: ${r}

Faithfulness (1=contradicts context/fabricates, 5=fully supported):
Relevancy (1=off-topic, 5=directly answers the question):
Feedback (one sentence if score < 3, else "none"):

Reply EXACTLY in this format:
faithfulness=N
relevancy=N
feedback=TEXT`
}

// ── Score Parsing ──

/** Parse the evaluator's response into numeric scores */
function parseEvalResponse(raw: string): EvalResult {
  const lines = raw.toLowerCase().split('\n')

  let faithfulness = 3
  let relevancy = 3
  let feedback: string | undefined

  for (const line of lines) {
    const trimmed = line.trim()
    const faithMatch = trimmed.match(/faithfulness\s*=\s*(\d)/)
    if (faithMatch) faithfulness = parseInt(faithMatch[1], 10)

    const relMatch = trimmed.match(/relevancy\s*=\s*(\d)/)
    if (relMatch) relevancy = parseInt(relMatch[1], 10)

    const fbMatch = trimmed.match(/feedback\s*=\s*(.+)/)
    if (fbMatch) {
      const text = fbMatch[1].trim()
      if (text && text !== 'none' && text !== 'none.') feedback = text
    }
  }

  // Clamp to 1-5 then normalize to 0-1
  faithfulness = Math.max(1, Math.min(5, faithfulness))
  relevancy = Math.max(1, Math.min(5, relevancy))

  const fNorm = (faithfulness - 1) / 4
  const rNorm = (relevancy - 1) / 4
  const overall = fNorm * 0.4 + rNorm * 0.6

  return {
    faithfulness: fNorm,
    relevancy: rNorm,
    overall: Math.round(overall * 100) / 100,
    shouldRetry: overall < RETRY_THRESHOLD,
    feedback: overall < RETRY_THRESHOLD ? feedback : undefined,
  }
}

// ── Default LLM Call ──

/** Build headers for the configured provider */
function buildHeaders(provider: ProviderConfig, apiKey: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (provider.authHeader === 'x-api-key') {
    headers['x-api-key'] = apiKey
    headers['anthropic-version'] = '2023-06-01'
  } else if (apiKey && apiKey !== 'local') {
    headers['Authorization'] = `Bearer ${apiKey}`
  }
  return headers
}

/** Build request body for the configured provider's API style */
function buildBody(provider: ProviderConfig, model: string, prompt: string): string {
  if (provider.apiStyle === 'anthropic') {
    return JSON.stringify({
      model,
      max_tokens: 150,
      messages: [{ role: 'user', content: prompt }],
    })
  }

  if (provider.apiStyle === 'google') {
    return JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 150 },
    })
  }

  // OpenAI-compatible (covers openai, mistral, groq, together, ollama, etc.)
  return JSON.stringify({
    model,
    max_tokens: 150,
    messages: [{ role: 'user', content: prompt }],
  })
}

/** Build the full URL for the request */
function buildUrl(provider: ProviderConfig, byokProvider: ByokProvider, model: string, apiKey: string): string {
  if (provider.apiStyle === 'google') {
    return `${provider.apiUrl}/${model}:generateContent?key=${apiKey}`
  }
  return provider.apiUrl
}

/** Extract text from the provider's response format */
function extractText(provider: ProviderConfig, data: Record<string, unknown>): string {
  if (provider.apiStyle === 'anthropic') {
    const blocks = (data.content as Array<{ type: string; text?: string }>) || []
    return blocks.filter(b => b.type === 'text').map(b => b.text || '').join('')
  }

  if (provider.apiStyle === 'google') {
    const candidates = (data.candidates as Array<{ content: { parts: Array<{ text: string }> } }>) || []
    return candidates[0]?.content?.parts?.map(p => p.text).join('') || ''
  }

  // OpenAI-compatible
  const choices = (data.choices as Array<{ message: { content: string } }>) || []
  return choices[0]?.message?.content || ''
}

/** Default call function — uses the configured provider's fast model */
async function defaultCallFn(prompt: string): Promise<string> {
  const byokProvider = getByokProvider()
  const apiKey = getByokKey()
  if (!apiKey) throw new Error('No API key configured. Run `kbot auth` to set up.')

  const provider = getProvider(byokProvider)
  const model = getProviderModel(byokProvider, 'fast')
  const url = buildUrl(provider, byokProvider, model, apiKey)
  const headers = buildHeaders(provider, apiKey)
  const body = buildBody(provider, model, prompt)

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body,
    signal: AbortSignal.timeout(30_000), // 30s timeout — eval should be fast
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Self-eval API error ${res.status}: ${errText.slice(0, 200)}`)
  }

  const data = await res.json() as Record<string, unknown>
  return extractText(provider, data)
}

// ── Public API ──

/**
 * Evaluate a response for faithfulness and relevancy.
 *
 * Uses the configured provider's fast model by default.
 * Pass a custom `callFn` to use a different model or endpoint.
 */
export async function evaluateResponse(
  query: string,
  response: string,
  context?: string,
  callFn?: EvalCallFn,
): Promise<EvalResult> {
  const prompt = buildEvalPrompt(query, response, context)
  const call = callFn || defaultCallFn

  try {
    const raw = await call(prompt)
    return parseEvalResponse(raw)
  } catch (err) {
    // If eval call fails, don't block the pipeline — return a pass-through result
    return {
      faithfulness: 1,
      relevancy: 1,
      overall: 1,
      shouldRetry: false,
      feedback: `eval error: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

/**
 * Generate-evaluate-retry loop.
 *
 * Calls `generateFn` to produce a response, evaluates it, and retries
 * (with feedback injected) if the score is below threshold.
 *
 * @param generateFn - Async function that produces a response string.
 *   On retry, receives the previous feedback as its first argument.
 * @param query - The user's original question (for evaluation context).
 * @param context - Optional grounding context (documents, tool output, etc.).
 * @param maxRetries - Maximum retry attempts (default 2).
 * @param callFn - Optional custom LLM call function for evaluation.
 * @returns The final response, its eval scores, and how many retries were used.
 */
export async function withSelfEval(
  generateFn: (feedback?: string) => Promise<string>,
  query: string,
  context?: string,
  maxRetries: number = 2,
  callFn?: EvalCallFn,
): Promise<{ response: string; eval: EvalResult; retries: number }> {
  // If self-eval is disabled, just generate and return
  if (!selfEvalEnabled) {
    const response = await generateFn()
    return {
      response,
      eval: { faithfulness: 1, relevancy: 1, overall: 1, shouldRetry: false },
      retries: 0,
    }
  }

  let bestResponse = ''
  let bestEval: EvalResult = { faithfulness: 0, relevancy: 0, overall: 0, shouldRetry: true }
  let retries = 0
  let lastFeedback: string | undefined

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await generateFn(lastFeedback)
    const evalResult = await evaluateResponse(query, response, context, callFn)

    // Keep the best response seen so far
    if (evalResult.overall > bestEval.overall) {
      bestResponse = response
      bestEval = evalResult
    }

    if (!evalResult.shouldRetry || attempt === maxRetries) {
      break
    }

    // Prepare for retry
    retries++
    lastFeedback = evalResult.feedback || 'Previous response was low quality. Be more precise and relevant.'
  }

  return { response: bestResponse, eval: bestEval, retries }
}
