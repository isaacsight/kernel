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
//   GET  /v1/tools                — List tools (OpenAI function-calling schema)
//   POST /v1/tools/execute        — Execute a single tool
//   POST /v1/tools/execute/stream — Execute tool with SSE streaming
//   POST /v1/tools/batch          — Execute multiple tools in parallel
//   POST /v1/chat                 — Full agent loop (K:BOT picks tools)
//   POST /v1/chat/stream          — Full agent loop with SSE streaming
//   GET  /v1/context              — Project context (stack, structure, git)
//   GET  /v1/status               — Server status + metrics
//   GET  /v1/memory               — Learning context + user profile
//   POST /v1/sessions             — Create a new session
//   GET  /v1/sessions             — List sessions
//   GET  /v1/sessions/:id         — Get session details
//   DELETE /v1/sessions/:id       — Delete a session
//   GET  /health                  — Health check

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { randomUUID, timingSafeEqual as cryptoTimingSafeEqual } from 'node:crypto'
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

// ── Security: Rate Limiter ──

interface RateBucket {
  count: number
  resetAt: number
}

const rateBuckets = new Map<string, RateBucket>()
const RATE_WINDOW_MS = 60_000   // 1 minute window
const RATE_LIMIT = 120          // 120 requests per minute per IP
const MAX_BODY_SIZE = 1_048_576 // 1MB max request body
const MAX_BATCH_SIZE = 20       // Max tools in a single batch call
const MAX_SESSIONS = 100        // Max concurrent sessions

/** Check rate limit for an IP. Returns true if allowed, false if limited. */
function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const bucket = rateBuckets.get(ip)

  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }

  bucket.count++
  return bucket.count <= RATE_LIMIT
}

/** Get client IP from request */
function getClientIp(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim()
  return req.socket.remoteAddress || 'unknown'
}

/** Set security headers on every response */
function setSecurityHeaders(res: ServerResponse): void {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  // Prevent search engine indexing of API responses
  res.setHeader('X-Robots-Tag', 'noindex, nofollow')
}

/** Read body with size limit. Rejects if body exceeds MAX_BODY_SIZE. */
async function readBodySafe(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let totalSize = 0
    req.on('data', (chunk: Buffer) => {
      totalSize += chunk.length
      if (totalSize > MAX_BODY_SIZE) {
        req.destroy()
        reject(new Error(`Request body too large (max ${MAX_BODY_SIZE / 1024}KB)`))
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString()))
    req.on('error', reject)
  })
}

/** Sanitize a string input — strip control characters */
function sanitize(input: string): string {
  // Allow newlines/tabs but strip other control chars
  // eslint-disable-next-line no-control-regex
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
}

/** Clean expired rate limit buckets (runs periodically) */
function pruneRateBuckets(): void {
  const now = Date.now()
  for (const [ip, bucket] of rateBuckets) {
    if (now > bucket.resetAt) rateBuckets.delete(ip)
  }
}

/** Constant-time string comparison to prevent timing attacks */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  return cryptoTimingSafeEqual(bufA, bufB)
}

// ── Session Store ──

interface SessionTurn {
  role: 'user' | 'assistant'
  content: string
  agent?: string
  tool_calls?: number
  timestamp: string
}

interface ServerSession {
  id: string
  created: string
  updated: string
  turns: SessionTurn[]
  agent?: string
  metadata?: Record<string, unknown>
}

const sessions = new Map<string, ServerSession>()
const SESSION_MAX_TURNS = 40
const SESSION_TTL_MS = 4 * 60 * 60 * 1000 // 4 hours

/** Prune expired sessions */
function pruneSessions(): void {
  const now = Date.now()
  for (const [id, session] of sessions) {
    if (now - new Date(session.updated).getTime() > SESSION_TTL_MS) {
      sessions.delete(id)
    }
  }
}

/** Get or create a session. Returns null if at capacity and ID doesn't exist. */
function getOrCreateSession(sessionId?: string): ServerSession | null {
  if (sessionId && sessions.has(sessionId)) {
    return sessions.get(sessionId)!
  }
  // Enforce session limit
  if (sessions.size >= MAX_SESSIONS) {
    pruneSessions()
    if (sessions.size >= MAX_SESSIONS) return null
  }
  // Sanitize session ID — alphanumeric + hyphens only
  const cleanId = sessionId
    ? sessionId.replace(/[^a-zA-Z0-9-_]/g, '').slice(0, 36)
    : randomUUID().slice(0, 12)
  const session: ServerSession = {
    id: cleanId,
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    turns: [],
  }
  sessions.set(session.id, session)
  return session
}

/** Add a turn to a session, trimming if needed */
function addSessionTurn(session: ServerSession, turn: SessionTurn): void {
  session.turns.push(turn)
  session.updated = new Date().toISOString()
  if (session.turns.length > SESSION_MAX_TURNS) {
    session.turns = session.turns.slice(-SESSION_MAX_TURNS)
  }
}

// ── Request / Response helpers ──

function setCors(res: ServerResponse, origin: string): void {
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
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

async function parseJson(req: IncomingMessage): Promise<unknown> {
  const raw = await readBodySafe(req)
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    throw new Error('Invalid JSON body')
  }
}

// ── SSE helpers ──

function sseStart(res: ServerResponse): void {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })
}

function sseSend(res: ServerResponse, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

function sseEnd(res: ServerResponse): void {
  res.write('event: done\ndata: [DONE]\n\n')
  res.end()
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

// ── Route matching ──

function matchRoute(method: string, path: string, pattern: string, expectedMethod: string): RegExpMatchArray | null {
  if (method !== expectedMethod) return null
  const regex = new RegExp('^' + pattern.replace(/:(\w+)/g, '([^/]+)') + '$')
  return path.match(regex)
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

  // Prune expired sessions and rate limit buckets every 10 minutes
  const pruneInterval = setInterval(() => { pruneSessions(); pruneRateBuckets() }, 10 * 60 * 1000)

  const server = createServer(async (req, res) => {
    requestCount++

    // Security headers on every response
    setSecurityHeaders(res)

    // CORS
    setCors(res, corsOrigin)
    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    // Rate limiting
    const clientIp = getClientIp(req)
    if (!checkRateLimit(clientIp)) {
      res.setHeader('Retry-After', '60')
      error(res, 429, 'Rate limit exceeded (120 requests/minute). Retry after 60 seconds.')
      return
    }

    // Auth — constant-time comparison to prevent timing attacks
    if (requiredToken) {
      const auth = req.headers.authorization
      const provided = auth?.startsWith('Bearer ') ? auth.slice(7) : ''
      if (provided.length !== requiredToken.length || !timingSafeEqual(provided, requiredToken)) {
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

      // ── Execute single tool with SSE streaming ──
      if (path === '/v1/tools/execute/stream' && req.method === 'POST') {
        const body = await parseJson(req) as { name?: string; arguments?: Record<string, unknown>; call_id?: string }
        if (!body.name) {
          error(res, 400, 'Missing required field: name')
          return
        }

        const callId = body.call_id || `srv_stream_${Date.now()}`
        const call: ToolCall = {
          id: callId,
          name: body.name,
          arguments: body.arguments || {},
        }

        sseStart(res)
        sseSend(res, 'tool_start', { tool_call_id: callId, name: body.name, status: 'executing' })

        const result = await executeTool(call)

        sseSend(res, 'tool_result', {
          tool_call_id: result.tool_call_id,
          result: result.result,
          error: result.error || false,
          duration_ms: result.duration_ms,
        })
        sseEnd(res)
        return
      }

      // ── Batch execute tools (parallel) ──
      if (path === '/v1/tools/batch' && req.method === 'POST') {
        const body = await parseJson(req) as {
          calls?: Array<{ name: string; arguments?: Record<string, unknown>; call_id?: string }>
          stream?: boolean
        }
        if (!body.calls || !Array.isArray(body.calls)) {
          error(res, 400, 'Missing required field: calls (array)')
          return
        }
        if (body.calls.length > MAX_BATCH_SIZE) {
          error(res, 400, `Batch too large: max ${MAX_BATCH_SIZE} calls per request`)
          return
        }

        const calls: ToolCall[] = body.calls.map((c, i) => ({
          id: c.call_id || `srv_batch_${Date.now()}_${i}`,
          name: c.name,
          arguments: c.arguments || {},
        }))

        // Streaming batch — sends each result as it completes
        if (body.stream) {
          sseStart(res)
          sseSend(res, 'batch_start', { count: calls.length })

          const promises = calls.map(async (call) => {
            const result = await executeTool(call)
            sseSend(res, 'tool_result', {
              tool_call_id: result.tool_call_id,
              name: call.name,
              result: result.result,
              error: result.error || false,
              duration_ms: result.duration_ms,
            })
            return result
          })

          await Promise.all(promises)
          sseEnd(res)
          return
        }

        // Non-streaming batch
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
          session_id?: string
        }
        if (!body.message) {
          error(res, 400, 'Missing required field: message')
          return
        }

        // Sanitize input
        const message = sanitize(body.message)

        // Session handling
        const session = body.session_id ? getOrCreateSession(body.session_id) : null
        if (body.session_id && !session) {
          error(res, 429, 'Too many active sessions. Delete unused sessions or wait for expiry.')
          return
        }

        const agentOpts: AgentOptions = {
          agent: body.agent || opts.agent || 'auto',
          model: body.model,
          context: projectContext,
          tier,
          thinking: body.thinking,
        }

        const response = await runAgent(message, agentOpts)

        // Record in session if active
        if (session) {
          addSessionTurn(session, {
            role: 'user',
            content: message,
            timestamp: new Date().toISOString(),
          })
          addSessionTurn(session, {
            role: 'assistant',
            content: response.content,
            agent: response.agent,
            tool_calls: response.toolCalls,
            timestamp: new Date().toISOString(),
          })
        }

        json(res, 200, {
          content: response.content,
          agent: response.agent,
          model: response.model,
          tool_calls: response.toolCalls,
          thinking: response.thinking || undefined,
          usage: response.usage,
          session_id: session?.id || undefined,
        })
        return
      }

      // ── Full agent loop with SSE streaming ──
      if (path === '/v1/chat/stream' && req.method === 'POST') {
        const body = await parseJson(req) as {
          message?: string
          agent?: string
          model?: string
          thinking?: boolean
          session_id?: string
        }
        if (!body.message) {
          error(res, 400, 'Missing required field: message')
          return
        }

        const streamMessage = sanitize(body.message)
        const session = body.session_id ? getOrCreateSession(body.session_id) : null
        if (body.session_id && !session) {
          error(res, 429, 'Too many active sessions.')
          return
        }

        sseStart(res)
        sseSend(res, 'chat_start', {
          message: streamMessage,
          agent: body.agent || 'auto',
          session_id: session?.id || undefined,
        })

        const agentOpts: AgentOptions = {
          agent: body.agent || opts.agent || 'auto',
          model: body.model,
          context: projectContext,
          tier,
          thinking: body.thinking,
        }

        const response = await runAgent(streamMessage, agentOpts)

        // Record in session
        if (session) {
          addSessionTurn(session, {
            role: 'user',
            content: streamMessage,
            timestamp: new Date().toISOString(),
          })
          addSessionTurn(session, {
            role: 'assistant',
            content: response.content,
            agent: response.agent,
            tool_calls: response.toolCalls,
            timestamp: new Date().toISOString(),
          })
        }

        sseSend(res, 'chat_result', {
          content: response.content,
          agent: response.agent,
          model: response.model,
          tool_calls: response.toolCalls,
          thinking: response.thinking || undefined,
          usage: response.usage,
          session_id: session?.id || undefined,
        })
        sseEnd(res)
        return
      }

      // ── Sessions: Create ──
      if (path === '/v1/sessions' && req.method === 'POST') {
        const body = await parseJson(req) as { id?: string; metadata?: Record<string, unknown> }
        const session = getOrCreateSession(body.id)
        if (!session) {
          error(res, 429, `Too many active sessions (max ${MAX_SESSIONS}). Delete unused sessions or wait for expiry.`)
          return
        }
        if (body.metadata) session.metadata = body.metadata
        json(res, 201, {
          id: session.id,
          created: session.created,
          turns: session.turns.length,
        })
        return
      }

      // ── Sessions: List ──
      if (path === '/v1/sessions' && req.method === 'GET') {
        pruneSessions()
        const list = Array.from(sessions.values()).map(s => ({
          id: s.id,
          created: s.created,
          updated: s.updated,
          turns: s.turns.length,
          preview: s.turns.find(t => t.role === 'user')?.content.slice(0, 100) || '',
          agent: s.agent,
        }))
        json(res, 200, { sessions: list, count: list.length })
        return
      }

      // ── Sessions: Get / Delete by ID ──
      const sessionMatch = path.match(/^\/v1\/sessions\/([^/]+)$/)
      if (sessionMatch) {
        const sessionId = sessionMatch[1]

        if (req.method === 'GET') {
          const session = sessions.get(sessionId)
          if (!session) {
            error(res, 404, `Session not found: ${sessionId}`)
            return
          }
          json(res, 200, session)
          return
        }

        if (req.method === 'DELETE') {
          const existed = sessions.delete(sessionId)
          json(res, 200, { deleted: existed, id: sessionId })
          return
        }
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
          active_sessions: sessions.size,
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
      console.log(`    GET  /v1/tools                List tools (?format=openai|anthropic|gemini)`)
      console.log(`    POST /v1/tools/execute        Execute tool { name, arguments }`)
      console.log(`    POST /v1/tools/execute/stream  Execute tool with SSE streaming`)
      console.log(`    POST /v1/tools/batch           Parallel tools { calls: [...], stream? }`)
      console.log(`    POST /v1/chat                 Agent loop { message, session_id? }`)
      console.log(`    POST /v1/chat/stream           Agent loop with SSE streaming`)
      console.log(`    POST /v1/sessions             Create session`)
      console.log(`    GET  /v1/sessions             List sessions`)
      console.log(`    GET  /v1/sessions/:id         Get session`)
      console.log(`    DELETE /v1/sessions/:id       Delete session`)
      console.log(`    GET  /v1/context              Project context`)
      console.log(`    GET  /v1/memory               Learning & user profile`)
      console.log(`    GET  /v1/status               Server status & metrics`)
      console.log(`    GET  /health                  Health check`)
      console.log()
      console.log(`  Examples:`)
      console.log()
      console.log(`    # Start a multi-turn session`)
      console.log(`    curl -X POST localhost:${port}/v1/sessions`)
      console.log(`    # → {"id":"a1b2c3d4","created":"..."}`)
      console.log()
      console.log(`    # Chat with session (multi-turn)`)
      console.log(`    curl -X POST localhost:${port}/v1/chat \\`)
      console.log(`      -H 'Content-Type: application/json' \\`)
      console.log(`      -d '{"message":"read src/auth.ts","session_id":"a1b2c3d4"}'`)
      console.log()
      console.log(`    # Stream tool execution`)
      console.log(`    curl -N -X POST localhost:${port}/v1/tools/execute/stream \\`)
      console.log(`      -H 'Content-Type: application/json' \\`)
      console.log(`      -d '{"name":"bash","arguments":{"command":"npm test"}}'`)
      console.log()
      console.log(`    # Get tools for your LLM`)
      console.log(`    curl localhost:${port}/v1/tools?format=openai`)
      console.log(`    curl localhost:${port}/v1/tools?format=anthropic`)
      console.log(`    curl localhost:${port}/v1/tools?format=gemini`)
      console.log()
      console.log(`  Security:`)
      console.log(`    Rate limit:    ${RATE_LIMIT} req/min per IP`)
      console.log(`    Max body:      ${MAX_BODY_SIZE / 1024}KB`)
      console.log(`    Max batch:     ${MAX_BATCH_SIZE} tools/request`)
      console.log(`    Max sessions:  ${MAX_SESSIONS}`)
      console.log(`    Session TTL:   ${SESSION_TTL_MS / 3600000}h`)
      if (!requiredToken) {
        console.log()
        console.log(`  ⚠ WARNING: No auth token set. Use --token for production.`)
        console.log(`    Anyone who can reach this port can execute tools on your machine.`)
      }
      console.log()
      console.log(`  Press Ctrl+C to stop.`)
      console.log()
    }
  })

  // Graceful shutdown
  const shutdown = (): void => {
    clearInterval(pruneInterval)
    if (!opts.quiet) console.log('\n  Shutting down K:BOT server...')
    server.close(() => process.exit(0))
    // Force exit after 5s
    setTimeout(() => process.exit(1), 5000)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}
