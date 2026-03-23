import type { ConversationTurn } from './context-manager.js';
export interface EntropyScore {
    entropy: number;
    novelty: number;
    density: number;
    composite: number;
}
export interface RankedTurn {
    turn: ConversationTurn;
    score: EntropyScore;
    rank: number;
}
export declare const STOPWORDS: Set<string>;
/** Shannon entropy — bits per character. Higher = more diverse/novel text. */
export declare function calculateEntropy(text: string): number;
/** How much new information a turn adds vs what's already in context. */
export declare function calculateSemanticNovelty(turn: string, previousTurns: string[]): number;
/** Ratio of unique meaningful tokens to total tokens. */
export declare function informationDensity(text: string): number;
export declare class EntropyScorer {
    /**
     * Composite score formula:
     * 0.4 * novelty + 0.35 * density + 0.25 * normalizedEntropy
     *
     * Novelty weighted highest: redundant info is the biggest waste.
     * Density second: filler text wastes tokens.
     * Raw entropy lowest: can be high for random/noisy text too.
     */
    scoreTurn(turn: ConversationTurn, history: ConversationTurn[]): EntropyScore;
    /** Rank all turns by information value (highest first). */
    rankTurns(turns: ConversationTurn[]): RankedTurn[];
    /**
     * Keep highest-entropy turns within token budget.
     * Low-entropy turns are summarized or dropped.
     */
    compress(turns: ConversationTurn[], tokenBudget: number, keepRecentCount?: number): ConversationTurn[];
    /** Returns true if turn adds < 0.2 novelty — candidate for eviction. */
    shouldEvict(turn: ConversationTurn, history: ConversationTurn[]): boolean;
}
//# sourceMappingURL=entropy-context.d.ts.map