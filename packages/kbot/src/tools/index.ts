// K:BOT Tool Registry v2
// Tools are executed locally — only AI reasoning goes through the API.
// This saves tokens, messages, and latency.
//
// ENHANCEMENTS (v2.3):
//   - Tool execution timeout (default 5 min, configurable per-tool)
//   - Result size truncation (max 50KB by default)
//   - Execution metrics & timing
//   - Tier-based tool gating
//   - Parallel startup imports

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
  /** Tier required: 'free' | 'pro' | 'growth' | 'enterprise' */
  tier: 'free' | 'pro' | 'growth' | 'enterprise'
  /** Custom timeout in ms (default: 300_000 = 5 min) */
  timeout?: number
  /** Max result size in bytes (default: 50_000 = 50KB) */
  maxResultSize?: number
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
  /** Execution time in milliseconds */
  duration_ms?: number
}

/** Execution metrics per tool */
export interface ToolMetrics {
  name: string
  calls: number
  errors: number
  totalDurationMs: number
  avgDurationMs: number
  lastCalled: string
}

const registry = new Map<string, ToolDefinition>()
const metrics = new Map<string, ToolMetrics>()

const DEFAULT_TIMEOUT = 300_000    // 5 minutes
const DEFAULT_MAX_RESULT = 50_000  // 50KB

/** Tier hierarchy for gating */
const TIER_LEVELS: Record<string, number> = {
  free: 0,
  pro: 1,
  growth: 2,
  enterprise: 3,
}

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
  const userLevel = TIER_LEVELS[tier] ?? 0
  return Array.from(registry.values()).filter(t => {
    const toolLevel = TIER_LEVELS[t.tier] ?? 0
    return toolLevel <= userLevel
  })
}

/** Get tool definitions in Claude tool-use format for the API */
export function getToolDefinitionsForApi(tier: string): Array<{
  name: string
  description: string
  input_schema: { type: 'object'; properties: Record<string, unknown>; required?: string[] }
}> {
  return getToolsForTier(tier).map(t => {
    const properties: Record<string, unknown> = {}
    const required: string[] = []
    for (const [key, param] of Object.entries(t.parameters)) {
      properties[key] = { type: param.type, description: param.description }
      if (param.required) required.push(key)
    }
    return {
      name: t.name,
      description: t.description,
      input_schema: { type: 'object' as const, properties, ...(required.length > 0 ? { required } : {}) },
    }
  })
}

/** Truncate a result string to maxSize, appending a notice if truncated */
function truncateResult(result: string, maxSize: number): string {
  if (result.length <= maxSize) return result
  const truncated = result.slice(0, maxSize)
  const remaining = result.length - maxSize
  return `${truncated}\n\n[... truncated ${remaining} characters. Use more specific queries to get focused results.]`
}

/** Record metrics for a tool execution */
function recordMetrics(name: string, durationMs: number, isError: boolean): void {
  const existing = metrics.get(name)
  if (existing) {
    existing.calls++
    if (isError) existing.errors++
    existing.totalDurationMs += durationMs
    existing.avgDurationMs = existing.totalDurationMs / existing.calls
    existing.lastCalled = new Date().toISOString()
  } else {
    metrics.set(name, {
      name,
      calls: 1,
      errors: isError ? 1 : 0,
      totalDurationMs: durationMs,
      avgDurationMs: durationMs,
      lastCalled: new Date().toISOString(),
    })
  }
}

/** Get metrics for all tools or a specific tool */
export function getToolMetrics(toolName?: string): ToolMetrics[] {
  if (toolName) {
    const m = metrics.get(toolName)
    return m ? [m] : []
  }
  return Array.from(metrics.values()).sort((a, b) => b.calls - a.calls)
}

/** Execute a tool call locally with timeout and result truncation */
export async function executeTool(call: ToolCall): Promise<ToolResult> {
  const tool = registry.get(call.name)
  if (!tool) {
    return { tool_call_id: call.id, result: `Unknown tool: ${call.name}`, error: true, duration_ms: 0 }
  }

  const timeout = tool.timeout ?? DEFAULT_TIMEOUT
  const maxResult = tool.maxResultSize ?? DEFAULT_MAX_RESULT
  const startTime = Date.now()

  try {
    // Race tool execution against timeout
    const result = await Promise.race([
      tool.execute(call.arguments),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Tool '${call.name}' timed out after ${timeout / 1000}s`)), timeout)
      ),
    ])

    const durationMs = Date.now() - startTime
    const truncated = truncateResult(result, maxResult)
    recordMetrics(call.name, durationMs, false)
    return { tool_call_id: call.id, result: truncated, duration_ms: durationMs }
  } catch (err) {
    const durationMs = Date.now() - startTime
    recordMetrics(call.name, durationMs, true)
    return {
      tool_call_id: call.id,
      result: `Tool error: ${err instanceof Error ? err.message : String(err)}`,
      error: true,
      duration_ms: durationMs,
    }
  }
}

/** Register all built-in tools. Call once at startup. Uses parallel imports for speed. */
export async function registerAllTools(opts?: { computerUse?: boolean }): Promise<void> {
  // Parallel import all tool modules at once
  const [
    { registerFileTools },
    { registerBashTools },
    { registerGitTools },
    { registerSearchTools },
    { registerFetchTools },
    { registerGitHubTools },
    { registerMatrixTools },
    { registerParallelTools },
    { registerMcpClientTools },
    { registerTaskTools },
    { registerNotebookTools },
    { registerBackgroundTools },
    { registerSandboxTools },
    { registerBuildMatrixTools },
    { registerSubagentTools },
    { registerWorktreeTools },
    { registerOpenClawTools },
    { registerQualityTools },
  ] = await Promise.all([
    import('./files.js'),
    import('./bash.js'),
    import('./git.js'),
    import('./search.js'),
    import('./fetch.js'),
    import('./github.js'),
    import('./matrix.js'),
    import('./parallel.js'),
    import('./mcp-client.js'),
    import('./tasks.js'),
    import('./notebook.js'),
    import('./background.js'),
    import('./sandbox.js'),
    import('./build-matrix.js'),
    import('./subagent.js'),
    import('./worktree.js'),
    import('./openclaw.js'),
    import('./quality.js'),
  ])

  // Register all tools (synchronous, fast)
  registerFileTools()
  registerBashTools()
  registerGitTools()
  registerSearchTools()
  registerFetchTools()
  registerGitHubTools()
  registerMatrixTools()
  registerParallelTools()
  registerMcpClientTools()
  registerTaskTools()
  registerNotebookTools()
  registerBackgroundTools()
  registerSandboxTools()
  registerBuildMatrixTools()
  registerSubagentTools()
  registerWorktreeTools()
  registerOpenClawTools()
  registerQualityTools()

  // Computer use tools — opt-in only via --computer-use flag
  if (opts?.computerUse) {
    const { registerComputerTools } = await import('./computer.js')
    registerComputerTools()
  }

  // User plugins from ~/.kbot/plugins/
  const { loadPlugins } = await import('../plugins.js')
  await loadPlugins(false)
}
