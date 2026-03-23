export interface ConfidenceScore {
    /** 0-1: overall confidence in the action/response */
    overall: number;
    /** 0-1: how sure about factual accuracy */
    factual: number;
    /** 0-1: how sure the chosen approach is correct */
    approach: number;
    /** 0-1: how sure all aspects were covered */
    completeness: number;
    /** One-line explanation of the confidence level */
    reasoning: string;
}
/**
 * Estimate confidence for a task before execution.
 *
 * Considers task complexity, past success with similar tasks,
 * provider capability, and available context.
 */
export declare function estimateConfidence(task: string, context: string): ConfidenceScore;
/**
 * Format a confidence score as a human-readable string.
 */
export declare function reportConfidence(score: ConfidenceScore): string;
/**
 * Record a calibration entry — predicted vs actual (from self-eval or user feedback).
 * Called after a task completes to improve future predictions.
 */
export declare function recordCalibration(task: string, predicted: number, actual: number): void;
export interface SkillEntry {
    /** Domain or skill area, e.g. 'typescript', 'python', 'devops' */
    domain: string;
    /** 0-1 success rate from historical data */
    successRate: number;
    /** 0-1 average confidence when working in this domain */
    avgConfidence: number;
    /** Number of task attempts */
    sampleSize: number;
    /** ISO date of last attempt */
    lastAttempt: string;
}
export interface SkillProfile {
    /** Domains the agent excels at (successRate >= 0.7, sampleSize >= 3) */
    strengths: SkillEntry[];
    /** Domains the agent struggles with (successRate < 0.5, sampleSize >= 3) */
    weaknesses: SkillEntry[];
    /** Domains the agent hasn't tried enough to assess (<3 samples) */
    unknown: string[];
}
/**
 * Build a skill profile from stored skill data and calibration history.
 */
export declare function getSkillProfile(): SkillProfile;
/**
 * Assess whether the agent is suitable for a given task.
 */
export declare function assessSkillForTask(task: string): {
    canDo: boolean;
    confidence: number;
    suggestion?: string;
};
/**
 * Update the skill profile after completing a task.
 *
 * @param domain - The task domain (auto-detected or overridden)
 * @param success - Whether the task completed successfully
 * @param confidence - The confidence score used for this task
 */
export declare function updateSkillProfile(domain: string, success: boolean, confidence: number): void;
export interface EffortEstimate {
    /** Tool call count estimate: min, expected, max */
    toolCalls: {
        min: number;
        expected: number;
        max: number;
    };
    /** Estimated cost in USD: min, expected, max */
    estimatedCostUsd: {
        min: number;
        expected: number;
        max: number;
    };
    /** Complexity classification */
    complexity: 'trivial' | 'simple' | 'moderate' | 'complex' | 'ambitious';
    /** Human-readable breakdown of expected operations */
    breakdown: string;
}
/**
 * Estimate the effort required for a task — tool calls, cost, and complexity.
 *
 * @param task - The task description
 * @param context - Optional context (repo state, file list, etc.)
 */
export declare function estimateEffort(task: string, context?: string): EffortEstimate;
/**
 * Record actual effort after a task completes, for future calibration.
 */
export declare function recordActualEffort(task: string, actualToolCalls: number, actualCostUsd: number): void;
/**
 * Register confidence engine tools with the kbot tool registry.
 */
export declare function registerConfidenceTools(): void;
//# sourceMappingURL=confidence.d.ts.map