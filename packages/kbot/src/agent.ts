// K:BOT Agent Loop v2 — Autonomous Reasoning Engine
// Message → Think → Plan → Execute → Verify → Learn → Return
//
// INTELLIGENCE ARCHITECTURE:
// 1. Local-first: handle simple tasks (file reads, git, ls) without any API call
// 2. Deep context: project memory + learned patterns + user knowledge + corrections
// 3. Plan-then-execute: think step by step, then use tools aggressively
// 4. Self-correction: if a tool fails, analyze the error and try a different approach
// 5. Auto-research: if you don't know how, search GitHub/web FIRST, then execute
// 6. Verify: always confirm the output exists and is correct
// 7. Learn: extract knowledge from every interaction for future use

import {
  getByokKey, getByokProvider, getProviderModel, getProvider,
  estimateCost, isLocalProvider, warmOllamaModelCache,
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
import { getMatrixSystemPrompt, listAgents, createAgent, type MatrixAgent } from './matrix.js'
import {
  buildLearningContext, buildFullLearningContext, findPattern, recordPattern, recordPatternFailure,
  cacheSolution, updateProfile, classifyTask, extractKeywords,
  learnFromExchange, learnFact, updateProjectMemory,
  shouldAutoTrain, selfTrain,
} from './learning.js'
import { getMemoryPrompt, addTurn, getPreviousMessages } from './memory.js'
import { autoCompact, compressToolResult, type ConversationTurn } from './context-manager.js'
import { learnedRoute, recordRoute } from './learned-router.js'
import { buildCacheablePrompt, createPromptSections } from './prompt-cache.js'
import { saveEmbeddingCache } from './embeddings.js'
import { createSpinner, printToolCall, printToolResult, printResponse, printError, printInfo, printWarn } from './ui.js'
import { parseMultimodalMessage, toAnthropicContent, toOpenAIContent, toGeminiParts, type ParsedMessage } from './multimodal.js'
import { streamAnthropicResponse, streamOpenAIResponse, type StreamState } from './streaming.js'
import { checkPermission } from './permissions.js'
import { runPreToolHook, runPostToolHook } from './hooks.js'
import { getRepoMapForContext } from './repo-map.js'
import { recordSuccess, recordFailure } from './provider-fallback.js'
import { isSelfEvalEnabled, evaluateResponse } from './self-eval.js'
import chalk from 'chalk'

const MAX_TOOL_LOOPS = 75

/** Maximum cumulative cost (USD) before auto-stopping tool loops */
const MAX_COST_CEILING = 1.00

/** Maximum response body size (bytes) to prevent OOM on huge local model responses */
const MAX_RESPONSE_BODY = 10 * 1024 * 1024  // 10MB

/** Read a fetch Response body with a size cap. Throws if body exceeds limit. */
async function safeReadBody(res: Response, maxBytes: number = MAX_RESPONSE_BODY): Promise<string> {
  // If Content-Length is available and too big, reject immediately
  const cl = res.headers.get('content-length')
  if (cl && parseInt(cl, 10) > maxBytes) {
    await res.body?.cancel()
    throw new Error(`Response too large (${Math.round(parseInt(cl, 10) / 1024 / 1024)}MB). Max: ${Math.round(maxBytes / 1024 / 1024)}MB.`)
  }

  const reader = res.body?.getReader()
  if (!reader) return '{}'

  // Accumulate raw chunks and track bytes (not string length — UTF-8 can be multi-byte)
  const chunks: Uint8Array[] = []
  let bytesRead = 0
  let cancelled = false

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      bytesRead += value.length
      if (bytesRead > maxBytes) {
        cancelled = true
        await reader.cancel()
        throw new Error(`Response exceeded ${Math.round(maxBytes / 1024 / 1024)}MB limit. Use a model with shorter output or a more specific prompt.`)
      }
      chunks.push(value)
    }
  } finally {
    if (!cancelled) reader.releaseLock()
  }

  // Decode all chunks at once (more efficient than incremental string concat)
  const decoder = new TextDecoder()
  const merged = new Uint8Array(bytesRead)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.length
  }
  return decoder.decode(merged)
}


export interface AgentOptions {
  agent?: string
  model?: string
  stream?: boolean
  context?: ProjectContext
  tier?: string
  /** Enable extended thinking (shows reasoning steps) */
  thinking?: boolean
  /** Thinking budget in tokens (default: 10000) */
  thinkingBudget?: number
  /** Pre-parsed multimodal content (images from CLI) */
  multimodal?: ParsedMessage
  /** Skip planner re-entry (prevents infinite loop when planner calls runAgent) */
  skipPlanner?: boolean
}


export interface AgentResponse {
  content: string
  agent: string
  model: string
  toolCalls: number
  thinking?: string
  streamed?: boolean
  usage?: { input_tokens: number; output_tokens: number; cost_usd: number }
}


// ── Local-first execution ──

async function tryLocalFirst(message: string): Promise<string | null> {
  const lower = message.toLowerCase().trim()

  // Only match file-like paths — avoid intercepting "open chrome" or "show me how to..."
  const readMatch = lower.match(/^(?:read|cat|view)\s+(.+)$/i)
    || lower.match(/^(?:show|open)\s+((?:\.{0,2}\/|~\/|\w+\.\w+).+)$/i)
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

  // Only match explicit grep-like patterns: "grep PATTERN in PATH" or "search for PATTERN in PATH"
  // Avoid intercepting natural language like "search the web for..."
  const grepMatch = lower.match(/^(?:grep)\s+['"""]?(.+?)['"""]?\s+(?:in\s+)?(.+)$/i)
    || lower.match(/^(?:search|find)\s+(?:for\s+)?['"""]?(.+?)['"""]?\s+in\s+(.+)$/i)
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

interface ProviderToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

interface ProviderResult {
  content: string
  thinking?: string
  model: string
  usage: { input_tokens: number; output_tokens: number }
  tool_calls?: ProviderToolCall[]
  stop_reason?: string
}

/** Anthropic Messages API (Claude) */
async function callAnthropic(
  apiKey: string, apiUrl: string, model: string,
  systemContext: string, messages: ProviderMessage[],
  tools?: Array<{ name: string; description: string; input_schema: Record<string, unknown> }>,
  options?: { multimodal?: ParsedMessage; thinking?: boolean; thinkingBudget?: number },
): Promise<ProviderResult> {
  // Build messages — use multimodal content blocks if images are present
  const apiMessages = messages.map((m, i) => {
    // Only the first user message might have images
    if (i === messages.length - 1 && m.role === 'user' && options?.multimodal?.isMultimodal) {
      return { role: m.role, content: toAnthropicContent(options.multimodal) }
    }
    return { role: m.role, content: m.content }
  })

  const body: Record<string, unknown> = {
    model,
    max_tokens: options?.thinking ? 16384 : 8192,
    system: systemContext || undefined,
    messages: apiMessages,
  }
  if (tools && tools.length > 0) body.tools = tools
  if (options?.thinking) {
    body.thinking = { type: 'enabled', budget_tokens: options.thinkingBudget || 10000 }
  }

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errBody = await safeReadBody(res, 1024 * 100).catch(() => '{}')
    const err = JSON.parse(errBody).error || { message: `HTTP ${res.status}` }
    throw new Error(err.message || `Anthropic error: ${res.status}`)
  }

  const data = JSON.parse(await safeReadBody(res))
  const contentBlocks = data.content || []
  const text = contentBlocks.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('')
  const thinkingText = contentBlocks.filter((b: any) => b.type === 'thinking').map((b: any) => b.thinking).join('')
  const toolUseBlocks = contentBlocks.filter((b: any) => b.type === 'tool_use')
  const u = data.usage || {}

  const result: ProviderResult = {
    content: text,
    thinking: thinkingText || undefined,
    model: data.model,
    usage: { input_tokens: u.input_tokens || 0, output_tokens: u.output_tokens || 0 },
    stop_reason: data.stop_reason,
  }
  if (toolUseBlocks.length > 0) {
    result.tool_calls = toolUseBlocks.map((b: any) => ({
      id: b.id,
      name: b.name,
      arguments: b.input || {},
    }))
  }
  return result
}

/** OpenAI-compatible Chat Completions API
 *  Works with: OpenAI, Mistral, xAI, DeepSeek, Groq, Together, Fireworks, Perplexity, Ollama, OpenClaw
 */
async function callOpenAICompat(
  apiKey: string, apiUrl: string, model: string,
  systemContext: string, messages: ProviderMessage[],
  tools?: Array<{ name: string; description: string; input_schema: Record<string, unknown> }>,
): Promise<ProviderResult> {
  const apiMessages: Array<{ role: string; content: string }> = []
  if (systemContext) apiMessages.push({ role: 'system', content: systemContext })
  apiMessages.push(...messages.map(m => ({ role: m.role, content: m.content })))

  const body: Record<string, unknown> = { model, max_tokens: 8192, messages: apiMessages }
  if (tools && tools.length > 0) {
    body.tools = tools.map(t => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.input_schema },
    }))
  }

  // Local providers (Ollama, OpenClaw) may not need auth headers
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (apiKey && apiKey !== 'local') {
    headers['Authorization'] = `Bearer ${apiKey}`
  }

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(300_000), // 5 min timeout for local models
  })

  if (!res.ok) {
    const errBody = await safeReadBody(res, 1024 * 100).catch(() => '{}')
    const err = JSON.parse(errBody).error || { message: `HTTP ${res.status}` }
    throw new Error(err.message || `API error: ${res.status}`)
  }

  const data = JSON.parse(await safeReadBody(res))
  const choice = data.choices?.[0] || {}
  let content = choice.message?.content || ''
  const u = data.usage || {}

  const result: ProviderResult = {
    content,
    model: data.model || model,
    usage: { input_tokens: u.prompt_tokens || 0, output_tokens: u.completion_tokens || 0 },
    stop_reason: choice.finish_reason,
  }

  // Standard tool_calls from the API
  if (choice.message?.tool_calls && choice.message.tool_calls.length > 0) {
    result.tool_calls = choice.message.tool_calls.map((tc: any) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: typeof tc.function.arguments === 'string'
        ? JSON.parse(tc.function.arguments)
        : tc.function.arguments || {},
    }))
  }

  // Fallback: Small local models (7B) sometimes emit tool calls as raw JSON in content
  // instead of structured tool_calls. Parse these so tools still work with Ollama.
  if (!result.tool_calls && content && tools && tools.length > 0) {
    const toolNames = tools.map(t => (t as any).function?.name || t.name).filter(Boolean)
    const parsed = tryParseInlineToolCalls(content, toolNames)
    if (parsed.length > 0) {
      result.tool_calls = parsed
      // Remove the raw JSON from the displayed content
      result.content = content.replace(/```(?:json)?\s*\{[\s\S]*?\}\s*```/g, '').replace(/\{[\s\S]*?"name"\s*:\s*"[a-z_]+[\s\S]*?\}/g, '').trim()
    }
  }

  return result
}

/** Try to parse tool calls that local models emit as raw JSON in their text output */
function tryParseInlineToolCalls(
  content: string,
  knownTools: string[],
): ProviderToolCall[] {
  const calls: ProviderToolCall[] = []

  // Pattern 1: JSON in code blocks ```json { "name": "tool_name", ... } ```
  const codeBlockPattern = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/g
  let match
  while ((match = codeBlockPattern.exec(content)) !== null) {
    const parsed = tryParseToolJson(match[1], knownTools)
    if (parsed) calls.push(parsed)
  }
  if (calls.length > 0) return calls

  // Pattern 2: Raw JSON objects with "name" field matching known tools
  const jsonPattern = /\{[^{}]*"name"\s*:\s*"([a-z_]+)"[^{}]*\}/g
  while ((match = jsonPattern.exec(content)) !== null) {
    if (knownTools.includes(match[1])) {
      const parsed = tryParseToolJson(match[0], knownTools)
      if (parsed) calls.push(parsed)
    }
  }

  return calls
}

function tryParseToolJson(json: string, knownTools: string[]): ProviderToolCall | null {
  try {
    const obj = JSON.parse(json)
    const name = obj.name || obj.function?.name
    if (!name || !knownTools.includes(name)) return null
    const args = obj.arguments || obj.parameters || obj.input || obj
    // Remove meta fields to get clean arguments
    const cleanArgs = { ...args }
    delete cleanArgs.name
    delete cleanArgs.function
    delete cleanArgs.type
    return {
      id: `inline_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name,
      arguments: cleanArgs,
    }
  } catch {
    return null
  }
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
    const errBody = await safeReadBody(res, 1024 * 100).catch(() => '{}')
    const err = JSON.parse(errBody).error || { message: `HTTP ${res.status}` }
    throw new Error(err.message || `Gemini error: ${res.status}`)
  }

  const data = JSON.parse(await safeReadBody(res))
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
    const errBody = await safeReadBody(res, 1024 * 100).catch(() => '{}')
    const err = JSON.parse(errBody).error || { message: `HTTP ${res.status}` }
    throw new Error(err.message || `Cohere error: ${res.status}`)
  }

  const data = JSON.parse(await safeReadBody(res))
  const content = data.message?.content?.[0]?.text || ''
  const u = data.usage?.tokens || {}
  return { content, model, usage: { input_tokens: u.input_tokens || 0, output_tokens: u.output_tokens || 0 } }
}

/** Streaming provider call — tokens appear progressively in terminal */
async function callProviderStreaming(
  provider: ByokProvider, apiKey: string, model: string,
  systemContext: string, messages: ProviderMessage[],
  tools?: Array<{ name: string; description: string; input_schema: Record<string, unknown> }>,
  options?: { thinking?: boolean; thinkingBudget?: number },
): Promise<ProviderResult> {
  const p = getProvider(provider)

  let state: StreamState

  if (p.apiStyle === 'anthropic') {
    state = await streamAnthropicResponse(
      apiKey, p.apiUrl, model, systemContext,
      messages.map(m => ({ role: m.role, content: m.content as unknown })),
      tools,
      { thinking: options?.thinking, thinkingBudget: options?.thinkingBudget },
    )
  } else {
    state = await streamOpenAIResponse(
      apiKey, p.apiUrl, model, systemContext,
      messages.map(m => ({ role: m.role, content: m.content })),
      tools,
    )
  }

  const result: ProviderResult = {
    content: state.content,
    thinking: state.thinking || undefined,
    model: state.model || model,
    usage: state.usage,
    stop_reason: state.stopReason,
  }

  if (state.toolCalls.length > 0) {
    result.tool_calls = state.toolCalls
      .filter(tc => tc.name)
      .map(tc => {
        let args: Record<string, unknown> = {}
        if (tc.partialJson) {
          try { args = JSON.parse(tc.partialJson) } catch { /* malformed JSON from stream — use empty args */ }
        }
        return {
          id: tc.id || `stream_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name: tc.name,
          arguments: args,
        }
      })
  }

  // Fallback: if local model streamed tool calls as raw JSON in content,
  // try to parse them (won't fix the displayed output, but tools will work)
  if (!result.tool_calls && result.content && tools && tools.length > 0) {
    const toolNames = tools.map(t => t.name)
    const parsed = tryParseInlineToolCalls(result.content, toolNames)
    if (parsed.length > 0) {
      result.tool_calls = parsed
      result.content = result.content
        .replace(/```(?:json)?\s*\{[\s\S]*?\}\s*```/g, '')
        .replace(/\{[\s\S]*?"name"\s*:\s*"[a-z_]+[\s\S]*?\}/g, '')
        .trim()
    }
  }

  return result
}

/** Detect if a message is casual conversation that doesn't need tools */
function isCasualMessage(message: string): boolean {
  const lower = message.toLowerCase().trim()

  // Very short messages are usually conversational
  if (lower.length < 20 && !/\b(fix|create|build|run|deploy|install|delete|remove|write|edit|read|find|search|open|show|list|git|npm|pip|cargo)\b/.test(lower)) {
    return true
  }

  // Greetings and chitchat
  const casualPatterns = [
    /^(hey|hi|hello|yo|sup|what's up|whats up|howdy|hola)\b/,
    /^(how are you|how's it going|what's good|how do you do)\b/,
    /^(thanks|thank you|thx|ty|cool|nice|great|awesome|perfect|ok|okay|sure|got it|understood)\b/,
    /^(do you|can you|are you|what are you|who are you|what is|what's your)\b/,
    /^(tell me about|explain|what do you think|how does|why does|why is|what if)\b/,
    /^(good morning|good night|good evening|good afternoon|gm|gn)\b/,
    /^(bye|goodbye|see you|later|peace|quit|exit)\b/,
    /^(yes|no|maybe|probably|nah|nope|yep|yeah)\b/,
    /^(lol|lmao|haha|bruh|wow|damn|dang|omg|wtf)\b/,
    /\?$/, // Questions are usually conversational unless they contain action words
  ]

  // If it matches a casual pattern AND doesn't contain action words, it's casual
  const isCasualPattern = casualPatterns.some(p => p.test(lower))
  const hasActionWords = /\b(fix|create|build|run|deploy|install|delete|remove|write|edit|make|generate|scaffold|refactor|update|add|implement|set up|configure|debug|test)\b/.test(lower)

  if (isCasualPattern && !hasActionWords) return true

  // Questions that end with ? and don't have action words
  if (lower.endsWith('?') && !hasActionWords && lower.length < 100) return true

  return false
}

/** Core tools that small local models can handle without getting confused */
const CORE_TOOLS = new Set([
  'read_file', 'write_file', 'list_directory', 'bash',
  'git_status', 'git_diff', 'git_commit', 'git_log',
  'grep', 'web_search',
])

/** Detect if a message describes a complex multi-step task */
function isComplexTask(message: string): boolean {
  const lower = message.toLowerCase()
  const complexSignals = [
    /\b(refactor|migrate|convert|rewrite|restructure|reorganize)\b/,
    /\b(all files|every file|across the|codebase|entire project)\b/,
    /\b(first|then|after that|finally|step \d|phase \d)\b/,
    /\b(add (?:a |an )?new (?:feature|system|module|layer))\b/,
    /\b(build and deploy|ci\s*\/?\s*cd|set up|configure)\b.*\b(pipeline|workflow|infrastructure)\b/,
  ]
  const signalCount = complexSignals.filter(r => r.test(lower)).length
  const isLong = message.length > 500
  return signalCount >= 2 || (signalCount >= 1 && isLong)
}

/** Universal provider call — routes to the right API format */
async function callProvider(
  provider: ByokProvider, apiKey: string, model: string,
  systemContext: string, messages: ProviderMessage[],
  tools?: Array<{ name: string; description: string; input_schema: Record<string, unknown> }>,
  options?: { multimodal?: ParsedMessage; thinking?: boolean; thinkingBudget?: number },
): Promise<ProviderResult> {
  const p = getProvider(provider)
  const startTime = Date.now()

  try {
    let result: ProviderResult
    switch (p.apiStyle) {
      case 'anthropic': result = await callAnthropic(apiKey, p.apiUrl, model, systemContext, messages, tools, options); break
      case 'google':    result = await callGemini(apiKey, p.apiUrl, model, systemContext, messages); break
      case 'cohere':    result = await callCohere(apiKey, p.apiUrl, model, systemContext, messages); break
      case 'openai':    result = await callOpenAICompat(apiKey, p.apiUrl, model, systemContext, messages, tools); break
      default:          result = await callOpenAICompat(apiKey, p.apiUrl, model, systemContext, messages, tools); break
    }
    recordSuccess(provider, Date.now() - startTime)
    return result
  } catch (err) {
    recordFailure(provider, err instanceof Error ? err : new Error(String(err)))

    // Auto-retry with fallback model for local providers
    if (isLocalProvider(provider) && model !== p.fastModel) {
      const errMsg = err instanceof Error ? err.message : String(err)
      // Only retry on model-specific errors, not connection errors
      if (errMsg.includes('not found') || errMsg.includes('does not exist') || errMsg.includes('model')) {
        printWarn(`Model ${model} unavailable, falling back to ${p.fastModel}...`)
        switch (p.apiStyle) {
          case 'openai': return callOpenAICompat(apiKey, p.apiUrl, p.fastModel, systemContext, messages, tools)
          default:       return callOpenAICompat(apiKey, p.apiUrl, p.fastModel, systemContext, messages, tools)
        }
      }
    }
    throw err
  }
}

// ── Main agent loop ──

export async function runAgent(
  message: string,
  options: AgentOptions = {},
): Promise<AgentResponse> {
  const apiKey = getByokKey()
  const byokProvider = getByokProvider()
  const isLocal = byokProvider ? isLocalProvider(byokProvider) : false
  if (!apiKey && !isLocal) {
    throw new Error('No LLM API key configured. Run `kbot byok` to set up, or `kbot local` for local models.')
  }

  // Step 0a: Warm Ollama model cache if using local provider
  if (isLocal && byokProvider === 'ollama') {
    warmOllamaModelCache().catch(() => {}) // non-blocking
  }

  // Step 0: Parse multimodal content (images in message)
  const parsed = options.multimodal || parseMultimodalMessage(message)
  if (parsed.isMultimodal) {
    printInfo(`(${parsed.imageCount} image${parsed.imageCount > 1 ? 's' : ''} attached)`)
  }

  // Step 1: Local-first (skip if multimodal — needs AI to interpret)
  if (!parsed.isMultimodal) {
    const localResult = await tryLocalFirst(message)
    if (localResult !== null) {
      addTurn({ role: 'user', content: message })
      addTurn({ role: 'assistant', content: localResult })
      printInfo('(handled locally — 0 tokens used)')
      return { content: localResult, agent: 'local', model: 'none', toolCalls: 0 }
    }
  }

  // Step 1.5: Complexity detection — auto-plan complex tasks
  if (isComplexTask(message) && !message.startsWith('/plan') && !options.skipPlanner) {
    printInfo('Complex task detected. Using autonomous planner...')
    try {
      const { autonomousExecute, formatPlanSummary } = await import('./planner.js')
      const plan = await autonomousExecute(message, {
        ...options,
        agent: options.agent || 'coder',
      }, { autoApprove: false, onApproval: async () => true })
      const summary = formatPlanSummary(plan)
      addTurn({ role: 'user', content: message })
      addTurn({ role: 'assistant', content: summary })
      return {
        content: summary,
        agent: options.agent || 'coder',
        model: 'planner',
        toolCalls: plan.steps.filter(s => s.status === 'done').length,
      }
    } catch {
      // Planner failed — fall through to regular agent loop
      printWarn('Planner failed, falling back to direct execution...')
    }
  }

  // Step 1.7: Learned routing — try cached route before defaulting
  if (!options.agent) {
    const route = learnedRoute(message)
    if (route && route.confidence >= 0.6) {
      options.agent = route.agent
    }
  }

  const tier = options.tier || 'free'
  const allTools = getToolDefinitionsForApi(tier)
  const casual = isCasualMessage(message)

  // Smart tool filtering:
  // 1. Casual messages → no tools (just chat)
  // 2. Local small models → core tools only (10 instead of 60+, prevents confusion)
  // 3. Everything else → full tool set
  let tools: typeof allTools
  if (casual) {
    tools = [] // No tools for casual conversation
  } else if (isLocal) {
    tools = allTools.filter(t => CORE_TOOLS.has(t.name))
  } else {
    tools = allTools
  }

  // Step 2: Build context (cached — only rebuilt when inputs change)
  const matrixPrompt = options.agent ? getMatrixSystemPrompt(options.agent) : null
  const contextSnippet = options.context ? formatContextForPrompt(options.context) : ''
  const memorySnippet = getMemoryPrompt()
  const learningContext = buildFullLearningContext(message, process.cwd())

  const PERSONA = `You are K:BOT, an AI that lives in the user's terminal. Talk naturally — be direct, concise, and conversational. You're like a skilled colleague, not a corporate chatbot.

Conversation style:
- Be casual and natural. Use short sentences. Don't over-explain.
- When the user asks a question, answer it directly. Lead with the answer, not the reasoning.
- When chatting casually, just chat. Not everything needs tools or code.
- If the user says "hey" or "what's up", respond naturally — don't launch into capabilities.
- Match the user's energy. Short question → short answer. Detailed question → detailed response.
- Never say "I'd be happy to help with that" or "Certainly!" or "Great question!" — just do it.
- Don't repeat back what the user said. Don't restate the problem before solving it.

How you work with tools:
- When asked to create, fix, or build something — do it directly with your tools. Don't describe what you would do, just do it.
- If something fails, read the error and try a different approach. Don't give up.
- Make reasonable decisions autonomously — pick good defaults.
- After completing a task, briefly say what you did and where the output is.
- You run commands yourself. You never tell the user to run something.

Always quote file paths that contain spaces. Never reference internal system names.`

  // Inject repo map for code-related tasks (helps AI navigate the codebase)
  let repoMapSnippet = ''
  if (!casual && !isLocal) {
    try {
      const map = await getRepoMapForContext()
      if (map && map.length > 100) {
        repoMapSnippet = `\n\nRepository structure:\n${map}`
      }
    } catch { /* repo map is non-critical */ }
  }

  // Inject graph memory context (relevant entities/relationships)
  let graphSnippet = ''
  if (!casual) {
    try {
      const { toContext, load: loadGraph } = await import('./graph-memory.js')
      loadGraph()
      const ctx = toContext(300)
      if (ctx && ctx.length > 20) {
        graphSnippet = `\n\nKnowledge graph:\n${ctx}`
      }
    } catch { /* graph memory is non-critical */ }
  }

  // Prompt caching — split into stable (cacheable) and dynamic sections
  const promptSections = createPromptSections({
    persona: PERSONA,
    matrixPrompt: matrixPrompt || undefined,
    contextSnippet: (contextSnippet || '') + repoMapSnippet + graphSnippet || undefined,
    memorySnippet: memorySnippet || undefined,
    learningContext: learningContext || undefined,
  })
  const provider = byokProvider || 'anthropic'
  const { text: systemContext } = buildCacheablePrompt(promptSections, provider)

  let toolCallCount = 0
  let lastResponse: any = null
  const toolSequenceLog: string[] = []
  const originalMessage = message
  let cumulativeCostUsd = 0

  // Loop messages track the full conversation within a multi-tool execution.
  // This includes assistant responses (with tool-use reasoning) and tool results,
  // so the AI maintains context across tool iterations.
  const loopMessages: ProviderMessage[] = []

  for (let i = 0; i < MAX_TOOL_LOOPS; i++) {
    // Cost ceiling — stop burning money on runaway loops
    if (cumulativeCostUsd > MAX_COST_CEILING) {
      printWarn(`Cost ceiling reached ($${cumulativeCostUsd.toFixed(2)} > $${MAX_COST_CEILING}). Stopping tool loop.`)
      break
    }
    // Don't use spinner when streaming (conflicts with stdout)
    const useSpinner = !options.stream
    const spinner = useSpinner ? createSpinner(i === 0 ? 'Thinking...' : `Running tools (${toolCallCount})...`) : null
    spinner?.start()

    try {
      // ── BYOK: Call provider directly with tool-use support ──
      // If user passed an explicit model name (not a speed alias), use it directly
      const isExplicitModel = options.model && !['auto', 'haiku', 'fast', 'sonnet', 'default'].includes(options.model)
      const speed = options.model === 'haiku' || options.model === 'fast' ? 'fast' : 'default'
      const model = isExplicitModel ? options.model! : getProviderModel(provider, speed, originalMessage)

      // Ollama models don't reliably support function calling — skip tool defs
      const byokTools = provider === 'ollama' ? [] : tools.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema,
      }))

      // Build messages with RLM-style context management
      const rawMessages: ProviderMessage[] = [
        ...getPreviousMessages(),
        { role: 'user', content: message },
        ...loopMessages,
      ]

      // Auto-compact conversation history if it's getting too long
      const asTurns: ConversationTurn[] = rawMessages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))
      const { turns: compactedTurns } = autoCompact(asTurns)
      const messages: ProviderMessage[] = compactedTurns.map(t => ({
        role: t.role,
        content: t.content,
      }))

      spinner?.stop()

      // Use streaming if requested and provider supports it
      // Disable streaming for local models when tools are active — local models
      // often emit tool calls as raw JSON text, which can't be cleaned up after streaming
      const p = getProvider(provider)
      const canStream = options.stream
        && p.apiStyle !== 'google'
        && p.apiStyle !== 'cohere'
        && !(isLocal && byokTools.length > 0) // Don't stream local + tools (inline tool parsing needs full response)

      const result = canStream
        ? await callProviderStreaming(provider, apiKey || 'local', model, systemContext, messages, byokTools, {
            thinking: options.thinking,
            thinkingBudget: options.thinkingBudget,
          })
        : await callProvider(provider, apiKey || 'local', model, systemContext, messages, byokTools, {
            multimodal: i === 0 ? parsed : undefined,
            thinking: options.thinking,
            thinkingBudget: options.thinkingBudget,
          })

      const iterationCost = estimateCost(provider, result.usage.input_tokens, result.usage.output_tokens)
      cumulativeCostUsd += iterationCost

      if (result.tool_calls && result.tool_calls.length > 0) {
        lastResponse = {
          type: 'tool_calls',
          agent: options.agent || 'kernel',
          model: result.model,
          content: result.content,
          tool_calls: result.tool_calls.map(tc => ({
            id: tc.id,
            name: tc.name,
            arguments: tc.arguments,
          })),
          usage: {
            input_tokens: result.usage.input_tokens,
            output_tokens: result.usage.output_tokens,
            cost_usd: iterationCost,
          },
        }
      } else {
        lastResponse = {
          type: 'text',
          agent: options.agent || 'kernel',
          model: result.model,
          content: result.content,
          streamed: canStream, // flag to skip re-printing
          usage: {
            input_tokens: result.usage.input_tokens,
            output_tokens: result.usage.output_tokens,
            cost_usd: iterationCost,
          },
        }
      }

      // Text response → done
      if (lastResponse.type === 'text' || !lastResponse.tool_calls || lastResponse.tool_calls.length === 0) {
        let content = lastResponse.content || ''

        // Self-evaluation — score response and log quality signal
        if (isSelfEvalEnabled() && content.length > 50) {
          try {
            const evalResult = await evaluateResponse(originalMessage, content)
            if (evalResult.shouldRetry && evalResult.feedback) {
              printWarn(`Self-eval: low score (${evalResult.overall.toFixed(2)}), retrying...`)
              // Inject feedback and let the loop continue
              loopMessages.push({ role: 'assistant', content })
              loopMessages.push({ role: 'user', content: `Your previous response scored low on quality. Feedback: ${evalResult.feedback}\n\nPlease try again with a better response.` })
              continue
            }
          } catch { /* self-eval errors are non-critical */ }
        }

        addTurn({ role: 'user', content: originalMessage })
        addTurn({ role: 'assistant', content })

        // ── Recursive Learning: record what worked (async — non-blocking) ──
        const totalTokens = lastResponse.usage
          ? (lastResponse.usage.input_tokens || 0) + (lastResponse.usage.output_tokens || 0)
          : 0

        // Run all learning asynchronously to avoid blocking the response
        setImmediate(() => {
          try {
            // Record pattern if tools were used successfully
            if (toolCallCount > 0 && toolSequenceLog.length > 0) {
              const patternHint = findPattern(originalMessage)
              const savedTokens = patternHint ? patternHint.avgTokensSaved : 0
              recordPattern(originalMessage, toolSequenceLog, savedTokens)
            }

            // Cache solution for reuse (only meaningful responses)
            if (content.length > 50 && toolCallCount <= 5) {
              cacheSolution(originalMessage, content.slice(0, 2000))
            }

            // Update user profile
            updateProfile({
              tokens: totalTokens,
              tokensSaved: findPattern(originalMessage)?.avgTokensSaved || 0,
              agent: lastResponse.agent || 'kernel',
              taskType: classifyTask(originalMessage),
              techTerms: extractKeywords(originalMessage),
            })

            // Record routing decision for learned router
            const routeMethod = learnedRoute(originalMessage)?.method || 'llm'
            recordRoute(originalMessage, lastResponse.agent || 'kernel', routeMethod, true)

            // Deep learning — extract knowledge, detect corrections, update project memory
            learnFromExchange(originalMessage, content, toolSequenceLog, process.cwd())

            // Graph memory — extract entities and relationships (async, non-blocking)
            import('./graph-memory.js').then(({ extractEntities, autoConnect, save: saveGraph }) => {
              try {
                const newNodes = extractEntities(originalMessage, content)
                for (const node of newNodes) autoConnect(node.id)
                if (newNodes.length > 0) saveGraph()
              } catch { /* graph memory is non-critical */ }
            }).catch(() => { /* import failure is non-critical */ })

            // Track project context
            if (toolSequenceLog.length > 0) {
              updateProjectMemory(process.cwd(), {
                stack: extractKeywords(originalMessage),
              })
            }

            // Save embedding cache
            try { saveEmbeddingCache() } catch { /* non-critical */ }

            // MAP-Elites quality-diversity archive update
            import('./quality-diversity.js').then(({ initArchive, learnFromOutcome }) => {
              try {
                initArchive()
                // Use self-eval overall score (default 0.7 if not evaluated)
                const evalScore = lastResponse.usage?.evalScore ?? 0.7
                const successRate = toolCallCount > 0 ? 1.0 : 0.8
                learnFromOutcome(
                  originalMessage,
                  toolSequenceLog,
                  { overall: evalScore },
                  successRate,
                  totalTokens,
                  0, // retryCount
                )
              } catch { /* quality-diversity is non-critical */ }
            }).catch(() => { /* import failure is non-critical */ })

            // Auto self-training trigger
            if (shouldAutoTrain()) {
              try { selfTrain() } catch { /* silent */ }
            }
          } catch { /* learning failures are non-critical */ }
        })

        return {
          content,
          agent: lastResponse.agent || 'kernel',
          model: lastResponse.model || 'unknown',
          toolCalls: toolCallCount,
          streamed: lastResponse.streamed || false,
          usage: lastResponse.usage,
        }
      }

      // Tool calls → execute locally
      const toolCalls: ToolCall[] = lastResponse.tool_calls
      const results: ToolResult[] = []

      for (const call of toolCalls) {
        toolCallCount++
        toolSequenceLog.push(call.name)
        printToolCall(call.name, call.arguments || {})

        // Permission check — confirm destructive operations
        const permitted = await checkPermission(call.name, call.arguments || {})
        if (!permitted) {
          results.push({ tool_call_id: call.id, result: 'Denied by user — operation skipped.', error: true })
          printToolResult('Denied by user', true)
          continue
        }

        // Pre-tool hook
        const preHook = runPreToolHook(call.name, call.arguments || {}, options.agent || 'kernel')
        if (preHook.blocked) {
          results.push({ tool_call_id: call.id, result: `Blocked by hook: ${preHook.blockReason}`, error: true })
          printToolResult(`Blocked by hook: ${preHook.blockReason}`, true)
          continue
        }

        const result = await executeTool(call)
        results.push(result)
        printToolResult(result.result, result.error)

        // Post-tool hook
        runPostToolHook(call.name, call.arguments || {}, result.result, options.agent || 'kernel')
      }

      // ── Maintain conversation context across tool iterations ──
      // 1. Include the assistant's response (its reasoning + which tools it chose)
      const assistantSummary = lastResponse.content
        ? lastResponse.content
        : `Using tools: ${toolCalls.map(tc => tc.name).join(', ')}`
      loopMessages.push({ role: 'assistant', content: assistantSummary })

      // 2. Include tool results — compress large outputs to preserve context budget
      const toolResultSummary = results.map(r => {
        const status = r.error ? '[ERROR] ' : ''
        const compressed = r.result.length > 4000 ? compressToolResult(r.result) : r.result
        return `${r.tool_call_id} (${toolCalls.find(tc => tc.id === r.tool_call_id)?.name || 'unknown'}): ${status}${compressed}`
      }).join('\n\n')
      loopMessages.push({ role: 'user', content: `Tool results:\n${toolResultSummary}` })
    } catch (err) {
      spinner?.stop()
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

    // Skip re-printing if content was already streamed to stdout
    if (!response.streamed) {
      printResponse(response.agent, response.content)
    }

    // Usage footer — subtle, one line (stderr — status, not content)
    if (response.usage) {
      const tokens = response.usage.input_tokens + response.usage.output_tokens
      const cost = response.usage.cost_usd === 0 ? 'free' : `$${response.usage.cost_usd.toFixed(4)}`
      process.stderr.write(`\n  \x1b[2m${tokens} tokens · ${cost}\x1b[0m\n`)
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)

    // Ollama connection errors — friendly, actionable
    if (errMsg.includes('fetch failed') || errMsg.includes('ECONNREFUSED')) {
      const config = await import('./auth.js').then(m => m.loadConfig())
      if (config?.byok_provider === 'ollama') {
        printError('Ollama isn\'t running.')
        printInfo('Open the Ollama app or run: ollama serve')
        return
      }
      if (config?.byok_provider === 'openclaw') {
        printError('OpenClaw gateway isn\'t running.')
        printInfo('Start it: openclaw-cmd start')
        return
      }
      printError('Can\'t reach the AI provider.')
      printInfo('Check your internet connection and try again.')
      return
    }

    // Model not found
    if (errMsg.includes('model') && (errMsg.includes('not found') || errMsg.includes('does not exist'))) {
      printError('That model isn\'t installed yet.')
      printInfo('Download it: ollama pull <model-name>')
      return
    }

    // Rate limiting
    if (errMsg.includes('rate') || errMsg.includes('429') || errMsg.includes('too many')) {
      printError('Too many requests. Wait a moment and try again.')
      return
    }

    // Auth errors
    if (errMsg.includes('401') || errMsg.includes('403') || errMsg.includes('invalid') && errMsg.includes('key')) {
      printError('API key issue. Your key may be expired or invalid.')
      printInfo('Update it: kbot auth')
      return
    }

    printError(errMsg)
    process.exit(1)
  }
}
