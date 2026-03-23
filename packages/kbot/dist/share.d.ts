import { type ConversationTurn } from './memory.js';
/**
 * Format a conversation into branded markdown for sharing.
 */
export declare function formatShareMarkdown(turns: ConversationTurn[], meta?: {
    name?: string;
    agent?: string;
    created?: string;
}): string;
/**
 * Create a GitHub Gist with the conversation and return the URL.
 */
export declare function createGist(content: string, filename: string, description: string, isPublic?: boolean): string;
export interface ShareResult {
    url?: string;
    copied: boolean;
    method: 'gist' | 'clipboard' | 'stdout';
    markdown: string;
}
/**
 * Share a conversation. Tries GitHub Gist first, falls back to clipboard.
 *
 * @param sessionId - Optional session ID. If omitted, shares current conversation.
 * @param options - Share options
 */
export declare function shareConversation(sessionId?: string, options?: {
    public?: boolean;
    title?: string;
}): Promise<ShareResult>;
//# sourceMappingURL=share.d.ts.map