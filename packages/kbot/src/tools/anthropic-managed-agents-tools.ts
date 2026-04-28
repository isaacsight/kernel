/**
 * kbot tool definitions wrapping the Anthropic Managed Agents client.
 *
 * Six tools mirror the client surface: create / turn / list / close /
 * memory_read / memory_write. Each uses the canonical ToolDefinition shape
 * from ./index.js.
 *
 * Wiring into the global tool registry happens elsewhere (tools/index.ts).
 * This file only exports the definitions so workspace-agents.ts can pick
 * them up when ANTHROPIC_API_KEY is set.
 *
 * SPEC: best-effort, refine when official docs published.
 */

import { AnthropicManagedAgentsClient } from '../managed-agents-anthropic.js'
import type { ToolDefinition } from './index.js'

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

function getClient(): AnthropicManagedAgentsClient {
  // Construct fresh per call so callers can rotate API keys without
  // restarting the process. The constructor cost is trivial (just a string
  // copy and a fetch reference).
  return new AnthropicManagedAgentsClient()
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined
}

function asStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined
  const out: string[] = []
  for (const item of v) {
    if (typeof item === 'string') out.push(item)
  }
  return out
}

async function safeRun<T>(fn: () => Promise<T>): Promise<string> {
  try {
    const result = await fn()
    return JSON.stringify(result, null, 2)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return `Error: ${message}`
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Tools
// ─────────────────────────────────────────────────────────────────────────

export const anthropicManagedAgentCreate: ToolDefinition = {
  name: 'anthropic_managed_agent_create',
  description:
    'Create a hosted Anthropic Managed Agent session. Returns session_id. Requires ANTHROPIC_API_KEY. Sends anthropic-beta: managed-agents-2026-04-01.',
  tier: 'pro',
  parameters: {
    mission: {
      type: 'string',
      description: 'The agent\'s long-horizon goal / mission statement.',
      required: true,
    },
    allowed_tools: {
      type: 'array',
      description: 'Optional list of tool names the hosted agent may invoke.',
      items: { type: 'string' },
    },
    model: {
      type: 'string',
      description: 'Optional model override (e.g., "claude-sonnet-4-7").',
    },
  },
  async execute(args) {
    return safeRun(async () => {
      const mission = asString(args.mission) ?? ''
      const allowedTools = asStringArray(args.allowed_tools)
      const model = asString(args.model)
      return getClient().createSession({ mission, allowedTools, model })
    })
  },
}

export const anthropicManagedAgentTurn: ToolDefinition = {
  name: 'anthropic_managed_agent_turn',
  description:
    'Send a turn (user input) to an Anthropic Managed Agent session. Returns the agent output and any tool calls.',
  tier: 'pro',
  parameters: {
    session_id: {
      type: 'string',
      description: 'Session id returned by anthropic_managed_agent_create.',
      required: true,
    },
    input: {
      type: 'string',
      description: 'The user-side input for this turn.',
      required: true,
    },
  },
  async execute(args) {
    return safeRun(async () => {
      const sessionId = asString(args.session_id) ?? ''
      const input = asString(args.input) ?? ''
      return getClient().sendTurn({ sessionId, input })
    })
  },
}

export const anthropicManagedAgentList: ToolDefinition = {
  name: 'anthropic_managed_agent_list',
  description:
    'List all hosted Anthropic Managed Agent sessions for the configured API key.',
  tier: 'pro',
  parameters: {},
  async execute() {
    return safeRun(async () => getClient().listSessions())
  },
}

export const anthropicManagedAgentClose: ToolDefinition = {
  name: 'anthropic_managed_agent_close',
  description:
    'Close (DELETE) a hosted Anthropic Managed Agent session.',
  tier: 'pro',
  parameters: {
    session_id: {
      type: 'string',
      description: 'Session id to close.',
      required: true,
    },
  },
  async execute(args) {
    return safeRun(async () => {
      const sessionId = asString(args.session_id) ?? ''
      return getClient().closeSession({ sessionId })
    })
  },
}

export const anthropicManagedAgentMemoryRead: ToolDefinition = {
  name: 'anthropic_managed_agent_memory_read',
  description:
    'Read a memory value from a hosted Anthropic Managed Agent session. Pass key to read a single entry; omit key for the full memory.',
  tier: 'pro',
  parameters: {
    session_id: {
      type: 'string',
      description: 'Session id.',
      required: true,
    },
    key: {
      type: 'string',
      description: 'Optional memory key. If omitted, returns the full memory.',
    },
  },
  async execute(args) {
    return safeRun(async () => {
      const sessionId = asString(args.session_id) ?? ''
      const key = asString(args.key)
      return getClient().memoryRead({ sessionId, key })
    })
  },
}

export const anthropicManagedAgentMemoryWrite: ToolDefinition = {
  name: 'anthropic_managed_agent_memory_write',
  description:
    'Write a memory value to a hosted Anthropic Managed Agent session.',
  tier: 'pro',
  parameters: {
    session_id: {
      type: 'string',
      description: 'Session id.',
      required: true,
    },
    key: {
      type: 'string',
      description: 'Memory key to write.',
      required: true,
    },
    value: {
      type: 'string',
      description:
        'Value to store. Strings are stored as-is; if the value is a JSON string it is forwarded verbatim.',
      required: true,
    },
  },
  async execute(args) {
    return safeRun(async () => {
      const sessionId = asString(args.session_id) ?? ''
      const key = asString(args.key) ?? ''
      const value = args.value
      return getClient().memoryWrite({ sessionId, key, value })
    })
  },
}

export const anthropicManagedAgentTools: ToolDefinition[] = [
  anthropicManagedAgentCreate,
  anthropicManagedAgentTurn,
  anthropicManagedAgentList,
  anthropicManagedAgentClose,
  anthropicManagedAgentMemoryRead,
  anthropicManagedAgentMemoryWrite,
]
