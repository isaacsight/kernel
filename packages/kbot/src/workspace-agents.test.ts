import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  WorkspaceAgent,
  ScopeError,
  WorkspaceAgentError,
  type PlannerStartFn,
} from './workspace-agents.js'

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
