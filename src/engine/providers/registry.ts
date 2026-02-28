// ═══════════════════════════════════════════════════════════════
//  Provider Registry — Singleton provider management
// ═══════════════════════════════════════════════════════════════
//
//  Default: Anthropic. Call setProvider() to switch at runtime.

import type { LLMProvider } from './types'
import { AnthropicProvider } from './anthropic'
import { OpenAIProvider } from './openai'
import { GeminiProvider } from './gemini'
import { OllamaProvider } from './ollama'
import { NvidiaProvider } from './nvidia'
import { GroqProvider } from './groq'

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

export type ProviderName = 'anthropic' | 'openai' | 'gemini' | 'ollama' | 'nvidia' | 'groq'

/** Create a provider by name */
export function createProvider(name: ProviderName, config?: { baseUrl?: string }): LLMProvider {
    switch (name) {
        case 'anthropic':
            return new AnthropicProvider()
        case 'openai':
            return new OpenAIProvider()
        case 'gemini':
            return new GeminiProvider()
        case 'ollama':
            return new OllamaProvider(config?.baseUrl)
        case 'nvidia':
            return new NvidiaProvider()
        case 'groq':
            return new GroqProvider()
        default:
            throw new Error(`Unknown provider: ${name}`)
    }
}

// ─── Background provider (cost-optimized) ────────────────────
// Shared Groq instance for background operations (routing, memory,
// guardian review, convergence facets). ~20-60x cheaper than Haiku.

const _bgProvider: LLMProvider = new GroqProvider()

/** Get the cost-optimized provider for background/non-user-facing operations */
export function getBackgroundProvider(): LLMProvider {
    return _bgProvider
}

// ─── Re-exports ───────────────────────────────────────────────

export type { LLMProvider, LLMOpts, ChatMessage, ModelTier, ContentBlock } from './types'
