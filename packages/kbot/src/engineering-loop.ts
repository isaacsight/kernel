// kbot Engineering Loop — plan → act → observe → reflect → decide, narrated.
// Core: types + pure decision helpers + checkpoint. Orchestrator added in Task 4.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname, resolve, relative, isAbsolute } from 'node:path'
import { execSync } from 'node:child_process'
import {
  runAutonomousContributor,
  COMMON_TYPOS,
  type ContributorFinding,
  type FindingSeverity,
} from './autonomous-contributor.js'
import { logDecision, narrateLoop, getDecisionsByType } from './decision-journal.js'
import { generateReflections } from './reflection.js'

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
