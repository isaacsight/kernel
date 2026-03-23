export interface BeliefState {
    /** What the agent expects the user wants */
    predictedIntent: string;
    /** Confidence in the prediction (0-1) */
    confidence: number;
    /** Expected tool outcomes */
    expectedOutcomes: Map<string, number>;
    /** Entropy of the belief distribution (bits) */
    entropy: number;
}
export interface Surprise {
    /** How surprising the observation was (bits) */
    informationContent: number;
    /** Which prediction was violated */
    violatedExpectation: string | null;
    /** Magnitude of prediction error (0-1) */
    predictionError: number;
}
export interface FreeEnergyState {
    /** Current variational free energy (lower = better model) */
    freeEnergy: number;
    /** Accumulated surprise across the session */
    totalSurprise: number;
    /** Number of belief updates (perceptual inference) */
    beliefUpdates: number;
    /** Number of actions taken (active inference) */
    actionsTaken: number;
    /** Running average prediction error */
    avgPredictionError: number;
    /** Recommended policy: explore (reduce uncertainty) or exploit (act on beliefs) */
    policy: 'explore' | 'exploit' | 'balanced';
}
export type InferenceMode = 'perceptual' | 'active';
/**
 * Active Inference Engine — minimizes free energy by balancing
 * belief updates (learning) with actions (tool use).
 *
 * When prediction errors are high → explore (research, read, search)
 * When prediction errors are low → exploit (write, execute, commit)
 */
export declare class ActiveInferenceEngine {
    private beliefs;
    private surpriseHistory;
    private toolOutcomeHistory;
    private beliefUpdates;
    private actionsTaken;
    private readonly explorationThreshold;
    private readonly exploitationThreshold;
    private readonly learningRate;
    private readonly decayRate;
    constructor();
    /**
     * Observe a user message and compute surprise.
     * High surprise = our model of the user is wrong → update beliefs.
     */
    observeMessage(message: string, previousPrediction?: string): Surprise;
    /**
     * Observe a tool execution result and update expected outcomes.
     */
    observeToolResult(toolName: string, success: boolean, relevance: number): void;
    /**
     * Compute current variational free energy.
     * F = E[log q(s) - log p(o,s)] ≈ prediction_error + entropy
     *
     * Lower free energy = better internal model.
     */
    computeFreeEnergy(): number;
    /**
     * Decide inference mode: should the agent explore or exploit?
     *
     * High free energy → explore (search, read, research — reduce uncertainty)
     * Low free energy → exploit (write, execute, commit — act on beliefs)
     */
    recommendPolicy(): 'explore' | 'exploit' | 'balanced';
    /**
     * Get tools recommended for the current policy.
     * Explore → information-gathering tools
     * Exploit → action-taking tools
     */
    recommendToolBias(): {
        preferred: string[];
        discouraged: string[];
    };
    /**
     * Update the predicted intent (what the agent thinks the user wants next).
     */
    updatePrediction(intent: string): void;
    /** Get running average prediction error */
    getAveragePredictionError(): number;
    /** Get the full free energy state for diagnostics */
    getState(): FreeEnergyState;
    /** Reset for new conversation */
    reset(): void;
}
//# sourceMappingURL=free-energy.d.ts.map