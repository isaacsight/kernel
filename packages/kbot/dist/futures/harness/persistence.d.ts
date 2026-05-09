/**
 * Harness Evolution Loop — JSONL trace persistence.
 *
 * Each task gets its own append-only JSONL file at
 * `~/.kbot/futures/harness/<task-id>.jsonl`. One line per `EvolutionRecord`
 * (or arbitrary JSON-serializable record). Append-only on the hot path so
 * concurrent loops don't trample each other; reads parse line-by-line and
 * skip malformed lines rather than throwing on a single bad row.
 *
 * Pattern mirrors `src/planner/hierarchical/persistence.ts`: state dir is
 * configurable (default `~/.kbot/futures/harness`), atomic writes where
 * possible, ENOENT swallowed on read paths.
 */
import type { EvolutionRecord } from './types.js';
/** Default on-disk root: `~/.kbot/futures/harness/`. */
export declare function defaultStateDir(): string;
/** Append a single record as one JSONL line. */
export declare function appendTrace(taskId: string, record: EvolutionRecord, stateDir?: string): Promise<void>;
/**
 * Read all records for a task in append order. Returns empty array if the
 * file doesn't exist. Malformed lines are skipped — one bad row never
 * invalidates the whole history.
 */
export declare function readHistory(taskId: string, stateDir?: string): Promise<EvolutionRecord[]>;
/**
 * Delete trace files older than `days` (by mtime). Returns the list of
 * removed task ids. Pure janitor — never throws on individual failures.
 */
export declare function pruneOlderThan(days: number, stateDir?: string): Promise<string[]>;
//# sourceMappingURL=persistence.d.ts.map