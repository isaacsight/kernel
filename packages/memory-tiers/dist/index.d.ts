/** A raw observation from an interaction */
export interface Observation {
    id: string;
    text: string;
    category: ObservationCategory;
    timestamp: string;
    /** Optional metadata (e.g., task type, agent used) */
    metadata?: Record<string, unknown>;
}
/** Categories for observations */
export type ObservationCategory = 'preference' | 'pattern' | 'fact' | 'tool_usage' | 'outcome' | 'correction' | 'general';
/** A synthesized insight from multiple observations */
export interface Reflection {
    id: string;
    text: string;
    category: string;
    /** How many observations support this reflection */
    supportingCount: number;
    /** Confidence (0-1), based on evidence weight */
    confidence: number;
    /** IDs of observations that led to this reflection */
    sources: string[];
    timestamp: string;
}
/** Long-term identity trait evolved from reflections */
export interface IdentityTrait {
    trait: string;
    strength: number;
    evidence: string[];
    firstSeen: string;
    lastReinforced: string;
}
/** Full memory state */
export interface MemoryState {
    observations: Observation[];
    reflections: Reflection[];
    identity: IdentityTrait[];
    stats: {
        totalObservations: number;
        totalReflections: number;
        totalIdentityTraits: number;
        lastSynthesis: string | null;
        lastEvolution: string | null;
        synthesisCount: number;
        evolutionCount: number;
    };
}
/** Configuration for the memory system */
export interface MemoryConfig {
    /** Max observations to keep (default: 500) */
    maxObservations?: number;
    /** Max reflections to keep (default: 100) */
    maxReflections?: number;
    /** Max identity traits (default: 20) */
    maxIdentity?: number;
    /** Min observations before synthesis triggers (default: 10) */
    synthesisThreshold?: number;
    /** Min reflections before evolution triggers (default: 5) */
    evolutionThreshold?: number;
}
export declare class MemorySystem {
    private state;
    private config;
    constructor(config?: MemoryConfig);
    /**
     * Record a raw observation.
     * Category is auto-detected from text if not provided.
     */
    observe(text: string, category?: ObservationCategory, metadata?: Record<string, unknown>): Observation;
    /** Get all observations, optionally filtered by category */
    getObservations(category?: ObservationCategory): Observation[];
    /**
     * Synthesize observations into reflections.
     * Groups observations by similar content and produces insights.
     * No LLM calls — uses word overlap and frequency analysis.
     */
    synthesize(): Reflection[];
    /** Get all reflections, optionally filtered by category */
    getReflections(category?: string): Reflection[];
    /**
     * Evolve identity traits from reflections.
     * Identifies stable patterns across reflections and crystallizes them.
     */
    evolve(): IdentityTrait[];
    /** Get all identity traits */
    getIdentity(): IdentityTrait[];
    /** Export full state as JSON */
    toJSON(): string;
    /** Import state from JSON */
    fromJSON(json: string): void;
    /** Save state to a file */
    save(path: string): void;
    /** Load state from a file */
    load(path: string): void;
    /** Get stats about the memory system */
    getStats(): {
        totalObservations: number;
        totalReflections: number;
        totalIdentityTraits: number;
        lastSynthesis: string | null;
        lastEvolution: string | null;
        synthesisCount: number;
        evolutionCount: number;
    };
    /** Get a human-readable summary */
    summary(): string;
}
//# sourceMappingURL=index.d.ts.map