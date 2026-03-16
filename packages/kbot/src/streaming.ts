// K:BOT Streaming with Thinking — Show reasoning steps during generation
//
// Two modes:
//   1. Extended thinking (Claude) — shows <thinking> blocks in dim text
//   2. Streaming tokens — progressive output as tokens arrive
//
// The thinking display shows the AI's reasoning process in real-time,
// then the final response renders normally.

import chalk from 'chalk'

const ACCENT_DIM = chalk.hex('#7C6CB0')
const THINKING_COLOR = chalk.dim.italic

/** Max accumulated content size during streaming (5MB) to prevent OOM */
const MAX_STREAM_CONTENT = 5 * 1024 * 1024

/** Max retries for transient streaming failures */
const MAX_STREAM_RETRIES = 3

/** Retry delays in ms (exponential backoff) */
const RETRY_DELAYS = [1000, 2000, 4000]

/** Check if an error is retryable (network/server, not auth/validation) */
function isRetryableError(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 529
}

/** Sleep with optional stderr progress message */
async function retrySleep(ms: number, attempt: number): Promise<void> {
  process.stderr.write(`  ${chalk.dim(`⟳ Retry ${attempt}/${MAX_STREAM_RETRIES} in ${ms / 1000}s...`)}\n`)
  return new Promise(resolve => setTimeout(resolve, ms))
}

/** Streaming event types from Claude API */
export interface StreamEvent {
  type: string
  index?: number
  delta?: {
    type?: string
    text?: string
    partial_json?: string
    thinking?: string
  }
  content_block?: {
    type: string
    text?: string
    id?: string
    name?: string
    thinking?: string
  }
  message?: {
    id: string
    content: Array<{ type: string; text?: string; thinking?: string }>
    usage: { input_tokens: number; output_tokens: number }
    stop_reason: string
    model: string
  }
  usage?: { input_tokens: number; output_tokens: number }
}

/** State for tracking a streaming response */
export interface StreamState {
  thinking: string
  content: string
  toolCalls: Array<{ id: string; name: string; partialJson: string }>
  model: string
  usage: { input_tokens: number; output_tokens: number }
  stopReason: string
  isThinking: boolean
  thinkingDisplayed: boolean
}

export function createStreamState(): StreamState {
  return {
    thinking: '',
    content: '',
    toolCalls: [],
    model: '',
    usage: { input_tokens: 0, output_tokens: 0 },
    stopReason: '',
    isThinking: false,
    thinkingDisplayed: false,
  }
}

/**
 * Stream a response from the Anthropic API with thinking display.
 * Shows thinking in dim italic text, then the final response.
 */
export async function streamAnthropicResponse(
  apiKey: string,
  apiUrl: string,
  model: string,
  system: string,
  messages: Array<{ role: string; content: unknown }>,
  tools?: Array<{ name: string; description: string; input_schema: Record<string, unknown> }>,
  options?: { thinking?: boolean; thinkingBudget?: number },
): Promise<StreamState> {
  const body: Record<string, unknown> = {
    model,
    max_tokens: options?.thinking ? 16384 : 8192,
    system: system || undefined,
    messages,
    stream: true,
  }

  // Enable extended thinking if requested
  if (options?.thinking) {
    body.thinking = {
      type: 'enabled',
      budget_tokens: options.thinkingBudget || 10000,
    }
  }

  if (tools && tools.length > 0) body.tools = tools

  let res: Response | undefined
  let lastError: Error | undefined

  for (let attempt = 0; attempt <= MAX_STREAM_RETRIES; attempt++) {
    try {
      res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(300_000),
      })

      if (res.ok) break

      const errBody = await res.json().catch(() => ({ error: { message: `HTTP ${res!.status}` } }))
      lastError = new Error(errBody.error?.message || `Anthropic streaming error: ${res.status}`)

      if (isRetryableError(res.status) && attempt < MAX_STREAM_RETRIES) {
        const retryAfter = res.headers.get('retry-after')
        const parsed = retryAfter ? parseInt(retryAfter, 10) : NaN
        const delay = !isNaN(parsed) ? parsed * 1000 : RETRY_DELAYS[attempt]
        await retrySleep(delay, attempt + 1)
        continue
      }

      throw lastError
    } catch (err) {
      if (err instanceof TypeError && attempt < MAX_STREAM_RETRIES) {
        // Network error (DNS, connection refused, etc.)
        lastError = err as Error
        await retrySleep(RETRY_DELAYS[attempt], attempt + 1)
        continue
      }
      throw err
    }
  }

  if (!res || !res.ok) {
    throw lastError || new Error('Anthropic streaming failed after retries')
  }

  const state = createStreamState()
  const reader = res.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  let buffer = ''
  let thinkingLineCount = 0
  let streamCancelled = false

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // Process SSE events
      const lines = buffer.split('\n')
      buffer = lines.pop() || '' // Keep incomplete last line

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()
        if (data === '[DONE]') continue

        let event: StreamEvent
        try {
          event = JSON.parse(data)
        } catch {
          continue
        }

        processStreamEvent(event, state, (type, text) => {
          if (type === 'thinking') {
            if (!state.thinkingDisplayed) {
              process.stderr.write(`\n  ${chalk.dim('thinking…')}\n`)
              state.thinkingDisplayed = true
            }
            // Thinking is status — goes to stderr
            const thinkingLines = text.split('\n')
            for (const tl of thinkingLines) {
              if (tl.trim()) {
                process.stderr.write(`  ${THINKING_COLOR(tl)}\n`)
                thinkingLineCount++
              }
            }
          } else if (type === 'thinking_done') {
            if (state.thinkingDisplayed) {
              process.stderr.write(`  ${chalk.dim(`(${thinkingLineCount} lines)`)}\n\n`)
            }
          } else if (type === 'content') {
            // Content is pipeable — goes to stdout
            if (state.content.length === 0) {
              process.stdout.write('\n')
            }
            process.stdout.write(text)
          }
        })

        // Guard against OOM from unbounded content/thinking accumulation
        if (state.content.length + state.thinking.length > MAX_STREAM_CONTENT) {
          process.stderr.write('\n  [Response truncated — exceeded 5MB]\n')
          streamCancelled = true
          await reader.cancel()
          return state
        }
      }
    }
  } finally {
    if (!streamCancelled) reader.releaseLock()
  }

  // Final newline after streamed content
  if (state.content) {
    process.stdout.write('\n')
  }

  return state
}

/**
 * Stream a response from OpenAI-compatible APIs.
 * These don't have thinking blocks but we stream tokens progressively.
 */
export async function streamOpenAIResponse(
  apiKey: string,
  apiUrl: string,
  model: string,
  system: string,
  messages: Array<{ role: string; content: string }>,
  tools?: Array<{ name: string; description: string; input_schema: Record<string, unknown> }>,
): Promise<StreamState> {
  const apiMessages: Array<{ role: string; content: string }> = []
  if (system) apiMessages.push({ role: 'system', content: system })
  apiMessages.push(...messages)

  const body: Record<string, unknown> = {
    model,
    max_tokens: 8192,
    messages: apiMessages,
    stream: true,
  }

  if (tools && tools.length > 0) {
    body.tools = tools.map(t => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.input_schema },
    }))
  }

  let res: Response | undefined
  let lastError: Error | undefined

  for (let attempt = 0; attempt <= MAX_STREAM_RETRIES; attempt++) {
    try {
      res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(300_000),
      })

      if (res.ok) break

      const errBody = await res.json().catch(() => ({ error: { message: `HTTP ${res!.status}` } }))
      lastError = new Error(errBody.error?.message || `API streaming error: ${res.status}`)

      if (isRetryableError(res.status) && attempt < MAX_STREAM_RETRIES) {
        const retryAfter = res.headers.get('retry-after')
        const parsed = retryAfter ? parseInt(retryAfter, 10) : NaN
        const delay = !isNaN(parsed) ? parsed * 1000 : RETRY_DELAYS[attempt]
        await retrySleep(delay, attempt + 1)
        continue
      }

      throw lastError
    } catch (err) {
      if (err instanceof TypeError && attempt < MAX_STREAM_RETRIES) {
        lastError = err as Error
        await retrySleep(RETRY_DELAYS[attempt], attempt + 1)
        continue
      }
      throw err
    }
  }

  if (!res || !res.ok) {
    throw lastError || new Error('API streaming failed after retries')
  }

  const state = createStreamState()
  const reader = res.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  let buffer = ''
  let streamCancelled = false
  const CHUNK_TIMEOUT = 60_000 // 60s between chunks before giving up

  try {
    while (true) {
      // Timeout if no data received for 60 seconds (server hung)
      const readPromise = reader.read()
      const chunkTimer = setTimeout(() => {
        streamCancelled = true
        reader.cancel().catch(() => {})
      }, CHUNK_TIMEOUT)
      let readResult: ReadableStreamReadResult<Uint8Array>
      try {
        readResult = await readPromise
      } catch {
        clearTimeout(chunkTimer)
        if (streamCancelled) throw new Error('Stream stalled — no data for 60s')
        throw new Error('Stream read failed')
      }
      clearTimeout(chunkTimer)
      if (streamCancelled) throw new Error('Stream stalled — no data for 60s')
      const { done, value } = readResult
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()
        if (data === '[DONE]') continue

        let chunk: Record<string, unknown>
        try {
          chunk = JSON.parse(data)
        } catch {
          continue
        }

        const choice = (chunk.choices as Array<Record<string, unknown>>)?.[0]
        if (!choice) continue

        const delta = choice.delta as Record<string, unknown> | undefined
        if (delta?.content) {
          const text = String(delta.content)
          // Add a blank line before the first content token for clean formatting
          if (state.content.length === 0) {
            process.stdout.write('\n')
          }
          state.content += text
          process.stdout.write(text)

          // Guard against OOM from unbounded content accumulation
          if (state.content.length > MAX_STREAM_CONTENT) {
            process.stderr.write('\n  [Response truncated — exceeded 5MB]\n')
            streamCancelled = true
            await reader.cancel()
            return state
          }
        }

        // Tool call deltas
        if (delta?.tool_calls) {
          const tcs = delta.tool_calls as Array<Record<string, unknown>>
          for (const tc of tcs) {
            const idx = tc.index as number
            // Ensure no sparse array — fill gaps with empty entries
            while (state.toolCalls.length <= idx) {
              state.toolCalls.push({ id: '', name: '', partialJson: '' })
            }
            if (tc.id) state.toolCalls[idx].id = String(tc.id)
            const fn = tc.function as Record<string, string> | undefined
            if (fn?.name) state.toolCalls[idx].name = fn.name
            if (fn?.arguments) state.toolCalls[idx].partialJson += fn.arguments
          }
        }

        if (choice.finish_reason) {
          state.stopReason = String(choice.finish_reason)
        }

        // Capture usage from the final stream chunk (OpenAI includes it)
        const chunkUsage = chunk.usage as Record<string, number> | undefined
        if (chunkUsage) {
          state.usage = {
            input_tokens: chunkUsage.prompt_tokens || chunkUsage.input_tokens || 0,
            output_tokens: chunkUsage.completion_tokens || chunkUsage.output_tokens || 0,
          }
        }
      }
    }
  } finally {
    if (!streamCancelled) reader.releaseLock()
  }

  if (state.content) {
    process.stdout.write('\n')
  }

  // Usage is captured from the final stream chunk (some providers include it)
  // If not available from stream, it stays at 0 — the non-streaming path handles this correctly

  return state
}

/** Process a single SSE event and call the callback for display */
function processStreamEvent(
  event: StreamEvent,
  state: StreamState,
  onDisplay: (type: 'thinking' | 'thinking_done' | 'content' | 'tool_use', text: string) => void,
): void {
  switch (event.type) {
    case 'content_block_start':
      if (event.content_block?.type === 'thinking') {
        state.isThinking = true
      } else if (event.content_block?.type === 'tool_use') {
        state.toolCalls.push({
          id: event.content_block.id || '',
          name: event.content_block.name || '',
          partialJson: '',
        })
      }
      break

    case 'content_block_delta':
      if (event.delta?.type === 'thinking_delta' && event.delta.thinking) {
        state.thinking += event.delta.thinking
        onDisplay('thinking', event.delta.thinking)
      } else if (event.delta?.type === 'text_delta' && event.delta.text) {
        state.content += event.delta.text
        onDisplay('content', event.delta.text)
      } else if (event.delta?.type === 'input_json_delta' && event.delta.partial_json) {
        const lastTool = state.toolCalls[state.toolCalls.length - 1]
        if (lastTool) {
          lastTool.partialJson += event.delta.partial_json
        }
      }
      break

    case 'content_block_stop':
      if (state.isThinking) {
        state.isThinking = false
        onDisplay('thinking_done', '')
      }
      break

    case 'message_start':
      if (event.message?.model) {
        state.model = event.message.model
      }
      break

    case 'message_delta':
      if (event.usage) {
        state.usage = {
          input_tokens: event.usage.input_tokens || state.usage.input_tokens,
          output_tokens: event.usage.output_tokens || state.usage.output_tokens,
        }
      }
      break

    case 'message_stop':
      // Final event
      break
  }
}

/**
 * Format thinking text for display (summarized).
 * Used when showing thinking after the fact rather than streaming.
 */
export function formatThinkingSummary(thinking: string): string {
  if (!thinking) return ''

  const lines = thinking.split('\n').filter(l => l.trim())
  if (lines.length <= 5) {
    return lines.map(l => `  ${THINKING_COLOR(l)}`).join('\n')
  }

  // Show first 3 and last 2 lines
  const summary = [
    ...lines.slice(0, 3).map(l => `  ${THINKING_COLOR(l)}`),
    `  ${chalk.dim(`... (${lines.length - 5} more lines)`)}`,
    ...lines.slice(-2).map(l => `  ${THINKING_COLOR(l)}`),
  ]
  return summary.join('\n')
}
