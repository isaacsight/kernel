/**
 * Harness Meta-Evolution — outer loop (Algorithm 2 from Sylph).
 *
 * The inner loop optimizes one harness against one task. The outer loop
 * runs the inner loop across a portfolio of tasks, aggregating per-task
 * results and selecting the best protocol overall. Currently the
 * "selection" step is averaging — when a real MetaEvolutionAgent ships,
 * it'll consume the perTask EvolutionResult[] and propose protocol
 * mutations.
 *
 * Pure orchestration. Tasks are run sequentially to keep the trace
 * ordering deterministic; parallelism is a future concern.
 */
import type { EvolutionProtocol, EvolutionResult, MetaResult, Task } from './types.js';
import { type RunOptions } from './evolution-loop.js';
export interface MetaOptions extends RunOptions {
    /** Called after each task's inner loop completes. */
    onTaskComplete?: (result: EvolutionResult) => void | Promise<void>;
    /**
     * When `true`, abort the outer loop on the first task whose best score
     * is below `failBelow`. Default false — always run the full portfolio.
     */
    abortOnFailure?: boolean;
    failBelow?: number;
}
/**
 * Run the inner Evolution Loop across a portfolio of tasks, returning
 * the best protocol (currently always the input protocol — there is no
 * MetaEvolutionAgent yet) plus per-task results and the aggregate score.
 */
export declare function runMetaEvolution(protocol: EvolutionProtocol, tasks: Task[], options?: MetaOptions): Promise<MetaResult>;
//# sourceMappingURL=meta-evolution.d.ts.map