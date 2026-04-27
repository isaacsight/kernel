// Claude Managed Agents adapter — opt-in cloud-hosted agent runtime.
//
// When the user passes `--managed`, kbot offloads the agent loop to Anthropic's
// hosted Managed Agents runtime instead of running tools locally. The hosted
// runtime owns the sandbox, tool execution, and checkpointing; kbot just
// streams events to the terminal.
//
// Trade-off: this is the opposite of kbot's local-first ethos — it requires an
// Anthropic API key, a network round-trip per turn, and is billed per agent
// runtime hour ($0.08/hr + model usage). It exists for users who want
// long-horizon, durable agents without managing their own infra.
//
// Beta header: managed-agents-2026-04-01
// Docs: https://platform.claude.com/docs/en/managed-agents/overview

import chalk from 'chalk'

const API_BASE = 'https://api.anthropic.com'
const BETA_HEADER = 'managed-agents-2026-04-01'

export interface ManagedSessionOptions {
  apiKey: string
  prompt: string
  /** Anthropic model. Defaults to claude-opus-4-7 (the agent_toolset_20260401 baseline). */
  model?: string
  /** System prompt for the agent. */
  system?: string
  /** Reuse an existing agent_id instead of creating a fresh one. */
  agentId?: string
  /** Reuse an existing environment_id instead of creating a fresh one. */
  environmentId?: string
  /** Display title for the session (visible in the Claude console). */
  title?: string
  /** Stream tokens to stdout as they arrive (default: true). */
  stream?: boolean
}

export interface ManagedSessionResult {
  sessionId: string
  agentId: string
  environmentId: string
  finalText: string
  toolCalls: number
}

interface AgentResponse { id: string; version: number }
interface EnvironmentResponse { id: string }
interface SessionResponse { id: string }

function authHeaders(apiKey: string): Record<string, string> {
  return {
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    'anthropic-beta': BETA_HEADER,
    'content-type': 'application/json',
  }
}

async function postJson<T>(url: string, apiKey: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(apiKey),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Managed Agents API ${res.status}: ${text || res.statusText}`)
  }
  return res.json() as Promise<T>
}

async function createAgent(apiKey: string, model: string, system: string): Promise<AgentResponse> {
  return postJson<AgentResponse>(`${API_BASE}/v1/agents`, apiKey, {
    name: 'kbot-managed',
    model,
    system,
    tools: [{ type: 'agent_toolset_20260401' }],
  })
}

async function createEnvironment(apiKey: string): Promise<EnvironmentResponse> {
  return postJson<EnvironmentResponse>(`${API_BASE}/v1/environments`, apiKey, {
    name: 'kbot-managed-env',
    config: { type: 'cloud', networking: { type: 'unrestricted' } },
  })
}

async function createSession(apiKey: string, agentId: string, environmentId: string, title: string): Promise<SessionResponse> {
  return postJson<SessionResponse>(`${API_BASE}/v1/sessions`, apiKey, {
    agent: agentId,
    environment_id: environmentId,
    title,
  })
}

async function sendUserMessage(apiKey: string, sessionId: string, text: string): Promise<void> {
  const res = await fetch(`${API_BASE}/v1/sessions/${sessionId}/events`, {
    method: 'POST',
    headers: authHeaders(apiKey),
    body: JSON.stringify({
      events: [{ type: 'user.message', content: [{ type: 'text', text }] }],
    }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Failed to send user.message: ${res.status} ${body || res.statusText}`)
  }
}

interface StreamCallbacks {
  onText?: (chunk: string) => void
  onToolUse?: (name: string) => void
  onIdle?: () => void
}

/** Open the SSE stream for a session and dispatch events. Returns when the
 *  agent emits session.status_idle (or the connection ends). */
async function streamEvents(apiKey: string, sessionId: string, cb: StreamCallbacks): Promise<{ finalText: string; toolCalls: number }> {
  const res = await fetch(`${API_BASE}/v1/sessions/${sessionId}/stream`, {
    method: 'GET',
    headers: { ...authHeaders(apiKey), Accept: 'text/event-stream' },
    // No timeout — long-horizon agents may run for minutes/hours.
  })
  if (!res.ok || !res.body) {
    throw new Error(`Failed to open session stream: ${res.status} ${res.statusText}`)
  }

  const decoder = new TextDecoder()
  const reader = res.body.getReader()
  let buffer = ''
  let finalText = ''
  let toolCalls = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      // SSE frames are separated by blank lines.
      const frames = buffer.split('\n\n')
      buffer = frames.pop() || ''

      for (const frame of frames) {
        const dataLine = frame.split('\n').find(l => l.startsWith('data:'))
        if (!dataLine) continue
        const json = dataLine.slice(5).trim()
        if (!json || json === '[DONE]') continue

        let event: Record<string, unknown>
        try { event = JSON.parse(json) }
        catch { continue }

        switch (event.type) {
          case 'agent.message': {
            const blocks = (event.content as Array<{ type: string; text?: string }> | undefined) || []
            for (const b of blocks) {
              if (b.type === 'text' && b.text) {
                finalText += b.text
                cb.onText?.(b.text)
              }
            }
            break
          }
          case 'agent.tool_use': {
            toolCalls += 1
            cb.onToolUse?.(String(event.name || 'tool'))
            break
          }
          case 'session.status_idle': {
            cb.onIdle?.()
            return { finalText, toolCalls }
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  return { finalText, toolCalls }
}

/** Run a single prompt against Anthropic's Managed Agents runtime.
 *  Creates the agent + environment on demand if IDs aren't supplied. */
export async function runManagedSession(opts: ManagedSessionOptions): Promise<ManagedSessionResult> {
  const model = opts.model || 'claude-opus-4-7'
  const system = opts.system || 'You are kbot, an autonomous coding and research agent. Use the provided tools to complete tasks end-to-end.'
  const stream = opts.stream !== false

  const agent = opts.agentId
    ? { id: opts.agentId, version: 0 }
    : await createAgent(opts.apiKey, model, system)

  const env = opts.environmentId
    ? { id: opts.environmentId }
    : await createEnvironment(opts.apiKey)

  const session = await createSession(opts.apiKey, agent.id, env.id, opts.title || 'kbot session')

  await sendUserMessage(opts.apiKey, session.id, opts.prompt)

  const { finalText, toolCalls } = await streamEvents(opts.apiKey, session.id, {
    onText: stream ? (chunk) => process.stdout.write(chunk) : undefined,
    onToolUse: stream ? (name) => process.stderr.write(chalk.dim(`\n[tool: ${name}]\n`)) : undefined,
    onIdle: stream ? () => process.stdout.write('\n') : undefined,
  })

  return {
    sessionId: session.id,
    agentId: agent.id,
    environmentId: env.id,
    finalText,
    toolCalls,
  }
}
