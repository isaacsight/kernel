/**
 * kbot v5 futures — experimental architectural skeleton.
 *
 * Six modules drawn from frontier research published in late April 2026.
 * Each is opt-in, additive, and reversible. None of them changes default
 * agent behavior unless explicitly invoked.
 *
 * Plan: packages/kbot/V5_FUTURES_PLAN.md
 */
// Harness Evolution Loop — Sylph.AI 2604.21003
export * as harness from './harness/index.js';
// Skill Graph — Tencent Hunyuan 2604.25727
export * as skillGraph from './skill-graph/index.js';
// Latent State Envelope — Recursive MAS 2604.25917
export * as latentState from './latent-state/index.js';
// Forecast — predictions module
export * as forecast from './forecast/index.js';
// Persona — privilege scoping (Cequence)
export * as persona from './persona/index.js';
// Debate — BARRED-style asymmetric debate runner
export * as debate from './debate/index.js';
//# sourceMappingURL=index.js.map