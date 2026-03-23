/** Save cache to disk (debounced externally) */
export declare function saveEmbeddingCache(): void;
/**
 * Compute semantic similarity between two texts.
 * Uses embeddings if Ollama is available, falls back to Jaccard.
 */
export declare function semanticSimilarity(a: string, b: string): Promise<number>;
/**
 * Find the best match from a list of candidates.
 * Returns the candidate with highest similarity above the threshold.
 */
export declare function findBestMatch(query: string, candidates: Array<{
    text: string;
    id: string;
}>, threshold?: number): Promise<{
    id: string;
    score: number;
} | null>;
/**
 * Rank candidates by semantic similarity to query.
 * Returns sorted array with scores.
 */
export declare function rankBySimilarity(query: string, candidates: Array<{
    text: string;
    id: string;
}>, topK?: number): Promise<Array<{
    id: string;
    score: number;
}>>;
/** Warm the embedding cache with common queries (call on startup) */
export declare function warmCache(texts: string[]): Promise<void>;
/** Check if embeddings are available (Ollama + nomic-embed-text) */
export declare function isEmbeddingsAvailable(): Promise<boolean>;
/** Get cache stats */
export declare function getCacheStats(): {
    size: number;
    maxSize: number;
    available: boolean | null;
};
//# sourceMappingURL=embeddings.d.ts.map