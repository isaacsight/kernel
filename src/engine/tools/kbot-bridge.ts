// ─── K:BOT Bridge ──────────────────────────────────────────
//
// Connects the browser to a running K:BOT instance (local or remote).
// Fetches all tool schemas and registers proxy tools that execute
// on the K:BOT machine via HTTP.
//
// Usage:
//   import { connectKbot, disconnectKbot, getKbotStatus } from './kbot-bridge'
//   await connectKbot('http://localhost:7437')

import { registerTool, removeTool, getAllTools } from './registry'
import type { Tool, ToolResult } from './types'

const KBOT_TOOL_PREFIX = 'kbot_'

interface KbotConnection {
  url: string
  token?: string
  toolCount: number
  connectedAt: Date
  version: string
}

let connection: KbotConnection | null = null
const registeredKbotTools = new Set<string>()

/**
 * Connect to a running K:BOT instance and register all its tools.
 * Each remote tool is registered as `kbot_<original_name>` in the local registry.
 */
export async function connectKbot(
  url: string,
  token?: string,
): Promise<{ tools: number; version: string }> {
  // Clean URL
  const baseUrl = url.replace(/\/+$/, '')

  // Check health
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`

  const healthRes = await fetch(`${baseUrl}/health`, { headers })
  if (!healthRes.ok) throw new Error(`K:BOT not reachable at ${baseUrl}`)
  const health = await healthRes.json() as { status: string; version: string; tools: number }

  // Fetch tool schemas
  const toolsRes = await fetch(`${baseUrl}/tools`, { headers })
  if (!toolsRes.ok) throw new Error('Failed to fetch K:BOT tools')
  const { tools } = await toolsRes.json() as {
    tools: Array<{
      name: string
      description: string
      input_schema: { type: string; properties: Record<string, unknown>; required?: string[] }
    }>
    count: number
  }

  // Disconnect any existing connection first
  if (connection) disconnectKbot()

  // Register each remote tool as a proxy
  for (const schema of tools) {
    const proxyName = `${KBOT_TOOL_PREFIX}${schema.name}`

    const proxyTool: Tool = {
      name: proxyName,
      description: `[K:BOT] ${schema.description}`,
      parameters: schema.input_schema.properties as Record<string, unknown>,
      keywords: [schema.name, 'kbot', 'terminal'],
      category: 'external',
      execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
        try {
          const execHeaders: Record<string, string> = {
            'Content-Type': 'application/json',
          }
          if (token) execHeaders['Authorization'] = `Bearer ${token}`

          const res = await fetch(`${baseUrl}/execute`, {
            method: 'POST',
            headers: execHeaders,
            body: JSON.stringify({ name: schema.name, args }),
          })

          const data = await res.json() as { result: string; error?: boolean; duration_ms?: number }

          if (data.error) {
            return { success: false, data: data.result, error: data.result }
          }

          return { success: true, data: data.result }
        } catch (err) {
          return {
            success: false,
            data: null,
            error: `K:BOT execution failed: ${err instanceof Error ? err.message : String(err)}`,
          }
        }
      },
    }

    registerTool(proxyTool)
    registeredKbotTools.add(proxyName)
  }

  connection = {
    url: baseUrl,
    token,
    toolCount: tools.length,
    connectedAt: new Date(),
    version: health.version,
  }

  console.log(`[K:BOT Bridge] Connected to ${baseUrl} — ${tools.length} tools registered as kbot_*`)

  return { tools: tools.length, version: health.version }
}

/** Disconnect from K:BOT and remove all proxy tools */
export function disconnectKbot(): void {
  for (const name of registeredKbotTools) {
    removeTool(name)
  }
  registeredKbotTools.clear()
  connection = null
  console.log('[K:BOT Bridge] Disconnected')
}

/** Get current connection status */
export function getKbotStatus(): {
  connected: boolean
  url?: string
  toolCount?: number
  version?: string
  uptime?: number
} {
  if (!connection) return { connected: false }
  return {
    connected: true,
    url: connection.url,
    toolCount: connection.toolCount,
    version: connection.version,
    uptime: (Date.now() - connection.connectedAt.getTime()) / 1000,
  }
}

/** Check if a tool name is a K:BOT proxy tool */
export function isKbotTool(name: string): boolean {
  return name.startsWith(KBOT_TOOL_PREFIX)
}

/** Get all registered K:BOT tool names */
export function getKbotToolNames(): string[] {
  return Array.from(registeredKbotTools)
}

/**
 * Auto-connect to K:BOT if VITE_KBOT_BACKEND_URL is set.
 * Called at app startup — non-blocking, silent failure.
 */
export async function autoConnectKbot(): Promise<void> {
  const url = import.meta.env.VITE_KBOT_BACKEND_URL
  if (!url) return

  try {
    const token = import.meta.env.VITE_KBOT_TOKEN
    await connectKbot(url, token || undefined)
  } catch {
    // Silent — K:BOT is optional
    console.log('[K:BOT Bridge] Auto-connect failed (K:BOT not running)')
  }
}
