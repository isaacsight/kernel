export interface UIAdapter {
    onToolCallStart(toolName: string, args: Record<string, any>): void;
    onToolCallEnd(toolName: string, result: string, error?: string, durationMs?: number): void;
    onThinking(text: string): void;
    onContent(text: string): void;
    onContentEnd(): void;
    onAgentRoute(agentId: string, method: string, confidence: number): void;
    onError(message: string): void;
    onSuccess(message: string): void;
    onInfo(message: string): void;
    onSpinnerStart(text: string): {
        stop: (finalText?: string) => void;
    };
    onWarning(message: string): void;
}
export declare class TerminalUIAdapter implements UIAdapter {
    onToolCallStart(toolName: string, args: Record<string, any>): void;
    onToolCallEnd(_toolName: string, result: string, error?: string): void;
    onThinking(text: string): void;
    onContent(text: string): void;
    onContentEnd(): void;
    onAgentRoute(agentId: string, method: string, confidence: number): void;
    onError(message: string): void;
    onSuccess(message: string): void;
    onInfo(message: string): void;
    onSpinnerStart(text: string): {
        stop: (finalText?: string) => void;
    };
    onWarning(message: string): void;
}
export declare class SilentUIAdapter implements UIAdapter {
    toolCalls: Array<{
        name: string;
        args: any;
        result?: string;
        error?: string;
        durationMs?: number;
    }>;
    content: string;
    errors: string[];
    warnings: string[];
    onToolCallStart(name: string, args: any): void;
    onToolCallEnd(name: string, result: string, error?: string, durationMs?: number): void;
    onThinking(_text: string): void;
    onContent(text: string): void;
    onContentEnd(): void;
    onAgentRoute(): void;
    onError(msg: string): void;
    onSuccess(_msg: string): void;
    onInfo(_msg: string): void;
    onSpinnerStart(_text: string): {
        stop: (finalText?: string) => void;
    };
    onWarning(msg: string): void;
}
export declare class CallbackUIAdapter implements UIAdapter {
    private callbacks;
    constructor(callbacks?: Partial<UIAdapter>);
    onToolCallStart(name: string, args: any): void;
    onToolCallEnd(name: string, result: string, error?: string, durationMs?: number): void;
    onThinking(text: string): void;
    onContent(text: string): void;
    onContentEnd(): void;
    onAgentRoute(id: string, method: string, confidence: number): void;
    onError(msg: string): void;
    onSuccess(msg: string): void;
    onInfo(msg: string): void;
    onSpinnerStart(text: string): {
        stop: (finalText?: string) => void;
    };
    onWarning(msg: string): void;
}
//# sourceMappingURL=ui-adapter.d.ts.map