/**
 * Public surface for the debate module.
 */
export type { DebateInput, AsymmetricRoles, DebateRound, Verdict, LLMClient, DebateOpts, TrainingExample, } from './types.js';
export { runDebate, formatPrompt, parseVerdict } from './runner.js';
export { synthesizeTrainingData, writeJsonl, loadJsonl, defaultJsonlPath, } from './synthesis.js';
//# sourceMappingURL=index.d.ts.map