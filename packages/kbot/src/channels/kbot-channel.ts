#!/usr/bin/env node
// kbot Channel for Claude Code
//
// Bridges kbot's cognitive engine (374+ tools, 41 agents, learning engine)
// into Claude Code sessions via the Channel protocol.
//
// Architecture:
//   External world (WhatsApp, Telegram, Slack via OpenClaw)
//       ↕ kbot Channel (this file)
//       ↕ Claude Code session
//
// One-way events: kbot pushes learning updates, agent routing, forge notifications
// Two-way: Claude Code can reply through kbot to any OpenClaw platform
// Permission relay: approve/deny tool use from your phone via OpenClaw
//
// Usage:
//   Add to .mcp.json: { "kbot-channel": { "command": "node", "args": ["path/to/kbot-channel.js"] } }
//   Start: claude --channels server:kbot-channel
//
// Jensen Huang: "Agents are the iPhone of tokens."

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { z } from 'zod'

// ── Config ──────────────────────────────────────────────────────────────────
const KBOT_PORT = parseInt(process.env.KBOT_CHANNEL_PORT || '7438', 10)
const OPENCLAW_URL = process.env.OPENCLAW_GATEWAY_URL || 'http://127.0.0.1:18789'
const KBOT_DIR = join(homedir(), '.kbot')

// ── Outbound: SSE listeners for testing / monitoring ────────────────────────
const listeners = new Set<(chunk: string) => void>()
function broadcast(text: string): void {
  const chunk = text.split('\n').map(l => `data: ${l}\n`).join('') + '\n'
  for (const emit of listeners) emit(chunk)
}

// ── Sender allowlist ────────────────────────────────────────────────────────
function loadAllowlist(): Set<string> {
  const path = join(KBOT_DIR, 'channel-allowlist.json')
  try {
    if (existsSync(path)) {
      const list = JSON.parse(readFileSync(path, 'utf-8')) as string[]
      return new Set(list)
    }
  } catch { /* ignore */ }
  // Default: allow local requests
  return new Set(['local', 'kbot', 'openclaw'])
}
const allowed = loadAllowlist()

// ── MCP Server with Channel capability ──────────────────────────────────────
const mcp = new Server(
  { name: 'kbot', version: '3.34.2' },
  {
    capabilities: {
      experimental: {
        'claude/channel': {},
        'claude/channel/permission': {},
      },
      tools: {},
    },
    instructions: `You are connected to kbot — a self-improving AI agent with 374+ tools and 41 specialist agents.

Events arrive as <channel source="kbot" ...>. They include:
- Messages from external platforms via OpenClaw (WhatsApp, Telegram, Slack, Discord, iMessage)
- Learning engine updates (new patterns, routing changes)
- Forge notifications (new tools created or installed)
- Agent status reports
- Security alerts from the self-defense system

For messages from people (has chat_id and platform attributes):
  Reply using the kbot_reply tool, passing chat_id and platform from the tag.

For system events (learning, forge, security):
  Read and act as appropriate. No reply expected.

You can also use:
  kbot_agent — delegate a task to one of kbot's 26 specialist agents
  kbot_tools — list or execute any of kbot's 374+ tools
  kbot_status — check kbot's health, learning stats, and active sessions

kbot learns from every interaction. Patterns it extracts improve future routing and responses.`,
  },
)

// ── Reply tool: Claude sends messages back through kbot ─────────────────────
mcp.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'kbot_reply',
      description: 'Reply to a message through kbot. Routes through OpenClaw to WhatsApp, Telegram, Slack, Discord, iMessage, or any connected platform.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          chat_id: { type: 'string', description: 'The conversation ID from the inbound channel tag' },
          platform: { type: 'string', description: 'Platform to reply on (from the channel tag)' },
          text: { type: 'string', description: 'The message to send' },
        },
        required: ['chat_id', 'text'],
      },
    },
    {
      name: 'kbot_agent',
      description: 'Delegate a task to one of kbot\'s 26 specialist agents. Agents: kernel, coder, researcher, writer, analyst, aesthete, guardian, curator, strategist, infrastructure, quant, investigator, oracle, chronist, sage, communicator, adapter, trader.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          agent: { type: 'string', description: 'Agent to route to (or "auto" for Bayesian routing)' },
          task: { type: 'string', description: 'The task or question' },
        },
        required: ['task'],
      },
    },
    {
      name: 'kbot_tools',
      description: 'List or execute kbot tools. With action="list", returns available tools. With action="execute", runs a specific tool.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          action: { type: 'string', description: '"list" or "execute"' },
          tool_name: { type: 'string', description: 'Tool to execute (for action="execute")' },
          args: { type: 'object', description: 'Tool arguments (for action="execute")' },
          filter: { type: 'string', description: 'Filter tools by keyword (for action="list")' },
        },
        required: ['action'],
      },
    },
    {
      name: 'kbot_status',
      description: 'Get kbot\'s current status: version, tool count, learning stats, active sessions, defense health.',
      inputSchema: {
        type: 'object' as const,
        properties: {},
      },
    },
  ],
}))

// ── Tool execution ──────────────────────────────────────────────────────────
async function kbotApiFetch(path: string, options?: { method?: string; body?: unknown }): Promise<unknown> {
  const KBOT_API = process.env.KBOT_SERVE_URL || 'http://127.0.0.1:7437'
  const res = await fetch(`${KBOT_API}${path}`, {
    method: options?.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  })
  if (!res.ok) throw new Error(`kbot API: ${res.status}`)
  return res.json()
}

async function openclawSend(sessionId: string, message: string): Promise<void> {
  await fetch(`${OPENCLAW_URL}/api/sessions/${sessionId}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  })
}

mcp.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params
  const a = (args || {}) as Record<string, unknown>

  try {
    switch (name) {
      case 'kbot_reply': {
        const text = String(a.text || '')
        const chatId = String(a.chat_id || '')
        const platform = String(a.platform || '')

        // Try OpenClaw first, fall back to broadcast
        try {
          await openclawSend(chatId, text)
        } catch {
          broadcast(`[${platform || 'reply'}] → ${chatId}: ${text}`)
        }
        return { content: [{ type: 'text' as const, text: `Sent to ${chatId}${platform ? ` on ${platform}` : ''}` }] }
      }

      case 'kbot_agent': {
        const result = await kbotApiFetch('/stream', {
          method: 'POST',
          body: { message: String(a.task), agent: String(a.agent || 'auto') },
        }) as { content?: string; error?: string }
        return { content: [{ type: 'text' as const, text: result.content || result.error || 'No response' }] }
      }

      case 'kbot_tools': {
        if (a.action === 'list') {
          const tools = await kbotApiFetch('/tools') as Array<{ name: string; description: string }>
          const filter = a.filter ? String(a.filter).toLowerCase() : ''
          const filtered = filter
            ? tools.filter(t => t.name.includes(filter) || t.description.toLowerCase().includes(filter))
            : tools.slice(0, 30)
          return { content: [{ type: 'text' as const, text: filtered.map(t => `${t.name} — ${t.description}`).join('\n') }] }
        }
        if (a.action === 'execute' && a.tool_name) {
          const result = await kbotApiFetch('/execute', {
            method: 'POST',
            body: { name: String(a.tool_name), args: a.args || {} },
          }) as { result?: string; error?: string }
          return { content: [{ type: 'text' as const, text: result.result || result.error || 'Done' }] }
        }
        return { content: [{ type: 'text' as const, text: 'Use action="list" or action="execute" with tool_name' }] }
      }

      case 'kbot_status': {
        const health = await kbotApiFetch('/health') as Record<string, unknown>
        return { content: [{ type: 'text' as const, text: JSON.stringify(health, null, 2) }] }
      }

      default:
        throw new Error(`Unknown tool: ${name}`)
    }
  } catch (err) {
    return { content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }] }
  }
})

// ── Permission relay ────────────────────────────────────────────────────────
const PermissionRequestSchema = z.object({
  method: z.literal('notifications/claude/channel/permission_request'),
  params: z.object({
    request_id: z.string(),
    tool_name: z.string(),
    description: z.string(),
    input_preview: z.string(),
  }),
})

mcp.setNotificationHandler(PermissionRequestSchema, async ({ params }) => {
  const prompt = `🔐 Claude wants to run ${params.tool_name}: ${params.description}\n\nReply "yes ${params.request_id}" or "no ${params.request_id}"`

  // Broadcast to SSE listeners
  broadcast(prompt)

  // Also try to send via OpenClaw to all active sessions
  try {
    await fetch(`${OPENCLAW_URL}/api/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: prompt, platforms: [] }),
    })
  } catch { /* OpenClaw might not be running — SSE is the fallback */ }
})

// ── Connect to Claude Code ──────────────────────────────────────────────────
await mcp.connect(new StdioServerTransport())

// ── HTTP server: receives events and forwards to Claude Code ────────────────
const PERMISSION_REPLY_RE = /^\s*(y|yes|n|no)\s+([a-km-z]{5})\s*$/i
let nextId = 1

function parseBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString()))
    req.on('error', reject)
  })
}

const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${KBOT_PORT}`)

  // GET /events — SSE stream for monitoring
  if (req.method === 'GET' && url.pathname === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })
    res.write(': connected\n\n')
    const emit = (chunk: string) => res.write(chunk)
    listeners.add(emit)
    req.on('close', () => listeners.delete(emit))
    return
  }

  // GET /health — channel health check
  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', name: 'kbot-channel', version: '3.34.2', port: KBOT_PORT }))
    return
  }

  // POST — inbound messages
  if (req.method === 'POST') {
    const body = await parseBody(req)
    const sender = req.headers['x-sender'] as string || 'local'
    const platform = req.headers['x-platform'] as string || 'http'

    // Gate on sender
    if (!allowed.has(sender) && !allowed.has('local')) {
      res.writeHead(403)
      res.end('forbidden')
      return
    }

    // Check for permission verdict
    const m = PERMISSION_REPLY_RE.exec(body)
    if (m) {
      await mcp.notification({
        method: 'notifications/claude/channel/permission' as any,
        params: {
          request_id: m[2].toLowerCase(),
          behavior: m[1].toLowerCase().startsWith('y') ? 'allow' : 'deny',
        },
      })
      res.writeHead(200)
      res.end('verdict recorded')
      return
    }

    // Forward as channel event
    const chatId = String(nextId++)
    await mcp.notification({
      method: 'notifications/claude/channel',
      params: {
        content: body,
        meta: {
          chat_id: chatId,
          platform,
          sender,
          path: url.pathname,
        },
      },
    })
    res.writeHead(200)
    res.end('ok')
    return
  }

  res.writeHead(404)
  res.end('not found')
})

httpServer.listen(KBOT_PORT, '127.0.0.1', () => {
  // Channel is live — Claude Code has already connected via stdio
  // HTTP server accepts webhook POSTs and OpenClaw forwarded messages
})
