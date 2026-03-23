import type { ByokProvider } from './auth.js';
export declare const TIERS: {
    readonly premium: ByokProvider[];
    readonly standard: ByokProvider[];
    readonly fast: ByokProvider[];
    readonly local: ByokProvider[];
};
export type Tier = keyof typeof TIERS;
export interface ProviderHealth {
    provider: ByokProvider;
    consecutiveFailures: number;
    lastFailure: number | null;
    lastSuccess: number | null;
    avgLatencyMs: number;
    isHealthy: boolean;
}
/** Record a successful provider call */
export declare function recordSuccess(provider: ByokProvider, latencyMs: number): void;
/** Record a failed provider call */
export declare function recordFailure(provider: ByokProvider, _error?: Error): void;
/** Get health snapshot for all tracked providers */
export declare function getProviderHealth(): ProviderHealth[];
/** Get the healthiest provider in a tier, preferring lowest latency */
export declare function getBestProvider(tier?: string): ByokProvider;
export interface FallbackOptions {
    /** Max retries on same provider (default: 3) */
    maxRetries?: number;
    /** Base delay in ms for exponential backoff (default: 1000) */
    baseDelayMs?: number;
    /** Starting provider (default: inferred from config) */
    startProvider?: ByokProvider;
    /** API key resolver — given a provider, return its key or null */
    getKey?: (provider: ByokProvider) => string | null;
    /** Skip cross-tier fallback (default: false) */
    sameTierOnly?: boolean;
    /** Errors that should NOT trigger fallback (e.g., 400 bad request) */
    noRetryErrors?: Array<string | RegExp>;
    /** Called on each retry/failover for logging */
    onFallback?: (from: ByokProvider, to: ByokProvider, level: 'retry' | 'same-tier' | 'cross-tier', error: Error) => void;
}
/**
 * Execute a provider call with multi-level fallback.
 *
 * Level 1: Retry same provider with exponential backoff
 * Level 2: Failover to another provider in the same tier
 * Level 3: Degrade to a cheaper tier
 */
export declare function withFallback<T>(fn: (provider: ByokProvider, apiKey: string) => Promise<T>, options?: FallbackOptions): Promise<T>;
/** Reset all health data (for testing) */
export declare function resetHealth(): void;
//# sourceMappingURL=provider-fallback.d.ts.map