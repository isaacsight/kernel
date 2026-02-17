// ═══════════════════════════════════════════════════════════════
//  Provider Registry — Singleton provider management
// ═══════════════════════════════════════════════════════════════
//
//  Default: Anthropic. Call setProvider() to switch at runtime.
//  Future: wire this to a settings panel or environment variable.

import type { LLMProvider } from './types'
import { AnthropicProvider } from './anthropic'

// ─── Singleton ────────────────────────────────────────────────

let activeProvider: LLMProvider = new AnthropicProvider()

/** Get the currently active LLM provider */
export function getProvider(): LLMProvider {
    return activeProvider
}

/** Switch to a different LLM provider at runtime */
export function setProvider(provider: LLMProvider): void {
    console.log(`[Provider] Switching from ${activeProvider.name} to ${provider.name}`)
    activeProvider = provider
}

// ─── Factory ──────────────────────────────────────────────────

export type ProviderName = 'anthropic' // | 'openai' | 'gemini' | 'ollama'

/** Create a provider by name */
export function createProvider(name: ProviderName): LLMProvider {
    switch (name) {
        case 'anthropic':
            return new AnthropicProvider()
        // Future providers:
        // case 'openai':   return new OpenAIProvider()
        // case 'gemini':   return new GeminiProvider()
        // case 'ollama':   return new OllamaProvider()
        default:
            throw new Error(`Unknown provider: ${name}`)
    }
}

// ─── Re-exports ───────────────────────────────────────────────
// Re-export types so consumers only need one import

export type { LLMProvider, LLMOpts, ChatMessage, ModelTier, ContentBlock } from './types'
