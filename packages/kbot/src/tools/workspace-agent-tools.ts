/**
 * Workspace Agent kbot tool definitions.
 *
 * NOT registered in tools/index.ts. Wire up via `registerWorkspaceAgentTools()`
 * from a higher-level bootstrap once the feature is shipped.
 *
 * Each tool returns a string (the kbot tool contract). State persists via
 * the WorkspaceAgent class — file at <root>/<id>.json.
 */

import type { ToolDefinition } from './index.js'
import {
  WorkspaceAgent,
  type Scope,
  type WorkspaceAgentOptions,
} from '../workspace-agents.js'

function getAgent(opts?: WorkspaceAgentOptions): WorkspaceAgent {
  return new WorkspaceAgent(opts ?? {})
}

function fmt(value: unknown): string {
  if (typeof value === 'string') return value
  return '```json\n' + JSON.stringify(value, null, 2) + '\n```'
}

function parseJsonArray(raw: unknown, field: string): string[] {
  if (raw === undefined || raw === null || raw === '') return []
  if (Array.isArray(raw)) return raw.map(String)
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return []
    try {
      const parsed = JSON.parse(trimmed)
      if (!Array.isArray(parsed)) {
        throw new Error(`${field} must be a JSON array`)
      }
      return parsed.map(String)
    } catch (e) {
      // accept comma-separated as a convenience
      if (!trimmed.startsWith('[')) {
        return trimmed
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)
      }
      throw e
    }
  }
  throw new Error(`${field} must be a string or array`)
}

export const workspaceAgentCreate: ToolDefinition = {
  name: 'workspace_agent_create',
  description:
    'Create a long-running named workspace agent. Persists at ~/.kbot/workspace-agents/<id>.json. ' +
    'Names must be unique per workspace. Permissions enforced via allowedTools whitelist + scopes.',
  parameters: {
    name: {
      type: 'string',
      description: 'Unique name for this agent in the workspace.',
      required: true,
    },
    mission: {
      type: 'string',
      description: '1–3 sentence mission the agent will pursue across sessions.',
      required: true,
    },
    allowedTools: {
      type: 'string',
      description:
        'JSON array (or comma-separated list) of tool names this agent may invoke. Empty = no tool calls.',
    },
    scopes: {
      type: 'string',
      description:
        'JSON array (or comma-separated list) of capability scopes, e.g. ["read:files","write:tools","invoke:slack"].',
    },
  },
  tier: 'free',
  async execute(args) {
    try {
      const allowedTools = parseJsonArray(args.allowedTools, 'allowedTools')
      const scopes = parseJsonArray(args.scopes, 'scopes') as Scope[]
      const result = await getAgent().create({
        name: String(args.name),
        mission: String(args.mission),
        allowedTools,
        scopes,
      })
      return fmt({ created: result })
    } catch (e) {
      return `Error: ${(e as Error).message}`
    }
  },
}

export const workspaceAgentStart: ToolDefinition = {
  name: 'workspace_agent_start',
  description:
    'Start a workspace agent on a task. Transitions status to "running", invokes the planner, persists tool calls into history.',
  parameters: {
    agentId: { type: 'string', description: 'Agent id from create.', required: true },
    taskInput: {
      type: 'string',
      description: 'Task prompt to plan and execute.',
      required: true,
    },
  },
  tier: 'free',
  async execute(args) {
    try {
      const result = await getAgent().start(
        String(args.agentId),
        String(args.taskInput),
      )
      return fmt({ started: result })
    } catch (e) {
      return `Error: ${(e as Error).message}`
    }
  },
}

export const workspaceAgentResume: ToolDefinition = {
  name: 'workspace_agent_resume',
  description:
    'Resume a paused or failed workspace agent. Loads state from disk and transitions to running.',
  parameters: {
    agentId: { type: 'string', description: 'Agent id.', required: true },
  },
  tier: 'free',
  async execute(args) {
    try {
      const state = await getAgent().resume(String(args.agentId))
      return fmt({
        resumed: { id: state.id, name: state.name, status: state.status },
      })
    } catch (e) {
      return `Error: ${(e as Error).message}`
    }
  },
}

export const workspaceAgentStatus: ToolDefinition = {
  name: 'workspace_agent_status',
  description: 'Get full state for a workspace agent (status, history, plan).',
  parameters: {
    agentId: { type: 'string', description: 'Agent id.', required: true },
  },
  tier: 'free',
  async execute(args) {
    try {
      const state = await getAgent().status(String(args.agentId))
      return fmt(state)
    } catch (e) {
      return `Error: ${(e as Error).message}`
    }
  },
}

export const workspaceAgentStop: ToolDefinition = {
  name: 'workspace_agent_stop',
  description: 'Stop a running workspace agent. Transitions status to "paused".',
  parameters: {
    agentId: { type: 'string', description: 'Agent id.', required: true },
  },
  tier: 'free',
  async execute(args) {
    try {
      const state = await getAgent().stop(String(args.agentId))
      return fmt({
        stopped: { id: state.id, name: state.name, status: state.status },
      })
    } catch (e) {
      return `Error: ${(e as Error).message}`
    }
  },
}

export const workspaceAgentList: ToolDefinition = {
  name: 'workspace_agent_list',
  description: 'List all workspace agents in this workspace.',
  parameters: {},
  tier: 'free',
  async execute() {
    try {
      const list = await getAgent().list()
      return fmt({ agents: list, count: list.length })
    } catch (e) {
      return `Error: ${(e as Error).message}`
    }
  },
}

/** Convenience array — caller can iterate to register all six. */
export const workspaceAgentTools: ToolDefinition[] = [
  workspaceAgentCreate,
  workspaceAgentStart,
  workspaceAgentResume,
  workspaceAgentStatus,
  workspaceAgentStop,
  workspaceAgentList,
]
