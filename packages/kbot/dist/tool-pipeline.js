// kbot Tool Execution Middleware Pipeline
// Composable Express/Koa-style middleware stack for tool execution.
// Each middleware calls next() to continue the chain.
//
// Order matters: first added = outermost (runs first on the way in, last on the way out).
// The execution middleware should always be last.
//
// Usage:
//   const pipeline = new ToolPipeline()
//   pipeline.use(permissionMiddleware(checkPermission))
//   pipeline.use(metricsMiddleware(recordMetrics))
//   pipeline.use(executionMiddleware(executeTool))
//   await pipeline.execute(ctx)
export class ToolPipeline {
    middleware = [];
    /** Append middleware to the end of the pipeline */
    use(mw) {
        this.middleware.push(mw);
        return this;
    }
    /** Insert middleware at a specific position */
    useAt(index, mw) {
        this.middleware.splice(index, 0, mw);
        return this;
    }
    /** Remove middleware by reference */
    remove(mw) {
        const idx = this.middleware.indexOf(mw);
        if (idx !== -1)
            this.middleware.splice(idx, 1);
        return this;
    }
    /** Execute the pipeline for a tool context */
    async execute(ctx) {
        let index = 0;
        const next = async () => {
            if (ctx.aborted)
                return;
            if (index >= this.middleware.length)
                return;
            const mw = this.middleware[index++];
            await mw(ctx, next);
        };
        await next();
        return ctx;
    }
    /** Number of middleware in the pipeline */
    get length() {
        return this.middleware.length;
    }
}
// ── Built-in middleware factories ──
/**
 * Permission check middleware.
 * Blocks tool execution if the user denies the operation.
 */
export function permissionMiddleware(checkPermission) {
    return async (ctx, next) => {
        const allowed = await checkPermission(ctx.toolName, ctx.toolArgs);
        if (!allowed) {
            ctx.aborted = true;
            ctx.abortReason = 'Permission denied by user';
            ctx.error = 'Tool call was denied by user';
            return;
        }
        await next();
    };
}
/**
 * Pre/post hook middleware.
 * Runs user-defined hooks before and after tool execution.
 */
export function hookMiddleware(runPreHook, runPostHook) {
    return async (ctx, next) => {
        const preResult = runPreHook(ctx.toolName, ctx.toolArgs);
        if (preResult.blocked) {
            ctx.aborted = true;
            ctx.abortReason = preResult.blockReason ?? 'Blocked by pre-tool hook';
            ctx.error = `Blocked by hook: ${ctx.abortReason}`;
            return;
        }
        await next();
        if (ctx.result && !ctx.error) {
            runPostHook(ctx.toolName, ctx.toolArgs, ctx.result);
        }
    };
}
/**
 * Timeout middleware.
 * Aborts tool execution if it exceeds the configured timeout.
 */
export function timeoutMiddleware(defaultTimeout = 300_000) {
    return async (ctx, next) => {
        const timeout = ctx.metadata.timeout ?? defaultTimeout;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);
        ctx.metadata.abortController = controller;
        try {
            await Promise.race([
                next(),
                new Promise((_, reject) => {
                    controller.signal.addEventListener('abort', () => {
                        reject(new Error(`Tool ${ctx.toolName} timed out after ${timeout}ms`));
                    });
                }),
            ]);
        }
        catch (err) {
            if (err.message?.includes('timed out')) {
                ctx.error = err.message;
                ctx.aborted = true;
                ctx.abortReason = 'Execution timed out';
            }
            else {
                throw err;
            }
        }
        finally {
            clearTimeout(timer);
        }
    };
}
/**
 * Metrics recording middleware.
 * Records execution duration and error state.
 */
export function metricsMiddleware(recordMetrics) {
    return async (ctx, next) => {
        const start = Date.now();
        await next();
        ctx.durationMs = Date.now() - start;
        recordMetrics(ctx.toolName, ctx.durationMs, ctx.error);
    };
}
/**
 * Result truncation middleware.
 * Truncates tool output that exceeds maxSize characters.
 */
export function truncationMiddleware(maxSize = 50_000) {
    return async (ctx, next) => {
        await next();
        if (ctx.result && ctx.result.length > maxSize) {
            const remaining = ctx.result.length - maxSize;
            ctx.result = ctx.result.slice(0, maxSize) +
                `\n\n[... truncated ${remaining} characters. Use more specific queries to get focused results.]`;
        }
    };
}
/**
 * Telemetry middleware.
 * Emits tool_call_start and tool_call_end events.
 */
export function telemetryMiddleware(emit) {
    return async (ctx, next) => {
        emit('tool_call_start', { tool: ctx.toolName, args: ctx.toolArgs });
        await next();
        emit('tool_call_end', {
            tool: ctx.toolName,
            duration_ms: ctx.durationMs,
            success: !ctx.error,
            error: ctx.error,
        });
    };
}
/**
 * Execution middleware — the actual tool call.
 * This should be the last middleware in the pipeline.
 */
export function executionMiddleware(executeTool) {
    return async (ctx, next) => {
        try {
            const result = await executeTool(ctx.toolName, ctx.toolArgs);
            // Guard: don't write results if the context was aborted (e.g., by timeout)
            if (!ctx.aborted) {
                ctx.result = result.result;
                if (result.error)
                    ctx.error = result.error;
            }
        }
        catch (err) {
            if (!ctx.aborted) {
                ctx.error = err.message ?? String(err);
            }
        }
        await next(); // allow post-execution middleware
    };
}
/**
 * MCP Apps detection middleware.
 * Runs after tool execution and checks if the result contains MCP App HTML.
 * If detected, parses the McpAppResult and attaches it to ctx.metadata.mcpApp.
 * The rendering is handled separately by the caller (CLI or serve mode).
 */
export function mcpAppsMiddleware() {
    return async (ctx, next) => {
        await next();
        // Only process successful results
        if (!ctx.result || ctx.error)
            return;
        // Try to detect MCP App content in the result
        if (ctx.result.startsWith('{') && ctx.result.includes('"html"')) {
            try {
                const parsed = JSON.parse(ctx.result);
                if (typeof parsed === 'object' && parsed !== null &&
                    typeof parsed.text === 'string' && typeof parsed.html === 'string' && parsed.html.length > 0) {
                    // Store the full app result in metadata for the caller to handle
                    ctx.metadata.mcpApp = parsed;
                    // Replace the tool result text with just the text summary
                    // so the AI sees the text, but the UI can render the HTML
                    ctx.result = parsed.text;
                }
            }
            catch {
                // Not valid JSON — leave result as-is
            }
        }
    };
}
/** Default fallback rules for common tool failures */
export const DEFAULT_FALLBACK_RULES = [
    {
        fromTool: 'url_fetch',
        toTool: 'web_search',
        transformArgs: (args) => ({ query: args.url || args.query || '' }),
        condition: (err) => /timeout|timed?\s*out|4\d{2}|5\d{2}|ECONNREFUSED|ENOTFOUND|fetch failed/i.test(err),
    },
    {
        fromTool: 'web_search',
        toTool: 'url_fetch',
        transformArgs: (args) => ({ url: `https://www.google.com/search?q=${encodeURIComponent(args.query || '')}` }),
        condition: (err) => /rate.?limit|429|quota|exceeded/i.test(err),
    },
    {
        fromTool: 'bash',
        toTool: 'bash',
        transformArgs: (args) => {
            const cmd = String(args.command || '');
            // If command not found, try with npx prefix
            const match = cmd.match(/^(\S+)(.*)/);
            if (match)
                return { command: `npx ${match[1]}${match[2]}` };
            return args;
        },
        condition: (err) => /command not found|not found in PATH|ENOENT/i.test(err),
    },
];
/**
 * Fallback middleware — retries failed tool calls with alternative tools.
 * Checks error messages against fallback rules and reroutes on match.
 */
export function fallbackMiddleware(rules, execute) {
    return async (ctx, next) => {
        await next();
        // Only attempt fallback if there was an error
        if (!ctx.error)
            return;
        // Find a matching fallback rule
        const rule = rules.find(r => r.fromTool === ctx.toolName && r.condition(ctx.error));
        if (!rule)
            return;
        // Attempt the fallback
        const fallbackArgs = rule.transformArgs(ctx.toolArgs);
        try {
            const fallbackResult = await execute(rule.toTool, fallbackArgs);
            if (!fallbackResult.error) {
                // Fallback succeeded — replace the error with the fallback result
                ctx.result = `[Fallback: ${ctx.toolName} → ${rule.toTool}] ${fallbackResult.result}`;
                ctx.error = undefined;
                ctx.metadata.fallbackUsed = `${ctx.toolName} → ${rule.toTool}`;
            }
        }
        catch {
            // Fallback also failed — keep the original error
        }
    };
}
/**
 * Resource-aware middleware.
 * When memory pressure is high, adds warnings and throttles heavy tools.
 * Uses MachineProfile for live-ish awareness (cached from startup, refreshable).
 */
export function resourceAwareMiddleware() {
    // Heavy tools that allocate significant memory
    const heavyTools = new Set([
        'browser_navigate', 'browser_screenshot', 'sandbox_execute',
        'subagent', 'parallel_execute', 'training_run',
        'comfyui_generate', 'browser_agent_run',
    ]);
    return async (ctx, next) => {
        // Dynamic import to avoid circular deps at module load time
        const { getMachineProfile } = await import('./machine.js');
        const profile = getMachineProfile();
        if (profile && profile.memory.pressure === 'high' && heavyTools.has(ctx.toolName)) {
            // Don't block — but annotate so the agent knows the system is stressed
            ctx.metadata.memoryWarning = `System memory pressure is HIGH (${profile.memory.free} free of ${profile.memory.total}). This tool may be slow or fail.`;
        }
        // Battery warning for long-running tools
        if (profile?.battery.present && profile.battery.percent !== undefined &&
            profile.battery.percent < 10 && !profile.battery.charging) {
            ctx.metadata.batteryWarning = `Battery at ${profile.battery.percent}% — consider plugging in`;
        }
        await next();
        // Append warnings to result if present
        const warnings = [];
        if (ctx.metadata.memoryWarning)
            warnings.push(`⚠ ${ctx.metadata.memoryWarning}`);
        if (ctx.metadata.batteryWarning)
            warnings.push(`⚠ ${ctx.metadata.batteryWarning}`);
        if (warnings.length > 0 && ctx.result) {
            ctx.result = `${ctx.result}\n\n${warnings.join('\n')}`;
        }
    };
}
/**
 * Create the default pipeline with the standard middleware stack.
 * Order: telemetry? → permission → hooks → resource → metrics → timeout → truncation → fallback? → execution
 */
export function createDefaultPipeline(deps) {
    const pipeline = new ToolPipeline();
    if (deps.emit) {
        pipeline.use(telemetryMiddleware(deps.emit));
    }
    pipeline.use(permissionMiddleware(deps.checkPermission));
    pipeline.use(hookMiddleware(deps.runPreHook, deps.runPostHook));
    pipeline.use(resourceAwareMiddleware());
    pipeline.use(metricsMiddleware(deps.recordMetrics));
    pipeline.use(timeoutMiddleware());
    pipeline.use(truncationMiddleware());
    if (deps.fallbackRules && deps.fallbackRules.length > 0) {
        pipeline.use(fallbackMiddleware(deps.fallbackRules, deps.executeTool));
    }
    pipeline.use(executionMiddleware(deps.executeTool));
    pipeline.use(mcpAppsMiddleware());
    return pipeline;
}
//# sourceMappingURL=tool-pipeline.js.map