export interface FeedPattern {
    /** Pattern type: intent_match, tool_sequence, etc. */
    type: string;
    /** Programming language (if detected) */
    language: string | null;
    /** Framework (if detected) */
    framework: string | null;
    /** Success rate 0-1 */
    successRate: number;
    /** Tool names used */
    toolsUsed: string[];
    /** Agent that handled it */
    agentUsed: string | null;
    /** Number of times this pattern was observed */
    hits: number;
    /** Keywords (generic tech terms) */
    keywords: string[];
    /** Confidence score (0-1) */
    confidence: number;
    /** Number of contributing sources */
    sampleCount: number;
    /** Last updated timestamp */
    lastUpdated: string;
    /** Source: 'local' or 'collective' */
    source: 'local' | 'collective';
}
export interface FeedEntry {
    /** Human-readable insight */
    insight: string;
    /** Feed category */
    category: FeedCategory;
    /** Relevance score (higher = more relevant) */
    score: number;
    /** Underlying pattern */
    pattern: FeedPattern;
}
export type FeedCategory = 'tools_that_worked' | 'best_agents' | 'common_solutions' | 'forged_tools';
export interface FeedResult {
    entries: FeedEntry[];
    total_patterns_scanned: number;
    project_type: string | null;
}
/** Format a single pattern as a readable insight */
export declare function formatFeedEntry(pattern: FeedPattern): string;
/**
 * Run the pattern feed. Reads local + collective patterns, scores them,
 * groups by category, and returns the top 20 insights.
 *
 * @param options.projectType - Optional project type filter (react, python, etc.)
 * @returns Feed result with entries, total patterns scanned, and project type
 */
export declare function runPatternFeed(options?: {
    projectType?: string;
}): FeedResult;
/**
 * Get a feed filtered for a specific project type.
 * Returns patterns that other users of the same stack found useful.
 */
export declare function getFeedForProject(projectType: string): FeedResult;
/**
 * Full-text search across all patterns.
 * Returns matching insights with confidence scores.
 */
export declare function searchFeed(query: string): FeedEntry[];
//# sourceMappingURL=pattern-feed.d.ts.map