import type { IncomingMessage, ServerResponse } from 'node:http';
export interface CloudAgent {
    id: string;
    name: string;
    status: 'running' | 'paused' | 'completed' | 'failed' | 'queued';
    task: string;
    agent?: string;
    schedule?: string;
    webhook?: string;
    maxIterations?: number;
    currentIteration: number;
    results: AgentResult[];
    createdAt: string;
    lastActiveAt: string;
    error?: string;
    /** Pending messages from /agents/:id/message while the agent is running */
    pendingMessages: string[];
}
export interface AgentResult {
    iteration: number;
    content: string;
    toolCalls: string[];
    tokens: {
        input: number;
        output: number;
    };
    duration: number;
    timestamp: string;
}
interface CloudAgentCreateRequest {
    name?: string;
    task: string;
    agent?: string;
    schedule?: string;
    webhook?: string;
    maxIterations?: number;
}
interface ParsedCron {
    minute: number[];
    hour: number[];
    dayOfMonth: number[];
    month: number[];
    dayOfWeek: number[];
}
/**
 * Parse a standard 5-field cron expression into expanded arrays.
 *
 * Supports:
 *   - Wildcards: *
 *   - Ranges: 1-5
 *   - Steps: *\/5, 1-10/2
 *   - Lists: 1,3,5
 *   - Combinations: 1-5,10,15-20/2
 *
 * Fields: minute (0-59), hour (0-23), day-of-month (1-31), month (1-12), day-of-week (0-6, Sun=0)
 */
export declare function parseCron(expr: string): ParsedCron;
export declare function shouldRunAt(cron: ParsedCron, date: Date): boolean;
export declare function createCloudAgent(req: CloudAgentCreateRequest): Promise<CloudAgent>;
export declare function listCloudAgents(): CloudAgent[];
export declare function getCloudAgent(id: string): CloudAgent | undefined;
export declare function pauseCloudAgent(id: string): Promise<CloudAgent>;
export declare function resumeCloudAgent(id: string): Promise<CloudAgent>;
export declare function killCloudAgent(id: string): Promise<void>;
export declare function sendMessageToAgent(id: string, message: string): CloudAgent;
/**
 * Returns an async route handler function that can be mounted in the kbot serve HTTP server.
 *
 * Usage in serve.ts:
 *   const cloudRoutes = getCloudAgentRoutes()
 *   // Inside the request handler:
 *   if (await cloudRoutes(req, res)) return // handled
 */
export declare function getCloudAgentRoutes(): (req: IncomingMessage, res: ServerResponse) => Promise<boolean>;
export declare function shutdownCloudAgents(): void;
export {};
//# sourceMappingURL=cloud-agent.d.ts.map