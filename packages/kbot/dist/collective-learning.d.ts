export interface AnonymizedPattern {
    /** Pattern type: intent match, tool sequence, etc. */
    type: string;
    /** Programming language (if detected) */
    language: string | null;
    /** Framework (if detected) */
    framework: string | null;
    /** Success rate 0-1 */
    successRate: number;
    /** Tool names used (no args, no paths) */
    toolsUsed: string[];
    /** Agent that handled it */
    agentUsed: string | null;
    /** Number of times this pattern succeeded */
    hits: number;
    /** Keywords (generic, no PII) */
    keywords: string[];
}
interface CollectivePattern extends AnonymizedPattern {
    /** Confidence aggregated across the collective */
    confidence: number;
    /** How many distinct devices contributed to this pattern */
    sampleCount: number;
    /** Last time this pattern was updated in the collective */
    lastUpdated: string;
}
/** Read ~/.kbot/memory/patterns.json, strip PII, keep only safe fields.
 *  Returns an anonymized array suitable for sharing. */
export declare function collectAnonymizedPatterns(): AnonymizedPattern[];
/** POST anonymized patterns to the collective endpoint.
 *  Includes a device fingerprint hash for dedup (not identifiable).
 *  Returns count of patterns contributed. */
export declare function contributePatterns(): Promise<number>;
/** GET patterns from the collective endpoint.
 *  Merges with local patterns, preferring higher-confidence entries.
 *  Returns count of new patterns gained. */
export declare function fetchCollectivePatterns(): Promise<number>;
/** Orchestrate the full collective sync cycle:
 *  collect -> contribute -> fetch -> merge.
 *  Returns a human-readable summary. */
export declare function runCollectiveSync(): Promise<string>;
/** Get collective learning stats for display */
export declare function getCollectiveLearningStats(): string;
/** Load cached collective patterns for use by the routing/agent system */
export declare function getCachedCollectivePatterns(): CollectivePattern[];
export {};
//# sourceMappingURL=collective-learning.d.ts.map