import { describe, it, expect } from 'vitest'
import { resolveLegacyHash } from './legacyHashRedirect'

const at = (hash: string, pathname = '/', search = '') => ({ pathname, search, hash })

describe('resolveLegacyHash', () => {
  it('maps a legacy issue citation to its real path', () => {
    expect(resolveLegacyHash(at('#/issues/421'))).toBe('/issues/421')
  })

  it('maps the bare legacy root hash to /', () => {
    expect(resolveLegacyHash(at('#/'))).toBe('/')
  })

  it('preserves a query carried inside the hash (Stripe return URLs)', () => {
    expect(resolveLegacyHash(at('#/?checkout=complete'))).toBe('/?checkout=complete')
    expect(resolveLegacyHash(at('#/issues/400?spread=2'))).toBe('/issues/400?spread=2')
  })

  it('merges an outer query ahead of the hash query', () => {
    expect(resolveLegacyHash(at('#/issues/400?b=2', '/', '?a=1'))).toBe('/issues/400?a=1&b=2')
  })

  it('ignores Supabase auth token hashes', () => {
    expect(resolveLegacyHash(at('#access_token=abc&refresh_token=def'))).toBeNull()
    expect(resolveLegacyHash(at('#/login?access_token=abc'))).toBeNull()
  })

  it('ignores non-route hashes and real paths', () => {
    expect(resolveLegacyHash(at(''))).toBeNull()
    expect(resolveLegacyHash(at('#feature-well'))).toBeNull()
    expect(resolveLegacyHash(at('#/issues/421', '/issues/421'))).toBeNull()
  })
})
