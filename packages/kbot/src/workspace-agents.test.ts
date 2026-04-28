import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  WorkspaceAgent,
  ScopeError,
  WorkspaceAgentError,
  defaultPlannerStart,
  type PlannerStartFn,
  type WorkspaceAgentState,
} from './workspace-agents.js'
import type { AgentOptions } from './agent.js'

let tmpRoot: string

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'kbot-workspace-agents-'))
})

afterEach(async () => {
  try {
    await fs.rm(tmpRoot, { recursive: true, force: true })
  } catch {
    /* noop */
  }
})

describe('WorkspaceAgent.create + list', () => {
  it('creates an agent and lists it', async () => {
    const wa = new WorkspaceAgent({ root: tmpRoot })
    const created = await wa.create({
      name: 'researcher',
      mission: 'survey the field',
      allowedTools: ['web_search'],
      scopes: ['read:files'],
    })
    expect(created.name).toBe('researcher')
    expect(created.id).toBeTruthy()

    const list = await wa.list()
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({
      id: created.id,
      name: 'researcher',
      status: 'idle',
    })
  })

  it('persists state JSON at <root>/<id>.json with the documented shape', async () => {
    const wa = new WorkspaceAgent({ root: tmpRoot })
    const { id } = await wa.create({
      name: 'a',
      mission: 'm',
      allowedTools: ['t1'],
      scopes: ['read:files'],
    })
    const raw = await fs.readFile(path.join(tmpRoot, `${id}.json`), 'utf8')
    const parsed = JSON.parse(raw)
    expect(parsed).toMatchObject({
      id,
      name: 'a',
      mission: 'm',
      allowedTools: ['t1'],
      scopes: ['read:files'],
      status: 'idle',
    })
    expect(parsed.createdAt).toBeTruthy()
    expect(parsed.updatedAt).toBeTruthy()
    expect(Array.isArray(parsed.history)).toBe(true)
    expect(parsed.history[0].event).toBe('created')
  })
})

describe('WorkspaceAgent.create — duplicate names', () => {
  it('rejects a duplicate name in the same workspace', async () => {
    const wa = new WorkspaceAgent({ root: tmpRoot })
    await wa.create({ name: 'dup', mission: 'first' })
    await expect(
      wa.create({ name: 'dup', mission: 'second' }),
    ).rejects.toBeInstanceOf(WorkspaceAgentError)
  })

  it('allows the same name in a different workspace root', async () => {
    const otherRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'kbot-workspace-agents-other-'),
    )
    try {
      const w1 = new WorkspaceAgent({ root: tmpRoot })
      const w2 = new WorkspaceAgent({ root: otherRoot })
      await w1.create({ name: 'shared', mission: 'm' })
      await expect(
        w2.create({ name: 'shared', mission: 'm' }),
      ).resolves.toBeTruthy()
    } finally {
      await fs.rm(otherRoot, { recursive: true, force: true })
    }
  })
})

describe('WorkspaceAgent.start', () => {
  it('transitions to running, calls planner, persists history', async () => {
    let plannerCalls = 0
    const stubPlanner: PlannerStartFn = async (taskInput, state) => {
      plannerCalls++
      expect(taskInput).toBe('do the thing')
      expect(state.name).toBe('worker')
      return { planId: 'stub', steps: [{ n: 1 }] }
    }

    const wa = new WorkspaceAgent({ root: tmpRoot, plannerStart: stubPlanner })
    const { id } = await wa.create({ name: 'worker', mission: 'm' })
    const started = await wa.start(id, 'do the thing')

    expect(plannerCalls).toBe(1)
    expect(started.status).toBe('running')
    expect(started.planId).toBe('stub')
    expect(started.steps).toHaveLength(1)

    const state = await wa.status(id)
    expect(state.status).toBe('running')
    expect(state.currentPlanId).toBe('stub')
    const events = state.history.map(h => h.event)
    expect(events).toContain('started')
    expect(events).toContain('plan_created')
  })

  it('refuses to start an already-running agent', async () => {
    const wa = new WorkspaceAgent({
      root: tmpRoot,
      plannerStart: async () => ({ planId: 'p', steps: [] }),
    })
    const { id } = await wa.create({ name: 'w', mission: 'm' })
    await wa.start(id, 'task')
    await expect(wa.start(id, 'task2')).rejects.toBeInstanceOf(
      WorkspaceAgentError,
    )
  })
})

describe('WorkspaceAgent.gate (permissions)', () => {
  it('rejects a tool not in allowedTools and records a tool_denied event', async () => {
    const wa = new WorkspaceAgent({ root: tmpRoot })
    const { id } = await wa.create({
      name: 'restricted',
      mission: 'm',
      allowedTools: ['read_file'],
    })

    await expect(wa.gate(id, 'shell_exec')).rejects.toBeInstanceOf(ScopeError)

    const state = await wa.status(id)
    const denied = state.history.find(h => h.event === 'tool_denied')
    expect(denied).toBeTruthy()
    expect((denied!.data as { tool: string }).tool).toBe('shell_exec')
  })

  it('allows a tool in allowedTools and records a tool_allowed event', async () => {
    const wa = new WorkspaceAgent({ root: tmpRoot })
    const { id } = await wa.create({
      name: 'ok',
      mission: 'm',
      allowedTools: ['read_file'],
    })
    await expect(wa.gate(id, 'read_file')).resolves.toBeUndefined()
    const state = await wa.status(id)
    const allowed = state.history.find(h => h.event === 'tool_allowed')
    expect(allowed).toBeTruthy()
  })
})

describe('WorkspaceAgent.resume', () => {
  it('restores state and transitions paused → running', async () => {
    const wa = new WorkspaceAgent({
      root: tmpRoot,
      plannerStart: async () => ({ planId: 'p', steps: [] }),
    })
    const { id } = await wa.create({ name: 'r', mission: 'm' })
    await wa.start(id, 'task')
    await wa.stop(id)

    // New WorkspaceAgent instance — proves state survives across instances.
    const wa2 = new WorkspaceAgent({ root: tmpRoot })
    const resumed = await wa2.resume(id)
    expect(resumed.status).toBe('running')
    expect(resumed.name).toBe('r')

    const events = resumed.history.map(h => h.event)
    expect(events).toContain('stopped')
    expect(events).toContain('resumed')
  })

  it('refuses to resume an idle agent', async () => {
    const wa = new WorkspaceAgent({ root: tmpRoot })
    const { id } = await wa.create({ name: 'i', mission: 'm' })
    await expect(wa.resume(id)).rejects.toBeInstanceOf(WorkspaceAgentError)
  })

  it('allows resuming a failed agent', async () => {
    const wa = new WorkspaceAgent({
      root: tmpRoot,
      plannerStart: async () => {
        throw new Error('planner blew up')
      },
    })
    const { id } = await wa.create({ name: 'f', mission: 'm' })
    await expect(wa.start(id, 'task')).rejects.toBeInstanceOf(
      WorkspaceAgentError,
    )
    const failed = await wa.status(id)
    expect(failed.status).toBe('failed')

    const resumed = await wa.resume(id)
    expect(resumed.status).toBe('running')
  })
})

describe('WorkspaceAgent.stop', () => {
  it('transitions running → paused', async () => {
    const wa = new WorkspaceAgent({
      root: tmpRoot,
      plannerStart: async () => ({ planId: 'p', steps: [] }),
    })
    const { id } = await wa.create({ name: 's', mission: 'm' })
    await wa.start(id, 'task')
    const stopped = await wa.stop(id)
    expect(stopped.status).toBe('paused')
    const events = stopped.history.map(h => h.event)
    expect(events).toContain('stopped')
  })
})

describe('WorkspaceAgent — env override for storage root', () => {
  it('honors KBOT_WORKSPACE_AGENTS_ROOT when no explicit root is passed', async () => {
    const envRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'kbot-workspace-agents-env-'),
    )
    const prev = process.env.KBOT_WORKSPACE_AGENTS_ROOT
    process.env.KBOT_WORKSPACE_AGENTS_ROOT = envRoot
    try {
      const wa = new WorkspaceAgent()
      const { id } = await wa.create({ name: 'env-agent', mission: 'm' })
      const exists = await fs
        .stat(path.join(envRoot, `${id}.json`))
        .then(() => true)
        .catch(() => false)
      expect(exists).toBe(true)
    } finally {
      if (prev === undefined) delete process.env.KBOT_WORKSPACE_AGENTS_ROOT
      else process.env.KBOT_WORKSPACE_AGENTS_ROOT = prev
      await fs.rm(envRoot, { recursive: true, force: true })
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Hierarchical planner integration — 3-tier strategy
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Helper: run `fn` with a tmp HOME so the real planner persistence layer
 * (which writes under `~/.kbot/planner/`) lands in an isolated directory.
 */
async function withTmpHome<T>(fn: (home: string) => Promise<T>): Promise<T> {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'kbot-tmp-home-'))
  const prevHome = process.env.HOME
  const prevUser = process.env.USERPROFILE
  process.env.HOME = home
  process.env.USERPROFILE = home
  try {
    return await fn(home)
  } finally {
    if (prevHome === undefined) delete process.env.HOME
    else process.env.HOME = prevHome
    if (prevUser === undefined) delete process.env.USERPROFILE
    else process.env.USERPROFILE = prevUser
    await fs.rm(home, { recursive: true, force: true })
  }
}

describe('WorkspaceAgent — Tier 2 (planner loadable, no agentOpts)', () => {
  it('persists a goal id onto state.currentPlanId and emits a planner_note TODO', async () => {
    await withTmpHome(async () => {
      // Make sure the env flag is NOT set so we land in Tier 2.
      const prevFlag = process.env.KBOT_PLANNER
      delete process.env.KBOT_PLANNER
      try {
        const wa = new WorkspaceAgent({
          root: tmpRoot,
          plannerStart: defaultPlannerStart,
        })
        const { id } = await wa.create({ name: 't2', mission: 'survey' })
        const started = await wa.start(id, 'do tier-2 thing')

        // Tier 2 returns a real (non-stub) plan id.
        expect(started.planId).toBeTruthy()
        expect(started.planId).not.toBe('stub')
        expect(started.steps).toEqual([])

        const state = await wa.status(id)
        expect(state.currentPlanId).toBe(started.planId)

        const noteEvent = state.history.find(h => h.event === 'planner_note')
        expect(noteEvent).toBeTruthy()
        expect(
          (noteEvent!.data as { message: string }).message,
        ).toMatch(/AgentOptions/)
      } finally {
        if (prevFlag === undefined) delete process.env.KBOT_PLANNER
        else process.env.KBOT_PLANNER = prevFlag
      }
    })
  })
})

describe('WorkspaceAgent — Tier 1 (real planner)', () => {
  afterEach(() => {
    vi.doUnmock('./planner/hierarchical/session-planner.js')
    vi.resetModules()
  })

  it('invokes planAndExecute and records tool calls through gate()', async () => {
    const planAndExecute = vi.fn(async () => ({
      goal: null,
      phase: {
        id: 'phase-1',
        goalId: '',
        kind: 'other' as const,
        objective: 'do tier-1 thing',
        exitCriteria: [],
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        status: 'done' as const,
      },
      action: {
        id: 'action-1',
        phaseId: 'phase-1',
        userTurn: 'do tier-1 thing',
        summary: 'mock',
        steps: [
          {
            id: 1,
            description: 'read a file',
            tool: 'read_file',
            args: { path: '/tmp/x' },
            status: 'done' as const,
            result: 'ok',
          },
        ],
        createdAt: new Date().toISOString(),
        status: 'done' as const,
      },
      metrics: {
        tier1Calls: 0,
        tier2Calls: 0,
        tier3Calls: 1,
        tier4Calls: 1,
        tokensIn: 0,
        tokensOut: 0,
        wallMs: 1,
      },
    }))

    const createGoal = vi.fn(async () => ({
      id: 'goal-tier1',
      title: 't1',
      intent: 'm',
      acceptance: ['do tier-1 thing'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'active' as const,
    }))

    vi.doMock('./planner/hierarchical/session-planner.js', () => ({
      HierarchicalPlanner: class {
        createGoal = createGoal
        planAndExecute = planAndExecute
      },
    }))

    // Re-import so the dynamic `await import(...)` in defaultPlannerStart
    // picks up the mock.
    const mod = await import('./workspace-agents.js')
    const prevFlag = process.env.KBOT_PLANNER
    process.env.KBOT_PLANNER = 'hierarchical'
    try {
      const wa = new mod.WorkspaceAgent({
        root: tmpRoot,
        plannerStart: mod.defaultPlannerStart,
      })
      const { id } = await wa.create({
        name: 't1',
        mission: 'm',
        allowedTools: ['read_file'],
      })
      const fakeOpts: AgentOptions = { agent: 'kernel' }
      const started = await wa.start(id, 'do tier-1 thing', fakeOpts)

      expect(planAndExecute).toHaveBeenCalledOnce()
      expect(createGoal).toHaveBeenCalledOnce()
      expect(started.planId).toBe('goal-tier1')

      const state = await wa.status(id)
      expect(state.currentPlanId).toBe('goal-tier1')

      const events = state.history.map(h => h.event)
      expect(events).toContain('tool_allowed')
      expect(events).toContain('tool_call')

      const toolCallEvent = state.history.find(h => h.event === 'tool_call')
      expect(toolCallEvent).toBeTruthy()
      expect((toolCallEvent!.data as { tool: string }).tool).toBe('read_file')
    } finally {
      if (prevFlag === undefined) delete process.env.KBOT_PLANNER
      else process.env.KBOT_PLANNER = prevFlag
    }
  })

  it('emits tool_blocked when the planner produces a disallowed tool, without throwing', async () => {
    // Use injected planner so the test stays focused on the gating contract.
    const blockingPlanner: PlannerStartFn = async (
      _taskInput: string,
      _state: WorkspaceAgentState,
      _agentOpts?: AgentOptions | null,
    ) => ({
      planId: 'goal-block',
      steps: [],
      toolCalls: [
        { tool: 'read_file', args: { path: '/ok' }, result: 'ok' },
        { tool: 'shell_exec', args: { cmd: 'rm -rf /' } },
      ],
    })

    const wa = new WorkspaceAgent({
      root: tmpRoot,
      plannerStart: blockingPlanner,
    })
    const { id } = await wa.create({
      name: 'blocker',
      mission: 'm',
      allowedTools: ['read_file'],
    })

    // Must NOT throw despite the disallowed tool.
    await expect(
      wa.start(id, 'do blocked thing', { agent: 'kernel' }),
    ).resolves.toBeTruthy()

    const state = await wa.status(id)
    const events = state.history.map(h => h.event)
    expect(events).toContain('tool_blocked')
    expect(events).toContain('tool_call') // the allowed one still recorded

    const blocked = state.history.find(h => h.event === 'tool_blocked')
    expect((blocked!.data as { tool: string }).tool).toBe('shell_exec')
  })
})

describe('WorkspaceAgent — Tier 3 stub (existing contract)', () => {
  it('returns the deterministic stub when the planner module is unavailable', async () => {
    // Inject a planner that mimics the import-failure fallback path.
    const stubPlanner: PlannerStartFn = async () => ({
      planId: 'stub',
      steps: [],
    })
    const wa = new WorkspaceAgent({ root: tmpRoot, plannerStart: stubPlanner })
    const { id } = await wa.create({ name: 't3', mission: 'm' })
    const started = await wa.start(id, 'task')

    expect(started.planId).toBe('stub')
    expect(started.steps).toEqual([])
    const state = await wa.status(id)
    expect(state.currentPlanId).toBe('stub')
  })
})
