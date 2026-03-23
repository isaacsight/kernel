export interface Weakness {
    /** Which subsystem is weak (e.g. 'streaming', 'tool-execution', 'routing') */
    area: string;
    /** What's wrong — human-readable */
    description: string;
    /** Severity: how much this hurts overall quality */
    severity: 'low' | 'medium' | 'high';
    /** Evidence — metric name, sample count, etc. */
    evidence: string;
    /** Suggested file to improve */
    targetFile?: string;
}
export interface Proposal {
    /** File path relative to packages/kbot/ */
    file: string;
    /** Description of the change */
    description: string;
    /** The weakness this addresses */
    weakness: Weakness;
    /** Full proposed file content (or diff instructions) */
    patch: string;
    /** Original file content for rollback reference */
    original: string;
}
export interface EvolutionResult {
    /** Whether the change was applied or rolled back */
    status: 'applied' | 'rolled-back' | 'skipped';
    /** Why this status */
    reason: string;
    /** Weakness that was targeted */
    weakness: Weakness;
    /** Score improvement (positive = better) */
    delta: number;
    /** Timestamp */
    timestamp: string;
}
export interface EvolutionCycle {
    /** Unique ID for this cycle */
    id: string;
    /** When the cycle started */
    startedAt: string;
    /** When the cycle ended */
    endedAt?: string;
    /** Weaknesses found */
    weaknesses: Weakness[];
    /** Proposals generated */
    proposals: Proposal[];
    /** Results of applying proposals */
    results: EvolutionResult[];
    /** Overall cycle status */
    status: 'running' | 'completed' | 'failed' | 'aborted';
    /** Error message if failed */
    error?: string;
}
/**
 * Analyze kbot's performance data to find areas for improvement.
 * Uses the confidence engine's skill profile + learning stats.
 */
export declare function diagnose(): Weakness[];
/**
 * Ask the LLM to propose a code improvement for a weakness.
 * Reuses the auth/provider pattern from self-eval.ts.
 */
export declare function proposeImprovement(weakness: Weakness): Promise<Proposal | null>;
/**
 * Apply a proposal temporarily and run validation (tsc + vitest).
 * Returns true if the change passes, false otherwise.
 */
export declare function validate(proposal: Proposal): {
    passes: boolean;
    errors: string;
};
export interface Metrics {
    /** Lines of code in the file */
    loc: number;
    /** Cyclomatic complexity estimate (branches + loops) */
    complexity: number;
    /** Number of TODO/FIXME/HACK markers */
    todoCount: number;
    /** Number of exported functions */
    exportCount: number;
}
export declare function scoreMetrics(source: string): Metrics;
/**
 * Compute a delta score between before/after metrics.
 * Positive = improvement, negative = regression.
 */
export declare function computeDelta(before: Metrics, after: Metrics): number;
/**
 * Run one evolution cycle:
 * 1. Check for clean working tree
 * 2. Diagnose weaknesses
 * 3. For each weakness (max 3): propose → validate → score → apply/rollback
 * 4. Log everything
 */
export declare function runEvolutionCycle(): Promise<EvolutionCycle>;
/** Get the full evolution log */
export declare function getEvolutionLog(): EvolutionCycle[];
/** Get a summary of evolution activity */
export declare function getEvolutionStats(): {
    totalCycles: number;
    totalApplied: number;
    totalRolledBack: number;
    totalSkipped: number;
    avgDelta: number;
    lastCycle: string | null;
};
/** Format evolution status for terminal display */
export declare function formatEvolutionStatus(): string;
/** Format diagnosis output for terminal display */
export declare function formatDiagnosis(weaknesses: Weakness[]): string;
//# sourceMappingURL=evolution.d.ts.map