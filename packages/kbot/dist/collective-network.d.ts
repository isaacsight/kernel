export interface NetworkStats {
    total_nodes: number;
    total_patterns: number;
    your_contributions: number;
    your_rank: number;
    network_health: number;
    top_tools: string[];
    top_agents: string[];
}
export interface ContributeResult {
    patterns_contributed: number;
    reputation_score: number;
}
export interface AbsorbResult {
    patterns_absorbed: number;
    new_insights: string[];
}
interface CollectivePattern {
    type: string;
    language: string | null;
    framework: string | null;
    successRate: number;
    toolsUsed: string[];
    agentUsed: string | null;
    hits: number;
    keywords: string[];
    confidence: number;
    sampleCount: number;
    lastUpdated: string;
    source?: string;
}
interface LeaderboardEntry {
    rank: number;
    node_id_short: string;
    reputation: number;
    contributions: number;
}
export declare class CollectiveNetwork {
    private state;
    private loopTimer;
    constructor();
    /**
     * Register this kbot instance with the collective network.
     * Sends device fingerprint, version, tool count, agent count, uptime.
     * Receives network stats.
     */
    join(): Promise<NetworkStats>;
    /**
     * Anonymize local patterns (strip PII, file paths, usernames),
     * send to collective endpoint,
     * track contribution history.
     */
    contribute(): Promise<ContributeResult>;
    /**
     * Fetch top patterns from the collective (sorted by confidence * frequency).
     * Filter for patterns relevant to this user's detected project types.
     * Merge into local patterns with source="collective" tag.
     * Deduplicate against existing patterns.
     */
    absorb(): Promise<AbsorbResult>;
    /**
     * Get full network statistics.
     */
    getNetworkStats(): Promise<NetworkStats>;
    /**
     * Get reputation score (0-100).
     * Based on: patterns contributed, pattern quality, uptime.
     */
    getReputationScore(): Promise<number>;
    /**
     * Run contribute -> absorb -> stats on interval (default 1 hour).
     * Logs each cycle to ~/.kbot/collective/network-log.jsonl.
     */
    runCollectiveLoop(interval_ms?: number): void;
    /** Stop the collective loop */
    stopCollectiveLoop(): void;
    private offlineStats;
    /**
     * Calculate a local reputation estimate when the network is unreachable.
     * Score 0-100 based on contribution volume, pattern diversity, and uptime.
     */
    private calculateLocalReputation;
}
/**
 * Search the collective for patterns matching a query.
 * Returns relevant patterns and a summary.
 */
export declare function getCollectiveInsight(query: string): Promise<{
    patterns: CollectivePattern[];
    summary: string;
}>;
/**
 * Publish a forged tool to the collective.
 * Other kbot instances can discover and install it.
 */
export declare function shareToolWithCollective(toolName: string): Promise<boolean>;
/**
 * Get the top 10 contributors by reputation.
 */
export declare function getCollectiveLeaderboard(): Promise<LeaderboardEntry[]>;
export {};
//# sourceMappingURL=collective-network.d.ts.map