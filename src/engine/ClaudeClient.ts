// ClaudeClient — Unified frontend client for all Claude API calls.
// All requests route through the claude-proxy edge function.

import { getAccessToken } from './SupabaseClient'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://eoxxpyixdieprsxlpwcs.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || ''
const PROXY_URL = `${SUPABASE_URL}/functions/v1/claude-proxy`

type Model = 'sonnet' | 'haiku'

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  | { type: 'document'; source: { type: 'base64'; media_type: string; data: string } }

interface ClaudeOpts {
  system?: string
  model?: Model
  max_tokens?: number
  web_search?: boolean
  signal?: AbortSignal
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
    }),
  })

  if (!res.ok) {
    const err = await res.text()
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
    }),
  })

  if (!res.ok) {
    const err = await res.text()
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
      } catch {
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
      messages,
      web_search: opts?.web_search ?? false,
    }),
    signal: opts?.signal,
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Claude stream error (${res.status}): ${err}`)
  }

  const reader = res.body?.getReader()
  if (!reader) throw new Error('No readable stream')

  const decoder = new TextDecoder()
  let fullText = ''

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
          if (event.type === 'content_block_delta' && event.delta?.text) {
            fullText += event.delta.text
            onChunk(fullText)
          }
        } catch {
          // skip non-JSON lines
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  return fullText
}
