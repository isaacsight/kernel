export interface Episode {
    /** Unique ID: timestamp-based */
    id: string;
    /** When the session started */
    startedAt: string;
    /** When the session ended */
    endedAt: string;
    /** Duration in minutes */
    durationMinutes: number;
    /** One-line summary of what happened */
    summary: string;
    /** What the user wanted (extracted from first messages) */
    userIntent: string[];
    /** What kbot did (tool calls, agents used) */
    actions: EpisodeAction[];
    /** What was learned (new patterns, knowledge, corrections) */
    learnings: string[];
    /** What was surprising or new (first-time tools, unusual routing, errors) */
    surprises: string[];
    /** Emotional valence of the session */
    valence: 'triumphant' | 'productive' | 'routine' | 'frustrating' | 'exploratory';
    /** Agents used and their frequency */
    agentsUsed: Record<string, number>;
    /** Tools used and their frequency */
    toolsUsed: Record<string, number>;
    /** Total messages exchanged */
    messageCount: number;
    /** Tokens consumed */
    tokensUsed: number;
    /** Errors encountered */
    errors: string[];
    /** Project directory */
    project: string;
    /** Tags for retrieval */
    tags: string[];
}
export interface EpisodeAction {
    /** What tool or agent was invoked */
    action: string;
    /** Brief description of what it did */
    description: string;
    /** Whether it succeeded */
    success: boolean;
    /** Timestamp */
    timestamp: string;
}
/** Start collecting episode data for a new session */
export declare function startEpisode(project: string): void;
/** Record a user message (extracts intent from early messages) */
export declare function recordUserMessage(message: string): void;
/** Record a tool execution */
export declare function recordToolUse(toolName: string, description: string, success: boolean): void;
/** Record agent routing */
export declare function recordAgentUse(agentId: string): void;
/** Record an error */
export declare function recordError(error: string): void;
/** Record something learned */
export declare function recordLearning(learning: string): void;
/** Record something surprising */
export declare function recordSurprise(surprise: string): void;
/** Record token usage */
export declare function recordTokens(tokens: number): void;
/** End the current session and save the episode */
export declare function endEpisode(): Episode | null;
/** List all episodes, newest first */
export declare function listEpisodes(limit?: number): Episode[];
/** Search episodes by tag */
export declare function searchEpisodes(tag: string): Episode[];
/** Get episode stats */
export declare function getEpisodeStats(): {
    total: number;
    totalMinutes: number;
    totalMessages: number;
    totalTokens: number;
    valenceDistribution: Record<string, number>;
    topTools: Array<[string, number]>;
    topAgents: Array<[string, number]>;
};
/** Format episodes for display */
export declare function formatEpisodeList(episodes: Episode[]): string;
//# sourceMappingURL=episodic-memory.d.ts.map