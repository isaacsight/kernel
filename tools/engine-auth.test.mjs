import { describe, expect, it } from 'vitest'
import { createQuote, verifyQuote } from './engine-auth.mjs'

describe('paid request quotes', () => {
  const secret = 'test-secret-that-is-long-enough'
  const body = { prompt: 'A paper boat', model: 'seedance-lite', durationSeconds: 5 }

  it('binds a cost to the exact route and request', () => {
    const token = createQuote(secret, '/v1/videos/generations', body, 1.25, 1000)
    expect(verifyQuote(secret, token, '/v1/videos/generations', body, 1100)).toBe(1.25)
  })

  it('rejects changes, expiry, and another route', () => {
    const token = createQuote(secret, '/v1/videos/generations', body, 1.25, 1000)
    expect(() => verifyQuote(secret, token, '/v1/videos/generations', { ...body, durationSeconds: 10 }, 1100)).toThrow('changed')
    expect(() => verifyQuote(secret, token, '/v1/images/fal', body, 1100)).toThrow('another route')
    expect(() => verifyQuote(secret, token, '/v1/videos/generations', body, 400000)).toThrow('expired')
  })
})
