// kbot MCP-Native Plugin System
//
// Plugins are MCP servers — discovered, started, and consumed natively.
// Two discovery methods:
//   1. ~/.kbot/plugins.json — explicit MCP server configs
//   2. ~/.kbot/plugins/*/package.json — packages with "kbot": { "mcp": true }
//
// Each plugin is an MCP server process communicating over stdio.
// The agent can list all plugin tools and call them through meta-tools.

import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { registerTool } from './tools/index.js'

// ── Types ──

export interface McpPluginConfig {
  command: string
  args?: string[]
  env?: Record<string, string>
}

export interface PluginsJsonConfig {
  plugins: Record<string, McpPluginConfig>
}

export interface PluginToolInfo {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export type PluginHealth = 'starting' | 'healthy' | 'unhealthy' | 'stopped'

export interface PluginState {
  id: string
  config: McpPluginConfig
  source: 'plugins.json' | 'package.json'
  health: PluginHealth
  process: ChildProcess | null
  messageId: number
  pending: Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>
  buffer: string
  tools: PluginToolInfo[]
  startedAt: string | null
  error: string | null
}

export interface PluginStatus {
  id: string
  health: PluginHealth
  tools: number
  startedAt: string | null
  error: string | null
  source: 'plugins.json' | 'package.json'
}

// ── Constants ──

const KBOT_DIR = join(homedir(), '.kbot')
const PLUGINS_JSON = join(KBOT_DIR, 'plugins.json')
const PLUGINS_DIR = join(KBOT_DIR, 'plugins')
const STARTUP_TIMEOUT_MS = 30_000
const REQUEST_TIMEOUT_MS = 30_000

// ── JSON-RPC helpers ──

interface JsonRpcMessage {
  jsonrpc: '2.0'
  id?: number
  method?: string
  params?: unknown
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}

function encodeJsonRpc(msg: JsonRpcMessage): string {
  const body = JSON.stringify(msg)
  return `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`
}

// ── Plugin registry ──

const plugins = new Map<string, PluginState>()

/** Parse incoming JSON-RPC messages from a plugin's stdout buffer */
function parseMessages(plugin: PluginState): void {
  while (true) {
    const headerEnd = plugin.buffer.indexOf('\r\n\r\n')
    if (headerEnd === -1) break

    const header = plugin.buffer.slice(0, headerEnd)
    const lengthMatch = header.match(/Content-Length:\s*(\d+)/i)
    if (!lengthMatch) {
      plugin.buffer = plugin.buffer.slice(headerEnd + 4)
      continue
    }

    const contentLength = parseInt(lengthMatch[1], 10)
    const bodyStart = headerEnd + 4
    if (plugin.buffer.length < bodyStart + contentLength) break

    const body = plugin.buffer.slice(bodyStart, bodyStart + contentLength)
    plugin.buffer = plugin.buffer.slice(bodyStart + contentLength)

    try {
      const msg: JsonRpcMessage = JSON.parse(body)
      if (msg.id !== undefined && plugin.pending.has(msg.id)) {
        const entry = plugin.pending.get(msg.id)!
        plugin.pending.delete(msg.id)
        clearTimeout(entry.timer)
        if (msg.error) {
          entry.reject(new Error(msg.error.message))
        } else {
          entry.resolve(msg.result)
        }
      }
    } catch {
      // skip malformed messages
    }
  }
}

/** Send a JSON-RPC request and await the response */
function sendRequest(plugin: PluginState, method: string, params: unknown, timeoutMs = REQUEST_TIMEOUT_MS): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!plugin.process?.stdin?.writable) {
      reject(new Error(`Plugin "${plugin.id}" process is not available`))
      return
    }

    const id = ++plugin.messageId
    const timer = setTimeout(() => {
      if (plugin.pending.has(id)) {
        plugin.pending.delete(id)
        reject(new Error(`Plugin "${plugin.id}" request timeout: ${method} (${timeoutMs}ms)`))
      }
    }, timeoutMs)

    plugin.pending.set(id, { resolve, reject, timer })
    const msg: JsonRpcMessage = { jsonrpc: '2.0', id, method, params }
    plugin.process.stdin.write(encodeJsonRpc(msg))
  })
}

/** Send a JSON-RPC notification (no response expected) */
function sendNotification(plugin: PluginState, method: string, params: unknown): void {
  if (!plugin.process?.stdin?.writable) return
  const msg: JsonRpcMessage = { jsonrpc: '2.0', method, params }
  plugin.process.stdin.write(encodeJsonRpc(msg))
}

// ── Discovery ──

/** Discover all configured MCP plugins from plugins.json and package.json sources */
export function discoverPlugins(): Map<string, { config: McpPluginConfig; source: 'plugins.json' | 'package.json' }> {
  const discovered = new Map<string, { config: McpPluginConfig; source: 'plugins.json' | 'package.json' }>()

  // Source 1: ~/.kbot/plugins.json
  if (existsSync(PLUGINS_JSON)) {
    try {
      const raw = readFileSync(PLUGINS_JSON, 'utf-8')
      const parsed: PluginsJsonConfig = JSON.parse(raw)

      if (parsed.plugins && typeof parsed.plugins === 'object') {
        for (const [id, config] of Object.entries(parsed.plugins)) {
          if (!config.command || typeof config.command !== 'string') continue
          discovered.set(id, {
            config: {
              command: config.command,
              args: Array.isArray(config.args) ? config.args : [],
              env: config.env && typeof config.env === 'object' ? config.env : {},
            },
            source: 'plugins.json',
          })
        }
      }
    } catch {
      // Malformed plugins.json — skip silently
    }
  }

  // Source 2: ~/.kbot/plugins/*/package.json with "kbot": { "mcp": true }
  if (existsSync(PLUGINS_DIR)) {
    try {
      const entries = readdirSync(PLUGINS_DIR)
      for (const entry of entries) {
        const entryPath = join(PLUGINS_DIR, entry)
        try {
          const stat = statSync(entryPath)
          if (!stat.isDirectory()) continue
        } catch {
          continue
        }

        const pkgPath = join(entryPath, 'package.json')
        if (!existsSync(pkgPath)) continue

        try {
          const raw = readFileSync(pkgPath, 'utf-8')
          const pkg = JSON.parse(raw)

          if (pkg.kbot?.mcp !== true) continue

          // Determine command: use "bin" field or default to "node ."
          let command: string
          let args: string[]
          if (typeof pkg.bin === 'string') {
            command = 'node'
            args = [join(entryPath, pkg.bin)]
          } else if (pkg.bin && typeof pkg.bin === 'object') {
            const firstBin = Object.values(pkg.bin)[0] as string
            command = 'node'
            args = [join(entryPath, firstBin)]
          } else if (pkg.main) {
            command = 'node'
            args = [join(entryPath, pkg.main)]
          } else {
            command = 'node'
            args = [entryPath]
          }

          const id = pkg.name || entry
          // Don't overwrite plugins.json entries — explicit config takes priority
          if (!discovered.has(id)) {
            discovered.set(id, {
              config: { command, args, env: {} },
              source: 'package.json',
            })
          }
        } catch {
          // Malformed package.json — skip
        }
      }
    } catch {
      // Can't read plugins dir — skip
    }
  }

  return discovered
}

// ── Lifecycle ──

/** Start a single plugin by ID. Spawns the process, performs MCP handshake, fetches tools. */
export async function startPlugin(id: string): Promise<PluginState> {
  // Check if already running
  const existing = plugins.get(id)
  if (existing && (existing.health === 'healthy' || existing.health === 'starting')) {
    return existing
  }

  // Discover if not already in registry
  const discovered = discoverPlugins()
  const entry = discovered.get(id)
  if (!entry) {
    throw new Error(`Plugin "${id}" not found in plugins.json or plugin packages`)
  }

  const state: PluginState = {
    id,
    config: entry.config,
    source: entry.source,
    health: 'starting',
    process: null,
    messageId: 0,
    pending: new Map(),
    buffer: '',
    tools: [],
    startedAt: null,
    error: null,
  }

  plugins.set(id, state)

  // Spawn the process
  const { command, args = [], env = {} } = entry.config
  let proc: ChildProcess
  try {
    proc = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...env },
    })
  } catch (err) {
    state.health = 'unhealthy'
    state.error = `Failed to spawn: ${err instanceof Error ? err.message : String(err)}`
    return state
  }

  state.process = proc

  // Wire up stdout for JSON-RPC message parsing
  proc.stdout?.on('data', (chunk: Buffer) => {
    state.buffer += chunk.toString()
    parseMessages(state)
  })

  // Collect stderr for diagnostics
  let stderrBuffer = ''
  proc.stderr?.on('data', (chunk: Buffer) => {
    stderrBuffer += chunk.toString()
    // Cap stderr buffer at 4KB
    if (stderrBuffer.length > 4096) {
      stderrBuffer = stderrBuffer.slice(-4096)
    }
  })

  // Handle unexpected process exit
  proc.on('error', (err) => {
    state.health = 'unhealthy'
    state.error = `Process error: ${err.message}`
    // Reject all pending requests
    for (const [reqId, entry] of state.pending) {
      clearTimeout(entry.timer)
      entry.reject(new Error(`Plugin "${id}" process crashed`))
      state.pending.delete(reqId)
    }
  })

  proc.on('exit', (code, signal) => {
    if (state.health !== 'stopped') {
      state.health = 'unhealthy'
      state.error = `Process exited unexpectedly (code=${code}, signal=${signal})${stderrBuffer ? ` stderr: ${stderrBuffer.slice(0, 500)}` : ''}`
    }
    state.process = null
    // Reject all pending requests
    for (const [reqId, entry] of state.pending) {
      clearTimeout(entry.timer)
      entry.reject(new Error(`Plugin "${id}" process exited`))
      state.pending.delete(reqId)
    }
  })

  // Perform MCP initialize handshake with startup timeout
  try {
    const initResult = await sendRequest(state, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'kbot', version: '2.0.0' },
    }, STARTUP_TIMEOUT_MS) as { capabilities?: Record<string, unknown> }

    sendNotification(state, 'initialized', {})

    // Fetch available tools
    try {
      const toolsResult = await sendRequest(state, 'tools/list', {}) as {
        tools?: PluginToolInfo[]
      }
      state.tools = toolsResult?.tools || []
    } catch {
      // Server may not expose tools — that's fine
      state.tools = []
    }

    state.health = 'healthy'
    state.startedAt = new Date().toISOString()
    state.error = null

    return state
  } catch (err) {
    state.health = 'unhealthy'
    state.error = `Handshake failed: ${err instanceof Error ? err.message : String(err)}${stderrBuffer ? ` stderr: ${stderrBuffer.slice(0, 500)}` : ''}`
    // Kill the process since handshake failed
    try { proc.kill() } catch { /* ignore */ }
    state.process = null
    return state
  }
}

/** Stop a single plugin gracefully */
export async function stopPlugin(id: string): Promise<void> {
  const state = plugins.get(id)
  if (!state) return

  state.health = 'stopped'

  if (state.process) {
    // Attempt graceful shutdown via MCP protocol
    try {
      await sendRequest(state, 'shutdown', null, 5000)
      sendNotification(state, 'exit', null)
    } catch {
      // Force kill if graceful shutdown fails
    }

    // Ensure process is terminated
    try { state.process.kill() } catch { /* ignore */ }
    state.process = null
  }

  // Clear all pending requests
  for (const [, entry] of state.pending) {
    clearTimeout(entry.timer)
    entry.reject(new Error(`Plugin "${id}" stopped`))
  }
  state.pending.clear()
}

/** Start all discovered plugins */
export async function startAllPlugins(): Promise<PluginStatus[]> {
  const discovered = discoverPlugins()
  const results: PluginStatus[] = []

  // Start plugins concurrently but collect results
  const promises = Array.from(discovered.keys()).map(async (id) => {
    try {
      const state = await startPlugin(id)
      results.push({
        id: state.id,
        health: state.health,
        tools: state.tools.length,
        startedAt: state.startedAt,
        error: state.error,
        source: state.source,
      })
    } catch (err) {
      results.push({
        id,
        health: 'unhealthy',
        tools: 0,
        startedAt: null,
        error: err instanceof Error ? err.message : String(err),
        source: discovered.get(id)!.source,
      })
    }
  })

  await Promise.allSettled(promises)
  return results
}

/** Stop all running plugins */
export async function stopAllPlugins(): Promise<void> {
  const ids = Array.from(plugins.keys())
  await Promise.allSettled(ids.map(id => stopPlugin(id)))
  plugins.clear()
}

/** Get tools exposed by a specific plugin */
export function getPluginTools(id: string): PluginToolInfo[] {
  const state = plugins.get(id)
  if (!state) return []
  return state.tools
}

/** Call a tool on a specific plugin */
export async function callPluginTool(
  id: string,
  toolName: string,
  args: Record<string, unknown> = {}
): Promise<string> {
  const state = plugins.get(id)
  if (!state) {
    throw new Error(`Plugin "${id}" not found. Start it first with startPlugin().`)
  }

  if (state.health !== 'healthy') {
    throw new Error(`Plugin "${id}" is ${state.health}${state.error ? `: ${state.error}` : ''}`)
  }

  // Verify the tool exists on this plugin
  const tool = state.tools.find(t => t.name === toolName)
  if (!tool) {
    const available = state.tools.map(t => t.name).join(', ')
    throw new Error(`Tool "${toolName}" not found on plugin "${id}". Available: ${available || '(none)'}`)
  }

  const result = await sendRequest(state, 'tools/call', {
    name: toolName,
    arguments: args,
  }) as { content?: Array<{ type: string; text?: string }> }

  if (result?.content) {
    return result.content.map(c => c.text || JSON.stringify(c)).join('\n')
  }

  return JSON.stringify(result, null, 2)
}

/** Get health status of all plugins */
export function getPluginStatus(): PluginStatus[] {
  const statuses: PluginStatus[] = []

  for (const [, state] of plugins) {
    statuses.push({
      id: state.id,
      health: state.health,
      tools: state.tools.length,
      startedAt: state.startedAt,
      error: state.error,
      source: state.source,
    })
  }

  return statuses
}

// ── Auto-cleanup on process exit ──

function cleanup(): void {
  for (const [, state] of plugins) {
    if (state.process) {
      try { state.process.kill() } catch { /* ignore */ }
    }
  }
  plugins.clear()
}

process.on('exit', cleanup)
process.on('SIGINT', () => { cleanup(); process.exit(0) })
process.on('SIGTERM', () => { cleanup(); process.exit(0) })

// ── Agent tool registration ──

/** Register meta-tools for the agent to interact with MCP plugins */
export function registerMcpPluginTools(): void {
  registerTool({
    name: 'mcp_plugin_list',
    description: [
      'List all available MCP plugin tools.',
      'Shows discovered plugins, their health status, and the tools each one exposes.',
      'Use this to find available plugin tools before calling them with mcp_plugin_call.',
    ].join(' '),
    parameters: {
      plugin_id: {
        type: 'string',
        description: 'Optional: filter to a specific plugin ID. Omit to list all.',
        required: false,
      },
    },
    tier: 'free',
    async execute(args) {
      const filterId = args.plugin_id ? String(args.plugin_id) : null

      // If no plugins are started, try discovery to show what's available
      if (plugins.size === 0) {
        const discovered = discoverPlugins()
        if (discovered.size === 0) {
          return [
            'No MCP plugins configured.',
            '',
            'To add plugins, create ~/.kbot/plugins.json:',
            '{',
            '  "plugins": {',
            '    "my-plugin": {',
            '      "command": "npx",',
            '      "args": ["-y", "kbot-plugin-example"],',
            '      "env": {}',
            '    }',
            '  }',
            '}',
            '',
            'Or install a package in ~/.kbot/plugins/ with "kbot": { "mcp": true } in its package.json.',
          ].join('\n')
        }

        const lines = ['Discovered plugins (not yet started):', '']
        for (const [id, entry] of discovered) {
          if (filterId && id !== filterId) continue
          lines.push(`  ${id} (${entry.source})`)
          lines.push(`    command: ${entry.config.command} ${(entry.config.args || []).join(' ')}`)
        }
        lines.push('')
        lines.push('Plugins need to be started before their tools are available.')
        return lines.join('\n')
      }

      const lines: string[] = []

      for (const [, state] of plugins) {
        if (filterId && state.id !== filterId) continue

        const healthIcon = state.health === 'healthy' ? '[OK]' : state.health === 'starting' ? '[..]' : '[!!]'
        lines.push(`${healthIcon} ${state.id} (${state.source}) — ${state.health}`)

        if (state.error) {
          lines.push(`    error: ${state.error}`)
        }

        if (state.tools.length > 0) {
          lines.push(`    tools (${state.tools.length}):`)
          for (const tool of state.tools) {
            lines.push(`      - ${tool.name}: ${tool.description || '(no description)'}`)
          }
        } else {
          lines.push('    tools: none')
        }

        lines.push('')
      }

      if (lines.length === 0 && filterId) {
        return `Plugin "${filterId}" not found. Use mcp_plugin_list without a filter to see all plugins.`
      }

      return lines.join('\n')
    },
  })

  registerTool({
    name: 'mcp_plugin_call',
    description: [
      'Call a tool exposed by an MCP plugin.',
      'First use mcp_plugin_list to discover available plugins and their tools.',
      'If the target plugin is not running, it will be auto-started.',
    ].join(' '),
    parameters: {
      plugin_id: {
        type: 'string',
        description: 'The plugin ID (e.g., "my-plugin")',
        required: true,
      },
      tool: {
        type: 'string',
        description: 'The tool name to call on the plugin',
        required: true,
      },
      arguments: {
        type: 'object',
        description: 'Arguments to pass to the tool (JSON object)',
        required: false,
      },
    },
    tier: 'free',
    async execute(args) {
      const pluginId = String(args.plugin_id)
      const toolName = String(args.tool)
      const toolArgs = (args.arguments as Record<string, unknown>) || {}

      // Auto-start the plugin if it's not running or unhealthy
      let state = plugins.get(pluginId)
      if (!state || state.health === 'unhealthy' || state.health === 'stopped') {
        try {
          state = await startPlugin(pluginId)
        } catch (err) {
          return `Error: Could not start plugin "${pluginId}": ${err instanceof Error ? err.message : String(err)}`
        }

        if (state.health !== 'healthy') {
          return `Error: Plugin "${pluginId}" failed to start: ${state.error || 'unknown error'}`
        }
      }

      try {
        return await callPluginTool(pluginId, toolName, toolArgs)
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })
}
