import { type AgentOptions } from './agent.js';
export interface PlanStep {
    id: number;
    description: string;
    tool?: string;
    args?: Record<string, unknown>;
    /** Specialist agent to route this step to (e.g. 'coder', 'researcher') */
    agent?: string;
    /** Files this step reads */
    reads?: string[];
    /** Files this step modifies */
    writes?: string[];
    status: 'pending' | 'running' | 'done' | 'failed' | 'skipped';
    result?: string;
    error?: string;
    /** Step IDs this depends on */
    dependsOn?: number[];
}
export interface Plan {
    task: string;
    summary: string;
    steps: PlanStep[];
    filesInScope: string[];
    estimatedToolCalls: number;
    status: 'planning' | 'awaiting_approval' | 'executing' | 'completed' | 'failed';
    createdAt: string;
}
/**
 * Generate a plan for a complex task.
 * Uses the AI to analyze the task and produce structured steps.
 */
export declare function generatePlan(task: string, agentOpts: AgentOptions): Promise<Plan>;
/**
 * Display a plan to the user for approval.
 */
export declare function displayPlan(plan: Plan): void;
/**
 * Execute a plan step by step.
 * Supports parallel execution for independent steps.
 */
export declare function executePlan(plan: Plan, agentOpts: AgentOptions, onStepComplete?: (step: PlanStep) => void): Promise<Plan>;
/**
 * Full autonomous flow: Plan → Confirm → Execute → Verify
 * This is the top-level entry point for complex tasks.
 */
export declare function autonomousExecute(task: string, agentOpts: AgentOptions, options?: {
    /** Skip approval — execute immediately */
    autoApprove?: boolean;
    /** Callback for user approval (return true to proceed) */
    onApproval?: (plan: Plan) => Promise<boolean>;
}): Promise<Plan>;
/**
 * Format a plan summary for display after completion
 */
export declare function formatPlanSummary(plan: Plan): string;
//# sourceMappingURL=planner.d.ts.map