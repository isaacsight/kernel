import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock SupabaseClient before importing module under test
vi.mock('./SupabaseClient', () => ({
  getAccessToken: vi.fn().mockResolvedValue('test-token'),
}))

// Must import after mock
const { generateImage, ImageGenLimitError } = await import('./imageGen')

describe('generateImage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns images on success', async () => {
    const mockResponse = {
      text: 'A sunset over mountains',
      images: [{ data: 'base64data', mimeType: 'image/png' }],
      model: 'gemini-3.1-flash-image-preview',
    }
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 })
    )

    const result = await generateImage('sunset over mountains')
    expect(result.images).toHaveLength(1)
    expect(result.images[0].data).toBe('base64data')
    expect(result.text).toBe('A sunset over mountains')
  })

  it('throws on 403 pro_only', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'pro_only' }), { status: 403 })
    )

    await expect(generateImage('test')).rejects.toThrow('pro_only')
  })

  it('throws ImageGenLimitError on 429', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ retry_after: 120, limit: 10 }), { status: 429 })
    )

    try {
      await generateImage('test')
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(ImageGenLimitError)
      expect((err as ImageGenLimitError).retryAfter).toBe(120)
      expect((err as ImageGenLimitError).limit).toBe(10)
    }
  })

  it('throws generic error on other failures', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Something went wrong' }), { status: 500 })
    )

    await expect(generateImage('test')).rejects.toThrow('Something went wrong')
  })
})

describe('ImageGenLimitError', () => {
  it('constructs with correct properties', () => {
    const err = new ImageGenLimitError(300, 10)
    expect(err.name).toBe('ImageGenLimitError')
    expect(err.retryAfter).toBe(300)
    expect(err.limit).toBe(10)
    expect(err.message).toContain('5 minutes')
  })
})
