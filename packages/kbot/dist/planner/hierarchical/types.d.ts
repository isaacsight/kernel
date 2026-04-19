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
import type { PlanStep } from '../../planner.js';
/** Long-lived user objective that spans many turns and possibly many sessions. */
export interface SessionGoal {
    /** Stable identifier (uuid). Persists across sessions. */
    id: string;
    /** Short title: "ship hierarchical planner v1". */
    title: string;
    /** 1–3 sentence rationale: what success looks like. */
    intent: string;
    /** Acceptance criteria — bullet list the user would agree closes the goal. */
    acceptance: string[];
    /** ISO timestamps. */
    createdAt: string;
    updatedAt: string;
    /** Lifecycle. `paused` goals stay on disk but don't get re-planned. */
    status: 'active' | 'paused' | 'completed' | 'abandoned';
    /** Free-form tags: repo name, domain, user-supplied label. */
    tags?: string[];
}
/** Coarse mode the agent is currently operating in. */
export type PhaseKind = 'explore' | 'build' | 'debug' | 'review' | 'write' | 'refactor' | 'deploy' | 'other';
/** A contiguous stretch of work under one mode, toward one milestone. */
export interface Phase {
    id: string;
    /** Parent goal. */
    goalId: string;
    kind: PhaseKind;
    /** What this phase commits to producing. */
    objective: string;
    /** Exit criteria — when `kind` should flip or phase should close. */
    exitCriteria: string[];
    /** Files or subsystems scoped in. */
    scope?: string[];
    /** ISO timestamps. */
    startedAt: string;
    endedAt?: string;
    status: 'active' | 'done' | 'aborted';
}
/**
 * One action = one user turn's plan. Steps are the existing `PlanStep`s so we
 * stay compatible with `planner.ts#executePlan`.
 */
export interface ActionStep extends PlanStep {
}
export interface Action {
    id: string;
    phaseId: string;
    /** Verbatim user turn that triggered this action. */
    userTurn: string;
    /** One-sentence plan. */
    summary: string;
    /** Ordered steps; each step is a PlanStep-compatible record. */
    steps: ActionStep[];
    /** Agents this action expects to consult (from learned-router). */
    expectedAgents?: string[];
    createdAt: string;
    status: 'pending' | 'running' | 'done' | 'failed';
}
/** Coarse hazard class used to gate permissions and verdict logic. */
export type SideEffectClass = 'pure' | 'read' | 'write' | 'exec' | 'network' | 'destructive' | 'external';
/** The final low-level tool call. Haiku fills this in. */
export interface ToolCallSpec {
    id: string;
    actionId: string;
    stepId: number;
    tool: string;
    args: Record<string, unknown>;
    sideEffect: SideEffectClass;
    /** Optional prediction of what the tool should return on success. */
    expectedOutcome?: string;
    /** Hard ceiling in ms; falls back to pipeline default when absent. */
    timeoutMs?: number;
}
export type VerdictDecision = 'continue' | 'revise-action' | 'revise-phase' | 'revise-goal' | 'abort';
/** Emitted after every tool call; consumed by the up-delegation ladder. */
export interface TierVerdict {
    decision: VerdictDecision;
    tier: 'tool' | 'action' | 'phase' | 'goal';
    reason: string;
    /** Evidence: tool error, failed assertion, diff summary. */
    evidence?: string;
}
export interface TurnMetrics {
    tier1Calls: number;
    tier2Calls: number;
    tier3Calls: number;
    tier4Calls: number;
    tokensIn: number;
    tokensOut: number;
    wallMs: number;
}
/** Top-level return of `HierarchicalPlanner.planTurn`. */
export interface PlannerResult {
    goal: SessionGoal;
    phase: Phase;
    action: Action;
    verdicts: TierVerdict[];
    metrics: TurnMetrics;
}
//# sourceMappingURL=types.d.ts.map