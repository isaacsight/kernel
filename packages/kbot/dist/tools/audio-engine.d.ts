export type AmbienceType = 'forest_night' | 'forest_day' | 'ocean' | 'cave' | 'city' | 'space' | 'storm' | 'peaceful';
export type MusicMood = 'calm' | 'tense' | 'epic' | 'dreamy' | 'playful';
export type SoundEventType = 'notification' | 'achievement' | 'weather' | 'footstep' | 'build' | 'discovery';
export interface MusicState {
    bpm: number;
    key: string;
    mood: MusicMood;
    playing: boolean;
}
export interface SoundEvent {
    type: SoundEventType;
    timestamp: number;
}
export interface AudioEngine {
    currentAmbience: AmbienceType;
    musicState: MusicState;
    soundQueue: SoundEvent[];
    volume: number;
    enabled: boolean;
    /** Frame number when ambience description was last emitted */
    lastAmbienceFrame: number;
    /** Frame number when a sound event description was last emitted */
    lastSoundFrame: number;
    /** How many frames between automatic ambience descriptions (default: 720 = 120s at 6fps) */
    ambienceInterval: number;
    /** Total descriptions emitted */
    totalDescriptions: number;
}
export declare function createAudioEngine(): AudioEngine;
export declare function getAmbienceDescription(ambience: AmbienceType): string;
export declare function getSoundDescription(event: SoundEvent): string;
export declare function getMusicDescription(mood: string, biome: string): string;
/**
 * Determine the best ambience type from world state.
 * This maps the stream's biome, weather, and time of day into an AmbienceType.
 */
export declare function resolveAmbience(biome: string, weather: string, timeOfDay: string): AmbienceType;
/**
 * Determine music mood from the overall stream state.
 * mood parameter here is a narrative mood string from the stream engine.
 */
export declare function resolveMusicMood(narrativeMood: string): MusicMood;
/**
 * Queue a sound event for the next tick.
 */
export declare function queueSoundEvent(engine: AudioEngine, type: SoundEventType): void;
/**
 * Drain the sound queue, returning descriptions for all pending events.
 */
export declare function drainSoundQueue(engine: AudioEngine): string[];
/**
 * Main tick function called each frame by the stream renderer.
 *
 * Returns a string to display as an italic stage direction at the top of the
 * screen, or null if nothing should be shown this frame.
 *
 * Behavior:
 * - Every `ambienceInterval` frames (~120 seconds), emit an ambience description
 * - If there are queued sound events, emit those immediately
 * - Music description is emitted when the mood changes (tracked internally)
 *
 * @param engine   The audio engine state
 * @param biome    Current world biome (e.g., 'forest', 'ocean', 'cave')
 * @param weather  Current weather (e.g., 'clear', 'rain', 'storm')
 * @param mood     Current narrative mood (e.g., 'calm', 'tense', 'epic')
 * @param timeOfDay Current time of day (e.g., 'morning', 'night')
 * @param frame    Current frame number
 * @returns Audio description string or null
 */
export declare function tickAudio(engine: AudioEngine, biome: string, weather: string, mood: string, timeOfDay: string, frame: number): string | null;
export declare function registerAudioEngineTools(): void;
//# sourceMappingURL=audio-engine.d.ts.map