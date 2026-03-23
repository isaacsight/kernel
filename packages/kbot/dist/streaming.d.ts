/**
 * Strip `<think>...</think>` blocks from model output.
 * Reasoning models (DeepSeek R1, Qwen with thinking) emit these tags.
 */
export declare function stripThinkTags(text: string): string;
/** Streaming event types from Claude API */
export interface StreamEvent {
    type: string;
    index?: number;
    delta?: {
        type?: string;
        text?: string;
        partial_json?: string;
        thinking?: string;
    };
    content_block?: {
        type: string;
        text?: string;
        id?: string;
        name?: string;
        thinking?: string;
    };
    message?: {
        id: string;
        content: Array<{
            type: string;
            text?: string;
            thinking?: string;
        }>;
        usage: {
            input_tokens: number;
            output_tokens: number;
        };
        stop_reason: string;
        model: string;
    };
    usage?: {
        input_tokens: number;
        output_tokens: number;
    };
}
/** State for tracking a streaming response */
export interface StreamState {
    thinking: string;
    content: string;
    toolCalls: Array<{
        id: string;
        name: string;
        partialJson: string;
    }>;
    model: string;
    usage: {
        input_tokens: number;
        output_tokens: number;
    };
    stopReason: string;
    isThinking: boolean;
    thinkingDisplayed: boolean;
}
export declare function createStreamState(): StreamState;
/**
 * Stream a response from the Anthropic API with thinking display.
 * Shows thinking in dim italic text, then the final response.
 */
export declare function streamAnthropicResponse(apiKey: string, apiUrl: string, model: string, system: string, messages: Array<{
    role: string;
    content: unknown;
}>, tools?: Array<{
    name: string;
    description: string;
    input_schema: Record<string, unknown>;
}>, options?: {
    thinking?: boolean;
    thinkingBudget?: number;
    responseStream?: ResponseStream;
}): Promise<StreamState>;
/**
 * Stream a response from OpenAI-compatible APIs.
 * These don't have thinking blocks but we stream tokens progressively.
 */
export declare function streamOpenAIResponse(apiKey: string, apiUrl: string, model: string, system: string, messages: Array<{
    role: string;
    content: string;
}>, tools?: Array<{
    name: string;
    description: string;
    input_schema: Record<string, unknown>;
}>, options?: {
    responseStream?: ResponseStream;
}): Promise<StreamState>;
export type ResponseStreamEvent = {
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
    id: string;
    name: string;
} | {
    type: 'tool_call_delta';
    id: string;
    json: string;
} | {
    type: 'tool_call_end';
    id: string;
    name: string;
} | {
    type: 'tool_result';
    id: string;
    name: string;
    result: string;
    error?: string;
} | {
    type: 'usage';
    inputTokens: number;
    outputTokens: number;
} | {
    type: 'error';
    message: string;
    code?: string;
} | {
    type: 'done';
    content: string;
    thinking?: string;
};
export type ResponseStreamListener = (event: ResponseStreamEvent) => void;
export declare class ResponseStream {
    private listeners;
    private _content;
    private _thinking;
    private _toolCalls;
    private _usage;
    private _done;
    /** Subscribe to events. Returns an unsubscribe function. */
    on(listener: ResponseStreamListener): () => void;
    /** Emit an event to all listeners, tracking accumulated state. */
    emit(event: ResponseStreamEvent): void;
    get content(): string;
    get thinking(): string;
    get usage(): {
        inputTokens: number;
        outputTokens: number;
    };
    get isDone(): boolean;
    /** Async iterator for SDK consumers: `for await (const event of stream) { ... }` */
    [Symbol.asyncIterator](): AsyncGenerator<ResponseStreamEvent>;
    /** Create terminal listener (writes to stdout/stderr like current behavior) */
    static createTerminalListener(): ResponseStreamListener;
    /** Create SSE listener (for HTTP serve mode) */
    static createSSEListener(res: {
        write: (data: string) => void;
    }): ResponseStreamListener;
}
/**
 * Format thinking text for display (summarized).
 * Used when showing thinking after the fact rather than streaming.
 */
export declare function formatThinkingSummary(thinking: string): string;
//# sourceMappingURL=streaming.d.ts.map