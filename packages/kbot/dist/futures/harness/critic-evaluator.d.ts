/**
 * CriticEvaluator — adapts `critic-gate.ts` to the harness `Evaluator`
 * interface from `types.ts`.
 *
 * critic-gate.ts gates a single tool result. The harness Evaluator grades
 * an entire trace against a Task's acceptance criteria. This adapter
 * walks the trace's tool steps, runs each through `gateToolResult`, and
 * aggregates the per-step verdicts into a single EvaluationReport:
 *
 *   - `pass`    = every acceptance criterion satisfied AND no critic rejected
 *                 a tool step
 *   - `score`   = (criteriaPassRate * 0.7) + (toolAcceptRate * 0.3),
 *                 efficiency-tiebroken by total step time
 *   - failureModes derived from critic verdicts' `failure_class` (RF-NN-*)
 *
 * Acceptance criteria are matched via case-insensitive substring against
 * the trace's flattened `output | error | finalState | action` text.
 * That keeps the adapter dependency-free; richer matchers can subclass.
 *
 * critic-gate.ts is NOT modified — this is a pure consumer.
 */
import type { EvaluationReport, Evaluator, ExecutionTrace, Task } from './types.js';
import type { CriticVerdict, GateOpts } from '../../critic-gate.js';
export interface CriticEvaluatorOpts {
    /** Forwarded to `gateToolResult` — strictness, provider, llmClient stub. */
    gate?: GateOpts;
    /**
     * If set, replaces `gateToolResult`. Lets tests inject a fully synchronous
     * decision function and skip the critic-gate provider plumbing entirely.
     */
    gateFn?: (tool: string, args: Record<string, unknown>, result: unknown) => Promise<CriticVerdict> | CriticVerdict;
}
export declare class CriticEvaluator implements Evaluator {
    private readonly opts;
    constructor(opts?: CriticEvaluatorOpts);
    evaluate(trace: ExecutionTrace, task: Task): Promise<EvaluationReport>;
}
export declare function createCriticEvaluator(opts?: CriticEvaluatorOpts): Evaluator;
//# sourceMappingURL=critic-evaluator.d.ts.map