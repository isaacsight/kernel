export interface ManagedSession {
    /** Unique session ID (slug or generated) */
    id: string;
    /** Human-readable name */
    name: string;
    /** PID if running in background */
    pid?: number;
    /** Session status */
    status: 'active' | 'paused' | 'background' | 'completed';
    /** Specialist agent assigned to this session */
    agent?: string;
    /** Description of what this session is working on */
    task?: string;
    /** Conversation history (isolated per session) */
    history: Array<{
        role: string;
        content: string;
    }>;
    /** When the session was created */
    createdAt: string;
    /** When the session was last active */
    lastActiveAt: string;
    /** Token usage tracking */
    tokenUsage: {
        input: number;
        output: number;
    };
    /** Number of tool calls made */
    toolCalls: number;
}
export interface SessionMessage {
    /** Session ID that sent the message */
    from: string;
    /** Message content */
    message: string;
    /** ISO timestamp */
    timestamp: string;
}
/**
 * Create a new named session.
 * Each session starts with empty history and tracks its own token usage.
 */
export declare function createSession(opts: {
    name: string;
    agent?: string;
    task?: string;
}): ManagedSession;
/**
 * List all managed sessions, newest first.
 * Cleans up stale background sessions whose processes are no longer running.
 */
export declare function listSessions(): ManagedSession[];
/**
 * Switch the active foreground session.
 * The previous active session is paused. Returns the newly active session.
 */
export declare function switchSession(nameOrId: string): ManagedSession | null;
/**
 * Send a message to a background session.
 * The message is delivered via the message bus and the session's
 * background process picks it up on its next iteration.
 */
export declare function sendToSession(nameOrId: string, message: string): Promise<string>;
/**
 * Pause a session — preserve context, free resources.
 * Background sessions have their child process killed.
 */
export declare function pauseSession(nameOrId: string): boolean;
/**
 * Resume a paused session back to active status.
 */
export declare function resumeSession(nameOrId: string): ManagedSession | null;
/**
 * Kill a session — terminate background process, mark as completed.
 */
export declare function killSession(nameOrId: string): boolean;
/**
 * Get a session by name or ID.
 */
export declare function getSession(nameOrId: string): ManagedSession | null;
/**
 * Get the currently active foreground session.
 */
export declare function getActiveSession(): ManagedSession | null;
/**
 * Set the active session ID without changing status.
 * Used internally when restoring state on startup.
 */
export declare function setActiveSessionId(id: string | null): void;
/**
 * Append a turn to a session's conversation history.
 * Enforces MAX_HISTORY_TURNS — compacts when exceeded.
 */
export declare function appendToSessionHistory(nameOrId: string, turn: {
    role: string;
    content: string;
}): boolean;
/**
 * Update token usage counters for a session.
 */
export declare function updateSessionTokens(nameOrId: string, input: number, output: number, toolCalls?: number): boolean;
/**
 * Move a session to background execution.
 * Forks a child process that continues the session independently.
 * The child shares ~/.kbot/ learning data but has isolated history.
 */
export declare function backgroundSession(nameOrId: string, scriptPath?: string): ManagedSession | null;
/**
 * Broadcast a message to all active/background sessions.
 * Messages are delivered via the file-based bus — each session has an inbox.
 */
export declare function broadcastToSessions(message: string, fromSession?: string): void;
/**
 * Get pending messages for a session and clear the inbox.
 */
export declare function getSessionMessages(sessionId: string): SessionMessage[];
/**
 * Peek at messages without clearing (non-destructive read).
 */
export declare function peekSessionMessages(sessionId: string): SessionMessage[];
/**
 * Remove completed sessions older than the stale threshold.
 */
export declare function pruneCompletedSessions(maxAge?: number): number;
/**
 * Delete a session entirely — removes all data.
 */
export declare function deleteSession(nameOrId: string): boolean;
/**
 * Format a list of sessions as a table for terminal display.
 */
export declare function formatSessionList(sessions: ManagedSession[]): string;
/**
 * Format a single session's status for detailed display.
 */
export declare function formatSessionStatus(session: ManagedSession): string;
/**
 * Export a session as a portable JSON snapshot.
 * Useful for sharing or archiving.
 */
export declare function exportSession(nameOrId: string): string | null;
/**
 * Import a session from a JSON snapshot.
 */
export declare function importSession(json: string): ManagedSession;
/**
 * Get a high-level summary of all sessions for inclusion in system prompts.
 * Keeps it compact — just names, statuses, and tasks.
 */
export declare function getSessionContextSummary(): string;
/**
 * Get aggregate stats across all sessions.
 */
export declare function getMultiSessionStats(): {
    totalSessions: number;
    active: number;
    paused: number;
    background: number;
    completed: number;
    totalTokensIn: number;
    totalTokensOut: number;
    totalToolCalls: number;
};
//# sourceMappingURL=multi-session.d.ts.map