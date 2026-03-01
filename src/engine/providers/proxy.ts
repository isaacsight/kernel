// ═══════════════════════════════════════════════════════════════
//  Proxy Helper — Shared proxy-calling + SSE parsing for all
//  proxy-backed providers (Anthropic, OpenAI, Gemini).
// ═══════════════════════════════════════════════════════════════

import { getAccessToken } from '../SupabaseClient'
import type { ChatMessage, LLMOpts } from './types'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://eoxxpyixdieprsxlpwcs.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || ''
const PROXY_URL = `${SUPABASE_URL}/functions/v1/claude-proxy`

// ─── Error types (re-exported from ClaudeClient for backward compat) ──

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

export class FairUseLimitError extends Error {
    resetsAt: string | null
    constructor(resetsAt?: string) {
        super('Fair use limit reached for this month')
        this.name = 'FairUseLimitError'
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

// ─── Handle error responses from proxy ──────────────────────

function handleErrorResponse(status: number, body: string): never {
    // Try to parse JSON body for structured error handling
    let parsed: Record<string, unknown> = {}
    try { parsed = JSON.parse(body) } catch { /* raw text */ }

    // Auto-refund: platform error that was refunded server-side
    if (parsed.refunded) {
        throw new PlatformRefundError(
            (parsed.error as string) || 'Something went wrong on our end',
            parsed.daily_count as number | undefined,
        )
    }

    if (status === 403) {
        if (parsed.error === 'free_limit_reached') {
            throw new FreeLimitError(
                (parsed.limit as number) ?? 20,
                (parsed.used as number) ?? 0,
                parsed.resets_at as string | undefined,
            )
        }
    }
    if (status === 429) {
        if (parsed.error === 'fair_use_limit') {
            throw new FairUseLimitError(parsed.resets_at as string | undefined)
        }
        throw new RateLimitError(
            (parsed.error as string) || 'Rate limit reached',
            (parsed.limit as number) || 0,
            (parsed.resets_at as string) || '',
        )
    }
    throw new Error(`Proxy error (${status}): ${body}`)
}

// ─── Call proxy (non-streaming) ─────────────────────────────

export async function callLLMProxy(
    provider: string,
    mode: 'json' | 'text',
    messages: ChatMessage[],
    opts?: LLMOpts
): Promise<Response> {
    const token = await getAccessToken()
    const fetchOpts: RequestInit = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            apikey: SUPABASE_KEY,
        },
        body: JSON.stringify({
            provider,
            mode,
            tier: opts?.tier ?? 'strong',
            model: opts?.model,
            system: opts?.system,
            max_tokens: opts?.max_tokens ?? 4096,
            messages: messages.map(m => ({ role: m.role, content: m.content })),
            web_search: opts?.web_search ?? false,
            ...(opts?.streak != null ? { streak: opts.streak } : {}),
        }),
        signal: opts?.signal,
    }

    // iOS Safari: retry once on "Load failed" (SW race / stale preflight)
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
        handleErrorResponse(res.status, err)
    }

    return res
}

// ─── Stream from proxy ──────────────────────────────────────

export async function streamFromProxy(
    provider: string,
    messages: ChatMessage[],
    onChunk: (fullText: string) => void,
    opts?: LLMOpts
): Promise<string> {
    const token = await getAccessToken()
    const fetchOpts: RequestInit = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            apikey: SUPABASE_KEY,
        },
        body: JSON.stringify({
            provider,
            mode: 'stream',
            tier: opts?.tier ?? 'strong',
            model: opts?.model,
            system: opts?.system,
            max_tokens: opts?.max_tokens ?? 4096,
            messages: messages.map(m => ({ role: m.role, content: m.content })),
            web_search: opts?.web_search ?? false,
            ...(opts?.streak != null ? { streak: opts.streak } : {}),
        }),
        signal: opts?.signal,
    }

    // iOS Safari: retry once on "Load failed" (SW race / stale preflight)
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
        handleErrorResponse(res.status, err)
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
                    // Detect platform error events mid-stream (e.g. timeout, upstream failure)
                    if (event.type === 'error' && event.error?.refunded) {
                        throw new PlatformRefundError(
                            event.error.message || 'Stream error — message refunded',
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

    return fullText
}

// ─── Parse JSON from proxy response ─────────────────────────

export function parseProxyJSON<T>(text: string): T {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/) || text.match(/(\[[\s\S]*\])/)
    if (!jsonMatch) throw new Error('No JSON found in response')
    return JSON.parse(jsonMatch[1] || jsonMatch[0])
}
