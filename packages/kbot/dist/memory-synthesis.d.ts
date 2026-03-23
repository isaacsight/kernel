export type InsightCategory = 'coding_style' | 'project_pattern' | 'tool_preference' | 'agent_preference' | 'workflow' | 'personality';
export interface Insight {
    /** The synthesized observation in natural language */
    text: string;
    /** Thematic category */
    category: InsightCategory;
    /** 0-1, based on number of supporting observations */
    confidence: number;
    /** How many raw observations support this insight */
    supportingCount: number;
    /** ISO timestamp when this insight was first created */
    created: string;
}
export interface MemorySynthesis {
    insights: Insight[];
    /** ISO timestamp of last synthesis run */
    synthesizedAt: string;
    /** How many raw observations were processed in the last run */
    observationCount: number;
}
/**
 * Returns true if there are enough new observations since the last
 * synthesis to justify another pass (>20 new observations).
 */
export declare function shouldSynthesize(): boolean;
/**
 * Run the full synthesis pass.
 *
 * Reads all memory files, performs frequency analysis and pattern matching,
 * and produces higher-order insights. No LLM calls — pure statistics.
 *
 * Returns the updated MemorySynthesis.
 */
export declare function synthesizeMemory(): MemorySynthesis;
/**
 * Retrieve synthesized insights, optionally filtered by category.
 * Returns up to `max` insights sorted by confidence.
 */
export declare function getInsights(category?: InsightCategory, max?: number): Insight[];
/**
 * Format insights for injection into the system prompt.
 * Produces a compact, readable block that gives the agent
 * deeper self-awareness about the user.
 */
export declare function formatInsightsForPrompt(insights: Insight[]): string;
/**
 * Convenience function for the agent loop.
 * Returns formatted top insights ready for system prompt injection,
 * or empty string if no synthesis data exists.
 */
export declare function getSynthesisContext(maxInsights?: number): string;
/**
 * Check-and-run: if synthesis is due, run it and return the count
 * of new insights produced. Otherwise return 0.
 * Safe to call on every session start — it is a no-op when not needed.
 */
export declare function maybeSynthesize(): number;
/**
 * Get synthesis stats for display in `kbot stats` or diagnostics.
 */
export declare function getSynthesisStats(): {
    insightCount: number;
    lastSynthesized: string;
    observationCount: number;
    topInsights: string[];
};
//# sourceMappingURL=memory-synthesis.d.ts.map