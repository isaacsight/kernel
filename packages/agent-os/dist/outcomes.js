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
export async function withOutcome(rubric, attempt, evaluator, options) {
    const serialize = options.serialize ?? ((t) => JSON.stringify(t));
    const max = Math.max(1, Math.floor(options.max_iterations));
    const history = [];
    let feedback = null;
    let lastWork = null;
    let lastEval = null;
    for (let i = 1; i <= max; i++) {
        if (options.signal?.aborted) {
            return {
                code: 'interrupted',
                iterations_used: i - 1,
                final_work: lastWork,
                final_evaluation: lastEval,
                history,
            };
        }
        let work;
        try {
            work = await attempt(feedback, i);
        }
        catch (e) {
            return {
                code: 'failed',
                iterations_used: i - 1,
                final_work: lastWork,
                final_evaluation: lastEval,
                history,
            };
        }
        const serialized = serialize(work);
        let evaluation;
        try {
            evaluation = await evaluator.evaluate(serialized, rubric, i);
        }
        catch (e) {
            return {
                code: 'failed',
                iterations_used: i,
                final_work: work,
                final_evaluation: lastEval,
                history,
            };
        }
        const iter = {
            iteration: i,
            work,
            work_serialized: serialized,
            evaluation,
            at: new Date().toISOString(),
        };
        history.push(iter);
        lastWork = work;
        lastEval = evaluation;
        if (evaluation.verdict === 'satisfied') {
            return {
                code: 'satisfied',
                iterations_used: i,
                final_work: work,
                final_evaluation: evaluation,
                history,
            };
        }
        if (evaluation.verdict === 'failed') {
            return {
                code: 'failed',
                iterations_used: i,
                final_work: work,
                final_evaluation: evaluation,
                history,
            };
        }
        feedback =
            evaluation.revision_guidance ?? synthesizeFeedback(evaluation.per_criterion);
    }
    return {
        code: 'max_iterations_reached',
        iterations_used: max,
        final_work: lastWork,
        final_evaluation: lastEval,
        history,
    };
}
/** Default feedback synthesizer — joins per-criterion feedback into a
 *  single message the agent can act on. */
function synthesizeFeedback(scores) {
    const weakest = [...scores].sort((a, b) => a.score - b.score).slice(0, 3);
    if (weakest.length === 0)
        return '';
    return weakest
        .map((s) => `[${s.name} score=${s.score.toFixed(2)}] ${s.feedback}`)
        .join('\n');
}
/** Helper: weighted-average score. Useful for evaluator implementations. */
export function weightedAverage(scores, rubric) {
    if (scores.length === 0)
        return 0;
    const lookup = new Map(rubric.criteria.map((c) => [c.name, c.weight ?? 1.0]));
    let weighted_sum = 0;
    let total_weight = 0;
    for (const s of scores) {
        const w = lookup.get(s.name) ?? 1.0;
        weighted_sum += s.score * w;
        total_weight += w;
    }
    return total_weight > 0 ? weighted_sum / total_weight : 0;
}
/** Helper: classify a score into a verdict against the rubric's threshold. */
export function classify(score, rubric) {
    const threshold = rubric.satisfied_at ?? 0.85;
    return score >= threshold ? 'satisfied' : 'needs_revision';
}
/** A trivial evaluator useful for tests — accepts the work product as
 *  satisfying if it matches a predicate. Production code uses an LLM
 *  evaluator running in a separate context. */
export function predicateEvaluator(predicate, rubric, feedback_when_failing) {
    return {
        async evaluate(work) {
            const passing = predicate(work);
            const per_criterion = rubric.criteria.map((c) => ({
                name: c.name,
                score: passing ? 1.0 : 0.0,
                feedback: passing ? 'meets criterion' : feedback_when_failing,
            }));
            const overall_score = weightedAverage(per_criterion, rubric);
            return {
                per_criterion,
                overall_score,
                verdict: passing ? 'satisfied' : 'needs_revision',
                revision_guidance: passing ? undefined : feedback_when_failing,
            };
        },
    };
}
//# sourceMappingURL=outcomes.js.map