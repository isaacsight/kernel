// ═══════════════════════════════════════════════════════════════
//  OpenAI Provider — Routes through multi-provider proxy
// ═══════════════════════════════════════════════════════════════

import type { LLMProvider, LLMOpts, ChatMessage } from './types'
import { callLLMProxy, streamFromProxy, parseProxyJSON } from './proxy'

export class OpenAIProvider implements LLMProvider {
    readonly name = 'openai'

    async json<T>(prompt: string, opts?: LLMOpts): Promise<T> {
        const res = await callLLMProxy('openai', 'json', [{ role: 'user', content: prompt }], opts)
        const { text } = await res.json()
        return parseProxyJSON<T>(text)
    }

    async text(prompt: string, opts?: LLMOpts): Promise<string> {
        const res = await callLLMProxy('openai', 'text', [{ role: 'user', content: prompt }], opts)
        const { text } = await res.json()
        return text
    }

    async stream(
        prompt: string,
        onChunk: (fullText: string) => void,
        opts?: LLMOpts
    ): Promise<string> {
        return streamFromProxy('openai', [{ role: 'user', content: prompt }], onChunk, opts)
    }

    async streamChat(
        messages: ChatMessage[],
        onChunk: (fullText: string) => void,
        opts?: LLMOpts
    ): Promise<string> {
        return streamFromProxy('openai', messages, onChunk, opts)
    }
}
