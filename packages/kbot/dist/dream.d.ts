export interface DreamInsight {
    /** Unique ID */
    id: string;
    /** The consolidated insight */
    content: string;
    /** Category: pattern | preference | skill | project | relationship */
    category: DreamCategory;
    /** Keywords for retrieval */
    keywords: string[];
    /** Relevance score (0-1), decays over time */
    relevance: number;
    /** How many sessions contributed to this insight */
    sessions: number;
    /** Created timestamp */
    created: string;
    /** Last reinforced (refreshed relevance) */
    lastReinforced: string;
    /** Source: which sessions/topics generated this */
    source: string;
}
export type DreamCategory = 'pattern' | 'preference' | 'skill' | 'project' | 'relationship' | 'music';
export interface DreamState {
    /** Total dream cycles completed */
    cycles: number;
    /** Last dream timestamp */
    lastDream: string | null;
    /** Total insights ever created */
    totalInsights: number;
    /** Total insights archived (aged out) */
    totalArchived: number;
    /** Insights currently active */
    activeInsights: number;
    /** Last session turn count that was dreamed about */
    lastSessionTurns: number;
}
/** Apply exponential decay to all insights based on time elapsed */
export declare function ageMemories(insights: DreamInsight[]): {
    aged: DreamInsight[];
    archived: DreamInsight[];
};
/**
 * Apply dream insights back into the learning system.
 * This is the feedback loop that makes the memory cascade bidirectional:
 *   - "preference" insights → update user profile via learnFact()
 *   - "pattern" insights → hint the pattern cache via recordPattern()
 *   - "skill" insights → record as observed knowledge
 *   - "project" insights → record as project context
 *
 * Called at the end of every dream cycle after new insights are extracted.
 */
export declare function applyDreamInsights(insights: DreamInsight[]): ApplyResult;
export interface ApplyResult {
    preferencesApplied: number;
    patternsHinted: number;
    factsLearned: number;
    promptAmendments: number;
}
/** Run a full dream cycle — consolidate, reinforce, age */
export declare function dream(sessionId?: string): Promise<DreamResult>;
export interface DreamResult {
    success: boolean;
    newInsights: number;
    reinforced: number;
    archived: number;
    cycle: number;
    duration: number;
    error: string | null;
    /** Feedback from applying insights back into learning tiers */
    applied: ApplyResult | null;
}
/** Get dream insights for inclusion in system prompt */
export declare function getDreamPrompt(maxInsights?: number): string;
/** Get full dream status */
export declare function getDreamStatus(): {
    state: DreamState;
    insights: DreamInsight[];
    archiveCount: number;
};
/** Search dream insights by keyword */
export declare function searchDreams(query: string): DreamInsight[];
/** Manually reinforce a specific insight (user confirms it's still relevant) */
export declare function reinforceInsight(insightId: string): boolean;
/** Run dream after session ends (non-blocking) */
export declare function dreamAfterSession(sessionId?: string): void;
//# sourceMappingURL=dream.d.ts.map