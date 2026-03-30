export type TeachingType = 'pattern' | 'rule' | 'preference' | 'alias' | 'workflow';
export interface Teaching {
    /** Unique identifier (8-char UUID prefix) */
    id: string;
    /** What kind of teaching this is */
    type: TeachingType;
    /** What triggers this teaching — keyword, phrase, or regex pattern */
    trigger: string;
    /** What kbot should do when triggered */
    action: string;
    /** Optional context constraint — project name, language, directory, etc. */
    context?: string;
    /** Priority: higher = checked first. User-taught always >= 50 (auto-extracted < 50) */
    priority: number;
    /** Example inputs that should trigger this teaching */
    examples?: string[];
    /** ISO timestamp of creation */
    createdAt: string;
    /** Number of times this teaching has been applied */
    usedCount: number;
    /** ISO timestamp of last use */
    lastUsedAt?: string;
}
/**
 * Create a new teaching from parsed components.
 */
export declare function createTeaching(opts: {
    type: TeachingType;
    trigger: string;
    action: string;
    context?: string;
    priority?: number;
    examples?: string[];
}): Teaching;
/**
 * Quick teach — parse natural language into a teaching in one shot.
 *
 * Examples:
 *   quickTeach("when I say 'deploy', run the ship pipeline")
 *   quickTeach("always use strict TypeScript")
 *   quickTeach("d = deploy to production")
 */
export declare function quickTeach(input: string): Promise<Teaching>;
/**
 * Find teachings that match a user message.
 * Returns matches sorted by priority (highest first).
 *
 * Matching strategy:
 * - Rules with trigger [always]/[never] always match (they are global)
 * - Patterns: keyword or regex match against message
 * - Aliases: exact or substring match against message
 * - Preferences: keyword match
 * - Workflows: keyword match
 * - Context: if teaching has a context, current context must match
 */
export declare function findMatchingTeachings(message: string, context?: string): Teaching[];
/**
 * Record that a teaching was used (updates usedCount and lastUsedAt).
 */
export declare function recordTeachingUsed(id: string): void;
/**
 * List all teachings, optionally filtered by type and/or context.
 */
export declare function listTeachings(filter?: {
    type?: string;
    context?: string;
}): Teaching[];
/**
 * Remove a teaching by ID.
 * Returns true if found and removed, false if not found.
 */
export declare function removeTeaching(id: string): boolean;
/**
 * Edit a teaching by ID.
 * Returns the updated teaching or null if not found.
 */
export declare function editTeaching(id: string, updates: Partial<Omit<Teaching, 'id' | 'createdAt'>>): Teaching | null;
/**
 * Get a teaching by ID.
 */
export declare function getTeaching(id: string): Teaching | null;
/**
 * Get aggregate statistics about teachings.
 */
export declare function getTeachingStats(): {
    total: number;
    byType: Record<string, number>;
    mostUsed: Teaching[];
    recentlyAdded: Teaching[];
    neverUsed: Teaching[];
};
/**
 * Build a system prompt fragment from active rules and preferences.
 * This is injected into the agent's system prompt so rules/preferences
 * are always active without needing a trigger match.
 */
export declare function getTeachingPromptRules(): string;
/**
 * Build a context-aware hint for the agent when teachings match.
 * Returns a string to prepend to the user message context, or empty string.
 */
export declare function getTeachingHints(message: string, context?: string): string;
/**
 * Interactive teach mode — guided flow for creating a teaching.
 */
export declare function startTeachMode(): Promise<void>;
/**
 * Print formatted table of teachings for CLI display.
 */
export declare function printTeachingsTable(filter?: {
    type?: string;
    context?: string;
}): void;
/**
 * Print detailed view of a single teaching.
 */
export declare function printTeachingDetail(id: string): void;
/**
 * Print teaching statistics.
 */
export declare function printTeachingStats(): void;
/**
 * Export all teachings as JSON string (for backup or sharing).
 */
export declare function exportTeachings(): string;
/**
 * Import teachings from JSON string. Merges with existing (skips duplicates by trigger+action).
 * Returns count of new teachings imported.
 */
export declare function importTeachings(json: string): number;
/**
 * Main CLI entry point for `kbot teach [subcommand] [args]`.
 * Called from cli.ts when the teach command is invoked.
 */
export declare function handleTeachCommand(args: string[]): Promise<void>;
//# sourceMappingURL=teach.d.ts.map