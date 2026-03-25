/** Execution trace — one agent run */
export interface Trace {
    agent: string;
    taskType: string;
    toolsUsed: string[];
    score: number;
    success: boolean;
    messageLength?: number;
    timestamp: string;
}
/** A mutation applied to a prompt */
export interface Mutation {
    agent: string;
    text: string;
    reason: string;
    scoreBefore: number;
    scoreAfter: number;
    appliedAt: string;
    rolledBack: boolean;
}
/** Configuration */
export interface EvolverConfig {
    /** Traces per agent before evolution triggers (default: 20) */
    threshold?: number;
    /** Max traces to keep (default: 500) */
    maxTraces?: number;
    /** Max mutations to keep (default: 50) */
    maxMutations?: number;
    /** Score drop threshold for auto-rollback (default: 0.1) */
    rollbackThreshold?: number;
}
/** Evolution state */
export interface EvolverState {
    traces: Trace[];
    mutations: Mutation[];
    generation: number;
}
export declare class PromptEvolver {
    private state;
    private config;
    constructor(config?: EvolverConfig);
    /** Record an execution trace */
    recordTrace(trace: Omit<Trace, 'timestamp'>): void;
    /**
     * Attempt to evolve a prompt for the given agent.
     * Analyzes traces and generates a mutation if patterns are found.
     * Returns the mutation, or null if no evolution is warranted.
     */
    evolve(agent: string): Mutation | null;
    /**
     * Check if the latest mutation for an agent should be rolled back.
     * Call this after enough traces have been collected post-mutation.
     */
    checkRollback(agent: string): Mutation | null;
    /** Get all active (non-rolled-back) mutations for an agent */
    getActiveMutations(agent: string): Mutation[];
    /** Get the prompt amendment text for an agent (all active mutations combined) */
    getAmendment(agent: string): string;
    /** Get current generation */
    getGeneration(): number;
    toJSON(): string;
    fromJSON(json: string): void;
    save(path: string): void;
    load(path: string): void;
    /** Human-readable summary */
    summary(): string;
}
//# sourceMappingURL=index.d.ts.map