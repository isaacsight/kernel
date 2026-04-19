export interface PruneOptions {
    /** Drop entries older than this many days (default: 30) */
    maxAgeDays?: number;
    /** Drop entries whose solution mentions versions below this (e.g. "3.99.0") */
    obsoleteVersionPrefix?: string;
    /** Drop entries with confidence < this and reuses === 0 (default: 0.3) */
    minConfidenceIfUnused?: number;
    /** Dry run — count what would be pruned without writing */
    dryRun?: boolean;
}
export interface PruneResult {
    total: number;
    kept: number;
    pruned: number;
    reasons: Record<string, number>;
    backup?: string;
}
export declare function pruneSolutions(opts?: PruneOptions): PruneResult;
//# sourceMappingURL=memory-prune.d.ts.map