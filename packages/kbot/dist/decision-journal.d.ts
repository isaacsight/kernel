export type DecisionType = 'agent-routing' | 'model-selection' | 'tool-choice' | 'fallback-trigger' | 'cost-routing' | 'security-block' | 'learning-extraction' | 'pattern-match' | 'confidence-override';
export interface Decision {
    /** When the decision was made */
    timestamp: string;
    /** What type of decision */
    type: DecisionType;
    /** What was decided */
    decision: string;
    /** Why — the reasoning chain */
    reasoning: string[];
    /** What alternatives were considered */
    alternatives: string[];
    /** Confidence in the decision (0-1) */
    confidence: number;
    /** What data informed this decision */
    evidence: Record<string, unknown>;
    /** What the user's message was (truncated) */
    userContext: string;
    /** Outcome — filled in after execution */
    outcome?: 'success' | 'failure' | 'partial' | 'unknown';
}
/** Log a decision. Call this from agent routing, model selection, tool pipeline, etc. */
export declare function logDecision(decision: Omit<Decision, 'timestamp'>): void;
/** Quick helper for agent routing decisions */
export declare function logAgentRouting(opts: {
    chosenAgent: string;
    confidence: number;
    method: string;
    alternatives: string[];
    userMessage: string;
}): void;
/** Quick helper for model selection decisions */
export declare function logModelSelection(opts: {
    chosenModel: string;
    chosenProvider: string;
    reason: string;
    cost: string;
    alternatives: string[];
    userMessage: string;
}): void;
/** Quick helper for fallback triggers */
export declare function logFallback(opts: {
    from: string;
    to: string;
    reason: string;
    error?: string;
}): void;
/** Quick helper for security blocks */
export declare function logSecurityBlock(opts: {
    action: string;
    reason: string;
    severity: string;
    userMessage: string;
}): void;
/** Get today's decisions */
export declare function getTodaysDecisions(): Decision[];
/** Get decisions for a specific date */
export declare function getDecisions(date: string): Decision[];
/** Get decisions by type */
export declare function getDecisionsByType(type: DecisionType, limit?: number): Decision[];
/** Get decision stats */
export declare function getDecisionStats(): {
    total: number;
    today: number;
    byType: Record<string, number>;
    avgConfidence: number;
    securityBlocks: number;
    fallbacks: number;
};
/** Format decisions for display */
export declare function formatDecisions(decisions: Decision[]): string;
//# sourceMappingURL=decision-journal.d.ts.map