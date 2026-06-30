import { describe, it, expect, afterEach } from 'vitest'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  DEFAULT_BUDGET,
  isInsideRepo,
  computeNoProgress,
  decideExit,
  loadState,
  saveState,
  type LoopState,
  type VerifyOutcome,
} from './engineering-loop.js'

const RED: VerifyOutcome = { ok: false, failingStep: 'tsc', output: 'boom' }
const GREEN: VerifyOutcome = { ok: true, failingStep: null, output: '' }
function state(over: Partial<LoopState> = {}): LoopState {
  return { iteration: 0, applied: [], noProgress: 0, lastFailingStep: null, lastLesson: null, startedAt: 0, ...over }
}

const tmps: string[] = []
afterEach(() => { for (const d of tmps) rmSync(d, { recursive: true, force: true }) })
function tmpRepo(): string { const d = mkdtempSync(join(tmpdir(), 'kbot-loop-')); tmps.push(d); return d }

describe('isInsideRepo', () => {
  it('accepts a file inside the repo', () => { expect(isInsideRepo('/repo', 'src/a.ts')).toBe(true) })
  it('rejects parent-escape and absolute escape', () => {
    expect(isInsideRepo('/repo', '../etc/passwd')).toBe(false)
    expect(isInsideRepo('/repo', '/etc/passwd')).toBe(false)
  })
})

describe('computeNoProgress', () => {
  it('resets to 0 when verify turns green', () => {
    expect(computeNoProgress({ noProgress: 2, lastFailingStep: 'tsc', lastLesson: 'x' }, GREEN, null)).toBe(0)
  })
  it('increments when the same step stays red', () => {
    expect(computeNoProgress({ noProgress: 1, lastFailingStep: 'tsc', lastLesson: null }, RED, null)).toBe(2)
  })
  it('resets when the failing step changes (progress)', () => {
    expect(computeNoProgress({ noProgress: 1, lastFailingStep: 'tsc', lastLesson: null }, { ok: false, failingStep: 'vitest', output: '' }, null)).toBe(0)
  })
})

describe('decideExit', () => {
  it('success when green and no findings remain', () => {
    expect(decideExit({ state: state(), verify: GREEN, remainingFindings: 0, budget: DEFAULT_BUDGET, elapsedMs: 0 }).exit).toBe('success')
  })
  it('handback when noProgress hits the cap', () => {
    expect(decideExit({ state: state({ noProgress: 2 }), verify: RED, remainingFindings: 3, budget: DEFAULT_BUDGET, elapsedMs: 0 }).exit).toBe('handback')
  })
  it('budget when iterations exceed the cap', () => {
    expect(decideExit({ state: state({ iteration: 12 }), verify: RED, remainingFindings: 3, budget: DEFAULT_BUDGET, elapsedMs: 0 }).exit).toBe('budget')
  })
  it('continues otherwise', () => {
    expect(decideExit({ state: state({ iteration: 1 }), verify: RED, remainingFindings: 3, budget: DEFAULT_BUDGET, elapsedMs: 0 }).exit).toBeNull()
  })
})

describe('checkpoint', () => {
  it('round-trips state and returns null when absent', () => {
    const repo = tmpRepo()
    expect(loadState(repo)).toBeNull()
    const s = state({ iteration: 3, noProgress: 1 })
    saveState(repo, s)
    expect(existsSync(join(repo, '.kbot', 'engineering-loop.json'))).toBe(true)
    expect(loadState(repo)).toEqual(s)
  })
})
