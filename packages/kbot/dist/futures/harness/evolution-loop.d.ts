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
import type { EvolutionProtocol, EvolutionRecord, EvolutionResult, Task } from './types.js';
/** Optional hooks the caller can plug in to observe / persist each step. */
export interface RunOptions {
    /** Called after each record is appended to in-memory history. */
    onRecord?: (record: EvolutionRecord) => void | Promise<void>;
    /** When set, `appendTrace` is invoked under this state dir for every record. */
    persistDir?: string;
    /** When false, skip filesystem persistence even if `persistDir` is set. Default true. */
    persist?: boolean;
    /**
     * How many consecutive iterations must hit `earlyStopScore` to stop.
     * Defaults to 1 — first hit ends the loop.
     */
    earlyStopStreak?: number;
}
/**
 * Run the inner Harness Evolution Loop against a single task.
 *
 * Always returns an `EvolutionResult` — never throws on Worker / Evaluator
 * exceptions; instead, records a failure step and continues. (The
 * Evaluator is supposed to score failures, not the loop itself.)
 */
export declare function runEvolutionLoop(protocol: EvolutionProtocol, task: Task, options?: RunOptions): Promise<EvolutionResult>;
//# sourceMappingURL=evolution-loop.d.ts.map