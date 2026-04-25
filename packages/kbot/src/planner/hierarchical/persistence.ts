/**
 * Hierarchical Planner — persistence helpers.
 *
 * Goals are stored as individual JSON files under
 * `~/.kbot/planner/goals/<id>.json`. The currently-active goal id is recorded
 * at `~/.kbot/planner/active.json` as `{ "goalId": "<ulid>" }`.
 *
 * Scope: atomic read/write, listing, and active-pointer management. No
 * tier logic here.
 */

import { promises as fs } from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import type { Action, Phase, SessionGoal } from './types.js'

/** Default on-disk root: `~/.kbot/planner/`. */
export function defaultStateDir(): string {
  return path.join(os.homedir(), '.kbot', 'planner')
}

function goalsDir(stateDir: string): string {
  return path.join(stateDir, 'goals')
}

function goalPath(stateDir: string, id: string): string {
  return path.join(goalsDir(stateDir), `${id}.json`)
}

function activePath(stateDir: string): string {
  return path.join(stateDir, 'active.json')
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true })
}

/** Read a single goal by id, or null if missing. */
export async function readGoal(
  stateDir: string,
  id: string,
): Promise<SessionGoal | null> {
  try {
    const raw = await fs.readFile(goalPath(stateDir, id), 'utf8')
    return JSON.parse(raw) as SessionGoal
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }
}

/** Write (create-or-overwrite) a goal file. */
export async function writeGoal(
  stateDir: string,
  goal: SessionGoal,
): Promise<void> {
  await ensureDir(goalsDir(stateDir))
  const tmp = goalPath(stateDir, goal.id) + '.tmp'
  const final = goalPath(stateDir, goal.id)
  await fs.writeFile(tmp, JSON.stringify(goal, null, 2), 'utf8')
  await fs.rename(tmp, final)
}

/** List every goal on disk (unsorted). */
export async function listGoals(stateDir: string): Promise<SessionGoal[]> {
  const dir = goalsDir(stateDir)
  let entries: string[]
  try {
    entries = await fs.readdir(dir)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw err
  }
  const goals: SessionGoal[] = []
  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue
    try {
      const raw = await fs.readFile(path.join(dir, entry), 'utf8')
      goals.push(JSON.parse(raw) as SessionGoal)
    } catch {
      // skip unreadable / malformed files; don't let one bad file poison the list
    }
  }
  return goals
}

/** Set the active goal pointer. The goal must already exist on disk. */
export async function setActive(stateDir: string, goalId: string): Promise<void> {
  const existing = await readGoal(stateDir, goalId)
  if (!existing) {
    throw new Error(`setActive: goal ${goalId} not found in ${goalsDir(stateDir)}`)
  }
  await ensureDir(stateDir)
  const tmp = activePath(stateDir) + '.tmp'
  await fs.writeFile(tmp, JSON.stringify({ goalId }, null, 2), 'utf8')
  await fs.rename(tmp, activePath(stateDir))
}

/** Read the active goal (resolves pointer → goal file). Returns null if unset. */
export async function getActive(stateDir: string): Promise<SessionGoal | null> {
  let ptr: { goalId?: string }
  try {
    const raw = await fs.readFile(activePath(stateDir), 'utf8')
    ptr = JSON.parse(raw)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }
  if (!ptr.goalId) return null
  return readGoal(stateDir, ptr.goalId)
}

/** Clear the active pointer (goal files untouched). */
export async function clearActive(stateDir: string): Promise<void> {
  try {
    await fs.unlink(activePath(stateDir))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase persistence — `~/.kbot/planner/phases/<goalId>/<phaseId>.json`
// ─────────────────────────────────────────────────────────────────────────────

function phasesDir(stateDir: string, goalId: string): string {
  return path.join(stateDir, 'phases', goalId)
}

function phasePath(stateDir: string, goalId: string, phaseId: string): string {
  return path.join(phasesDir(stateDir, goalId), `${phaseId}.json`)
}

export async function writePhase(stateDir: string, phase: Phase): Promise<void> {
  await ensureDir(phasesDir(stateDir, phase.goalId))
  const tmp = phasePath(stateDir, phase.goalId, phase.id) + '.tmp'
  const final = phasePath(stateDir, phase.goalId, phase.id)
  await fs.writeFile(tmp, JSON.stringify(phase, null, 2), 'utf8')
  await fs.rename(tmp, final)
}

export async function readPhase(stateDir: string, goalId: string, phaseId: string): Promise<Phase | null> {
  try {
    const raw = await fs.readFile(phasePath(stateDir, goalId, phaseId), 'utf8')
    return JSON.parse(raw) as Phase
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }
}

export async function listPhasesForGoal(stateDir: string, goalId: string): Promise<Phase[]> {
  const dir = phasesDir(stateDir, goalId)
  let entries: string[]
  try {
    entries = await fs.readdir(dir)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw err
  }
  const phases: Phase[] = []
  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue
    try {
      const raw = await fs.readFile(path.join(dir, entry), 'utf8')
      phases.push(JSON.parse(raw) as Phase)
    } catch { /* skip malformed */ }
  }
  return phases
}

/** Most recent active Phase for a goal, or null. */
export async function getActivePhase(stateDir: string, goalId: string): Promise<Phase | null> {
  const phases = await listPhasesForGoal(stateDir, goalId)
  const active = phases.filter(p => p.status === 'active')
  if (active.length === 0) return null
  active.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  return active[0]
}

// ─────────────────────────────────────────────────────────────────────────────
// Action persistence — `~/.kbot/planner/actions/<phaseId>/<actionId>.json`
// ─────────────────────────────────────────────────────────────────────────────

function actionsDir(stateDir: string, phaseId: string): string {
  return path.join(stateDir, 'actions', phaseId)
}

function actionPath(stateDir: string, phaseId: string, actionId: string): string {
  return path.join(actionsDir(stateDir, phaseId), `${actionId}.json`)
}

export async function writeAction(stateDir: string, action: Action): Promise<void> {
  await ensureDir(actionsDir(stateDir, action.phaseId))
  const tmp = actionPath(stateDir, action.phaseId, action.id) + '.tmp'
  const final = actionPath(stateDir, action.phaseId, action.id)
  await fs.writeFile(tmp, JSON.stringify(action, null, 2), 'utf8')
  await fs.rename(tmp, final)
}

export async function listActionsForPhase(stateDir: string, phaseId: string): Promise<Action[]> {
  const dir = actionsDir(stateDir, phaseId)
  let entries: string[]
  try {
    entries = await fs.readdir(dir)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw err
  }
  const actions: Action[] = []
  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue
    try {
      const raw = await fs.readFile(path.join(dir, entry), 'utf8')
      actions.push(JSON.parse(raw) as Action)
    } catch { /* skip malformed */ }
  }
  return actions
}
