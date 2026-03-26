import { type ConversationTurn } from './memory.js';
/** A side conversation record */
export interface SideConversation {
    /** Unique side conversation ID */
    id: string;
    /** Topic of the side conversation */
    topic: string;
    /** When it was started */
    started_at: string;
    /** When it was ended (null if still active) */
    ended_at: string | null;
    /** The saved main context history at the time of branching */
    main_context: ConversationTurn[];
    /** The side conversation's own history */
    side_history: ConversationTurn[];
    /** Summary/findings from the side conversation */
    findings: string[];
    /** Whether the side conversation is still active */
    active: boolean;
}
/**
 * Start a side conversation.
 * Saves current conversation context to a stack, starts fresh
 * context for the side topic.
 */
export declare function startSideConversation(topic: string): {
    side_id: string;
    main_context_preserved: boolean;
};
/**
 * End a side conversation.
 * Pops the side conversation from the stack, restores main context.
 * Extracts useful findings from the side convo to merge into main.
 */
export declare function endSideConversation(sideId: string): {
    restored: boolean;
    findings_merged: number;
};
/**
 * List all side conversations (active and completed).
 */
export declare function listSideConversations(): SideConversation[];
/**
 * Get the result/summary of a completed side conversation.
 */
export declare function getSideConversationResult(sideId: string): {
    id: string;
    topic: string;
    findings: string[];
    turn_count: number;
    duration_ms: number;
} | null;
/**
 * Clean up old completed side conversations.
 * Keeps only the most recent N completed conversations.
 */
export declare function pruneOldSideConversations(keepCount?: number): number;
//# sourceMappingURL=side-conversation.d.ts.map