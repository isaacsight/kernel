import { delegateTask, listRemoteAgents, removeRemoteAgent, findAgentBySkill, type AgentCard, type A2ATask, type A2ATaskStatus, type A2AMessage, type A2APart, type RemoteAgent } from './a2a.js';
export type { AgentCard, A2ATask, A2ATaskStatus, A2AMessage, A2APart, RemoteAgent, };
interface TaskHistoryEntry {
    id: string;
    agentUrl: string;
    agentName?: string;
    prompt: string;
    status: A2ATaskStatus['state'];
    result?: string;
    createdAt: string;
    completedAt?: string;
    metadata?: Record<string, unknown>;
}
/**
 * Generate kbot's Agent Card JSON with all specialists as skills.
 *
 * @param endpointUrl - The URL where this kbot instance is reachable.
 *                      Defaults to http://localhost:7437.
 * @returns A fully populated AgentCard per the A2A v0.3 spec.
 */
export declare function generateAgentCard(endpointUrl?: string): AgentCard;
/**
 * Discover a remote A2A agent by fetching its Agent Card from
 * `<url>/.well-known/agent.json`.
 *
 * The discovered agent is persisted in the local registry at
 * `~/.kbot/a2a-registry.json` for future lookups.
 *
 * @param url - Base URL of the remote agent (e.g. "http://other-agent:8080")
 * @returns The agent's card, or null if discovery fails.
 */
export declare function discoverAgent(url: string): Promise<AgentCard | null>;
export interface SendTaskOptions {
    /** Hint which specialist agent should handle the task */
    agent?: string;
    /** Additional metadata to attach to the task */
    metadata?: Record<string, unknown>;
    /** Auth token for the remote agent (Bearer) */
    token?: string;
    /** Whether to wait for completion (sync) or return immediately (async).
     *  Defaults to true (synchronous). */
    sync?: boolean;
    /** Timeout in milliseconds. Defaults to 120_000 (2 min). */
    timeoutMs?: number;
}
/**
 * Send a task to a remote A2A agent.
 *
 * By default this is synchronous — it waits for the remote agent to complete
 * the task and returns the result. Set `options.sync = false` to submit
 * asynchronously (returns immediately with a submitted-state task).
 *
 * @param agentUrl - Base URL of the remote agent
 * @param task - The prompt text or a structured A2AMessage
 * @param options - Execution options
 * @returns The task result, including id, status, and response text
 */
export declare function sendTask(agentUrl: string, task: string | {
    prompt: string;
}, options?: SendTaskOptions): Promise<{
    id: string;
    status: A2ATaskStatus['state'];
    text: string | null;
    metadata: Record<string, unknown>;
}>;
/**
 * Check the status and result of a previously submitted task.
 *
 * @param agentUrl - Base URL of the remote agent
 * @param taskId - The task ID returned by sendTask
 * @param options - Optional auth token
 * @returns Current task state and any available result
 */
export declare function getTaskStatus(agentUrl: string, taskId: string, options?: {
    token?: string;
}): Promise<{
    id: string;
    status: A2ATaskStatus['state'];
    message?: string;
    text: string | null;
    metadata: Record<string, unknown>;
}>;
/**
 * Cancel a running task on a remote agent.
 *
 * @param agentUrl - Base URL of the remote agent
 * @param taskId - The task ID to cancel
 * @param options - Optional auth token
 * @returns true if the task was canceled, false if it was already terminal
 */
export declare function cancelTask(agentUrl: string, taskId: string, options?: {
    token?: string;
}): Promise<boolean>;
/**
 * Handle an incoming A2A task received by this kbot instance.
 *
 * Routes the task to the appropriate specialist agent based on metadata
 * hints or automatic intent classification, executes it through kbot's
 * agent system, and returns the completed task.
 *
 * This is used internally by the A2A server but is exported for
 * programmatic use (e.g., SDK consumers, custom servers).
 *
 * @param task - The incoming task with a user message
 * @returns The task with result populated and status set to completed/failed
 */
export declare function handleIncomingTask(task: {
    message: A2AMessage;
    metadata?: Record<string, unknown>;
}): Promise<{
    id: string;
    status: A2ATaskStatus['state'];
    text: string | null;
    metadata: Record<string, unknown>;
}>;
/**
 * List all discovered remote agents from the local registry.
 */
export { listRemoteAgents, removeRemoteAgent, findAgentBySkill };
/**
 * Delegate a task to a remote agent (convenience wrapper around sendTask
 * that matches the existing delegateTask signature in a2a.ts).
 */
export { delegateTask };
/**
 * Get the local task history (tasks sent to remote agents).
 */
export declare function getTaskHistory(): TaskHistoryEntry[];
/**
 * Clear the local task history.
 */
export declare function clearTaskHistory(): void;
export interface CollaborationPlan {
    steps: {
        agentUrl: string;
        agentName?: string;
        prompt: string;
        dependsOn?: number[];
    }[];
}
/**
 * Execute a multi-step collaboration plan across multiple A2A agents.
 *
 * Steps without dependencies run in parallel. Steps with `dependsOn`
 * wait for their dependencies to complete and inject their results
 * into the prompt using `{{step:N}}` placeholders.
 *
 * @param plan - The collaboration plan
 * @param options - Auth tokens keyed by agent URL
 * @returns Results for each step
 */
export declare function collaborate(plan: CollaborationPlan, options?: {
    tokens?: Record<string, string>;
}): Promise<{
    results: {
        stepIndex: number;
        agentUrl: string;
        status: A2ATaskStatus['state'];
        text: string | null;
    }[];
}>;
//# sourceMappingURL=a2a-client.d.ts.map