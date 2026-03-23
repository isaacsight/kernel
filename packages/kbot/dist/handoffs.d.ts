export interface Handoff {
    from: string;
    to: string;
    reason: string;
    context: string;
    preserveHistory: boolean;
}
export interface HandoffResult {
    agent: string;
    response: string;
    handoffChain: string[];
}
interface HandoffRule {
    from: string | '*';
    to: string;
    triggers: RegExp[];
    description: string;
}
/**
 * Analyze if the current agent should hand off to another specialist.
 * Checks the response and original query against handoff rules.
 *
 * Returns a Handoff object if a handoff is recommended, null otherwise.
 */
export declare function detectHandoff(agentId: string, response: string, query: string): Handoff | null;
/**
 * Build the context string for the receiving agent.
 * Includes a handoff header, the accumulated context, and the reason.
 */
export declare function buildHandoffContext(currentContext: string, handoff: Handoff): string;
/**
 * Execute a handoff: call runAgent with the target agent and built context.
 * Tracks the handoff chain and enforces maximum depth.
 *
 * The runAgent function is passed as a parameter to avoid circular imports
 * (agent.ts imports from many modules, and those modules should not import agent.ts).
 */
export declare function executeHandoff(handoff: Handoff, query: string, runAgentFn: (message: string, options: {
    agent?: string;
    context?: unknown;
}) => Promise<{
    content: string;
    agent: string;
}>, chain?: string[]): Promise<HandoffResult>;
/**
 * Get all available handoff rules (for diagnostics / UI).
 */
export declare function getHandoffRules(): readonly HandoffRule[];
/**
 * Check if an agent ID is a valid specialist that can participate in handoffs.
 */
export declare function isHandoffTarget(agentId: string): boolean;
export {};
//# sourceMappingURL=handoffs.d.ts.map