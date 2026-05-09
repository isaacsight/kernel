// kbot ToolDefinition → Anthropic Agent SDK tool
//
// One-way schema translation. The Agent SDK delivers tool_use blocks and
// expects the host to route them to a handler — that routing belongs in the
// caller's agent loop, not in the adapter. This file only produces the
// schema half so kbot tools can be advertised to the Agent SDK / Messages
// API without taking a runtime dependency on @anthropic-ai/sdk.

import type { ToolDefinition } from '../../tools/index.js'
import type {
  AgentSdkInputSchema,
  AgentSdkTool,
  JsonSchemaProperty,
  JsonSchemaType,
} from './types.js'

const KBOT_TYPE_TO_JSON: Record<string, JsonSchemaType> = {
  string: 'string',
  number: 'number',
  integer: 'integer',
  boolean: 'boolean',
  object: 'object',
  array: 'array',
  null: 'null',
}

function mapType(t: string): JsonSchemaType {
  const lc = t.toLowerCase()
  return KBOT_TYPE_TO_JSON[lc] ?? 'string'
}

function mapParameter(p: ToolDefinition['parameters'][string]): JsonSchemaProperty {
  const out: JsonSchemaProperty = {
    type: mapType(p.type),
    description: p.description,
  }
  if (p.default !== undefined) out.default = p.default
  if (p.items) out.items = p.items as JsonSchemaProperty
  if (p.properties) {
    const nested: Record<string, JsonSchemaProperty> = {}
    for (const [k, v] of Object.entries(p.properties)) {
      // Best-effort: nested properties in kbot params are loosely typed.
      const vv = v as { type?: string; description?: string }
      nested[k] = {
        type: vv.type ? mapType(vv.type) : 'string',
        description: vv.description ?? '',
      }
    }
    out.properties = nested
  }
  return out
}

export interface ToAgentSdkOptions {
  /** If true (default), kbot tool names are passed through unchanged. */
  preserveName?: boolean
  /** Optional rename hook. Wins over preserveName. */
  renameTool?: (name: string) => string
  /** If true, pass `additionalProperties: false` on the input schema. Default true. */
  strict?: boolean
}

export function toAgentSdkTool(tool: ToolDefinition, opts: ToAgentSdkOptions = {}): AgentSdkTool {
  const properties: Record<string, JsonSchemaProperty> = {}
  const required: string[] = []
  for (const [name, param] of Object.entries(tool.parameters)) {
    properties[name] = mapParameter(param)
    if (param.required) required.push(name)
  }
  const input_schema: AgentSdkInputSchema = {
    type: 'object',
    properties,
    additionalProperties: opts.strict === false ? true : false,
  }
  if (required.length > 0) input_schema.required = required

  const name = opts.renameTool
    ? opts.renameTool(tool.name)
    : opts.preserveName === false
      ? tool.name.replace(/[^A-Za-z0-9_-]/g, '_')
      : tool.name

  return {
    name,
    description: tool.description,
    input_schema,
  }
}

export function toAgentSdkTools(
  tools: ToolDefinition[],
  opts: ToAgentSdkOptions = {},
): AgentSdkTool[] {
  return tools.map((t) => toAgentSdkTool(t, opts))
}
