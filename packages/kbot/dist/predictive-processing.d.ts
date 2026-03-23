export interface Prediction {
    /** What we predict the user will ask or do next */
    predictedAction: string;
    /** Confidence in this prediction (0-1) */
    confidence: number;
    /** Context that should be pre-loaded if prediction holds */
    preloadContext: string[];
    /** Tools likely to be needed */
    likelyTools: string[];
    /** Timestamp */
    timestamp: number;
}
export interface PredictionError {
    /** The prediction that was made */
    prediction: Prediction;
    /** What actually happened */
    actual: string;
    /** Error magnitude (0-1, Jaccard distance) */
    magnitude: number;
    /** What we learned from this error */
    insight: string;
}
export interface PredictiveState {
    /** Current prediction accuracy (0-1, exponential moving average) */
    accuracy: number;
    /** Number of predictions made */
    totalPredictions: number;
    /** Number of correct predictions (error < 0.4) */
    correctPredictions: number;
    /** Most common prediction errors (what we keep getting wrong) */
    blindSpots: string[];
    /** Current precision weighting (how much to trust predictions vs. observations) */
    precisionWeight: number;
}
/**
 * Predictive Processing Engine — anticipates user intent and
 * pre-loads context, reducing latency and improving relevance.
 *
 * The engine maintains a generative model of user behavior and
 * continuously updates it based on prediction errors.
 */
export declare class PredictiveEngine {
    private predictions;
    private errors;
    private messageHistory;
    private toolHistory;
    private accuracy;
    private precisionWeight;
    private readonly learningRate;
    private readonly errorDecay;
    private readonly maxHistory;
    /**
     * Generate a prediction for what the user will do next.
     * Based on conversation patterns and tool usage history.
     */
    predict(recentMessages: string[], recentTools: string[]): Prediction;
    /**
     * Evaluate a prediction against what actually happened.
     * Updates the generative model based on prediction error.
     */
    evaluate(prediction: Prediction, actualMessage: string, actualTools: string[]): PredictionError;
    /**
     * Detect the current conversation pattern.
     */
    private detectPattern;
    /**
     * Predict likely tools from recent tool usage patterns.
     */
    private predictToolsFromHistory;
    /**
     * Get blind spots — things the engine consistently predicts wrong.
     */
    getBlindSpots(): string[];
    /** Get full predictive state */
    getState(): PredictiveState;
    /** Reset for new conversation */
    reset(): void;
}
//# sourceMappingURL=predictive-processing.d.ts.map