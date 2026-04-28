/**
 * Anthropic Managed Agents client (April 2026 launch).
 *
 * Hosted long-horizon agent platform. This module is a STANDALONE backend
 * that workspace agents can route through when ANTHROPIC_API_KEY is set.
 * Wiring into ./workspace-agents.ts happens in a follow-up pass.
 *
 * Beta header: `anthropic-beta: managed-agents-2026-04-01` is sent on every
 * request.
 *
 * SPEC: best-effort, refine when official docs published.
 * Endpoint shape mirrors the public beta announcement; refine when the
 * official OpenAPI spec lands.
 */

const DEFAULT_BASE_URL = 'https://api.anthropic.com/v1'
const BETA_HEADER_VALUE = 'managed-agents-2026-04-01'
const ANTHROPIC_VERSION = '2023-06-01'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateSessionInput {
  mission: string
  allowedTools?: string[]
  model?: string
}

export interface CreateSessionOutput {
  session_id: string
  [key: string]: unknown
}

export interface SendTurnInput {
  sessionId: string
  input: string
}

export interface SendTurnOutput {
  output: string
  tool_calls?: unknown[]
  [key: string]: unknown
}

export interface SessionState {
  session_id: string
  mission?: string
  status?: string
  [key: string]: unknown
}

export interface ListSessionsOutput {
  sessions: SessionState[]
  [key: string]: unknown
}

export interface MemoryReadInput {
  sessionId: string
  key?: string
}

export interface MemoryWriteInput {
  sessionId: string
  key: string
  value: unknown
}

export interface MemoryAck {
  ok: boolean
  [key: string]: unknown
}

export class AnthropicManagedAgentsError extends Error {
  readonly status: number
  readonly body: string
  constructor(message: string, status: number, body: string) {
    super(message)
    this.name = 'AnthropicManagedAgentsError'
    this.status = status
    this.body = body
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Client
// ─────────────────────────────────────────────────────────────────────────────

export interface AnthropicManagedAgentsClientOptions {
  /** Override the API key (default: process.env.ANTHROPIC_API_KEY). */
  apiKey?: string
  /** Override the base URL (default: https://api.anthropic.com/v1). */
  baseUrl?: string
  /** Override fetch (used by tests). */
  fetchImpl?: typeof fetch
}

export class AnthropicManagedAgentsClient {
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly fetchImpl: typeof fetch

  constructor(opts: AnthropicManagedAgentsClientOptions = {}) {
    const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error(
        'AnthropicManagedAgentsClient: ANTHROPIC_API_KEY is not set',
      )
    }
    this.apiKey = apiKey
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '')
    this.fetchImpl = opts.fetchImpl ?? fetch
  }

  // ── Sessions ────────────────────────────────────────────────────────────

  async createSession(
    input: CreateSessionInput,
  ): Promise<CreateSessionOutput> {
    if (!input.mission || !input.mission.trim()) {
      throw new Error('createSession: mission is required')
    }
    const body: Record<string, unknown> = { mission: input.mission }
    if (input.model) body.model = input.model
    if (input.allowedTools) body.tools = input.allowedTools
    return this.request<CreateSessionOutput>('POST', '/agents/sessions', body)
  }

  async sendTurn(input: SendTurnInput): Promise<SendTurnOutput> {
    if (!input.sessionId) throw new Error('sendTurn: sessionId is required')
    return this.request<SendTurnOutput>(
      'POST',
      `/agents/sessions/${encodeURIComponent(input.sessionId)}/turns`,
      { input: input.input },
    )
  }

  async getSession(input: { sessionId: string }): Promise<SessionState> {
    if (!input.sessionId) throw new Error('getSession: sessionId is required')
    return this.request<SessionState>(
      'GET',
      `/agents/sessions/${encodeURIComponent(input.sessionId)}`,
    )
  }

  async listSessions(): Promise<ListSessionsOutput> {
    return this.request<ListSessionsOutput>('GET', '/agents/sessions')
  }

  async closeSession(input: {
    sessionId: string
  }): Promise<{ ok: boolean; [key: string]: unknown }> {
    if (!input.sessionId) {
      throw new Error('closeSession: sessionId is required')
    }
    return this.request<{ ok: boolean; [key: string]: unknown }>(
      'DELETE',
      `/agents/sessions/${encodeURIComponent(input.sessionId)}`,
    )
  }

  // ── Memory ──────────────────────────────────────────────────────────────

  async memoryRead(input: MemoryReadInput): Promise<unknown> {
    if (!input.sessionId) throw new Error('memoryRead: sessionId is required')
    const path = input.key
      ? `/agents/sessions/${encodeURIComponent(input.sessionId)}/memory/${encodeURIComponent(input.key)}`
      : `/agents/sessions/${encodeURIComponent(input.sessionId)}/memory`
    return this.request<unknown>('GET', path)
  }

  async memoryWrite(input: MemoryWriteInput): Promise<MemoryAck> {
    if (!input.sessionId) throw new Error('memoryWrite: sessionId is required')
    if (!input.key) throw new Error('memoryWrite: key is required')
    return this.request<MemoryAck>(
      'POST',
      `/agents/sessions/${encodeURIComponent(input.sessionId)}/memory`,
      { key: input.key, value: input.value },
    )
  }

  // ── Internals ───────────────────────────────────────────────────────────

  private async request<T>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const headers: Record<string, string> = {
      'x-api-key': this.apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'anthropic-beta': BETA_HEADER_VALUE,
    }
    const init: RequestInit = { method, headers }
    if (body !== undefined && method !== 'GET') {
      headers['content-type'] = 'application/json'
      init.body = JSON.stringify(body)
    }

    let res: Response
    try {
      res = await this.fetchImpl(url, init)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new AnthropicManagedAgentsError(
        `network error contacting ${url}: ${msg}`,
        0,
        '',
      )
    }

    const text = await res.text()
    if (!res.ok) {
      throw new AnthropicManagedAgentsError(
        `Anthropic Managed Agents ${method} ${path} failed: ${res.status} ${res.statusText}`,
        res.status,
        text,
      )
    }
    if (!text) return {} as T
    try {
      return JSON.parse(text) as T
    } catch {
      throw new AnthropicManagedAgentsError(
        `Anthropic Managed Agents ${method} ${path} returned non-JSON body`,
        res.status,
        text,
      )
    }
  }
}
