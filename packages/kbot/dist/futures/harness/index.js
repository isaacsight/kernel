/**
 * Harness Evolution Loop — public surface.
 *
 * See `./README.md` for the high-level overview and `./types.ts` for the
 * contract every other file in this directory targets.
 */
export * from './types.js';
export { runEvolutionLoop } from './evolution-loop.js';
export { runMetaEvolution } from './meta-evolution.js';
export { CriticEvaluator, createCriticEvaluator, } from './critic-evaluator.js';
export { NoopEvolutionAgent, createNoopEvolutionAgent, } from './noop-evolution.js';
export { appendTrace, readHistory, pruneOlderThan, defaultStateDir, } from './persistence.js';
//# sourceMappingURL=index.js.map