/**
 * Synthesis — fan a list of debate inputs through the runner and
 * persist the verdicts as JSONL training data for the critic.
 */
import type { DebateInput, DebateOpts, TrainingExample } from './types.js';
/**
 * Default JSONL path: ~/.kbot/futures/debate/<YYYY-MM-DD>.jsonl
 */
export declare function defaultJsonlPath(date?: Date): string;
/**
 * Run a debate per input and return the resulting training examples.
 * Failures are surfaced — the caller decides whether to retry or skip.
 */
export declare function synthesizeTrainingData(inputs: DebateInput[], opts: DebateOpts): Promise<TrainingExample[]>;
/**
 * Atomic JSONL write. Creates parent dirs, writes to a tmp file,
 * then renames into place to avoid partial-write corruption.
 */
export declare function writeJsonl(examples: TrainingExample[], filePath: string): void;
/**
 * Read JSONL and parse line-by-line. Malformed lines are skipped
 * (callers can audit by counting input vs output).
 */
export declare function loadJsonl(filePath: string): TrainingExample[];
//# sourceMappingURL=synthesis.d.ts.map