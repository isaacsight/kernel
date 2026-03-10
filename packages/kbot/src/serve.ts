// K:BOT Serve — Universal HTTP API for any LLM
//
// Exposes K:BOT's 60+ tools, agent loop, learning engine, and project
// context over HTTP so that ANY provider (Claude, OpenAI, Gemini, Ollama,
// OpenClaw, or custom agents) can drive K:BOT as a tool backend.
//
// Usage:
//   kbot serve                          # Start on port 7437
//   kbot serve --port 9000              # Custom port
//   kbot serve --token my-secret        # Require bearer token
//   kbot serve --cors '*'               # Allow all origins
//
// Endpoints:
//   GET  /v1/tools              — List tools (OpenAI function-calling schema)
//   POST /v1/tools/execute      — Execute a single tool
//   POST /v1/tools/batch        — Execute multiple tools in parallel
//   POST /v1/chat               — Full agent loop (K:BOT picks tools)
//   GET  /v1/context            — Project context (stack, structure, git)
//   GET  /v1/status             — Server status + metrics
//   GET  /v1/memory             — Learning context + user profile
//   GET  /health                — Health check

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { registerAllTools, executeTool, getAllTools, getToolDefinitionsForApi, getToolMetrics, type ToolCall } from './tools/index.js'
import { runAgent, type AgentOptions, type AgentResponse } from './agent.js'
import { gatherContext, formatContextForPrompt, type ProjectContext } from './context.js'
import { buildFullLearningContext, getExtendedStats } from './learning.js'
import { loadConfig } from './auth.js'

export interface ServeOptions {
  port?: number
  token?: string
  cors?: string
  tier?: string
  agent?: string
  quiet?: boolean
}

// ── Request / Response helpers ──

function cors(res: ServerResponse, origin: string): void {
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Max-Age', '86400')
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

function error(res: ServerResponse, status: number, message: string): void {
  json(res, status, { error: { message, status } })
}

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString()))
    req.on('error', reject)
  })
}

async function parseJson(req: IncomingMessage): Promise<unknown> {
  const raw = await readBody(req)
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    throw new Error('Invalid JSON body')
  }
}

// ── Tool schema converters ──

/** Convert K:BOT tool definitions to OpenAI function-calling format */
function toolsToOpenAI(tier: string): Array<{
  type: 'function'
  function: { name: string; description: string; parameters: Record<string, unknown> }
}> {
  const tools = getToolDefinitionsForApi(tier)
  return tools.map(t => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    },
  }))
}

/** Convert K:BOT tool definitions to Anthropic tool format */
function toolsToAnthropic(tier: string): Array<{
  name: string; description: string; input_schema: Record<string, unknown>
}> {
  return getToolDefinitionsForApi(tier)
}

/** Convert K:BOT tool definitions to Gemini function declarations */
function toolsToGemini(tier: string): Array<{
  name: string; description: string; parameters: Record<string, unknown>
}> {
  const tools = getToolDefinitionsForApi(tier)
  return tools.map(t => ({
    name: t.name,
    description: t.description,
    parameters: t.input_schema,
  }))
}

// ── Server ──

export async function startServe(opts: ServeOptions = {}): Promise<void> {
  const port = opts.port ?? 7437
  const corsOrigin = opts.cors ?? '*'
  const tier = opts.tier ?? 'free'
  const requiredToken = opts.token

  // Initialize tools and project context
  await registerAllTools()
  const projectContext = gatherContext()

  const startedAt = new Date().toISOString()
  let requestCount = 0

  const server = createServer(async (req, res) => {
    requestCount++

    // CORS
    cors(res, corsOrigin)
    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    // Auth
    if (requiredToken) {
      const auth = req.headers.authorization
      if (!auth || auth !== `Bearer ${requiredToken}`) {
        error(res, 401, 'Invalid or missing bearer token')
        return
      }
    }

    const url = new URL(req.url || '/', `http://localhost:${port}`)
    const path = url.pathname

    try {
      // ── Health check ──
      if (path === '/health' && req.method === 'GET') {
        json(res, 200, { status: 'ok', version: '2.4.0', uptime_s: Math.floor(process.uptime()) })
        return
      }

      // ── List tools ──
      if (path === '/v1/tools' && req.method === 'GET') {
        const format = url.searchParams.get('format') || 'openai'

        let tools: unknown
        if (format === 'anthropic') {
          tools = toolsToAnthropic(tier)
        } else if (format === 'gemini') {
          tools = toolsToGemini(tier)
        } else {
          tools = toolsToOpenAI(tier)
        }

        json(res, 200, {
          tools,
          format,
          count: getAllTools().length,
        })
        return
      }

      // ── Execute single tool ──
      if (path === '/v1/tools/execute' && req.method === 'POST') {
        const body = await parseJson(req) as { name?: string; arguments?: Record<string, unknown>; call_id?: string }
        if (!body.name) {
          error(res, 400, 'Missing required field: name')
          return
        }

        const call: ToolCall = {
          id: body.call_id || `srv_${Date.now()}`,
          name: body.name,
          arguments: body.arguments || {},
        }

        const result = await executeTool(call)

        json(res, result.error ? 422 : 200, {
          tool_call_id: result.tool_call_id,
          result: result.result,
          error: result.error || false,
          duration_ms: result.duration_ms,
        })
        return
      }

      // ── Batch execute tools (parallel) ──
      if (path === '/v1/tools/batch' && req.method === 'POST') {
        const body = await parseJson(req) as {
          calls?: Array<{ name: string; arguments?: Record<string, unknown>; call_id?: string }>
        }
        if (!body.calls || !Array.isArray(body.calls)) {
          error(res, 400, 'Missing required field: calls (array)')
          return
        }

        const calls: ToolCall[] = body.calls.map((c, i) => ({
          id: c.call_id || `srv_batch_${Date.now()}_${i}`,
          name: c.name,
          arguments: c.arguments || {},
        }))

        const results = await Promise.all(calls.map(c => executeTool(c)))

        json(res, 200, {
          results: results.map(r => ({
            tool_call_id: r.tool_call_id,
            result: r.result,
            error: r.error || false,
            duration_ms: r.duration_ms,
          })),
        })
        return
      }

      // ── Full agent loop ──
      if (path === '/v1/chat' && req.method === 'POST') {
        const body = await parseJson(req) as {
          message?: string
          agent?: string
          model?: string
          thinking?: boolean
        }
        if (!body.message) {
          error(res, 400, 'Missing required field: message')
          return
        }

        const agentOpts: AgentOptions = {
          agent: body.agent || opts.agent || 'auto',
          model: body.model,
          context: projectContext,
          tier,
          thinking: body.thinking,
        }

        const response = await runAgent(body.message, agentOpts)

        json(res, 200, {
          content: response.content,
          agent: response.agent,
          model: response.model,
          tool_calls: response.toolCalls,
          thinking: response.thinking || undefined,
          usage: response.usage,
        })
        return
      }

      // ── Project context ──
      if (path === '/v1/context' && req.method === 'GET') {
        json(res, 200, {
          project: projectContext,
          formatted: projectContext ? formatContextForPrompt(projectContext) : '',
        })
        return
      }

      // ── Learning & memory ──
      if (path === '/v1/memory' && req.method === 'GET') {
        const learning = buildFullLearningContext('memory overview')
        const stats = getExtendedStats()

        json(res, 200, {
          learning_context: learning,
          stats,
        })
        return
      }

      // ── Server status ──
      if (path === '/v1/status' && req.method === 'GET') {
        const toolMetrics = getToolMetrics()
        json(res, 200, {
          version: '2.4.0',
          started_at: startedAt,
          uptime_s: Math.floor(process.uptime()),
          requests: requestCount,
          tools: getAllTools().length,
          tier,
          auth: requiredToken ? 'bearer' : 'none',
          cors: corsOrigin,
          tool_metrics: toolMetrics.slice(0, 20),
          project: projectContext ? {
            branch: projectContext.branch,
            language: projectContext.language,
            framework: projectContext.framework,
            repoRoot: projectContext.repoRoot,
          } : null,
        })
        return
      }

      // ── 404 ──
      error(res, 404, `Not found: ${req.method} ${path}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      error(res, 500, message)
    }
  })

  server.listen(port, () => {
    if (!opts.quiet) {
      console.log()
      console.log(`  K:BOT Server v2.4.0`)
      console.log(`  ═══════════════════════════════════════`)
      console.log(`  Listening:   http://localhost:${port}`)
      console.log(`  Auth:        ${requiredToken ? 'Bearer token required' : 'None (use --token for production)'}`)
      console.log(`  CORS:        ${corsOrigin}`)
      console.log(`  Tools:       ${getAllTools().length} registered`)
      console.log(`  Project:     ${projectContext?.repoRoot || process.cwd()}`)
      console.log()
      console.log(`  Endpoints:`)
      console.log(`    GET  /v1/tools              List tools (?format=openai|anthropic|gemini)`)
      console.log(`    POST /v1/tools/execute      Execute tool { name, arguments }`)
      console.log(`    POST /v1/tools/batch        Execute tools in parallel { calls: [...] }`)
      console.log(`    POST /v1/chat               Full agent loop { message, agent?, model? }`)
      console.log(`    GET  /v1/context            Project context`)
      console.log(`    GET  /v1/memory             Learning & user profile`)
      console.log(`    GET  /v1/status             Server status & metrics`)
      console.log(`    GET  /health                Health check`)
      console.log()
      console.log(`  Usage examples:`)
      console.log(`    # Claude / Anthropic`)
      console.log(`    curl localhost:${port}/v1/tools?format=anthropic`)
      console.log()
      console.log(`    # OpenAI / GPT`)
      console.log(`    curl localhost:${port}/v1/tools?format=openai`)
      console.log()
      console.log(`    # Execute a tool`)
      console.log(`    curl -X POST localhost:${port}/v1/tools/execute \\`)
      console.log(`      -H 'Content-Type: application/json' \\`)
      console.log(`      -d '{"name":"read_file","arguments":{"path":"package.json"}}'`)
      console.log()
      console.log(`    # Full agent conversation`)
      console.log(`    curl -X POST localhost:${port}/v1/chat \\`)
      console.log(`      -H 'Content-Type: application/json' \\`)
      console.log(`      -d '{"message":"fix the auth bug in src/auth.ts"}'`)
      console.log()
      console.log(`  Press Ctrl+C to stop.`)
      console.log()
    }
  })

  // Graceful shutdown
  const shutdown = (): void => {
    if (!opts.quiet) console.log('\n  Shutting down K:BOT server...')
    server.close(() => process.exit(0))
    // Force exit after 5s
    setTimeout(() => process.exit(1), 5000)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}
