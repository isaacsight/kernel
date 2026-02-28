// ═══════════════════════════════════════════════════════════════
//  Groq Provider — Routes through multi-provider proxy
// ═══════════════════════════════════════════════════════════════
//
//  Uses Groq's OpenAI-compatible API for ultra-fast, low-cost
//  inference. Ideal for background operations (routing, memory
//  extraction, guardian review, swarm contributions).

import type { LLMProvider, LLMOpts, ChatMessage } from './types'
import { callLLMProxy, streamFromProxy, parseProxyJSON } from './proxy'

export class GroqProvider implements LLMProvider {
    readonly name = 'groq'

    async json<T>(prompt: string, opts?: LLMOpts): Promise<T> {
        const res = await callLLMProxy('groq', 'json', [{ role: 'user', content: prompt }], opts)
        const { text } = await res.json()
        return parseProxyJSON<T>(text)
    }

    async text(prompt: string, opts?: LLMOpts): Promise<string> {
        const res = await callLLMProxy('groq', 'text', [{ role: 'user', content: prompt }], opts)
        const { text } = await res.json()
        return text
    }

    async stream(
        prompt: string,
        onChunk: (fullText: string) => void,
        opts?: LLMOpts
    ): Promise<string> {
        return streamFromProxy('groq', [{ role: 'user', content: prompt }], onChunk, opts)
    }

    async streamChat(
        messages: ChatMessage[],
        onChunk: (fullText: string) => void,
        opts?: LLMOpts
    ): Promise<string> {
        return streamFromProxy('groq', messages, onChunk, opts)
    }
}
