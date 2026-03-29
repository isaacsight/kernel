export interface TelemetryEvent {
    /** Unix timestamp (ms) when event occurred */
    timestamp: number;
    /** Session this event belongs to */
    sessionId: string;
    /** Event type identifier */
    event: string;
    /** Arbitrary event-specific data */
    data: Record<string, any>;
    /** Duration in milliseconds (for timed events) */
    duration_ms?: number;
}
export type EventType = 'session_start' | 'session_end' | 'tool_call_start' | 'tool_call_end' | 'tool_call_error' | 'checkpoint_save' | 'checkpoint_resume' | 'agent_route' | 'api_call' | 'api_error' | 'cost_update' | 'prediction_made';
export declare class TelemetryEmitter {
    private dir;
    private sessionId;
    private buffer;
    private flushTimer;
    private initialized;
    private flushing;
    constructor(sessionId: string, dir?: string);
    /** Ensure the telemetry directory exists */
    private ensureDir;
    /**
     * Emit a telemetry event. Buffers it in memory.
     * When the buffer reaches FLUSH_THRESHOLD, triggers an immediate flush.
     */
    emit(event: EventType, data: Record<string, any>, duration_ms?: number): void;
    /**
     * Flush buffered events to the daily NDJSON file.
     * Each event is one JSON line, appended atomically.
     */
    flush(): Promise<void>;
    /**
     * Read all telemetry events for a specific session.
     * Scans all NDJSON files and filters by sessionId.
     */
    getSessionEvents(sessionId: string): Promise<TelemetryEvent[]>;
    /**
     * Remove telemetry files older than maxAge.
     * Returns the number of files removed.
     */
    cleanup(maxAge?: number): Promise<number>;
    /**
     * Flush remaining events and stop the periodic flush timer.
     * Call this when the session ends or the process is exiting.
     */
    destroy(): Promise<void>;
}
export declare function getTelemetryEmitter(sessionId?: string): TelemetryEmitter;
export declare function destroyTelemetryEmitter(): Promise<void>;
//# sourceMappingURL=telemetry.d.ts.map