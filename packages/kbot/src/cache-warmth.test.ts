// Tests for cache-warmth — Anthropic prompt cache TTL detection
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  checkCacheWarmth,
  recordCacheCall,
  hashPrompt,
  CACHE_TTL_MS,
  _resetCacheWarmthCache,
} from './cache-warmth.js'

let tmpDir: string
const PROMPT_A = 'You are kbot. Be helpful.'
const PROMPT_B = 'You are a different agent.'
const HASH_A = hashPrompt(PROMPT_A)
const HASH_B = hashPrompt(PROMPT_B)
const MODEL = 'claude-sonnet-4-6'
const MODEL_2 = 'claude-opus-4-7'
const COST = 3.0           // USD per Mtok
const TOKENS = 50_000      // rough system-prompt size

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'kbot-cache-warmth-'))
  process.env.KBOT_CACHE_WARMTH_PATH = join(tmpDir, 'state.json')
  delete process.env.KBOT_CACHE_WARMTH_WARN
  _resetCacheWarmthCache()
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
  delete process.env.KBOT_CACHE_WARMTH_PATH
  delete process.env.KBOT_CACHE_WARMTH_WARN
  _resetCacheWarmthCache()
})

describe('checkCacheWarmth', () => {
  it('fresh state → no warning, records call', () => {
    const now = 1_000_000
    const result = checkCacheWarmth(MODEL, HASH_A, COST, TOKENS, now)
    expect(result.warm).toBe(true)
    expect(result.message).toBeUndefined()

    recordCacheCall(MODEL, HASH_A, now)
    expect(existsSync(process.env.KBOT_CACHE_WARMTH_PATH!)).toBe(true)
    const persisted = JSON.parse(readFileSync(process.env.KBOT_CACHE_WARMTH_PATH!, 'utf8'))
    expect(persisted.lastCall[`${MODEL}::${HASH_A}`]).toBe(now)
  })

  it('same prompt within TTL → warm, no warning', () => {
    const t0 = 1_000_000
    recordCacheCall(MODEL, HASH_A, t0)
    _resetCacheWarmthCache()

    // 4 minutes later — still within 5m TTL
    const t1 = t0 + 4 * 60 * 1000
    const result = checkCacheWarmth(MODEL, HASH_A, COST, TOKENS, t1)
    expect(result.warm).toBe(true)
    expect(result.message).toBeUndefined()
    expect(result.ageMs).toBe(4 * 60 * 1000)
  })

  it('same prompt after TTL → warning with correct ageMs and cost', () => {
    const t0 = 1_000_000
    recordCacheCall(MODEL, HASH_A, t0)
    _resetCacheWarmthCache()

    // 7m 12s later — cold
    const ageMs = 7 * 60 * 1000 + 12 * 1000
    const t1 = t0 + ageMs
    const result = checkCacheWarmth(MODEL, HASH_A, COST, TOKENS, t1)

    expect(result.warm).toBe(false)
    expect(result.ageMs).toBe(ageMs)
    // Expected extra cost: 3.0 * 50000 / 1_000_000 = $0.15
    expect(result.estimatedExtraCostUSD).toBeCloseTo(0.15, 4)
    expect(result.message).toBeDefined()
    // chalk wraps in ANSI codes; strip for content checks
    const plain = result.message!.replace(/\x1b\[[0-9;]*m/g, '')
    expect(plain).toContain('[kbot]')
    expect(plain).toContain('Anthropic prompt cache likely cold')
    expect(plain).toContain('7m 12s')
    expect(plain).toContain('TTL is 5m')
    expect(plain).toContain('$0.15')
    expect(plain).toContain('kbot doctor cache')
  })

  it('warns once per cold-event, not on every subsequent cold call', () => {
    const t0 = 1_000_000
    recordCacheCall(MODEL, HASH_A, t0)
    _resetCacheWarmthCache()

    const t1 = t0 + 6 * 60 * 1000
    const first = checkCacheWarmth(MODEL, HASH_A, COST, TOKENS, t1)
    expect(first.warm).toBe(false)
    expect(first.message).toBeDefined()

    // Second check immediately after — same cold-event, should NOT warn again
    const second = checkCacheWarmth(MODEL, HASH_A, COST, TOKENS, t1 + 1000)
    expect(second.warm).toBe(false)
    expect(second.message).toBeUndefined()
  })

  it('different prompt after TTL → warns for new prompt independently', () => {
    const t0 = 1_000_000
    recordCacheCall(MODEL, HASH_A, t0)
    recordCacheCall(MODEL, HASH_B, t0)
    _resetCacheWarmthCache()

    const t1 = t0 + 6 * 60 * 1000
    const a = checkCacheWarmth(MODEL, HASH_A, COST, TOKENS, t1)
    const b = checkCacheWarmth(MODEL, HASH_B, COST, TOKENS, t1)
    expect(a.warm).toBe(false)
    expect(a.message).toBeDefined()
    expect(b.warm).toBe(false)
    expect(b.message).toBeDefined()
  })

  it('different model after TTL → warning per (model, prompt) tuple', () => {
    const t0 = 1_000_000
    recordCacheCall(MODEL, HASH_A, t0)
    recordCacheCall(MODEL_2, HASH_A, t0)
    _resetCacheWarmthCache()

    const t1 = t0 + 6 * 60 * 1000
    const r1 = checkCacheWarmth(MODEL, HASH_A, COST, TOKENS, t1)
    const r2 = checkCacheWarmth(MODEL_2, HASH_A, COST, TOKENS, t1)
    expect(r1.warm).toBe(false)
    expect(r1.message).toBeDefined()
    expect(r2.warm).toBe(false)
    expect(r2.message).toBeDefined()
  })

  it('disabled by env → never warns even when cold', () => {
    const t0 = 1_000_000
    recordCacheCall(MODEL, HASH_A, t0)
    _resetCacheWarmthCache()
    process.env.KBOT_CACHE_WARMTH_WARN = 'off'

    const t1 = t0 + 30 * 60 * 1000 // 30 min cold
    const result = checkCacheWarmth(MODEL, HASH_A, COST, TOKENS, t1)
    expect(result.warm).toBe(true)
    expect(result.message).toBeUndefined()
  })

  it('re-warms after a successful call: no warning on the next within-TTL call', () => {
    const t0 = 1_000_000
    recordCacheCall(MODEL, HASH_A, t0)
    _resetCacheWarmthCache()

    const t1 = t0 + 6 * 60 * 1000
    const cold = checkCacheWarmth(MODEL, HASH_A, COST, TOKENS, t1)
    expect(cold.warm).toBe(false)
    expect(cold.message).toBeDefined()

    // Record the cold call as new warm timestamp
    recordCacheCall(MODEL, HASH_A, t1)
    _resetCacheWarmthCache()

    const t2 = t1 + 60 * 1000 // 1 min later
    const warm = checkCacheWarmth(MODEL, HASH_A, COST, TOKENS, t2)
    expect(warm.warm).toBe(true)
    expect(warm.message).toBeUndefined()
  })

  it('CACHE_TTL_MS is exported and equals 5 minutes', () => {
    expect(CACHE_TTL_MS).toBe(5 * 60 * 1000)
  })
})
