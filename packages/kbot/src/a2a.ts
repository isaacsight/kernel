// kbot A2A (Agent-to-Agent) Protocol Support
//
// Implements Google's Agent2Agent protocol for agent interoperability:
// - Agent Card: JSON descriptor of kbot's capabilities
// - A2A Server: HTTP endpoints for receiving tasks from other agents
// - A2A Client: Discovery and delegation to external A2A agents
//
// Spec: https://google.github.io/A2A/
//
// Usage:
//   import { mountA2ARoutes } from './a2a.js'
//   mountA2ARoutes(server, { port: 7437 })

import { createRequire } from 'node:module'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { randomUUID } from 'node:crypto'
import type { Server, IncomingMessage, ServerResponse } from 'node:http'
import { runAgent, type AgentOptions, type AgentResponse } from './agent.js'
import { SPECIALISTS, type SpecialistDef } from './agents/specialists.js'
import { timingSafeEqual } from 'node:crypto'

// ── Package metadata ──

const __require = createRequire(import.meta.url)
const pkg = __require('../package.json') as { name: string; version: string; description: string; homepage: string }

// ── A2A Types ──

/** A2A Agent Card — advertises this agent's capabilities to other agents */
export interface AgentCard {
  name: string
  description: string
  version: string
  url: string
  provider: {
    organization: string
    url: string
  }
  capabilities: {
    streaming: boolean
    pushNotifications: boolean
    stateTransitionHistory: boolean
  }
  skills: AgentSkill[]
  defaultInputModes: string[]
  defaultOutputModes: string[]
}

/** A skill advertised by the agent */
export interface AgentSkill {
  id: string
  name: string
  description: string
  tags: string[]
  examples?: string[]
}

/** A2A Task — represents a unit of work sent between agents */
export interface A2ATask {
  id: string
  status: A2ATaskStatus
  message: A2AMessage
  result?: A2AMessage
  history?: A2AMessage[]
  metadata?: Record<string, unknown>
  createdAt: string
}

/** Task status per A2A lifecycle */
export interface A2ATaskStatus {
  state: 'submitted' | 'working' | 'input-required' | 'completed' | 'failed' | 'canceled'
  message?: string
  timestamp: string
}

/** A2A message — the content exchanged between agents */
export interface A2AMessage {
  role: 'user' | 'agent'
  parts: A2APart[]
}

/** A2A content part — text, file, or data */
export type A2APart =
  | { type: 'text'; text: string }
  | { type: 'file'; file: { name: string; mimeType: string; bytes: string } }
  | { type: 'data'; data: Record<string, unknown> }

/** Registry entry for a discovered remote agent */
export interface RemoteAgent {
  url: string
  card: AgentCard
  discoveredAt: string
  lastContactedAt?: string
}

// ── Constants ──

const KBOT_DIR = join(homedir(), '.kbot')
const REGISTRY_PATH = join(KBOT_DIR, 'a2a-registry.json')
const DEFAULT_PORT = 7437

// ── In-memory task store ──

const tasks = new Map<string, A2ATask>()
const MAX_TASKS = 1000
const TASK_TTL_MS = 60 * 60 * 1000 // 1 hour

function pruneTasks(): void {
  if (tasks.size <= MAX_TASKS) return
  const now = Date.now()
  for (const [id, task] of tasks) {
    if (now - new Date(task.createdAt).getTime() > TASK_TTL_MS) tasks.delete(id)
  }
  // If still over limit, drop oldest
  if (tasks.size > MAX_TASKS) {
    const oldest = [...tasks.keys()].slice(0, tasks.size - MAX_TASKS)
    for (const id of oldest) tasks.delete(id)
  }
}

// ── Skill mapping ──

/** Tag map for all agents — specialists, preset agents, and domain experts.
 *  Used to populate A2A skill tags for discovery by external agents. */
const AGENT_TAG_MAP: Record<string, string[]> = {
  // Core specialists
  kernel: ['general', 'assistant', 'coordination'],
  researcher: ['research', 'fact-checking', 'synthesis'],
  coder: ['programming', 'code-generation', 'debugging', 'refactoring'],
  writer: ['writing', 'documentation', 'content-creation'],
  analyst: ['analysis', 'strategy', 'evaluation'],
  // Extended specialists
  aesthete: ['design', 'ui-ux', 'css', 'accessibility'],
  guardian: ['security', 'vulnerability-scanning', 'owasp'],
  curator: ['knowledge-management', 'documentation', 'indexing'],
  strategist: ['business-strategy', 'roadmapping', 'competitive-analysis'],
  // Domain specialists
  infrastructure: ['devops', 'ci-cd', 'containers', 'cloud'],
  quant: ['data-science', 'statistics', 'quantitative-analysis'],
  investigator: ['deep-research', 'root-cause-analysis', 'forensics'],
  oracle: ['predictions', 'trend-analysis', 'forecasting'],
  chronist: ['history', 'timelines', 'changelog'],
  sage: ['philosophy', 'wisdom', 'mental-models'],
  communicator: ['communication', 'messaging', 'presentations'],
  adapter: ['translation', 'format-conversion', 'migration'],
  producer: ['music-production', 'ableton', 'daw', 'audio', 'midi'],
  scientist: ['science', 'biology', 'chemistry', 'physics', 'earth-science', 'mathematics'],
  immune: ['self-audit', 'bug-finding', 'security-hardening', 'code-quality'],
  neuroscientist: ['neuroscience', 'brain', 'eeg', 'cognitive-science', 'neuroimaging'],
  social_scientist: ['social-science', 'psychometrics', 'game-theory', 'econometrics', 'survey-design'],
  philosopher: ['philosophy', 'logic', 'ethics', 'argumentation'],
  epidemiologist: ['epidemiology', 'public-health', 'disease-modeling', 'surveillance'],
  linguist: ['linguistics', 'phonetics', 'typology', 'corpus-analysis', 'nlp'],
  historian: ['history', 'archival-research', 'digital-humanities', 'timelines'],
  // Preset agents
  hacker: ['offensive-security', 'penetration-testing', 'ctf', 'red-team'],
  operator: ['automation', 'orchestration', 'task-execution', 'planning'],
  dreamer: ['creative', 'worldbuilding', 'imagination', 'dream-interpretation'],
  creative: ['generative-art', 'creative-coding', 'shaders', 'music', 'procedural-generation'],
  developer: ['kbot', 'self-improvement', 'typescript', 'tooling'],
  replit: ['replit', 'deployment', 'ai-integration', 'rapid-prototyping'],
  gamedev: ['game-development', 'game-design', 'godot', 'unity', 'game-feel'],
  playtester: ['game-testing', 'qa', 'game-feel', 'ux-testing', 'difficulty-analysis'],
  trader: ['trading', 'markets', 'technical-analysis', 'portfolio', 'defi'],
}

/** Map specialist definitions to A2A skills */
function specialistToSkill(id: string, def: SpecialistDef): AgentSkill {
  return {
    id,
    name: def.name,
    description: def.prompt.split('\n')[0].replace(/^You are (?:an? )?/, ''),
    tags: AGENT_TAG_MAP[id] || [id],
  }
}

/** Skill descriptions for preset agents not in SPECIALISTS.
 *  These come from matrix.ts BUILTIN_AGENTS and PRESETS. */
const PRESET_AGENT_SKILLS: AgentSkill[] = [
  {
    id: 'hacker',
    name: 'Hacker',
    description: 'Offensive security specialist and CTF solver — red team analysis, exploit chains, and remediation',
    tags: AGENT_TAG_MAP['hacker'],
    examples: ['Find auth bypass in this API', 'Solve this CTF challenge', 'Red team our deployment'],
  },
  {
    id: 'operator',
    name: 'Operator',
    description: 'Autonomous executor — plans, decomposes, executes, verifies, and reports multi-step tasks',
    tags: AGENT_TAG_MAP['operator'],
    examples: ['Refactor this module and update all tests', 'Set up CI/CD for this repo'],
  },
  {
    id: 'dreamer',
    name: 'Dreamer',
    description: 'Liminal space explorer — dream interpretation, worldbuilding, and vision engineering',
    tags: AGENT_TAG_MAP['dreamer'],
    examples: ['Interpret this dream', 'Build a world with these constraints'],
  },
  {
    id: 'creative',
    name: 'Creative',
    description: 'Generative art, creative coding, shaders, procedural generation, and computational aesthetics',
    tags: AGENT_TAG_MAP['creative'],
    examples: ['Generate a p5.js particle system', 'Write a GLSL shader for this effect'],
  },
  {
    id: 'developer',
    name: 'Developer',
    description: 'kbot self-improvement specialist — builds, extends, and optimizes kbot itself',
    tags: AGENT_TAG_MAP['developer'],
    examples: ['Add a new tool to kbot', 'Optimize the agent routing system'],
  },
  {
    id: 'replit',
    name: 'Replit',
    description: 'Replit specialist — builds, integrates, and deploys AI-powered systems on Replit',
    tags: AGENT_TAG_MAP['replit'],
    examples: ['Deploy this app on Replit', 'Set up Replit AI integration'],
  },
  {
    id: 'gamedev',
    name: 'Game Developer',
    description: 'Game development specialist — game design, Godot/Unity, game feel, systems design, and rapid prototyping',
    tags: AGENT_TAG_MAP['gamedev'],
    examples: ['Design a combat system', 'Build a Godot platformer prototype'],
  },
  {
    id: 'playtester',
    name: 'Playtester',
    description: 'Game QA and playtesting specialist — difficulty analysis, UX evaluation, game feel critique',
    tags: AGENT_TAG_MAP['playtester'],
    examples: ['Evaluate this game design', 'Test the difficulty curve'],
  },
  {
    id: 'trader',
    name: 'Trader',
    description: 'Trading and market analysis specialist — technical analysis, portfolio management, DeFi, and quantitative strategies',
    tags: AGENT_TAG_MAP['trader'],
    examples: ['Analyze this stock chart', 'Build a portfolio rebalancing strategy'],
  },
]

// ── Agent Card ──

/** Build the Agent Card for this kbot instance.
 *
 *  Exposes all 35 kbot agents as A2A skills — 26 specialists from
 *  the SPECIALISTS registry plus 9 preset agents from the matrix system.
 *  Each skill includes tags for capability-based discovery and optional
 *  example prompts.
 */
export function buildAgentCard(endpointUrl?: string): AgentCard {
  const url = endpointUrl || `http://localhost:${DEFAULT_PORT}`

  // Deduplicate: PRESET_AGENT_SKILLS may overlap with SPECIALISTS keys
  const specialistIds = new Set(Object.keys(SPECIALISTS))
  const deduplicatedPresets = PRESET_AGENT_SKILLS.filter(s => !specialistIds.has(s.id))

  const skills: AgentSkill[] = [
    ...Object.entries(SPECIALISTS).map(([id, def]) => specialistToSkill(id, def)),
    ...deduplicatedPresets,
  ]

  return {
    name: 'kbot',
    description: pkg.description,
    version: pkg.version,
    url,
    provider: {
      organization: 'kernel.chat group',
      url: pkg.homepage,
    },
    capabilities: {
      streaming: true,
      pushNotifications: false,
      stateTransitionHistory: true,
    },
    skills,
    defaultInputModes: ['text/plain', 'application/json'],
    defaultOutputModes: ['text/plain', 'application/json'],
  }
}

// ── Task execution ──

/** Create a new A2A task from an incoming message */
function createTask(message: A2AMessage, metadata?: Record<string, unknown>): A2ATask {
  const now = new Date().toISOString()
  const task: A2ATask = {
    id: randomUUID(),
    status: {
      state: 'submitted',
      timestamp: now,
    },
    message,
    history: [],
    metadata,
    createdAt: now,
  }
  pruneTasks()
  tasks.set(task.id, task)
  return task
}

/** Extract plain text from an A2A message */
function extractText(message: A2AMessage): string {
  return message.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map(p => p.text)
    .join('\n')
}

/** Execute a task through kbot's agent system */
async function executeTask(task: A2ATask): Promise<A2ATask> {
  // Transition to working
  task.status = { state: 'working', timestamp: new Date().toISOString() }
  task.history?.push({ ...task.message })

  const userText = extractText(task.message)
  if (!userText) {
    task.status = { state: 'failed', message: 'No text content in message', timestamp: new Date().toISOString() }
    return task
  }

  // Determine agent from metadata hint or let router decide
  const agentOptions: AgentOptions = {}
  if (task.metadata?.agent && typeof task.metadata.agent === 'string') {
    agentOptions.agent = task.metadata.agent
  }

  try {
    const response: AgentResponse = await runAgent(userText, agentOptions)

    task.result = {
      role: 'agent',
      parts: [{ type: 'text', text: response.content }],
    }
    task.status = { state: 'completed', timestamp: new Date().toISOString() }

    // Include agent metadata in task
    task.metadata = {
      ...task.metadata,
      agentUsed: response.agent,
      model: response.model,
      toolCalls: response.toolCalls,
      usage: response.usage,
    }
  } catch (err) {
    task.status = {
      state: 'failed',
      message: err instanceof Error ? err.message : 'Task execution failed',
      timestamp: new Date().toISOString(),
    }
  }

  return task
}

// ── A2A Server ──

/** HTTP helpers */
function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

const MAX_BODY_SIZE = 1024 * 1024 // 1 MB

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (c: Buffer) => {
      size += c.length
      if (size > MAX_BODY_SIZE) {
        req.destroy()
        reject(new Error('Request body too large'))
        return
      }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
    req.on('error', reject)
  })
}

export interface A2ARouteOptions {
  /** Port the server is running on (for Agent Card URL) */
  port?: number
  /** Full endpoint URL override (e.g. https://my-kbot.example.com) */
  endpointUrl?: string
  /** Bearer token for authentication (optional) */
  token?: string
}

// ── Server status tracking ──

/** Tracks A2A server runtime state for the a2a_status tool */
interface A2AServerState {
  running: boolean
  startedAt: string | null
  endpointUrl: string | null
  tasksReceived: number
  tasksCompleted: number
  tasksFailed: number
  activeConnections: Set<string>
}

const serverState: A2AServerState = {
  running: false,
  startedAt: null,
  endpointUrl: null,
  tasksReceived: 0,
  tasksCompleted: 0,
  tasksFailed: 0,
  activeConnections: new Set(),
}

/** Record an incoming connection (caller agent URL or IP) */
function trackConnection(req: IncomingMessage): void {
  const forwarded = req.headers['x-forwarded-for']
  const ip = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket.remoteAddress || 'unknown'
  const userAgent = req.headers['user-agent'] || 'unknown'
  serverState.activeConnections.add(`${ip} (${userAgent})`)
}

/** Get a snapshot of the A2A server status for the a2a_status tool */
export function getA2AStatus(): {
  server: {
    running: boolean
    startedAt: string | null
    endpointUrl: string | null
    uptime: string | null
  }
  tasks: {
    received: number
    completed: number
    failed: number
    active: number
    stored: number
  }
  capabilities: {
    totalSkills: number
    skills: Array<{ id: string; name: string; tags: string[] }>
  }
  connections: {
    uniqueClients: number
    clients: string[]
  }
  registry: {
    remoteAgents: number
    agents: Array<{ url: string; name: string; skills: number; lastContact: string | null }>
  }
} {
  const card = buildAgentCard(serverState.endpointUrl || undefined)
  const registry = loadRegistry()
  const activeTasks = [...tasks.values()].filter(t => t.status.state === 'working' || t.status.state === 'submitted')

  let uptime: string | null = null
  if (serverState.startedAt) {
    const ms = Date.now() - new Date(serverState.startedAt).getTime()
    const hours = Math.floor(ms / 3_600_000)
    const minutes = Math.floor((ms % 3_600_000) / 60_000)
    const seconds = Math.floor((ms % 60_000) / 1_000)
    uptime = `${hours}h ${minutes}m ${seconds}s`
  }

  return {
    server: {
      running: serverState.running,
      startedAt: serverState.startedAt,
      endpointUrl: serverState.endpointUrl,
      uptime,
    },
    tasks: {
      received: serverState.tasksReceived,
      completed: serverState.tasksCompleted,
      failed: serverState.tasksFailed,
      active: activeTasks.length,
      stored: tasks.size,
    },
    capabilities: {
      totalSkills: card.skills.length,
      skills: card.skills.map(s => ({ id: s.id, name: s.name, tags: s.tags })),
    },
    connections: {
      uniqueClients: serverState.activeConnections.size,
      clients: [...serverState.activeConnections],
    },
    registry: {
      remoteAgents: Object.keys(registry).length,
      agents: Object.values(registry).map(r => ({
        url: r.url,
        name: r.card.name,
        skills: r.card.skills.length,
        lastContact: r.lastContactedAt || null,
      })),
    },
  }
}

// ── JSON-RPC types for A2A protocol compliance ──

interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: string | number
  method: string
  params?: Record<string, unknown>
}

interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: string | number | null
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}

/** JSON-RPC error codes per the spec */
const JSONRPC_PARSE_ERROR = -32700
const JSONRPC_INVALID_REQUEST = -32600
const JSONRPC_METHOD_NOT_FOUND = -32601
const JSONRPC_INVALID_PARAMS = -32602
const JSONRPC_INTERNAL_ERROR = -32603
const JSONRPC_TASK_NOT_FOUND = -32001
const JSONRPC_TASK_NOT_CANCELABLE = -32002

function jsonRpcSuccess(id: string | number | null, result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, result }
}

function jsonRpcError(id: string | number | null, code: number, message: string, data?: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message, ...(data !== undefined ? { data } : {}) } }
}

/**
 * Handle a JSON-RPC request per the A2A protocol spec.
 *
 * Supported methods:
 *   - tasks/send       — submit a task (sync execution)
 *   - tasks/get        — get task status and result
 *   - tasks/cancel     — cancel a running task
 *   - tasks/sendSubscribe — submit a task (async, returns immediately)
 */
async function handleJsonRpc(rpcReq: JsonRpcRequest): Promise<JsonRpcResponse> {
  const { id, method, params } = rpcReq

  switch (method) {
    case 'tasks/send': {
      const message = params?.message as A2AMessage | undefined
      if (!message?.parts || !message?.role) {
        return jsonRpcError(id, JSONRPC_INVALID_PARAMS, 'Invalid params: expected { message: { role, parts } }')
      }
      const metadata = params?.metadata as Record<string, unknown> | undefined
      const task = createTask(message, metadata)
      serverState.tasksReceived++
      const completed = await executeTask(task)
      if (completed.status.state === 'completed') serverState.tasksCompleted++
      if (completed.status.state === 'failed') serverState.tasksFailed++
      return jsonRpcSuccess(id, taskToResponse(completed))
    }

    case 'tasks/sendSubscribe': {
      const message = params?.message as A2AMessage | undefined
      if (!message?.parts || !message?.role) {
        return jsonRpcError(id, JSONRPC_INVALID_PARAMS, 'Invalid params: expected { message: { role, parts } }')
      }
      const metadata = params?.metadata as Record<string, unknown> | undefined
      const task = createTask(message, metadata)
      serverState.tasksReceived++
      // Async: return immediately, execute in background
      executeTask(task).then(() => {
        if (task.status.state === 'completed') serverState.tasksCompleted++
        if (task.status.state === 'failed') serverState.tasksFailed++
      }).catch(() => {
        task.status = { state: 'failed', message: 'Background execution failed', timestamp: new Date().toISOString() }
        serverState.tasksFailed++
      })
      return jsonRpcSuccess(id, taskToResponse(task))
    }

    case 'tasks/get': {
      const taskId = params?.id as string | undefined
      if (!taskId) {
        return jsonRpcError(id, JSONRPC_INVALID_PARAMS, 'Invalid params: expected { id: string }')
      }
      const task = tasks.get(taskId)
      if (!task) {
        return jsonRpcError(id, JSONRPC_TASK_NOT_FOUND, `Task ${taskId} not found`)
      }
      return jsonRpcSuccess(id, taskToResponse(task))
    }

    case 'tasks/cancel': {
      const taskId = params?.id as string | undefined
      if (!taskId) {
        return jsonRpcError(id, JSONRPC_INVALID_PARAMS, 'Invalid params: expected { id: string }')
      }
      const task = tasks.get(taskId)
      if (!task) {
        return jsonRpcError(id, JSONRPC_TASK_NOT_FOUND, `Task ${taskId} not found`)
      }
      if (task.status.state === 'completed' || task.status.state === 'failed') {
        return jsonRpcError(id, JSONRPC_TASK_NOT_CANCELABLE, `Cannot cancel task in '${task.status.state}' state`)
      }
      task.status = { state: 'canceled', timestamp: new Date().toISOString() }
      return jsonRpcSuccess(id, taskToResponse(task))
    }

    default:
      return jsonRpcError(id, JSONRPC_METHOD_NOT_FOUND, `Unknown method: ${method}`)
  }
}

/**
 * Create the A2A request handler.
 *
 * Supports two interfaces:
 *   1. **JSON-RPC** (A2A spec) — POST to `/a2a` with JSON-RPC envelope
 *   2. **REST** (backward-compatible) — GET/POST to `/a2a/tasks`, `/a2a/tasks/:id`, etc.
 *
 * Agent Card discovery is always at `GET /.well-known/agent.json`.
 */
export function createA2AHandler(options: A2ARouteOptions = {}): (req: IncomingMessage, res: ServerResponse) => Promise<boolean> {
  const baseUrl = options.endpointUrl || `http://localhost:${options.port || DEFAULT_PORT}`
  const card = buildAgentCard(baseUrl)

  // Mark server as running
  serverState.running = true
  serverState.startedAt = new Date().toISOString()
  serverState.endpointUrl = baseUrl

  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const url = new URL(req.url || '/', `http://localhost`)
    const path = url.pathname

    // CORS preflight for A2A routes
    if (req.method === 'OPTIONS' && (path === '/.well-known/agent.json' || path.startsWith('/a2a'))) {
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
      res.writeHead(204)
      res.end()
      return true
    }

    // Auth check for task endpoints
    if (options.token && path.startsWith('/a2a')) {
      const auth = req.headers.authorization
      const bearerToken = auth?.startsWith('Bearer ') ? auth.slice(7) : null
      const tokenBuf = Buffer.from(options.token)
      const bearerBuf = Buffer.from(bearerToken || '')
      if (tokenBuf.length !== bearerBuf.length || !timingSafeEqual(tokenBuf, bearerBuf)) {
        sendJson(res, 401, { error: 'Unauthorized' })
        return true
      }
    }

    // GET /.well-known/agent.json — Agent Card discovery
    if (path === '/.well-known/agent.json' && req.method === 'GET') {
      trackConnection(req)
      sendJson(res, 200, card)
      return true
    }

    // POST /a2a — JSON-RPC endpoint (A2A protocol spec)
    if (path === '/a2a' && req.method === 'POST') {
      trackConnection(req)
      try {
        const rawBody = await readBody(req)
        const parsed = JSON.parse(rawBody) as unknown

        // Validate JSON-RPC envelope
        if (
          typeof parsed !== 'object' || parsed === null ||
          (parsed as Record<string, unknown>).jsonrpc !== '2.0' ||
          typeof (parsed as Record<string, unknown>).method !== 'string'
        ) {
          sendJson(res, 200, jsonRpcError(
            (parsed as Record<string, unknown>)?.id as string | number | null ?? null,
            JSONRPC_INVALID_REQUEST,
            'Invalid JSON-RPC request: expected { jsonrpc: "2.0", method: string, id: string|number }',
          ))
          return true
        }

        const rpcReq = parsed as JsonRpcRequest
        const rpcRes = await handleJsonRpc(rpcReq)
        sendJson(res, 200, rpcRes)
      } catch (err) {
        sendJson(res, 200, jsonRpcError(null, JSONRPC_PARSE_ERROR, 'Parse error: ' + (err instanceof Error ? err.message : 'invalid JSON')))
      }
      return true
    }

    // POST /a2a/tasks — Submit a new task (REST, backward-compatible)
    if (path === '/a2a/tasks' && req.method === 'POST') {
      trackConnection(req)
      try {
        const body = JSON.parse(await readBody(req)) as {
          message?: A2AMessage
          metadata?: Record<string, unknown>
        }

        if (!body.message || !body.message.parts || !body.message.role) {
          sendJson(res, 400, { error: 'Invalid message format. Expected { message: { role, parts } }' })
          return true
        }

        const task = createTask(body.message, body.metadata)
        serverState.tasksReceived++

        // Check if caller wants synchronous execution
        const sync = url.searchParams.get('sync') === 'true'

        if (sync) {
          // Synchronous: execute and return completed task
          const completed = await executeTask(task)
          if (completed.status.state === 'completed') serverState.tasksCompleted++
          if (completed.status.state === 'failed') serverState.tasksFailed++
          sendJson(res, 200, taskToResponse(completed))
        } else {
          // Asynchronous: return immediately with submitted status, execute in background
          sendJson(res, 202, taskToResponse(task))
          // Fire and forget — task will be updated in the store
          executeTask(task).then(() => {
            if (task.status.state === 'completed') serverState.tasksCompleted++
            if (task.status.state === 'failed') serverState.tasksFailed++
          }).catch(() => {
            task.status = { state: 'failed', message: 'Background execution failed', timestamp: new Date().toISOString() }
            serverState.tasksFailed++
          })
        }
      } catch (err) {
        sendJson(res, 400, { error: err instanceof Error ? err.message : 'Invalid request body' })
      }
      return true
    }

    // GET /a2a/tasks/:id — Get task status and result (REST)
    const taskStatusMatch = path.match(/^\/a2a\/tasks\/([a-f0-9-]+)$/)
    if (taskStatusMatch && req.method === 'GET') {
      const taskId = taskStatusMatch[1]
      const task = tasks.get(taskId)
      if (!task) {
        sendJson(res, 404, { error: 'Task not found' })
        return true
      }
      sendJson(res, 200, taskToResponse(task))
      return true
    }

    // POST /a2a/tasks/:id/cancel — Cancel a task (REST)
    const taskCancelMatch = path.match(/^\/a2a\/tasks\/([a-f0-9-]+)\/cancel$/)
    if (taskCancelMatch && req.method === 'POST') {
      const taskId = taskCancelMatch[1]
      const task = tasks.get(taskId)
      if (!task) {
        sendJson(res, 404, { error: 'Task not found' })
        return true
      }
      if (task.status.state === 'completed' || task.status.state === 'failed') {
        sendJson(res, 409, { error: `Cannot cancel task in '${task.status.state}' state` })
        return true
      }
      task.status = { state: 'canceled', timestamp: new Date().toISOString() }
      sendJson(res, 200, taskToResponse(task))
      return true
    }

    // Not an A2A route
    return false
  }
}

/** Serialize a task for the A2A response format */
function taskToResponse(task: A2ATask): Record<string, unknown> {
  return {
    id: task.id,
    status: task.status,
    result: task.result || null,
    history: task.history || [],
    metadata: task.metadata || {},
  }
}

/**
 * Mount A2A routes onto an existing Node.js HTTP Server.
 *
 * Wraps the server's existing request listeners so A2A endpoints are
 * checked first. Non-A2A requests fall through to the original handler.
 */
export function mountA2ARoutes(server: Server, options: A2ARouteOptions = {}): void {
  const a2aHandler = createA2AHandler(options)

  // Capture existing listeners
  const existingListeners = server.listeners('request') as Array<
    (req: IncomingMessage, res: ServerResponse) => void
  >
  server.removeAllListeners('request')

  // Install composite handler: A2A first, then original
  server.on('request', async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const handled = await a2aHandler(req, res)
      if (handled) return
    } catch (err) {
      sendJson(res, 500, { error: err instanceof Error ? err.message : 'A2A internal error' })
      return
    }

    // Fall through to original handlers
    for (const listener of existingListeners) {
      listener(req, res)
    }
  })
}

// ── A2A Client ──

/** Load the agent registry from disk */
function loadRegistry(): Record<string, RemoteAgent> {
  try {
    if (!existsSync(REGISTRY_PATH)) return {}
    const raw = readFileSync(REGISTRY_PATH, 'utf-8')
    return JSON.parse(raw) as Record<string, RemoteAgent>
  } catch {
    return {}
  }
}

/** Save the agent registry to disk */
function saveRegistry(registry: Record<string, RemoteAgent>): void {
  if (!existsSync(KBOT_DIR)) mkdirSync(KBOT_DIR, { recursive: true })
  writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2))
}

/**
 * Discover a remote A2A agent by fetching its Agent Card.
 *
 * @param url - Base URL of the remote agent (e.g. "http://other-agent:8080")
 * @returns The agent's card, or null if discovery fails
 */
export async function discoverAgent(url: string): Promise<AgentCard | null> {
  const cardUrl = url.replace(/\/$/, '') + '/.well-known/agent.json'

  try {
    const response = await fetch(cardUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10_000),
    })

    if (!response.ok) {
      return null
    }

    const card = await response.json() as AgentCard

    // Validate minimum required fields
    if (!card.name || !card.url || !card.skills) {
      return null
    }

    // Register in local registry
    const registry = loadRegistry()
    registry[url] = {
      url,
      card,
      discoveredAt: new Date().toISOString(),
    }
    saveRegistry(registry)

    return card
  } catch {
    return null
  }
}

/**
 * Send a task to a remote A2A agent and wait for the result.
 *
 * @param agentUrl - Base URL of the remote agent
 * @param task - The task text to send
 * @param options - Optional agent hint and metadata
 * @returns The agent's text response, or null if the task failed
 */
export async function delegateTask(
  agentUrl: string,
  task: string,
  options?: { agent?: string; metadata?: Record<string, unknown> },
): Promise<{ text: string; metadata: Record<string, unknown> } | null> {
  const taskUrl = agentUrl.replace(/\/$/, '') + '/a2a/tasks?sync=true'

  try {
    const body: Record<string, unknown> = {
      message: {
        role: 'user' as const,
        parts: [{ type: 'text', text: task }],
      },
    }

    if (options?.agent || options?.metadata) {
      body.metadata = { ...options?.metadata, agent: options?.agent }
    }

    const response = await fetch(taskUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000), // 2 minute timeout for task execution
    })

    if (!response.ok) {
      return null
    }

    const result = await response.json() as {
      id: string
      status: A2ATaskStatus
      result: A2AMessage | null
      metadata: Record<string, unknown>
    }

    if (result.status.state !== 'completed' || !result.result) {
      return null
    }

    const text = result.result.parts
      .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map(p => p.text)
      .join('\n')

    // Update last contact time in registry
    const registry = loadRegistry()
    if (registry[agentUrl]) {
      registry[agentUrl].lastContactedAt = new Date().toISOString()
      saveRegistry(registry)
    }

    return { text, metadata: result.metadata || {} }
  } catch {
    return null
  }
}

/**
 * List all discovered remote agents from the local registry.
 */
export function listRemoteAgents(): RemoteAgent[] {
  const registry = loadRegistry()
  return Object.values(registry)
}

/**
 * Remove a remote agent from the local registry.
 */
export function removeRemoteAgent(url: string): boolean {
  const registry = loadRegistry()
  if (!registry[url]) return false
  delete registry[url]
  saveRegistry(registry)
  return true
}

/**
 * Find a remote agent that has a skill matching the given tags.
 */
export function findAgentBySkill(tags: string[]): RemoteAgent | null {
  const registry = loadRegistry()
  const tagSet = new Set(tags.map(t => t.toLowerCase()))

  for (const agent of Object.values(registry)) {
    for (const skill of agent.card.skills) {
      if (skill.tags.some(t => tagSet.has(t.toLowerCase()))) {
        return agent
      }
    }
  }

  return null
}
