// LLaDA provider tests — vitest, fetch fully mocked.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { LLaDAClient } from './llada.js'

type FetchArgs = Parameters<typeof fetch>

function makeMockFetch(
  responder: (url: string, init: RequestInit | undefined) => {
    ok?: boolean
    status?: number
    statusText?: string
    body?: unknown
    bodyText?: string
  }
): typeof fetch {
  return vi.fn(async (...args: FetchArgs) => {
    const url = typeof args[0] === 'string' ? args[0] : (args[0] as URL).toString()
    const init = args[1]
    const r = responder(url, init)
    return {
      ok: r.ok ?? true,
      status: r.status ?? 200,
      statusText: r.statusText ?? 'OK',
      json: async () => r.body ?? {},
      text: async () => r.bodyText ?? JSON.stringify(r.body ?? {}),
    } as unknown as Response
  }) as unknown as typeof fetch
}

describe('LLaDAClient', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('uses the default base URL when none supplied', () => {
    const c = new LLaDAClient()
    expect(c.baseUrl).toBe('http://localhost:8000')
  })

  it('strips trailing slashes from baseUrl', () => {
    const c = new LLaDAClient({ baseUrl: 'http://example.com:9000///' })
    expect(c.baseUrl).toBe('http://example.com:9000')
  })

  it('attaches Authorization header only when apiKey is set', async () => {
    let captured: Record<string, string> = {}
    const fetchImpl = makeMockFetch((_url, init) => {
      captured = (init?.headers as Record<string, string>) ?? {}
      return { body: { choices: [{ message: { content: 'hi' } }] } }
    })
    const c = new LLaDAClient({ apiKey: 'sk-test', fetchImpl })
    await c.chat({ messages: [{ role: 'user', content: 'hello' }] })
    expect(captured.Authorization).toBe('Bearer sk-test')

    const fetchImpl2 = makeMockFetch(() => ({
      body: { choices: [{ message: { content: 'hi' } }] },
    }))
    const c2 = new LLaDAClient({ fetchImpl: fetchImpl2 })
    let captured2: Record<string, string> = {}
    const f2 = vi.fn(async (...args: FetchArgs) => {
      captured2 = (args[1]?.headers as Record<string, string>) ?? {}
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ choices: [{ message: { content: 'hi' } }] }),
        text: async () => '',
      } as unknown as Response
    })
    const c3 = new LLaDAClient({ fetchImpl: f2 as unknown as typeof fetch })
    await c3.chat({ messages: [{ role: 'user', content: 'hello' }] })
    expect(captured2.Authorization).toBeUndefined()
    // also exercise c2 to keep coverage
    await c2.chat({ messages: [{ role: 'user', content: 'hello' }] })
  })

  it('chat returns the assistant content', async () => {
    const fetchImpl = makeMockFetch((url) => {
      expect(url).toBe('http://localhost:8000/v1/chat/completions')
      return { body: { choices: [{ message: { content: 'a fox in the snow' } }] } }
    })
    const c = new LLaDAClient({ fetchImpl })
    const out = await c.chat({ messages: [{ role: 'user', content: 'paint me a fox' }] })
    expect(out.text).toBe('a fox in the snow')
  })

  it('chat surfaces a thinking trace when present', async () => {
    const fetchImpl = makeMockFetch(() => ({
      body: {
        choices: [
          { message: { content: 'final', thinking: 'first I considered the palette' } },
        ],
      },
    }))
    const c = new LLaDAClient({ fetchImpl })
    const out = await c.chat({
      messages: [{ role: 'user', content: 'x' }],
      thinkingSteps: 4,
    })
    expect(out.text).toBe('final')
    expect(out.thinking).toBe('first I considered the palette')
  })

  it('chat throws on non-2xx', async () => {
    const fetchImpl = makeMockFetch(() => ({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      bodyText: 'boom',
    }))
    const c = new LLaDAClient({ fetchImpl })
    await expect(c.chat({ messages: [{ role: 'user', content: 'x' }] })).rejects.toThrow(/500/)
  })

  it('generateImage returns a URL', async () => {
    const fetchImpl = makeMockFetch((url, init) => {
      expect(url).toBe('http://localhost:8000/v1/images/generations')
      const body = JSON.parse(init?.body as string)
      expect(body.prompt).toBe('a fox')
      expect(body.image_w).toBe(1024)
      expect(body.image_h).toBe(1024)
      expect(body.steps).toBe(8)
      return { body: { data: [{ url: 'https://cdn.local/fox.png' }] } }
    })
    const c = new LLaDAClient({ fetchImpl })
    const out = await c.generateImage({ prompt: 'a fox' })
    expect(out.url).toBe('https://cdn.local/fox.png')
  })

  it('generateImage decodes b64_json into a data URL', async () => {
    const fetchImpl = makeMockFetch(() => ({
      body: { data: [{ b64_json: 'AAAA' }] },
    }))
    const c = new LLaDAClient({ fetchImpl })
    const out = await c.generateImage({ prompt: 'x', size: '512x512' })
    expect(out.url).toBe('data:image/png;base64,AAAA')
  })

  it('generateImage forwards thinking + refImage knobs', async () => {
    let body: Record<string, unknown> = {}
    const fetchImpl = makeMockFetch((_url, init) => {
      body = JSON.parse(init?.body as string)
      return { body: { data: [{ url: 'https://x/x.png' }] } }
    })
    const c = new LLaDAClient({ fetchImpl })
    await c.generateImage({
      prompt: 'p',
      size: '1408x1056',
      thinking: true,
      refImage: 'https://x/ref.png',
      cfgScale: 4.5,
    })
    expect(body.mode).toBe('thinking')
    expect(body.thinking_steps).toBe(32)
    expect(body.cfg_scale).toBe(4.5)
    expect(body.input_image).toBe('https://x/ref.png')
    expect(body.image_w).toBe(1408)
    expect(body.image_h).toBe(1056)
  })

  it('understand requires either imageUrl or imageData', async () => {
    const fetchImpl = makeMockFetch(() => ({
      body: { choices: [{ message: { content: 'an apple' } }] },
    }))
    const c = new LLaDAClient({ fetchImpl })
    await expect(c.understand({ prompt: 'what is this?' })).rejects.toThrow(/imageUrl/)
    const out = await c.understand({
      prompt: 'what is this?',
      imageUrl: 'https://x/a.png',
    })
    expect(out.text).toBe('an apple')
  })

  it('understand wraps base64 imageData into a data URL', async () => {
    let captured: Record<string, unknown> = {}
    const fetchImpl = makeMockFetch((_url, init) => {
      captured = JSON.parse(init?.body as string)
      return { body: { choices: [{ message: { content: 'ok' } }] } }
    })
    const c = new LLaDAClient({ fetchImpl })
    await c.understand({ prompt: 'p', imageData: 'AAAA' })
    const msg = (captured.messages as Array<{ content: unknown }>)[0]
    const parts = msg.content as Array<{ type: string; image_url?: { url: string } }>
    const imgPart = parts.find((p) => p.type === 'image_url')!
    expect(imgPart.image_url!.url).toBe('data:image/png;base64,AAAA')
  })

  it('isReachable returns true on 2xx /v1/models', async () => {
    const fetchImpl = makeMockFetch((url) => {
      if (url.endsWith('/v1/models')) return { ok: true }
      return { ok: false, status: 404 }
    })
    const c = new LLaDAClient({ fetchImpl })
    expect(await c.isReachable()).toBe(true)
  })

  it('isReachable falls back to /health', async () => {
    const fetchImpl = makeMockFetch((url) => {
      if (url.endsWith('/v1/models')) return { ok: false, status: 404 }
      if (url.endsWith('/health')) return { ok: true }
      return { ok: false }
    })
    const c = new LLaDAClient({ fetchImpl })
    expect(await c.isReachable()).toBe(true)
  })

  it('isReachable returns false on network error', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('ECONNREFUSED')
    }) as unknown as typeof fetch
    const c = new LLaDAClient({ fetchImpl })
    expect(await c.isReachable()).toBe(false)
  })
})
