export declare const TOOL_TOKENS: {
    readonly think_open: "<think>";
    readonly think_close: "</think>";
    readonly tool_open: "<tool>";
    readonly tool_close: "</tool>";
    readonly args_open: "<args>";
    readonly args_close: "</args>";
    readonly result_open: "<result>";
    readonly result_close: "</result>";
    readonly answer_open: "<answer>";
    readonly answer_close: "</answer>";
};
export interface AgentTraceOptions {
    input?: string;
    output?: string;
    minTools?: number;
    maxResultLen?: number;
    verifiedOnly?: boolean;
}
export interface AgentTraceResult {
    output: string;
    trajectories: number;
    examples: number;
    skipped_no_tools: number;
    skipped_errors: number;
}
export declare function formatAgentTraces(opts?: AgentTraceOptions): AgentTraceResult;
export declare function formatAgentTraceReport(r: AgentTraceResult): string;
//# sourceMappingURL=train-agent-trace.d.ts.map