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
export type SFXType = 'chat' | 'follow' | 'achievement' | 'boss' | 'raid' | 'build' | 'discovery';
export type WaveformType = 'sine' | 'square' | 'sawtooth' | 'triangle' | 'noise_white' | 'noise_pink';
export type FilterType = 'lowpass' | 'highpass' | 'bandpass';
export type ScaleType = 'pentatonic' | 'minor' | 'major';
export interface ADSREnvelope {
    attack: number;
    decay: number;
    sustain: number;
    release: number;
}
export interface SFXEvent {
    type: SFXType;
    triggeredAt: number;
    /** Remaining samples of this SFX (counts down to 0) */
    samplesRemaining: number;
    phase: number;
}
export interface SequencerChannel {
    pattern: number[];
    waveform: WaveformType;
    envelope: ADSREnvelope;
    volume: number;
    filterType: FilterType;
    filterFreq: number;
    filterQ: number;
    phase: number;
    envStage: 'off' | 'attack' | 'decay' | 'sustain' | 'release';
    envLevel: number;
    envTime: number;
    currentNote: number;
}
export interface SequencerState {
    step: number;
    sampleCounter: number;
    samplesPerStep: number;
    channels: {
        melody: SequencerChannel;
        bass: SequencerChannel;
        arp: SequencerChannel;
        drums: SequencerChannel;
    };
}
export interface DelayLine {
    buffer: Float32Array;
    writeIndex: number;
    delaySamples: number;
    feedback: number;
    mix: number;
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
    pcmEnabled: boolean;
    sfxQueue: SFXEvent[];
    sequencer: SequencerState;
    masterVolume: number;
    delayLine: DelayLine;
    /** Total PCM samples generated since engine creation */
    totalSamplesGenerated: number;
    musicEnabled: boolean;
}
export declare function createAudioEngine(): AudioEngine;
/**
 * Trigger a sound effect. The SFX will be mixed into the next generateAudioBuffer call.
 */
export declare function triggerSFX(engine: AudioEngine, sfx: SFXType): void;
/**
 * Enable or disable background music generation.
 */
export declare function setMusicEnabled(engine: AudioEngine, enabled: boolean): void;
/**
 * Generate a buffer of PCM Float32 audio samples.
 * Mixes the 4-channel chiptune sequencer + any active SFX.
 * Output: mono Float32Array, ready to pipe to ffmpeg via -f f32le -ar 44100 -ac 1 -i pipe:3
 *
 * @param engine      The audio engine state
 * @param sampleCount Number of samples to generate
 * @param sampleRate  Sample rate (default 44100)
 * @returns Float32Array of PCM samples in [-1, 1]
 */
export declare function generateAudioBuffer(engine: AudioEngine, sampleCount: number, sampleRate?: number): Float32Array;
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