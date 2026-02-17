// ═══════════════════════════════════════════════════════════════
//  Anthropic Provider — Wraps ClaudeClient.ts
// ═══════════════════════════════════════════════════════════════
//
//  Maps the generic LLMProvider interface to Claude API calls.
//  This is the default provider — existing behavior is preserved
//  exactly.

import type { LLMProvider, LLMOpts, ChatMessage, ModelTier } from './types'
import { claudeJSON, claudeText, claudeStream, claudeStreamChat } from '../ClaudeClient'

type ClaudeModel = 'sonnet' | 'haiku'

/** Map semantic tiers to Claude model names */
function tierToModel(tier?: ModelTier): ClaudeModel {
    switch (tier) {
        case 'fast': return 'haiku'
        case 'strong': return 'sonnet'
        default: return 'sonnet'
    }
}

/** Convert LLMOpts → ClaudeOpts */
function toClaudeOpts(opts?: LLMOpts) {
    if (!opts) return undefined
    return {
        system: opts.system,
        model: tierToModel(opts.tier) as ClaudeModel,
        max_tokens: opts.max_tokens,
        web_search: opts.web_search,
        signal: opts.signal,
    }
}

export class AnthropicProvider implements LLMProvider {
    readonly name = 'anthropic'

    async json<T>(prompt: string, opts?: LLMOpts): Promise<T> {
        return claudeJSON<T>(prompt, toClaudeOpts(opts))
    }

    async text(prompt: string, opts?: LLMOpts): Promise<string> {
        return claudeText(prompt, toClaudeOpts(opts))
    }

    async stream(
        prompt: string,
        onChunk: (fullText: string) => void,
        opts?: LLMOpts
    ): Promise<string> {
        return claudeStream(prompt, onChunk, toClaudeOpts(opts))
    }

    async streamChat(
        messages: ChatMessage[],
        onChunk: (fullText: string) => void,
        opts?: LLMOpts
    ): Promise<string> {
        return claudeStreamChat(messages, onChunk, toClaudeOpts(opts))
    }
}
