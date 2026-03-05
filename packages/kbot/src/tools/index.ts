// K:BOT Tool Registry
// Tools are executed locally — only AI reasoning goes through the API.
// This saves tokens, messages, and latency.

export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, {
    type: string
    description: string
    required?: boolean
    default?: unknown
  }>
  execute: (args: Record<string, unknown>) => Promise<string>
  /** Tier required: 'free' | 'starter' | 'growth' | 'enterprise' */
  tier: 'free' | 'starter' | 'growth' | 'enterprise'
}

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

export interface ToolResult {
  tool_call_id: string
  result: string
  error?: boolean
}

const registry = new Map<string, ToolDefinition>()

export function registerTool(tool: ToolDefinition): void {
  registry.set(tool.name, tool)
}

export function getTool(name: string): ToolDefinition | undefined {
  return registry.get(name)
}

export function getAllTools(): ToolDefinition[] {
  return Array.from(registry.values())
}

export function getToolsForTier(tier: string): ToolDefinition[] {
  const tierOrder = ['free', 'starter', 'growth', 'enterprise']
  const tierIndex = tierOrder.indexOf(tier)
  if (tierIndex === -1) return getAllTools()
  return getAllTools().filter(t => tierOrder.indexOf(t.tier) <= tierIndex)
}

/** Get tool definitions in Claude tool-use format for the API */
export function getToolDefinitionsForApi(tier: string): Array<{ name: string; description: string }> {
  return getToolsForTier(tier).map(t => ({
    name: t.name,
    description: t.description,
  }))
}

/** Execute a tool call locally. Returns the result string. */
export async function executeTool(call: ToolCall): Promise<ToolResult> {
  const tool = registry.get(call.name)
  if (!tool) {
    return { tool_call_id: call.id, result: `Unknown tool: ${call.name}`, error: true }
  }

  try {
    const result = await tool.execute(call.arguments)
    return { tool_call_id: call.id, result }
  } catch (err) {
    return {
      tool_call_id: call.id,
      result: `Tool error: ${err instanceof Error ? err.message : String(err)}`,
      error: true,
    }
  }
}

/** Register all built-in tools. Call once at startup. */
export async function registerAllTools(): Promise<void> {
  const { registerFileTools } = await import('./files.js')
  const { registerBashTools } = await import('./bash.js')
  const { registerGitTools } = await import('./git.js')
  const { registerSearchTools } = await import('./search.js')
  registerFileTools()
  registerBashTools()
  registerGitTools()
  registerSearchTools()
}
