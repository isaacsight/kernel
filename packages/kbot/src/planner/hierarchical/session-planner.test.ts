/**
 * HierarchicalPlanner Phase 2 — nesting + persistence tests.
 *
 * Each test gets its own temp stateDir so persistence is isolated. The fake
 * executor returns a synthetic Plan, so no LLM is called.
 */

import { describe, it, beforeEach, afterEach } from 'vitest'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, existsSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HierarchicalPlanner, type SessionContext } from './session-planner.js'
import type { AgentOptions } from '../../agent.js'
import type { Plan } from '../../planner.js'

function fakePlan(overrides: Partial<Plan> = {}): Plan {
  return {
    task: 'fake task',
    summary: 'fake summary',
    steps: [
      { id: 1, description: 'do thing', status: 'done' },
    ],
    filesInScope: [],
    estimatedToolCalls: 1,
    status: 'completed',
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

function ctxWith(plan: Plan): SessionContext {
  return {
    agentOpts: {} as AgentOptions,
    autoApprove: true,
    executor: async () => plan,
  }
}

let stateDir: string
let prevFlag: string | undefined

beforeEach(() => {
  stateDir = mkdtempSync(join(tmpdir(), 'kbot-planner-'))
  prevFlag = process.env.KBOT_PLANNER
  process.env.KBOT_PLANNER = 'hierarchical'
})

afterEach(() => {
  if (prevFlag === undefined) delete process.env.KBOT_PLANNER
  else process.env.KBOT_PLANNER = prevFlag
  try { rmSync(stateDir, { recursive: true, force: true }) } catch { /* ignore */ }
})

describe('HierarchicalPlanner Phase 2 — feature flag', () => {
  it('throws when KBOT_PLANNER is unset', async () => {
    delete process.env.KBOT_PLANNER
    const p = new HierarchicalPlanner({ stateDir })
    await assert.rejects(
      () => p.planAndExecute('fix the bug', ctxWith(fakePlan())),
      /KBOT_PLANNER=hierarchical/,
    )
  })
})

describe('HierarchicalPlanner Phase 2 — goal-less mode', () => {
  it('runs without a goal and returns goal=null + ephemeral phase', async () => {
    const p = new HierarchicalPlanner({ stateDir })
    const result = await p.planAndExecute('fix the failing test', ctxWith(fakePlan()))
    assert.equal(result.goal, null)
    assert.equal(result.phase.kind, 'debug')
    assert.equal(result.phase.goalId, '')
    assert.equal(result.action.status, 'done')
    // Nothing should have been written under stateDir.
    assert.equal(existsSync(join(stateDir, 'phases')), false)
    assert.equal(existsSync(join(stateDir, 'actions')), false)
  })
})

describe('HierarchicalPlanner Phase 2 — nesting under a goal', () => {
  it('creates a Phase under the active Goal and persists the Action', async () => {
    const p = new HierarchicalPlanner({ stateDir })
    const goal = await p.createGoal({ title: 'ship planner v2', intent: 'make it real' })
    const result = await p.planAndExecute('debug the failing critic test', ctxWith(fakePlan()))
    assert.equal(result.goal?.id, goal.id)
    assert.equal(result.phase.goalId, goal.id)
    assert.equal(result.phase.kind, 'debug')
    // Phase persisted on disk.
    const phasesDir = join(stateDir, 'phases', goal.id)
    assert.ok(existsSync(phasesDir), 'phases dir should exist')
    assert.equal(readdirSync(phasesDir).filter(f => f.endsWith('.json')).length, 1)
    // Action persisted on disk.
    const actionsDir = join(stateDir, 'actions', result.phase.id)
    assert.ok(existsSync(actionsDir), 'actions dir should exist')
    assert.equal(readdirSync(actionsDir).filter(f => f.endsWith('.json')).length, 1)
  })

  it('reuses the active Phase when PhaseKind matches', async () => {
    const p = new HierarchicalPlanner({ stateDir })
    const goal = await p.createGoal({ title: 'g' })
    const r1 = await p.planAndExecute('debug the parser bug', ctxWith(fakePlan()))
    const r2 = await p.planAndExecute('debug another assertion', ctxWith(fakePlan()))
    assert.equal(r1.phase.id, r2.phase.id, 'same phase should be reused')
    // One phase file, two action files under it.
    const phasesDir = join(stateDir, 'phases', goal.id)
    assert.equal(readdirSync(phasesDir).filter(f => f.endsWith('.json')).length, 1)
    const actionsDir = join(stateDir, 'actions', r1.phase.id)
    assert.equal(readdirSync(actionsDir).filter(f => f.endsWith('.json')).length, 2)
  })

  it('rolls the Phase when PhaseKind changes', async () => {
    const p = new HierarchicalPlanner({ stateDir })
    const goal = await p.createGoal({ title: 'g' })
    const r1 = await p.planAndExecute('debug the broken auth', ctxWith(fakePlan()))
    const r2 = await p.planAndExecute('build a new login form', ctxWith(fakePlan()))
    assert.notEqual(r1.phase.id, r2.phase.id, 'new kind should open a new phase')
    assert.equal(r1.phase.kind, 'debug')
    assert.equal(r2.phase.kind, 'build')
    // Two phase files under the goal.
    const phasesDir = join(stateDir, 'phases', goal.id)
    assert.equal(readdirSync(phasesDir).filter(f => f.endsWith('.json')).length, 2)
  })

  it('aborts the Phase when the underlying plan fails', async () => {
    const p = new HierarchicalPlanner({ stateDir })
    await p.createGoal({ title: 'g' })
    const failing = fakePlan({ status: 'failed' })
    const result = await p.planAndExecute('fix the broken thing', ctxWith(failing))
    assert.equal(result.action.status, 'failed')
    assert.equal(result.phase.status, 'aborted')
  })
})
