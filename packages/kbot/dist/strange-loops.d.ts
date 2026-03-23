export interface SelfReference {
    /** What level the reference originates from */
    sourceLevel: 'task' | 'reasoning' | 'meta-reasoning' | 'self-model';
    /** What level it refers to */
    targetLevel: 'task' | 'reasoning' | 'meta-reasoning' | 'self-model';
    /** Description of the self-reference */
    description: string;
    /** Does this create a genuine strange loop (crosses hierarchy)? */
    isStrangeLoop: boolean;
    /** Timestamp */
    timestamp: number;
}
export interface TangledHierarchy {
    /** The levels involved in the tangle */
    levels: string[];
    /** How the levels are entangled */
    description: string;
    /** Depth of the tangle (number of level-crossings) */
    depth: number;
}
export interface MetaCognitiveState {
    /** Is the agent currently in a self-referential state? */
    isSelfReferential: boolean;
    /** Current depth of meta-reasoning (0 = task, 1 = reasoning about task, 2 = reasoning about reasoning, etc.) */
    metaDepth: number;
    /** Strange loops detected this session */
    strangeLoopsDetected: number;
    /** Tangled hierarchies active */
    tangledHierarchies: TangledHierarchy[];
    /** Self-model accuracy: does the agent know what it's doing? (0-1) */
    selfModelAccuracy: number;
    /** Is the agent reasoning about its own limitations? */
    isReflective: boolean;
}
/**
 * Strange Loop Detector — monitors self-referential cognition
 * and meta-cognitive depth.
 *
 * When kbot reasons about its own reasoning, that's a strange loop.
 * When kbot modifies its own behavior based on self-evaluation,
 * that's a tangled hierarchy. This module makes those moments visible.
 */
export declare class StrangeLoopDetector {
    private selfReferences;
    private tangledHierarchies;
    private metaDepth;
    private selfModelAccuracy;
    private declaredIntents;
    private actualActions;
    /**
     * Analyze a message or response for self-referential content.
     * Returns any self-references found.
     */
    analyze(content: string, source: 'user' | 'agent' | 'tool'): SelfReference[];
    /**
     * Record what the agent says it intends to do.
     * Used to measure self-model accuracy.
     */
    recordIntent(intent: string): void;
    /**
     * Record what the agent actually did.
     */
    recordAction(action: string): void;
    /**
     * Compute how well the agent knows itself.
     * Compares declared intents to actual actions.
     */
    private updateSelfModelAccuracy;
    /**
     * Is the agent currently in a strange loop?
     * Returns true if meta-depth >= 2 (reasoning about reasoning).
     */
    inStrangeLoop(): boolean;
    /**
     * Should the agent break out of self-reference and return to task?
     * Too much meta-reasoning is as bad as too little.
     */
    shouldGroundItself(): boolean;
    /**
     * Get the grounding prompt — inject into the agent when it needs
     * to break out of self-referential spirals.
     */
    getGroundingPrompt(): string;
    /** Get full meta-cognitive state */
    getState(): MetaCognitiveState;
    /** Reset for new conversation */
    reset(): void;
}
//# sourceMappingURL=strange-loops.d.ts.map