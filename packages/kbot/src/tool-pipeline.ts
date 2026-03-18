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

export interface ToolContext {
  toolName: string
  toolArgs: Record<string, any>
  toolCallId: string
  result?: string
  error?: string
  durationMs?: number
  metadata: Record<string, any> // middleware can attach arbitrary data
  aborted: boolean
  abortReason?: string
}

export type NextFunction = () => Promise<void>
export type ToolMiddleware = (ctx: ToolContext, next: NextFunction) => Promise<void>

export class ToolPipeline {
  private middleware: ToolMiddleware[] = []

  /** Append middleware to the end of the pipeline */
  use(mw: ToolMiddleware): this {
    this.middleware.push(mw)
    return this
  }

  /** Insert middleware at a specific position */
  useAt(index: number, mw: ToolMiddleware): this {
    this.middleware.splice(index, 0, mw)
    return this
  }

  /** Remove middleware by reference */
  remove(mw: ToolMiddleware): this {
    const idx = this.middleware.indexOf(mw)
    if (idx !== -1) this.middleware.splice(idx, 1)
    return this
  }

  /** Execute the pipeline for a tool context */
  async execute(ctx: ToolContext): Promise<ToolContext> {
    let index = 0
    const next = async (): Promise<void> => {
      if (ctx.aborted) return
      if (index >= this.middleware.length) return
      const mw = this.middleware[index++]
      await mw(ctx, next)
    }
    await next()
    return ctx
  }

  /** Number of middleware in the pipeline */
  get length(): number {
    return this.middleware.length
  }
}


// ── Built-in middleware factories ──

/**
 * Permission check middleware.
 * Blocks tool execution if the user denies the operation.
 */
export function permissionMiddleware(
  checkPermission: (name: string, args: any) => Promise<boolean>,
): ToolMiddleware {
  return async (ctx, next) => {
    const allowed = await checkPermission(ctx.toolName, ctx.toolArgs)
    if (!allowed) {
      ctx.aborted = true
      ctx.abortReason = 'Permission denied by user'
      ctx.error = 'Tool call was denied by user'
      return
    }
    await next()
  }
}

/**
 * Pre/post hook middleware.
 * Runs user-defined hooks before and after tool execution.
 */
export function hookMiddleware(
  runPreHook: (name: string, args: any) => { blocked: boolean; blockReason?: string },
  runPostHook: (name: string, args: any, result: string) => void,
): ToolMiddleware {
  return async (ctx, next) => {
    const preResult = runPreHook(ctx.toolName, ctx.toolArgs)
    if (preResult.blocked) {
      ctx.aborted = true
      ctx.abortReason = preResult.blockReason ?? 'Blocked by pre-tool hook'
      ctx.error = `Blocked by hook: ${ctx.abortReason}`
      return
    }
    await next()
    if (ctx.result && !ctx.error) {
      runPostHook(ctx.toolName, ctx.toolArgs, ctx.result)
    }
  }
}

/**
 * Timeout middleware.
 * Aborts tool execution if it exceeds the configured timeout.
 */
export function timeoutMiddleware(defaultTimeout: number = 300_000): ToolMiddleware {
  return async (ctx, next) => {
    const timeout = ctx.metadata.timeout ?? defaultTimeout
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)
    ctx.metadata.abortController = controller
    try {
      await Promise.race([
        next(),
        new Promise<void>((_, reject) => {
          controller.signal.addEventListener('abort', () => {
            reject(new Error(`Tool ${ctx.toolName} timed out after ${timeout}ms`))
          })
        }),
      ])
    } catch (err: any) {
      if (err.message?.includes('timed out')) {
        ctx.error = err.message
        ctx.aborted = true
        ctx.abortReason = 'Execution timed out'
      } else {
        throw err
      }
    } finally {
      clearTimeout(timer)
    }
  }
}

/**
 * Metrics recording middleware.
 * Records execution duration and error state.
 */
export function metricsMiddleware(
  recordMetrics: (name: string, duration: number, error?: string) => void,
): ToolMiddleware {
  return async (ctx, next) => {
    const start = Date.now()
    await next()
    ctx.durationMs = Date.now() - start
    recordMetrics(ctx.toolName, ctx.durationMs, ctx.error)
  }
}

/**
 * Result truncation middleware.
 * Truncates tool output that exceeds maxSize characters.
 */
export function truncationMiddleware(maxSize: number = 50_000): ToolMiddleware {
  return async (ctx, next) => {
    await next()
    if (ctx.result && ctx.result.length > maxSize) {
      const remaining = ctx.result.length - maxSize
      ctx.result = ctx.result.slice(0, maxSize) +
        `\n\n[... truncated ${remaining} characters. Use more specific queries to get focused results.]`
    }
  }
}

/**
 * Telemetry middleware.
 * Emits tool_call_start and tool_call_end events.
 */
export function telemetryMiddleware(
  emit: (event: string, data: any) => void,
): ToolMiddleware {
  return async (ctx, next) => {
    emit('tool_call_start', { tool: ctx.toolName, args: ctx.toolArgs })
    await next()
    emit('tool_call_end', {
      tool: ctx.toolName,
      duration_ms: ctx.durationMs,
      success: !ctx.error,
      error: ctx.error,
    })
  }
}

/**
 * Execution middleware — the actual tool call.
 * This should be the last middleware in the pipeline.
 */
export function executionMiddleware(
  executeTool: (name: string, args: any) => Promise<{ result: string; error?: string }>,
): ToolMiddleware {
  return async (ctx, next) => {
    try {
      const result = await executeTool(ctx.toolName, ctx.toolArgs)
      ctx.result = result.result
      if (result.error) ctx.error = result.error
    } catch (err: any) {
      ctx.error = err.message ?? String(err)
    }
    await next() // allow post-execution middleware
  }
}

/**
 * Create the default pipeline with the standard middleware stack.
 * Order: telemetry? → permission → hooks → metrics → timeout → truncation → execution
 */
export function createDefaultPipeline(deps: {
  checkPermission: (name: string, args: any) => Promise<boolean>
  runPreHook: (name: string, args: any) => { blocked: boolean; blockReason?: string }
  runPostHook: (name: string, args: any, result: string) => void
  executeTool: (name: string, args: any) => Promise<{ result: string; error?: string }>
  recordMetrics: (name: string, duration: number, error?: string) => void
  emit?: (event: string, data: any) => void
}): ToolPipeline {
  const pipeline = new ToolPipeline()

  if (deps.emit) {
    pipeline.use(telemetryMiddleware(deps.emit))
  }
  pipeline.use(permissionMiddleware(deps.checkPermission))
  pipeline.use(hookMiddleware(deps.runPreHook, deps.runPostHook))
  pipeline.use(metricsMiddleware(deps.recordMetrics))
  pipeline.use(timeoutMiddleware())
  pipeline.use(truncationMiddleware())
  pipeline.use(executionMiddleware(deps.executeTool))

  return pipeline
}
