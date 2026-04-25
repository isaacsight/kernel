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

import { randomBytes } from 'node:crypto'
import { autonomousExecute, type Plan } from '../../planner.js'
import type { AgentOptions } from '../../agent.js'
import type {
  Action,
  ActionStep,
  Phase,
  SessionGoal,
  TurnMetrics,
} from './types.js'
import {
  defaultStateDir,
  getActive,
  getActivePhase,
  readGoal,
  setActive,
  writeAction,
  writeGoal,
  writePhase,
} from './persistence.js'
import { detectPhaseKind } from './phase-detect.js'
import type { PhaseKind } from './types.js'

// ─────────────────────────────────────────────────────────────────────────────
// Phase-1 local type shims.
// `SessionContext` and `Ulid` are not yet in ../types.ts (that file is still
// landing). Declaring them here keeps this module self-contained and will be
// trivially re-exported once the canonical definitions land.
// ─────────────────────────────────────────────────────────────────────────────

export type Ulid = string

/** Minimal shape planAndExecute needs from the caller. */
export interface SessionContext {
  /** Optional session identifier (e.g. from memory.ts). */
  sessionId?: string
  /** Agent options to thread into the underlying planner. */
  agentOpts: AgentOptions
  /** When true, skip interactive approval on the underlying planner. */
  autoApprove?: boolean
  /**
   * Optional executor override. Defaults to `autonomousExecute`. Tests use
   * this to inject a fake plan without standing up the real LLM-driven planner.
   */
  executor?: (
    userTurn: string,
    agentOpts: AgentOptions,
    opts: { autoApprove: boolean },
  ) => Promise<Plan>
}

/**
 * Phase-1 `PlannerResult`. Shape matches the spec in this ticket — NOT the
 * richer `PlannerResult` in ./types.ts, which targets Phase 2+. We use a local
 * name to avoid a clash and to flag this is transitional.
 */
export interface PlannerResult {
  /** Always null in Phase 1; Phase 2 will populate via tier-1 logic. */
  goal: SessionGoal | null
  /** Ephemeral placeholder phase spanning just this turn. */
  phase: Phase
  /** The action derived from autonomousExecute's flat plan. */
  action: Action
  metrics: TurnMetrics
}

// ─────────────────────────────────────────────────────────────────────────────
// ULID-ish id generator.
// We depend on `ulid` if it's resolvable at runtime, otherwise fall back to a
// 26-char Crockford-base32 string sourced from crypto.randomBytes. Either way
// IDs are sortable-ish and collision-resistant enough for per-goal filenames.
// ─────────────────────────────────────────────────────────────────────────────

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

function cryptoUlid(): Ulid {
  // 10 chars of timestamp (ms) + 16 chars of randomness = 26 chars.
  let ts = Date.now()
  const tsChars: string[] = []
  for (let i = 0; i < 10; i++) {
    tsChars.unshift(CROCKFORD[ts % 32])
    ts = Math.floor(ts / 32)
  }
  const bytes = randomBytes(10)
  const rand: string[] = []
  // 80 bits → 16 base32 chars. Pull 5 bits at a time.
  let acc = 0
  let accBits = 0
  for (const b of bytes) {
    acc = (acc << 8) | b
    accBits += 8
    while (accBits >= 5) {
      accBits -= 5
      rand.push(CROCKFORD[(acc >> accBits) & 0x1f])
    }
  }
  return tsChars.join('') + rand.slice(0, 16).join('')
}

// ─────────────────────────────────────────────────────────────────────────────
// HierarchicalPlanner
// ─────────────────────────────────────────────────────────────────────────────

export interface HierarchicalPlannerOptions {
  /** Override persistence root; defaults to `~/.kbot/planner/`. */
  stateDir?: string
}

export class HierarchicalPlanner {
  private readonly stateDir: string

  constructor(opts: HierarchicalPlannerOptions = {}) {
    this.stateDir = opts.stateDir ?? defaultStateDir()
  }

  /**
   * Plan and execute one user turn.
   *
   * Phase 2: full goal → phase → action nesting. When `KBOT_PLANNER` is set
   * to `hierarchical`, this method:
   *   1. Loads the active SessionGoal (or runs goal-less, returning goal=null).
   *   2. Resolves the active Phase under that goal — reusing it if the
   *      detected PhaseKind matches, otherwise closing it and opening a new
   *      one with the new kind.
   *   3. Delegates execution to `autonomousExecute` (the existing flat planner).
   *   4. Persists the resulting Action under the phase, and updates phase
   *      status when the action terminates the phase's work.
   *
   * The optional ctx.executor lets tests inject a fake autonomousExecute so
   * the persistence layer can be exercised without spinning the real planner.
   */
  async planAndExecute(
    userTurn: string,
    ctx: SessionContext,
  ): Promise<PlannerResult> {
    const flag = process.env.KBOT_PLANNER
    if (flag !== 'hierarchical') {
      throw new Error(
        `HierarchicalPlanner.planAndExecute is gated behind KBOT_PLANNER=hierarchical ` +
          `(got ${flag ?? 'unset'}). Set the env var to opt in.`,
      )
    }

    const startedAt = Date.now()

    // Tier 1 — load active goal (may be null; nesting is best-effort).
    const goal = await getActive(this.stateDir)

    // Tier 2 — resolve or roll the Phase. Only persist phases when a goal exists.
    const detectedKind = detectPhaseKind(userTurn)
    let phase = await this.resolvePhase(goal, detectedKind, userTurn, startedAt)

    // Tier 3 — delegate execution. autonomousExecute is the existing flat
    // planner; the hierarchical layer wraps it with goal/phase context.
    const exec = ctx.executor ?? autonomousExecute
    const plan: Plan = await exec(userTurn, ctx.agentOpts, {
      autoApprove: ctx.autoApprove ?? true,
    })

    // Tier 4 — record the action under the (possibly persisted) phase.
    const steps: ActionStep[] = plan.steps.map(step => ({ ...step }))
    const action: Action = {
      id: cryptoUlid(),
      phaseId: phase.id,
      userTurn,
      summary: plan.summary,
      steps,
      createdAt: plan.createdAt,
      status:
        plan.status === 'completed'
          ? 'done'
          : plan.status === 'failed'
            ? 'failed'
            : 'running',
    }

    if (goal) {
      await writeAction(this.stateDir, action)
      // Mirror plan failure into the phase so the next turn can decide to roll.
      if (plan.status === 'failed' && phase.status === 'active') {
        phase = { ...phase, status: 'aborted', endedAt: new Date().toISOString() }
        await writePhase(this.stateDir, phase)
      }
    }

    const metrics: TurnMetrics = {
      tier1Calls: goal ? 1 : 0,
      tier2Calls: 1,
      tier3Calls: 1,
      tier4Calls: steps.length,
      tokensIn: 0,
      tokensOut: 0,
      wallMs: Date.now() - startedAt,
    }

    return { goal, phase, action, metrics }
  }

  /**
   * Pick the Phase to operate under: reuse the active one if PhaseKind
   * matches, otherwise close it and open a new one. When no goal is set, an
   * ephemeral phase is returned without persistence.
   */
  private async resolvePhase(
    goal: SessionGoal | null,
    detectedKind: PhaseKind,
    userTurn: string,
    startedAt: number,
  ): Promise<Phase> {
    const nowIso = new Date(startedAt).toISOString()
    if (!goal) {
      // Ephemeral phase — never persisted.
      return {
        id: cryptoUlid(),
        goalId: '',
        kind: detectedKind,
        objective: userTurn,
        exitCriteria: [],
        startedAt: nowIso,
        status: 'active',
      }
    }

    const active = await getActivePhase(this.stateDir, goal.id)
    if (active && active.kind === detectedKind) {
      return active
    }

    // Roll: mark the old phase done and open a new one with the new kind.
    if (active) {
      const closed: Phase = { ...active, status: 'done', endedAt: nowIso }
      await writePhase(this.stateDir, closed)
    }
    const fresh: Phase = {
      id: cryptoUlid(),
      goalId: goal.id,
      kind: detectedKind,
      objective: userTurn,
      exitCriteria: [],
      startedAt: nowIso,
      status: 'active',
    }
    await writePhase(this.stateDir, fresh)
    return fresh
  }

  /** Read the currently-active goal from disk, or null if none is set. */
  async loadGoal(): Promise<SessionGoal | null> {
    return getActive(this.stateDir)
  }

  /**
   * Create a new goal on disk and mark it active.
   * Fields the caller omits are filled with sensible defaults.
   */
  async createGoal(spec: Partial<SessionGoal> = {}): Promise<SessionGoal> {
    const now = new Date().toISOString()
    const goal: SessionGoal = {
      id: spec.id ?? cryptoUlid(),
      title: spec.title ?? '(untitled goal)',
      intent: spec.intent ?? '',
      acceptance: spec.acceptance ?? [],
      createdAt: spec.createdAt ?? now,
      updatedAt: spec.updatedAt ?? now,
      status: spec.status ?? 'active',
      tags: spec.tags,
    }
    await writeGoal(this.stateDir, goal)
    await setActive(this.stateDir, goal.id)
    return goal
  }

  /** Activate an existing goal by id. Throws if the goal does not exist. */
  async setGoal(goalId: Ulid): Promise<void> {
    const existing = await readGoal(this.stateDir, goalId)
    if (!existing) {
      throw new Error(`setGoal: goal ${goalId} not found under ${this.stateDir}`)
    }
    await setActive(this.stateDir, goalId)
  }
}
