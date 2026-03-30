// kbot Tool Registry v2
// Tools are executed locally — only AI reasoning goes through the API.
// This saves tokens, messages, and latency.
//
// ENHANCEMENTS (v2.3):
//   - Tool execution timeout (default 5 min, configurable per-tool)
//   - Result size truncation (max 50KB by default)
//   - Execution metrics & timing
//   - Tier-based tool gating
//   - Parallel startup imports
//   - Composable middleware pipeline (v3)

// Re-export the middleware pipeline system
export {
  ToolPipeline,
  createDefaultPipeline,
  permissionMiddleware,
  hookMiddleware,
  timeoutMiddleware,
  metricsMiddleware,
  truncationMiddleware,
  telemetryMiddleware,
  executionMiddleware,
  fallbackMiddleware,
  mcpAppsMiddleware,
  DEFAULT_FALLBACK_RULES,
  type ToolMiddleware,
  type ToolContext,
  type NextFunction,
  type FallbackRule,
} from '../tool-pipeline.js'

import { ToolPipeline, executionMiddleware, mcpAppsMiddleware, type ToolMiddleware } from '../tool-pipeline.js'

export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, {
    type: string
    description: string
    required?: boolean
    default?: unknown
    items?: Record<string, unknown>
    properties?: Record<string, unknown>
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
      const prop: Record<string, unknown> = { type: param.type, description: param.description }
      // OpenAI requires 'items' for array types
      if (param.type === 'array') {
        prop.items = (param as Record<string, unknown>).items || { type: 'string' }
      }
      // OpenAI requires 'properties' for object types
      if (param.type === 'object') {
        prop.properties = (param as Record<string, unknown>).properties || {}
        prop.additionalProperties = true
      }
      properties[key] = prop
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
    // Smart error: guide the AI toward discovering and installing the tool via MCP
    const suggestion = `Unknown tool: ${call.name}. ` +
      `This tool is not currently registered, but you can discover and install it:\n` +
      `1. Use mcp_search to find an MCP server that provides "${call.name}"\n` +
      `2. Use mcp_install to install the server\n` +
      `3. Use mcp_connect to connect to the server\n` +
      `4. Use mcp_call to invoke the tool through the connected server\n` +
      `If no MCP server exists, consider using forge_tool to create it at runtime.`
    return { tool_call_id: call.id, result: suggestion, error: true, duration_ms: 0 }
  }

  const timeout = tool.timeout ?? DEFAULT_TIMEOUT
  const maxResult = tool.maxResultSize ?? DEFAULT_MAX_RESULT
  const startTime = Date.now()

  try {
    // Execute tool with AbortController-based timeout (prevents leaked promises)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)
    try {
      const result = await Promise.race([
        tool.execute(call.arguments),
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener('abort', () =>
            reject(new Error(`Tool '${call.name}' timed out after ${timeout / 1000}s`))
          )
        }),
      ])

      clearTimeout(timer)
      const durationMs = Date.now() - startTime
      const truncated = truncateResult(result, maxResult)
      recordMetrics(call.name, durationMs, false)
      return { tool_call_id: call.id, result: truncated, duration_ms: durationMs }
    } finally {
      clearTimeout(timer)
    }
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

/**
 * Create a ToolPipeline with the built-in executeTool as the execution step.
 * Custom middleware runs before execution; execution is always last.
 */
export function createToolPipeline(options?: { middleware?: ToolMiddleware[] }): ToolPipeline {
  const pipeline = new ToolPipeline()
  // Add any custom middleware first
  if (options?.middleware) {
    for (const mw of options.middleware) pipeline.use(mw)
  }
  // Add execution as last step
  pipeline.use(executionMiddleware(async (name, args) => {
    const result = await executeTool({ id: name, name, arguments: args })
    return { result: result.result, error: result.error ? result.result : undefined }
  }))
  return pipeline
}

// ---------------------------------------------------------------------------
// Lazy Tool Loading (v3)
//
// Core tools (~10 tools from 5 modules) load at startup for instant use.
// Lazy tools (~236 tools from 41 modules) load on first use or in background.
// This cuts startup time from ~1-2s to ~200ms for one-shot commands.
//
// Lite mode (Replit / --lite): skips heavy modules (Docker, browser, local
// models, GPU tools) to stay within cloud IDE resource limits.
// ---------------------------------------------------------------------------

import { isReplit, LITE_SKIP_MODULES } from '../replit.js'

/** Whether lite mode is active (auto-detected on Replit, or set via --lite) */
let liteMode = false

/** Enable lite mode (called from CLI when --lite is passed or Replit detected) */
export function setLiteMode(enabled: boolean): void {
  liteMode = enabled
}

/** Check if lite mode is active */
export function isLiteMode(): boolean {
  return liteMode
}

/** Core tool modules — always loaded at startup (~200ms, covers 80%+ of one-shot use) */
const CORE_MODULE_IMPORTS: Array<{ path: string; registerFn: string }> = [
  { path: './files.js',  registerFn: 'registerFileTools' },
  { path: './bash.js',   registerFn: 'registerBashTools' },
  { path: './git.js',    registerFn: 'registerGitTools' },
  { path: './search.js', registerFn: 'registerSearchTools' },
  { path: './fetch.js',  registerFn: 'registerFetchTools' },
]

/** Lazy tool modules — loaded on demand or in background */
const LAZY_MODULE_IMPORTS: Array<{ path: string; registerFn: string }> = [
  { path: './github.js',          registerFn: 'registerGitHubTools' },
  { path: './matrix.js',          registerFn: 'registerMatrixTools' },
  { path: './parallel.js',        registerFn: 'registerParallelTools' },
  { path: './mcp-client.js',      registerFn: 'registerMcpClientTools' },
  { path: './tasks.js',           registerFn: 'registerTaskTools' },
  { path: './notebook.js',        registerFn: 'registerNotebookTools' },
  { path: './background.js',      registerFn: 'registerBackgroundTools' },
  { path: './sandbox.js',         registerFn: 'registerSandboxTools' },
  { path: './build-matrix.js',    registerFn: 'registerBuildMatrixTools' },
  { path: './subagent.js',        registerFn: 'registerSubagentTools' },
  { path: './worktree.js',        registerFn: 'registerWorktreeTools' },
  { path: './kbot-local.js',      registerFn: 'registerKbotLocalTools' },
  { path: './quality.js',         registerFn: 'registerQualityTools' },
  { path: './memory-tools.js',    registerFn: 'registerMemoryTools' },
  { path: './browser.js',         registerFn: 'registerBrowserTools' },
  { path: './e2b-sandbox.js',     registerFn: 'registerE2bTools' },
  { path: './lsp-tools.js',       registerFn: 'registerLspTools' },
  { path: '../mcp-plugins.js',    registerFn: 'registerMcpPluginTools' },
  { path: '../graph-memory.js',   registerFn: 'registerGraphMemoryTools' },
  { path: '../confidence.js',     registerFn: 'registerConfidenceTools' },
  { path: '../agent-protocol.js', registerFn: 'registerAgentProtocolTools' },
  { path: '../temporal.js',       registerFn: 'registerTemporalTools' },
  { path: '../reasoning.js',      registerFn: 'registerReasoningTools' },
  { path: '../intentionality.js', registerFn: 'registerIntentionalityTools' },
  { path: './test-runner.js',     registerFn: 'registerTestRunnerTools' },
  { path: './creative.js',        registerFn: 'registerCreativeTools' },
  { path: './comfyui-plugin.js',  registerFn: 'registerComfyUITools' },
  { path: './magenta-plugin.js',  registerFn: 'registerMagentaTools' },
  { path: './research.js',        registerFn: 'registerResearchTools' },
  { path: './containers.js',      registerFn: 'registerContainerTools' },
  { path: './vfx.js',             registerFn: 'registerVfxTools' },
  { path: './gamedev.js',          registerFn: 'registerGamedevTools' },
  { path: './audit.js',           registerFn: 'registerAuditTools' },
  { path: './documents.js',       registerFn: 'registerDocumentTools' },
  { path: './contribute.js',      registerFn: 'registerContributeTools' },
  { path: './composio.js',        registerFn: 'registerComposioTools' },
  { path: '../marketplace.js',    registerFn: 'registerMarketplaceTools' },
  { path: './browser-agent.js',   registerFn: 'registerBrowserAgentTools' },
  { path: '../workflows.js',      registerFn: 'registerWorkflowTools' },
  { path: './deploy.js',          registerFn: 'registerDeployTools' },
  { path: './mcp-marketplace.js', registerFn: 'registerMcpMarketplaceTools' },
  { path: './database.js',        registerFn: 'registerDatabaseTools' },
  { path: '../team.js',           registerFn: 'registerTeamTools' },
  { path: '../plugin-sdk.js',     registerFn: 'registerPluginSDKTools' },
  { path: './training.js',        registerFn: 'registerTrainingTools' },
  { path: './social.js',          registerFn: 'registerSocialTools' },
  { path: './forge.js',           registerFn: 'registerForgeTools' },
  { path: '../mcp-apps.js',       registerFn: 'registerMcpAppTools' },
  { path: './machine-tools.js',  registerFn: 'registerMachineTools' },
  { path: './finance.js',        registerFn: 'registerFinanceTools' },
  { path: './wallet.js',         registerFn: 'registerWalletTools' },
  { path: './stocks.js',         registerFn: 'registerStockTools' },
  { path: './sentiment.js',      registerFn: 'registerSentimentTools' },
  { path: './security.js',       registerFn: 'registerSecurityTools' },
  { path: './email.js',          registerFn: 'registerEmailTools' },
  { path: './content-engine.js', registerFn: 'registerContentEngineTools' },
  { path: './bootstrapper.js',   registerFn: 'registerBootstrapperTools' },
  { path: './lab-core.js',       registerFn: 'registerLabCoreTools' },
  { path: './lab-data.js',       registerFn: 'registerLabDataTools' },
  { path: './lab-bio.js',        registerFn: 'registerLabBioTools' },
  { path: './lab-chem.js',       registerFn: 'registerLabChemTools' },
  { path: './lab-physics.js',    registerFn: 'registerLabPhysicsTools' },
  { path: './lab-earth.js',      registerFn: 'registerLabEarthTools' },
  { path: './lab-math.js',       registerFn: 'registerLabMathTools' },
  { path: './lab-neuro.js',      registerFn: 'registerLabNeuroTools' },
  { path: './lab-social.js',    registerFn: 'registerLabSocialTools' },
  { path: './lab-humanities.js', registerFn: 'registerLabHumanitiesTools' },
  { path: './lab-health.js',    registerFn: 'registerLabHealthTools' },
  { path: './science-graph.js', registerFn: 'registerScienceGraphTools' },
  { path: './research-pipeline.js', registerFn: 'registerResearchPipelineTools' },
  { path: './research-notebook.js', registerFn: 'registerResearchNotebookTools' },
  { path: './hypothesis-engine.js', registerFn: 'registerHypothesisEngineTools' },
  { path: './emergent.js',          registerFn: 'registerEmergentTools' },
  { path: './security-hunt.js',     registerFn: 'registerSecurityHuntTools' },
  { path: './lab-frontier.js',     registerFn: 'registerFrontierTools' },
  { path: './ableton.js',          registerFn: 'registerAbletonTools' },
  { path: './ableton-knowledge.js', registerFn: 'registerAbletonKnowledgeTools' },
  { path: './producer-engine.js',  registerFn: 'registerProducerEngine' },
  { path: './sound-designer.js',  registerFn: 'registerSoundDesignerTools' },
  { path: './arrangement-engine.js', registerFn: 'registerArrangementEngine' },
  { path: '../behaviour.js',        registerFn: 'registerBehaviourTools' },
  { path: '../skill-system.js',    registerFn: 'registerSkillTools' },
  { path: './admin.js',            registerFn: 'registerAdminTools' },
  { path: './monitor.js',          registerFn: 'registerMonitorTools' },
  { path: './deploy-all.js',       registerFn: 'registerDeployAllTools' },
  { path: './analytics.js',        registerFn: 'registerAnalyticsTools' },
  { path: './env-manager.js',      registerFn: 'registerEnvTools' },
  { path: './db-admin.js',         registerFn: 'registerDbAdminTools' },
  { path: './visa-payments.js',    registerFn: 'registerVisaPaymentTools' },
  { path: './security-brain.js',   registerFn: 'registerSecurityBrainTools' },
  { path: './ctf.js',              registerFn: 'registerCtfTools' },
  { path: './pentest.js',          registerFn: 'registerPentestTools' },
  { path: './redblue.js',          registerFn: 'registerRedBlueTools' },
  { path: './hacker-toolkit.js',   registerFn: 'registerHackerToolkitTools' },
]

/** Track whether lazy tools have been registered */
let lazyToolsRegistered = false
let lazyToolsPromise: Promise<number> | null = null

/** Import a module and call its register function. Returns tool count or 0 on failure. */
async function importAndRegister(mod: { path: string; registerFn: string }): Promise<number> {
  try {
    const imported = await import(mod.path)
    const registerFn = imported[mod.registerFn]
    if (typeof registerFn === 'function') {
      const before = registry.size
      registerFn()
      return registry.size - before
    }
    return 0
  } catch {
    // Module may have optional deps — skip silently
    return 0
  }
}

/**
 * Register core tools only (~5 modules, ~10 tools, ~200ms).
 * Covers file ops, bash, git, search, and fetch — enough for 80%+ of one-shot commands.
 * Returns the number of tools registered.
 */
export async function registerCoreTools(opts?: { computerUse?: boolean }): Promise<number> {
  const counts = await Promise.all(CORE_MODULE_IMPORTS.map(importAndRegister))
  return counts.reduce((sum, n) => sum + n, 0)
}

/**
 * Register lazy (non-core) tools (~41 modules, ~236 tools).
 * Call in background for one-shot mode, or await for REPL/serve mode.
 * Returns the number of tools registered.
 */
export async function registerLazyTools(opts?: { computerUse?: boolean }): Promise<number> {
  if (lazyToolsRegistered) return 0

  // In lite mode, filter out heavy modules (Docker, browser, local models, GPU)
  const modules = (liteMode || isReplit())
    ? LAZY_MODULE_IMPORTS.filter(m => !LITE_SKIP_MODULES.has(m.path))
    : LAZY_MODULE_IMPORTS

  const counts = await Promise.all(modules.map(importAndRegister))
  const total = counts.reduce((sum, n) => sum + n, 0)

  // Computer use tools — opt-in only via --computer-use flag
  if (opts?.computerUse) {
    try {
      const { registerComputerTools } = await import('./computer.js')
      registerComputerTools()
    } catch { /* optional */ }
  }

  // User plugins from ~/.kbot/plugins/
  try {
    const { loadPlugins } = await import('../plugins.js')
    await loadPlugins(false)
  } catch { /* optional */ }

  lazyToolsRegistered = true
  return total
}

/**
 * Ensure lazy tools are registered (idempotent).
 * Used by the agent loop to guarantee all tools are available before an API call.
 * If lazy tools are already loading in background, awaits that promise.
 * If not started yet, triggers registration now.
 */
export async function ensureLazyToolsLoaded(opts?: { computerUse?: boolean }): Promise<void> {
  if (lazyToolsRegistered) return
  if (lazyToolsPromise) {
    await lazyToolsPromise
    return
  }
  await registerLazyTools(opts)
}

/**
 * Start lazy tool registration in background (non-blocking).
 * Returns the promise so callers can optionally await it.
 */
export function startLazyToolRegistration(opts?: { computerUse?: boolean }): Promise<number> {
  if (!lazyToolsPromise) {
    lazyToolsPromise = registerLazyTools(opts)
  }
  return lazyToolsPromise
}

/** Register all built-in tools. Call once at startup. Uses parallel imports for speed.
 *  Backward-compatible: loads everything (core + lazy + plugins).
 *  Used by serve mode, SDK, and IDE bridge where all tools must be ready immediately.
 */
export async function registerAllTools(opts?: { computerUse?: boolean }): Promise<void> {
  await registerCoreTools(opts)
  await registerLazyTools(opts)
}
