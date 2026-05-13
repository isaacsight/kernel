/**
 * Outcomes — rubric-graded self-evaluation with auto-iteration.
 *
 * Adopted from Claude Managed Agents' `define_outcome` pattern. A
 * separate evaluator (running in its own context, typically with a
 * different model or at least a different prompt) judges the agent's
 * work product against per-criterion rubric. If unsatisfied, the
 * agent revises; the loop runs until satisfied or max_iterations.
 *
 * agent-os generalizes CMA's pattern in three ways:
 *  - the evaluator is pluggable (LLM-based, rules-based, hybrid)
 *  - the rubric supports weighted criteria
 *  - each iteration's evaluation is content-addressable so the loop
 *    is replayable in an audit-grade environment
 */
export interface RubricCriterion {
    /** Stable identifier — used in audit logs. */
    readonly name: string;
    /** Plain-language description the evaluator scores against. */
    readonly description: string;
    /** Optional weight. Defaults to 1.0. */
    readonly weight?: number;
}
export interface Rubric {
    readonly criteria: ReadonlyArray<RubricCriterion>;
    /** Weighted-average score threshold for `satisfied` verdict (0.0–1.0).
     *  Defaults to 0.85. */
    readonly satisfied_at?: number;
}
export interface CriterionScore {
    readonly name: string;
    /** 0.0–1.0. Higher is better. */
    readonly score: number;
    /** Plain-language feedback explaining the score; used by the agent
     *  to revise on the next iteration. */
    readonly feedback: string;
}
export interface RubricEvaluation {
    readonly per_criterion: ReadonlyArray<CriterionScore>;
    /** Weighted average across criteria. */
    readonly overall_score: number;
    readonly verdict: 'satisfied' | 'needs_revision' | 'failed';
    /** Optional structured feedback the agent should consume on the next
     *  iteration. The evaluator may synthesize this from per-criterion
     *  feedback. */
    readonly revision_guidance?: string;
}
export interface RubricEvaluator {
    evaluate(work_product: string, rubric: Rubric, iteration: number): Promise<RubricEvaluation>;
}
export type OutcomeResultCode = 'satisfied' | 'needs_revision' | 'max_iterations_reached' | 'failed' | 'interrupted';
export interface OutcomeIteration<T> {
    readonly iteration: number;
    readonly work: T;
    readonly work_serialized: string;
    readonly evaluation: RubricEvaluation;
    readonly at: string;
}
export interface OutcomeResult<T> {
    readonly code: OutcomeResultCode;
    readonly iterations_used: number;
    readonly final_work: T | null;
    readonly final_evaluation: RubricEvaluation | null;
    readonly history: ReadonlyArray<OutcomeIteration<T>>;
}
export interface WithOutcomeOptions<T> {
    readonly max_iterations: number;
    /** Serialize the agent's work product to a string the evaluator can
     *  judge. Defaults to JSON.stringify. */
    readonly serialize?: (work: T) => string;
    /** Abort signal — interrupting mid-iteration returns the
     *  `interrupted` result code with the history so far. */
    readonly signal?: AbortSignal;
}
/**
 * Run an attempt → evaluate → revise loop against a rubric.
 *
 * `attempt(feedback)` is called once per iteration. On the first call,
 * `feedback` is `null`; on subsequent calls it's the evaluator's
 * revision_guidance (or a synthesized summary of per-criterion feedback
 * if no guidance was provided).
 *
 * The loop terminates on:
 *   - `satisfied`           verdict from the evaluator
 *   - `failed`              verdict from the evaluator (non-recoverable)
 *   - max_iterations reached
 *   - signal.aborted        (interrupted)
 *   - attempt() or evaluate() throwing — caught and reported as `failed`
 */
export declare function withOutcome<T>(rubric: Rubric, attempt: (feedback: string | null, iteration: number) => Promise<T>, evaluator: RubricEvaluator, options: WithOutcomeOptions<T>): Promise<OutcomeResult<T>>;
/** Helper: weighted-average score. Useful for evaluator implementations. */
export declare function weightedAverage(scores: ReadonlyArray<CriterionScore>, rubric: Rubric): number;
/** Helper: classify a score into a verdict against the rubric's threshold. */
export declare function classify(score: number, rubric: Rubric): 'satisfied' | 'needs_revision';
/** A trivial evaluator useful for tests — accepts the work product as
 *  satisfying if it matches a predicate. Production code uses an LLM
 *  evaluator running in a separate context. */
export declare function predicateEvaluator(predicate: (work: string) => boolean, rubric: Rubric, feedback_when_failing: string): RubricEvaluator;
//# sourceMappingURL=outcomes.d.ts.map