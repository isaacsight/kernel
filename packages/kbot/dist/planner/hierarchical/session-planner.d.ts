/**
 * HierarchicalPlanner — Phase 1 passthrough.
 *
 * This file lays the pipe for the four-tier hierarchical planner described in
 * ./types.ts. Today it does NOT implement tiers — `planAndExecute` delegates
 * the entire user turn to the existing flat `autonomousExecute` from
 * ../../planner.ts and synthesizes a `PlannerResult` shell around it.
 *
 * Real goal persistence is live: `loadGoal`, `createGoal`, and `setGoal` read
 * and write `~/.kbot/planner/goals/<id>.json` plus the `active.json` pointer.
 * The current PlannerResult.goal is always `null` in this phase because the
 * tier-1 selection/creation loop isn't wired in yet — callers opt into goal
 * tracking explicitly via createGoal/setGoal.
 *
 * Feature flag: `planAndExecute` throws unless `process.env.KBOT_PLANNER ===
 * 'hierarchical'`. Nothing in production calls this class yet.
 */
import type { AgentOptions } from '../../agent.js';
import type { Action, Phase, SessionGoal, TurnMetrics } from './types.js';
export type Ulid = string;
/** Minimal shape planAndExecute needs from the caller. Expand in Phase 2. */
export interface SessionContext {
    /** Optional session identifier (e.g. from memory.ts). */
    sessionId?: string;
    /** Agent options to thread into the underlying planner. */
    agentOpts: AgentOptions;
    /** When true, skip interactive approval on the underlying planner. */
    autoApprove?: boolean;
}
/**
 * Phase-1 `PlannerResult`. Shape matches the spec in this ticket — NOT the
 * richer `PlannerResult` in ./types.ts, which targets Phase 2+. We use a local
 * name to avoid a clash and to flag this is transitional.
 */
export interface PlannerResult {
    /** Always null in Phase 1; Phase 2 will populate via tier-1 logic. */
    goal: SessionGoal | null;
    /** Ephemeral placeholder phase spanning just this turn. */
    phase: Phase;
    /** The action derived from autonomousExecute's flat plan. */
    action: Action;
    metrics: TurnMetrics;
}
export interface HierarchicalPlannerOptions {
    /** Override persistence root; defaults to `~/.kbot/planner/`. */
    stateDir?: string;
}
export declare class HierarchicalPlanner {
    private readonly stateDir;
    constructor(opts?: HierarchicalPlannerOptions);
    /**
     * Plan and execute one user turn.
     *
     * Phase 1: feature-flag gated passthrough to autonomousExecute.
     * Phase 2+: replace the body with the Tier 1–4 cascade.
     */
    planAndExecute(userTurn: string, ctx: SessionContext): Promise<PlannerResult>;
    /** Read the currently-active goal from disk, or null if none is set. */
    loadGoal(): Promise<SessionGoal | null>;
    /**
     * Create a new goal on disk and mark it active.
     * Fields the caller omits are filled with sensible defaults.
     */
    createGoal(spec?: Partial<SessionGoal>): Promise<SessionGoal>;
    /** Activate an existing goal by id. Throws if the goal does not exist. */
    setGoal(goalId: Ulid): Promise<void>;
}
//# sourceMappingURL=session-planner.d.ts.map