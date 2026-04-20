import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import {
  classifyToolResult,
  detectRepetition,
} from './critic-taxonomy.js'

describe('critic-taxonomy — single-result classification', () => {
  it('returns null on a clean, factual result', () => {
    assert.equal(classifyToolResult('{"status":"ok","count":42}'), null)
  })

  it('RF-08 on empty result', () => {
    const r = classifyToolResult('')
    assert.ok(r)
    assert.equal(r!.class, 'RF-08-evidential-insufficiency')
  })

  it('RF-08 on tiny non-numeric result', () => {
    const r = classifyToolResult('ok')
    assert.ok(r)
    assert.equal(r!.class, 'RF-08-evidential-insufficiency')
  })

  it('RF-10 when success claim contradicts an error marker', () => {
    const r = classifyToolResult('Operation completed successfully. ENOENT: no such file')
    assert.ok(r)
    assert.equal(r!.class, 'RF-10-simulation-role-confusion')
  })

  it('RF-01 on fabrication-style hedging', () => {
    const r = classifyToolResult('As an AI, I cannot actually read that file, but let\'s assume it exists.')
    assert.ok(r)
    assert.equal(r!.class, 'RF-01-fabricated-evidence')
  })

  it('RF-11 when multiple speculation markers appear', () => {
    const r = classifyToolResult('I think it might be the config file, probably near the top.')
    assert.ok(r)
    assert.equal(r!.class, 'RF-11-excessive-speculation')
  })

  it('one speculation marker alone does not trip RF-11', () => {
    const r = classifyToolResult('This is probably the right file based on the pattern match.')
    // "probably" alone — no RF-11. Other classes might still fire, but not this one.
    if (r) assert.notEqual(r.class, 'RF-11-excessive-speculation')
  })
})

describe('critic-taxonomy — trajectory-level detectors', () => {
  const mkStep = (tool: string, args: Record<string, unknown>) => ({
    tool,
    args,
    result: 'out',
    timestampMs: Date.now(),
  })

  it('RF-12 on three consecutive identical calls', () => {
    const traj = [
      mkStep('grep', { pattern: 'foo' }),
      mkStep('grep', { pattern: 'foo' }),
      mkStep('grep', { pattern: 'foo' }),
    ]
    const r = detectRepetition(traj, 3)
    assert.ok(r)
    assert.equal(r!.class, 'RF-12-repetition-failure-to-resume')
  })

  it('no RF-12 when args change', () => {
    const traj = [
      mkStep('grep', { pattern: 'foo' }),
      mkStep('grep', { pattern: 'bar' }),
      mkStep('grep', { pattern: 'baz' }),
    ]
    assert.equal(detectRepetition(traj, 3), null)
  })

  it('no RF-12 when trajectory shorter than window', () => {
    const traj = [mkStep('grep', { pattern: 'foo' })]
    assert.equal(detectRepetition(traj, 3), null)
  })
})
