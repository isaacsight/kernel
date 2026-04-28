// Tools landed via the 2026-04 capability swarm — parity with OpenClaw +
// ChatGPT/Codex April 2026 ships. Single registration entry-point so the
// lazy registry picks them up alongside everything else.

import { registerTool, type ToolDefinition } from './index.js'
import { imageThoughtfulTool } from './image-thoughtful.js'
import { lladaImageTool } from './llada-image.js'
import { channelSendTool, channelReceiveTool } from './channel-tools.js'
import {
  fileLibraryAddTool,
  fileLibraryListTool,
  fileLibrarySearchTool,
  fileLibraryGetTool,
} from './file-library-tools.js'
import { workspaceAgentTools } from './workspace-agent-tools.js'
import { computerCoordinatorTools } from './computer-coordinator-tools.js'
import { SECURITY_AGENT_TOOLS } from './security-agent-tools.js'
import { anthropicManagedAgentTools } from './anthropic-managed-agents-tools.js'
import type { z } from 'zod'

interface CoordinatorToolShape {
  name: string
  description: string
  inputSchema: { type?: string; required?: string[]; properties?: Record<string, { type?: string; description?: string; items?: Record<string, unknown> }> }
  handler: (args: Record<string, unknown>) => Promise<unknown> | unknown
}

function adaptCoordinatorTool(t: CoordinatorToolShape): ToolDefinition {
  const props = t.inputSchema.properties ?? {}
  const required = new Set<string>(t.inputSchema.required ?? [])
  const parameters: ToolDefinition['parameters'] = {}
  for (const [key, val] of Object.entries(props)) {
    parameters[key] = {
      type: val.type ?? 'string',
      description: val.description ?? '',
      required: required.has(key),
      ...(val.items ? { items: val.items } : {}),
    }
  }
  return {
    name: t.name,
    description: t.description,
    parameters,
    execute: async (args) => {
      try {
        const res = await t.handler(args)
        return typeof res === 'string' ? res : JSON.stringify(res, null, 2)
      } catch (e) {
        return `Error: ${(e as Error).message}`
      }
    },
    tier: 'free',
  }
}

interface SecurityToolShape {
  name: string
  description: string
  schema: z.ZodTypeAny
  run: (args: unknown) => Promise<unknown>
}

function adaptSecurityTool(t: SecurityToolShape): ToolDefinition {
  // zod object shape extraction — best-effort parameter map for the API surface
  const shape =
    (t.schema as unknown as { _def?: { shape?: () => Record<string, z.ZodTypeAny> } })._def?.shape?.() ??
    (t.schema as unknown as { shape?: Record<string, z.ZodTypeAny> }).shape ??
    {}
  const parameters: ToolDefinition['parameters'] = {}
  for (const [key, zodType] of Object.entries(shape)) {
    const optional = typeof (zodType as { isOptional?: () => boolean }).isOptional === 'function'
      ? (zodType as { isOptional: () => boolean }).isOptional()
      : false
    parameters[key] = {
      type: 'string',
      description: (zodType as { description?: string }).description ?? '',
      required: !optional,
    }
  }
  return {
    name: t.name,
    description: t.description,
    parameters,
    execute: async (args) => {
      try {
        const parsed = t.schema.parse(args)
        const res = await t.run(parsed)
        return typeof res === 'string' ? res : JSON.stringify(res, null, 2)
      } catch (e) {
        return `Error: ${(e as Error).message}`
      }
    },
    tier: 'free',
  }
}

export function registerSwarm2026Tools(): void {
  registerTool(imageThoughtfulTool)
  registerTool(lladaImageTool)
  registerTool(channelSendTool)
  registerTool(channelReceiveTool)
  registerTool(fileLibraryAddTool)
  registerTool(fileLibraryListTool)
  registerTool(fileLibrarySearchTool)
  registerTool(fileLibraryGetTool)
  for (const t of workspaceAgentTools) registerTool(t)
  for (const t of anthropicManagedAgentTools) registerTool(t)
  for (const t of computerCoordinatorTools) registerTool(adaptCoordinatorTool(t))
  for (const t of SECURITY_AGENT_TOOLS) {
    registerTool(adaptSecurityTool(t as unknown as SecurityToolShape))
  }
}
