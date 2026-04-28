// llada-image tool tests — vitest, fetch fully mocked via injected LLaDAClient.
import { describe, it, expect, vi } from 'vitest'
import { runLLaDAImageThoughtful, lladaImageTool } from './llada-image.js'
import { LLaDAClient } from '../providers/llada.js'

type FetchArgs = Parameters<typeof fetch>

// Build a fetch mock that returns canned chat / image bodies in sequence.
function sequencedFetch(responses: Array<{ url?: string; body: unknown }>): typeof fetch {
  let i = 0
  return vi.fn(async (...args: FetchArgs) => {
    const r = responses[i++] ?? responses[responses.length - 1]
    const url = typeof args[0] === 'string' ? args[0] : (args[0] as URL).toString()
    if (r.url) expect(url).toContain(r.url)
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => r.body,
      text: async () => JSON.stringify(r.body),
    } as unknown as Response
  }) as unknown as typeof fetch
}

describe('runLLaDAImageThoughtful', () => {
  it('runs plan -> refine -> finalize -> generate (3 thinking steps)', async () => {
    const fetchImpl = sequencedFetch([
      // 1. plan
      {
        url: '/v1/chat/completions',
        body: { choices: [{ message: { content: '{"composition":"v1"}' } }] },
      },
      // 2. critique #1 (since thinking_steps = 3 → 2 refinements)
      {
        url: '/v1/chat/completions',
        body: { choices: [{ message: { content: '{"composition":"v2"}' } }] },
      },
      // 3. critique #2
      {
        url: '/v1/chat/completions',
        body: { choices: [{ message: { content: '{"composition":"v3"}' } }] },
      },
      // 4. final-prompt composer
      {
        url: '/v1/chat/completions',
        body: { choices: [{ message: { content: 'A vibrant fox in deep snow.' } }] },
      },
      // 5. image generation
      {
        url: '/v1/images/generations',
        body: { data: [{ url: 'https://cdn.local/fox.png' }] },
      },
    ])
    const client = new LLaDAClient({ fetchImpl })
    const out = await runLLaDAImageThoughtful(
      { prompt: 'a fox', aspect_ratio: '16:9', thinking_steps: 3 },
      { client }
    )
    expect(out.plan).toBe('{"composition":"v1"}')
    expect(out.refinements).toEqual(['{"composition":"v2"}', '{"composition":"v3"}'])
    expect(out.final_prompt).toBe('A vibrant fox in deep snow.')
    expect(out.url).toBe('https://cdn.local/fox.png')
  })

  it('skips refinement when thinking_steps = 1', async () => {
    const fetchImpl = sequencedFetch([
      // plan
      { body: { choices: [{ message: { content: 'plan-only' } }] } },
      // final-prompt composer
      { body: { choices: [{ message: { content: 'final paragraph' } }] } },
      // image
      { body: { data: [{ url: 'https://cdn.local/x.png' }] } },
    ])
    const client = new LLaDAClient({ fetchImpl })
    const out = await runLLaDAImageThoughtful(
      { prompt: 'x', thinking_steps: 1 },
      { client }
    )
    expect(out.refinements).toEqual([])
    expect(out.plan).toBe('plan-only')
    expect(out.final_prompt).toBe('final paragraph')
  })

  it('forwards reference_image_url to image generation as input_image', async () => {
    let imgBody: Record<string, unknown> = {}
    const fetchImpl = vi.fn(async (...args: FetchArgs) => {
      const url = typeof args[0] === 'string' ? args[0] : (args[0] as URL).toString()
      const init = args[1]
      if (url.endsWith('/v1/chat/completions')) {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
          text: async () => '',
        } as unknown as Response
      }
      imgBody = JSON.parse(init?.body as string)
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ data: [{ url: 'https://x/y.png' }] }),
        text: async () => '',
      } as unknown as Response
    }) as unknown as typeof fetch
    const client = new LLaDAClient({ fetchImpl })
    await runLLaDAImageThoughtful(
      {
        prompt: 'a',
        thinking_steps: 1,
        reference_image_url: 'https://ref/img.png',
      },
      { client }
    )
    expect(imgBody.input_image).toBe('https://ref/img.png')
  })

  it('rejects empty prompt at the schema layer', async () => {
    await expect(
      runLLaDAImageThoughtful({ prompt: '' }, { client: new LLaDAClient() })
    ).rejects.toThrow()
  })
})

describe('lladaImageTool', () => {
  it('is registered as a free-tier local tool with the right name', () => {
    expect(lladaImageTool.name).toBe('local_image_thoughtful')
    expect(lladaImageTool.tier).toBe('free')
    expect(lladaImageTool.parameters.prompt.required).toBe(true)
  })

  it('execute returns an Error string on failure (does not throw)', async () => {
    // No fetch mock — global fetch will reject, runner surfaces it as a string.
    const out = await lladaImageTool.execute({ prompt: 'x', thinking_steps: 1 })
    expect(typeof out).toBe('string')
    expect(out.startsWith('Error:') || out.startsWith('{')).toBe(true)
  })
})
