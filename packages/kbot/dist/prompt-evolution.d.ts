export interface PromptTrace {
    agent: string;
    taskType: string;
    toolsUsed: string[];
    evalScore: number;
    success: boolean;
    messageLength: number;
    timestamp: string;
}
export interface PromptMutation {
    agent: string;
    original: string;
    mutated: string;
    reason: string;
    appliedAt: string;
    scoreBefore: number;
    scoreAfter: number;
}
export interface PromptEvolutionState {
    traces: PromptTrace[];
    mutations: PromptMutation[];
    generation: number;
}
/**
 * Record an execution trace after each agent response.
 * Called from agent.ts in the post-response learning block.
 */
export declare function recordTrace(trace: PromptTrace): void;
/**
 * Check if an agent has accumulated enough traces to trigger evolution.
 * Returns true if 20+ traces exist since the last evolution cycle for this agent.
 */
export declare function shouldEvolve(agent: string): boolean;
/**
 * Analyze execution traces for an agent and generate prompt mutations.
 * This is the core GEPA heuristic engine — entirely local, no LLM calls.
 *
 * Mutation rules:
 *   1. Low success rate (<0.6) → add verification/self-checking emphasis
 *   2. Narrow tool usage → encourage broader tool exploration
 *   3. Low scores on specific task types → add task-specific instructions
 *   4. Responses too long → add conciseness instruction
 *   5. Missing the question → add "answer first" instruction
 *
 * Returns the generated mutation, or null if no improvement is needed.
 */
export declare function evolvePrompt(agent: string): PromptMutation | null;
/**
 * Get the current active prompt amendment for an agent.
 * Called before prompt assembly to inject evolved instructions.
 * Returns empty string if no active mutation exists.
 */
export declare function getPromptAmendment(agent: string): string;
/**
 * Rollback the most recent mutation for an agent if it made things worse.
 * Compares scoreAfter vs scoreBefore — if worse, removes the mutation.
 *
 * Call this after updating scoreAfter from the latest trace batch.
 * Returns true if a rollback was performed.
 */
export declare function rollbackMutation(agent: string): boolean;
/**
 * Update the scoreAfter for the most recent mutation of an agent.
 * Called when enough post-mutation traces are available.
 */
export declare function updateMutationScore(agent: string): void;
/**
 * Get evolution statistics — how prompts have evolved over time.
 */
export declare function getEvolutionStats(): {
    generation: number;
    totalTraces: number;
    totalMutations: number;
    agentStats: Record<string, {
        traces: number;
        avgScore: number;
        successRate: number;
        activeMutation: boolean;
        mutationCount: number;
        lastEvolved: string | null;
    }>;
};
/**
 * Reset all evolution data for a specific agent (or all agents).
 * Useful for debugging or when a major prompt rewrite happens.
 */
export declare function resetEvolution(agent?: string): void;
/**
 * Flush pending state to disk. Call on process exit.
 */
export declare function flushEvolutionState(): void;
//# sourceMappingURL=prompt-evolution.d.ts.map