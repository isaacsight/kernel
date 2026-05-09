/**
 * Anthropic Managed Agents client (April 2026 launch).
 *
 * Hosted long-horizon agent platform. This module is a STANDALONE backend
 * that workspace agents can route through when ANTHROPIC_API_KEY is set.
 * Wiring into ./workspace-agents.ts happens in a follow-up pass.
 *
 * Beta header: `anthropic-beta: managed-agents-2026-04-01` is sent on every
 * request.
 *
 * SPEC: best-effort, refine when official docs published.
 * Endpoint shape mirrors the public beta announcement; refine when the
 * official OpenAPI spec lands.
 */
export interface CreateSessionInput {
    mission: string;
    allowedTools?: string[];
    model?: string;
}
export interface CreateSessionOutput {
    session_id: string;
    [key: string]: unknown;
}
export interface SendTurnInput {
    sessionId: string;
    input: string;
}
export interface SendTurnOutput {
    output: string;
    tool_calls?: unknown[];
    [key: string]: unknown;
}
export interface SessionState {
    session_id: string;
    mission?: string;
    status?: string;
    [key: string]: unknown;
}
export interface ListSessionsOutput {
    sessions: SessionState[];
    [key: string]: unknown;
}
export interface MemoryReadInput {
    sessionId: string;
    key?: string;
}
export interface MemoryWriteInput {
    sessionId: string;
    key: string;
    value: unknown;
}
export interface MemoryAck {
    ok: boolean;
    [key: string]: unknown;
}
export declare class AnthropicManagedAgentsError extends Error {
    readonly status: number;
    readonly body: string;
    constructor(message: string, status: number, body: string);
}
export interface AnthropicManagedAgentsClientOptions {
    /** Override the API key (default: process.env.ANTHROPIC_API_KEY). */
    apiKey?: string;
    /** Override the base URL (default: https://api.anthropic.com/v1). */
    baseUrl?: string;
    /** Override fetch (used by tests). */
    fetchImpl?: typeof fetch;
}
export declare class AnthropicManagedAgentsClient {
    private readonly apiKey;
    private readonly baseUrl;
    private readonly fetchImpl;
    constructor(opts?: AnthropicManagedAgentsClientOptions);
    createSession(input: CreateSessionInput): Promise<CreateSessionOutput>;
    sendTurn(input: SendTurnInput): Promise<SendTurnOutput>;
    getSession(input: {
        sessionId: string;
    }): Promise<SessionState>;
    listSessions(): Promise<ListSessionsOutput>;
    closeSession(input: {
        sessionId: string;
    }): Promise<{
        ok: boolean;
        [key: string]: unknown;
    }>;
    memoryRead(input: MemoryReadInput): Promise<unknown>;
    memoryWrite(input: MemoryWriteInput): Promise<MemoryAck>;
    private request;
}
//# sourceMappingURL=managed-agents-anthropic.d.ts.map