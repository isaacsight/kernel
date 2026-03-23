/**
 * Check if a request is allowed for the given provider.
 * Returns whether the request can proceed, how long to wait if not, and an optional reason.
 */
export declare function checkRateLimit(provider: string): {
    allowed: boolean;
    waitMs: number;
    reason?: string;
};
/**
 * Record a completed request, consuming tokens from the bucket and incrementing RPM count.
 */
export declare function recordRequest(provider: string, tokens: number): void;
/**
 * Record a 429 rate limit response. Sets retry-after with exponential backoff.
 */
export declare function recordRateLimit(provider: string, retryAfterMs?: number): void;
/**
 * Wait until the rate limit clears for the given provider.
 * Prints a progress message to stderr while waiting.
 */
export declare function waitForRateLimit(provider: string): Promise<void>;
/**
 * Get the current rate limit status for a provider.
 */
export declare function getRateLimitStatus(provider: string): {
    rpm: {
        used: number;
        limit: number;
    };
    tpm: {
        used: number;
        limit: number;
    };
    blocked: boolean;
};
/**
 * Format all active providers' rate limit status for display.
 */
export declare function formatRateLimitStatus(): string;
/**
 * Reset all rate limit state. Useful for testing or manual recovery.
 */
export declare function resetRateLimits(): void;
//# sourceMappingURL=rate-limiter.d.ts.map