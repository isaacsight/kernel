// kbot OpenClaw Plugin
//
// Registers kbot's cognitive stack as native OpenClaw tools.
// Requires kbot serve running on the configured port.
//
// Install: openclaw plugins install @kernel.chat/kbot
// Or copy this directory to ~/.openclaw/extensions/kbot/

interface PluginApi {
  registerTool(tool: {
    name: string
    description: string
    parameters: Record<string, unknown>
    execute: (id: string, params: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>
  }): void
}

interface KbotConfig {
  port?: number
  host?: string
  agent?: string
  token?: string
}

function getBaseUrl(config: KbotConfig): string {
  const host = config.host || 'http://localhost'
  const port = config.port || 7437
  return `${host}:${port}`
}

async function kbotFetch(
  config: KbotConfig,
  path: string,
  options?: { method?: string; body?: unknown }
): Promise<unknown> {
  const url = `${getBaseUrl(config)}${path}`
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (config.token) {
    headers['Authorization'] = `Bearer ${config.token}`
  }

  const response = await fetch(url, {
    method: options?.method || 'GET',
    headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  })

  if (!response.ok) {
    throw new Error(`kbot error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

function textResult(text: string) {
  return { content: [{ type: 'text' as const, text }] }
}

export function register(api: PluginApi, config: KbotConfig = {}): void {
  // ── kbot_chat: Full agent loop ──
  api.registerTool({
    name: 'kbot_chat',
    description:
      'Send a message to kbot\'s cognitive engine. Routes to the best specialist agent (coder, researcher, writer, analyst, guardian, etc.). Learns from every interaction. Use for complex tasks that need multi-step reasoning and tool use.',
    parameters: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'The message or task to send to kbot' },
        agent: {
          type: 'string',
          description: 'Specialist agent to use. Default: auto (kbot picks the best one)',
          enum: [
            'auto', 'kernel', 'coder', 'researcher', 'writer', 'analyst',
            'aesthete', 'guardian', 'curator', 'strategist', 'infrastructure',
            'quant', 'investigator', 'oracle', 'chronist', 'sage',
            'communicator', 'adapter', 'replit',
          ],
        },
      },
      required: ['message'],
    },
    execute: async (_id, params) => {
      const result = await kbotFetch(config, '/stream', {
        method: 'POST',
        body: {
          message: params.message,
          agent: params.agent || config.agent || 'auto',
        },
      }) as { content?: string; error?: string }
      return textResult(result.content || result.error || 'No response')
    },
  })

  // ── kbot_tool: Execute a specific tool ──
  api.registerTool({
    name: 'kbot_tool',
    description:
      'Execute one of kbot\'s 290 built-in tools directly. Use for specific operations like web search, file read/write, git operations, etc. Use kbot_tools_list to see available tools.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Tool name (e.g., web_search, read_file, bash)' },
        args: { type: 'object', description: 'Tool arguments as key-value pairs' },
      },
      required: ['name'],
    },
    execute: async (_id, params) => {
      const result = await kbotFetch(config, '/execute', {
        method: 'POST',
        body: { name: params.name, args: params.args || {} },
      }) as { result?: string; error?: string }
      return textResult(result.result || result.error || 'No result')
    },
  })

  // ── kbot_tools_list: Discover available tools ──
  api.registerTool({
    name: 'kbot_tools_list',
    description:
      'List all tools available in kbot. Returns tool names and descriptions. Use to discover what kbot can do before calling kbot_tool.',
    parameters: {
      type: 'object',
      properties: {
        filter: { type: 'string', description: 'Optional keyword to filter tools by name or description' },
      },
    },
    execute: async (_id, params) => {
      const tools = await kbotFetch(config, '/tools') as Array<{ name: string; description: string }>
      let filtered = tools
      if (params.filter) {
        const query = (params.filter as string).toLowerCase()
        filtered = tools.filter(
          (t) => t.name.toLowerCase().includes(query) || t.description.toLowerCase().includes(query)
        )
      }
      const list = filtered.map((t) => `${t.name} — ${t.description}`).join('\n')
      return textResult(list || 'No tools found')
    },
  })

  // ── kbot_health: Check kbot status ──
  api.registerTool({
    name: 'kbot_health',
    description: 'Check if kbot\'s cognitive engine is running and healthy. Returns version, tool count, and uptime.',
    parameters: { type: 'object', properties: {} },
    execute: async () => {
      try {
        const health = await kbotFetch(config, '/health') as Record<string, unknown>
        return textResult(JSON.stringify(health, null, 2))
      } catch (err) {
        return textResult(
          `kbot is not running. Start it with: kbot serve --port ${config.port || 7437}\n\nError: ${err instanceof Error ? err.message : String(err)}`
        )
      }
    },
  })

  // ── kbot_metrics: Tool execution metrics ──
  api.registerTool({
    name: 'kbot_metrics',
    description: 'Get execution metrics for kbot\'s tools — call counts, error rates, average duration. Useful for understanding which tools are being used and how they perform.',
    parameters: { type: 'object', properties: {} },
    execute: async () => {
      const metrics = await kbotFetch(config, '/metrics') as unknown
      return textResult(JSON.stringify(metrics, null, 2))
    },
  })
}
