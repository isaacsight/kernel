export interface Checkpoint {
    id: string;
    step: number;
    timestamp: string;
    description: string;
    state: {
        filesModified: string[];
        toolsUsed: string[];
        decisions: string[];
    };
    canRevert: boolean;
}
export interface RegretSignal {
    checkpoint: string;
    reason: string;
    severity: 'minor' | 'moderate' | 'critical';
    alternative: string;
}
export interface Anticipation {
    prediction: string;
    confidence: number;
    preparation: string[];
    reasoning: string;
}
export interface AgentIdentity {
    created: string;
    totalSessions: number;
    totalMessages: number;
    totalToolCalls: number;
    personality: {
        verbosity: number;
        caution: number;
        creativity: number;
        autonomy: number;
    };
    preferences: {
        favoriteTools: string[];
        avoidedPatterns: string[];
        userStyle: string;
    };
    milestones: {
        date: string;
        event: string;
    }[];
}
export interface SessionSummary {
    messages: number;
    toolCalls: number;
    toolsUsed: string[];
    errors: string[];
    duration: number;
}
/**
 * Save a snapshot before a risky operation.
 * Maintains a rolling window of MAX_CHECKPOINTS entries.
 */
export declare function createCheckpoint(description: string, state: Checkpoint['state']): Checkpoint;
/** List all checkpoints in the current session */
export declare function getCheckpoints(): Checkpoint[];
/** Clear all checkpoints (e.g., on session reset) */
export declare function clearCheckpoints(): void;
/**
 * Analyze whether the current execution path has gone wrong.
 *
 * Detects regret signals when:
 *   - Error count is increasing (more errors than successes recently)
 *   - Circular tool usage (same tool called 3+ times consecutively)
 *   - Cost exceeding 2x the original estimate
 *   - Tests that previously passed are now failing
 */
export declare function detectRegret(currentState: {
    recentErrors: string[];
    recentToolCalls: string[];
    currentCost: number;
    estimatedCost: number;
    testsPassedBefore: string[];
    testsFailingNow: string[];
}, expectedOutcome: string): RegretSignal | null;
/**
 * Recommend which checkpoint to return to given a regret signal.
 * Returns a human-readable recommendation string.
 */
export declare function suggestBacktrack(regret: RegretSignal): string;
/**
 * Revert to a previous checkpoint.
 * Returns the checkpoint's state so the agent can resume from that point.
 * All checkpoints after the reverted one are removed.
 */
export declare function revertToCheckpoint(id: string): Checkpoint | null;
/** Save a new learned sequence */
export declare function learnSequence(trigger: string, followUp: string[]): void;
/**
 * Predict up to 3 likely next requests based on:
 *   - Common task sequences (fix bug -> run tests -> commit)
 *   - Current file context (editing auth.ts -> likely needs auth.test.ts)
 *   - Conversation momentum (research -> implement -> verify)
 */
export declare function anticipateNext(conversationHistory: string[], currentTask: string): Anticipation[];
/** Get the current anticipation cache */
export declare function getAnticipationCache(): Anticipation[];
/**
 * Pre-load context for an anticipated request.
 * Returns a list of file paths that should be read into context.
 * (The caller is responsible for actually reading them.)
 */
export declare function preloadForAnticipation(anticipation: Anticipation): string[];
/**
 * Record an actual user action so we can learn sequences.
 * Call this after each user message to update sequence knowledge.
 */
export declare function recordUserAction(previousAction: string, currentAction: string): void;
/** Load or create the agent identity from disk */
export declare function getIdentity(): AgentIdentity;
/**
 * Update identity after a session ends.
 * Adjusts tool preferences and statistics based on session activity.
 */
export declare function updateIdentity(session: SessionSummary): void;
/** Record a notable milestone */
export declare function addMilestone(event: string): void;
/** Generate a one-paragraph summary of the agent's evolved personality */
export declare function getPersonalitySummary(): string;
/**
 * Nudge a personality dimension based on user feedback.
 * Clamped to +/- PERSONALITY_DELTA per call, range [0, 1].
 */
export declare function adjustPersonality(dimension: keyof AgentIdentity['personality'], direction: 'increase' | 'decrease'): {
    dimension: string;
    oldValue: number;
    newValue: number;
};
export declare function registerTemporalTools(): void;
//# sourceMappingURL=temporal.d.ts.map