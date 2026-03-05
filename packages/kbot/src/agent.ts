// K:BOT Agent Loop — ReAct reasoning cycle
// Message → API → Tool Calls → Execute Locally → Continue or Return
//
// EFFICIENCY-FIRST DESIGN:
// 1. Local-first: handle simple tasks (file reads, git, ls) without any API call
// 2. Context batching: gather all relevant context before the first API call
// 3. One-shot prompting: send rich context so the agent gets it right in one try
// 4. Tool execution is always local and free — only reasoning burns tokens
// 5. Smart model selection: use fast model for simple tasks, default for complex

import {
  getApiKey, getApiBase,
  isByokEnabled, getByokKey, getByokProvider, getProviderModel, getProvider,
  estimateCost,
  type ByokProvider,
} from './auth.js'
import {
  executeTool,
  getTool,
  getToolDefinitionsForApi,
  type ToolCall,
  type ToolResult,
} from './tools/index.js'
import { formatContextForPrompt, type ProjectContext } from './context.js'
import { getMemoryPrompt, addTurn, getPreviousMessages } from './memory.js'
import { createSpinner, printToolCall, printToolResult, printResponse, printError, printInfo } from './ui.js'

const MAX_TOOL_LOOPS = 15
const KBOT_VERSION = '1.2.0'

export interface AgentOptions {
  agent?: string
  model?: string
  stream?: boolean
  context?: ProjectContext
  tier?: string
}

export interface AgentResponse {
  content: string
  agent: string
  model: string
  toolCalls: number
  usage?: { input_tokens: number; output_tokens: number; cost_usd: number }
}

// ── Local-first execution ──

async function tryLocalFirst(message: string): Promise<string | null> {
  const lower = message.toLowerCase().trim()

  const readMatch = lower.match(/^(?:read|show|cat|view|open)\s+(.+)$/i)
  if (readMatch) {
    const tool = getTool('read_file')
    if (tool) return tool.execute({ path: readMatch[1].trim() })
  }

  if (/^(?:ls|list|dir)\s*(.*)$/i.test(lower)) {
    const match = lower.match(/^(?:ls|list|dir)\s*(.*)$/i)
    const tool = getTool('list_directory')
    if (tool) return tool.execute({ path: match?.[1]?.trim() || '.' })
  }

  if (/^(?:git\s+)?status$/i.test(lower)) {
    const tool = getTool('git_status')
    if (tool) return tool.execute({})
  }

  if (/^(?:git\s+)?diff$/i.test(lower)) {
    const tool = getTool('git_diff')
    if (tool) return tool.execute({})
  }

  if (/^(?:git\s+)?log$/i.test(lower)) {
    const tool = getTool('git_log')
    if (tool) return tool.execute({})
  }

  const grepMatch = lower.match(/^(?:grep|search|find)\s+['"""]?(.+?)['"""]?\s+(?:in\s+)?(.+)$/i)
  if (grepMatch) {
    const tool = getTool('grep')
    if (tool) return tool.execute({ pattern: grepMatch[1], path: grepMatch[2].trim() })
  }

  if (lower === 'pwd' || lower === 'where am i') {
    return process.cwd()
  }

  return null
}

// ── Provider API callers ──
// Each provider has a different API format. Most are OpenAI-compatible.

interface ProviderMessage {
  role: string
  content: string
}

interface ProviderResult {
  content: string
  model: string
  usage: { input_tokens: number; output_tokens: number }
}

/** Anthropic Messages API (Claude) */
async function callAnthropic(
  apiKey: string, apiUrl: string, model: string,
  systemContext: string, messages: ProviderMessage[],
): Promise<ProviderResult> {
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      system: systemContext || undefined,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }))
    throw new Error(err.error?.message || `Anthropic error: ${res.status}`)
  }

  const data = await res.json()
  const text = (data.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('')
  const u = data.usage || {}
  return { content: text, model: data.model, usage: { input_tokens: u.input_tokens || 0, output_tokens: u.output_tokens || 0 } }
}

/** OpenAI-compatible Chat Completions API
 *  Works with: OpenAI, Mistral, xAI, DeepSeek, Groq, Together, Fireworks, Perplexity
 */
async function callOpenAICompat(
  apiKey: string, apiUrl: string, model: string,
  systemContext: string, messages: ProviderMessage[],
): Promise<ProviderResult> {
  const apiMessages: Array<{ role: string; content: string }> = []
  if (systemContext) apiMessages.push({ role: 'system', content: systemContext })
  apiMessages.push(...messages.map(m => ({ role: m.role, content: m.content })))

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, max_tokens: 8192, messages: apiMessages }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }))
    throw new Error(err.error?.message || `API error: ${res.status}`)
  }

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content || ''
  const u = data.usage || {}
  return { content, model: data.model || model, usage: { input_tokens: u.prompt_tokens || 0, output_tokens: u.completion_tokens || 0 } }
}

/** Google Gemini API */
async function callGemini(
  apiKey: string, apiUrl: string, model: string,
  systemContext: string, messages: ProviderMessage[],
): Promise<ProviderResult> {
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  const body: Record<string, unknown> = {
    contents,
    generationConfig: { maxOutputTokens: 8192 },
  }
  if (systemContext) {
    body.systemInstruction = { parts: [{ text: systemContext }] }
  }

  const res = await fetch(`${apiUrl}/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }))
    throw new Error(err.error?.message || `Gemini error: ${res.status}`)
  }

  const data = await res.json()
  const content = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text)?.join('') || ''
  const um = data.usageMetadata || {}
  return { content, model, usage: { input_tokens: um.promptTokenCount || 0, output_tokens: um.candidatesTokenCount || 0 } }
}

/** Cohere Chat API (v2) */
async function callCohere(
  apiKey: string, apiUrl: string, model: string,
  systemContext: string, messages: ProviderMessage[],
): Promise<ProviderResult> {
  const apiMessages: Array<{ role: string; content: string }> = []
  if (systemContext) apiMessages.push({ role: 'system', content: systemContext })
  apiMessages.push(...messages.map(m => ({ role: m.role, content: m.content })))

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages: apiMessages, max_tokens: 8192 }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }))
    throw new Error(err.error?.message || `Cohere error: ${res.status}`)
  }

  const data = await res.json()
  const content = data.message?.content?.[0]?.text || ''
  const u = data.usage?.tokens || {}
  return { content, model, usage: { input_tokens: u.input_tokens || 0, output_tokens: u.output_tokens || 0 } }
}

/** Universal provider call — routes to the right API format */
async function callProvider(
  provider: ByokProvider, apiKey: string, model: string,
  systemContext: string, messages: ProviderMessage[],
): Promise<ProviderResult> {
  const p = getProvider(provider)

  switch (p.apiStyle) {
    case 'anthropic': return callAnthropic(apiKey, p.apiUrl, model, systemContext, messages)
    case 'google':    return callGemini(apiKey, p.apiUrl, model, systemContext, messages)
    case 'cohere':    return callCohere(apiKey, p.apiUrl, model, systemContext, messages)
    case 'openai':    return callOpenAICompat(apiKey, p.apiUrl, model, systemContext, messages)
    default:          return callOpenAICompat(apiKey, p.apiUrl, model, systemContext, messages)
  }
}

// ── Main agent loop ──

export async function runAgent(
  message: string,
  options: AgentOptions = {},
): Promise<AgentResponse> {
  const byokMode = isByokEnabled()
  const apiKey = byokMode ? getByokKey() : getApiKey()
  if (!apiKey) {
    throw new Error(byokMode
      ? 'No LLM API key configured. Run `kbot byok` to set up.'
      : 'No API key configured. Run `kbot auth` to set up.')
  }

  // Step 1: Local-first
  const localResult = await tryLocalFirst(message)
  if (localResult !== null) {
    addTurn({ role: 'user', content: message })
    addTurn({ role: 'assistant', content: localResult })
    printInfo('(handled locally — 0 tokens used)')
    return { content: localResult, agent: 'local', model: 'none', toolCalls: 0 }
  }

  const tier = options.tier || 'free'
  const tools = getToolDefinitionsForApi(tier)

  // Step 2: Build context
  const contextSnippet = options.context ? formatContextForPrompt(options.context) : ''
  const memorySnippet = getMemoryPrompt()
  const efficiencyNote = `[K:BOT Efficiency Note]
You have local tools (file read/write/edit, grep, git, bash) that execute for FREE on the user's machine.
Prefer local tools over asking the user to do things manually.
Be thorough in your FIRST response — aim to solve the task in one shot.
Only use web_search when the user explicitly asks for current information.
IMPORTANT: Always quote file paths in bash commands — directories may contain spaces. Use "double quotes" around all paths.`
  const systemContext = [contextSnippet, memorySnippet, efficiencyNote].filter(Boolean).join('\n')

  let toolCallCount = 0
  let lastResponse: any = null
  let pendingToolResults: ToolResult[] = []

  for (let i = 0; i < MAX_TOOL_LOOPS; i++) {
    const spinner = createSpinner(i === 0 ? 'Thinking...' : `Running tools (${toolCallCount})...`)
    spinner.start()

    try {
      if (byokMode) {
        // ── BYOK: Call provider directly ──
        const provider = getByokProvider()
        const speed = options.model === 'haiku' || options.model === 'fast' ? 'fast' : 'default'
        const model = getProviderModel(provider, speed)

        const messages: ProviderMessage[] = [
          ...getPreviousMessages(),
          { role: 'user', content: i === 0 ? (systemContext ? `${systemContext}\n\n${message}` : message) : message },
        ]

        if (pendingToolResults.length > 0) {
          for (const tr of pendingToolResults) {
            messages.push({ role: 'user', content: `[Tool Result for ${tr.tool_call_id}]: ${tr.result}` })
          }
          pendingToolResults = []
        }

        spinner.stop()

        const result = await callProvider(provider, apiKey, model, systemContext, messages)

        lastResponse = {
          type: 'text',
          agent: options.agent || 'kernel',
          model: result.model,
          content: result.content,
          usage: {
            input_tokens: result.usage.input_tokens,
            output_tokens: result.usage.output_tokens,
            cost_usd: estimateCost(provider, result.usage.input_tokens, result.usage.output_tokens),
          },
        }
      } else {
        // ── Kernel API: Route through Matrix ──
        const apiBase = getApiBase()
        const body: Record<string, unknown> = {
          message: i === 0 ? (systemContext ? `${systemContext}\n\n${message}` : message) : message,
          mode: 'json',
          max_tokens: 8192,
          previous_messages: getPreviousMessages(),
          tools: tools.length > 0 ? tools : undefined,
        }

        if (options.agent && options.agent !== 'auto') body.agent = options.agent
        if (pendingToolResults.length > 0) {
          body.tool_results = pendingToolResults
          pendingToolResults = []
        }

        const res = await fetch(`${apiBase}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'X-Kbot-Version': KBOT_VERSION,
          },
          body: JSON.stringify(body),
        })

        spinner.stop()

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
          throw new Error(err.error || `API error: ${res.status}`)
        }

        lastResponse = await res.json()
      }

      // Text response → done
      if (lastResponse.type === 'text' || !lastResponse.tool_calls || lastResponse.tool_calls.length === 0) {
        const content = lastResponse.content || ''
        addTurn({ role: 'user', content: message })
        addTurn({ role: 'assistant', content })
        return {
          content,
          agent: lastResponse.agent || 'kernel',
          model: lastResponse.model || 'unknown',
          toolCalls: toolCallCount,
          usage: lastResponse.usage,
        }
      }

      // Tool calls → execute locally
      const toolCalls: ToolCall[] = lastResponse.tool_calls
      const results: ToolResult[] = []

      for (const call of toolCalls) {
        toolCallCount++
        printToolCall(call.name, call.arguments || {})
        const result = await executeTool(call)
        results.push(result)
        printToolResult(result.result, result.error)
      }

      pendingToolResults = results
      message = `Here are the tool results:\n${results.map(r => `[${r.tool_call_id}]: ${r.result}`).join('\n\n')}\n\nContinue based on these results.`
    } catch (err) {
      spinner.stop()
      throw err
    }
  }

  const content = lastResponse?.content || 'Reached maximum tool iterations.'
  return {
    content,
    agent: lastResponse?.agent || 'kernel',
    model: lastResponse?.model || 'unknown',
    toolCalls: toolCallCount,
    usage: lastResponse?.usage,
  }
}

/** One-shot: run agent and print response */
export async function runAndPrint(
  message: string,
  options: AgentOptions = {},
): Promise<void> {
  try {
    const response = await runAgent(message, options)
    printResponse(response.agent, response.content)

    if (response.usage) {
      const { input_tokens, output_tokens, cost_usd } = response.usage
      process.stdout.write(
        `  \x1b[2m${response.agent} · ${response.model} · ${input_tokens + output_tokens} tokens · $${cost_usd.toFixed(4)}\x1b[0m\n`
      )
    }
  } catch (err) {
    printError(err instanceof Error ? err.message : String(err))
    process.exit(1)
  }
}
