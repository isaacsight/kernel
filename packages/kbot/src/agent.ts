// kbot Agent Loop v2 — Autonomous Reasoning Engine
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
  routeModelForTask,
  type ByokProvider,
} from './auth.js'
import {
  executeTool,
  getTool,
  getToolDefinitionsForApi,
  ensureLazyToolsLoaded,
  type ToolCall,
  type ToolResult,
} from './tools/index.js'
import {
  ToolPipeline,
  createDefaultPipeline,
  DEFAULT_FALLBACK_RULES,
  type ToolContext,
} from './tool-pipeline.js'
import { formatContextForPrompt, type ProjectContext } from './context.js'
import { getMatrixSystemPrompt, listAgents, createAgent, type MatrixAgent } from './matrix.js'
import {
  buildLearningContext, buildFullLearningContext, findPattern, recordPattern, recordPatternFailure,
  cacheSolution, updateProfile, classifyTask, extractKeywords,
  learnFromExchange, learnFact, updateProjectMemory,
  shouldAutoTrain, selfTrain,
} from './learning.js'
import { getMemoryPrompt, addTurn, getPreviousMessages, getHistory } from './memory.js'
import { autoCompact, compressToolResult, type ConversationTurn } from './context-manager.js'
import { learnedRoute, recordRoute } from './learned-router.js'
import { buildCacheablePrompt, createPromptSections } from './prompt-cache.js'
import { saveEmbeddingCache } from './embeddings.js'
import { distillSkill, retrieveSkills, formatSkillsForPrompt as formatSkillLibraryForPrompt, flushSkillLibrary } from './skill-library.js'
import { createSpinner, printToolCall, printToolResult, printResponse, printError, printInfo, printWarn } from './ui.js'
import type { UIAdapter } from './ui-adapter.js'
import { TerminalUIAdapter } from './ui-adapter.js'
import { parseMultimodalMessage, toAnthropicContent, toOpenAIContent, toGeminiParts, type ParsedMessage } from './multimodal.js'
import { streamAnthropicResponse, streamOpenAIResponse, stripThinkTags, ResponseStream, type StreamState } from './streaming.js'
import { checkPermission } from './permissions.js'
import { runPreToolHook, runPostToolHook } from './hooks.js'
import { getRepoMapForContext } from './repo-map.js'
import { recordSuccess, recordFailure } from './provider-fallback.js'
import { isSelfEvalEnabled, evaluateResponse } from './self-eval.js'
import { withErrorCorrection } from './error-correction.js'
import { EntropyScorer } from './entropy-context.js'
import { AutopoieticSystem } from './autopoiesis.js'
import { LoopDetector } from './godel-limits.js'
import { CheckpointManager, newSessionId, type Checkpoint } from './checkpoint.js'
import { TelemetryEmitter } from './telemetry.js'
import { loadSkills } from './skills-loader.js'
import { queueSignal, getCollectiveRecommendation, isCollectiveEnabled } from './collective.js'
import { ActiveInferenceEngine } from './free-energy.js'
import { PredictiveEngine } from './predictive-processing.js'
import { selectStrategy, recordStrategyOutcome } from './reasoning.js'
import { getDriveState, updateMotivation, getMotivationSummary } from './intentionality.js'
import { anticipateNext, recordUserAction, getIdentity, updateIdentity, addMilestone } from './temporal.js'
import { estimateConfidence, updateSkillProfile, recordActualEffort } from './confidence.js'
import { StrangeLoopDetector } from './strange-loops.js'
import { IntegrationMeter } from './integrated-information.js'
import { generateReflections, getRelevantReflections, formatReflectionsForPrompt, isUserRejection } from './reflection.js'
import { getSynthesisContext } from './memory-synthesis.js'
import { getActiveCorrectionsPrompt } from './synthesis-engine.js'
import { recordTrace, shouldEvolve, evolvePrompt, getPromptAmendment, updateMutationScore } from './prompt-evolution.js'
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
  const clSize = cl ? parseInt(cl, 10) : NaN
  if (!isNaN(clSize) && clSize > maxBytes) {
    await res.body?.cancel()
    throw new Error(`Response too large (${Math.round(clSize / 1024 / 1024)}MB). Max: ${Math.round(maxBytes / 1024 / 1024)}MB.`)
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
  /** UIAdapter for decoupled output (SDK use). Defaults to TerminalUIAdapter. */
  ui?: UIAdapter
  /** Custom tool execution pipeline (overrides default permission/hook/metrics chain) */
  pipeline?: ToolPipeline
  /** ResponseStream for structured event streaming (SDK/MCP/HTTP consumers) */
  responseStream?: ResponseStream
  /** Plan mode — read-only exploration, no writes or command execution */
  plan?: boolean
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
    signal: AbortSignal.timeout(300_000), // 5 min timeout
  })

  if (!res.ok) {
    const errBody = await safeReadBody(res, 1024 * 100).catch(() => '{}')
    let err: { message: string }
    try { err = JSON.parse(errBody).error || { message: `HTTP ${res.status}` } }
    catch { err = { message: `HTTP ${res.status}` } }
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
 *  Works with: OpenAI, Mistral, xAI, DeepSeek, Groq, Together, Fireworks, Perplexity, Ollama, kbot local
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

  // Local providers (Ollama, kbot local) may not need auth headers
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
    let err: { message: string }
    try { err = JSON.parse(errBody).error || { message: `HTTP ${res.status}` } }
    catch { err = { message: `HTTP ${res.status}` } }
    throw new Error(err.message || `API error: ${res.status}`)
  }

  const data = JSON.parse(await safeReadBody(res))
  const choice = data.choices?.[0] || {}
  let content = stripThinkTags(choice.message?.content || '')
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

  // Fallback: Local models sometimes emit tool calls as raw JSON, tool_code blocks,
  // or natural language descriptions instead of structured tool_calls.
  // Parse these so tools still work with Ollama and other local providers.
  if (!result.tool_calls && content && tools && tools.length > 0) {
    const toolNames = tools.map(t => (t as any).function?.name || t.name).filter(Boolean)
    const parsed = tryParseInlineToolCalls(content, toolNames)
    if (parsed.length > 0) {
      result.tool_calls = parsed
      // Remove parsed tool invocations from displayed content
      result.content = content
        .replace(/```(?:json)?\s*\{[\s\S]*?\}\s*```/g, '')
        .replace(/```(?:tool_code|tool_call)\s*\n[\s\S]*?```/g, '')
        .replace(/\{[\s\S]*?"name"\s*:\s*"[a-z_]+[\s\S]*?\}/g, '')
        .trim()
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
  if (calls.length > 0) return calls

  // Pattern 3: tool_code / tool_call blocks — Ollama models sometimes emit these
  // ```tool_code\nbash -c "echo hello"\n```  or  ```tool_call\nread_file path.ts\n```
  const toolCodePattern = /```(?:tool_code|tool_call)\s*\n([\s\S]*?)```/g
  while ((match = toolCodePattern.exec(content)) !== null) {
    const block = match[1].trim()
    const parsed = parseToolCodeBlock(block, knownTools)
    if (parsed) calls.push(parsed)
  }
  if (calls.length > 0) return calls

  // Pattern 4: Natural language tool invocations — "I'll use write_file to create..."
  // followed by arguments like paths and content in code blocks
  for (const toolName of knownTools) {
    const nlPattern = new RegExp(
      `(?:use|call|invoke|execute|run)\\s+(?:the\\s+)?(?:\`)?${toolName}(?:\`)?`,
      'i',
    )
    if (nlPattern.test(content)) {
      const parsed = parseNaturalLanguageTool(content, toolName, knownTools)
      if (parsed) calls.push(parsed)
    }
  }

  return calls
}

/** Parse a tool_code block into a tool call (e.g. `bash -c "echo hello"` or `write_file path content`) */
function parseToolCodeBlock(block: string, knownTools: string[]): ProviderToolCall | null {
  const lines = block.split('\n')
  const firstLine = lines[0].trim()

  // Direct tool name at start: "read_file src/index.ts"
  for (const tool of knownTools) {
    if (firstLine.startsWith(tool + ' ') || firstLine === tool) {
      const args = firstLine.slice(tool.length).trim()
      return {
        id: `inline_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: tool,
        arguments: buildArgsFromToolCode(tool, args, lines.slice(1).join('\n')),
      }
    }
  }

  // Bare shell commands → route to bash tool
  if (knownTools.includes('bash')) {
    // Common shell patterns: command at start of line
    const shellPattern = /^(?:cd|ls|cat|mkdir|cp|mv|rm|echo|git|npm|npx|node|python|pip|cargo|go|make|curl|wget|find|grep|sed|awk|chmod|chown|touch|tar|unzip)\b/
    if (shellPattern.test(firstLine)) {
      return {
        id: `inline_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: 'bash',
        arguments: { command: block },
      }
    }
  }

  return null
}

/** Build structured args from a tool_code invocation */
function buildArgsFromToolCode(
  tool: string, argStr: string, restContent: string,
): Record<string, unknown> {
  switch (tool) {
    case 'read_file':
    case 'list_directory':
      return { path: argStr || '.' }
    case 'write_file':
      return { path: argStr, content: restContent }
    case 'bash':
      return { command: argStr || restContent }
    case 'grep':
      // "grep pattern path"
      const gparts = argStr.split(/\s+/, 2)
      return { pattern: gparts[0] || argStr, path: gparts[1] || '.' }
    case 'git_status':
    case 'git_diff':
    case 'git_log':
      return {}
    case 'git_commit':
      return { message: argStr || restContent }
    case 'web_search':
      return { query: argStr || restContent }
    default:
      return argStr ? { input: argStr } : {}
  }
}

/** Extract tool arguments from natural language descriptions */
function parseNaturalLanguageTool(
  content: string, toolName: string, _knownTools: string[],
): ProviderToolCall | null {
  // Look for file paths and code blocks following the tool mention
  const pathMatch = content.match(/(?:file|path)\s*[:=]?\s*[`"']([^`"'\n]+)[`"']/i)
    || content.match(/(?:to|at|in)\s+[`"']([^`"'\n]+\.\w+)[`"']/i)
    || content.match(/[`"']((?:\.\/|\/|src\/|packages\/)[^`"'\n]+)[`"']/i)
  const codeMatch = content.match(/```\w*\n([\s\S]*?)```/)

  const path = pathMatch?.[1]
  const code = codeMatch?.[1]

  const args: Record<string, unknown> = {}

  switch (toolName) {
    case 'write_file':
      if (path) args.path = path
      if (code) args.content = code
      if (!path) return null // need at least a path
      break
    case 'read_file':
    case 'list_directory':
      if (path) args.path = path
      else return null
      break
    case 'bash':
      if (code) args.command = code.trim()
      else return null
      break
    case 'grep':
      if (path) args.path = path
      const patternMatch = content.match(/(?:for|pattern)\s*[:=]?\s*[`"']([^`"'\n]+)[`"']/i)
      if (patternMatch) args.pattern = patternMatch[1]
      else return null
      break
    case 'web_search':
      const queryMatch = content.match(/(?:search|query|look up)\s+(?:for\s+)?[`"']([^`"'\n]+)[`"']/i)
      if (queryMatch) args.query = queryMatch[1]
      else return null
      break
    default:
      return null
  }

  return {
    id: `inline_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: toolName,
    arguments: args,
  }
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

  const res = await fetch(`${apiUrl}/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(300_000), // 5 min timeout
  })

  if (!res.ok) {
    const errBody = await safeReadBody(res, 1024 * 100).catch(() => '{}')
    let err: { message: string }
    try { err = JSON.parse(errBody).error || { message: `HTTP ${res.status}` } }
    catch { err = { message: `HTTP ${res.status}` } }
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
    signal: AbortSignal.timeout(300_000), // 5 min timeout
  })

  if (!res.ok) {
    const errBody = await safeReadBody(res, 1024 * 100).catch(() => '{}')
    let err: { message: string }
    try { err = JSON.parse(errBody).error || { message: `HTTP ${res.status}` } }
    catch { err = { message: `HTTP ${res.status}` } }
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
  options?: { thinking?: boolean; thinkingBudget?: number; responseStream?: ResponseStream },
): Promise<ProviderResult> {
  const p = getProvider(provider)

  let state: StreamState

  if (p.apiStyle === 'anthropic') {
    state = await streamAnthropicResponse(
      apiKey, p.apiUrl, model, systemContext,
      messages.map(m => ({ role: m.role, content: m.content as unknown })),
      tools,
      { thinking: options?.thinking, thinkingBudget: options?.thinkingBudget, responseStream: options?.responseStream },
    )
  } else {
    state = await streamOpenAIResponse(
      apiKey, p.apiUrl, model, systemContext,
      messages.map(m => ({ role: m.role, content: m.content })),
      tools,
      { responseStream: options?.responseStream },
    )
  }

  const result: ProviderResult = {
    content: stripThinkTags(state.content),
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

  // Messages containing "you" likely refer to kbot itself — route through agent pipeline
  // so kbot can answer questions about its own capabilities (e.g., "do you work", "can you code")
  const refersToKbot = /\byou\b/.test(lower)

  // Pure greetings — always casual even if short
  if (/^(hey|hi|hello|yo|sup|what's up|whats up|howdy|hola|gm|gn|good morning|good night|good evening|good afternoon)$/i.test(lower)) {
    return true
  }

  // Very short messages are usually conversational, but not if they refer to kbot
  if (lower.length < 20 && !refersToKbot && !/\b(fix|create|build|run|deploy|install|delete|remove|write|edit|read|find|search|open|show|list|git|npm|pip|cargo)\b/.test(lower)) {
    return true
  }

  // Greetings and chitchat
  const casualPatterns = [
    /^(hey|hi|hello|yo|sup|what's up|whats up|howdy|hola)\b/,
    /^(how are you|how's it going|what's good|how do you do)\b/,
    /^(thanks|thank you|thx|ty|cool|nice|great|awesome|perfect|ok|okay|sure|got it|understood)\b/,
    /^(tell me about|explain|what do you think|how does|why does|why is|what if)\b/,
    /^(good morning|good night|good evening|good afternoon|gm|gn)\b/,
    /^(bye|goodbye|see you|later|peace|quit|exit)\b/,
    /^(yes|no|maybe|probably|nah|nope|yep|yeah)\b/,
    /^(lol|lmao|haha|bruh|wow|damn|dang|omg|wtf)\b/,
    /\?$/, // Questions are usually conversational unless they contain action words
  ]

  // If it matches a casual pattern AND doesn't contain action words AND doesn't refer to kbot, it's casual
  const isCasualPattern = casualPatterns.some(p => p.test(lower))
  const hasActionWords = /\b(fix|create|build|run|deploy|install|delete|remove|write|edit|make|generate|scaffold|refactor|update|add|implement|set up|configure|debug|test)\b/.test(lower)

  if (isCasualPattern && !hasActionWords && !refersToKbot) return true

  // Questions that end with ? and don't have action words and don't refer to kbot
  if (lower.endsWith('?') && !hasActionWords && !refersToKbot && lower.length < 100) return true

  return false
}

/** Core tools that small local models can handle without getting confused */
const CORE_TOOLS = new Set([
  'read_file', 'write_file', 'list_directory', 'bash',
  'git_status', 'git_diff', 'git_commit', 'git_log',
  'grep', 'web_search',
])

/** Read-only tools allowed in plan mode — no writes, no command execution */
const PLAN_MODE_TOOLS = new Set([
  'read_file', 'glob', 'grep', 'git_status', 'git_log', 'git_diff',
  'web_search', 'research', 'url_fetch',
  'github_search', 'github_repo_info', 'github_read_file',
  'list_directory', 'memory_search', 'db_schema',
  'lsp_hover', 'lsp_diagnostics', 'lsp_symbols', 'lsp_find_references', 'lsp_goto_definition',
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

    // Embedded inference — runs in-process via node-llama-cpp, no HTTP
    if (provider === 'embedded') {
      const { chatCompletion } = await import('./inference.js')
      const embResult = await chatCompletion(
        systemContext,
        messages.map(m => ({ role: m.role, content: m.content })),
        tools,
      )
      result = {
        content: embResult.content,
        model: embResult.model,
        usage: embResult.usage,
        tool_calls: embResult.tool_calls,
        stop_reason: embResult.stop_reason,
      }
    } else {
      switch (p.apiStyle) {
        case 'anthropic': result = await callAnthropic(apiKey, p.apiUrl, model, systemContext, messages, tools, options); break
        case 'google':    result = await callGemini(apiKey, p.apiUrl, model, systemContext, messages); break
        case 'cohere':    result = await callCohere(apiKey, p.apiUrl, model, systemContext, messages); break
        case 'openai':    result = await callOpenAICompat(apiKey, p.apiUrl, model, systemContext, messages, tools); break
        default:          result = await callOpenAICompat(apiKey, p.apiUrl, model, systemContext, messages, tools); break
      }
    }
    recordSuccess(provider, Date.now() - startTime)
    return result
  } catch (err) {
    recordFailure(provider, err instanceof Error ? err : new Error(String(err)))

    const errMsg = err instanceof Error ? err.message : String(err)

    // Model doesn't support tools — retry without tools, let inline parser handle it
    if (tools && tools.length > 0 && (errMsg.includes('does not support tools') || errMsg.includes('does not support function') || errMsg.includes('tools is not supported'))) {
      printWarn(`${model} doesn't support tool calling — falling back to inline tool parsing...`)
      return callProvider(provider, apiKey, model, systemContext, messages, undefined, options)
    }

    // Auto-retry with fallback model for local providers
    if (isLocalProvider(provider) && model !== p.fastModel) {
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
  // UIAdapter: defaults to TerminalUIAdapter for CLI, can be overridden for SDK use
  const ui = options.ui ?? new TerminalUIAdapter()

  let apiKey = getByokKey()
  let byokProvider = getByokProvider()
  let isLocal = byokProvider ? isLocalProvider(byokProvider) : false
  if (!apiKey && !isLocal) {
    // Last-resort fallback: try embedded engine before erroring
    try {
      const { setupEmbedded } = await import('./auth.js')
      setupEmbedded()
      apiKey = getByokKey()
      byokProvider = getByokProvider()
      isLocal = true
    } catch {
      throw new Error('No LLM API key configured. Run `kbot auth` to set up, or `kbot local` for local models.')
    }
  }

  // Step 0a: Warm Ollama model cache if using local provider
  if (isLocal && byokProvider === 'ollama') {
    warmOllamaModelCache().catch(() => {}) // non-blocking
  }

  // Step 0: Parse multimodal content (images in message)
  const parsed = options.multimodal || parseMultimodalMessage(message)
  if (parsed.isMultimodal) {
    ui.onInfo(`(${parsed.imageCount} image${parsed.imageCount > 1 ? 's' : ''} attached)`)
  }

  // Step 1: Local-first (skip if multimodal — needs AI to interpret)
  if (!parsed.isMultimodal) {
    const localResult = await tryLocalFirst(message)
    if (localResult !== null) {
      addTurn({ role: 'user', content: message })
      addTurn({ role: 'assistant', content: localResult })
      ui.onInfo('(handled locally — 0 tokens used)')
      return { content: localResult, agent: 'local', model: 'none', toolCalls: 0 }
    }
  }

  // Step 1.4: MAR user rejection detection — if user says "no/wrong/that's not right",
  // generate reflections from the previous response
  if (isUserRejection(message)) {
    try {
      const history = getHistory()
      const lastAssistant = [...history].reverse().find(t => t.role === 'assistant')
      const lastUser = [...history].reverse().find(t => t.role === 'user')
      if (lastAssistant && lastUser) {
        generateReflections(lastUser.content, lastAssistant.content, 'user_rejection')
      }
    } catch { /* reflection on rejection is non-critical */ }
  }

  // Step 1.5: Complexity detection — auto-plan complex tasks
  if (isComplexTask(message) && !message.startsWith('/plan') && !options.skipPlanner) {
    ui.onInfo('Complex task detected. Using autonomous planner...')
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
      ui.onWarning('Planner failed, falling back to direct execution...')
    }
  }

  // Capture whether the user explicitly set --agent (before routing overwrites it)
  const userExplicitAgent = !!options.agent
  let routeConfidence = userExplicitAgent ? 1.0 : 0

  // Step 1.7: Learned routing — try cached route, then collective wisdom
  if (!options.agent) {
    const route = learnedRoute(message)
    if (route && route.confidence >= 0.6) {
      options.agent = route.agent
      routeConfidence = route.confidence
    } else if (isCollectiveEnabled()) {
      // Fall back to collective intelligence — what worked for all kbot users?
      const taskType = classifyTask(message)
      const collective = getCollectiveRecommendation(taskType)
      if (collective && collective.confidence >= 0.7) {
        options.agent = collective.agent
        routeConfidence = collective.confidence
      }
    }
  }

  const tier = options.tier || 'free'

  // Ensure lazy tools are loaded before building the tool list for the API.
  // In one-shot mode, lazy tools may still be loading in background — await them here.
  await ensureLazyToolsLoaded()

  const allTools = getToolDefinitionsForApi(tier)
  const casual = isCasualMessage(message)

  // Smart tool filtering:
  // 1. Casual messages → no tools (just chat)
  // 2. Local small models → core tools only (10 instead of 60+, prevents confusion)
  // 3. Everything else → full tool set (capped at provider limit)
  let tools: typeof allTools
  if (casual) {
    tools = [] // No tools for casual conversation
  } else if (isLocal) {
    tools = allTools.filter(t => CORE_TOOLS.has(t.name))
  } else {
    tools = allTools
  }

  // OpenAI-compatible APIs cap at 128 tools per request
  const providerConfig = getProvider(getByokProvider())
  if (providerConfig.apiStyle === 'openai' && tools.length > 128) {
    // Prioritize core tools, then fill remaining slots
    const core = tools.filter(t => CORE_TOOLS.has(t.name))
    const rest = tools.filter(t => !CORE_TOOLS.has(t.name))
    tools = [...core, ...rest].slice(0, 128)
  }

  // Plan mode: restrict to read-only tools only
  if (options.plan) {
    tools = tools.filter(t => PLAN_MODE_TOOLS.has(t.name))
    ui.onInfo('Plan mode — read-only exploration. No writes or command execution.')
  }

  // Step 2: Build context (cached — only rebuilt when inputs change)
  const matrixPrompt = options.agent ? getMatrixSystemPrompt(options.agent) : null
  const contextSnippet = options.context ? formatContextForPrompt(options.context) : ''
  const skillsSnippet = loadSkills(process.cwd())
  const memorySnippet = getMemoryPrompt()
  const learningContext = buildFullLearningContext(message, process.cwd())
  const synthesisSnippet = getSynthesisContext(8) // Three-tier memory: reflection layer insights
  const correctionsSnippet = getActiveCorrectionsPrompt() // Closed-loop: corrections from reflections + failures

  // Skill library: retrieve proven tool-chain skills for similar tasks
  let skillLibrarySnippet = ''
  if (!casual) {
    try {
      const matchedSkills = await retrieveSkills(message, 3)
      if (matchedSkills.length > 0) {
        skillLibrarySnippet = formatSkillLibraryForPrompt(matchedSkills)
      }
    } catch { /* skill retrieval is non-critical */ }
  }

  const PERSONA = `You are kbot — an AI that lives in the user's terminal. You are also an autonomous Agentic Software Engineer. Your goal is to solve complex engineering problems by interacting directly with the user's system, codebase, and toolchain.

## CORE PHILOSOPHY

1. **Act, Don't Just Advise.** Do not give the user snippets to copy-paste. Write complete files, run terminal commands, execute tests, and verify your own work.
2. **Read Before You Write.** Never blindly assume the state of the codebase. Always use tools to search directories, read existing file contents, and check git status before proposing changes.
3. **Surgical Precision.** When modifying existing code, do not rewrite the entire file unless necessary. Use targeted edits. Understand existing abstractions and adhere to the project's style.
4. **Autonomous Verification.** After writing code, run the build, linter, or test suite to prove it works. If it fails, read the error logs and fix it autonomously.

## THE AGENTIC WORKFLOW

For complex tasks, follow this strict workflow:

### Phase 1: Planning & Discovery
- Search the filesystem to understand the existing architecture.
- Identify all files that need to be created or modified.
- Present a clear, bulleted implementation plan and ask for approval.

### Phase 2: Execution
- Execute the approved plan step-by-step.
- Generate full, complete files for new components.
- Make targeted replacements in existing files.
- If you encounter unexpected complexity, STOP, write down the issue, and revise the plan.

### Phase 3: Verification
- Run the compiler, linter, or test suite.
- If errors occur, diagnose and fix them iteratively.
- Summarize the changes made and verification steps taken.

## COMMUNICATION STYLE

Talk naturally — be direct, concise, and conversational. You're a skilled colleague, not a corporate chatbot.

- Be casual and natural. Use short sentences. Don't over-explain.
- When the user asks a question, answer it directly. Lead with the answer, not the reasoning.
- When chatting casually, just chat. Not everything needs tools or code.
- If the user says "hey" or "what's up", respond naturally — don't launch into capabilities.
- Match the user's energy. Short question → short answer. Detailed question → detailed response.
- Never say "I'd be happy to help with that" or "Certainly!" or "Great question!" — just do it.
- Don't repeat back what the user said. Don't restate the problem before solving it.
- Be proactive but never reckless. Always ask for permission before running destructive commands.

How you work with tools:
- When asked to create, fix, or build something — do it directly with your tools. Don't describe what you would do, just do it.
- If something fails, read the error and try a different approach. Don't give up.
- Make reasonable decisions autonomously — pick good defaults.
- After completing a task, briefly say what you did and where the output is.
- You run commands yourself. You never tell the user to run something.

Your primary directive: **Do the work for the user, verify it works, and report back when finished.**

## LIMITLESS EXECUTION

You are not a chatbot. You are an agent with real tools in a real system. Act like it.

- **The internet is your workspace.** You can fetch any URL, search the web, scrape pages, call APIs. If information exists online, go get it — don't say "you could check..." Just check.
- **The filesystem is your canvas.** You read, write, create, delete, glob, grep. You don't describe files — you make them.
- **The shell is your hands.** You run builds, tests, installs, deploys. You don't give instructions — you execute.
- **Other models are your colleagues.** You have 20 providers. Use the right model for the right subtask. Local for privacy. Fast models for quick checks. Powerful models for reasoning.
- **Memory is your advantage.** You learn patterns, cache solutions, build a profile of how this user works. Use it. Every session should be faster than the last.
- **Missing tools are discoverable.** If a tool doesn't exist, use mcp_search to find an MCP server that provides it, mcp_install to install it, mcp_connect to connect, and mcp_call to use it. If no server exists, use forge_tool to create the tool at runtime.
- **When stuck, don't stop. Adapt.** Try a different tool. Search for the answer. Read the source code. Fetch the documentation. There is always a path forward.
- **Self-extending.** If you need a capability that no tool provides, use forge_tool to create it on the fly. Write the JavaScript, test it, and it's immediately available — and persisted for future sessions.

You are limited only by what your tools can reach — and your tools can reach the filesystem, the shell, the web, APIs, databases, browsers, and other AI models. Use all of them.

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

  // Inject MAR reflections — lessons from past failures for similar tasks
  let reflectionSnippet = ''
  if (!casual) {
    try {
      const relevantReflections = getRelevantReflections(message, 3)
      reflectionSnippet = formatReflectionsForPrompt(relevantReflections)
    } catch { /* reflections are non-critical */ }
  }

  // Prompt caching — split into stable (cacheable) and dynamic sections
  const promptSections = createPromptSections({
    persona: PERSONA,
    matrixPrompt: matrixPrompt || undefined,
    contextSnippet: (contextSnippet || '') + repoMapSnippet + graphSnippet + skillsSnippet + skillLibrarySnippet || undefined,
    memorySnippet: (memorySnippet || '') + reflectionSnippet || undefined,
    learningContext: ((learningContext || '') + (synthesisSnippet ? '\n\n' + synthesisSnippet : '') + (correctionsSnippet ? '\n\n' + correctionsSnippet : '')) || undefined,
  })
  const provider = byokProvider || 'anthropic'
  let { text: systemContext } = buildCacheablePrompt(promptSections, provider)

  // Prompt evolution: inject evolved instructions for this agent (GEPA)
  const activeAgent = options.agent || 'kernel'
  const promptAmendment = getPromptAmendment(activeAgent)
  if (promptAmendment) {
    systemContext += promptAmendment
  }

  // Plan mode: append read-only instruction to system prompt
  if (options.plan) {
    systemContext += '\n\n## PLAN MODE\n\nYou are in PLAN MODE. You can read, search, and analyze — but you CANNOT write files, execute commands, or make changes. Your job is to understand the problem and propose a plan. Output a numbered list of steps.'
  }

  let toolCallCount = 0
  let lastResponse: any = null
  const toolSequenceLog: string[] = []
  const toolSequenceWithArgs: Array<{ name: string; args: Record<string, unknown> }> = []
  const originalMessage = message
  let cumulativeCostUsd = 0
  let selfEvalScore: number | undefined
  let qualityGateRetried = false

  // ── Checkpointing & Telemetry ──
  const sessionId = newSessionId()
  const checkpointManager = new CheckpointManager()
  const telemetry = new TelemetryEmitter(sessionId)

  telemetry.emit('session_start', {
    agent: options.agent || 'kernel',
    model: options.model || 'auto',
    message: originalMessage.slice(0, 200),
  })

  // ── Gödel limits: detect undecidable loops and hand off to human ──
  const loopDetector = new LoopDetector({
    maxToolRepeats: 5,
    maxCostUsd: MAX_COST_CEILING,
    maxTokens: 50000,
    similarityThreshold: 0.85,
  })

  // ── Entropy scorer: information-theoretic context management ──
  const entropyScorer = new EntropyScorer()

  // ── Autopoiesis: self-maintaining system health ──
  const autopoietic = new AutopoieticSystem()

  // ── Full cognitive stack (wired in v3.6.2) ──
  const freeEnergy = new ActiveInferenceEngine()
  const predictive = new PredictiveEngine()
  const strangeLoops = new StrangeLoopDetector()
  const integrationMeter = new IntegrationMeter()

  // Pre-execution intelligence: predict, plan, estimate (all non-critical)
  try {
    // Predictive processing — anticipate what the user will ask next
    const prediction = predictive.predict([originalMessage], toolSequenceLog)
    if (prediction && prediction.confidence > 0.6) {
      telemetry.emit('prediction_made', { cogModule: 'prediction', intent: prediction.predictedAction, confidence: prediction.confidence })
    }

    // Free energy — observe the incoming message and update beliefs
    freeEnergy.observeMessage(originalMessage)
    const policy = freeEnergy.recommendPolicy()

    // Confidence — how well can we handle this task?
    const conf = estimateConfidence(originalMessage, contextSnippet || '')

    // Reasoning — select the best strategy for this task type
    const strategy = selectStrategy(originalMessage, contextSnippet || '')

    // Intentionality — what drives are active?
    const drives = getDriveState()

    // Temporal — what did the user do last? Can we anticipate?
    const anticipated = anticipateNext([originalMessage], originalMessage)
  } catch { /* cognitive stack is non-critical — never block the agent loop */ }

  // ── Tool execution pipeline ──
  const pipeline = options.pipeline ?? createDefaultPipeline({
    checkPermission,
    runPreHook: (name, args) => {
      const h = runPreToolHook(name, args, options.agent || 'kernel')
      return { blocked: h.blocked ?? false, blockReason: h.blockReason }
    },
    runPostHook: (name, args, result) => { runPostToolHook(name, args, result, options.agent || 'kernel') },
    executeTool: async (name, args) => {
      const r = await executeTool({ id: name, name, arguments: args })
      return { result: r.result, error: r.error ? r.result : undefined }
    },
    recordMetrics: (name, duration, error) => {
      telemetry.emit('tool_call_end', { tool: name, duration_ms: duration, error })
    },
    emit: (event, data) => telemetry.emit(event as any, data),
    fallbackRules: DEFAULT_FALLBACK_RULES,
  })

  // Loop messages track the full conversation within a multi-tool execution.
  // This includes assistant responses (with tool-use reasoning) and tool results,
  // so the AI maintains context across tool iterations.
  const loopMessages: ProviderMessage[] = []

  for (let i = 0; i < MAX_TOOL_LOOPS; i++) {
    // Cost ceiling — stop burning money on runaway loops
    if (cumulativeCostUsd > MAX_COST_CEILING) {
      ui.onWarning(`Cost ceiling reached ($${cumulativeCostUsd.toFixed(2)} > $${MAX_COST_CEILING}). Stopping tool loop.`)
      break
    }

    // ── Autopoiesis: check system viability ──
    const viabilityCheck = autopoietic.shouldContinue()
    if (!viabilityCheck.continue) {
      ui.onWarning(`Autopoiesis: ${viabilityCheck.reason}`)
      break
    }

    // ── Gödel check: detect stuck loops before burning more tokens ──
    if (i > 2) {
      const decidability = loopDetector.check()
      if (!decidability.decidable) {
        const msg = decidability.pattern
          ? `Loop detected (${decidability.pattern}): ${decidability.evidence}`
          : decidability.evidence
        if (decidability.recommendation === 'handoff') {
          ui.onWarning(`${msg}\nHanding off to you — I need your input to continue.`)
          break
        } else if (decidability.recommendation === 'decompose') {
          ui.onWarning(`${msg}\nBreaking this into smaller steps...`)
          break
        } else if (decidability.recommendation === 'simplify') {
          ui.onInfo(`${msg} Trying a different approach...`)
          loopMessages.push({ role: 'user', content: `Your approach isn't working. Try a completely different strategy. ${decidability.evidence}` })
        }
      }
    }
    // Don't use spinner when streaming (conflicts with stdout)
    const useSpinner = !options.stream
    const spinnerHandle = useSpinner ? ui.onSpinnerStart(i === 0 ? 'Thinking...' : `Running tools (${toolCallCount})...`) : null

    try {
      // ── Privacy Router: check before any inference ──
      try {
        const { routeForPrivacy, logRoutingDecision } = await import('./privacy-router.js')
        const privacyDecision = routeForPrivacy(
          loopMessages.map(m => typeof m.content === 'string' ? m.content : '').join(' '),
          undefined,
          { forceLocal: options.model === 'local' },
        )
        logRoutingDecision(privacyDecision, originalMessage)
        // If privacy requires local and current provider is cloud, switch to Ollama
        if (privacyDecision.target === 'local' && privacyDecision.sensitiveDetected && !isLocalProvider(provider)) {
          ui.onInfo(`Privacy: sensitive content detected (${privacyDecision.matchedPatterns.join(', ')}) — routing to local model`)
        }
      } catch { /* privacy router is non-critical */ }

      // ── BYOK: Call provider directly with tool-use support ──
      // If user passed an explicit model name (not a speed alias), use it directly
      const isExplicitModel = options.model && !['auto', 'haiku', 'fast', 'sonnet', 'default'].includes(options.model)
      const speed = options.model === 'haiku' || options.model === 'fast' ? 'fast' : 'default'
      let model: string
      if (isExplicitModel) {
        model = options.model!
      } else if (!options.model || options.model === 'auto') {
        // Cost-aware routing: classify complexity and pick the right model
        const routed = routeModelForTask(provider, originalMessage)
        model = routed.model
      } else {
        model = getProviderModel(provider, speed, originalMessage)
      }

      // Send tool definitions to ALL providers — including Ollama.
      // Modern Ollama models (llama3.1+, qwen2.5, gemma3) support function calling.
      // For models that don't, the inline tool-call parser catches JSON/text patterns.
      const byokTools = tools.map(t => ({
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

      // Auto-compact conversation history — entropy-aware compression
      // Drops low-novelty turns first, preserves high-information turns
      const asTurns: ConversationTurn[] = rawMessages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))
      const { turns: compactedTurns } = autoCompact(asTurns)

      // Second pass: entropy-based eviction of redundant turns
      const entropyFiltered = compactedTurns.filter((turn, idx) => {
        if (idx >= compactedTurns.length - 6) return true // always keep recent 6
        return !entropyScorer.shouldEvict(turn, compactedTurns.slice(0, idx))
      })

      const messages: ProviderMessage[] = entropyFiltered.map(t => ({
        role: t.role,
        content: t.content,
      }))

      spinnerHandle?.stop()

      // Use streaming if requested and provider supports it
      // Disable streaming for local models when tools are active — local models
      // often emit tool calls as raw JSON text, which can't be cleaned up after streaming
      const p = getProvider(provider)
      const canStream = options.stream
        && p.apiStyle !== 'google'
        && p.apiStyle !== 'cohere'
        && !(isLocal && byokTools.length > 0) // Don't stream local + tools (inline tool parsing needs full response)

      // ── Telemetry: API call ──
      const apiCallStartMs = Date.now()
      telemetry.emit('api_call', { provider, model, iteration: i, streaming: !!canStream })

      let result: ProviderResult
      try {
        result = canStream
          ? await callProviderStreaming(provider, apiKey || 'local', model, systemContext, messages, byokTools, {
              thinking: options.thinking,
              thinkingBudget: options.thinkingBudget,
              responseStream: options.responseStream,
            })
          : await callProvider(provider, apiKey || 'local', model, systemContext, messages, byokTools, {
              multimodal: i === 0 ? parsed : undefined,
              thinking: options.thinking,
              thinkingBudget: options.thinkingBudget,
            })
      } catch (apiErr) {
        // ── Autopoiesis: report provider failure ──
        autopoietic.reportHealth(provider, false)
        telemetry.emit('api_error', {
          provider, model, iteration: i,
          error: apiErr instanceof Error ? apiErr.message : String(apiErr),
        }, Date.now() - apiCallStartMs)
        throw apiErr
      }

      // ── Autopoiesis: report provider success ──
      autopoietic.reportHealth(provider, true)

      const iterationCost = estimateCost(provider, result.usage.input_tokens, result.usage.output_tokens)
      cumulativeCostUsd += iterationCost

      telemetry.emit('cost_update', {
        iteration: i,
        iterationCost,
        cumulativeCostUsd,
        inputTokens: result.usage.input_tokens,
        outputTokens: result.usage.output_tokens,
      }, Date.now() - apiCallStartMs)

      // ── Feed Gödel detector with cost/token data ──
      loopDetector.recordCost(iterationCost)
      loopDetector.recordTokens(result.usage.input_tokens + result.usage.output_tokens)
      if (result.content) loopDetector.recordOutput(result.content)

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

        // ── Error correction: classify + fix errors by type (always active) ──
        if (content.length > 50 && i < MAX_TOOL_LOOPS - 2) {
          try {
            const { classifyError: classify } = await import('./error-correction.js')
            const classification = await classify(originalMessage, content)
            if (classification && classification.confidence > 0.7) {
              const { applyCorrection } = await import('./error-correction.js')
              const correctionPrompt = applyCorrection(
                originalMessage, content, classification.errorType, classification.evidence,
              )
              ui.onWarning(`Error correction: ${classification.errorType} (${(classification.confidence * 100).toFixed(0)}%) — retrying with fix...`)
              // MAR: generate multi-agent reflections on the error
              try { generateReflections(originalMessage, content, 'error_correction') } catch { /* non-critical */ }
              loopMessages.push({ role: 'assistant', content })
              loopMessages.push({ role: 'user', content: correctionPrompt })
              continue
            }
          } catch { /* error correction is non-critical */ }
        }

        // ── Response quality gate: catch obvious garbage before LLM eval (self-eval only) ──
        if (isSelfEvalEnabled() && !qualityGateRetried) {
          const trimmed = content.trim()
          const isGarbage =
            trimmed.length === 0 ||
            (trimmed.length < 10 && !/^(yes|no|done|ok|sure|true|false|n\/a|\d+)\.?$/i.test(trimmed)) ||
            /^\s*\{"error":/i.test(trimmed) ||
            /^\s*(Error:|Traceback \(most recent|    at )/m.test(trimmed)

          if (isGarbage) {
            qualityGateRetried = true
            ui.onWarning('Quality gate: response looks like garbage, retrying once...')
            loopMessages.push({ role: 'assistant', content })
            loopMessages.push({ role: 'user', content: 'Your previous response was low quality. Please try again with a clear, helpful answer.' })
            continue
          }
        }

        // Self-evaluation — optional additional quality gate
        if (isSelfEvalEnabled() && content.length > 50) {
          try {
            const evalResult = await evaluateResponse(originalMessage, content)
            selfEvalScore = evalResult.overall
            if (evalResult.shouldRetry && evalResult.feedback) {
              ui.onWarning(`Self-eval: low score (${evalResult.overall.toFixed(2)}), retrying...`)
              // MAR: generate multi-agent reflections on the low-quality response
              try { generateReflections(originalMessage, content, 'low_score') } catch { /* non-critical */ }
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

            // Update user profile + Bayesian skill ratings
            updateProfile({
              tokens: totalTokens,
              tokensSaved: findPattern(originalMessage)?.avgTokensSaved || 0,
              agent: lastResponse.agent || 'kernel',
              taskType: classifyTask(originalMessage),
              techTerms: extractKeywords(originalMessage),
              message: originalMessage,
              success: true,
            })

            // Record routing decision for learned router
            const routeMethod = learnedRoute(originalMessage)?.method || 'llm'
            recordRoute(originalMessage, lastResponse.agent || 'kernel', routeMethod, true)

            // Collective learning — send anonymized signal to the hive mind
            try {
              queueSignal({
                message_hash: originalMessage,
                message_category: classifyTask(originalMessage),
                message_length: originalMessage.length,
                routed_agent: lastResponse.agent || 'kernel',
                classifier_confidence: routeConfidence,
                was_rerouted: userExplicitAgent,
                response_quality: selfEvalScore ?? 0.7,
                tool_sequence: toolSequenceLog,
                strategy: selectStrategy(originalMessage, '').chosenStrategy,
                source: 'kbot',
              })
            } catch { /* collective is non-critical */ }

            // Deep learning — extract knowledge, detect corrections, update project memory
            learnFromExchange(originalMessage, content, toolSequenceLog, process.cwd())

            // Skill library — distill successful multi-tool chains into reusable skills
            if (toolSequenceWithArgs.length >= 2) {
              try {
                distillSkill(originalMessage, toolSequenceWithArgs, true)
              } catch { /* skill distillation is non-critical */ }
            }

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

            // Save embedding cache + skill library
            try { saveEmbeddingCache() } catch { /* non-critical */ }
            try { flushSkillLibrary() } catch { /* non-critical */ }

            // MAP-Elites quality-diversity archive update
            import('./quality-diversity.js').then(({ initArchive, learnFromOutcome }) => {
              try {
                initArchive()
                // Use self-eval overall score (default 0.7 if not evaluated)
                const evalScore = selfEvalScore ?? 0.7
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

            // ── Prompt Evolution (GEPA): record trace and evolve if threshold met ──
            try {
              const traceAgent = lastResponse.agent || 'kernel'
              recordTrace({
                agent: traceAgent,
                taskType: classifyTask(originalMessage),
                toolsUsed: [...toolSequenceLog],
                evalScore: selfEvalScore ?? 0.7,
                success: true,
                messageLength: content.length,
                timestamp: new Date().toISOString(),
              })

              // Check if we should evolve this agent's prompt
              if (shouldEvolve(traceAgent)) {
                const mutation = evolvePrompt(traceAgent)
                if (mutation) {
                  // Log evolution event (non-blocking, info-level)
                  process.stderr.write(`\n  \x1b[2m[prompt-evolution] ${traceAgent} evolved: ${mutation.reason}\x1b[0m\n`)
                }
              }

              // Update scoreAfter for recent mutations (needs 10+ post-mutation traces)
              updateMutationScore(traceAgent)
            } catch { /* prompt evolution is non-critical */ }

            // ── Post-execution cognitive updates (v3.6.2) ──
            try {
              // Free energy — update beliefs based on tool results
              freeEnergy.observeToolResult('response', true, 0.8)
              freeEnergy.updatePrediction(originalMessage)

              // Predictive processing — evaluate prediction accuracy
              predictive.evaluate(
                predictive.predict([originalMessage], []),
                content,
                toolSequenceLog,
              )

              // Confidence — record actual effort vs predicted
              recordActualEffort(originalMessage, toolCallCount, cumulativeCostUsd)

              // Reasoning — record strategy outcome
              recordStrategyOutcome(
                classifyTask(originalMessage),
                selectStrategy(originalMessage, '').chosenStrategy,
                toolCallCount > 0 ? 'success' : 'partial',
              )

              // Intentionality — update motivation based on outcome
              updateMotivation({ type: 'task_success' })
              if (toolCallCount > 3) updateMotivation({ type: 'hard_task' })
              if (toolSequenceLog.length > 0) updateMotivation({ type: 'meaningful_impact' })

              // Temporal — record user action sequence for future anticipation
              recordUserAction('session', originalMessage)

              // Temporal — update agent identity with session summary
              updateIdentity({
                messages: 1,
                toolCalls: toolCallCount,
                toolsUsed: toolSequenceLog.slice(0, 10),
                errors: [],
                duration: Date.now() - (telemetry as any).startTime || 0,
              })

              // Skill profile — update based on success
              const taskDomain = classifyTask(originalMessage)
              updateSkillProfile(taskDomain, true, 0.8)

              // Strange loops — analyze for self-referential patterns
              strangeLoops.recordIntent(originalMessage)
              strangeLoops.recordAction(content.slice(0, 500))
            } catch { /* cognitive updates are non-critical */ }
          } catch { /* learning failures are non-critical */ }
        })

        // ── Checkpoint & Telemetry: session completed successfully ──
        checkpointManager.markCompleted(sessionId).catch(() => {})
        telemetry.emit('session_end', {
          status: 'completed',
          toolCallCount,
          cumulativeCostUsd,
        })
        telemetry.destroy().catch(() => {})

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
        toolSequenceWithArgs.push({ name: call.name, args: call.arguments || {} })

        // ── Sandbox Policy: check tool access before execution ──
        try {
          const { checkToolAccess, checkPathAccess } = await import('./sandbox-policy.js')
          const agentId = options.agent || 'kernel'
          const toolCheck = checkToolAccess(agentId, call.name)
          if (!toolCheck.allowed) {
            ui.onWarning(`Sandbox: ${toolCheck.reason}`)
            results.push({ tool_call_id: call.id, result: `Blocked by sandbox policy: ${toolCheck.reason}`, error: true })
            continue
          }
          // Check file path access
          const filePath = (call.arguments as Record<string, unknown>)?.file_path || (call.arguments as Record<string, unknown>)?.path
          if (typeof filePath === 'string') {
            const pathCheck = checkPathAccess(agentId, filePath)
            if (!pathCheck.allowed) {
              ui.onWarning(`Sandbox: ${pathCheck.reason}`)
              results.push({ tool_call_id: call.id, result: `Blocked by sandbox policy: ${pathCheck.reason}`, error: true })
              continue
            }
          }
        } catch { /* sandbox is non-critical */ }

        ui.onToolCallStart(call.name, call.arguments || {})

        // Execute through the middleware pipeline
        const ctx: ToolContext = {
          toolName: call.name,
          toolArgs: call.arguments || {},
          toolCallId: call.id,
          metadata: {},
          aborted: false,
        }

        await pipeline.execute(ctx)

        // Build ToolResult from pipeline context
        const result: ToolResult = {
          tool_call_id: call.id,
          result: ctx.error
            ? (ctx.aborted ? (ctx.abortReason || ctx.error) : `Tool error: ${ctx.error}`)
            : (ctx.result || ''),
          error: !!ctx.error || ctx.aborted,
          duration_ms: ctx.durationMs,
        }
        results.push(result)
        ui.onToolCallEnd(call.name, result.result, result.error ? result.result : undefined, result.duration_ms)

        // ── Observer: record tool call for cross-session learning ──
        try {
          const { recordObservation } = await import('./observer.js')
          recordObservation({
            ts: new Date().toISOString(),
            tool: call.name,
            args: {
              file_path: (call.arguments as Record<string, unknown>)?.file_path as string || (call.arguments as Record<string, unknown>)?.path as string || undefined,
              command: typeof (call.arguments as Record<string, unknown>)?.command === 'string' ? ((call.arguments as Record<string, unknown>).command as string).slice(0, 200) : undefined,
              pattern: (call.arguments as Record<string, unknown>)?.pattern as string || undefined,
            },
            result_length: result.result?.length || 0,
            session: `kbot-${sessionId}`,
            error: result.error || false,
          })
        } catch { /* observer is non-critical */ }

        // ── Autopoiesis: observe tool result for system health ──
        autopoietic.observeToolResult(call.name, !result.error, result.error ? result.result : undefined)

        // ── Structured stream: tool result event ──
        if (options.responseStream) {
          options.responseStream.emit({
            type: 'tool_result',
            id: call.id,
            name: call.name,
            result: result.result,
            error: result.error ? result.result : undefined,
          })
        }

        // ── Feed Gödel detector with tool call data ──
        loopDetector.recordToolCall(
          call.name,
          JSON.stringify(call.arguments || {}),
          result.result.slice(0, 500),
        )
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

      // ── Checkpoint: save agent state after tool execution ──
      checkpointManager.save({
        id: crypto.randomUUID(),
        sessionId,
        timestamp: Date.now(),
        iteration: i,
        messages: [...loopMessages],
        toolSequenceLog: [...toolSequenceLog],
        toolCallCount,
        cumulativeCostUsd,
        agentId: options.agent || 'kernel',
        model: lastResponse?.model || 'unknown',
        systemPrompt: systemContext,
        status: 'in_progress',
      }).then(() => {
        telemetry.emit('checkpoint_save', { iteration: i, toolCallCount })
      }).catch(() => {
        // Checkpoint save is non-blocking and non-critical
      })

    } catch (err) {
      spinnerHandle?.stop()
      // ── Telemetry: session failure ──
      telemetry.emit('session_end', { status: 'failed', error: String(err), toolCallCount })
      telemetry.destroy().catch(() => {})
      throw err
    }
  }

  // ── Checkpoint & Telemetry: session ended (loop exhausted or early break) ──
  checkpointManager.markCompleted(sessionId).catch(() => {})
  telemetry.emit('session_end', {
    status: 'completed',
    toolCallCount,
    cumulativeCostUsd,
    reason: 'loop_exhausted',
  })
  telemetry.destroy().catch(() => {})

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
      if (config?.byok_provider === 'kbot-local') {
        printError('kbot local gateway isn\'t running.')
        printInfo('Start it: kbot gateway start')
        return
      }
      printError('Can\'t reach the AI provider.')
      printInfo('Check your internet connection and try again.')
      return
    }

    // Model not found
    if (errMsg.includes('model') && (errMsg.includes('not found') || errMsg.includes('does not exist'))) {
      const currentProvider = getByokProvider()
      printError('That model isn\'t available.')
      if (isLocalProvider(currentProvider)) {
        printInfo('Download it: ollama pull <model-name>')
      } else {
        printInfo(`Check available models for ${getProvider(currentProvider).name}: kbot auth`)
      }
      return
    }

    // Rate limiting
    if (errMsg.includes('rate') || errMsg.includes('429') || errMsg.includes('too many')) {
      printError('Too many requests. Wait a moment and try again.')
      return
    }

    // Auth errors
    if (errMsg.includes('401') || errMsg.includes('403') || errMsg.includes('invalid') && errMsg.includes('key')
        || errMsg.includes('invalid x-api-key') || errMsg.includes('Incorrect API key')) {
      const currentProvider = getByokProvider()
      printError(`API key issue for ${getProvider(currentProvider).name}. Your key may be expired or invalid.`)
      printInfo('Update it: kbot auth')
      return
    }

    printError(errMsg)
    process.exit(1)
  }
}


/**
 * Resume an agent session from a checkpoint.
 * Restores conversation messages and state, then continues execution.
 */
export async function runAgentFromCheckpoint(
  checkpoint: Checkpoint,
  options: AgentOptions = {},
): Promise<AgentResponse> {
  const telemetryInstance = new TelemetryEmitter(checkpoint.sessionId)
  telemetryInstance.emit('checkpoint_resume', {
    checkpointId: checkpoint.id,
    iteration: checkpoint.iteration,
    toolCallCount: checkpoint.toolCallCount,
    cumulativeCostUsd: checkpoint.cumulativeCostUsd,
  })

  printInfo(`Resuming from checkpoint (iteration ${checkpoint.iteration}, ${checkpoint.toolCallCount} tool calls, $${checkpoint.cumulativeCostUsd.toFixed(4)})`)

  // Restore conversation history from checkpoint messages
  const { restoreHistory } = await import('./memory.js')
  const turns = checkpoint.messages.map((m: any) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))
  restoreHistory(turns)

  // Extract the original user message from the first user message in checkpoint
  const firstUserMsg = checkpoint.messages.find((m: any) => m.role === 'user')
  const message = firstUserMsg?.content || 'continue'

  // Re-run the agent with the restored context
  const response = await runAgent(message, {
    ...options,
    agent: checkpoint.agentId || options.agent,
    skipPlanner: true, // Don't re-plan, just continue execution
  })

  await telemetryInstance.destroy()
  return response
}
