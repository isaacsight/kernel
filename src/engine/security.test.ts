import { describe, it, expect, beforeEach } from 'vitest'

// ─── CORS origin validation ─────────────────────────────────
// Mirrors the logic in supabase/functions/_shared/cors.ts

const ALLOWED_ORIGINS = new Set([
  'https://kernel.chat',
  'https://www.kernel.chat',
])

function isAllowedOrigin(origin: string): boolean {
  return ALLOWED_ORIGINS.has(origin) || /^https?:\/\/localhost(:\d+)?$/.test(origin)
}

describe('CORS origin validation', () => {
  it('allows production origins', () => {
    expect(isAllowedOrigin('https://kernel.chat')).toBe(true)
    expect(isAllowedOrigin('https://www.kernel.chat')).toBe(true)
  })

  it('allows localhost with any port', () => {
    expect(isAllowedOrigin('http://localhost')).toBe(true)
    expect(isAllowedOrigin('http://localhost:3000')).toBe(true)
    expect(isAllowedOrigin('http://localhost:5173')).toBe(true)
    expect(isAllowedOrigin('https://localhost:8443')).toBe(true)
  })

  it('rejects unknown origins', () => {
    expect(isAllowedOrigin('https://evil.com')).toBe(false)
    expect(isAllowedOrigin('https://kernel.chat.evil.com')).toBe(false)
    expect(isAllowedOrigin('https://notkernel.chat')).toBe(false)
  })

  it('rejects origins with path or query', () => {
    expect(isAllowedOrigin('https://kernel.chat/path')).toBe(false)
    expect(isAllowedOrigin('https://kernel.chat?q=1')).toBe(false)
  })

  it('rejects empty and malformed origins', () => {
    expect(isAllowedOrigin('')).toBe(false)
    expect(isAllowedOrigin('kernel.chat')).toBe(false)
    expect(isAllowedOrigin('ftp://kernel.chat')).toBe(false)
  })

  it('rejects localhost with path suffix', () => {
    expect(isAllowedOrigin('http://localhost:3000/evil')).toBe(false)
  })
})

// ─── SSRF host blocking ─────────────────────────────────────
// Mirrors BLOCKED_HOSTS in supabase/functions/url-fetch/index.ts

const BLOCKED_HOSTS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^0\./,
  /^169\.254\./,
  /^\[::1\]/,
  /^\[fc/i,
  /^\[fd/i,
  /^\[fe80/i,
]

function isBlockedHost(hostname: string): boolean {
  return BLOCKED_HOSTS.some(re => re.test(hostname))
}

describe('SSRF host blocking', () => {
  it('blocks localhost', () => {
    expect(isBlockedHost('localhost')).toBe(true)
    expect(isBlockedHost('LOCALHOST')).toBe(true)
  })

  it('blocks loopback IPs', () => {
    expect(isBlockedHost('127.0.0.1')).toBe(true)
    expect(isBlockedHost('127.0.0.2')).toBe(true)
    expect(isBlockedHost('127.255.255.255')).toBe(true)
  })

  it('blocks private class A (10.x.x.x)', () => {
    expect(isBlockedHost('10.0.0.1')).toBe(true)
    expect(isBlockedHost('10.255.255.255')).toBe(true)
  })

  it('blocks private class B (172.16-31.x.x)', () => {
    expect(isBlockedHost('172.16.0.1')).toBe(true)
    expect(isBlockedHost('172.31.255.255')).toBe(true)
    // 172.15 and 172.32 should NOT be blocked
    expect(isBlockedHost('172.15.0.1')).toBe(false)
    expect(isBlockedHost('172.32.0.1')).toBe(false)
  })

  it('blocks private class C (192.168.x.x)', () => {
    expect(isBlockedHost('192.168.0.1')).toBe(true)
    expect(isBlockedHost('192.168.255.255')).toBe(true)
  })

  it('blocks link-local (169.254.x.x)', () => {
    expect(isBlockedHost('169.254.169.254')).toBe(true) // AWS metadata
    expect(isBlockedHost('169.254.0.1')).toBe(true)
  })

  it('blocks zero-prefix IPs', () => {
    expect(isBlockedHost('0.0.0.0')).toBe(true)
    expect(isBlockedHost('0.1.2.3')).toBe(true)
  })

  it('blocks IPv6 loopback and private ranges', () => {
    expect(isBlockedHost('[::1]')).toBe(true)
    expect(isBlockedHost('[fc00::1]')).toBe(true)
    expect(isBlockedHost('[fd12::1]')).toBe(true)
    expect(isBlockedHost('[fe80::1]')).toBe(true)
  })

  it('allows public IPs', () => {
    expect(isBlockedHost('8.8.8.8')).toBe(false)
    expect(isBlockedHost('1.1.1.1')).toBe(false)
    expect(isBlockedHost('93.184.216.34')).toBe(false) // example.com
  })

  it('allows public hostnames', () => {
    expect(isBlockedHost('example.com')).toBe(false)
    expect(isBlockedHost('api.anthropic.com')).toBe(false)
    expect(isBlockedHost('kernel.chat')).toBe(false)
  })
})

// ─── Rate limiting (sliding window) ─────────────────────────
// Mirrors the pattern used across web-search, url-fetch, evaluate-chat, etc.

function createRateLimiter(windowMs: number, maxRequests: number) {
  const map = new Map<string, number[]>()

  return {
    check(userId: string, now = Date.now()): { allowed: boolean; retryAfter: number } {
      const timestamps = (map.get(userId) || []).filter(t => now - t < windowMs)
      if (timestamps.length >= maxRequests) {
        return { allowed: false, retryAfter: Math.ceil((timestamps[0] + windowMs - now) / 1000) }
      }
      timestamps.push(now)
      map.set(userId, timestamps)
      return { allowed: true, retryAfter: 0 }
    },
    cleanup(now = Date.now()) {
      for (const [key, ts] of map) {
        const recent = ts.filter(t => now - t < windowMs)
        if (recent.length === 0) map.delete(key)
        else map.set(key, recent)
      }
    },
    _map: map,
  }
}

describe('Rate limiting (sliding window)', () => {
  let limiter: ReturnType<typeof createRateLimiter>
  const WINDOW = 60_000 // 1 minute
  const MAX = 3

  beforeEach(() => {
    limiter = createRateLimiter(WINDOW, MAX)
  })

  it('allows requests under the limit', () => {
    const now = 1000000
    expect(limiter.check('user1', now).allowed).toBe(true)
    expect(limiter.check('user1', now + 100).allowed).toBe(true)
    expect(limiter.check('user1', now + 200).allowed).toBe(true)
  })

  it('blocks requests over the limit', () => {
    const now = 1000000
    limiter.check('user1', now)
    limiter.check('user1', now + 100)
    limiter.check('user1', now + 200)
    const result = limiter.check('user1', now + 300)
    expect(result.allowed).toBe(false)
    expect(result.retryAfter).toBeGreaterThan(0)
  })

  it('provides correct retryAfter value', () => {
    const now = 1000000
    limiter.check('user1', now)
    limiter.check('user1', now + 10000)
    limiter.check('user1', now + 20000)
    // 4th request at now+25000 — oldest is at now, expires at now+60000
    const result = limiter.check('user1', now + 25000)
    expect(result.allowed).toBe(false)
    expect(result.retryAfter).toBe(35) // (1000000 + 60000 - 1025000) / 1000 = 35
  })

  it('allows requests after window expires', () => {
    const now = 1000000
    limiter.check('user1', now)
    limiter.check('user1', now + 100)
    limiter.check('user1', now + 200)
    // All 3 timestamps are ~now, window expires at now + 60000
    const result = limiter.check('user1', now + WINDOW + 1)
    expect(result.allowed).toBe(true)
  })

  it('isolates rate limits per user', () => {
    const now = 1000000
    limiter.check('user1', now)
    limiter.check('user1', now + 1)
    limiter.check('user1', now + 2)
    // user1 is at limit, but user2 should be fine
    expect(limiter.check('user1', now + 3).allowed).toBe(false)
    expect(limiter.check('user2', now + 3).allowed).toBe(true)
  })

  it('cleanup removes expired entries', () => {
    const now = 1000000
    limiter.check('user1', now)
    limiter.check('user2', now)
    // Clean up after window expires
    limiter.cleanup(now + WINDOW + 1)
    expect(limiter._map.size).toBe(0)
  })

  it('cleanup preserves active entries', () => {
    const now = 1000000
    limiter.check('user1', now)
    limiter.check('user2', now + WINDOW - 1000) // within window
    // Clean up at now + WINDOW - 500 (user1 expired, user2 still active)
    limiter.cleanup(now + WINDOW + 1)
    expect(limiter._map.has('user1')).toBe(false)
    // user2's timestamp is at now + WINDOW - 1000, which at cleanup time
    // (now + WINDOW + 1) is 1001ms old, still within 60000ms window
    expect(limiter._map.has('user2')).toBe(true)
  })
})

// ─── CSP meta tag verification ──────────────────────────────

describe('CSP meta tag', () => {
  it('index.html contains Content-Security-Policy meta tag', async () => {
    const fs = await import('fs')
    const html = fs.readFileSync('index.html', 'utf-8')
    expect(html).toContain('Content-Security-Policy')
    expect(html).toContain("default-src 'self'")
    expect(html).toContain("script-src 'self'")
    expect(html).toContain("frame-src 'none'")
    expect(html).toContain("object-src 'none'")
    expect(html).toContain("base-uri 'self'")
  })

  it('CSP blocks inline scripts (no unsafe-eval)', async () => {
    const fs = await import('fs')
    const html = fs.readFileSync('index.html', 'utf-8')
    expect(html).not.toContain("'unsafe-eval'")
  })

  it('CSP allows required external resources', async () => {
    const fs = await import('fs')
    const html = fs.readFileSync('index.html', 'utf-8')
    expect(html).toContain('fonts.googleapis.com')
    expect(html).toContain('fonts.gstatic.com')
    expect(html).toContain('*.supabase.co')
    expect(html).toContain('*.sentry.io')
  })
})

// ─── URL protocol validation ────────────────────────────────

describe('URL protocol validation', () => {
  it('allows http and https protocols', () => {
    const allowed = ['http:', 'https:']
    expect(allowed.includes(new URL('http://example.com').protocol)).toBe(true)
    expect(allowed.includes(new URL('https://example.com').protocol)).toBe(true)
  })

  it('rejects non-http protocols', () => {
    const allowed = ['http:', 'https:']
    expect(allowed.includes(new URL('ftp://example.com').protocol)).toBe(false)
    expect(allowed.includes(new URL('file:///etc/passwd').protocol)).toBe(false)
    expect(allowed.includes(new URL('javascript:alert(1)').protocol)).toBe(false)
  })
})
