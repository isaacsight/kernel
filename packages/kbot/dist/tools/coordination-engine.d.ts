/**
 * coordination-engine.ts — Master engine that manages all other engines.
 *
 * The Coordination Engine prevents engines from stepping on each other by:
 *   1. Priority-based speech queue — only the most important message shows
 *   2. Mood stack — highest priority mood wins
 *   3. Blackboard — engines communicate through key/value store with TTLs
 *   4. Engine status tracking — self-reported health from every engine
 *   5. Resource budgets — frame timing, speech slot caps
 *
 * Priority levels (by convention):
 *   95: System alerts (stream offline, engine crash)
 *   90: Follower/subscriber celebrations
 *   80: Chat responses (someone talked to kbot)
 *   70: Evolution discoveries (new technique applied)
 *   60: Brain tool execution results
 *   50: Narrative observations
 *   40: Exploration narration (walking, examining)
 *   30: Autonomous idle behavior
 *   20: Audio atmosphere descriptions
 *   10: Inner thoughts
 *
 * Integration: imported by stream-renderer.ts, wired into the frame loop.
 * Does NOT import or modify any other engine file.
 */
export interface CoordinationEngine {
    speechQueue: SpeechItem[];
    currentSpeech: SpeechItem | null;
    currentSpeechExpiry: number;
    moodStack: MoodRequest[];
    engineStatus: Map<string, EngineStatus>;
    blackboard: Map<string, BlackboardMessage>;
    frameCount: number;
    resourceBudget: ResourceBudget;
}
export interface SpeechItem {
    text: string;
    mood: string;
    priority: number;
    duration: number;
    source: string;
    timestamp: number;
}
export interface MoodRequest {
    mood: string;
    priority: number;
    source: string;
    expiresAt: number;
}
export interface EngineStatus {
    name: string;
    active: boolean;
    lastTick: number;
    ticksPerSecond: number;
    errors: number;
    outputCount: number;
}
export interface BlackboardMessage {
    key: string;
    value: unknown;
    source: string;
    timestamp: number;
    ttl: number;
}
export interface ResourceBudget {
    frameBudgetMs: number;
    speechSlots: number;
    activeEngines: number;
}
export interface CoordinationOutput {
    speech: string | null;
    mood: string;
    shouldWalk: boolean;
    walkTarget: number | null;
    effects: string[];
    announcements: string[];
}
export declare function initCoordination(): CoordinationEngine;
/**
 * Add a speech item to the priority queue.
 * Queue is capped at MAX_SPEECH_QUEUE — lowest priority items are evicted.
 */
export declare function queueSpeech(coord: CoordinationEngine, text: string, mood: string, priority: number, duration: number, source: string): void;
/**
 * Dequeue the highest priority speech when the current one expires.
 * Returns the speech to display or null if nothing is ready.
 */
export declare function tickSpeech(coord: CoordinationEngine, frame: number): {
    text: string;
    mood: string;
} | null;
/**
 * Request a mood. Highest priority mood wins on resolve.
 * Duration is in frames.
 */
export declare function requestMood(coord: CoordinationEngine, mood: string, priority: number, source: string, duration: number): void;
/**
 * Resolve the current winning mood. Expires stale entries.
 * Returns the mood string of the highest-priority active request,
 * or DEFAULT_MOOD if the stack is empty.
 */
export declare function resolveMood(coord: CoordinationEngine, frame: number): string;
/**
 * Post a message to the blackboard. Engines communicate through here.
 * TTL is in frames. Overwrites existing key from any source.
 */
export declare function postToBlackboard(coord: CoordinationEngine, key: string, value: unknown, source: string, ttl: number): void;
/**
 * Read the latest value for a key from the blackboard.
 * Returns undefined if the key does not exist or has expired.
 */
export declare function readBlackboard(coord: CoordinationEngine, key: string): unknown;
/**
 * Engines self-report their health status each tick.
 */
export declare function reportEngineStatus(coord: CoordinationEngine, name: string, active: boolean, errors: number): void;
/**
 * Master coordination tick. Called once per frame.
 * Returns what should be displayed/acted on this frame.
 */
export declare function tickCoordination(coord: CoordinationEngine, frame: number): CoordinationOutput;
export declare function serializeCoordination(coord: CoordinationEngine): string;
export declare function deserializeCoordination(json: string): CoordinationEngine;
/** Reset the singleton (for testing or re-init) */
export declare function resetCoordination(): void;
export declare function registerCoordinationEngineTools(): void;
//# sourceMappingURL=coordination-engine.d.ts.map