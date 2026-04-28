// Tool definitions for the Computer-Use Coordinator.
//
// NOT registered here — wiring lives in computer.ts (or wherever the
// `--computer-use` flag is interpreted). Exporting plain definitions
// keeps this file pure and testable.

import { Coordinator } from '../computer-use-coordinator.js'

let shared: Coordinator | null = null
function instance(): Coordinator {
  if (!shared) shared = new Coordinator()
  return shared
}

export interface ToolDef {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  handler: (args: Record<string, unknown>) => Promise<unknown> | unknown
}

function asString(v: unknown, field: string): string {
  if (typeof v !== 'string' || !v) throw new Error(`${field} must be a non-empty string`)
  return v
}

function asStringArray(v: unknown, field: string): string[] {
  if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) {
    throw new Error(`${field} must be a string[]`)
  }
  return v as string[]
}

export const computerCoordinatorRegister: ToolDef = {
  name: 'computer_coordinator_register',
  description: 'Register an agent with the parallel computer-use coordinator. Declares which apps it intends to drive.',
  inputSchema: {
    type: 'object',
    required: ['agentId', 'apps'],
    properties: {
      agentId: { type: 'string' },
      apps: { type: 'array', items: { type: 'string' } },
      windowIds: { type: 'array', items: { type: 'string' } },
    },
  },
  handler: (args) => {
    const agentId = asString(args.agentId, 'agentId')
    const apps = asStringArray(args.apps, 'apps')
    const windowIds = args.windowIds === undefined ? undefined : asStringArray(args.windowIds, 'windowIds')
    instance().register(agentId, { apps, windowIds })
    return { ok: true, agentId, apps, windowIds: windowIds ?? [] }
  },
}

export const computerCoordinatorClaim: ToolDef = {
  name: 'computer_coordinator_claim',
  description: 'Claim exclusive control of one app for an agent. Denied if another live agent already holds it.',
  inputSchema: {
    type: 'object',
    required: ['agentId', 'app'],
    properties: {
      agentId: { type: 'string' },
      app: { type: 'string' },
    },
  },
  handler: (args) => {
    const agentId = asString(args.agentId, 'agentId')
    const app = asString(args.app, 'app')
    return instance().claim(agentId, app)
  },
}

export const computerCoordinatorRelease: ToolDef = {
  name: 'computer_coordinator_release',
  description: 'Release a previously claimed app so another agent can take it.',
  inputSchema: {
    type: 'object',
    required: ['agentId', 'app'],
    properties: {
      agentId: { type: 'string' },
      app: { type: 'string' },
    },
  },
  handler: (args) => {
    const agentId = asString(args.agentId, 'agentId')
    const app = asString(args.app, 'app')
    return { released: instance().release(agentId, app) }
  },
}

export const computerCoordinatorStatus: ToolDef = {
  name: 'computer_coordinator_status',
  description: 'List all registered agents and which apps they currently hold.',
  inputSchema: { type: 'object', properties: {} },
  handler: () => instance().status(),
}

export const computerCoordinatorUnregister: ToolDef = {
  name: 'computer_coordinator_unregister',
  description: 'Unregister an agent and release every claim it owns.',
  inputSchema: {
    type: 'object',
    required: ['agentId'],
    properties: { agentId: { type: 'string' } },
  },
  handler: (args) => {
    const agentId = asString(args.agentId, 'agentId')
    return { released: instance().unregister(agentId) }
  },
}

export const computerCoordinatorTools: ToolDef[] = [
  computerCoordinatorRegister,
  computerCoordinatorClaim,
  computerCoordinatorRelease,
  computerCoordinatorStatus,
  computerCoordinatorUnregister,
]
