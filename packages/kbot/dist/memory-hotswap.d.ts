/** Profile info returned by listing */
export interface MemoryProfile {
    name: string;
    description: string;
    patterns_count: number;
    created_at: string;
}
/** Active profile marker */
interface ActiveProfileMarker {
    name: string;
    loaded_at: string;
    previous_backup: string | null;
}
/**
 * Scan ~/.kbot/memory-profiles/ for saved profiles.
 * Returns array of profile metadata.
 */
export declare function listMemoryProfiles(): MemoryProfile[];
/**
 * Snapshot current ~/.kbot/memory/ into a named profile.
 * Saves all learning data (patterns, solutions, profile, routing).
 */
export declare function saveCurrentAsProfile(name: string, description?: string): {
    name: string;
    patterns_saved: number;
};
/**
 * Load a named profile into ~/.kbot/memory/.
 * Backs up current memory to _backup first.
 */
export declare function loadProfile(name: string): {
    name: string;
    patterns_loaded: number;
    previous_backup: string;
};
/**
 * Unload the current profile, restoring from _backup.
 * Returns to the previous state before loadProfile was called.
 */
export declare function unloadProfile(): {
    restored: boolean;
    previous_profile: string | null;
};
/**
 * Create a new empty profile with metadata.
 * Seeds initial routing preferences based on expertise string.
 */
export declare function createProfile(name: string, description: string, expertise: string): {
    name: string;
    created: boolean;
};
/**
 * Returns which profile is currently loaded.
 * Reads ~/.kbot/memory/active-profile.json.
 */
export declare function getActiveProfile(): ActiveProfileMarker | null;
export {};
//# sourceMappingURL=memory-hotswap.d.ts.map