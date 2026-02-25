// ═══════════════════════════════════════════════════════════════
//  Anthropic Provider — Routes through multi-provider proxy
// ═══════════════════════════════════════════════════════════════

import type { LLMProvider, LLMOpts, ChatMessage } from './types'
import { callLLMProxy, streamFromProxy, parseProxyJSON } from './proxy'

export class AnthropicProvider implements LLMProvider {
    readonly name = 'anthropic'

    async json<T>(prompt: string, opts?: LLMOpts): Promise<T> {
        const res = await callLLMProxy('anthropic', 'json', [{ role: 'user', content: prompt }], opts)
        const { text } = await res.json()
        return parseProxyJSON<T>(text)
    }

    async text(prompt: string, opts?: LLMOpts): Promise<string> {
        const res = await callLLMProxy('anthropic', 'text', [{ role: 'user', content: prompt }], opts)
        const { text } = await res.json()
        return text
    }

    async stream(
        prompt: string,
        onChunk: (fullText: string) => void,
        opts?: LLMOpts
    ): Promise<string> {
        return streamFromProxy('anthropic', [{ role: 'user', content: prompt }], onChunk, opts)
    }

    async streamChat(
        messages: ChatMessage[],
        onChunk: (fullText: string) => void,
        opts?: LLMOpts
    ): Promise<string> {
        return streamFromProxy('anthropic', messages, onChunk, opts)
    }
}
