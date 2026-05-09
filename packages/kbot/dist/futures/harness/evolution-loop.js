/**
 * Harness Evolution Loop — inner loop (Algorithm 1 from Sylph).
 *
 *   for i in 1..maxIterations:
 *     trace   = Worker.execute(task, harness)
 *     report  = Evaluator.evaluate(trace, task)
 *     record  = { iteration, harness, trace, report, verdict }
 *     history.push(record)
 *     if report.score > bestScore: best = harness
 *     if earlyStopScore reached on consecutive iterations: stop
 *     if regression > revertThreshold: revert harness to best
 *     harness = EvolutionAgent.evolve(history, best)
 *
 * Pure orchestration — Worker / Evaluator / EvolutionAgent are injected,
 * which makes the whole loop deterministic and testable with stub
 * implementations. No LLM calls happen here directly.
 */
import { appendTrace } from './persistence.js';
function compareVerdict(prev, current, revertThreshold) {
    if (current > prev)
        return 'improved';
    if (current === prev)
        return 'no-op';
    if (revertThreshold !== undefined && (prev - current) >= revertThreshold) {
        // A "regressed" verdict signals the loop should revert to best harness.
        return 'regressed';
    }
    return 'regressed';
}
/**
 * Run the inner Harness Evolution Loop against a single task.
 *
 * Always returns an `EvolutionResult` — never throws on Worker / Evaluator
 * exceptions; instead, records a failure step and continues. (The
 * Evaluator is supposed to score failures, not the loop itself.)
 */
export async function runEvolutionLoop(protocol, task, options = {}) {
    const { worker, evaluator, evolution, initialHarness, hyperparams } = protocol;
    const maxIterations = Math.max(1, hyperparams.maxIterations | 0);
    const earlyStopScore = hyperparams.earlyStopScore;
    const revertThreshold = hyperparams.revertThreshold;
    const earlyStopStreak = Math.max(1, options.earlyStopStreak ?? 1);
    const shouldPersist = options.persist !== false && !!options.persistDir;
    const history = [];
    let harness = initialHarness;
    let bestHarness = initialHarness;
    let bestScore = -Infinity;
    let prevScore = -Infinity;
    let earlyHits = 0;
    for (let iteration = 1; iteration <= maxIterations; iteration++) {
        let trace;
        try {
            trace = await worker.execute(task, harness);
        }
        catch (err) {
            // Synthesize a minimal failure trace so the evaluator can still grade.
            trace = {
                taskId: task.id,
                harnessId: harness.id,
                steps: [
                    {
                        index: 0,
                        phase: 'observe',
                        action: 'worker-error',
                        error: err instanceof Error ? err.message : String(err),
                        durationMs: 0,
                    },
                ],
                finalState: {},
                llmTimeMs: 0,
                toolTimeMs: 0,
            };
        }
        let report;
        try {
            report = await evaluator.evaluate(trace, task);
        }
        catch (err) {
            report = {
                taskId: task.id,
                harnessId: harness.id,
                pass: false,
                score: 0,
                criteriaResults: task.acceptance.map((c) => ({
                    criterion: c,
                    passed: false,
                    evidence: 'evaluator-error',
                })),
                failureModes: [
                    {
                        kind: 'other',
                        detail: err instanceof Error ? err.message : String(err),
                    },
                ],
                notes: 'evaluator threw; auto-fail',
            };
        }
        const verdict = compareVerdict(prevScore, report.score, revertThreshold);
        const record = {
            iteration,
            harness,
            trace,
            report,
            verdict,
        };
        history.push(record);
        if (options.onRecord) {
            await options.onRecord(record);
        }
        if (shouldPersist) {
            try {
                await appendTrace(task.id, record, options.persistDir);
            }
            catch {
                // persistence is best-effort; never block evolution on disk failure
            }
        }
        // Track best harness.
        if (report.score > bestScore) {
            bestScore = report.score;
            bestHarness = harness;
        }
        // Early-stop check.
        if (earlyStopScore !== undefined && report.score >= earlyStopScore) {
            earlyHits++;
            if (earlyHits >= earlyStopStreak) {
                break;
            }
        }
        else {
            earlyHits = 0;
        }
        // Revert on regression past threshold.
        if (revertThreshold !== undefined &&
            bestScore - report.score >= revertThreshold) {
            harness = bestHarness;
        }
        prevScore = report.score;
        // Short-circuit before the final evolve call — no point mutating on the
        // last iteration since we'll never execute the new harness.
        if (iteration === maxIterations)
            break;
        try {
            harness = await evolution.evolve(history, bestHarness);
        }
        catch {
            // EvolutionAgent failed — keep current harness, keep going.
            harness = bestHarness;
        }
    }
    // If nothing ran (shouldn't happen with maxIterations >= 1) make sure
    // bestHarness is still defined.
    if (history.length === 0) {
        return {
            taskId: task.id,
            bestHarness: initialHarness,
            bestScore: 0,
            history,
        };
    }
    return {
        taskId: task.id,
        bestHarness,
        bestScore: bestScore === -Infinity ? 0 : bestScore,
        history,
    };
}
//# sourceMappingURL=evolution-loop.js.map