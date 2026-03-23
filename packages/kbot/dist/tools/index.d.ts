export { ToolPipeline, createDefaultPipeline, permissionMiddleware, hookMiddleware, timeoutMiddleware, metricsMiddleware, truncationMiddleware, telemetryMiddleware, executionMiddleware, fallbackMiddleware, mcpAppsMiddleware, DEFAULT_FALLBACK_RULES, type ToolMiddleware, type ToolContext, type NextFunction, type FallbackRule, } from '../tool-pipeline.js';
import { ToolPipeline, type ToolMiddleware } from '../tool-pipeline.js';
export interface ToolDefinition {
    name: string;
    description: string;
    parameters: Record<string, {
        type: string;
        description: string;
        required?: boolean;
        default?: unknown;
        items?: Record<string, unknown>;
        properties?: Record<string, unknown>;
    }>;
    execute: (args: Record<string, unknown>) => Promise<string>;
    /** Tier required: 'free' | 'pro' | 'growth' | 'enterprise' */
    tier: 'free' | 'pro' | 'growth' | 'enterprise';
    /** Custom timeout in ms (default: 300_000 = 5 min) */
    timeout?: number;
    /** Max result size in bytes (default: 50_000 = 50KB) */
    maxResultSize?: number;
}
export interface ToolCall {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
}
export interface ToolResult {
    tool_call_id: string;
    result: string;
    error?: boolean;
    /** Execution time in milliseconds */
    duration_ms?: number;
}
/** Execution metrics per tool */
export interface ToolMetrics {
    name: string;
    calls: number;
    errors: number;
    totalDurationMs: number;
    avgDurationMs: number;
    lastCalled: string;
}
export declare function registerTool(tool: ToolDefinition): void;
export declare function getTool(name: string): ToolDefinition | undefined;
export declare function getAllTools(): ToolDefinition[];
export declare function getToolsForTier(tier: string): ToolDefinition[];
/** Get tool definitions in Claude tool-use format for the API */
export declare function getToolDefinitionsForApi(tier: string): Array<{
    name: string;
    description: string;
    input_schema: {
        type: 'object';
        properties: Record<string, unknown>;
        required?: string[];
    };
}>;
/** Get metrics for all tools or a specific tool */
export declare function getToolMetrics(toolName?: string): ToolMetrics[];
/** Execute a tool call locally with timeout and result truncation */
export declare function executeTool(call: ToolCall): Promise<ToolResult>;
/**
 * Create a ToolPipeline with the built-in executeTool as the execution step.
 * Custom middleware runs before execution; execution is always last.
 */
export declare function createToolPipeline(options?: {
    middleware?: ToolMiddleware[];
}): ToolPipeline;
/** Enable lite mode (called from CLI when --lite is passed or Replit detected) */
export declare function setLiteMode(enabled: boolean): void;
/** Check if lite mode is active */
export declare function isLiteMode(): boolean;
/**
 * Register core tools only (~5 modules, ~10 tools, ~200ms).
 * Covers file ops, bash, git, search, and fetch — enough for 80%+ of one-shot commands.
 * Returns the number of tools registered.
 */
export declare function registerCoreTools(opts?: {
    computerUse?: boolean;
}): Promise<number>;
/**
 * Register lazy (non-core) tools (~41 modules, ~236 tools).
 * Call in background for one-shot mode, or await for REPL/serve mode.
 * Returns the number of tools registered.
 */
export declare function registerLazyTools(opts?: {
    computerUse?: boolean;
}): Promise<number>;
/**
 * Ensure lazy tools are registered (idempotent).
 * Used by the agent loop to guarantee all tools are available before an API call.
 * If lazy tools are already loading in background, awaits that promise.
 * If not started yet, triggers registration now.
 */
export declare function ensureLazyToolsLoaded(opts?: {
    computerUse?: boolean;
}): Promise<void>;
/**
 * Start lazy tool registration in background (non-blocking).
 * Returns the promise so callers can optionally await it.
 */
export declare function startLazyToolRegistration(opts?: {
    computerUse?: boolean;
}): Promise<number>;
/** Register all built-in tools. Call once at startup. Uses parallel imports for speed.
 *  Backward-compatible: loads everything (core + lazy + plugins).
 *  Used by serve mode, SDK, and IDE bridge where all tools must be ready immediately.
 */
export declare function registerAllTools(opts?: {
    computerUse?: boolean;
}): Promise<void>;
//# sourceMappingURL=index.d.ts.map