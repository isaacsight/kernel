// K:BOT ACP Server — Agent Client Protocol for JetBrains IDEs
//
// JSON-RPC over stdio, similar to MCP but with agent-specific semantics.
// ACP defines conversations, capabilities, and agent identity.
//
// Supported IDEs: IntelliJ IDEA, WebStorm, PyCharm, GoLand, Android Studio
//
// Usage:
//   kbot ide acp

import {
  initBridge,
  chat,
  executeCommand,
  getStatus,
  getAgents,
  getContext,
  getMemory,
  getFileDiagnostics,
  remember,
  setAgent,
  getToolList,
  type BridgeConfig,
} from './bridge.js'
import { formatDiagnostics } from './lsp-bridge.js'

interface AcpMessage {
  jsonrpc: '2.0'
  id?: number | string
  method?: string
  params?: Record<string, unknown>
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}

interface AcpCapabilities {
  chat: boolean
  codeAction: boolean
  diagnostics: boolean
  tools: boolean
}

const AGENT_IDENTITY = {
  name: 'K:BOT',
  version: '2.9.0',
  description: 'Open-source terminal AI agent — 37 specialists, 151 tools, 19 providers, local-first',
  capabilities: ['chat', 'codeAction', 'diagnostics', 'tools'] as const,
}

/** Encode a JSON-RPC message with Content-Length header (LSP-style framing) */
function encode(msg: AcpMessage): string {
  const body = JSON.stringify(msg)
  return `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`
}

/** Send a JSON-RPC response */
function respond(id: number | string, result: unknown): void {
  process.stdout.write(encode({ jsonrpc: '2.0', id, result }))
}

/** Send a JSON-RPC error */
function respondError(id: number | string, code: number, message: string): void {
  process.stdout.write(encode({ jsonrpc: '2.0', id, error: { code, message } }))
}

/** Send a JSON-RPC notification (no id) */
function notify(method: string, params: Record<string, unknown>): void {
  process.stdout.write(encode({ jsonrpc: '2.0', method, params }))
}

/**
 * Start the ACP server on stdio.
 */
export async function startAcpServer(config: BridgeConfig = {}): Promise<void> {
  await initBridge(config)

  let buffer = ''
  let initialized = false
  let conversationId = 0

  process.stdin.setEncoding('utf-8')
  process.stdin.on('data', (chunk: string) => {
    buffer += chunk
    processBuffer()
  })

  function processBuffer(): void {
    while (true) {
      const headerEnd = buffer.indexOf('\r\n\r\n')
      if (headerEnd === -1) break

      const header = buffer.slice(0, headerEnd)
      const lengthMatch = header.match(/Content-Length:\s*(\d+)/i)
      if (!lengthMatch) {
        buffer = buffer.slice(headerEnd + 4)
        continue
      }

      const contentLength = parseInt(lengthMatch[1], 10)
      const bodyStart = headerEnd + 4
      if (buffer.length < bodyStart + contentLength) break

      const body = buffer.slice(bodyStart, bodyStart + contentLength)
      buffer = buffer.slice(bodyStart + contentLength)

      try {
        const msg: AcpMessage = JSON.parse(body)
        handleMessage(msg)
      } catch (err) {
        if (process.env.KBOT_DEBUG) console.error('[acp-server] malformed message:', (err as Error).message)
      }
    }
  }

  async function handleMessage(msg: AcpMessage): Promise<void> {
    if (!msg.method) return

    // Handle requests (have id) and notifications (no id)
    const id = msg.id

    try {
      switch (msg.method) {
        // ── Lifecycle ──

        case 'initialize': {
          initialized = true
          const result = {
            agent: AGENT_IDENTITY,
            capabilities: {
              chat: true,
              codeAction: true,
              diagnostics: true,
              tools: true,
            } as AcpCapabilities,
            serverInfo: {
              name: 'kbot-acp',
              version: '2.2.0',
            },
          }
          if (id !== undefined) respond(id, result)
          break
        }

        case 'initialized':
          // Client acknowledged — no response needed
          break

        case 'shutdown':
          if (id !== undefined) respond(id, null)
          break

        case 'exit':
          process.exit(0)
          break

        // ── Chat ──

        case 'chat/send': {
          if (!initialized) {
            if (id !== undefined) respondError(id, -32002, 'Server not initialized')
            break
          }
          const params = msg.params || {}
          const message = params.message as string
          if (!message) {
            if (id !== undefined) respondError(id, -32602, 'Missing message parameter')
            break
          }

          conversationId++
          const agent = params.agent as string | undefined

          const response = await chat(message, { agent })

          if (id !== undefined) {
            respond(id, {
              conversationId,
              content: response.content,
              agent: response.agent,
              model: response.model,
              toolCalls: response.toolCalls,
              usage: response.usage,
            })
          }
          break
        }

        // ── Code Actions ──

        case 'codeAction/edit': {
          if (!initialized) {
            if (id !== undefined) respondError(id, -32002, 'Server not initialized')
            break
          }
          const params = msg.params || {}
          const result = await executeCommand('edit_file', params)
          if (id !== undefined) respond(id, { success: !result.error, output: result.result })
          break
        }

        case 'codeAction/create': {
          if (!initialized) {
            if (id !== undefined) respondError(id, -32002, 'Server not initialized')
            break
          }
          const params = msg.params || {}
          const result = await executeCommand('write_file', params)
          if (id !== undefined) respond(id, { success: !result.error, output: result.result })
          break
        }

        case 'codeAction/read': {
          if (!initialized) {
            if (id !== undefined) respondError(id, -32002, 'Server not initialized')
            break
          }
          const params = msg.params || {}
          const result = await executeCommand('read_file', params)
          if (id !== undefined) respond(id, { success: !result.error, output: result.result })
          break
        }

        // ── Diagnostics ──

        case 'diagnostics/check': {
          if (!initialized) {
            if (id !== undefined) respondError(id, -32002, 'Server not initialized')
            break
          }
          const params = msg.params || {}
          const filePath = params.path as string
          if (!filePath) {
            if (id !== undefined) respondError(id, -32602, 'Missing path parameter')
            break
          }
          const diags = await getFileDiagnostics(filePath)
          if (id !== undefined) {
            respond(id, {
              diagnostics: diags,
              summary: formatDiagnostics(diags),
            })
          }
          break
        }

        // ── Tools ──

        case 'tools/list': {
          const tools = getToolList()
          if (id !== undefined) respond(id, { tools })
          break
        }

        case 'tools/execute': {
          if (!initialized) {
            if (id !== undefined) respondError(id, -32002, 'Server not initialized')
            break
          }
          const params = msg.params || {}
          const toolName = params.name as string
          const toolArgs = (params.arguments || {}) as Record<string, unknown>
          if (!toolName) {
            if (id !== undefined) respondError(id, -32602, 'Missing tool name')
            break
          }
          const result = await executeCommand(toolName, toolArgs)
          if (id !== undefined) respond(id, { success: !result.error, output: result.result })
          break
        }

        // ── Agent ──

        case 'agent/list': {
          const agents = getAgents()
          if (id !== undefined) respond(id, { agents })
          break
        }

        case 'agent/switch': {
          const params = msg.params || {}
          const agentId = params.agent as string
          if (!agentId) {
            if (id !== undefined) respondError(id, -32602, 'Missing agent parameter')
            break
          }
          setAgent(agentId)
          if (id !== undefined) respond(id, { agent: agentId })
          break
        }

        case 'agent/status': {
          const status = getStatus()
          if (id !== undefined) respond(id, status)
          break
        }

        // ── Memory ──

        case 'memory/read': {
          const memory = getMemory()
          if (id !== undefined) respond(id, { memory })
          break
        }

        case 'memory/remember': {
          const params = msg.params || {}
          const fact = params.fact as string
          if (!fact) {
            if (id !== undefined) respondError(id, -32602, 'Missing fact parameter')
            break
          }
          remember(fact)
          if (id !== undefined) respond(id, { success: true })
          break
        }

        // ── Context ──

        case 'chat/plan': {
          if (!initialized) {
            if (id !== undefined) respondError(id, -32002, 'Server not initialized')
            break
          }
          const params = msg.params || {}
          const task = params.task as string
          if (!task) {
            if (id !== undefined) respondError(id, -32602, 'Missing task parameter')
            break
          }
          const { autonomousExecute, formatPlanSummary } = await import('../planner.js')
          const plan = await autonomousExecute(task, { agent: 'coder' }, {
            autoApprove: params.auto_approve as boolean || false,
          })
          if (id !== undefined) {
            respond(id, {
              plan: { summary: plan.summary, status: plan.status, steps: plan.steps },
              text: formatPlanSummary(plan),
            })
          }
          break
        }

        case 'context/get': {
          const ctx = getContext()
          if (id !== undefined) respond(id, { context: ctx })
          break
        }

        default:
          if (id !== undefined) respondError(id, -32601, `Method not found: ${msg.method}`)
      }
    } catch (err) {
      if (id !== undefined) {
        respondError(id, -32603, err instanceof Error ? err.message : String(err))
      }
    }
  }

  process.stderr.write('K:BOT ACP server started\n')

  // Keep process alive
  await new Promise<void>(() => {})
}
