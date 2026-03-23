export interface EvalResult {
    /** 0-1: does the response contradict or fabricate beyond the context? */
    faithfulness: number;
    /** 0-1: does the response address the user's question? */
    relevancy: number;
    /** 0-1: weighted average (faithfulness 0.4, relevancy 0.6) */
    overall: number;
    /** true if overall < 0.4 — response should be regenerated */
    shouldRetry: boolean;
    /** Actionable feedback for retry (only present when shouldRetry is true) */
    feedback?: string;
}
/** Function signature for an LLM call used by the evaluator */
export type EvalCallFn = (prompt: string) => Promise<string>;
/** Enable or disable the self-evaluation loop */
export declare function setSelfEvalEnabled(enabled: boolean): void;
/** Check if self-evaluation is currently enabled */
export declare function isSelfEvalEnabled(): boolean;
/**
 * Evaluate a response for faithfulness and relevancy.
 *
 * Uses the configured provider's fast model by default.
 * Pass a custom `callFn` to use a different model or endpoint.
 */
export declare function evaluateResponse(query: string, response: string, context?: string, callFn?: EvalCallFn): Promise<EvalResult>;
/**
 * Generate-evaluate-retry loop.
 *
 * Calls `generateFn` to produce a response, evaluates it, and retries
 * (with feedback injected) if the score is below threshold.
 *
 * @param generateFn - Async function that produces a response string.
 *   On retry, receives the previous feedback as its first argument.
 * @param query - The user's original question (for evaluation context).
 * @param context - Optional grounding context (documents, tool output, etc.).
 * @param maxRetries - Maximum retry attempts (default 2).
 * @param callFn - Optional custom LLM call function for evaluation.
 * @returns The final response, its eval scores, and how many retries were used.
 */
export declare function withSelfEval(generateFn: (feedback?: string) => Promise<string>, query: string, context?: string, maxRetries?: number, callFn?: EvalCallFn): Promise<{
    response: string;
    eval: EvalResult;
    retries: number;
}>;
//# sourceMappingURL=self-eval.d.ts.map