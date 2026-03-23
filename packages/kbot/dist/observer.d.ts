export interface ObservedToolCall {
    ts: string;
    tool: string;
    args?: Record<string, unknown>;
    result_length?: number;
    session?: string;
    error?: boolean;
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