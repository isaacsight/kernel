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
import { gateToolResult } from '../../critic-gate.js';
/** Map RF taxonomy classes onto harness FailureMode kinds. */
function rfToFailureKind(rf) {
    switch (rf) {
        case 'RF-01-fabricated-evidence':
        case 'RF-10-simulation-role-confusion':
            return 'hallucinated-state';
        case 'RF-02-metric-interpretation':
        case 'RF-03-confused-provenance':
        case 'RF-04-temporal-misordering':
            return 'misinterpreted-state';
        case 'RF-12-repetition-failure-to-resume':
            return 'reasoning-loop';
        case 'RF-08-evidential-insufficiency':
        case 'RF-11-excessive-speculation':
            return 'missing-capability';
        case 'RF-16-arithmetic-error':
        case 'RF-14-invalid-inference-pattern':
        case 'RF-15-internal-contradiction':
            return 'incorrect-tool-usage';
        default:
            return 'other';
    }
}
function flattenTrace(trace) {
    const parts = [];
    for (const s of trace.steps) {
        if (s.action)
            parts.push(s.action);
        if (s.output)
            parts.push(s.output);
        if (s.error)
            parts.push(s.error);
    }
    try {
        parts.push(JSON.stringify(trace.finalState));
    }
    catch {
        /* ignore unserializable */
    }
    return parts.join('\n');
}
export class CriticEvaluator {
    opts;
    constructor(opts = {}) {
        this.opts = opts;
    }
    async evaluate(trace, task) {
        const haystack = flattenTrace(trace).toLowerCase();
        const criteriaResults = task.acceptance.map((criterion) => {
            const passed = haystack.includes(criterion.toLowerCase());
            return {
                criterion,
                passed,
                evidence: passed ? 'substring match in trace' : 'no match in flattened trace',
            };
        });
        const criteriaPassRate = criteriaResults.length === 0
            ? 1
            : criteriaResults.filter((c) => c.passed).length / criteriaResults.length;
        // Run critic on each tool step. Missing tools / responses are skipped.
        const toolSteps = trace.steps.filter((s) => s.phase === 'tool');
        const failureModes = [];
        let toolAccepts = 0;
        for (const step of toolSteps) {
            const verdict = this.opts.gateFn
                ? await this.opts.gateFn(step.action, {}, step.output ?? step.error ?? '')
                : await gateToolResult(step.action, {}, step.output ?? step.error ?? '', this.opts.gate);
            if (verdict.accept) {
                toolAccepts++;
            }
            else if (verdict.failure_class) {
                failureModes.push({
                    kind: rfToFailureKind(verdict.failure_class),
                    detail: `${verdict.failure_class}: ${verdict.reason || 'critic rejected'}`,
                });
            }
            else {
                failureModes.push({
                    kind: 'other',
                    detail: verdict.reason || 'critic rejected without failure class',
                });
            }
        }
        const toolAcceptRate = toolSteps.length === 0 ? 1 : toolAccepts / toolSteps.length;
        const baseScore = criteriaPassRate * 0.7 + toolAcceptRate * 0.3;
        // Efficiency tiebreaker: small bonus inversely proportional to time.
        const totalMs = trace.llmTimeMs + trace.toolTimeMs;
        const efficiency = totalMs > 0 ? Math.min(0.05, 1000 / (totalMs + 1000) * 0.05) : 0.05;
        const score = Math.max(0, Math.min(1, baseScore + efficiency));
        const allCriteriaPass = criteriaResults.every((c) => c.passed);
        const noToolRejections = failureModes.length === 0;
        const pass = allCriteriaPass && noToolRejections;
        return {
            taskId: task.id,
            harnessId: trace.harnessId,
            pass,
            score,
            criteriaResults,
            failureModes,
            notes: pass
                ? 'all criteria passed; critic accepted every tool step'
                : `pass=${pass} criteria=${criteriaPassRate.toFixed(2)} tools=${toolAcceptRate.toFixed(2)}`,
        };
    }
}
export function createCriticEvaluator(opts = {}) {
    return new CriticEvaluator(opts);
}
//# sourceMappingURL=critic-evaluator.js.map