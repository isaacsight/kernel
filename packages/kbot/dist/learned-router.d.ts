/** A recorded routing decision */
export interface RoutingRecord {
    /** Normalized intent string */
    intent: string;
    /** Keywords extracted from the message */
    keywords: string[];
    /** Which agent was selected */
    agent: string;
    /** How the route was determined: 'learned' | 'bayesian' | 'keyword' | 'category' | 'llm' */
    method: 'learned' | 'bayesian' | 'keyword' | 'category' | 'llm';
    /** Was the routing successful (user didn't override) */
    success: boolean;
    /** Times this exact route has been used */
    count: number;
    /** Last used */
    lastUsed: string;
}
/** Routing result from the cascaded classifier */
export interface RouteResult {
    /** Selected agent */
    agent: string;
    /** Confidence 0-1 */
    confidence: number;
    /** Which cascade level resolved it */
    method: 'learned' | 'bayesian' | 'keyword' | 'category' | 'llm';
    /** Was this a cache hit (no LLM needed) */
    cached: boolean;
}
/**
 * Cascaded route — try each level in order, return first confident match.
 *
 * Level 1:   Exact intent lookup (from history)
 * Level 1.5: Bayesian skill rating (OpenSkill mu/sigma)
 * Level 2:   Keyword voting (weighted by history frequency)
 * Level 3:   Category pattern matching
 * Level 4:   Returns null — caller should use LLM
 */
export declare function learnedRoute(message: string): RouteResult | null;
/**
 * Record a routing decision for future learning.
 * Call this after the agent responds (or when user overrides).
 */
export declare function recordRoute(message: string, agent: string, method: RouteResult['method'], success?: boolean): void;
/** Get routing stats */
export declare function getRoutingStats(): {
    totalRoutes: number;
    learnedHits: number;
    bayesianHits: number;
    keywordHits: number;
    categoryHits: number;
    llmFallbacks: number;
    cacheHitRate: string;
};
/** Override a route (user correction) */
export declare function overrideRoute(message: string, correctAgent: string): void;
//# sourceMappingURL=learned-router.d.ts.map