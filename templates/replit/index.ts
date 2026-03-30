// kbot Agent API — Replit Template
//
// This gives you a full AI agent backend with 600+ tools in ~30 lines.
//
// Setup:
//   1. Add your API key to Replit Secrets → ANTHROPIC_API_KEY (or any of 20 providers)
//   2. Click Run
//   3. Your agent API is live at your Repl's public URL
//
// Endpoints:
//   GET  /              → Status + tool count
//   POST /chat          → Send a message, get an agent response
//   POST /chat/stream   → SSE streaming response
//   GET  /tools         → List all available tools

import { agent, tools } from '@kernel.chat/kbot'
import { createServer } from 'node:http'

const PORT = parseInt(process.env.PORT || '3000', 10)

function json(res: import('node:http').ServerResponse, status: number, data: unknown) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
  res.end(JSON.stringify(data))
}

function readBody(req: import('node:http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString()))
    req.on('error', reject)
  })
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`)

  // CORS preflight
  if (req.method === 'OPTIONS') {
    json(res, 204, null)
    return
  }

  try {
    // Status
    if (url.pathname === '/' && req.method === 'GET') {
      const allTools = tools.list()
      json(res, 200, {
        name: 'kbot-agent-api',
        status: 'running',
        tools: allTools.length,
        docs: 'POST /chat with { "message": "your prompt" }',
      })
      return
    }

    // List tools
    if (url.pathname === '/tools' && req.method === 'GET') {
      json(res, 200, tools.list().map(t => ({ name: t.name, description: t.description })))
      return
    }

    // Chat (full response)
    if (url.pathname === '/chat' && req.method === 'POST') {
      const body = JSON.parse(await readBody(req))
      const result = await agent.run(body.message, {
        agent: body.agent || 'auto',
        stream: false,
      })
      json(res, 200, {
        content: result.content,
        agent: result.agent,
        model: result.model,
        toolCalls: result.toolCalls,
        usage: result.usage,
        durationMs: result.durationMs,
      })
      return
    }

    // Chat (streaming via SSE)
    if (url.pathname === '/chat/stream' && req.method === 'POST') {
      const body = JSON.parse(await readBody(req))
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      })

      for await (const event of agent.stream(body.message, {
        agent: body.agent || 'auto',
      })) {
        res.write(`data: ${JSON.stringify(event)}\n\n`)
      }
      res.write('data: [DONE]\n\n')
      res.end()
      return
    }

    // 404
    json(res, 404, { error: 'Not found. Try GET / or POST /chat' })
  } catch (err) {
    json(res, 500, { error: err instanceof Error ? err.message : 'Internal error' })
  }
})

server.listen(PORT, () => {
  console.log(`\n  kbot Agent API running on port ${PORT}`)
  console.log(`  Try: curl -X POST /chat -d '{"message": "hello"}'`)
  console.log()
})
