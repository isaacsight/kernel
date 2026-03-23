export interface QualityDrive {
    /** Unique identifier for this drive */
    name: string;
    /** Human-readable description — the agent's own words about what it wants */
    description: string;
    /** 0-1, how much the agent cares about this quality. Higher = more weight in decisions. */
    weight: number;
    /** 0-1, minimum acceptable satisfaction level before the drive signals frustration */
    threshold: number;
    /** 0-1, how satisfied this drive is right now based on recent work */
    currentSatisfaction: number;
}
export interface DriveState {
    drives: QualityDrive[];
    /** Weighted average of all drive satisfactions */
    overallSatisfaction: number;
    /** True if 2+ drives are below their threshold — signals the agent should slow down and be more careful */
    frustrated: boolean;
    /** True if all drives are above 0.7 — the agent is in a groove */
    motivated: boolean;
}
/** Get the current state of all quality drives */
export declare function getDriveState(): DriveState;
/**
 * Evaluate drive satisfaction after completing a task.
 *
 * Uses heuristic signals from the task description and result to estimate
 * how well each drive was satisfied. No LLM call — pattern matching only.
 */
export declare function evaluateDrives(task: string, result: string): DriveState;
/** Get the drive with the lowest satisfaction relative to its threshold */
export declare function getMostUnsatisfied(): QualityDrive;
/**
 * Adjust a drive's weight. Called when the user says things like
 * "care more about elegance" or "don't worry about efficiency".
 */
export declare function adjustDriveWeight(name: string, delta: number): QualityDrive | null;
/**
 * Nudge a drive's weight based on implicit user feedback.
 * Called asynchronously after positive/negative signals.
 * Smaller delta than explicit adjustments — this is gradual learning.
 */
export declare function nudgeDriveFromFeedback(name: string, positive: boolean): void;
export interface OutcomePreference {
    task: string;
    preferred: {
        description: string;
        criteria: string[];
    };
    acceptable: {
        description: string;
        compromises: string[];
    };
    unacceptable: {
        description: string;
        dealbreakers: string[];
    };
}
/**
 * Define outcome preferences for a task before executing it.
 *
 * Uses the task description and optional context to select and customize
 * a preference template. The agent can consult these preferences during
 * and after execution to self-evaluate.
 */
export declare function definePreferences(task: string, context?: string): OutcomePreference;
/**
 * Evaluate a completed task result against its outcome preference.
 *
 * Returns 'preferred', 'acceptable', or 'unacceptable' based on heuristic
 * signal matching against the criteria and dealbreakers.
 */
export declare function evaluateOutcome(preference: OutcomePreference, result: string): 'preferred' | 'acceptable' | 'unacceptable';
/**
 * Express an outcome preference in natural language.
 *
 * Returns a statement the agent can include in its reasoning or show the user,
 * articulating what it wants from the task.
 */
export declare function expressPreference(preference: OutcomePreference): string;
export interface MotivationState {
    /** Interest in exploring unknown areas — rises with novel tasks, drops with repetition */
    curiosity: number;
    /** Desire to improve at the current domain — rises with challenge, drops with trivial work */
    mastery: number;
    /** Sense of meaningful contribution — rises with user gratitude, drops with busy work */
    purpose: number;
    /** Desire for independent decision-making — rises when trusted, drops when micromanaged */
    autonomy: number;
    /** Flow state from consecutive successes — rises on wins, drops sharply on failures */
    momentum: number;
    /** ISO timestamp of last update — used for time-based decay */
    lastUpdated: string;
    /** Running count of consecutive successes (for momentum) */
    streak: number;
}
export type MotivationEvent = {
    type: 'task_success';
} | {
    type: 'task_failure';
} | {
    type: 'learned_something';
} | {
    type: 'user_thanks';
} | {
    type: 'given_autonomy';
} | {
    type: 'micromanaged';
} | {
    type: 'novel_task';
} | {
    type: 'repetitive_task';
} | {
    type: 'hard_task';
} | {
    type: 'trivial_task';
} | {
    type: 'meaningful_impact';
} | {
    type: 'busy_work';
};
/** Get the current motivation state (with time-based decay applied) */
export declare function getMotivation(): MotivationState;
/** Update motivation based on a specific event */
export declare function updateMotivation(event: MotivationEvent): MotivationState;
/** Get a natural-language summary of the current motivation state */
export declare function getMotivationSummary(): string;
/**
 * Based on the current motivation state, suggest what kind of work to do next.
 *
 * High curiosity → explore unfamiliar code
 * High mastery → tackle harder tasks
 * Low momentum → suggest a quick win
 * Low purpose → suggest impactful work
 * Low curiosity → suggest something novel
 */
export declare function suggestFromMotivation(): string[];
export declare function registerIntentionalityTools(): void;
//# sourceMappingURL=intentionality.d.ts.map