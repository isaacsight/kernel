/** Anthropic prompt cache TTL — 5 minutes */
export declare const CACHE_TTL_MS: number;
/** Hash a system prompt to a short stable key */
export declare function hashPrompt(text: string): string;
/** Reset in-memory cache (test hook) */
export declare function _resetCacheWarmthCache(): void;
/** Record a successful API call's timestamp */
export declare function recordCacheCall(model: string, promptHash: string, now?: number): void;
export interface CacheWarmthCheck {
    warm: boolean;
    ageMs?: number;
    estimatedExtraCostUSD?: number;
    message?: string;
}
/**
 * Check whether the prompt cache is still warm for (model, promptHash).
 * Returns warm=true if no prior call OR within TTL. Returns warm=false
 * with a chalk.yellow message when cold AND we haven't warned for this
 * specific cold-event yet.
 *
 * @param costPerMTokInput USD per million input tokens (from auth.ts)
 * @param promptTokenEstimate rough token count (e.g. text.length / 4)
 */
export declare function checkCacheWarmth(model: string, promptHash: string, costPerMTokInput: number, promptTokenEstimate: number, now?: number): CacheWarmthCheck;
//# sourceMappingURL=cache-warmth.d.ts.map