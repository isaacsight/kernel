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
 * Thresholds for outcome classification.
 * Exported so downstream code (training, analytics) can mirror them.
 */
export declare const OUTCOME_EMPTY_THRESHOLD = 5;
export declare const OUTCOME_LARGE_THRESHOLD = 10240;
/**
 * Classify a tool execution outcome from its ToolContext.
 *
 * Priority:
 *   1. timeout  — aborted with timeout reason
 *   2. error    — ctx.error is set (or aborted for any other reason)
 *   3. empty    — result present but shorter than OUTCOME_EMPTY_THRESHOLD chars
 *   4. large    — result byte length > OUTCOME_LARGE_THRESHOLD
 *   5. success  — anything else
 */
export declare function classifyOutcome(ctx: ToolContext): 'success' | 'error' | 'timeout' | 'empty' | 'large';
/**
 * Observer middleware — writes an observation to ~/.kbot/observer/session.jsonl.
 *
 * Records the three fields that cannot be backfilled for action-token training:
 *   - durationMs: wall-clock time of tool execution
 *   - outcome:    success | error | timeout | empty | large
 *   - resultSize: byte length of the serialized result
 *
 * Emits schema v2 events. Backward compatible — consumers that don't know
 * about the new fields will ignore them (the tokenizer has fallbacks).
 *
 * Place this as the OUTERMOST middleware so duration captures the true
 * wall-clock of the full pipeline (including timeout, truncation, fallback).
 */
export declare function observerMiddleware(sessionId: string, options?: {
    enabled?: () => boolean;
}): ToolMiddleware;
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
 * Resource-aware middleware.
 * When memory pressure is high, adds warnings and throttles heavy tools.
 * Uses MachineProfile for live-ish awareness (cached from startup, refreshable).
 */
export declare function resourceAwareMiddleware(): ToolMiddleware;
/**
 * Create the default pipeline with the standard middleware stack.
 * Order: observer? → telemetry? → permission → hooks → resource → metrics → timeout → truncation → fallback? → execution
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
    /** If set, observerMiddleware is added as the outermost layer and writes to ~/.kbot/observer/session.jsonl. */
    observerSessionId?: string;
    /** Runtime gate for observer writes. */
    observerEnabled?: () => boolean;
}): ToolPipeline;
//# sourceMappingURL=tool-pipeline.d.ts.map