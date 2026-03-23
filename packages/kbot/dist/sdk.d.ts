import type { UIAdapter } from './ui-adapter.js';
export interface KBotConfig {
    /** AI provider: 'anthropic' | 'openai' | 'ollama' | etc */
    provider?: string;
    /** Model name (e.g. 'claude-sonnet-4-20250514', 'gpt-4o', 'llama3.1') */
    model?: string;
    /** API key (or uses env vars / ~/.kbot/config.json) */
    apiKey?: string;
    /** Custom endpoint URL */
    baseUrl?: string;
    /** Custom UI adapter (default: SilentUIAdapter for SDK usage) */
    ui?: UIAdapter;
    /** Tool permission mode */
    permissionMode?: 'permissive' | 'normal' | 'strict';
}
export interface RunOptions {
    /** Specialist agent ID (e.g. 'coder', 'researcher', 'writer') */
    agent?: string;
    /** Enable streaming output */
    stream?: boolean;
    /** Max tool loop iterations */
    maxIterations?: number;
    /** Whitelist of tool names to make available */
    tools?: string[];
    /** Override system prompt */
    systemPrompt?: string;
    /** Previous messages for context */
    context?: any[];
    /** AbortSignal for cancellation */
    signal?: AbortSignal;
    /** Enable extended thinking */
    thinking?: boolean;
    /** Thinking budget in tokens */
    thinkingBudget?: number;
    /** Tier for tool gating */
    tier?: string;
}
export interface RunResult {
    /** Final text content from the agent */
    content: string;
    /** Tool calls made during execution */
    toolCalls: Array<{
        name: string;
        args: any;
        result?: string;
        error?: string;
        durationMs?: number;
    }>;
    /** Agent that handled the request */
    agent: string;
    /** Model used */
    model: string;
    /** Token usage */
    usage: {
        inputTokens: number;
        outputTokens: number;
    };
    /** Total execution time in ms */
    durationMs: number;
}
export type StreamEvent = {
    type: 'thinking_start';
} | {
    type: 'thinking_delta';
    text: string;
} | {
    type: 'thinking_end';
} | {
    type: 'content_delta';
    text: string;
} | {
    type: 'content_end';
} | {
    type: 'tool_call_start';
    name: string;
    args: any;
} | {
    type: 'tool_call_end';
    name: string;
    result: string;
    error?: string;
} | {
    type: 'agent_route';
    agentId: string;
    method: string;
    confidence: number;
} | {
    type: 'usage';
    inputTokens: number;
    outputTokens: number;
} | {
    type: 'done';
    content: string;
};
export declare const agent: {
    /**
     * Run the agent with a message and get a structured result.
     *
     * @example
     * const result = await agent.run('fix the bug in login.ts')
     * console.log(result.content)
     */
    run(message: string, options?: RunOptions & KBotConfig): Promise<RunResult>;
    /**
     * Stream agent events as an async generator.
     *
     * @example
     * for await (const event of agent.stream('explain this code')) {
     *   if (event.type === 'content_delta') process.stdout.write(event.text)
     * }
     */
    stream(message: string, options?: RunOptions & KBotConfig): AsyncGenerator<StreamEvent>;
};
export declare const tools: {
    /**
     * List all registered tools with their descriptions and parameters.
     *
     * @example
     * const allTools = tools.list()
     * console.log(allTools.map(t => t.name))
     */
    list(): Array<{
        name: string;
        description: string;
        parameters: any;
    }>;
    /**
     * Execute a single tool by name.
     *
     * @example
     * const result = await tools.execute('read_file', { path: 'README.md' })
     * console.log(result.result)
     */
    execute(name: string, args: Record<string, any>): Promise<{
        result: string;
        error?: string;
        durationMs: number;
    }>;
    /**
     * Get a single tool definition by name.
     *
     * @example
     * const readFile = tools.get('read_file')
     * if (readFile) console.log(readFile.description)
     */
    get(name: string): import("./tools/index.js").ToolDefinition | undefined;
};
export declare const providers: {
    /**
     * Auto-detect available providers based on environment variables and config.
     */
    detect(): Promise<Array<{
        name: string;
        models: string[];
    }>>;
    /**
     * List all supported provider names.
     */
    list(): Promise<string[]>;
};
export type { UIAdapter };
export { SilentUIAdapter, CallbackUIAdapter, TerminalUIAdapter } from './ui-adapter.js';
export { ResponseStream } from './streaming.js';
export type { ResponseStreamEvent, ResponseStreamListener } from './streaming.js';
//# sourceMappingURL=sdk.d.ts.map