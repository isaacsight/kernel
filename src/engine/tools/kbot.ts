// ─── K:BOT Integration ──────────────────────────────────────
//
// Connects the Kernel frontend to a K:BOT backend server.
// Fetches available tools from K:BOT's /v1/tools endpoint and
// registers them into the local tool registry so Claude can
// call them like any other tool.
//
// Usage:
//   await connectKbot('http://localhost:7437')
//   await connectKbot('https://kbot.example.com', 'my-secret-token')

import { registerTool, removeTool, getAllTools } from './registry'
import type { Tool, ToolResult } from './types'

const KBOT_TOOL_PREFIX = 'kbot_'
const CONNECT_TIMEOUT_MS = 5_000
const EXECUTE_TIMEOUT_MS = 30_000

export interface KbotConnection {
  baseUrl: string
  token?: string
  toolCount: number
  version?: string
}

let activeConnection: KbotConnection | null = null

/** Get the current K:BOT connection, or null if not connected */
export function getKbotConnection(): KbotConnection | null {
  return activeConnection
}

/** Check if K:BOT is connected */
export function isKbotConnected(): boolean {
  return activeConnection !== null
}

/** Build headers for K:BOT requests */
function buildHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

/** Execute a tool on the K:BOT server */
async function executeKbotTool(
  baseUrl: string,
  toolName: string,
  args: Record<string, unknown>,
  token?: string,
): Promise<ToolResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), EXECUTE_TIMEOUT_MS)

  try {
    const res = await fetch(`${baseUrl}/v1/tools/execute`, {
      method: 'POST',
      headers: buildHeaders(token),
      body: JSON.stringify({ name: toolName, arguments: args }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const errText = await res.text()
      return { success: false, data: null, error: `K:BOT error (${res.status}): ${errText}` }
    }

    const data = await res.json()
    if (data.error) {
      return { success: false, data: data.result, error: data.error }
    }
    return { success: true, data: data.result }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, data: null, error: `K:BOT request failed: ${message}` }
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Connect to a K:BOT server and register all its tools.
 *
 * Fetches the tool list from GET /v1/tools?format=anthropic, then registers
 * each tool into the Kernel tool registry with a `kbot_` prefix so they
 * coexist with local tools.
 */
export async function connectKbot(baseUrl: string, token?: string): Promise<KbotConnection> {
  // Normalize URL — strip trailing slash
  const url = baseUrl.replace(/\/+$/, '')

  // Verify connectivity with health check
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), CONNECT_TIMEOUT_MS)

  let version: string | undefined
  try {
    const healthRes = await fetch(`${url}/health`, {
      headers: buildHeaders(token),
      signal: controller.signal,
    })
    if (!healthRes.ok) throw new Error(`Health check failed: ${healthRes.status}`)
    const health = await healthRes.json()
    version = health.version
  } catch (err) {
    throw new Error(`Cannot reach K:BOT at ${url}: ${err instanceof Error ? err.message : err}`)
  } finally {
    clearTimeout(timeout)
  }

  // Fetch tool definitions in Anthropic format
  const toolsRes = await fetch(`${url}/v1/tools?format=anthropic`, {
    headers: buildHeaders(token),
  })
  if (!toolsRes.ok) throw new Error(`Failed to fetch K:BOT tools: ${toolsRes.status}`)

  const { tools: kbotTools } = await toolsRes.json() as {
    tools: Array<{ name: string; description: string; input_schema: Record<string, unknown> }>
  }

  // Remove any previously registered kbot tools
  disconnectKbot()

  // Register each K:BOT tool into the local registry
  for (const kt of kbotTools) {
    const localName = `${KBOT_TOOL_PREFIX}${kt.name.replace(/[^a-zA-Z0-9_-]/g, '_')}`

    const tool: Tool = {
      name: localName,
      description: `[K:BOT] ${kt.description}`,
      parameters: (kt.input_schema?.properties ?? kt.input_schema ?? {}) as Record<string, unknown>,
      category: 'external',
      requiresApproval: isDestructiveTool(kt.name),
      execute: async (args: Record<string, unknown>) => {
        return executeKbotTool(url, kt.name, args, token)
      },
    }

    registerTool(tool)
  }

  activeConnection = { baseUrl: url, token, toolCount: kbotTools.length, version }
  console.log(`[K:BOT] Connected to ${url} — ${kbotTools.length} tools registered`)
  return activeConnection
}

/** Disconnect from K:BOT and remove all kbot_ tools */
export function disconnectKbot(): void {
  const kbotTools = getAllTools().filter(t => t.name.startsWith(KBOT_TOOL_PREFIX))
  for (const t of kbotTools) {
    removeTool(t.name)
  }
  activeConnection = null
}

/** Tools that modify the filesystem or run commands need HITL approval */
function isDestructiveTool(name: string): boolean {
  const destructivePatterns = ['bash', 'write', 'edit', 'delete', 'remove', 'exec', 'run', 'shell']
  const lower = name.toLowerCase()
  return destructivePatterns.some(p => lower.includes(p))
}

/**
 * Invoke the K:BOT agent loop — sends a message and lets K:BOT pick tools.
 * This bypasses the local tool registry and uses K:BOT's own agent.
 */
export async function chatWithKbot(
  message: string,
  opts?: { agent?: string; model?: string; sessionId?: string },
): Promise<{ content: string; agent?: string; toolCalls?: number; sessionId?: string }> {
  if (!activeConnection) throw new Error('K:BOT not connected. Call connectKbot() first.')

  const res = await fetch(`${activeConnection.baseUrl}/v1/chat`, {
    method: 'POST',
    headers: buildHeaders(activeConnection.token),
    body: JSON.stringify({
      message,
      agent: opts?.agent,
      model: opts?.model,
      session_id: opts?.sessionId,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`K:BOT chat error (${res.status}): ${errText}`)
  }

  const data = await res.json()
  return {
    content: data.content,
    agent: data.agent,
    toolCalls: data.tool_calls,
    sessionId: data.session_id,
  }
}
