import { describe, it, expect } from 'vitest'
import { RateLimitError, FreeLimitError } from './ClaudeClient'

describe('ClaudeClient', () => {
  describe('RateLimitError', () => {
    it('has correct properties', () => {
      const err = new RateLimitError('Rate limited', 100, '2026-01-01T00:00:00Z')
      expect(err.name).toBe('RateLimitError')
      expect(err.message).toBe('Rate limited')
      expect(err.limit).toBe(100)
      expect(err.resetsAt).toBe('2026-01-01T00:00:00Z')
      expect(err).toBeInstanceOf(Error)
    })
  })

  describe('FreeLimitError', () => {
    it('has correct properties', () => {
      const err = new FreeLimitError(10, 10)
      expect(err.name).toBe('FreeLimitError')
      expect(err.limit).toBe(10)
      expect(err.used).toBe(10)
      expect(err.message).toContain('10/10')
      expect(err).toBeInstanceOf(Error)
    })

    it('formats message correctly', () => {
      const err = new FreeLimitError(10, 7)
      expect(err.message).toBe('Free limit reached: 7/10 messages used')
    })
  })
})
