export interface Checkpoint {
    /** Unique checkpoint ID */
    id: string;
    /** Session this checkpoint belongs to */
    sessionId: string;
    /** Unix timestamp (ms) when checkpoint was created */
    timestamp: number;
    /** Tool loop iteration index */
    iteration: number;
    /** Conversation messages accumulated so far */
    messages: any[];
    /** Ordered list of tool names called in this session */
    toolSequenceLog: string[];
    /** Total number of tool calls executed */
    toolCallCount: number;
    /** Cumulative cost in USD across all API calls */
    cumulativeCostUsd: number;
    /** Which specialist agent is running */
    agentId: string;
    /** LLM model being used */
    model: string;
    /** Full system prompt for context reconstruction */
    systemPrompt: string;
    /** Session status — 'in_progress' means resume-eligible */
    status: 'in_progress' | 'completed' | 'failed';
}
export declare class CheckpointManager {
    private dir;
    private initialized;
    constructor(dir?: string);
    /** Ensure the checkpoints directory exists */
    private ensureDir;
    /**
     * Save a checkpoint atomically.
     * Writes to a .tmp file first, then renames to prevent corruption on crash.
     * Prunes old checkpoints to keep only the most recent MAX_CHECKPOINTS_PER_SESSION.
     */
    save(checkpoint: Checkpoint): Promise<void>;
    /**
     * Load the most recent checkpoint for a specific session.
     */
    load(sessionId: string): Promise<Checkpoint | null>;
    /**
     * Find the most recent incomplete checkpoint across all sessions.
     * Used on startup to detect crashed sessions that can be resumed.
     */
    loadLatest(): Promise<Checkpoint | null>;
    /**
     * Mark a session's checkpoints as completed (no resume needed).
     * Updates the most recent checkpoint's status to 'completed'.
     */
    markCompleted(sessionId: string): Promise<void>;
    /**
     * Find all checkpoints with status 'in_progress'.
     * Returns them sorted by timestamp descending (most recent first).
     */
    listIncomplete(): Promise<Checkpoint[]>;
    /**
     * Remove checkpoints older than maxAge.
     * Returns the number of files removed.
     */
    cleanup(maxAge?: number): Promise<number>;
    /**
     * Get all checkpoint files for a session, sorted by timestamp descending.
     */
    private getSessionFiles;
    /**
     * Read and parse a checkpoint file. Returns null on any error.
     */
    private readCheckpoint;
    /**
     * Remove excess checkpoints for a session, keeping only the most recent N.
     */
    private pruneSession;
}
export declare function getCheckpointManager(): CheckpointManager;
/** Generate a new unique session ID for checkpointing */
export declare function newSessionId(): string;
//# sourceMappingURL=checkpoint.d.ts.map