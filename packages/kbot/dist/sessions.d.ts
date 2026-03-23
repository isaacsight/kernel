import { type ConversationTurn } from './memory.js';
export interface Session {
    /** Unique session ID */
    id: string;
    /** Human-readable name */
    name: string;
    /** When the session was created */
    created: string;
    /** When it was last updated */
    updated: string;
    /** Working directory when session was created */
    cwd: string;
    /** Number of turns in the conversation */
    turnCount: number;
    /** First user message (for preview) */
    preview: string;
    /** The conversation history */
    history: ConversationTurn[];
    /** Agent that was active */
    agent?: string;
    /** Any context notes */
    notes?: string;
}
/** Save the current conversation as a session */
export declare function saveSession(name?: string, agent?: string): Session;
/** Load a session by ID or name */
export declare function loadSession(idOrName: string): Session | null;
/** List all saved sessions, newest first */
export declare function listSessions(): Session[];
/** Delete a session */
export declare function deleteSession(idOrName: string): boolean;
/** Update an existing session with current history */
export declare function updateSession(id: string, agent?: string): Session | null;
/** Get the most recent session for auto-resume */
export declare function getLastSession(): Session | null;
/** Format session list for display */
export declare function formatSessionList(sessions: Session[]): string;
//# sourceMappingURL=sessions.d.ts.map