export interface Hypothesis {
    id: string;
    explanation: string;
    evidence: string[];
    contradictions: string[];
    likelihood: number;
    testable: boolean;
    testAction: string;
}
export interface AbductiveResult {
    observation: string;
    hypotheses: Hypothesis[];
    recommended: string;
}
/**
 * Generate ranked hypotheses for an observed error or unexpected behavior.
 * Uses heuristic pattern matching against pre-built cause maps.
 */
export declare function generateHypotheses(observation: string, context: string): AbductiveResult;
/**
 * Update hypothesis likelihoods after testing one.
 * If the test confirmed the hypothesis, boost it and reduce others.
 * If the test contradicted it, reduce it and boost alternatives.
 */
export declare function testHypothesis(id: string, result: string): void;
/**
 * Eliminate a hypothesis with a reason. Sets its likelihood to near-zero.
 */
export declare function eliminateHypothesis(id: string, reason: string): void;
/**
 * Get the current best explanation after testing.
 */
export declare function getBestExplanation(): Hypothesis | null;
export interface Counterfactual {
    id: string;
    scenario: string;
    currentPath: string;
    alternativePath: string;
    tradeoffs: {
        benefits: string[];
        risks: string[];
        effort: 'less' | 'same' | 'more';
    };
    recommendation: 'switch' | 'stay' | 'defer';
    reasoning: string;
}
/**
 * Analyze an alternative approach without executing it.
 * Compares risk, effort, and reversibility of current vs alternative.
 */
export declare function exploreCounterfactual(currentApproach: string, alternative: string, context: string): Counterfactual;
/**
 * Compare multiple alternative approaches.
 */
export declare function compareApproaches(approaches: string[]): Counterfactual[];
/**
 * Given current progress and obstacles, determine if we should pivot to a different approach.
 */
export declare function shouldPivot(currentProgress: string, obstacles: string[]): {
    pivot: boolean;
    to?: string;
    reason: string;
};
export interface PlanningStrategy {
    name: string;
    description: string;
    when: string;
    steps: string[];
}
export interface MetaPlanResult {
    chosenStrategy: string;
    reasoning: string;
    adaptations: string[];
    fallbackStrategy: string;
}
/**
 * Choose the best planning strategy for a task.
 */
export declare function selectStrategy(task: string, context: string): MetaPlanResult;
/**
 * Evaluate whether the current planning strategy is working.
 */
export declare function evaluateStrategy(strategy: string, progress: string): {
    working: boolean;
    suggestion?: string;
};
/**
 * Adapt the current strategy when encountering a problem.
 */
export declare function adaptStrategy(currentStrategy: string, problem: string): MetaPlanResult;
/**
 * Record which strategy worked for a task type for future reference.
 */
export declare function recordStrategyOutcome(taskType: string, strategy: string, outcome: 'success' | 'failure' | 'partial'): void;
/**
 * Get the historically best strategy for a given task type.
 */
export declare function getHistoricalBestStrategy(taskType: string): string | null;
export declare function registerReasoningTools(): void;
//# sourceMappingURL=reasoning.d.ts.map