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
  readGoal,
  setActive,
  writeGoal,
} from './persistence.js'

// ─────────────────────────────────────────────────────────────────────────────
// Phase-1 local type shims.
// `SessionContext` and `Ulid` are not yet in ../types.ts (that file is still
// landing). Declaring them here keeps this module self-contained and will be
// trivially re-exported once the canonical definitions land.
// ─────────────────────────────────────────────────────────────────────────────

export type Ulid = string

/** Minimal shape planAndExecute needs from the caller. Expand in Phase 2. */
export interface SessionContext {
  /** Optional session identifier (e.g. from memory.ts). */
  sessionId?: string
  /** Agent options to thread into the underlying planner. */
  agentOpts: AgentOptions
  /** When true, skip interactive approval on the underlying planner. */
  autoApprove?: boolean
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
   * Phase 1: feature-flag gated passthrough to autonomousExecute.
   * Phase 2+: replace the body with the Tier 1–4 cascade.
   */
  async planAndExecute(
    userTurn: string,
    ctx: SessionContext,
  ): Promise<PlannerResult> {
    const flag = process.env.KBOT_PLANNER
    if (flag !== 'hierarchical') {
      throw new Error(
        `HierarchicalPlanner.planAndExecute is gated behind KBOT_PLANNER=hierarchical ` +
          `(got ${flag ?? 'unset'}). This path is Phase-1 scaffolding only.`,
      )
    }

    const startedAt = Date.now()

    const plan: Plan = await autonomousExecute(userTurn, ctx.agentOpts, {
      autoApprove: ctx.autoApprove ?? true,
    })

    const phase: Phase = {
      id: cryptoUlid(),
      goalId: '', // no goal linked in Phase 1
      kind: 'other',
      objective: userTurn,
      exitCriteria: [],
      startedAt: new Date(startedAt).toISOString(),
      endedAt: new Date().toISOString(),
      status: plan.status === 'completed' ? 'done' : 'active',
    }

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

    const metrics: TurnMetrics = {
      tier1Calls: 0,
      tier2Calls: 0,
      tier3Calls: 1, // autonomousExecute counts as one tier-3 invocation
      tier4Calls: steps.length,
      tokensIn: 0,
      tokensOut: 0,
      wallMs: Date.now() - startedAt,
    }

    // Phase 1 never attaches a goal — that's Phase 2.
    return { goal: null, phase, action, metrics }
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
