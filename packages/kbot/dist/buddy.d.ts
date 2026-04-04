export type BuddySpecies = 'fox' | 'owl' | 'cat' | 'robot' | 'ghost' | 'mushroom' | 'octopus' | 'dragon';
export type BuddyMood = 'idle' | 'thinking' | 'success' | 'error' | 'learning' | 'alert' | 'dance' | 'curious' | 'proud';
export type BuddyLevel = 0 | 1 | 2 | 3;
export interface BuddyEvolution {
    level: BuddyLevel;
    xp: number;
    evolvedAt: string[];
}
export interface BuddyState {
    species: BuddySpecies;
    name: string;
    mood: BuddyMood;
    evolution: BuddyEvolution;
}
export interface BuddyLevelInfo {
    level: BuddyLevel;
    xp: number;
    xpToNext: number | null;
    title: string;
}
export interface Achievement {
    /** Unique achievement ID */
    id: string;
    /** Display name */
    name: string;
    /** Description of what the user did */
    description: string;
    /** Single ASCII char icon (trophy, star, bolt, etc.) */
    icon: string;
    /** ISO timestamp when unlocked, null if locked */
    unlockedAt: string | null;
}
/**
 * Check all achievement conditions and unlock any newly earned.
 * Returns the list of newly unlocked achievements (empty if none).
 * Call this at session end in agent.ts.
 */
export declare function checkAchievements(): Achievement[];
/**
 * Get all achievements with their unlock status.
 * Unlocked ones include the timestamp; locked ones show null.
 */
export declare function getAchievements(): Achievement[];
/**
 * Get a progress hint for a locked achievement.
 * Returns null if the achievement is unlocked or not found.
 */
export declare function getAchievementProgress(achievementId: string): string | null;
/**
 * Format achievement unlock notification for terminal display.
 * Shows the buddy sprite in success mood with a celebration message.
 */
export declare function formatAchievementUnlock(achievement: Achievement): string;
/** Get the buddy's current state (species, name, mood, evolution) */
export declare function getBuddy(): BuddyState;
/** Set the buddy's mood */
export declare function setBuddyMood(mood: BuddyMood): void;
export declare function getBuddySprite(mood?: BuddyMood): string[];
/** Get a random greeting for the buddy */
export declare function getBuddyGreeting(): string;
/** Rename the buddy (persisted to ~/.kbot/buddy.json) */
export declare function renameBuddy(newName: string): void;
/**
 * Add XP to the buddy. Checks for level-ups and persists to buddy.json.
 * Returns the updated level info, and whether a level-up just occurred.
 *
 * XP sources:
 *   - Session complete: +1
 *   - Dream cycle:      +2
 *   - Tool creation:    +3
 *   - First error fix:  +1
 */
export declare function addBuddyXP(amount: number): {
    levelInfo: BuddyLevelInfo;
    leveledUp: boolean;
};
/**
 * Sync buddy stats to the cloud leaderboard.
 * Anonymous — uses a SHA-256 hash of hostname+homedir, not user identity.
 * Requires a kernel.chat token (cloud sync enabled).
 */
export declare function syncBuddyToCloud(): Promise<boolean>;
/**
 * Fetch the buddy leaderboard from the cloud.
 * Returns ranked entries sorted by XP descending.
 */
export declare function fetchBuddyLeaderboard(opts?: {
    limit?: number;
    species?: string;
}): Promise<Array<{
    species: string;
    level: number;
    xp: number;
    achievement_count: number;
    sessions: number;
    rank: number;
}>>;
/**
 * Get the buddy's current level info without modifying state.
 * Includes level, XP, XP to next level, and species-specific title.
 */
export declare function getBuddyLevel(): BuddyLevelInfo;
/**
 * Format the buddy with a speech bubble and status message.
 * Returns a multi-line string ready for terminal output.
 *
 *   .----------------.
 *   | Status message  |
 *   '----------------'
 *     /\   /\
 *    ( o . o )
 *     > ^ <
 *    /|   |\
 *   (_|   |_)
 *   ~ Patch the fox ~
 */
export declare function formatBuddyStatus(message?: string): string;
/**
 * Get a dream narration for the buddy to tell the user at startup.
 *
 * Picks the highest-relevance insight that was reinforced in the last 24 hours
 * and hasn't already been narrated. Returns `null` if there's nothing new to say.
 *
 * Tracks narrated insight IDs in buddy.json to avoid repeats.
 */
export declare function getBuddyDreamNarration(): string | null;
export declare function reactToToolOutput(toolName: string, success: boolean): void;
export declare function getSpeciesPersonality(): {
    species: BuddySpecies;
    trait: string;
    style: string;
    strength: string;
};
export declare function buddyChat(): Promise<void>;
//# sourceMappingURL=buddy.d.ts.map