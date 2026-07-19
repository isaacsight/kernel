import { describe, expect, it } from 'vitest'
import { catalogSeconds, cleanParams, isAllowedArtifactUrl, isAllowedOrigin, isFalQueueUrl, positiveSeconds } from './engine-safety.mjs'

describe('cleanParams', () => {
  it('keeps flat scalar model parameters', () => {
    expect(cleanParams({ resolution: '720p', duration: 5, seed: 42, turbo: true })).toEqual({
      resolution: '720p', duration: 5, seed: 42, turbo: true,
    })
  })

  it('drops nested, malformed, and protected fields', () => {
    expect(cleanParams({
      prompt: 'override', image_url: 'https://attacker.test/x', nested: { a: 1 },
      list: [1], 'bad-key!': 1, valid: 'yes',
    })).toEqual({ valid: 'yes' })
  })

  it('drops oversized scalar strings', () => {
    expect(cleanParams({ note: 'x'.repeat(2001), seed: 1 })).toEqual({ seed: 1 })
  })
})

describe('provider URL boundary', () => {
  it('only sends credentials to the fal queue origin', () => {
    expect(isFalQueueUrl('https://queue.fal.run/fal-ai/model/requests/1/status')).toBe(true)
    expect(isFalQueueUrl('https://evil.example/status')).toBe(false)
    expect(isFalQueueUrl('http://queue.fal.run/status')).toBe(false)
  })

  it('only downloads default fal media hosts or explicit extras', () => {
    expect(isAllowedArtifactUrl('https://v3.fal.media/files/video.mp4')).toBe(true)
    expect(isAllowedArtifactUrl('http://127.0.0.1/private')).toBe(false)
    expect(isAllowedArtifactUrl('https://cdn.example.com/file', 'cdn.example.com')).toBe(true)
  })
})

describe('duration validation', () => {
  it('accepts positive numeric durations and applies a fallback when omitted', () => {
    expect(positiveSeconds('5')).toBe(5)
    expect(positiveSeconds(undefined, 8)).toBe(8)
  })

  it('rejects zero, negative, and non-numeric durations', () => {
    expect(positiveSeconds(0)).toBeNull()
    expect(positiveSeconds(-5)).toBeNull()
    expect(positiveSeconds('later')).toBeNull()
  })

  it('prices the duration that catalog params actually submit', () => {
    expect(catalogSeconds({ durationSeconds: 5, params: { duration: 10 } })).toBe(10)
    expect(catalogSeconds({ durationSeconds: 5 })).toBe(5)
  })
})

describe('browser origin boundary', () => {
  it('allows non-browser clients and loopback browser origins', () => {
    expect(isAllowedOrigin(undefined)).toBe(true)
    expect(isAllowedOrigin('http://localhost:5173')).toBe(true)
    expect(isAllowedOrigin('http://127.0.0.1:4173')).toBe(true)
  })

  it('rejects remote web origins unless explicitly configured', () => {
    expect(isAllowedOrigin('https://example.com')).toBe(false)
    expect(isAllowedOrigin('https://studio.example.com', 'https://studio.example.com')).toBe(true)
    expect(isAllowedOrigin('null')).toBe(false)
  })
})

describe('cleanParams arrays', () => {
  it('passes arrays of short strings (reference_image_urls et al)', () => {
    const urls = ['https://v3b.fal.media/files/a.png', 'https://v3b.fal.media/files/b.png']
    expect(cleanParams({ reference_image_urls: urls }).reference_image_urls).toEqual(urls)
  })
  it('drops arrays containing non-strings or oversized entries', () => {
    expect(cleanParams({ xs: [1, 'a'] }).xs).toBeUndefined()
    expect(cleanParams({ xs: ['a'.repeat(5000)] }).xs).toBeUndefined()
  })
  it('drops arrays longer than 8 entries', () => {
    expect(cleanParams({ xs: Array(9).fill('a') }).xs).toBeUndefined()
  })
})
