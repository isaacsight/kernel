/**
 * Harness Evolution Loop — type definitions.
 *
 * Maps onto the formalism from "The Last Harness You'll Ever Build"
 * (Seong, Yin, Zhang — Sylph.AI, arXiv:2604.21003):
 *
 *   Agent = Model + Harness
 *   Harness = prompts + tools + orchestration + hooks + model config
 *
 *   Inner loop:  Worker(τ)        → Evaluator(τ) → EvolutionAgent(history) → H'
 *   Outer loop:  HarnessEvolution × N tasks → MetaEvolutionAgent(history) → Λ'
 *
 * This module is types-only. Runtime lives in evolution-loop.ts and
 * meta-evolution.ts. No imports from heavy modules so it can be loaded by
 * tools, tests, and remote runners cheaply.
 */
export {};
//# sourceMappingURL=types.js.map