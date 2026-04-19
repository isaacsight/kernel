/**
 * Hierarchical Planner — Type Definitions
 *
 * Four tiers, increasing temporal resolution:
 *   Tier 1  SessionGoal     days → weeks     (Opus, rarely re-planned)
 *   Tier 2  Phase           hours            (Opus, on scope shift)
 *   Tier 3  Action          minutes          (Sonnet, per user turn)
 *   Tier 4  ToolCallSpec    seconds          (Haiku, per tool call)
 *
 * Inspired by Suno's 3-stage transformer (semantic → coarse acoustic → fine
 * acoustic). Coarse intent is stable; fine actuation is cheap and rewritten.
 *
 * See DESIGN.md in this directory for the full rationale, cost model,
 * decision logic, and integration plan. This file is types-only — no imports
 * from heavy runtime modules, no implementation.
 */
export {};
//# sourceMappingURL=types.js.map