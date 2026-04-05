export interface NarrativeEngine {
    worldLore: LoreEntry[];
    activeNarrative: string | null;
    narrativeQueue: string[];
    locationStories: Map<string, string>;
    discoveries: Discovery[];
    lastNarrationFrame: number;
}
interface LoreEntry {
    title: string;
    content: string;
    category: 'origin' | 'history' | 'mystery' | 'legend' | 'discovery';
    location?: number;
    timestamp: number;
}
interface Discovery {
    what: string;
    where: number;
    when: number;
    narrator: string;
    lore: string;
}
/**
 * Generate 5-8 origin stories for a newly created world.
 */
export declare function generateOriginLore(): LoreEntry[];
/**
 * Generate a story for a location the robot visits for the first time.
 */
export declare function generateLocationStory(worldX: number, biome: string, features: string[]): string;
/**
 * Narrate a discovery — ore, cave, structure, or conversation deposit.
 */
export declare function narrateDiscovery(what: string, where: number, who: string): Discovery;
/**
 * Periodic narration — returns a line every ~3 minutes (NARRATION_COOLDOWN_FRAMES),
 * or null if it's not time yet.
 */
export declare function tickNarrative(engine: NarrativeEngine, frame: number, robotX: number, mood: string, facts: number, users: number): string | null;
/**
 * Handle chat commands that trigger narrative responses.
 */
export declare function handleNarrativeCommand(text: string, username: string, engine: NarrativeEngine, robotX: number): string | null;
/**
 * Save narrative state to ~/.kbot/narrative-state.json.
 */
export declare function saveNarrative(engine: NarrativeEngine): void;
/**
 * Load narrative state from disk. Returns null if no saved state.
 */
export declare function loadNarrative(): NarrativeEngine | null;
/**
 * Create a fresh NarrativeEngine with origin lore.
 */
export declare function createNarrativeEngine(): NarrativeEngine;
export declare function registerNarrativeEngineTools(): void;
export {};
//# sourceMappingURL=narrative-engine.d.ts.map