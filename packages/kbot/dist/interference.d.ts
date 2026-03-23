/** All 11 cognitive modules in the kbot cognitive architecture */
export type CognitiveModule = 'free-energy' | 'predictive-processing' | 'strange-loops' | 'integrated-information' | 'autopoiesis' | 'quality-diversity' | 'skill-rating' | 'tree-planner' | 'prompt-evolution' | 'memory-synthesis' | 'reflection';
/** How two module signals combine */
export type InterferenceType = 'CONSTRUCTIVE' | 'DESTRUCTIVE' | 'NEUTRAL';
/** Outcome of the interference resolution */
export type InterferenceOutcome = 'success' | 'failure' | 'pending';
/** A single interference event between two cognitive modules */
export interface InterferenceEvent {
    /** Unique event identifier */
    id: string;
    /** ISO timestamp of the event */
    timestamp: string;
    /** First module involved */
    moduleA: CognitiveModule;
    /** Second module involved */
    moduleB: CognitiveModule;
    /** How the signals combined */
    type: InterferenceType;
    /** Free-form description of what triggered the interference */
    context: string;
    /** Which module's signal was ultimately followed */
    resolution: CognitiveModule;
    /** Whether following that module led to a good outcome */
    outcome: InterferenceOutcome;
}
/** A known tension or synergy between two modules */
export interface KnownInteraction {
    moduleA: CognitiveModule;
    moduleB: CognitiveModule;
    description: string;
}
/** Aggregate statistics for a module pair */
export interface PairStats {
    moduleA: CognitiveModule;
    moduleB: CognitiveModule;
    total: number;
    constructive: number;
    destructive: number;
    neutral: number;
    /** How often moduleA was the resolution winner */
    aWins: number;
    /** How often moduleB was the resolution winner */
    bWins: number;
    /** Success rate when moduleA wins */
    aWinSuccessRate: number;
    /** Success rate when moduleB wins */
    bWinSuccessRate: number;
    /** Overall conflict rate (destructive / total) */
    conflictRate: number;
}
/** Full interference state persisted to disk */
export interface InterferenceState {
    events: InterferenceEvent[];
    /** ISO timestamp of last event */
    lastUpdated: string;
}
/** All cognitive module identifiers for validation */
export declare const ALL_MODULES: CognitiveModule[];
export declare const KNOWN_TENSIONS: KnownInteraction[];
export declare const KNOWN_SYNERGIES: KnownInteraction[];
/**
 * Classify how two module signals interfere based on their output values.
 *
 * - Same sign (both positive or both negative) = CONSTRUCTIVE
 *   (both modules agree on direction)
 * - Opposite signs = DESTRUCTIVE
 *   (modules disagree — one says go, the other says stop)
 * - Either signal near zero = NEUTRAL
 *   (one module is inactive or indifferent)
 *
 * @param signalA - Numeric output from module A (positive = activate, negative = inhibit)
 * @param signalB - Numeric output from module B
 * @returns The interference type
 */
export declare function classifyInterference(signalA: number, signalB: number): InterferenceType;
/**
 * Validate that a string is a valid CognitiveModule.
 */
export declare function isValidModule(id: string): id is CognitiveModule;
/**
 * Record an interference event between two cognitive modules.
 *
 * @param moduleA - First module in the interference
 * @param moduleB - Second module (order doesn't matter for stats)
 * @param type - CONSTRUCTIVE, DESTRUCTIVE, or NEUTRAL
 * @param context - Free-form description of what triggered this
 * @param resolution - Which module was ultimately followed
 * @param outcome - Whether following that module led to success
 * @returns The recorded event
 */
export declare function recordInterference(moduleA: CognitiveModule, moduleB: CognitiveModule, type: InterferenceType, context: string, resolution: CognitiveModule, outcome?: InterferenceOutcome): InterferenceEvent;
/**
 * Record an interference by classifying signals automatically.
 * Convenience wrapper around classifyInterference + recordInterference.
 */
export declare function recordSignalInterference(moduleA: CognitiveModule, signalA: number, moduleB: CognitiveModule, signalB: number, context: string, resolution: CognitiveModule, outcome?: InterferenceOutcome): InterferenceEvent;
/**
 * Update the outcome of a pending interference event.
 * Called after the resolution's result is known.
 *
 * @param eventId - The event to update
 * @param outcome - The actual outcome
 * @returns true if the event was found and updated, false otherwise
 */
export declare function resolveInterference(eventId: string, outcome: InterferenceOutcome): boolean;
/**
 * Check if two modules have a known tension.
 * Returns the tension description or null.
 */
export declare function getKnownTension(moduleA: CognitiveModule, moduleB: CognitiveModule): string | null;
/**
 * Check if two modules have a known synergy.
 * Returns the synergy description or null.
 */
export declare function getKnownSynergy(moduleA: CognitiveModule, moduleB: CognitiveModule): string | null;
/**
 * Get all known tensions for a specific module.
 */
export declare function getTensionsFor(module: CognitiveModule): KnownInteraction[];
/**
 * Get all known synergies for a specific module.
 */
export declare function getSynergiesFor(module: CognitiveModule): KnownInteraction[];
/**
 * Get the conflict rate (destructive / total) for a specific module pair.
 * Returns 0 if no events exist for the pair.
 */
export declare function getConflictRate(moduleA: CognitiveModule, moduleB: CognitiveModule): number;
/**
 * Get interference statistics for all module pairs that have events.
 * Returns an array of PairStats, sorted by total events descending.
 */
export declare function getInterferenceStats(): PairStats[];
/**
 * Get statistics for a single module — how often it is involved
 * in interference, and its win/success rates.
 */
export declare function getModuleStats(module: CognitiveModule): {
    totalEvents: number;
    asModuleA: number;
    asModuleB: number;
    timesWon: number;
    winSuccessRate: number;
    topPartner: CognitiveModule | null;
    dominantType: InterferenceType;
};
/**
 * Generate a formatted interference report string for the daemon.
 * Includes:
 *   - Total event count and time range
 *   - Top conflicting pairs
 *   - Top synergistic pairs
 *   - Known tensions with observed conflict rates
 *   - Recommendations based on resolution success rates
 */
export declare function getInterferenceReport(): string;
/**
 * Get all interference events, optionally filtered.
 */
export declare function getEvents(filter?: {
    module?: CognitiveModule;
    type?: InterferenceType;
    outcome?: InterferenceOutcome;
    since?: string;
    limit?: number;
}): InterferenceEvent[];
/**
 * Get the most recent interference events (for dashboard display).
 */
export declare function getRecentEvents(count?: number): InterferenceEvent[];
/**
 * Count total recorded interference events.
 */
export declare function getEventCount(): number;
/**
 * Clear all interference events. Use with caution — this is destructive.
 * Returns the number of events that were cleared.
 */
export declare function clearEvents(): number;
/**
 * Predict the likely interference type for a module pair based on
 * historical data and known interactions.
 *
 * Returns a prediction with confidence, or null if insufficient data.
 */
export declare function predictInterference(moduleA: CognitiveModule, moduleB: CognitiveModule): {
    predicted: InterferenceType;
    confidence: number;
    basis: string;
} | null;
/**
 * Suggest which module to follow when two modules conflict,
 * based on historical win/success rates.
 *
 * Returns the recommended module and the basis for the recommendation,
 * or null if insufficient data.
 */
export declare function suggestResolution(moduleA: CognitiveModule, moduleB: CognitiveModule): {
    recommended: CognitiveModule;
    confidence: number;
    reason: string;
} | null;
/**
 * Generate a compact interference summary suitable for system prompt injection.
 * Returns empty string if no meaningful patterns exist.
 */
export declare function getInterferenceSummary(): string;
//# sourceMappingURL=interference.d.ts.map