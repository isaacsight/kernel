/**
 * Workspace Agents — long-running named agents bound to a workspace with
 * permissions and resumable state. Parity with OpenAI's Workspace Agents
 * (Apr 2026). Wraps the hierarchical planner at ./planner/hierarchical/.
 *
 * State JSON shape (one file per agent at <root>/<id>.json):
 *   { id, name, mission, allowedTools, scopes, status, createdAt, updatedAt,
 *     currentPlanId?, history: [{ ts, event, data }] }
 *
 * Storage root: process.env.KBOT_WORKSPACE_AGENTS_ROOT
 *               ?? <homedir>/.kbot/workspace-agents
 *
 * Permissions: every tool invocation must pass through `gate(toolName)` which
 * checks `allowedTools`. Scopes are recorded but enforcement is per-tool via
 * the allowedTools whitelist.
 */

import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import type { AgentOptions } from './agent.js'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type WorkspaceAgentStatus =
  | 'idle'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'

export type Scope = string // e.g. "read:files", "write:tools", "invoke:slack"

export interface HistoryEvent {
  ts: string
  event: string
  data?: unknown
}

export interface WorkspaceAgentState {
  id: string
  name: string
  mission: string
  allowedTools: string[]
  scopes: Scope[]
  status: WorkspaceAgentStatus
  createdAt: string
  updatedAt: string
  currentPlanId?: string
  history: HistoryEvent[]
}

export interface CreateOptions {
  name: string
  mission: string
  allowedTools?: string[]
  scopes?: Scope[]
}

export interface CreateResult {
  id: string
  name: string
}

export interface StartResult {
  id: string
  status: WorkspaceAgentStatus
  planId?: string
  steps: unknown[]
}

export interface ListEntry {
  id: string
  name: string
  status: WorkspaceAgentStatus
}

export class ScopeError extends Error {
  readonly toolName: string
  constructor(toolName: string, message?: string) {
    super(message ?? `Tool "${toolName}" is not in this agent's allowedTools`)
    this.name = 'ScopeError'
    this.toolName = toolName
  }
}

export class WorkspaceAgentError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WorkspaceAgentError'
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Storage helpers
// ─────────────────────────────────────────────────────────────────────────────

export function defaultRoot(): string {
  const env = process.env.KBOT_WORKSPACE_AGENTS_ROOT
  if (env && env.trim().length > 0) return env
  return path.join(os.homedir(), '.kbot', 'workspace-agents')
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true })
}

function statePath(root: string, id: string): string {
  return path.join(root, `${id}.json`)
}

async function readState(
  root: string,
  id: string,
): Promise<WorkspaceAgentState | null> {
  try {
    const raw = await fs.readFile(statePath(root, id), 'utf8')
    return JSON.parse(raw) as WorkspaceAgentState
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw e
  }
}

async function writeState(
  root: string,
  state: WorkspaceAgentState,
): Promise<void> {
  await ensureDir(root)
  const tmp = statePath(root, state.id) + '.tmp'
  await fs.writeFile(tmp, JSON.stringify(state, null, 2), 'utf8')
  await fs.rename(tmp, statePath(root, state.id))
}

async function listAll(root: string): Promise<WorkspaceAgentState[]> {
  try {
    const entries = await fs.readdir(root)
    const out: WorkspaceAgentState[] = []
    for (const e of entries) {
      if (!e.endsWith('.json')) continue
      try {
        const raw = await fs.readFile(path.join(root, e), 'utf8')
        out.push(JSON.parse(raw) as WorkspaceAgentState)
      } catch {
        // skip corrupt entries
      }
    }
    return out
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw e
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Planner adapter
// ─────────────────────────────────────────────────────────────────────────────

/** A single tool call surfaced by the planner, ready to be gated + recorded. */
export interface PlannerToolCall {
  tool: string
  args?: unknown
  result?: unknown
}

export interface PlannerStartResult {
  planId: string
  steps: unknown[]
  /**
   * Optional list of tool calls the planner produced. When present, the
   * WorkspaceAgent will run each through `gate()` and `recordToolCall()`,
   * capturing `tool_blocked` events for any that ScopeError out.
   */
  toolCalls?: PlannerToolCall[]
  /**
   * Free-form notes the planner wants surfaced as history events. Each entry
   * becomes a `planner_note` event on the agent's timeline.
   */
  notes?: string[]
}

export type PlannerStartFn = (
  taskInput: string,
  state: WorkspaceAgentState,
  agentOpts?: AgentOptions | null,
) => Promise<PlannerStartResult>

/**
 * Default planner adapter — implements the 3-tier strategy:
 *
 *   Tier 1: KBOT_PLANNER=hierarchical AND non-null agentOpts → real
 *           HierarchicalPlanner.planAndExecute. Tool calls extracted from
 *           the resulting Action.steps and surfaced for gating.
 *   Tier 2: HierarchicalPlanner module loadable but no agentOpts → call
 *           createGoal only; emit a TODO note; return early.
 *   Tier 3: Module import fails (e.g. test env) → deterministic stub
 *           `{ planId: 'stub', steps: [] }`.
 *
 * The function never throws on planner-internal failures: each tier degrades
 * to the next so the WorkspaceAgent.start() lifecycle stays predictable.
 */
export const defaultPlannerStart: PlannerStartFn = async (
  taskInput,
  state,
  agentOpts,
) => {
  // Try to import the planner module first. If this fails we're in Tier 3.
  let mod: typeof import('./planner/hierarchical/session-planner.js')
  try {
    mod = await import('./planner/hierarchical/session-planner.js')
  } catch {
    // Tier 3: stub fallback (current behavior).
    return { planId: 'stub', steps: [] }
  }

  const planner = new mod.HierarchicalPlanner()

  // Tier 1: real planner — needs both the env flag and agentOpts.
  if (process.env.KBOT_PLANNER === 'hierarchical' && agentOpts) {
    try {
      const goal = await planner.createGoal({
        title: state.name,
        intent: state.mission,
        acceptance: [taskInput],
        tags: ['workspace-agent', state.id],
      })
      const result = await planner.planAndExecute(taskInput, {
        sessionId: state.id,
        agentOpts,
        autoApprove: true,
      })

      const steps = result.action.steps
      const toolCalls: PlannerToolCall[] = steps
        .filter(s => typeof s.tool === 'string' && s.tool.length > 0)
        .map(s => ({
          tool: s.tool as string,
          args: s.args,
          result: s.result,
        }))

      return {
        planId: goal.id,
        steps,
        toolCalls,
      }
    } catch (err) {
      // If tier-1 itself throws, don't crash the whole start() — degrade to
      // Tier 2 so we still record the goal and a planner_note explaining why.
      const msg = err instanceof Error ? err.message : String(err)
      try {
        const goal = await planner.createGoal({
          title: state.name,
          intent: state.mission,
          acceptance: [taskInput],
          tags: ['workspace-agent', state.id],
        })
        return {
          planId: goal.id,
          steps: [],
          notes: [
            `tier-1 planner failed (${msg}); recorded goal only`,
          ],
        }
      } catch {
        return { planId: 'stub', steps: [] }
      }
    }
  }

  // Tier 2: planner loadable but no agentOpts (or flag absent) — record a
  // goal and surface a TODO so callers know to wire AgentOptions through.
  try {
    const goal = await planner.createGoal({
      title: state.name,
      intent: state.mission,
      acceptance: [taskInput],
      tags: ['workspace-agent', state.id],
    })
    return {
      planId: goal.id,
      steps: [],
      notes: [
        'real planAndExecute requires AgentOptions; configure caller to pass them.',
      ],
    }
  } catch {
    // Tier 3: createGoal failed (e.g. read-only home dir) → stub.
    return { planId: 'stub', steps: [] }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// WorkspaceAgent
// ─────────────────────────────────────────────────────────────────────────────

export interface WorkspaceAgentOptions {
  /** Override storage root. Defaults to env or ~/.kbot/workspace-agents. */
  root?: string
  /** Override planner adapter (used by tests). */
  plannerStart?: PlannerStartFn
}

export class WorkspaceAgent {
  private readonly root: string
  private readonly plannerStart: PlannerStartFn

  constructor(opts: WorkspaceAgentOptions = {}) {
    this.root = opts.root ?? defaultRoot()
    this.plannerStart = opts.plannerStart ?? defaultPlannerStart
  }

  // ── Public API ───────────────────────────────────────────────────────────

  async create(opts: CreateOptions): Promise<CreateResult> {
    if (!opts.name || !opts.name.trim()) {
      throw new WorkspaceAgentError('create: name is required')
    }
    if (!opts.mission || !opts.mission.trim()) {
      throw new WorkspaceAgentError('create: mission is required')
    }

    const existing = await listAll(this.root)
    if (existing.some(s => s.name === opts.name)) {
      throw new WorkspaceAgentError(
        `create: an agent named "${opts.name}" already exists in this workspace`,
      )
    }

    const now = new Date().toISOString()
    const state: WorkspaceAgentState = {
      id: randomUUID(),
      name: opts.name,
      mission: opts.mission,
      allowedTools: opts.allowedTools ?? [],
      scopes: opts.scopes ?? [],
      status: 'idle',
      createdAt: now,
      updatedAt: now,
      history: [
        { ts: now, event: 'created', data: { name: opts.name } },
      ],
    }
    await writeState(this.root, state)
    return { id: state.id, name: state.name }
  }

  async start(
    agentId: string,
    taskInput: string,
    agentOpts: AgentOptions | null = null,
  ): Promise<StartResult> {
    const state = await this.requireState(agentId)
    if (state.status === 'running') {
      throw new WorkspaceAgentError(
        `start: agent ${agentId} is already running`,
      )
    }
    if (state.status === 'completed') {
      throw new WorkspaceAgentError(
        `start: agent ${agentId} is completed; create a new agent`,
      )
    }

    state.status = 'running'
    state.updatedAt = new Date().toISOString()
    state.history.push({
      ts: state.updatedAt,
      event: 'started',
      data: { taskInput },
    })
    await writeState(this.root, state)

    let planResult: PlannerStartResult
    try {
      planResult = await this.plannerStart(taskInput, state, agentOpts)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      state.status = 'failed'
      state.updatedAt = new Date().toISOString()
      state.history.push({
        ts: state.updatedAt,
        event: 'planner_error',
        data: { message: msg },
      })
      await writeState(this.root, state)
      throw new WorkspaceAgentError(`start: planner failed: ${msg}`)
    }

    state.currentPlanId = planResult.planId
    state.updatedAt = new Date().toISOString()
    state.history.push({
      ts: state.updatedAt,
      event: 'plan_created',
      data: { planId: planResult.planId, stepCount: planResult.steps.length },
    })
    await writeState(this.root, state)

    // Surface any planner-emitted notes onto the agent's timeline.
    if (planResult.notes && planResult.notes.length > 0) {
      for (const note of planResult.notes) {
        await this.appendEvent(agentId, 'planner_note', { message: note })
      }
    }

    // Gate + record every tool call the planner produced. ScopeError from
    // gate() must NOT escape start() — convert to a `tool_blocked` event and
    // continue with the rest.
    if (planResult.toolCalls && planResult.toolCalls.length > 0) {
      for (const call of planResult.toolCalls) {
        try {
          await this.gate(agentId, call.tool)
        } catch (err) {
          if (err instanceof ScopeError) {
            await this.appendEvent(agentId, 'tool_blocked', {
              tool: call.tool,
              reason: err.message,
            })
            continue
          }
          throw err
        }
        await this.recordToolCall(agentId, call.tool, call.args, call.result)
      }
    }

    return {
      id: state.id,
      status: state.status,
      planId: planResult.planId,
      steps: planResult.steps,
    }
  }

  async resume(agentId: string): Promise<WorkspaceAgentState> {
    const state = await this.requireState(agentId)
    if (state.status !== 'paused' && state.status !== 'failed') {
      throw new WorkspaceAgentError(
        `resume: agent ${agentId} has status "${state.status}"; resume only allowed from paused or failed`,
      )
    }
    state.status = 'running'
    state.updatedAt = new Date().toISOString()
    state.history.push({ ts: state.updatedAt, event: 'resumed' })
    await writeState(this.root, state)
    return state
  }

  async stop(agentId: string): Promise<WorkspaceAgentState> {
    const state = await this.requireState(agentId)
    state.status = 'paused'
    state.updatedAt = new Date().toISOString()
    state.history.push({ ts: state.updatedAt, event: 'stopped' })
    await writeState(this.root, state)
    return state
  }

  async status(agentId: string): Promise<WorkspaceAgentState> {
    return this.requireState(agentId)
  }

  async list(): Promise<ListEntry[]> {
    const all = await listAll(this.root)
    return all.map(s => ({ id: s.id, name: s.name, status: s.status }))
  }

  /**
   * Permission gate. Throws ScopeError if the tool isn't in allowedTools and
   * appends a `tool_denied` event to history. On allow, appends `tool_allowed`.
   */
  async gate(agentId: string, toolName: string): Promise<void> {
    const state = await this.requireState(agentId)
    if (!state.allowedTools.includes(toolName)) {
      state.history.push({
        ts: new Date().toISOString(),
        event: 'tool_denied',
        data: { tool: toolName },
      })
      state.updatedAt = new Date().toISOString()
      await writeState(this.root, state)
      throw new ScopeError(toolName)
    }
    state.history.push({
      ts: new Date().toISOString(),
      event: 'tool_allowed',
      data: { tool: toolName },
    })
    state.updatedAt = new Date().toISOString()
    await writeState(this.root, state)
  }

  /**
   * Append a tool-call record to the agent's history. Caller must call
   * `gate()` first; this method does NOT enforce permissions.
   */
  async recordToolCall(
    agentId: string,
    toolName: string,
    args: unknown,
    result?: unknown,
  ): Promise<void> {
    const state = await this.requireState(agentId)
    state.history.push({
      ts: new Date().toISOString(),
      event: 'tool_call',
      data: { tool: toolName, args, result },
    })
    state.updatedAt = new Date().toISOString()
    await writeState(this.root, state)
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private async appendEvent(
    agentId: string,
    event: string,
    data?: unknown,
  ): Promise<void> {
    const state = await this.requireState(agentId)
    const ts = new Date().toISOString()
    state.history.push({ ts, event, data })
    state.updatedAt = ts
    await writeState(this.root, state)
  }

  private async requireState(agentId: string): Promise<WorkspaceAgentState> {
    const state = await readState(this.root, agentId)
    if (!state) {
      throw new WorkspaceAgentError(`agent ${agentId} not found`)
    }
    return state
  }
}
