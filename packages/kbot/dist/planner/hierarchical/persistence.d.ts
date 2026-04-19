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
import type { SessionGoal } from './types.js';
/** Default on-disk root: `~/.kbot/planner/`. */
export declare function defaultStateDir(): string;
/** Read a single goal by id, or null if missing. */
export declare function readGoal(stateDir: string, id: string): Promise<SessionGoal | null>;
/** Write (create-or-overwrite) a goal file. */
export declare function writeGoal(stateDir: string, goal: SessionGoal): Promise<void>;
/** List every goal on disk (unsorted). */
export declare function listGoals(stateDir: string): Promise<SessionGoal[]>;
/** Set the active goal pointer. The goal must already exist on disk. */
export declare function setActive(stateDir: string, goalId: string): Promise<void>;
/** Read the active goal (resolves pointer → goal file). Returns null if unset. */
export declare function getActive(stateDir: string): Promise<SessionGoal | null>;
/** Clear the active pointer (goal files untouched). */
export declare function clearActive(stateDir: string): Promise<void>;
//# sourceMappingURL=persistence.d.ts.map