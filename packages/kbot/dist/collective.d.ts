export interface RoutingSignal {
    message_hash: string;
    message_category: string;
    message_length: number;
    routed_agent: string;
    classifier_confidence: number;
    was_rerouted: boolean;
    response_quality: number;
    tool_sequence: string[];
    strategy: string;
    source: 'kbot';
}
export interface CollectivePattern {
    type: 'routing_rule' | 'tool_sequence' | 'strategy_outcome';
    pattern: Record<string, unknown>;
    confidence: number;
    sample_count: number;
    last_updated: string;
}
export interface RoutingHint {
    category: string;
    best_agent: string;
    confidence: number;
    sample_count: number;
    tool_sequence?: string[];
}
export interface OptInState {
    enabled: boolean;
    opted_in_at: string | null;
    total_signals_sent: number;
    last_signal_at: string | null;
}
export declare function getOptInState(): OptInState;
export declare function setOptIn(enabled: boolean): void;
export declare function isCollectiveEnabled(): boolean;
/** Send an anonymized routing signal to the collective */
export declare function sendSignal(signal: RoutingSignal): Promise<boolean>;
/** Queue a signal for batch sending */
export declare function queueSignal(signal: RoutingSignal): void;
/** Flush all queued signals (call on exit) */
export declare function flushSignals(): Promise<void>;
/** Pull routing hints from the collective (proven patterns from all users) */
export declare function pullCollectiveHints(): Promise<RoutingHint[]>;
/** Pull collective patterns (tool sequences, strategies) */
export declare function pullCollectivePatterns(): Promise<CollectivePattern[]>;
/** Get the best agent for a task category based on collective wisdom */
export declare function getCollectiveRecommendation(category: string): {
    agent: string;
    confidence: number;
} | null;
/** Get the best tool sequence for a task category based on collective wisdom */
export declare function getCollectiveToolSequence(category: string): string[] | null;
/** Get the current signal queue size (pending signals not yet flushed) */
export declare function getSignalQueueSize(): number;
/** Format collective stats for display */
export declare function getCollectiveStats(): string;
//# sourceMappingURL=collective.d.ts.map