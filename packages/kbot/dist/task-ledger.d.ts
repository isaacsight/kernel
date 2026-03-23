export interface PlanStep {
    index: number;
    description: string;
    /** Which specialist agent to route this step to */
    agent?: string;
    /** Expected tools this step will need */
    tools?: string[];
    status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
    /** Step indices this step depends on */
    dependsOn?: number[];
}
export interface StepProgress {
    stepIndex: number;
    startedAt: string;
    completedAt?: string;
    result: 'success' | 'failure' | 'partial';
    /** Brief summary of what happened */
    output?: string;
    /** Error message if failed */
    error?: string;
    toolsUsed: string[];
    tokensUsed: number;
    costUsd: number;
}
export interface StepResult {
    result: 'success' | 'failure' | 'partial';
    output?: string;
    error?: string;
    toolsUsed: string[];
    tokensUsed: number;
    costUsd: number;
}
export declare class TaskLedger {
    facts: string[];
    guesses: string[];
    plan: PlanStep[];
    progress: StepProgress[];
    /** Add a verified fact discovered during execution */
    addFact(fact: string): void;
    /** Add a hypothesis that needs verification */
    addGuess(guess: string): void;
    /** Set or replace the current plan */
    setPlan(steps: PlanStep[]): void;
    /** Update a step with its execution result */
    updateStep(stepIndex: number, result: StepResult): void;
    /** Generate a human-readable progress assessment */
    getProgressSummary(): string;
    /**
     * Should we replan?
     * Returns true if:
     *   - 2+ consecutive steps failed
     *   - Total cost exceeds $0.50
     *   - Any step used more than 3 tool loops (inferred from toolsUsed count)
     */
    shouldReplan(): boolean;
    /**
     * Compact representation for LLM context (~500 tokens max).
     *
     * Format:
     *   TASK LEDGER:
     *   Facts: [N known] fact1. fact2. fact3.
     *   Plan: 1. checkmark step  2. arrow step  3. circle step
     *   Progress: Step 1 completed (2 tools, 0.3s). Step 2 in progress.
     */
    toContext(): string;
    /** Serialize to JSON string for session persistence */
    toJSON(): string;
    /** Deserialize from JSON string */
    static fromJSON(json: string): TaskLedger;
    /**
     * Save ledger state to a JSON file for checkpoint persistence.
     * Uses atomic write (write to .tmp, then rename) to prevent corruption.
     */
    saveLedger(path: string): Promise<void>;
    /**
     * Load ledger state from a JSON file.
     * Restores facts, guesses, plan, and progress from a previously saved checkpoint.
     */
    loadLedger(path: string): Promise<void>;
}
//# sourceMappingURL=task-ledger.d.ts.map