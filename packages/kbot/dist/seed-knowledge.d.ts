export interface SeedPattern {
    intent: string;
    keywords: string[];
    toolSequence: string[];
    category: string;
}
export interface SeedKnowledge {
    fact: string;
    category: 'context' | 'fact' | 'preference' | 'workflow';
}
export declare const SEED_PATTERNS: SeedPattern[];
export declare const SEED_KNOWLEDGE: SeedKnowledge[];
/**
 * Load seed knowledge into kbot's learning engine on first run.
 * Only runs if no existing patterns/knowledge exist (new install).
 */
export declare function loadSeedKnowledge(): Promise<{
    seeded: boolean;
    patterns: number;
    facts: number;
}>;
//# sourceMappingURL=seed-knowledge.d.ts.map