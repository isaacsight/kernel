import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  AnthropicManagedAgentsClient,
  AnthropicManagedAgentsError,
} from './managed-agents-anthropic.js'

// ─────────────────────────────────────────────────────────────────────────────
// fetch mock helpers
// ─────────────────────────────────────────────────────────────────────────────

interface MockCall {
  url: string
  init: RequestInit
}

function makeFetch(
  responder: (url: string, init: RequestInit) => Response,
): { fetchImpl: typeof fetch; calls: MockCall[] } {
  const calls: MockCall[] = []
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : (input as URL).toString()
    const i = init ?? {}
    calls.push({ url, init: i })
    return responder(url, i)
  }
  return { fetchImpl, calls }
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

let prevKey: string | undefined

beforeEach(() => {
  prevKey = process.env.ANTHROPIC_API_KEY
  process.env.ANTHROPIC_API_KEY = 'test-key-123'
})

afterEach(() => {
  if (prevKey === undefined) delete process.env.ANTHROPIC_API_KEY
  else process.env.ANTHROPIC_API_KEY = prevKey
  vi.restoreAllMocks()
})

describe('AnthropicManagedAgentsClient — auth', () => {
  it('throws when ANTHROPIC_API_KEY is missing', () => {
    delete process.env.ANTHROPIC_API_KEY
    expect(() => new AnthropicManagedAgentsClient()).toThrow(
      /ANTHROPIC_API_KEY/,
    )
  })

  it('accepts an explicit apiKey override', () => {
    delete process.env.ANTHROPIC_API_KEY
    const c = new AnthropicManagedAgentsClient({ apiKey: 'override' })
    expect(c).toBeInstanceOf(AnthropicManagedAgentsClient)
  })
})

describe('AnthropicManagedAgentsClient.createSession', () => {
  it('POSTs /agents/sessions with body and beta header, returns session_id', async () => {
    const { fetchImpl, calls } = makeFetch(() =>
      jsonResponse(200, { session_id: 'sess_abc', mission: 'm', status: 'idle' }),
    )
    const c = new AnthropicManagedAgentsClient({ fetchImpl })
    const out = await c.createSession({
      mission: 'survey the field',
      allowedTools: ['web_search'],
      model: 'claude-sonnet-4-7',
    })
    expect(out.session_id).toBe('sess_abc')
    expect(calls).toHaveLength(1)
    const call = calls[0]
    expect(call.url).toBe('https://api.anthropic.com/v1/agents/sessions')
    expect(call.init.method).toBe('POST')
    const headers = call.init.headers as Record<string, string>
    expect(headers['anthropic-beta']).toBe('managed-agents-2026-04-01')
    expect(headers['x-api-key']).toBe('test-key-123')
    expect(headers['anthropic-version']).toBeTruthy()
    const body = JSON.parse(call.init.body as string)
    expect(body).toEqual({
      mission: 'survey the field',
      tools: ['web_search'],
      model: 'claude-sonnet-4-7',
    })
  })

  it('rejects missing mission', async () => {
    const { fetchImpl } = makeFetch(() => jsonResponse(200, {}))
    const c = new AnthropicManagedAgentsClient({ fetchImpl })
    await expect(c.createSession({ mission: '' })).rejects.toThrow(/mission/)
  })
})

describe('AnthropicManagedAgentsClient.sendTurn', () => {
  it('POSTs to /agents/sessions/:id/turns with input', async () => {
    const { fetchImpl, calls } = makeFetch(() =>
      jsonResponse(200, { output: 'pong', tool_calls: [] }),
    )
    const c = new AnthropicManagedAgentsClient({ fetchImpl })
    const out = await c.sendTurn({ sessionId: 'sess_abc', input: 'ping' })
    expect(out.output).toBe('pong')
    const call = calls[0]
    expect(call.url).toBe(
      'https://api.anthropic.com/v1/agents/sessions/sess_abc/turns',
    )
    expect(call.init.method).toBe('POST')
    const body = JSON.parse(call.init.body as string)
    expect(body).toEqual({ input: 'ping' })
    const headers = call.init.headers as Record<string, string>
    expect(headers['anthropic-beta']).toBe('managed-agents-2026-04-01')
  })
})

describe('AnthropicManagedAgentsClient.getSession + listSessions', () => {
  it('GETs the session by id', async () => {
    const { fetchImpl, calls } = makeFetch(() =>
      jsonResponse(200, { session_id: 'sess_abc', status: 'running' }),
    )
    const c = new AnthropicManagedAgentsClient({ fetchImpl })
    const state = await c.getSession({ sessionId: 'sess_abc' })
    expect(state.status).toBe('running')
    expect(calls[0].init.method).toBe('GET')
    expect(calls[0].url).toBe(
      'https://api.anthropic.com/v1/agents/sessions/sess_abc',
    )
  })

  it('GETs the session list', async () => {
    const { fetchImpl, calls } = makeFetch(() =>
      jsonResponse(200, { sessions: [{ session_id: 'a' }] }),
    )
    const c = new AnthropicManagedAgentsClient({ fetchImpl })
    const out = await c.listSessions()
    expect(out.sessions).toHaveLength(1)
    expect(calls[0].url).toBe('https://api.anthropic.com/v1/agents/sessions')
  })
})

describe('AnthropicManagedAgentsClient.closeSession', () => {
  it('DELETEs the session', async () => {
    const { fetchImpl, calls } = makeFetch(() => jsonResponse(200, { ok: true }))
    const c = new AnthropicManagedAgentsClient({ fetchImpl })
    const out = await c.closeSession({ sessionId: 'sess_abc' })
    expect(out.ok).toBe(true)
    expect(calls[0].init.method).toBe('DELETE')
    expect(calls[0].url).toBe(
      'https://api.anthropic.com/v1/agents/sessions/sess_abc',
    )
    const headers = calls[0].init.headers as Record<string, string>
    expect(headers['anthropic-beta']).toBe('managed-agents-2026-04-01')
  })
})

describe('AnthropicManagedAgentsClient memory', () => {
  it('reads memory by key via GET', async () => {
    const { fetchImpl, calls } = makeFetch(() =>
      jsonResponse(200, { value: 'world' }),
    )
    const c = new AnthropicManagedAgentsClient({ fetchImpl })
    const out = await c.memoryRead({ sessionId: 'sess_abc', key: 'hello' })
    expect(out).toEqual({ value: 'world' })
    expect(calls[0].init.method).toBe('GET')
    expect(calls[0].url).toBe(
      'https://api.anthropic.com/v1/agents/sessions/sess_abc/memory/hello',
    )
  })

  it('writes memory via POST with key+value', async () => {
    const { fetchImpl, calls } = makeFetch(() => jsonResponse(200, { ok: true }))
    const c = new AnthropicManagedAgentsClient({ fetchImpl })
    const ack = await c.memoryWrite({
      sessionId: 'sess_abc',
      key: 'hello',
      value: { x: 1 },
    })
    expect(ack.ok).toBe(true)
    expect(calls[0].init.method).toBe('POST')
    expect(calls[0].url).toBe(
      'https://api.anthropic.com/v1/agents/sessions/sess_abc/memory',
    )
    const body = JSON.parse(calls[0].init.body as string)
    expect(body).toEqual({ key: 'hello', value: { x: 1 } })
  })
})

describe('AnthropicManagedAgentsClient — error surface', () => {
  it('surfaces non-2xx as AnthropicManagedAgentsError with status + body', async () => {
    const { fetchImpl } = makeFetch(() =>
      jsonResponse(500, { error: { type: 'overloaded' } }),
    )
    const c = new AnthropicManagedAgentsClient({ fetchImpl })
    await expect(
      c.createSession({ mission: 'm' }),
    ).rejects.toBeInstanceOf(AnthropicManagedAgentsError)

    try {
      await c.createSession({ mission: 'm' })
    } catch (err) {
      const e = err as AnthropicManagedAgentsError
      expect(e.status).toBe(500)
      expect(e.body).toContain('overloaded')
    }
  })

  it('wraps fetch network errors', async () => {
    const fetchImpl: typeof fetch = async () => {
      throw new TypeError('network down')
    }
    const c = new AnthropicManagedAgentsClient({ fetchImpl })
    await expect(c.listSessions()).rejects.toBeInstanceOf(
      AnthropicManagedAgentsError,
    )
  })
})

describe('AnthropicManagedAgentsClient — beta header is sent on every request', () => {
  it('sends managed-agents-2026-04-01 on create, turn, get, list, close, memory', async () => {
    const { fetchImpl, calls } = makeFetch(() => jsonResponse(200, { ok: true }))
    const c = new AnthropicManagedAgentsClient({ fetchImpl })
    await c.createSession({ mission: 'm' })
    await c.sendTurn({ sessionId: 's', input: 'i' })
    await c.getSession({ sessionId: 's' })
    await c.listSessions()
    await c.closeSession({ sessionId: 's' })
    await c.memoryRead({ sessionId: 's', key: 'k' })
    await c.memoryWrite({ sessionId: 's', key: 'k', value: 1 })

    expect(calls).toHaveLength(7)
    for (const call of calls) {
      const headers = call.init.headers as Record<string, string>
      expect(headers['anthropic-beta']).toBe('managed-agents-2026-04-01')
      expect(headers['x-api-key']).toBe('test-key-123')
    }
  })
})
