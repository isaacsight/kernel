export type KnowledgeSource = 'conversation' | 'forge' | 'pattern' | 'web_search' | 'user_question' | 'email' | 'manual';
export interface KnowledgeEntry {
    /** Unique ID (SHA-256 hash of content + source) */
    id: string;
    /** Primary topic this entry belongs to */
    topic: string;
    /** The actual knowledge content */
    content: string;
    /** Where this knowledge came from */
    source: KnowledgeSource;
    /** Source detail (e.g., tool name, email subject, URL) */
    sourceDetail: string;
    /** Confidence in this knowledge (0-1) */
    confidence: number;
    /** Tags for cross-referencing */
    tags: string[];
    /** When this entry was created */
    createdAt: string;
    /** When this entry was last verified/updated */
    updatedAt: string;
}
export interface KnowledgeIndex {
    /** Total number of entries across all topics */
    totalEntries: number;
    /** Map of topic slug -> entry count */
    topics: Record<string, number>;
    /** Map of source type -> entry count */
    sources: Record<string, number>;
    /** Last time the index was updated */
    lastUpdated: string;
}
export interface KnowledgeQueryResult {
    /** The matching entry */
    entry: KnowledgeEntry;
    /** Relevance score (higher = more relevant) */
    relevance: number;
}
export interface KnowledgeStats {
    total_entries: number;
    topics: string[];
    sources: Record<string, number>;
    last_updated: string;
}
export declare class KnowledgeBase {
    private indexCache;
    constructor();
    /**
     * Add knowledge from any source.
     * Deduplicates by content hash.
     * Tags with source, confidence, timestamp.
     */
    ingest(source: KnowledgeSource, content: string, metadata?: {
        topic?: string;
        sourceDetail?: string;
        confidence?: number;
        tags?: string[];
    }): KnowledgeEntry;
    /**
     * Search the knowledge base for relevant entries.
     * Uses keyword matching + cosine similarity on TF-IDF vectors.
     * Returns ranked results with sources.
     */
    query(question: string): KnowledgeQueryResult[];
    /**
     * Get everything kbot knows about a topic, synthesized into a readable summary.
     * Pulls from all sources and organizes by type.
     */
    getTopicSummary(topic: string): string;
    /**
     * Extract knowledge from an email/conversation thread.
     * Pulls out facts, decisions, recommendations.
     */
    addFromConversation(userEmail: string, messages: Array<{
        role: string;
        content: string;
    }>): KnowledgeEntry[];
    /**
     * When a tool is forged, extract what problem it solves and add to KB.
     */
    addFromForge(tool: {
        name: string;
        description: string;
        tags?: string[];
        code?: string;
    }): KnowledgeEntry;
    /**
     * Get knowledge base statistics.
     */
    getStats(): KnowledgeStats;
    /** Load or rebuild the index */
    private loadIndex;
    /** Rebuild the index from all topic files */
    private rebuildIndex;
}
//# sourceMappingURL=knowledge-base.d.ts.map