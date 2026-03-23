/** Load memory context. Returns empty string if none exists. */
export declare function loadMemory(): string;
/** Append a memory entry. Used by the agent to remember things. */
export declare function appendMemory(entry: string): void;
/** Clear all memory */
export declare function clearMemory(): void;
/** Get memory for inclusion in system prompt */
export declare function getMemoryPrompt(): string;
/** Conversation history for current session */
export interface ConversationTurn {
    role: 'user' | 'assistant';
    content: string;
}
/** Add a turn to session history */
export declare function addTurn(turn: ConversationTurn): void;
/** Get session history */
export declare function getHistory(): ConversationTurn[];
/** Clear session history */
export declare function clearHistory(): void;
/** Get the previous_messages array for the API */
export declare function getPreviousMessages(): Array<{
    role: string;
    content: string;
}>;
/** Compact/compress conversation history into a summary.
 *  Keeps the last 4 turns verbatim, summarizes everything before.
 *  This extends session length without losing context.
 */
export declare function compactHistory(): {
    before: number;
    after: number;
    summary: string;
};
/** Restore session history from a saved session */
export declare function restoreHistory(turns: ConversationTurn[]): void;
//# sourceMappingURL=memory.d.ts.map