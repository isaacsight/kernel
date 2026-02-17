// ═══════════════════════════════════════════════════════════════
//  Ollama Provider — Calls localhost directly (no proxy)
// ═══════════════════════════════════════════════════════════════
//
//  Uses Ollama's OpenAI-compatible /v1/chat/completions endpoint.
//  No auth needed — runs entirely local.

import type { LLMProvider, LLMOpts, ChatMessage, ModelTier } from './types'
import { parseProxyJSON } from './proxy'

const DEFAULT_MODELS: Record<ModelTier, string> = {
    fast: 'llama3.2',
    strong: 'llama3.1',
}

export class OllamaProvider implements LLMProvider {
    readonly name = 'ollama'
    private baseUrl: string

    constructor(baseUrl = 'http://localhost:11434') {
        this.baseUrl = baseUrl.replace(/\/$/, '')
    }

    private resolveModel(opts?: LLMOpts): string {
        if (opts?.model) return opts.model
        return DEFAULT_MODELS[opts?.tier ?? 'strong']
    }

    private buildMessages(prompt: string, opts?: LLMOpts): { role: string; content: string }[] {
        const msgs: { role: string; content: string }[] = []
        if (opts?.system) msgs.push({ role: 'system', content: opts.system })
        msgs.push({ role: 'user', content: prompt })
        return msgs
    }

    private chatMessages(messages: ChatMessage[], opts?: LLMOpts): { role: string; content: string }[] {
        const msgs: { role: string; content: string }[] = []
        if (opts?.system) msgs.push({ role: 'system', content: opts.system })
        for (const m of messages) {
            msgs.push({ role: m.role, content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) })
        }
        return msgs
    }

    async json<T>(prompt: string, opts?: LLMOpts): Promise<T> {
        const text = await this.text(prompt, opts)
        return parseProxyJSON<T>(text)
    }

    async text(prompt: string, opts?: LLMOpts): Promise<string> {
        const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: this.resolveModel(opts),
                messages: this.buildMessages(prompt, opts),
                max_tokens: opts?.max_tokens ?? 4096,
                stream: false,
            }),
            signal: opts?.signal,
        })

        if (!res.ok) {
            const err = await res.text()
            throw new Error(`Ollama error (${res.status}): ${err}`)
        }

        const data = await res.json()
        return data.choices?.[0]?.message?.content ?? ''
    }

    async stream(
        prompt: string,
        onChunk: (fullText: string) => void,
        opts?: LLMOpts
    ): Promise<string> {
        return this.streamChat(
            [{ role: 'user', content: prompt }],
            onChunk,
            opts
        )
    }

    async streamChat(
        messages: ChatMessage[],
        onChunk: (fullText: string) => void,
        opts?: LLMOpts
    ): Promise<string> {
        const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: this.resolveModel(opts),
                messages: this.chatMessages(messages, opts),
                max_tokens: opts?.max_tokens ?? 4096,
                stream: true,
            }),
            signal: opts?.signal,
        })

        if (!res.ok) {
            const err = await res.text()
            throw new Error(`Ollama stream error (${res.status}): ${err}`)
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
                    const data = line.slice(6).trim()
                    if (data === '[DONE]') continue

                    try {
                        const event = JSON.parse(data)
                        const delta = event.choices?.[0]?.delta?.content
                        if (delta) {
                            fullText += delta
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
}
