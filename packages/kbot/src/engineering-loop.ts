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
