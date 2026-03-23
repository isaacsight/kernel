export interface ToolContext {
    toolName: string;
    toolArgs: Record<string, any>;
    toolCallId: string;
    result?: string;
    error?: string;
    durationMs?: number;
    metadata: Record<string, any>;
    aborted: boolean;
    abortReason?: string;
}
export type NextFunction = () => Promise<void>;
export type ToolMiddleware = (ctx: ToolContext, next: NextFunction) => Promise<void>;
export declare class ToolPipeline {
    private middleware;
    /** Append middleware to the end of the pipeline */
    use(mw: ToolMiddleware): this;
    /** Insert middleware at a specific position */
    useAt(index: number, mw: ToolMiddleware): this;
    /** Remove middleware by reference */
    remove(mw: ToolMiddleware): this;
    /** Execute the pipeline for a tool context */
    execute(ctx: ToolContext): Promise<ToolContext>;
    /** Number of middleware in the pipeline */
    get length(): number;
}
/**
 * Permission check middleware.
 * Blocks tool execution if the user denies the operation.
 */
export declare function permissionMiddleware(checkPermission: (name: string, args: any) => Promise<boolean>): ToolMiddleware;
/**
 * Pre/post hook middleware.
 * Runs user-defined hooks before and after tool execution.
 */
export declare function hookMiddleware(runPreHook: (name: string, args: any) => {
    blocked: boolean;
    blockReason?: string;
}, runPostHook: (name: string, args: any, result: string) => void): ToolMiddleware;
/**
 * Timeout middleware.
 * Aborts tool execution if it exceeds the configured timeout.
 */
export declare function timeoutMiddleware(defaultTimeout?: number): ToolMiddleware;
/**
 * Metrics recording middleware.
 * Records execution duration and error state.
 */
export declare function metricsMiddleware(recordMetrics: (name: string, duration: number, error?: string) => void): ToolMiddleware;
/**
 * Result truncation middleware.
 * Truncates tool output that exceeds maxSize characters.
 */
export declare function truncationMiddleware(maxSize?: number): ToolMiddleware;
/**
 * Telemetry middleware.
 * Emits tool_call_start and tool_call_end events.
 */
export declare function telemetryMiddleware(emit: (event: string, data: any) => void): ToolMiddleware;
/**
 * Execution middleware — the actual tool call.
 * This should be the last middleware in the pipeline.
 */
export declare function executionMiddleware(executeTool: (name: string, args: any) => Promise<{
    result: string;
    error?: string;
}>): ToolMiddleware;
/**
 * MCP Apps detection middleware.
 * Runs after tool execution and checks if the result contains MCP App HTML.
 * If detected, parses the McpAppResult and attaches it to ctx.metadata.mcpApp.
 * The rendering is handled separately by the caller (CLI or serve mode).
 */
export declare function mcpAppsMiddleware(): ToolMiddleware;
export interface FallbackRule {
    /** Tool that triggers the fallback */
    fromTool: string;
    /** Tool to fall back to */
    toTool: string;
    /** Transform arguments from the original tool to the fallback tool */
    transformArgs: (args: any) => any;
    /** Condition under which the fallback should trigger (checks the error string) */
    condition: (error: string) => boolean;
}
/** Default fallback rules for common tool failures */
export declare const DEFAULT_FALLBACK_RULES: FallbackRule[];
/**
 * Fallback middleware — retries failed tool calls with alternative tools.
 * Checks error messages against fallback rules and reroutes on match.
 */
export declare function fallbackMiddleware(rules: FallbackRule[], execute: (name: string, args: any) => Promise<{
    result: string;
    error?: string;
}>): ToolMiddleware;
/**
 * Create the default pipeline with the standard middleware stack.
 * Order: telemetry? → permission → hooks → metrics → timeout → truncation → fallback? → execution
 */
export declare function createDefaultPipeline(deps: {
    checkPermission: (name: string, args: any) => Promise<boolean>;
    runPreHook: (name: string, args: any) => {
        blocked: boolean;
        blockReason?: string;
    };
    runPostHook: (name: string, args: any, result: string) => void;
    executeTool: (name: string, args: any) => Promise<{
        result: string;
        error?: string;
    }>;
    recordMetrics: (name: string, duration: number, error?: string) => void;
    emit?: (event: string, data: any) => void;
    fallbackRules?: FallbackRule[];
}): ToolPipeline;
//# sourceMappingURL=tool-pipeline.d.ts.map