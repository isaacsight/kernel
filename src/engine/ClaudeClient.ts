// ClaudeClient — Unified frontend client for all Claude API calls.
// All requests route through the claude-proxy edge function.

import { getAccessToken } from './SupabaseClient'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://eoxxpyixdieprsxlpwcs.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || ''
const PROXY_URL = `${SUPABASE_URL}/functions/v1/claude-proxy`

export class RateLimitError extends Error {
  limit: number
  resetsAt: string
  constructor(message: string, limit: number, resetsAt: string) {
    super(message)
    this.name = 'RateLimitError'
    this.limit = limit
    this.resetsAt = resetsAt
  }
}

export class FreeLimitError extends Error {
  limit: number
  used: number
  resetsAt: string | null
  constructor(limit: number, used: number, resetsAt?: string) {
    super(`Free limit reached: ${used}/${limit} messages used`)
    this.name = 'FreeLimitError'
    this.limit = limit
    this.used = used
    this.resetsAt = resetsAt ?? null
  }
}

export class ProLimitError extends Error {
  limit: number
  used: number
  resetsAt: string | null
  constructor(limit: number, used: number, resetsAt?: string) {
    super(`Daily Pro limit reached: ${used}/${limit} messages used`)
    this.name = 'ProLimitError'
    this.limit = limit
    this.used = used
    this.resetsAt = resetsAt ?? null
  }
}

export class ImageLimitError extends Error {
  limit: number
  used: number
  resetsAt: string | null
  constructor(limit: number, used: number, resetsAt?: string) {
    super(`Daily image limit reached: ${used}/${limit} images used`)
    this.name = 'ImageLimitError'
    this.limit = limit
    this.used = used
    this.resetsAt = resetsAt ?? null
  }
}

export class PlatformRefundError extends Error {
  dailyCount: number | null
  constructor(message: string, dailyCount?: number) {
    super(message)
    this.name = 'PlatformRefundError'
    this.dailyCount = dailyCount ?? null
  }
}

type Model = 'opus' | 'sonnet' | 'haiku'

// Re-export ContentBlock from provider types for backward compat
export type { ContentBlock } from './providers/types'

// Import for local use
import type { ContentBlock } from './providers/types'

interface ClaudeOpts {
  system?: string
  model?: Model
  max_tokens?: number
  web_search?: boolean
  signal?: AbortSignal
  tools?: any[]
  thinking?: {
    type: 'enabled'
    budget_tokens: number
  }
  onThinking?: (thinkingText: string) => void
}

export interface StreamChatResult {
  text: string
  thinking: string
}

async function callProxy(mode: 'json' | 'text' | 'stream', prompt: string, opts?: ClaudeOpts) {
  const token = await getAccessToken()
  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_KEY,
    },
    body: JSON.stringify({
      mode,
      model: opts?.model ?? 'sonnet',
      system: opts?.system,
      max_tokens: opts?.max_tokens ?? 4096,
      messages: [{ role: 'user', content: prompt }],
      web_search: opts?.web_search ?? false,
      tools: opts?.tools,
      thinking: opts?.thinking,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    if (res.status === 403) {
      try {
        const body = JSON.parse(err)
        if (body.error === 'free_limit_reached') {
          throw new FreeLimitError(body.limit ?? 20, body.used ?? 0, body.resets_at)
        }
        if (body.error === 'free_image_limit_reached') {
          throw new ImageLimitError(body.limit ?? 3, body.used ?? 0, body.resets_at)
        }
      } catch (e) {
        if (e instanceof FreeLimitError || e instanceof ImageLimitError) throw e
      }
    }
    if (res.status === 429) {
      try {
        const body = JSON.parse(err)
        if (body.error === 'pro_limit_reached') {
          throw new ProLimitError(body.limit ?? 50, body.used ?? 0, body.resets_at)
        }
        throw new RateLimitError(body.error || 'Rate limit reached', body.limit || 0, body.resets_at || '')
      } catch (e) {
        if (e instanceof ProLimitError || e instanceof RateLimitError) throw e
      }
    }
    // Check if the error included an auto-refund
    try {
      const body = JSON.parse(err)
      if (body.refunded) {
        throw new PlatformRefundError(
          body.error || 'Something went wrong on our end',
          body.daily_count,
        )
      }
    } catch (e) {
      if (e instanceof PlatformRefundError) throw e
    }
    throw new Error(`Claude proxy error (${res.status}): ${err}`)
  }
  return res
}

/** Structured JSON — replaces generateContent + JSON.parse pattern */
export async function claudeJSON<T>(prompt: string, opts?: ClaudeOpts): Promise<T> {
  const res = await callProxy('json', prompt, opts)
  const { text } = await res.json()

  // Extract JSON from the response (handles markdown code fences + raw JSON)
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/) || text.match(/(\[[\s\S]*\])/)
  if (!jsonMatch) throw new Error('No JSON found in Claude response')

  return JSON.parse(jsonMatch[1] || jsonMatch[0])
}

/** Plain text — replaces generateContent().text() */
export async function claudeText(prompt: string, opts?: ClaudeOpts): Promise<string> {
  const res = await callProxy('text', prompt, opts)
  const { text } = await res.json()
  return text
}

/** Streaming — replaces generateContentStream + onChunk */
export async function claudeStream(
  prompt: string,
  onChunk: (text: string) => void,
  opts?: ClaudeOpts
): Promise<string> {
  const token = await getAccessToken()
  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_KEY,
    },
    body: JSON.stringify({
      mode: 'stream',
      model: opts?.model ?? 'sonnet',
      system: opts?.system,
      max_tokens: opts?.max_tokens ?? 4096,
      messages: [{ role: 'user', content: prompt }],
      tools: opts?.tools,
      thinking: opts?.thinking,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    if (res.status === 403) {
      try {
        const body = JSON.parse(err)
        if (body.error === 'free_limit_reached') {
          throw new FreeLimitError(body.limit ?? 20, body.used ?? 0, body.resets_at)
        }
        if (body.error === 'free_image_limit_reached') {
          throw new ImageLimitError(body.limit ?? 3, body.used ?? 0, body.resets_at)
        }
      } catch (e) {
        if (e instanceof FreeLimitError || e instanceof ImageLimitError) throw e
      }
    }
    // Check for auto-refund
    try {
      const body = JSON.parse(err)
      if (body.refunded) {
        throw new PlatformRefundError(body.error || 'Something went wrong on our end', body.daily_count)
      }
    } catch (e) {
      if (e instanceof PlatformRefundError) throw e
    }
    throw new Error(`Claude stream error (${res.status}): ${err}`)
  }

  const reader = res.body?.getReader()
  if (!reader) throw new Error('No readable stream')

  const decoder = new TextDecoder()
  let fullText = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    // Parse Anthropic SSE events
    const lines = chunk.split('\n')
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6)
      if (data === '[DONE]') continue

      try {
        const event = JSON.parse(data)
        if (event.type === 'content_block_delta' && event.delta?.text) {
          fullText += event.delta.text
          onChunk(fullText)
        }
        if (event.type === 'error' && event.error?.refunded) {
          throw new PlatformRefundError(event.error.message || 'Stream error — message refunded', event.error.daily_count)
        }
      } catch (e) {
        if (e instanceof PlatformRefundError) throw e
        // skip non-JSON lines
      }
    }
  }

  return fullText
}

/** Multi-turn streaming — for chat interfaces that need conversation history */
export async function claudeStreamChat(
  messages: { role: string; content: string | ContentBlock[] }[],
  onChunk: (text: string) => void,
  opts?: ClaudeOpts
): Promise<StreamChatResult> {
  const token = await getAccessToken()
  const fetchOpts: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_KEY,
    },
    body: JSON.stringify({
      mode: 'stream',
      model: opts?.model ?? 'sonnet',
      system: opts?.system,
      max_tokens: opts?.max_tokens ?? 4096,
      messages,
      web_search: opts?.web_search ?? false,
      tools: opts?.tools,
      thinking: opts?.thinking,
    }),
    signal: opts?.signal,
  }

  // iOS Safari can throw "Load failed" on first attempt due to
  // service worker race conditions or stale preflight caches.
  // Retry once after a brief pause.
  let res: Response
  try {
    res = await fetch(PROXY_URL, fetchOpts)
  } catch (err) {
    if (err instanceof TypeError && /load failed/i.test(err.message)) {
      await new Promise(r => setTimeout(r, 500))
      res = await fetch(PROXY_URL, fetchOpts)
    } else {
      throw err
    }
  }

  if (!res.ok) {
    const err = await res.text()
    if (res.status === 403) {
      try {
        const body = JSON.parse(err)
        if (body.error === 'free_limit_reached') {
          throw new FreeLimitError(body.limit ?? 20, body.used ?? 0, body.resets_at)
        }
        if (body.error === 'free_image_limit_reached') {
          throw new ImageLimitError(body.limit ?? 3, body.used ?? 0, body.resets_at)
        }
      } catch (e) {
        if (e instanceof FreeLimitError || e instanceof ImageLimitError) throw e
      }
    }
    if (res.status === 429) {
      try {
        const body = JSON.parse(err)
        if (body.error === 'pro_limit_reached') {
          throw new ProLimitError(body.limit ?? 50, body.used ?? 0, body.resets_at)
        }
        throw new RateLimitError(body.error || 'Rate limit reached', body.limit || 0, body.resets_at || '')
      } catch (e) {
        if (e instanceof ProLimitError || e instanceof RateLimitError) throw e
      }
    }
    // Check for auto-refund in error response
    try {
      const body = JSON.parse(err)
      if (body.refunded) {
        throw new PlatformRefundError(body.error || 'Something went wrong on our end', body.daily_count)
      }
    } catch (e) {
      if (e instanceof PlatformRefundError) throw e
    }
    throw new Error(`Claude stream error (${res.status}): ${err}`)
  }

  const reader = res.body?.getReader()
  if (!reader) throw new Error('No readable stream')

  const decoder = new TextDecoder()
  let fullText = ''
  let fullThinking = ''
  let currentBlockType: 'text' | 'thinking' | null = null

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n')
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6)
        if (data === '[DONE]') continue

        try {
          const event = JSON.parse(data)
          // Track content block type (thinking vs text)
          if (event.type === 'content_block_start') {
            if (event.content_block?.type === 'thinking') {
              currentBlockType = 'thinking'
            } else if (event.content_block?.type === 'text') {
              currentBlockType = 'text'
            }
          }
          if (event.type === 'content_block_stop') {
            currentBlockType = null
          }
          // Handle thinking deltas
          if (event.type === 'content_block_delta' && event.delta?.type === 'thinking_delta' && event.delta?.thinking) {
            fullThinking += event.delta.thinking
            opts?.onThinking?.(fullThinking)
          }
          // Handle text deltas
          if (event.type === 'content_block_delta' && event.delta?.text) {
            fullText += event.delta.text
            onChunk(fullText)
          }
          // Detect platform error mid-stream (e.g. timeout)
          if (event.type === 'error' && event.error?.refunded) {
            throw new PlatformRefundError(
              event.error.message || 'Stream error — your message has been refunded',
              event.error.daily_count,
            )
          }
        } catch (e) {
          if (e instanceof PlatformRefundError) throw e
          // skip non-JSON lines
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  return { text: fullText, thinking: fullThinking }
}
