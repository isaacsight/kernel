export interface TeammateDefinition {
    /** Agent identifier */
    name: string;
    /** What this specialist focuses on */
    description: string;
    /** Model tier: 'sonnet' for fast agents, 'opus' for complex reasoning */
    model: 'sonnet' | 'opus';
    /** System prompt that defines the specialist's behavior */
    initialPrompt: string;
    /** Preferred tools for this specialist */
    tools: string[];
}
export interface DelegationResult {
    /** The response content from the teammate */
    content: string;
    /** Which agent handled the task */
    agent: string;
    /** Model used */
    model: string;
    /** Number of tool calls made */
    toolCalls: number;
    /** Token usage, if available */
    usage?: {
        input_tokens: number;
        output_tokens: number;
        cost_usd: number;
    };
}
/**
 * Register kbot specialists as Claude Code teammates.
 *
 * Returns an array of teammate definitions — one for each of kbot's
 * core and extended specialist agents (10 total).
 *
 * @example
 * const teammates = registerTeammates()
 * // teammates[0] = { name: 'kernel', model: 'sonnet', ... }
 */
export declare function registerTeammates(): TeammateDefinition[];
/**
 * Delegate a task to a specific kbot teammate by name.
 *
 * Routes the task through kbot's full agent loop (think -> plan -> execute -> learn)
 * using a silent UI adapter so output is captured, not printed.
 *
 * @param name - The teammate/specialist ID (e.g. 'coder', 'researcher')
 * @param task - The task description or prompt to execute
 * @returns The delegation result with content, agent info, and usage stats
 *
 * @example
 * const result = await delegateToTeammate('coder', 'add input validation to auth.ts')
 * console.log(result.content)
 */
export declare function delegateToTeammate(name: string, task: string): Promise<DelegationResult>;
//# sourceMappingURL=agent-teams.d.ts.map