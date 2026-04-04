import type { Server, IncomingMessage, ServerResponse } from 'node:http';
/** A2A Agent Card — advertises this agent's capabilities to other agents */
export interface AgentCard {
    name: string;
    description: string;
    version: string;
    url: string;
    provider: {
        organization: string;
        url: string;
    };
    capabilities: {
        streaming: boolean;
        pushNotifications: boolean;
        stateTransitionHistory: boolean;
    };
    skills: AgentSkill[];
    defaultInputModes: string[];
    defaultOutputModes: string[];
}
/** A skill advertised by the agent */
export interface AgentSkill {
    id: string;
    name: string;
    description: string;
    tags: string[];
    examples?: string[];
}
/** A2A Task — represents a unit of work sent between agents */
export interface A2ATask {
    id: string;
    status: A2ATaskStatus;
    message: A2AMessage;
    result?: A2AMessage;
    history?: A2AMessage[];
    metadata?: Record<string, unknown>;
    createdAt: string;
}
/** Task status per A2A lifecycle */
export interface A2ATaskStatus {
    state: 'submitted' | 'working' | 'input-required' | 'completed' | 'failed' | 'canceled';
    message?: string;
    timestamp: string;
}
/** A2A message — the content exchanged between agents */
export interface A2AMessage {
    role: 'user' | 'agent';
    parts: A2APart[];
}
/** A2A content part — text, file, or data */
export type A2APart = {
    type: 'text';
    text: string;
} | {
    type: 'file';
    file: {
        name: string;
        mimeType: string;
        bytes: string;
    };
} | {
    type: 'data';
    data: Record<string, unknown>;
};
/** Registry entry for a discovered remote agent */
export interface RemoteAgent {
    url: string;
    card: AgentCard;
    discoveredAt: string;
    lastContactedAt?: string;
}
/** Build the Agent Card for this kbot instance.
 *
 *  Exposes all 35 kbot agents as A2A skills — 26 specialists from
 *  the SPECIALISTS registry plus 9 preset agents from the matrix system.
 *  Each skill includes tags for capability-based discovery and optional
 *  example prompts.
 */
export declare function buildAgentCard(endpointUrl?: string): AgentCard;
export interface A2ARouteOptions {
    /** Port the server is running on (for Agent Card URL) */
    port?: number;
    /** Full endpoint URL override (e.g. https://my-kbot.example.com) */
    endpointUrl?: string;
    /** Bearer token for authentication (optional) */
    token?: string;
}
/** Get a snapshot of the A2A server status for the a2a_status tool */
export declare function getA2AStatus(): {
    server: {
        running: boolean;
        startedAt: string | null;
        endpointUrl: string | null;
        uptime: string | null;
    };
    tasks: {
        received: number;
        completed: number;
        failed: number;
        active: number;
        stored: number;
    };
    capabilities: {
        totalSkills: number;
        skills: Array<{
            id: string;
            name: string;
            tags: string[];
        }>;
    };
    connections: {
        uniqueClients: number;
        clients: string[];
    };
    registry: {
        remoteAgents: number;
        agents: Array<{
            url: string;
            name: string;
            skills: number;
            lastContact: string | null;
        }>;
    };
};
/**
 * Create the A2A request handler.
 *
 * Supports two interfaces:
 *   1. **JSON-RPC** (A2A spec) — POST to `/a2a` with JSON-RPC envelope
 *   2. **REST** (backward-compatible) — GET/POST to `/a2a/tasks`, `/a2a/tasks/:id`, etc.
 *
 * Agent Card discovery is always at `GET /.well-known/agent.json`.
 */
export declare function createA2AHandler(options?: A2ARouteOptions): (req: IncomingMessage, res: ServerResponse) => Promise<boolean>;
/**
 * Mount A2A routes onto an existing Node.js HTTP Server.
 *
 * Wraps the server's existing request listeners so A2A endpoints are
 * checked first. Non-A2A requests fall through to the original handler.
 */
export declare function mountA2ARoutes(server: Server, options?: A2ARouteOptions): void;
/**
 * Discover a remote A2A agent by fetching its Agent Card.
 *
 * @param url - Base URL of the remote agent (e.g. "http://other-agent:8080")
 * @returns The agent's card, or null if discovery fails
 */
export declare function discoverAgent(url: string): Promise<AgentCard | null>;
/**
 * Send a task to a remote A2A agent and wait for the result.
 *
 * @param agentUrl - Base URL of the remote agent
 * @param task - The task text to send
 * @param options - Optional agent hint and metadata
 * @returns The agent's text response, or null if the task failed
 */
export declare function delegateTask(agentUrl: string, task: string, options?: {
    agent?: string;
    metadata?: Record<string, unknown>;
}): Promise<{
    text: string;
    metadata: Record<string, unknown>;
} | null>;
/**
 * List all discovered remote agents from the local registry.
 */
export declare function listRemoteAgents(): RemoteAgent[];
/**
 * Remove a remote agent from the local registry.
 */
export declare function removeRemoteAgent(url: string): boolean;
/**
 * Find a remote agent that has a skill matching the given tags.
 */
export declare function findAgentBySkill(tags: string[]): RemoteAgent | null;
//# sourceMappingURL=a2a.d.ts.map