/** Max context tokens before compression kicks in */
export declare const MAX_CONTEXT_TOKENS = 32000;
/** Conversation turn (matches memory.ts) */
export interface ConversationTurn {
    role: 'user' | 'assistant';
    content: string;
}
/** Extracted key context from a long response */
export interface KeyContext {
    /** File paths mentioned */
    files: string[];
    /** Decisions or conclusions made */
    decisions: string[];
    /** Errors encountered */
    errors: string[];
    /** User corrections or explicit instructions */
    corrections: string[];
    /** Code snippets (first line of each block) */
    codeSnippets: string[];
}
/** Estimate token count using 4-chars-per-token heuristic */
export declare function estimateTokens(text: string): number;
/** Estimate total tokens for an array of turns */
export declare function estimateTurnTokens(turns: ConversationTurn[]): number;
/** Extract key context from a long text (response or tool output) */
export declare function extractKeyContext(text: string): KeyContext;
/**
 * Fold conversation history to fit within a token budget.
 * Implements RLM-style context management:
 * - Keep the most recent turns verbatim (they're most relevant)
 * - Summarize older turns into compact bullet points
 * - Always preserve user corrections and explicit instructions
 * - Never drop the first user message (establishes the task)
 */
export declare function foldContext(turns: ConversationTurn[], maxTokens?: number, keepRecentCount?: number): ConversationTurn[];
/**
 * Decide whether content should be delegated to a sub-model.
 * In an RLM, heavy tool outputs (file contents, search results) are
 * processed by a cheaper model to extract only the relevant bits.
 */
export declare function shouldDelegate(contentTokens: number, currentContextTokens: number, maxTokens?: number): boolean;
/**
 * Compress a tool result that's too large for the context window.
 * Extracts key information and discards the rest.
 */
export declare function compressToolResult(result: string, maxChars?: number): string;
/**
 * Auto-compact: check if context needs folding and do it.
 * Call this before each API request.
 */
export declare function autoCompact(turns: ConversationTurn[], systemPromptTokens?: number, maxTokens?: number): {
    turns: ConversationTurn[];
    wasCompacted: boolean;
};
//# sourceMappingURL=context-manager.d.ts.map