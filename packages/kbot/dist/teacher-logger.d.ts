export interface TeacherTrace {
    id: string;
    ts: number;
    session_id?: string;
    provider: string;
    model: string;
    system: string;
    messages: Array<{
        role: string;
        content: string;
    }>;
    response: {
        content: string;
        thinking?: string;
        tool_calls?: Array<{
            id: string;
            name: string;
            arguments: Record<string, unknown>;
        }>;
        stop_reason?: string;
    };
    usage?: {
        input_tokens: number;
        output_tokens: number;
    };
    latency_ms?: number;
    outcome?: {
        verified: boolean;
        signal: 'user_retry' | 'build_pass' | 'test_pass' | 'tool_error' | 'self_eval' | 'none';
        score?: number;
    };
    tags?: string[];
}
export interface TeacherLoggerOptions {
    enabled?: boolean;
    dir?: string;
    maxBytes?: number;
    scrub?: boolean;
}
declare class TeacherLogger {
    private enabled;
    private dir;
    private traceFile;
    private maxBytes;
    private scrub;
    private pending;
    constructor(opts?: TeacherLoggerOptions);
    isEnabled(): boolean;
    setEnabled(v: boolean): void;
    /** Begin a trace — returns an ID to finalize later */
    begin(input: {
        sessionId?: string;
        provider: string;
        model: string;
        system: string;
        messages: Array<{
            role: string;
            content: string;
        }>;
    }): string;
    /** Finalize a trace with the model response. No-op if id is empty/unknown. */
    end(id: string, response: TeacherTrace['response'], usage?: TeacherTrace['usage'], outcome?: TeacherTrace['outcome']): void;
    /** Tag an already-persisted trace with outcome later (e.g. after verifier runs). */
    tagOutcome(traceId: string, outcome: TeacherTrace['outcome']): void;
    private persist;
    path(): string;
}
export declare function getTeacherLogger(): TeacherLogger;
export declare function setTeacherLogger(logger: TeacherLogger): void;
export {};
//# sourceMappingURL=teacher-logger.d.ts.map