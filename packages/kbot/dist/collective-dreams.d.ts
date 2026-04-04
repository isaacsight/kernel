import type { DreamInsight, DreamCategory } from './dream.js';
export interface AnonymizedInsight {
    /** Category preserved as-is */
    category: DreamCategory;
    /** Keywords with PII stripped */
    keywords: string[];
    /** Generalized version of the content (no personal details) */
    generalizedContent: string;
    /** How many contributors have shared similar insights */
    contributorCount: number;
    /** First time this insight appeared in the collective */
    firstSeen: string;
    /** Most recent contribution timestamp */
    lastSeen: string;
}
/**
 * Anonymize a single dream insight for collective sharing.
 * Strips personal info, keeps only category, keywords, and generalized content.
 */
export declare function anonymizeDreamInsight(insight: DreamInsight): AnonymizedInsight;
/**
 * Prepare a batch of dream insights for collective sharing.
 *   1. Filter to high-relevance insights (> 0.7)
 *   2. Anonymize each
 *   3. Deduplicate by content similarity
 */
export declare function prepareCollectiveDreams(insights: DreamInsight[]): AnonymizedInsight[];
/**
 * Merge collective wisdom into the local dream journal.
 *
 * Collective insights are injected with a lower base relevance (0.5) so they
 * don't drown out the user's own insights but still surface when relevant.
 * Deduplicates against existing local insights by content similarity.
 */
export declare function mergeCollectiveDreams(local: DreamInsight[], collective: AnonymizedInsight[]): DreamInsight[];
//# sourceMappingURL=collective-dreams.d.ts.map