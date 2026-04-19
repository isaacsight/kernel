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
import type { SessionGoal } from './types.js'

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
