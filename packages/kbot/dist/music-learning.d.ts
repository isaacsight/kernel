export interface SoundMemory {
    /** What role this sound served (bass, melody, pad, drums, etc.) */
    role: string;
    /** Genre context */
    genre: string;
    /** Plugin used */
    plugin: string;
    /** Plugin manufacturer */
    manufacturer: string;
    /** Preset name if applicable */
    preset: string;
    /** Key parameters that were set */
    params: Record<string, number>;
    /** User satisfaction score (0-1, updated via feedback) */
    score: number;
    /** Number of times this was used */
    uses: number;
    /** Last used timestamp */
    lastUsed: string;
    /** Tags from user feedback */
    tags: string[];
}
/** Record a sound that was used in a production */
export declare function recordSound(sound: Omit<SoundMemory, 'score' | 'uses' | 'lastUsed' | 'tags'>): void;
/** Boost a sound's score (user liked it) */
export declare function boostSound(role: string, genre: string, amount?: number): void;
/** Penalize a sound's score (user changed it) */
export declare function penalizeSound(role: string, genre: string, amount?: number): void;
/** Get the best-scoring sound for a role + genre */
export declare function getBestSound(role: string, genre: string): SoundMemory | null;
/** Get all sounds for a genre, sorted by score */
export declare function getSoundsForGenre(genre: string): SoundMemory[];
export interface PatternMemory {
    /** Pattern type */
    type: 'drums' | 'bass' | 'melody' | 'chords' | 'perc';
    /** Genre context */
    genre: string;
    /** Key (for pitched patterns) */
    key: string;
    /** Scale used */
    scale: string;
    /** BPM */
    bpm: number;
    /** The actual MIDI data: [pitch, start, duration, velocity][] */
    notes: Array<[number, number, number, number]>;
    /** Bars */
    bars: number;
    /** User satisfaction score */
    score: number;
    /** Times used */
    uses: number;
    /** Tags */
    tags: string[];
    /** Created */
    created: string;
}
/** Record a pattern that was used */
export declare function recordPattern(pattern: Omit<PatternMemory, 'score' | 'uses' | 'tags' | 'created'>): void;
/** Get the best pattern for a type + genre */
export declare function getBestPattern(type: string, genre: string): PatternMemory | null;
/** Boost a pattern (user kept it) */
export declare function boostPattern(type: string, genre: string, amount?: number): void;
export interface MixMemory {
    /** Genre */
    genre: string;
    /** Per-role volumes */
    volumes: Record<string, number>;
    /** Per-role panning */
    panning: Record<string, number>;
    /** Send levels */
    sends: Array<{
        role: string;
        returnIdx: number;
        level: number;
    }>;
    /** Score */
    score: number;
    /** Times used */
    uses: number;
    /** Created */
    created: string;
}
/** Record a mix configuration */
export declare function recordMix(mix: Omit<MixMemory, 'score' | 'uses' | 'created'>): void;
/** Get the best mix for a genre */
export declare function getBestMix(genre: string): MixMemory | null;
/** Boost the most recent mix for a genre */
export declare function boostMix(genre: string, amount?: number): void;
export interface MusicPreferences {
    /** Preferred genres (ordered by frequency) */
    genres: Record<string, number>;
    /** Preferred keys */
    keys: Record<string, number>;
    /** Preferred BPM ranges per genre */
    bpmRanges: Record<string, [number, number]>;
    /** Preferred instruments per role */
    instruments: Record<string, string>;
    /** Preferred Roland Cloud instruments */
    rolandPreferred: boolean;
    /** Preferred reverb amount (0-1) */
    reverbAmount: number;
    /** Preferred melody density (sparse/normal/dense) */
    melodyDensity: string;
    /** Total beats produced */
    totalBeats: number;
    /** Total sessions */
    totalSessions: number;
    /** Favorite progressions */
    progressions: Record<string, number>;
}
/** Record that a genre was used */
export declare function recordGenreUse(genre: string): void;
/** Record that a key was used */
export declare function recordKeyUse(key: string): void;
/** Record a progression was used */
export declare function recordProgressionUse(progression: string): void;
/** Get the user's most-used genre */
export declare function getPreferredGenre(): string | null;
/** Get the user's preferred key for a genre */
export declare function getPreferredKey(genre: string): string | null;
/** Get all preferences */
export declare function getPreferences(): MusicPreferences;
export interface ProductionEvent {
    /** Timestamp */
    timestamp: string;
    /** What happened */
    action: 'produce_beat' | 'design_sound' | 'arrange_song' | 'modify' | 'export' | 'feedback';
    /** Genre */
    genre: string;
    /** Key */
    key: string;
    /** BPM */
    bpm: number;
    /** What was changed (if modification) */
    detail: string;
    /** User feedback (if any) */
    feedback: 'positive' | 'negative' | 'neutral';
}
/** Record a production event */
export declare function recordEvent(event: Omit<ProductionEvent, 'timestamp'>): void;
/** Get recent history */
export declare function getRecentHistory(count?: number): ProductionEvent[];
export interface FeedbackSignal {
    /** What was the context */
    genre: string;
    /** What was the action */
    action: string;
    /** Was it positive or negative */
    sentiment: 'positive' | 'negative';
    /** What specifically was good/bad */
    target: string;
    /** Optional detail */
    detail?: string;
}
/**
 * Process user feedback and update all memory systems.
 * This is the self-improvement loop — every feedback signal
 * adjusts future behavior.
 */
export declare function processFeedback(signal: FeedbackSignal): string;
/**
 * Get a learning summary — what kbot has learned about the user's taste.
 */
export declare function getLearningReport(): string;
/**
 * Apply learned preferences to a genre preset.
 * Returns overrides that should be applied on top of the default preset.
 */
export declare function getLearnedOverrides(genre: string): {
    preferredKey?: string;
    preferredBpm?: number;
    soundOverrides: Record<string, {
        plugin: string;
        manufacturer: string;
        preset: string;
    }>;
    mixOverrides?: {
        volumes: Record<string, number>;
    };
};
//# sourceMappingURL=music-learning.d.ts.map