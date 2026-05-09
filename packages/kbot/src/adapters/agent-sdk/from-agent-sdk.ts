// Anthropic Agent SDK tool → kbot ToolDefinition
//
// Lets a kbot host import third-party Agent SDK tools (or hand-written
// schema/handler pairs) and register them in the kbot tool registry. Schema
// is downconverted from JSON Schema to kbot's flatter parameter shape.
//
// Inverse of to-agent-sdk.ts. Round-trip is lossy in general (JSON Schema is
// strictly richer than kbot's shape), but is stable for the param shapes
// that kbot itself uses.

import type { ToolDefinition } from '../../tools/index.js'
import type {
  AgentSdkExecutableTool,
  AgentSdkInputSchema,
  AgentSdkTool,
  JsonSchemaProperty,
} from './types.js'

const JSON_TO_KBOT: Record<string, string> = {
  string: 'string',
  number: 'number',
  integer: 'integer',
  boolean: 'boolean',
  object: 'object',
  array: 'array',
  null: 'null',
}

function pickType(t: JsonSchemaProperty['type']): string {
  if (typeof t === 'string') return JSON_TO_KBOT[t] ?? 'string'
  if (Array.isArray(t)) {
    // Pick the first non-null type to keep parity with kbot's single-type shape.
    const first = t.find((x) => x !== 'null')
    return first ? JSON_TO_KBOT[first] ?? 'string' : 'string'
  }
  return 'string'
}

function mapProperty(p: JsonSchemaProperty, required: boolean): ToolDefinition['parameters'][string] {
  const out: ToolDefinition['parameters'][string] = {
    type: pickType(p.type),
    description: typeof p.description === 'string' ? p.description : '',
    required,
  }
  if (p.default !== undefined) out.default = p.default
  if (p.items !== undefined) out.items = p.items as Record<string, unknown>
  if (p.properties) out.properties = p.properties as Record<string, unknown>
  return out
}

function buildParameters(schema: AgentSdkInputSchema | undefined): ToolDefinition['parameters'] {
  if (!schema || typeof schema !== 'object') return {}
  const required = new Set<string>(schema.required ?? [])
  const out: ToolDefinition['parameters'] = {}
  for (const [name, prop] of Object.entries(schema.properties ?? {})) {
    out[name] = mapProperty(prop, required.has(name))
  }
  return out
}

export interface FromAgentSdkOptions {
  /** kbot tier to assign to the imported tool. Default 'free'. */
  tier?: ToolDefinition['tier']
  /** Custom timeout (ms). */
  timeout?: number
  /** Max result size (bytes). */
  maxResultSize?: number
  /**
   * Fallback executor when the source tool ships no handler. Useful when the
   * caller routes execution elsewhere (e.g., back through the Anthropic SDK).
   */
  fallbackExecutor?: (toolName: string, args: Record<string, unknown>) => Promise<string> | string
}

/**
 * Convert a non-executable Agent SDK tool definition into a kbot ToolDefinition.
 * Because the source has no handler, an executor must be supplied via opts.fallbackExecutor
 * — otherwise the resulting tool will return a structured "no handler" error string when invoked.
 */
export function fromAgentSdkTool(tool: AgentSdkTool, opts: FromAgentSdkOptions = {}): ToolDefinition {
  const fallback = opts.fallbackExecutor
  return {
    name: tool.name,
    description: tool.description,
    parameters: buildParameters(tool.input_schema),
    tier: opts.tier ?? 'free',
    timeout: opts.timeout,
    maxResultSize: opts.maxResultSize,
    async execute(args) {
      if (fallback) {
        try {
          const result = await fallback(tool.name, args)
          return typeof result === 'string' ? result : JSON.stringify(result, null, 2)
        } catch (e) {
          return `Error: ${(e as Error).message}`
        }
      }
      return `Error: tool "${tool.name}" was imported without a handler. Provide opts.fallbackExecutor when calling fromAgentSdkTool().`
    },
  }
}

/**
 * Convert an executable Agent SDK tool (schema + handler) into a kbot ToolDefinition.
 * Preferred over fromAgentSdkTool() when the caller has the implementation in process.
 */
export function fromAgentSdkExecutableTool(
  tool: AgentSdkExecutableTool,
  opts: Omit<FromAgentSdkOptions, 'fallbackExecutor'> = {},
): ToolDefinition {
  return {
    name: tool.name,
    description: tool.description,
    parameters: buildParameters(tool.input_schema),
    tier: opts.tier ?? 'free',
    timeout: opts.timeout,
    maxResultSize: opts.maxResultSize,
    async execute(args) {
      try {
        const result = await tool.handler(args)
        return typeof result === 'string' ? result : JSON.stringify(result, null, 2)
      } catch (e) {
        return `Error: ${(e as Error).message}`
      }
    },
  }
}

export function fromAgentSdkTools(
  tools: AgentSdkTool[],
  opts: FromAgentSdkOptions = {},
): ToolDefinition[] {
  return tools.map((t) => fromAgentSdkTool(t, opts))
}
