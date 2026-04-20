// kbot growth — tests
// Run: npx tsx --test src/growth.test.ts
import { describe, it, beforeEach, afterEach } from 'vitest'
import assert from 'node:assert/strict'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { runGrowth } from './growth.js'

const DAY_MS = 24 * 60 * 60 * 1000
const NOW = Date.parse('2026-04-19T12:00:00Z')

let dataDir: string

// Silence stdout writes from runGrowth during tests (it prints to process.stdout).
const origWrite = process.stdout.write.bind(process.stdout)
let captured = ''
function silenceStdout() {
  captured = ''
  ;(process.stdout as { write: unknown }).write = (chunk: string | Uint8Array) => {
    captured += typeof chunk === 'string' ? chunk : chunk.toString()
    return true
  }
}
function restoreStdout() {
  process.stdout.write = origWrite
}

function writeObserver(events: Array<{ ts: string; tool: string; session?: string; error?: boolean; args?: Record<string, unknown> }>) {
  mkdirSync(join(dataDir, 'observer'), { recursive: true })
  const lines = events.map((e) => JSON.stringify(e)).join('\n')
  writeFileSync(join(dataDir, 'observer', 'session.jsonl'), lines + '\n')
}

function writeConfidence(entries: Array<{ task: string; predicted: number; actual: number; domain: string; timestamp: string }>) {
  writeFileSync(join(dataDir, 'confidence.json'), JSON.stringify({ entries }))
}

function writeSkills(skills: Record<string, { successCount: number; failureCount: number; totalConfidence: number; sampleSize: number; lastAttempt?: string }>) {
  writeFileSync(join(dataDir, 'skill-profile.json'), JSON.stringify({ skills }))
}

function daysAgo(n: number): string {
  return new Date(NOW - n * DAY_MS).toISOString()
}

beforeEach(() => {
  dataDir = join(tmpdir(), `kbot-growth-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(dataDir, { recursive: true })
  silenceStdout()
})

afterEach(() => {
  restoreStdout()
  try { rmSync(dataDir, { recursive: true, force: true }) } catch {}
})

describe('runGrowth — missing data', () => {
  it('returns null and renders "not enough data" guidance when no files exist', () => {
    const result = runGrowth({ dataDir, now: NOW })
    assert.equal(result, null)
    assert.match(captured, /Not enough data yet/)
    assert.match(captured, /kbot growth/)
  })

  it('does not crash when all files missing + json flag returns null summary', () => {
    const result = runGrowth({ dataDir, now: NOW, json: true })
    assert.equal(result, null)
    const parsed = JSON.parse(captured)
    assert.equal(parsed.summary, null)
    assert.deepEqual(parsed.metrics, [])
    assert.deepEqual(parsed.deltas, [])
  })
})

describe('runGrowth — only current window has data', () => {
  it('renders with prior=0 baselines when prior window is empty', () => {
    writeObserver([
      { ts: daysAgo(1), tool: 'read', session: 's1' },
      { ts: daysAgo(2), tool: 'bash', session: 's1' },
      { ts: daysAgo(3), tool: 'read', session: 's2', error: true },
    ])
    writeConfidence([])
    writeSkills({})
    const result = runGrowth({ dataDir, now: NOW, json: true })
    assert.ok(result)
    assert.equal(result.summary.toolCalls, 3)
    assert.equal(result.summary.sessions, 2)
    const priorMetric = result.metrics.find((m) => m.label === 'tool calls')!
    assert.equal(priorMetric.prior, 0)
    assert.equal(priorMetric.current, 3)
    // When prior blend is 0 but current > 0, betterPct should be 100
    assert.equal(result.summary.betterPct, 100)
  })
})

describe('runGrowth — identical windows', () => {
  it('headline shows 0% change when current == prior', () => {
    writeObserver([
      // Current window: 2 good calls, 1 error = 2/3 success
      { ts: daysAgo(1), tool: 'read', session: 's1' },
      { ts: daysAgo(2), tool: 'bash', session: 's1' },
      { ts: daysAgo(3), tool: 'read', session: 's2', error: true },
      // Prior window: same pattern
      { ts: daysAgo(8), tool: 'read', session: 's3' },
      { ts: daysAgo(9), tool: 'bash', session: 's3' },
      { ts: daysAgo(10), tool: 'read', session: 's4', error: true },
    ])
    writeConfidence([])
    writeSkills({})
    const result = runGrowth({ dataDir, now: NOW, json: true })
    assert.ok(result)
    assert.equal(result.summary.betterPct, 0)
  })
})

describe('runGrowth — current > prior', () => {
  it('positive percentage in headline when current success rate beats prior', () => {
    writeObserver([
      // Current: all success (4/4)
      { ts: daysAgo(1), tool: 'read', session: 's1' },
      { ts: daysAgo(2), tool: 'bash', session: 's1' },
      { ts: daysAgo(3), tool: 'read', session: 's1' },
      { ts: daysAgo(4), tool: 'write', session: 's1' },
      // Prior: half error (2 good, 2 bad)
      { ts: daysAgo(8), tool: 'read', session: 's2', error: true },
      { ts: daysAgo(9), tool: 'bash', session: 's2', error: true },
      { ts: daysAgo(10), tool: 'read', session: 's2' },
      { ts: daysAgo(11), tool: 'write', session: 's2' },
    ])
    const result = runGrowth({ dataDir, now: NOW, json: true })
    assert.ok(result)
    assert.ok(result.summary.betterPct > 0, `expected positive betterPct, got ${result.summary.betterPct}`)
  })
})

describe('runGrowth — current < prior', () => {
  it('negative percentage in headline when current degrades vs prior', () => {
    writeObserver([
      // Current: half error
      { ts: daysAgo(1), tool: 'read', session: 's1', error: true },
      { ts: daysAgo(2), tool: 'bash', session: 's1', error: true },
      { ts: daysAgo(3), tool: 'read', session: 's1' },
      { ts: daysAgo(4), tool: 'write', session: 's1' },
      // Prior: all success
      { ts: daysAgo(8), tool: 'read', session: 's2' },
      { ts: daysAgo(9), tool: 'bash', session: 's2' },
      { ts: daysAgo(10), tool: 'read', session: 's2' },
      { ts: daysAgo(11), tool: 'write', session: 's2' },
    ])
    const result = runGrowth({ dataDir, now: NOW, json: true })
    assert.ok(result)
    assert.ok(result.summary.betterPct < 0, `expected negative betterPct, got ${result.summary.betterPct}`)
  })
})

describe('runGrowth — --json flag structure', () => {
  it('returns structured {summary, metrics, deltas, agents} object', () => {
    writeObserver([{ ts: daysAgo(1), tool: 'read', session: 's1' }])
    const result = runGrowth({ dataDir, now: NOW, json: true })
    assert.ok(result)
    assert.ok('summary' in result)
    assert.ok('metrics' in result)
    assert.ok('deltas' in result)
    assert.ok(Array.isArray(result.metrics))
    assert.ok(Array.isArray(result.deltas))
    // JSON output is valid JSON
    const parsed = JSON.parse(captured)
    assert.equal(typeof parsed.summary.betterPct, 'number')
    assert.equal(typeof parsed.summary.days, 'number')
  })
})

describe('runGrowth — --days 30 partitioning', () => {
  it('correctly partitions 60 days of synthetic data into current/prior 30d windows', () => {
    // 60 days: days 1-30 are current, days 31-60 are prior
    const events: Array<{ ts: string; tool: string; session: string }> = []
    for (let i = 1; i <= 30; i++) events.push({ ts: daysAgo(i), tool: 'read', session: `curr-${i}` })
    for (let i = 31; i <= 60; i++) events.push({ ts: daysAgo(i), tool: 'bash', session: `prior-${i}` })
    writeObserver(events)
    const result = runGrowth({ dataDir, now: NOW, days: 30, json: true })
    assert.ok(result)
    assert.equal(result.summary.days, 30)
    assert.equal(result.summary.toolCalls, 30)
    assert.equal(result.summary.sessions, 30)
    const toolCallsMetric = result.metrics.find((m) => m.label === 'tool calls')!
    assert.equal(toolCallsMetric.current, 30)
    assert.equal(toolCallsMetric.prior, 30)
  })
})

describe('runGrowth — top-5 tools delta sort', () => {
  it('sorts top tools by largest absolute change, not just positive', () => {
    // "dropped" tool: 20 prior, 0 current → delta -20 (biggest absolute)
    // "rising" tool: 0 prior, 15 current → delta +15
    // "steady" tool: 5 prior, 5 current → delta 0
    // "minor": 0 prior, 2 current → delta +2
    const events: Array<{ ts: string; tool: string; session: string }> = []
    for (let i = 0; i < 20; i++) events.push({ ts: daysAgo(8 + (i % 6)), tool: 'dropped', session: 'p' })
    for (let i = 0; i < 15; i++) events.push({ ts: daysAgo(1 + (i % 6)), tool: 'rising', session: 'c' })
    for (let i = 0; i < 5; i++) events.push({ ts: daysAgo(1 + i), tool: 'steady', session: 'c' })
    for (let i = 0; i < 5; i++) events.push({ ts: daysAgo(8 + i), tool: 'steady', session: 'p' })
    for (let i = 0; i < 2; i++) events.push({ ts: daysAgo(1 + i), tool: 'minor', session: 'c' })
    writeObserver(events)
    const result = runGrowth({ dataDir, now: NOW, json: true })
    assert.ok(result)
    // First entry should be "dropped" (abs delta 20), second "rising" (abs 15)
    assert.equal(result.deltas[0].tool, 'dropped')
    assert.equal(result.deltas[0].delta, -20)
    assert.equal(result.deltas[1].tool, 'rising')
    assert.equal(result.deltas[1].delta, 15)
    // Sorted purely by abs delta descending
    for (let i = 1; i < result.deltas.length; i++) {
      assert.ok(
        Math.abs(result.deltas[i - 1].delta) >= Math.abs(result.deltas[i].delta),
        `deltas not sorted by abs: ${JSON.stringify(result.deltas)}`,
      )
    }
    assert.ok(result.deltas.length <= 5, 'top-5 cap')
  })
})

describe('runGrowth — routing accuracy', () => {
  it('computes accuracy correctly from mocked confidence.json', () => {
    // 4 entries current window: 3 within 0.2 tolerance (hits), 1 miss → 75%
    writeConfidence([
      { task: 't1', predicted: 0.8, actual: 0.75, domain: 'coder', timestamp: daysAgo(1) },
      { task: 't2', predicted: 0.5, actual: 0.5, domain: 'coder', timestamp: daysAgo(2) },
      { task: 't3', predicted: 0.6, actual: 0.7, domain: 'researcher', timestamp: daysAgo(3) },
      { task: 't4', predicted: 0.9, actual: 0.2, domain: 'writer', timestamp: daysAgo(4) }, // miss: diff 0.7
    ])
    // Need at least something else so we don't hit the "not enough data" branch short-circuit
    writeObserver([{ ts: daysAgo(1), tool: 'read', session: 's1' }])
    const result = runGrowth({ dataDir, now: NOW, json: true })
    assert.ok(result)
    assert.equal(result.summary.routingAccuracy, 0.75)
    // Per-domain breakdown
    const coder = result.agents.find((a) => a.agent === 'coder')
    assert.ok(coder)
    assert.equal(coder.samples, 2)
    assert.equal(coder.accuracy, 1.0)
    const writer = result.agents.find((a) => a.agent === 'writer')
    assert.ok(writer)
    assert.equal(writer.accuracy, 0)
  })
})
