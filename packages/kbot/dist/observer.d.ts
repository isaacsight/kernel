/**
 * Outcome classification for tool calls.
 * Required for training an action-token model — cannot be backfilled from logs.
 */
export type ToolOutcome = 'success' | 'error' | 'timeout' | 'empty' | 'large';
export interface ObservedToolCall {
    ts: string;
    tool: string;
    args?: Record<string, unknown>;
    result_length?: number;
    session?: string;
    error?: boolean;
    /** Schema version. Absent = v1 (legacy). 2 = includes durationMs/outcome/resultSize. */
    schema?: number;
    /** Wall-clock duration of tool execution in milliseconds. (schema v2+) */
    durationMs?: number;
    /** Outcome classification for training. (schema v2+) */
    outcome?: ToolOutcome;
    /** Bytes of serialized result (Buffer.byteLength of result string). (schema v2+) */
    resultSize?: number;
}
export interface ObserverStats {
    totalObserved: number;
    sessionsObserved: number;
    toolFrequency: Record<string, number>;
    sequencesLearned: number;
    factsLearned: number;
    lastIngested: string;
}
/**
 * Append a tool call observation to the log.
 * Called by the Claude Code PostToolUse hook.
 */
export declare function recordObservation(entry: ObservedToolCall): void;
/**
 * Read new observations from the log file and feed them into kbot's learning engine.
 * Returns the number of new entries processed.
 */
export declare function ingestObservations(): Promise<{
    processed: number;
    patterns: number;
    facts: number;
    sessions: string[];
}>;
export declare function getObserverStats(): ObserverStats;
export declare function getLogPath(): string;
//# sourceMappingURL=observer.d.ts.map