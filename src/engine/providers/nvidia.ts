// ═══════════════════════════════════════════════════════════════
//  NVIDIA Provider — Routes through multi-provider proxy
// ═══════════════════════════════════════════════════════════════
//
//  Uses NVIDIA's OpenAI-compatible API at integrate.api.nvidia.com.

import type { LLMProvider, LLMOpts, ChatMessage } from './types'
import { callLLMProxy, streamFromProxy, parseProxyJSON } from './proxy'

export class NvidiaProvider implements LLMProvider {
    readonly name = 'nvidia'

    async json<T>(prompt: string, opts?: LLMOpts): Promise<T> {
        const res = await callLLMProxy('nvidia', 'json', [{ role: 'user', content: prompt }], opts)
        const { text } = await res.json()
        return parseProxyJSON<T>(text)
    }

    async text(prompt: string, opts?: LLMOpts): Promise<string> {
        const res = await callLLMProxy('nvidia', 'text', [{ role: 'user', content: prompt }], opts)
        const { text } = await res.json()
        return text
    }

    async stream(
        prompt: string,
        onChunk: (fullText: string) => void,
        opts?: LLMOpts
    ): Promise<string> {
        return streamFromProxy('nvidia', [{ role: 'user', content: prompt }], onChunk, opts)
    }

    async streamChat(
        messages: ChatMessage[],
        onChunk: (fullText: string) => void,
        opts?: LLMOpts
    ): Promise<string> {
        return streamFromProxy('nvidia', messages, onChunk, opts)
    }
}
