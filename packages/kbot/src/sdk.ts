// K:BOT Programmatic SDK
// Clean public API for using K:BOT as a library.
//
// Usage:
//   import { agent, tools } from '@kernel.chat/kbot'
//
//   const result = await agent.run('fix the bug in login.ts')
//   console.log(result.content)
//   console.log(result.toolCalls)
//
//   const allTools = tools.list()
//   const execResult = await tools.execute('read_file', { path: 'README.md' })
//
//   for await (const event of agent.stream('explain this code')) {
//     if (event.type === 'content_delta') process.stdout.write(event.text)
//   }

import { runAgent, type AgentOptions } from './agent.js'
import {
  registerAllTools, getAllTools, executeTool, getTool,
  type ToolCall,
} from './tools/index.js'
import { SilentUIAdapter, CallbackUIAdapter } from './ui-adapter.js'
import type { UIAdapter } from './ui-adapter.js'

// ── Configuration types ──

export interface KBotConfig {
  /** AI provider: 'anthropic' | 'openai' | 'ollama' | etc */
  provider?: string
  /** Model name (e.g. 'claude-sonnet-4-20250514', 'gpt-4o', 'llama3.1') */
  model?: string
  /** API key (or uses env vars / ~/.kbot/config.json) */
  apiKey?: string
  /** Custom endpoint URL */
  baseUrl?: string
  /** Custom UI adapter (default: SilentUIAdapter for SDK usage) */
  ui?: UIAdapter
  /** Tool permission mode */
  permissionMode?: 'permissive' | 'normal' | 'strict'
}

export interface RunOptions {
  /** Specialist agent ID (e.g. 'coder', 'researcher', 'writer') */
  agent?: string
  /** Enable streaming output */
  stream?: boolean
  /** Max tool loop iterations */
  maxIterations?: number
  /** Whitelist of tool names to make available */
  tools?: string[]
  /** Override system prompt */
  systemPrompt?: string
  /** Previous messages for context */
  context?: any[]
  /** AbortSignal for cancellation */
  signal?: AbortSignal
  /** Enable extended thinking */
  thinking?: boolean
  /** Thinking budget in tokens */
  thinkingBudget?: number
  /** Tier for tool gating */
  tier?: string
}

export interface RunResult {
  /** Final text content from the agent */
  content: string
  /** Tool calls made during execution */
  toolCalls: Array<{
    name: string
    args: any
    result?: string
    error?: string
    durationMs?: number
  }>
  /** Agent that handled the request */
  agent: string
  /** Model used */
  model: string
  /** Token usage */
  usage: { inputTokens: number; outputTokens: number }
  /** Total execution time in ms */
  durationMs: number
}

// ── Stream event types ──

export type StreamEvent =
  | { type: 'thinking_start' }
  | { type: 'thinking_delta'; text: string }
  | { type: 'thinking_end' }
  | { type: 'content_delta'; text: string }
  | { type: 'content_end' }
  | { type: 'tool_call_start'; name: string; args: any }
  | { type: 'tool_call_end'; name: string; result: string; error?: string }
  | { type: 'agent_route'; agentId: string; method: string; confidence: number }
  | { type: 'usage'; inputTokens: number; outputTokens: number }
  | { type: 'done'; content: string }

// ── Initialization guard ──

let initialized = false

async function ensureInitialized(): Promise<void> {
  if (initialized) return
  await registerAllTools()
  initialized = true
}

// ── Agent API ──

export const agent = {
  /**
   * Run the agent with a message and get a structured result.
   *
   * @example
   * const result = await agent.run('fix the bug in login.ts')
   * console.log(result.content)
   */
  async run(
    message: string,
    options?: RunOptions & KBotConfig,
  ): Promise<RunResult> {
    await ensureInitialized()
    const ui = options?.ui ?? new SilentUIAdapter()
    const start = Date.now()

    const agentOpts: AgentOptions = {
      agent: options?.agent,
      model: options?.model,
      stream: options?.stream ?? false,
      thinking: options?.thinking,
      thinkingBudget: options?.thinkingBudget,
      tier: options?.tier ?? 'free',
      ui,
    }

    const result = await runAgent(message, agentOpts)
    const durationMs = Date.now() - start

    return {
      content: result.content ?? (ui instanceof SilentUIAdapter ? ui.content : ''),
      toolCalls: ui instanceof SilentUIAdapter ? ui.toolCalls : [],
      agent: result.agent ?? options?.agent ?? 'kernel',
      model: result.model ?? options?.model ?? '',
      usage: {
        inputTokens: result.usage?.input_tokens ?? 0,
        outputTokens: result.usage?.output_tokens ?? 0,
      },
      durationMs,
    }
  },

  /**
   * Stream agent events as an async generator.
   *
   * @example
   * for await (const event of agent.stream('explain this code')) {
   *   if (event.type === 'content_delta') process.stdout.write(event.text)
   * }
   */
  async *stream(
    message: string,
    options?: RunOptions & KBotConfig,
  ): AsyncGenerator<StreamEvent> {
    await ensureInitialized()

    // Channel for pushing events from the callback adapter
    const queue: Array<StreamEvent | null> = []
    let resolve: (() => void) | null = null
    let done = false

    function push(event: StreamEvent): void {
      queue.push(event)
      if (resolve) {
        const r = resolve
        resolve = null
        r()
      }
    }

    const ui = new CallbackUIAdapter({
      onToolCallStart(name: string, args: any) {
        push({ type: 'tool_call_start', name, args })
      },
      onToolCallEnd(name: string, result: string, error?: string) {
        push({ type: 'tool_call_end', name, result, error })
      },
      onThinking(text: string) {
        push({ type: 'thinking_delta', text })
      },
      onContent(text: string) {
        push({ type: 'content_delta', text })
      },
      onContentEnd() {
        push({ type: 'content_end' })
      },
      onAgentRoute(agentId: string, method: string, confidence: number) {
        push({ type: 'agent_route', agentId, method, confidence })
      },
    })

    // Run the agent in the background, pushing events via callbacks
    const agentOpts: AgentOptions = {
      agent: options?.agent,
      model: options?.model,
      stream: true,
      thinking: options?.thinking,
      thinkingBudget: options?.thinkingBudget,
      tier: options?.tier ?? 'free',
      ui,
    }

    const agentPromise = runAgent(message, agentOpts).then(result => {
      push({
        type: 'usage',
        inputTokens: result.usage?.input_tokens ?? 0,
        outputTokens: result.usage?.output_tokens ?? 0,
      })
      push({ type: 'done', content: result.content })
      done = true
      queue.push(null) // sentinel
      if (resolve) {
        const r = resolve
        resolve = null
        r()
      }
    }).catch(err => {
      done = true
      queue.push(null)
      if (resolve) {
        const r = resolve
        resolve = null
        r()
      }
      throw err
    })

    // Yield events as they arrive
    while (true) {
      if (queue.length > 0) {
        const event = queue.shift()!
        if (event === null) break // sentinel — agent finished
        yield event
      } else if (done) {
        break
      } else {
        await new Promise<void>(r => { resolve = r })
      }
    }

    // Ensure the agent promise is settled (propagates errors)
    await agentPromise
  },
}

// ── Tools API ──

export const tools = {
  /**
   * List all registered tools with their descriptions and parameters.
   *
   * @example
   * const allTools = tools.list()
   * console.log(allTools.map(t => t.name))
   */
  list(): Array<{ name: string; description: string; parameters: any }> {
    return getAllTools().map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }))
  },

  /**
   * Execute a single tool by name.
   *
   * @example
   * const result = await tools.execute('read_file', { path: 'README.md' })
   * console.log(result.result)
   */
  async execute(
    name: string,
    args: Record<string, any>,
  ): Promise<{ result: string; error?: string; durationMs: number }> {
    await ensureInitialized()
    const start = Date.now()
    const call: ToolCall = { id: name, name, arguments: args }
    const toolResult = await executeTool(call)
    return {
      result: toolResult.result,
      error: toolResult.error ? toolResult.result : undefined,
      durationMs: Date.now() - start,
    }
  },

  /**
   * Get a single tool definition by name.
   *
   * @example
   * const readFile = tools.get('read_file')
   * if (readFile) console.log(readFile.description)
   */
  get(name: string) {
    return getTool(name)
  },
}

// ── Providers API ──

export const providers = {
  /**
   * Auto-detect available providers based on environment variables and config.
   */
  async detect(): Promise<Array<{ name: string; models: string[] }>> {
    const { getProvider, getByokProvider } = await import('./auth.js')
    const current = getByokProvider()
    if (!current) return []
    const p = getProvider(current)
    return [{
      name: p.name,
      models: p.models || [],
    }]
  },

  /**
   * List all supported provider names.
   */
  async list(): Promise<string[]> {
    const { PROVIDERS } = await import('./auth.js')
    return Object.keys(PROVIDERS)
  },
}

// ── Re-exports ──

export type { UIAdapter }
export { SilentUIAdapter, CallbackUIAdapter, TerminalUIAdapter } from './ui-adapter.js'
export { ResponseStream } from './streaming.js'
export type { ResponseStreamEvent, ResponseStreamListener } from './streaming.js'
