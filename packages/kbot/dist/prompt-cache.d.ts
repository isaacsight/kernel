/** Prompt section with optional cache control */
export interface PromptSection {
    /** Section identifier */
    id: string;
    /** The text content */
    text: string;
    /** Whether this section is stable (cacheable) or dynamic */
    stable: boolean;
}
/** Cache stats for monitoring */
export interface PromptCacheStats {
    hits: number;
    misses: number;
    lastHash: string;
    estimatedSavings: number;
}
/**
 * Build a cacheable system prompt from sections.
 *
 * For Anthropic: returns structured content blocks with cache_control
 * on the stable portion. This allows the API to cache the large static
 * part and only process the dynamic part fresh each time.
 *
 * For other providers: returns a plain concatenated string (no caching).
 */
export declare function buildCacheablePrompt(sections: PromptSection[], provider?: string): {
    text: string;
    cacheBlocks?: Array<{
        type: string;
        text: string;
        cache_control?: {
            type: string;
        };
    }>;
};
/**
 * Create prompt sections from agent.ts components.
 * Separates stable (persona, tools, rules) from dynamic (learning, memory).
 */
export declare function createPromptSections(opts: {
    persona?: string;
    toolInstructions?: string;
    conversationRules?: string;
    matrixPrompt?: string;
    contextSnippet?: string;
    memorySnippet?: string;
    learningContext?: string;
}): PromptSection[];
/** Get cache statistics */
export declare function getPromptCacheStats(): PromptCacheStats;
/** Reset cache stats (for testing) */
export declare function resetPromptCacheStats(): void;
//# sourceMappingURL=prompt-cache.d.ts.map