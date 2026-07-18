import { describe, expect, it } from 'vitest'
import { catalogSeconds, cleanParams, isAllowedOrigin, positiveSeconds } from './engine-safety.mjs'

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
