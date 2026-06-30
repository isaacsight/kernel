# kbot Engineering Loop + Decision Narration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the analysis-only autonomous contributor into an unattended engineering loop that auto-applies fixes, verifies, reflects, and stops on success/budget/handback — narrating every decision as it goes.

**Architecture:** Two well-bounded units. Unit 2 (narration) extends `decision-journal.ts` with an `engineering-loop` decision type and a `narrateLoop()` formatter. Unit 1 (`engineering-loop.ts`) wires `runAutonomousContributor` (plan) → applier (act) → verify (observe) → `generateReflections` (reflect) → pure `decideExit` (decide), checkpointing each iteration. The loop logs decisions but never formats; the journal records but never drives control flow (one-way import).

**Tech Stack:** TypeScript (ESM, `.js` import extensions), Node built-ins (`node:fs`, `node:path`, `node:child_process`), Vitest.

## Global Constraints

- TypeScript strict mode — never disabled (`.claude/rules/security.md`).
- ESM imports use the `.js` extension (e.g. `from './reflection.js'`) — matches `agent.ts`.
- Vitest for tests; test files are `*.test.ts` next to source (`.claude/rules/testing.md`).
- No real repo clone, no network, no real build in tests — stub analyze/apply/verify; use a `node:os` tmp dir for checkpoint files.
- No emojis in code or copy (CLAUDE.md rule 4).
- Narration default sinks: `['journal', 'stdout']`. Discord is off by default.
- Budget defaults: `maxIterations: 12`, `maxWallClockMs: 1_200_000` (20 min), `maxNoProgress: 2`.

---

### Task 1: Narration substrate — extend `decision-journal.ts`

**Files:**
- Modify: `packages/kbot/src/decision-journal.ts` (DecisionType union ~line 31; add `narrateLoop` near `formatDecisions` ~line 243)
- Test: `packages/kbot/src/decision-journal.test.ts` (create)

**Interfaces:**
- Consumes: existing `Decision` interface, `DecisionType`, `formatDecisions` (unchanged).
- Produces: `'engineering-loop'` added to `DecisionType`; `narrateLoop(decisions: Decision[]): string`.

- [ ] **Step 1: Write the failing test**

Create `packages/kbot/src/decision-journal.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { narrateLoop, type Decision } from './decision-journal.js'

function loopDecision(over: Partial<Decision> & { iteration: number; phase: string }): Decision {
  return {
    timestamp: '2026-06-30T00:00:00.000Z',
    type: 'engineering-loop',
    decision: over.decision ?? 'do a thing',
    reasoning: over.reasoning ?? ['a reason'],
    alternatives: [],
    confidence: 0.7,
    evidence: { phase: over.phase, iteration: over.iteration },
    userContext: 'goal',
  }
}

describe('narrateLoop', () => {
  it('renders plan/act/decide in iteration order with the first reason', () => {
    const out = narrateLoop([
      loopDecision({ iteration: 1, phase: 'plan', decision: 'fix typo in a.ts', reasoning: ['tsc was red'] }),
      loopDecision({ iteration: 1, phase: 'act', decision: 'applied edit' }),
      loopDecision({ iteration: 1, phase: 'decide', decision: 'continue' }),
    ])
    expect(out).toContain('#1 plan → fix typo in a.ts (because tsc was red)')
    expect(out).toContain('#1 act → applied edit')
    expect(out).toContain('#1 decide → continue')
  })

  it('ignores non-loop decisions and tolerates an empty list', () => {
    expect(narrateLoop([])).toBe('(no engineering-loop decisions)')
    const other: Decision = { ...loopDecision({ iteration: 1, phase: 'plan' }), type: 'tool-choice' }
    expect(narrateLoop([other])).toBe('(no engineering-loop decisions)')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "/Users/isaachernandez/blog design" && npx vitest run packages/kbot/src/decision-journal.test.ts`
Expected: FAIL — `narrateLoop` is not exported, and `'engineering-loop'` is not an assignable `DecisionType`.

- [ ] **Step 3: Add the decision type**

In `packages/kbot/src/decision-journal.ts`, add one member to the `DecisionType` union (after `'confidence-override'`):

```ts
  | 'confidence-override'// Why the agent deferred or escalated
  | 'engineering-loop'   // Why the engineering loop chose/applied/stopped
```

- [ ] **Step 4: Implement `narrateLoop`**

Append to `packages/kbot/src/decision-journal.ts` (after `formatDecisions`):

```ts
/**
 * Render engineering-loop decisions as a human-readable running log.
 * Non-loop decisions are filtered out. Pure — does no IO.
 */
export function narrateLoop(decisions: Decision[]): string {
  const loop = decisions.filter((d) => d.type === 'engineering-loop')
  if (loop.length === 0) return '(no engineering-loop decisions)'
  return loop
    .map((d) => {
      const iteration = (d.evidence?.iteration as number | undefined) ?? '?'
      const phase = (d.evidence?.phase as string | undefined) ?? 'step'
      const why = d.reasoning.length > 0 ? ` (because ${d.reasoning[0]})` : ''
      return `#${iteration} ${phase} → ${d.decision}${why}`
    })
    .join('\n')
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd "/Users/isaachernandez/blog design" && npx vitest run packages/kbot/src/decision-journal.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Type-check and commit**

```bash
cd "/Users/isaachernandez/blog design"
npx tsc --noEmit -p packages/kbot/tsconfig.json
git add packages/kbot/src/decision-journal.ts packages/kbot/src/decision-journal.test.ts
git commit -m "feat(kbot): engineering-loop decision type + narrateLoop"
```
Expected: tsc clean; commit succeeds.

---

### Task 2: Loop core — types, pure decision helpers, checkpoint

**Files:**
- Create: `packages/kbot/src/engineering-loop.ts`
- Create: `packages/kbot/src/engineering-loop.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces (relied on by Tasks 3 & 4):
  - Types `LoopExit`, `NarrationSink`, `LoopBudget`, `VerifyOutcome`, `AppliedChange`, `LoopState`, `LoopResult`, `LoopDeps`, `LoopOptions`.
  - `DEFAULT_BUDGET: LoopBudget`.
  - `isInsideRepo(repoPath: string, targetFile: string): boolean`.
  - `computeNoProgress(prev: Pick<LoopState,'noProgress'|'lastFailingStep'|'lastLesson'>, verify: VerifyOutcome, lesson: string | null): number`.
  - `decideExit(args: { state: LoopState; verify: VerifyOutcome; remainingFindings: number; budget: LoopBudget; elapsedMs: number }): { exit: LoopExit | null; reason: string }`.
  - `checkpointPath(repoPath: string): string`, `loadState(repoPath: string): LoopState | null`, `saveState(repoPath: string, state: LoopState): void`.

- [ ] **Step 1: Write the failing test**

Create `packages/kbot/src/engineering-loop.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "/Users/isaachernandez/blog design" && npx vitest run packages/kbot/src/engineering-loop.test.ts`
Expected: FAIL — `./engineering-loop.js` does not exist.

- [ ] **Step 3: Write the core module**

Create `packages/kbot/src/engineering-loop.ts`:

```ts
// kbot Engineering Loop — plan → act → observe → reflect → decide, narrated.
// Core: types + pure decision helpers + checkpoint. Orchestrator added in Task 4.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname, resolve, relative, isAbsolute } from 'node:path'

export type LoopExit = 'success' | 'budget' | 'handback'
export type NarrationSink = 'journal' | 'stdout' | 'discord'

export interface LoopBudget {
  maxIterations: number
  maxWallClockMs: number
  maxNoProgress: number
}

export const DEFAULT_BUDGET: LoopBudget = {
  maxIterations: 12,
  maxWallClockMs: 1_200_000,
  maxNoProgress: 2,
}

export interface VerifyOutcome {
  ok: boolean
  failingStep: string | null
  output: string
}

export interface AppliedChange {
  file: string
  summary: string
  iteration: number
}

export interface LoopState {
  iteration: number
  applied: AppliedChange[]
  noProgress: number
  lastFailingStep: string | null
  lastLesson: string | null
  startedAt: number
}

export interface LoopResult {
  exit: LoopExit
  iterations: number
  applied: AppliedChange[]
  finalVerify: VerifyOutcome
  handbackSummary?: string
}

export interface LoopDeps {
  analyze: (repoPath: string) => Promise<import('./autonomous-contributor.js').ContributorFinding[]>
  applyFix: (repoPath: string, finding: import('./autonomous-contributor.js').ContributorFinding) => Promise<AppliedChange | null>
  verify: (repoPath: string) => Promise<VerifyOutcome>
  now: () => number
}

export interface LoopOptions {
  repoPath: string
  goal: string
  budget?: Partial<LoopBudget>
  autoApply?: boolean
  narrateTo?: NarrationSink[]
  deps?: Partial<LoopDeps>
}

/** True only when targetFile resolves to a path strictly inside repoPath. */
export function isInsideRepo(repoPath: string, targetFile: string): boolean {
  const root = resolve(repoPath)
  const target = resolve(root, targetFile)
  const rel = relative(root, target)
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
}

/**
 * No-progress counter. Resets to 0 on improvement (verify green, or the failing
 * step changed). Increments when the same step stays red or the lesson repeats.
 */
export function computeNoProgress(
  prev: Pick<LoopState, 'noProgress' | 'lastFailingStep' | 'lastLesson'>,
  verify: VerifyOutcome,
  lesson: string | null,
): number {
  const improved = verify.ok || (prev.lastFailingStep !== null && verify.failingStep !== prev.lastFailingStep)
  if (improved) return 0
  const sameStep = prev.lastFailingStep !== null && verify.failingStep === prev.lastFailingStep
  const sameLesson = lesson !== null && lesson === prev.lastLesson
  return sameStep || sameLesson ? prev.noProgress + 1 : prev.noProgress
}

/** Decide the exit for the current iteration, or null to continue. */
export function decideExit(args: {
  state: LoopState
  verify: VerifyOutcome
  remainingFindings: number
  budget: LoopBudget
  elapsedMs: number
}): { exit: LoopExit | null; reason: string } {
  const { state, verify, remainingFindings, budget, elapsedMs } = args
  if (verify.ok && remainingFindings === 0) return { exit: 'success', reason: 'verify green and no targeted findings remain' }
  if (state.noProgress >= budget.maxNoProgress) return { exit: 'handback', reason: `no progress for ${state.noProgress} iterations` }
  if (state.iteration >= budget.maxIterations) return { exit: 'budget', reason: `reached maxIterations ${budget.maxIterations}` }
  if (elapsedMs >= budget.maxWallClockMs) return { exit: 'budget', reason: `reached maxWallClockMs ${budget.maxWallClockMs}` }
  return { exit: null, reason: 'continue' }
}

export function checkpointPath(repoPath: string): string {
  return join(repoPath, '.kbot', 'engineering-loop.json')
}

export function loadState(repoPath: string): LoopState | null {
  const p = checkpointPath(repoPath)
  if (!existsSync(p)) return null
  try {
    return JSON.parse(readFileSync(p, 'utf-8')) as LoopState
  } catch {
    return null
  }
}

export function saveState(repoPath: string, state: LoopState): void {
  const p = checkpointPath(repoPath)
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, JSON.stringify(state, null, 2))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "/Users/isaachernandez/blog design" && npx vitest run packages/kbot/src/engineering-loop.test.ts`
Expected: PASS (all describe blocks).

- [ ] **Step 5: Type-check and commit**

```bash
cd "/Users/isaachernandez/blog design"
npx tsc --noEmit -p packages/kbot/tsconfig.json
git add packages/kbot/src/engineering-loop.ts packages/kbot/src/engineering-loop.test.ts
git commit -m "feat(kbot): engineering-loop core — types, decideExit, checkpoint"
```
Expected: tsc clean; commit succeeds.

---

### Task 3: Default deps — export typos, verify detection, fix applier

**Files:**
- Modify: `packages/kbot/src/autonomous-contributor.ts:483` (`const COMMON_TYPOS` → `export const COMMON_TYPOS`)
- Modify: `packages/kbot/src/engineering-loop.ts` (append default deps + helpers)
- Test: `packages/kbot/src/engineering-loop.test.ts` (append)

**Interfaces:**
- Consumes: `COMMON_TYPOS` (now exported), `runAutonomousContributor`, `ContributorFinding` from `autonomous-contributor.js`; `AppliedChange`, `VerifyOutcome`, `isInsideRepo` from Task 2.
- Produces: `rankFindings(findings): ContributorFinding[]`; `detectVerifyCommand(repoPath): { label: string; argv: string[] } | null`; `applyTypoFix(repoPath, finding): AppliedChange | null`; `defaultApplyFix(repoPath, finding): AppliedChange | null`; `defaultAnalyze(repoPath): Promise<ContributorFinding[]>`.

- [ ] **Step 1: Write the failing test (append to `engineering-loop.test.ts`)**

```ts
import { writeFileSync as wf, mkdirSync as md } from 'node:fs'
import {
  rankFindings,
  detectVerifyCommand,
  applyTypoFix,
} from './engineering-loop.js'
import type { ContributorFinding } from './autonomous-contributor.js'

function finding(over: Partial<ContributorFinding>): ContributorFinding {
  return { category: 'typo', severity: 'info', title: 't', description: 'd', file: 'a.ts', isSimpleFix: true, ...over }
}

describe('rankFindings', () => {
  it('orders critical first, then simple fixes', () => {
    const ranked = rankFindings([
      finding({ severity: 'info', isSimpleFix: false, title: 'info-complex' }),
      finding({ severity: 'critical', isSimpleFix: false, title: 'crit' }),
      finding({ severity: 'info', isSimpleFix: true, title: 'info-simple' }),
    ])
    expect(ranked.map((f) => f.title)).toEqual(['crit', 'info-simple', 'info-complex'])
  })
})

describe('detectVerifyCommand', () => {
  it('returns null when nothing is detectable', () => {
    const repo = tmpRepo()
    expect(detectVerifyCommand(repo)).toBeNull()
  })
  it('prefers a build script', () => {
    const repo = tmpRepo()
    wf(join(repo, 'package.json'), JSON.stringify({ scripts: { build: 'tsc', test: 'vitest' } }))
    expect(detectVerifyCommand(repo)).toEqual({ label: 'build', argv: ['npm', 'run', 'build'] })
  })
})

describe('applyTypoFix', () => {
  it('rewrites the typo on the finding line and returns the change', () => {
    const repo = tmpRepo()
    md(join(repo, 'src'), { recursive: true })
    wf(join(repo, 'src', 'a.ts'), 'const x = 1\n// teh value\nconst y = 2\n')
    const change = applyTypoFix(repo, finding({ category: 'typo', file: 'src/a.ts', line: 2 }))
    expect(change).not.toBeNull()
    expect(readFileSync(join(repo, 'src', 'a.ts'), 'utf-8')).toContain('// the value')
  })
  it('returns null for a non-typo finding', () => {
    const repo = tmpRepo()
    expect(applyTypoFix(repo, finding({ category: 'dead-code' }))).toBeNull()
  })
})
```

Add `readFileSync` to the existing `node:fs` import line at the top of the test file.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "/Users/isaachernandez/blog design" && npx vitest run packages/kbot/src/engineering-loop.test.ts`
Expected: FAIL — `rankFindings` / `detectVerifyCommand` / `applyTypoFix` not exported; `COMMON_TYPOS` not exported.

- [ ] **Step 3: Export the typo table**

In `packages/kbot/src/autonomous-contributor.ts` line 483:

```ts
export const COMMON_TYPOS: Array<[RegExp, string]> = [
```

- [ ] **Step 4: Append default deps to `engineering-loop.ts`**

Add imports at the top of `engineering-loop.ts`:

```ts
import { execSync } from 'node:child_process'
import {
  runAutonomousContributor,
  COMMON_TYPOS,
  type ContributorFinding,
  type FindingSeverity,
} from './autonomous-contributor.js'
```

Append:

```ts
const SEV_ORDER: Record<FindingSeverity, number> = { critical: 0, warn: 1, info: 2 }

/** Severity first (critical→info), then simple fixes before complex ones. */
export function rankFindings(findings: ContributorFinding[]): ContributorFinding[] {
  return [...findings].sort(
    (a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity] || Number(b.isSimpleFix) - Number(a.isSimpleFix),
  )
}

/** Detect a verify command: build script → test script → tsc. Null if none. */
export function detectVerifyCommand(repoPath: string): { label: string; argv: string[] } | null {
  const pkgPath = join(repoPath, 'package.json')
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { scripts?: Record<string, string> }
      if (pkg.scripts?.build) return { label: 'build', argv: ['npm', 'run', 'build'] }
      if (pkg.scripts?.test) return { label: 'test', argv: ['npx', 'vitest', 'run'] }
    } catch {
      // fall through to tsc
    }
  }
  if (existsSync(join(repoPath, 'tsconfig.json'))) return { label: 'tsc', argv: ['npx', 'tsc', '--noEmit'] }
  return null
}

/** Run a detected verify command. Non-zero exit → not ok, with captured output. */
export function runVerify(repoPath: string, cmd: { label: string; argv: string[] }): VerifyOutcome {
  try {
    execSync(cmd.argv.join(' '), { cwd: repoPath, stdio: 'pipe' })
    return { ok: true, failingStep: null, output: '' }
  } catch (err) {
    const e = err as { stdout?: Buffer; stderr?: Buffer; message?: string }
    const output = (e.stdout?.toString() ?? '') + (e.stderr?.toString() ?? '') || e.message || 'verify failed'
    return { ok: false, failingStep: cmd.label, output: output.slice(0, 4000) }
  }
}

/** Apply a typo finding deterministically by re-running COMMON_TYPOS on its line. */
export function applyTypoFix(repoPath: string, finding: ContributorFinding): AppliedChange | null {
  if (finding.category !== 'typo' || !finding.line) return null
  const abs = resolve(repoPath, finding.file)
  if (!existsSync(abs)) return null
  const lines = readFileSync(abs, 'utf-8').split('\n')
  const idx = finding.line - 1
  if (idx < 0 || idx >= lines.length) return null
  let line = lines[idx]
  let changed = false
  for (const [pattern, fix] of COMMON_TYPOS) {
    if (pattern.test(line)) {
      line = line.replace(pattern, fix)
      changed = true
    }
    pattern.lastIndex = 0
  }
  if (!changed) return null
  lines[idx] = line
  writeFileSync(abs, lines.join('\n'))
  return { file: finding.file, summary: `fixed typo on line ${finding.line}`, iteration: -1 }
}

/** Default applier: handles typos concretely, skips (returns null) everything else. */
export function defaultApplyFix(repoPath: string, finding: ContributorFinding): AppliedChange | null {
  return applyTypoFix(repoPath, finding)
}

/** Default analyzer: run the contributor against a local path (no clone). */
export async function defaultAnalyze(repoPath: string): Promise<ContributorFinding[]> {
  const report = await runAutonomousContributor('local', { localPath: repoPath, keepClone: true })
  return report.findings
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd "/Users/isaachernandez/blog design" && npx vitest run packages/kbot/src/engineering-loop.test.ts`
Expected: PASS (Task 2 + Task 3 blocks).

- [ ] **Step 6: Type-check and commit**

```bash
cd "/Users/isaachernandez/blog design"
npx tsc --noEmit -p packages/kbot/tsconfig.json
git add packages/kbot/src/autonomous-contributor.ts packages/kbot/src/engineering-loop.ts packages/kbot/src/engineering-loop.test.ts
git commit -m "feat(kbot): engineering-loop default deps — rank, verify-detect, typo applier"
```
Expected: tsc clean; commit succeeds.

> Note: verify `ContributorOptions` accepts `keepClone` and `localPath` (it does, per `autonomous-contributor.ts` `ContributorOptions`). If the property is named differently, match the actual interface.

---

### Task 4: Orchestrator — `runEngineeringLoop`

**Files:**
- Modify: `packages/kbot/src/engineering-loop.ts` (append orchestrator + narration)
- Test: `packages/kbot/src/engineering-loop.test.ts` (append)

**Interfaces:**
- Consumes: everything from Tasks 2 & 3; `logDecision`, `narrateLoop`, `getDecisionsByType`, `type Decision` from `./decision-journal.js`; `generateReflections` from `./reflection.js`.
- Produces: `runEngineeringLoop(opts: LoopOptions): Promise<LoopResult>`.

- [ ] **Step 1: Write the failing test (append to `engineering-loop.test.ts`)**

```ts
import { runEngineeringLoop, type LoopDeps, type VerifyOutcome as VO } from './engineering-loop.js'

function deps(over: Partial<LoopDeps>): Partial<LoopDeps> {
  return { analyze: async () => [], applyFix: async () => null, verify: async () => GREEN, now: () => 0, ...over }
}

describe('runEngineeringLoop', () => {
  it('exits success when verify is green and no findings remain', async () => {
    const repo = tmpRepo()
    const res = await runEngineeringLoop({
      repoPath: repo, goal: 'clean', narrateTo: ['journal'],
      deps: deps({ analyze: async () => [], verify: async () => GREEN }),
    })
    expect(res.exit).toBe('success')
  })

  it('exits budget when iterations cap is hit while still red', async () => {
    const repo = tmpRepo()
    const f = finding({ severity: 'info', file: 'a.ts' })
    const res = await runEngineeringLoop({
      repoPath: repo, goal: 'fix', narrateTo: ['journal'],
      budget: { maxIterations: 2, maxWallClockMs: 9e9, maxNoProgress: 99 },
      deps: deps({
        analyze: async () => [f],
        applyFix: async () => ({ file: 'a.ts', summary: 's', iteration: -1 }),
        verify: async () => ({ ok: false, failingStep: 'vitest', output: 'red' }),
      }),
    })
    expect(res.exit).toBe('budget')
    expect(res.iterations).toBe(2)
  })

  it('exits handback when stuck on the same failing step', async () => {
    const repo = tmpRepo()
    const f = finding({ severity: 'info', file: 'a.ts' })
    const res = await runEngineeringLoop({
      repoPath: repo, goal: 'fix', narrateTo: ['journal'],
      budget: { maxIterations: 20, maxWallClockMs: 9e9, maxNoProgress: 2 },
      deps: deps({
        analyze: async () => [f],
        applyFix: async () => ({ file: 'a.ts', summary: 's', iteration: -1 }),
        verify: async () => ({ ok: false, failingStep: 'tsc', output: 'same' }),
      }),
    })
    expect(res.exit).toBe('handback')
    expect(res.handbackSummary).toBeTruthy()
  })

  it('hands back instead of editing a file outside the repo', async () => {
    const repo = tmpRepo()
    const escape = finding({ severity: 'info', file: '../evil.ts' })
    const res = await runEngineeringLoop({
      repoPath: repo, goal: 'fix', narrateTo: ['journal'],
      deps: deps({ analyze: async () => [escape], verify: async () => ({ ok: false, failingStep: 'tsc', output: 'r' }) }),
    })
    expect(res.exit).toBe('handback')
    expect(res.handbackSummary).toContain('outside')
  })

  it('refuses to start when no verify command is detectable (no injected verify)', async () => {
    const repo = tmpRepo()
    const res = await runEngineeringLoop({
      repoPath: repo, goal: 'fix', narrateTo: ['journal'],
      deps: { analyze: async () => [], now: () => 0 }, // no verify injected; tmp repo has no package.json/tsconfig
    })
    expect(res.exit).toBe('handback')
    expect(res.finalVerify.failingStep).toBe('verify-detect')
  })

  it('resumes from a checkpoint', async () => {
    const repo = tmpRepo()
    saveState(repo, state({ iteration: 1, noProgress: 2, lastFailingStep: 'tsc' }))
    const res = await runEngineeringLoop({
      repoPath: repo, goal: 'fix', narrateTo: ['journal'],
      budget: { maxIterations: 20, maxWallClockMs: 9e9, maxNoProgress: 2 },
      deps: deps({
        analyze: async () => [finding({ file: 'a.ts' })],
        applyFix: async () => ({ file: 'a.ts', summary: 's', iteration: -1 }),
        verify: async () => ({ ok: false, failingStep: 'tsc', output: 'r' }),
      }),
    })
    // resumed at iteration 1 with noProgress already 2 → handback on the first new iteration
    expect(res.exit).toBe('handback')
  })

  it('propose-only (autoApply false) hands back without editing', async () => {
    const repo = tmpRepo()
    let applied = false
    const res = await runEngineeringLoop({
      repoPath: repo, goal: 'fix', autoApply: false, narrateTo: ['journal'],
      deps: deps({
        analyze: async () => [finding({ file: 'a.ts' })],
        applyFix: async () => { applied = true; return { file: 'a.ts', summary: 's', iteration: -1 } },
        verify: async () => ({ ok: false, failingStep: 'tsc', output: 'r' }),
      }),
    })
    expect(applied).toBe(false)
    expect(res.exit).toBe('handback')
    expect(res.handbackSummary).toContain('approval')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "/Users/isaachernandez/blog design" && npx vitest run packages/kbot/src/engineering-loop.test.ts`
Expected: FAIL — `runEngineeringLoop` is not exported.

- [ ] **Step 3: Append the orchestrator to `engineering-loop.ts`**

Add imports at the top:

```ts
import { logDecision, narrateLoop, getDecisionsByType } from './decision-journal.js'
import { generateReflections } from './reflection.js'
```

Append:

```ts
function logLoopDecision(args: {
  goal: string
  phase: 'plan' | 'act' | 'decide'
  iteration: number
  decision: string
  reasoning: string[]
  file?: string
  verifyStep?: string | null
  exit?: LoopExit
  outcome?: 'success' | 'failure' | 'partial' | 'unknown'
}): void {
  logDecision({
    type: 'engineering-loop',
    decision: args.decision,
    reasoning: args.reasoning,
    alternatives: [],
    confidence: 0.7,
    evidence: { phase: args.phase, iteration: args.iteration, file: args.file, verifyStep: args.verifyStep, exit: args.exit },
    userContext: args.goal.slice(0, 200),
    outcome: args.outcome,
  })
}

function narrate(sinks: NarrationSink[]): void {
  // 'journal' is already persisted by logDecision. 'discord' is an off-by-default
  // follow-up (would call kernel_notify). Only 'stdout' renders here.
  if (sinks.includes('stdout')) {
    process.stdout.write(narrateLoop(getDecisionsByType('engineering-loop', 200)) + '\n')
  }
}

/**
 * Run the engineering loop. Auto-applies fixes by default, verifies each
 * iteration, reflects on failure, and exits on success / budget / handback.
 */
export async function runEngineeringLoop(opts: LoopOptions): Promise<LoopResult> {
  const repoPath = resolve(opts.repoPath)
  const budget: LoopBudget = { ...DEFAULT_BUDGET, ...(opts.budget ?? {}) }
  const autoApply = opts.autoApply ?? true
  const sinks = opts.narrateTo ?? ['journal', 'stdout']
  const now = opts.deps?.now ?? (() => Date.now())
  const analyze = opts.deps?.analyze ?? defaultAnalyze
  const applyFix = opts.deps?.applyFix ?? ((rp: string, f: ContributorFinding) => Promise.resolve(defaultApplyFix(rp, f)))

  // Resolve verify: injected wins; else detect; else refuse to start (handback).
  let verify = opts.deps?.verify
  if (!verify) {
    const cmd = detectVerifyCommand(repoPath)
    if (!cmd) {
      const summary = `No verify command detected in ${repoPath} (no build/test script, no tsconfig). Cannot observe, so handing back.`
      logLoopDecision({ goal: opts.goal, phase: 'decide', iteration: 0, decision: 'refuse to start', reasoning: [summary], exit: 'handback', outcome: 'failure' })
      narrate(sinks)
      return { exit: 'handback', iterations: 0, applied: [], finalVerify: { ok: false, failingStep: 'verify-detect', output: summary }, handbackSummary: summary }
    }
    verify = (rp: string) => Promise.resolve(runVerify(rp, cmd))
  }

  const state: LoopState = loadState(repoPath) ?? {
    iteration: 0, applied: [], noProgress: 0, lastFailingStep: null, lastLesson: null, startedAt: now(),
  }
  let lastVerify: VerifyOutcome = { ok: false, failingStep: null, output: '' }

  for (;;) {
    state.iteration += 1

    // plan
    const ranked = rankFindings(await analyze(repoPath))
    const slice = ranked[0]
    logLoopDecision({
      goal: opts.goal, phase: 'plan', iteration: state.iteration,
      decision: slice ? `target: ${slice.title} (${slice.file})` : 'no findings; verifying only',
      reasoning: slice ? [`${slice.severity} severity, ${ranked.length} candidate(s)`] : ['analyzer returned no findings'],
      file: slice?.file,
    })

    // risk boundary: refuse edits outside the repo or critical-severity findings
    if (slice && !isInsideRepo(repoPath, slice.file)) {
      const summary = `Refused: ${slice.file} resolves outside ${repoPath}. Handing back.`
      logLoopDecision({ goal: opts.goal, phase: 'decide', iteration: state.iteration, decision: 'handback (path escape)', reasoning: [summary], exit: 'handback', outcome: 'failure' })
      saveState(repoPath, state); narrate(sinks)
      return { exit: 'handback', iterations: state.iteration, applied: state.applied, finalVerify: lastVerify, handbackSummary: summary }
    }
    if (slice && slice.severity === 'critical') {
      const summary = `Critical finding "${slice.title}" needs human review; not auto-applying. Handing back.`
      logLoopDecision({ goal: opts.goal, phase: 'decide', iteration: state.iteration, decision: 'handback (critical)', reasoning: [summary], exit: 'handback', outcome: 'partial' })
      saveState(repoPath, state); narrate(sinks)
      return { exit: 'handback', iterations: state.iteration, applied: state.applied, finalVerify: lastVerify, handbackSummary: summary }
    }

    // act
    let appliedThisIteration = false
    if (slice && !autoApply) {
      const summary = `Proposal pending approval (autoApply off): ${slice.title} in ${slice.file}.`
      logLoopDecision({ goal: opts.goal, phase: 'act', iteration: state.iteration, decision: 'propose-only (await approval)', reasoning: [summary], file: slice.file })
      saveState(repoPath, state); narrate(sinks)
      return { exit: 'handback', iterations: state.iteration, applied: state.applied, finalVerify: lastVerify, handbackSummary: summary }
    }
    if (slice && autoApply) {
      try {
        const change = await applyFix(repoPath, slice)
        if (change) {
          state.applied.push({ ...change, iteration: state.iteration })
          appliedThisIteration = true
          logLoopDecision({ goal: opts.goal, phase: 'act', iteration: state.iteration, decision: `applied: ${change.summary}`, reasoning: [`edited ${change.file}`], file: change.file, outcome: 'success' })
        } else {
          logLoopDecision({ goal: opts.goal, phase: 'act', iteration: state.iteration, decision: 'skipped (no concrete fix)', reasoning: [`no default applier for ${slice.category}`], file: slice.file, outcome: 'partial' })
        }
      } catch (err) {
        logLoopDecision({ goal: opts.goal, phase: 'act', iteration: state.iteration, decision: 'apply failed', reasoning: [(err as Error).message], file: slice.file, outcome: 'failure' })
      }
    }

    // observe
    lastVerify = await verify(repoPath)

    // reflect (only when red)
    let lesson: string | null = null
    if (!lastVerify.ok) {
      lesson = generateReflections(opts.goal, lastVerify.output.slice(0, 500), 'error_correction').lesson
    }

    // no-progress accounting (uses prior step/lesson, then updates state)
    state.noProgress = computeNoProgress(state, lastVerify, lesson)
    state.lastFailingStep = lastVerify.failingStep
    state.lastLesson = lesson

    // decide
    const remainingFindings = lastVerify.ok ? 0 : Math.max(0, ranked.length - (appliedThisIteration ? 1 : 0))
    const verdict = decideExit({ state, verify: lastVerify, remainingFindings, budget, elapsedMs: now() - state.startedAt })
    logLoopDecision({
      goal: opts.goal, phase: 'decide', iteration: state.iteration,
      decision: verdict.exit ?? 'continue', reasoning: [verdict.reason],
      verifyStep: lastVerify.failingStep, exit: verdict.exit ?? undefined,
    })
    saveState(repoPath, state)
    narrate(sinks)

    if (verdict.exit) {
      return {
        exit: verdict.exit,
        iterations: state.iteration,
        applied: state.applied,
        finalVerify: lastVerify,
        handbackSummary: verdict.exit === 'handback' ? verdict.reason : undefined,
      }
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "/Users/isaachernandez/blog design" && npx vitest run packages/kbot/src/engineering-loop.test.ts`
Expected: PASS (all blocks). Note: the success test passes because `analyze` returns `[]` → `slice` undefined → `remainingFindings` 0 with green verify → `decideExit` success on iteration 1.

- [ ] **Step 5: Full type-check, run both test files, commit**

```bash
cd "/Users/isaachernandez/blog design"
npx tsc --noEmit -p packages/kbot/tsconfig.json
npx vitest run packages/kbot/src/engineering-loop.test.ts packages/kbot/src/decision-journal.test.ts
git add packages/kbot/src/engineering-loop.ts packages/kbot/src/engineering-loop.test.ts
git commit -m "feat(kbot): runEngineeringLoop orchestrator — plan/act/observe/reflect/decide + narration"
```
Expected: tsc clean; all tests pass; commit succeeds.

---

## Self-Review

**Spec coverage:**
- Loop entrypoint `runEngineeringLoop(opts)` → Task 4. ✓
- Five phases plan/act/observe/reflect/decide → Task 4 loop body. ✓
- Three exits success/budget/handback → `decideExit` (Task 2) + orchestrator returns (Task 4), each tested. ✓
- Auto-apply default + propose-only → Task 4 (`autoApply` branch), tested. ✓
- Reflexion via `generateReflections('error_correction')` → Task 4 reflect step. ✓
- No-progress detection + reset rule → `computeNoProgress` (Task 2), tested. ✓
- Checkpoint + resume → `saveState`/`loadState` (Task 2) + resume test (Task 4). ✓
- Refuse-to-start without verify → Task 4, tested. ✓
- repoPath-escape + critical risk boundary → Task 4, escape tested. ✓
- Narration: `engineering-loop` type + `narrateLoop` + journal/stdout sinks → Tasks 1 & 4. ✓ (Discord deferred per spec.)
- One-way import (journal never imports loop) → Tasks 1/4 keep `decision-journal.ts` free of loop imports. ✓
- Default applier handles typos concretely → Task 3, tested. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code; commands have expected output. ✓

**Type consistency:** `LoopState`, `VerifyOutcome`, `AppliedChange`, `LoopDeps`, `LoopBudget` defined once in Task 2 and reused verbatim in Tasks 3–4. `decideExit` arg shape matches its call site. `narrateLoop(Decision[])` signature matches Task 1 definition and Task 4 call. `detectVerifyCommand` return `{ label, argv }` matches `runVerify` param. ✓

**One spec deviation to note for the implementer:** the spec implied richer auto-fix; this plan ships a *typo-concrete* default applier with a skip-and-log path for other categories, and a `LoopDeps.applyFix` injection seam so richer fixers plug in without touching the loop. This honors "auto-apply, end-to-end" while keeping scope bounded. If you want broader default fixers, that is a follow-up plan, not this one.
