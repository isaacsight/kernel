// ═══════════════════════════════════════════════════════════════
//  LLM Provider Interface — Model-Agnostic Abstraction
// ═══════════════════════════════════════════════════════════════
//
//  This interface decouples Kernel's cognitive architecture from
//  any specific LLM provider. Implement it for Anthropic, OpenAI,
//  Gemini, Ollama, or any future provider.

// ─── Content Block ────────────────────────────────────────────
// Defined here (provider-agnostic) so no provider depends on Claude types.

export type ContentBlock =
    | { type: 'text'; text: string }
    | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
    | { type: 'document'; source: { type: 'base64'; media_type: string; data: string } }

// ─── Model Tier ───────────────────────────────────────────────
// Replaces hardcoded 'sonnet' / 'haiku' with semantic tiers.
// Each provider maps these to their own model identifiers.

export type ModelTier = 'fast' | 'strong'

// ─── Options ──────────────────────────────────────────────────

export interface LLMOpts {
    system?: string
    tier?: ModelTier     // default: 'strong'
    model?: string       // explicit model override (e.g. 'gpt-4-turbo', 'llama3.2')
    max_tokens?: number
    web_search?: boolean
    signal?: AbortSignal
}

// ─── Chat Message ─────────────────────────────────────────────

export interface ChatMessage {
    role: string
    content: string | ContentBlock[]
}

// ─── Provider Interface ───────────────────────────────────────

export interface LLMProvider {
    readonly name: string

    /**
     * Structured JSON — for classification, extraction, planning.
     * Parses the response and returns typed data.
     */
    json<T>(prompt: string, opts?: LLMOpts): Promise<T>

    /**
     * Plain text — for intermediate steps, summaries, etc.
     */
    text(prompt: string, opts?: LLMOpts): Promise<string>

    /**
     * Single-turn streaming — for streaming a single prompt.
     */
    stream(
        prompt: string,
        onChunk: (fullText: string) => void,
        opts?: LLMOpts
    ): Promise<string>

    /**
     * Multi-turn streaming chat — for user-facing conversations.
     * Supports conversation history and content blocks (images, docs).
     */
    streamChat(
        messages: ChatMessage[],
        onChunk: (fullText: string) => void,
        opts?: LLMOpts
    ): Promise<string>
}
