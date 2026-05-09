/**
 * Skill graph → synthetic task synthesis.
 *
 * Translates a sampled GraphPath into a Task instance compatible with the
 * harness module's `Task` interface. The acceptance criteria are derived
 * from the path's edges; the instructions describe the workflow in human-
 * readable form.
 */
import type { Task } from '../harness/types.js';
import type { GraphPath } from './types.js';
export interface PathToTaskOptions {
    /** Optional id prefix; defaults to "synth-". */
    prefix?: string;
    /** Optional context line prepended to instructions. */
    contextHeader?: string;
    /** Extra metadata to merge into Task.meta. */
    meta?: Record<string, unknown>;
}
export declare function pathToTask(path: GraphPath, opts?: PathToTaskOptions): Task;
//# sourceMappingURL=synthesis.d.ts.map