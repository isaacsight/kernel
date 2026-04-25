// Critic Gate Tests — Node's built-in test runner (tsx --test)
// HOME is redirected before dynamic import so auth.ts's module-level
// KBOT_DIR (from homedir()) points at an empty dir — loadConfig() returns
// null, letting us test the "no provider" branch without real keys.
import { describe, it, afterAll as after, beforeEach, afterEach } from 'vitest'
import assert from 'node:assert/strict'
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const TEST_HOME = join(tmpdir(), 'kbot-critic-gate-test-home-' + Date.now())
mkdirSync(TEST_HOME, { recursive: true })
process.env.HOME = TEST_HOME
process.env.USERPROFILE = TEST_HOME

const { gateToolResult } = await import('./critic-gate.js')

// ── Helpers ──────────────────────────────────────────────────────────
const stubLLM = (r: string) => async () => r
const throwingLLM = (e: Error) => async () => { throw e }
function countingStub(r: string) {
  let n = 0
  return { fn: async () => { n++; return r }, calls: () => n }
}
const savedEnv = { ...process.env }

beforeEach(() => { delete process.env.KBOT_NO_CRITIC })
afterEach(() => {
  const h = process.env.HOME, u = process.env.USERPROFILE
  for (const k of Object.keys(process.env)) if (!(k in savedEnv)) delete process.env[k]
  for (const [k, v] of Object.entries(savedEnv)) process.env[k] = v
  process.env.HOME = h
  if (u !== undefined) process.env.USERPROFILE = u
})
after(() => { try { rmSync(TEST_HOME, { recursive: true, force: true }) } catch {} })

// ── 1. Fast path — trusted tools auto-accept without LLM ─────────────
describe('Critic Gate — fast path (trusted tools)', () => {
  it('auto-accepts read without calling LLM', async () => {
    const s = countingStub('{"accept":false,"confidence":1}')
    const v = await gateToolResult('read', { path: '/tmp/foo' }, 'file contents', { llmClient: s.fn })
    assert.equal(v.accept, true)
    assert.equal(s.calls(), 0, 'LLM must not be called')
    assert.match(v.reason || '', /trivial-valid/)
  })

  it('auto-accepts kbot_read without LLM call', async () => {
    const s = countingStub('{"accept":false,"confidence":1}')
    const v = await gateToolResult('kbot_read', { path: '/tmp/foo' }, 'bytes', { llmClient: s.fn })
    assert.equal(v.accept, true)
    assert.equal(s.calls(), 0)
  })

  it('auto-accepts grep and glob on valid output', async () => {
    const s = countingStub('{"accept":false,"confidence":1}')
    const v1 = await gateToolResult('grep', { pattern: 'f' }, 'l1\nl2', { llmClient: s.fn })
    const v2 = await gateToolResult('glob', { pattern: '*' }, 'a.ts\nb.ts', { llmClient: s.fn })
    assert.equal(v1.accept, true)
    assert.equal(v2.accept, true)
    assert.equal(s.calls(), 0)
  })
})

// ── 2. Fast path — empty result auto-rejects without LLM ─────────────
describe('Critic Gate — fast path (empty result)', () => {
  it('auto-rejects empty string without calling LLM', async () => {
    const s = countingStub('{"accept":true,"confidence":1}')
    const v = await gateToolResult('web_search', { query: 'q' }, '', { llmClient: s.fn })
    assert.equal(v.accept, false)
    assert.equal(s.calls(), 0)
    assert.ok(v.retry_hint, 'retry_hint should be present on reject')
  })

  it('auto-rejects whitespace-only result without LLM', async () => {
    const s = countingStub('{"accept":true,"confidence":1}')
    const v = await gateToolResult('bash', { command: 'true' }, '   \n\t  ', { llmClient: s.fn })
    assert.equal(v.accept, false)
    assert.equal(s.calls(), 0)
  })
})

// ── 3. Fast path — size ──────────────────────────────────────────────
describe('Critic Gate — fast path (size)', () => {
  it('auto-accepts trusted valid result under 10KB', async () => {
    const s = countingStub('{"accept":false,"confidence":1}')
    const v = await gateToolResult('read', { path: '/x' }, 'x'.repeat(5000), { llmClient: s.fn })
    assert.equal(v.accept, true)
    assert.equal(s.calls(), 0)
  })

  it('falls through to LLM for large trusted result over 10KB', async () => {
    const s = countingStub('{"accept":true,"confidence":0.8,"reason":"ok"}')
    const v = await gateToolResult('read', { path: '/x' }, 'x'.repeat(15_000), { llmClient: s.fn })
    assert.equal(v.accept, true)
    assert.equal(s.calls(), 1, 'large result bypasses fast path')
  })
})

// ── 4. KBOT_NO_CRITIC=1 short-circuits ──────────────────────────────
describe('Critic Gate — KBOT_NO_CRITIC env', () => {
  it('always accepts when KBOT_NO_CRITIC=1', async () => {
    process.env.KBOT_NO_CRITIC = '1'
    const s = countingStub('{"accept":false,"confidence":1}')
    const v = await gateToolResult('web_search', { query: 'q' }, '', { llmClient: s.fn })
    assert.equal(v.accept, true)
    assert.equal(v.confidence, 1)
    assert.equal(s.calls(), 0)
    assert.match(v.reason || '', /disabled/)
  })

  it('runs normally when KBOT_NO_CRITIC is unset', async () => {
    delete process.env.KBOT_NO_CRITIC
    const v = await gateToolResult('web_search', { query: 'q' }, '', {
      llmClient: stubLLM('{"accept":true,"confidence":1}'),
    })
    assert.equal(v.accept, false, 'empty result should still reject')
  })
})

// ── 5. Strictness 0.0 ────────────────────────────────────────────────
describe('Critic Gate — strictness 0.0', () => {
  it('soft-accepts a low-confidence reject', async () => {
    const v = await gateToolResult('web_search', { query: 'q' }, 'some output', {
      strictness: 0.0,
      llmClient: stubLLM('{"accept":false,"confidence":0.5,"reason":"shaky"}'),
    })
    assert.equal(v.accept, true)
    assert.match(v.reason || '', /soft-accept/)
  })

  it('accepts a clear accept verdict as-is', async () => {
    const v = await gateToolResult('web_search', { query: 'q' }, 'some output', {
      strictness: 0.0,
      llmClient: stubLLM('{"accept":true,"confidence":0.95,"reason":"ok"}'),
    })
    assert.equal(v.accept, true)
    assert.equal(v.confidence, 0.95)
  })
})

// ── 6. Strictness 1.0 ────────────────────────────────────────────────
describe('Critic Gate — strictness 1.0', () => {
  it('flips low-confidence accept to reject', async () => {
    const v = await gateToolResult('web_search', { query: 'q' }, 'some output', {
      strictness: 1.0,
      llmClient: stubLLM('{"accept":true,"confidence":0.2,"reason":"unsure"}'),
    })
    assert.equal(v.accept, false)
    assert.match(v.reason || '', /strict mode/)
    assert.ok(v.retry_hint, 'strict-flip should surface retry_hint')
  })

  it('keeps high-confidence accept', async () => {
    const v = await gateToolResult('web_search', { query: 'q' }, 'some output', {
      strictness: 1.0,
      llmClient: stubLLM('{"accept":true,"confidence":0.9,"reason":"great"}'),
    })
    assert.equal(v.accept, true)
  })

  it('honors a confident reject', async () => {
    const v = await gateToolResult('web_search', { query: 'q' }, 'some output', {
      strictness: 1.0,
      llmClient: stubLLM('{"accept":false,"confidence":0.95,"reason":"bad","retry_hint":"try harder"}'),
    })
    assert.equal(v.accept, false)
    assert.equal(v.retry_hint, 'try harder')
  })
})

// ── 7. Malformed LLM output ──────────────────────────────────────────
describe('Critic Gate — malformed LLM output', () => {
  it('soft-accepts with warning on non-JSON', async () => {
    const v = await gateToolResult('web_search', { query: 'q' }, 'out', {
      llmClient: stubLLM('I am a helpful assistant!'),
    })
    assert.equal(v.accept, true, 'must not block agent')
    assert.ok(v.confidence <= 0.5)
    assert.match(v.reason || '', /unparseable/)
  })

  it('soft-accepts on empty LLM string', async () => {
    const v = await gateToolResult('web_search', { query: 'q' }, 'out', { llmClient: stubLLM('') })
    assert.equal(v.accept, true)
    assert.match(v.reason || '', /unparseable/)
  })

  it('extracts JSON from prose wrapping', async () => {
    const v = await gateToolResult('web_search', { query: 'q' }, 'out', {
      llmClient: stubLLM('Sure:\n```json\n{"accept":true,"confidence":0.9}\n```'),
    })
    assert.equal(v.accept, true)
    assert.equal(v.confidence, 0.9)
  })
})

// ── 8. Network / LLM call failure ────────────────────────────────────
describe('Critic Gate — LLM call failure', () => {
  it('soft-accepts on network timeout', async () => {
    const v = await gateToolResult('web_search', { query: 'q' }, 'out', {
      llmClient: throwingLLM(new Error('request timeout')),
    })
    assert.equal(v.accept, true, 'never block agent on critic failure')
    assert.ok(v.confidence <= 0.3)
    assert.match(v.reason || '', /failed/)
  })

  it('soft-accepts on HTTP 500-style error', async () => {
    const v = await gateToolResult('web_search', { query: 'q' }, 'out', {
      llmClient: throwingLLM(new Error('critic HTTP 500')),
    })
    assert.equal(v.accept, true)
  })
})

// ── 9. Missing provider config ───────────────────────────────────────
describe('Critic Gate — missing provider', () => {
  it('soft-accepts when no provider is configured and no llmClient passed', async () => {
    // HOME redirected at module top → loadConfig() returns null
    // → resolveCriticProvider defaults to anthropic with no byok_key → null.
    const v = await gateToolResult('web_search', { query: 'q' }, 'out', {})
    assert.equal(v.accept, true)
    assert.match(v.reason || '', /no critic provider/)
    assert.ok(v.confidence <= 0.5)
  })
})

// ── 10. Retry hint surfaced on reject ────────────────────────────────
describe('Critic Gate — retry hint on reject', () => {
  it('surfaces retry_hint from LLM verdict', async () => {
    const v = await gateToolResult('web_search', { query: 'q' }, 'out', {
      strictness: 0.5,
      llmClient: stubLLM(
        '{"accept":false,"confidence":0.9,"reason":"bad","retry_hint":"narrow query to 2023"}',
      ),
    })
    assert.equal(v.accept, false)
    assert.equal(v.retry_hint, 'narrow query to 2023')
  })

  it('surfaces retry_hint on empty-result auto-reject', async () => {
    const v = await gateToolResult('web_search', { query: 'q' }, '', {})
    assert.equal(v.accept, false)
    assert.ok(v.retry_hint)
    assert.match(v.retry_hint!, /try/i)
  })

  it('surfaces retry_hint when strict-mode flips accept to reject', async () => {
    const v = await gateToolResult('web_search', { query: 'q' }, 'out', {
      strictness: 1.0,
      llmClient: stubLLM('{"accept":true,"confidence":0.1,"retry_hint":"verify shape"}'),
    })
    assert.equal(v.accept, false)
    assert.equal(v.retry_hint, 'verify shape')
  })
})

// ── Verdict log + stats ──────────────────────────────────────────────
describe('Critic Gate — verdict log + getCriticStats', () => {
  it('logs LLM verdicts and aggregates stats', async () => {
    const { getCriticStats } = await import('./critic-gate.js')
    // Mix: two accepts, two rejects
    await gateToolResult('web_search', { query: 'a' }, 'output', {
      llmClient: stubLLM('{"accept":true,"confidence":0.9}'),
    })
    await gateToolResult('web_search', { query: 'b' }, 'output', {
      llmClient: stubLLM('{"accept":true,"confidence":0.85}'),
    })
    await gateToolResult('web_search', { query: 'c' }, 'output', {
      llmClient: stubLLM('{"accept":false,"confidence":0.95,"reason":"fabricated url"}'),
    })
    await gateToolResult('web_search', { query: 'd' }, 'output', {
      llmClient: stubLLM('{"accept":false,"confidence":0.95,"reason":"fabricated url"}'),
    })
    const s = getCriticStats()
    assert.ok(s.total >= 4, `total ${s.total} should be >= 4`)
    assert.ok(s.accepted >= 2)
    assert.ok(s.rejected >= 2)
    assert.ok(s.byPath.llm >= 4)
    const fabricated = s.topRejectReasons.find(r => /fabricated url/.test(r.reason))
    assert.ok(fabricated, 'fabricated-url reason should appear in topRejectReasons')
    assert.ok(fabricated.count >= 2, `expected count >= 2, got ${fabricated.count}`)
  })

  it('records taxonomy-path rejects with failure_class', async () => {
    const { getCriticStats } = await import('./critic-gate.js')
    // Use a result that the taxonomy classifier will hit with high confidence.
    // Empty result on a non-trusted tool short-circuits to a reject (the
    // 'empty/trivial' RF class). We rely on the existing fast-reject for this.
    await gateToolResult('web_search', { query: 'x' }, '', { llmClient: stubLLM('{"accept":true}') })
    const s = getCriticStats()
    // At least one taxonomy entry should be present (we don't pin the class
    // since the taxonomy classifier may evolve).
    const taxonomyEntries = s.byPath.taxonomy
    assert.ok(taxonomyEntries >= 1, `taxonomy entries: ${taxonomyEntries}`)
  })

  it('respects critic_log_enabled=false', async () => {
    const { getCriticStats } = await import('./critic-gate.js')
    const { writeFileSync, mkdirSync } = await import('node:fs')
    const { join } = await import('node:path')
    const cfgDir = join(process.env.HOME!, '.kbot')
    mkdirSync(cfgDir, { recursive: true })
    writeFileSync(join(cfgDir, 'config.json'), JSON.stringify({ critic_log_enabled: false }))
    const before = getCriticStats().total
    await gateToolResult('web_search', { query: 'no-log' }, 'out', {
      llmClient: stubLLM('{"accept":true,"confidence":0.9}'),
    })
    const after = getCriticStats().total
    assert.equal(after, before, 'log should not grow when critic_log_enabled is false')
    // Restore
    writeFileSync(join(cfgDir, 'config.json'), JSON.stringify({}))
  })
})
