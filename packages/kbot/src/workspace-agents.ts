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

export interface PlannerStartResult {
  planId: string
  steps: unknown[]
}

export type PlannerStartFn = (
  taskInput: string,
  state: WorkspaceAgentState,
) => Promise<PlannerStartResult>

/**
 * Default planner adapter. Tries the hierarchical planner; if it's not
 * usable in this context (feature-flag gated, or its surface differs from
 * what we need) falls back to a deterministic stub.
 *
 * TODO: when the hierarchical planner gains a non-feature-flagged
 * `dispatchTask`-style surface, wire it in here directly.
 */
export const defaultPlannerStart: PlannerStartFn = async (
  taskInput,
  state,
) => {
  // Best-effort use of HierarchicalPlanner. Its `planAndExecute` is gated
  // behind KBOT_PLANNER=hierarchical and requires real AgentOptions — which
  // workspace agents don't have on their own. So we only attempt it when the
  // env flag is set AND a global agentOpts has been wired in (not yet).
  // For now: use the stub fallback. Returning a stub is intentional and
  // tested. Real planner integration is Phase-2.
  if (process.env.KBOT_PLANNER === 'hierarchical') {
    try {
      const mod = await import('./planner/hierarchical/session-planner.js')
      const planner = new mod.HierarchicalPlanner()
      const goal = await planner.createGoal({
        title: state.name,
        intent: state.mission,
        acceptance: [taskInput],
        tags: ['workspace-agent', state.id],
      })
      return { planId: goal.id, steps: [] }
    } catch {
      // fall through to stub
    }
  }
  return { planId: 'stub', steps: [] }
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

  async start(agentId: string, taskInput: string): Promise<StartResult> {
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
      planResult = await this.plannerStart(taskInput, state)
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

  private async requireState(agentId: string): Promise<WorkspaceAgentState> {
    const state = await readState(this.root, agentId)
    if (!state) {
      throw new WorkspaceAgentError(`agent ${agentId} not found`)
    }
    return state
  }
}
