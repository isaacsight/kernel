// Tests for image_thoughtful tool — fetch is mocked globally.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  imageThoughtfulTool,
  runImageThoughtful,
} from './image-thoughtful.js'

// ─────────────────────────────────────────────────────────────────────────
// Test helpers
// ─────────────────────────────────────────────────────────────────────────

interface FetchCall {
  url: string
  init: RequestInit | undefined
  body: unknown
}

interface MockResponseSpec {
  ok: boolean
  status?: number
  statusText?: string
  json?: unknown
  text?: string
}

function makeResponse(spec: MockResponseSpec): Response {
  return {
    ok: spec.ok,
    status: spec.status ?? (spec.ok ? 200 : 500),
    statusText: spec.statusText ?? (spec.ok ? 'OK' : 'ERR'),
    json: async () => spec.json ?? {},
    text: async () => spec.text ?? '',
  } as unknown as Response
}

function chatResponse(content: string): MockResponseSpec {
  return {
    ok: true,
    json: { choices: [{ message: { content } }] },
  }
}

function imageResponse(url: string): MockResponseSpec {
  return {
    ok: true,
    json: { data: [{ url }] },
  }
}

function installFetchMock(specs: MockResponseSpec[]): {
  calls: FetchCall[]
  restore: () => void
} {
  const calls: FetchCall[] = []
  const original = globalThis.fetch
  let i = 0
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    let parsedBody: unknown = undefined
    if (init?.body && typeof init.body === 'string') {
      try {
        parsedBody = JSON.parse(init.body)
      } catch {
        parsedBody = init.body
      }
    }
    calls.push({ url, init, body: parsedBody })
    const spec = specs[i++]
    if (!spec) throw new Error(`Unexpected fetch call #${i} to ${url}`)
    return makeResponse(spec)
  }) as typeof fetch
  return {
    calls,
    restore: () => {
      globalThis.fetch = original
    },
  }
}

// Ensure key is set per-test where needed
const ORIGINAL_KEY = process.env.OPENAI_API_KEY

beforeEach(() => {
  process.env.OPENAI_API_KEY = 'sk-test-key'
})

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.OPENAI_API_KEY
  else process.env.OPENAI_API_KEY = ORIGINAL_KEY
  vi.restoreAllMocks()
})

// ─────────────────────────────────────────────────────────────────────────
// Tool registration shape
// ─────────────────────────────────────────────────────────────────────────

describe('imageThoughtfulTool definition', () => {
  it('has the expected name and required prompt parameter', () => {
    expect(imageThoughtfulTool.name).toBe('image_thoughtful')
    expect(imageThoughtfulTool.parameters.prompt.required).toBe(true)
    expect(imageThoughtfulTool.tier).toBe('pro')
  })
})

// ─────────────────────────────────────────────────────────────────────────
// Happy path — plan → refine → final prompt → image
// ─────────────────────────────────────────────────────────────────────────

describe('runImageThoughtful — happy path', () => {
  it('runs plan, 2 refinements, final prompt, and image (thinking_steps=3)', async () => {
    const { calls, restore } = installFetchMock([
      chatResponse('{"composition":"A1"}'),    // plan
      chatResponse('{"composition":"A2"}'),    // refine #1
      chatResponse('{"composition":"A3"}'),    // refine #2
      chatResponse('Final cohesive prompt.'),   // final compose
      imageResponse('https://img/abc.png'),     // image
    ])

    try {
      const out = await runImageThoughtful({
        prompt: 'a fox in fog',
        thinking_steps: 3,
      })
      expect(out.url).toBe('https://img/abc.png')
      expect(out.plan).toBe('{"composition":"A1"}')
      expect(out.refinements).toEqual([
        '{"composition":"A2"}',
        '{"composition":"A3"}',
      ])
      expect(out.final_prompt).toBe('Final cohesive prompt.')

      // 4 chat calls + 1 image call
      expect(calls).toHaveLength(5)
      expect(calls[0].url).toContain('/v1/chat/completions')
      expect(calls[4].url).toContain('/v1/images/generations')

      const imgBody = calls[4].body as { model: string; size: string; prompt: string }
      expect(imgBody.model).toBe('gpt-image-2')
      expect(imgBody.size).toBe('1024x1024')
      expect(imgBody.prompt).toBe('Final cohesive prompt.')
    } finally {
      restore()
    }
  })

  it('maps aspect_ratio 16:9 to 1792x1024', async () => {
    const { calls, restore } = installFetchMock([
      chatResponse('{}'),
      chatResponse('Final.'),
      imageResponse('https://img/wide.png'),
    ])

    try {
      const out = await runImageThoughtful({
        prompt: 'a wide vista',
        thinking_steps: 1,
        aspect_ratio: '16:9',
      })
      expect(out.url).toBe('https://img/wide.png')
      const imgBody = calls[2].body as { size: string }
      expect(imgBody.size).toBe('1792x1024')
    } finally {
      restore()
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────
// thinking_steps = 1 — skip refinement
// ─────────────────────────────────────────────────────────────────────────

describe('runImageThoughtful — thinking_steps=1', () => {
  it('skips the refinement loop entirely', async () => {
    const { calls, restore } = installFetchMock([
      chatResponse('{"composition":"only"}'), // plan
      chatResponse('Final cohesive prompt.'),  // final compose
      imageResponse('https://img/single.png'),
    ])

    try {
      const out = await runImageThoughtful({
        prompt: 'a single shot',
        thinking_steps: 1,
      })
      expect(out.refinements).toEqual([])
      expect(out.plan).toBe('{"composition":"only"}')
      expect(out.url).toBe('https://img/single.png')
      expect(calls).toHaveLength(3)
    } finally {
      restore()
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────
// reference_image_url passthrough
// ─────────────────────────────────────────────────────────────────────────

describe('runImageThoughtful — reference_image_url', () => {
  it('forwards reference image to plan messages and to image API as input_image', async () => {
    const { calls, restore } = installFetchMock([
      chatResponse('{"composition":"ref"}'),
      chatResponse('Final.'),
      imageResponse('https://img/ref.png'),
    ])

    try {
      const out = await runImageThoughtful({
        prompt: 'restyle this',
        thinking_steps: 1,
        reference_image_url: 'https://example.com/ref.jpg',
      })
      expect(out.url).toBe('https://img/ref.png')

      // Plan call should include the reference image part in user content
      const planBody = calls[0].body as {
        messages: Array<{ role: string; content: unknown }>
      }
      const userContent = planBody.messages[1].content as Array<{
        type: string
        image_url?: string
      }>
      const hasImagePart = userContent.some(
        p => p.type === 'input_image' && p.image_url === 'https://example.com/ref.jpg'
      )
      expect(hasImagePart).toBe(true)

      // Image API call should include input_image
      const imgBody = calls[2].body as { input_image?: string }
      expect(imgBody.input_image).toBe('https://example.com/ref.jpg')
    } finally {
      restore()
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────
// Missing API key
// ─────────────────────────────────────────────────────────────────────────

describe('runImageThoughtful — missing API key', () => {
  it('throws a clean error when OPENAI_API_KEY is unset', async () => {
    delete process.env.OPENAI_API_KEY
    await expect(
      runImageThoughtful({ prompt: 'x', thinking_steps: 1 })
    ).rejects.toThrow(/OPENAI_API_KEY/)
  })

  it('execute() surfaces the missing-key error as an Error: string', async () => {
    delete process.env.OPENAI_API_KEY
    const out = await imageThoughtfulTool.execute({ prompt: 'x', thinking_steps: 1 })
    expect(out).toMatch(/^Error:/)
    expect(out).toMatch(/OPENAI_API_KEY/)
  })
})

// ─────────────────────────────────────────────────────────────────────────
// API failure surfaces a clean error
// ─────────────────────────────────────────────────────────────────────────

describe('runImageThoughtful — API failure', () => {
  it('throws when the chat API returns non-OK', async () => {
    const { restore } = installFetchMock([
      { ok: false, status: 401, statusText: 'Unauthorized', text: 'bad key' },
    ])
    try {
      await expect(
        runImageThoughtful({ prompt: 'x', thinking_steps: 1 })
      ).rejects.toThrow(/OpenAI chat failed: 401/)
    } finally {
      restore()
    }
  })

  it('throws when the image API returns non-OK', async () => {
    const { restore } = installFetchMock([
      chatResponse('{}'),                                         // plan
      chatResponse('Final.'),                                     // final compose
      { ok: false, status: 500, statusText: 'Server Error', text: 'boom' },
    ])
    try {
      await expect(
        runImageThoughtful({ prompt: 'x', thinking_steps: 1 })
      ).rejects.toThrow(/OpenAI image failed: 500/)
    } finally {
      restore()
    }
  })

  it('execute() catches API failure and returns Error: string', async () => {
    const { restore } = installFetchMock([
      { ok: false, status: 429, statusText: 'Too Many Requests', text: 'rate limit' },
    ])
    try {
      const out = await imageThoughtfulTool.execute({ prompt: 'x', thinking_steps: 1 })
      expect(out).toMatch(/^Error:/)
      expect(out).toMatch(/429/)
    } finally {
      restore()
    }
  })
})
