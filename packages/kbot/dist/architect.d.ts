import { type AgentOptions } from './agent.js';
export interface ArchitectPlan {
    summary: string;
    files_to_modify: string[];
    files_to_create: string[];
    steps: ArchitectStep[];
    constraints: string[];
    test_strategy: string;
}
interface ArchitectStep {
    description: string;
    file: string;
    action: 'create' | 'edit' | 'delete';
}
interface StepOutcome {
    step: ArchitectStep;
    status: 'approved' | 'failed';
    attempts: number;
    editorOutput: string;
    reviewFeedback?: string;
}
interface ArchitectReport {
    plan: ArchitectPlan;
    outcomes: StepOutcome[];
    verification: string | null;
    status: 'completed' | 'partial' | 'failed';
}
/**
 * Run architect mode: a dual-agent loop where the Architect plans and reviews
 * while the Editor implements each step.
 *
 * Flow:
 *   1. Architect analyzes the task and creates a structured plan
 *   2. For each step: Editor implements -> Architect reviews -> approve or redo
 *   3. After all steps: Architect runs verification (type check, tests)
 *   4. Returns a full report
 *
 * @param task - The user's task description
 * @param options - Agent options (model, streaming, etc.)
 * @returns Full report of the architect session
 */
export declare function runArchitectMode(task: string, options?: AgentOptions): Promise<ArchitectReport>;
export {};
//# sourceMappingURL=architect.d.ts.map