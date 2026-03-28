export interface MidiNote {
    pitch: number;
    start: number;
    duration: number;
    velocity: number;
}
export declare const SCALES: Record<string, number[]>;
export declare const CHORDS: Record<string, number[]>;
/**
 * Convert a note name to MIDI number.
 * Accepts: "C4", "F#3", "Bb5", "Eb2", etc.
 * Uses scientific pitch notation where C4 = 60 (middle C).
 */
export declare function noteNameToMidi(name: string): number;
/**
 * Convert MIDI number to note name.
 * Returns sharps by default. Pass `preferFlats: true` for flat names.
 */
export declare function midiToNoteName(midi: number, preferFlats?: boolean): string;
/**
 * Convert MIDI number to frequency in Hz (A4 = 440 Hz).
 */
export declare function midiToFrequency(midi: number): number;
/**
 * Convert frequency in Hz to the nearest MIDI number.
 */
export declare function frequencyToMidi(freq: number): number;
/**
 * Parse a chord symbol string into MIDI note numbers.
 *
 * @param symbol - e.g. "Cmaj7", "F#m7", "Bb7", "Dadd9", "G7#9"
 * @param octave - root octave (default 4)
 * @returns Array of MIDI note numbers
 *
 * Examples:
 *   parseChordSymbol("Cmaj7")  → [60, 64, 67, 71]
 *   parseChordSymbol("F#m7")   → [66, 69, 73, 76]
 *   parseChordSymbol("Bb7")    → [58, 62, 65, 68]
 */
export declare function parseChordSymbol(symbol: string, octave?: number): number[];
/**
 * Parse a Roman numeral chord notation.
 *
 * @param numeral - e.g. "I", "ii", "V7", "bVII", "iv", "#IV", "viidim7"
 * @param key - e.g. "C", "F#", "Bb"
 * @param scale - scale name (default "major")
 * @returns Object with root MIDI number, quality name, and MIDI notes
 *
 * Conventions:
 *   - Uppercase = major, lowercase = minor
 *   - "dim" suffix = diminished, "aug" = augmented
 *   - "7" = dominant 7th (on uppercase) or minor 7th (on lowercase)
 *   - "maj7" = major 7th
 *   - "b" prefix = lowered a half step, "#" prefix = raised a half step
 */
export declare function parseRomanNumeral(numeral: string, key: string, scale?: string): {
    root: number;
    quality: string;
    notes: number[];
};
/**
 * Parse a chord progression string into arrays of MIDI notes.
 *
 * Accepts two formats:
 *   1. Roman numerals: "I vi IV V"
 *   2. Chord symbols: "Cmaj7 Am7 Fmaj7 G7"
 *
 * @param progression - space-separated chord tokens
 * @param key - key root note (e.g. "C", "F#")
 * @param scale - scale name (default "major")
 * @param octave - root octave for chord symbols (default 4)
 * @returns Array of MIDI note arrays, one per chord
 */
export declare function parseProgression(progression: string, key: string, scale?: string, octave?: number): number[][];
/**
 * Apply a voicing to a set of MIDI notes.
 *
 * @param notes - Input chord tones (root position, ascending)
 * @param voicing - Voicing strategy
 * @returns Re-voiced MIDI notes
 *
 * Voicings:
 *   - close: stack notes in ascending order within one octave
 *   - open: drop the second note from bottom down an octave
 *   - drop2: drop the second note from the top down an octave
 *   - drop3: drop the third note from the top down an octave
 *   - spread: distribute notes across 2-3 octaves
 *   - shell: root + 3rd (or sus) + 7th only
 */
export declare function voiceChord(notes: number[], voicing: 'close' | 'open' | 'drop2' | 'drop3' | 'spread' | 'shell'): number[];
/**
 * Arpeggiate a chord into a sequence of MidiNote events.
 *
 * @param notes - MIDI note numbers to arpeggiate
 * @param pattern - Direction pattern
 * @param divisions - Number of notes to generate
 * @param durationBeats - Total duration in beats
 * @returns Array of MidiNote events
 */
export declare function arpeggiate(notes: number[], pattern: 'up' | 'down' | 'updown' | 'random', divisions: number, durationBeats: number): MidiNote[];
export declare const NAMED_PROGRESSIONS: Record<string, {
    name: string;
    numerals: string;
    description: string;
}>;
export declare const RHYTHM_PATTERNS: Record<string, number[]>;
/**
 * Snap a MIDI note to the nearest note in the given scale and key.
 *
 * @param note - MIDI note number to quantize
 * @param key - Root pitch class (0-11) or note name
 * @param scale - Scale name from SCALES
 * @returns Nearest MIDI note in the scale
 */
export declare function quantizeToScale(note: number, key: number | string, scale: string): number;
/**
 * Detect the most likely key and scale for a set of MIDI notes.
 * Uses the Krumhansl-Schmuckler key-finding algorithm (simplified).
 *
 * @param notes - Array of MIDI note numbers
 * @returns Best-fit key, scale, and confidence (0-1)
 */
export declare function detectKey(notes: number[]): {
    key: string;
    scale: string;
    confidence: number;
};
export declare const GM_DRUMS: Record<string, number>;
export declare const GENRE_DRUM_PATTERNS: Record<string, {
    bpm: [number, number];
    pattern: Record<string, number[]>;
}>;
/**
 * Get scale note names for a given key and scale.
 * Useful for display and reference.
 */
export declare function getScaleNotes(key: string, scale: string, octave?: number): {
    names: string[];
    midi: number[];
};
/**
 * Transpose an array of MIDI notes by a given number of semitones.
 */
export declare function transpose(notes: number[], semitones: number): number[];
/**
 * Invert a chord (rotate the lowest note up an octave).
 * @param notes - MIDI notes (sorted ascending)
 * @param inversion - Number of inversions (1 = first, 2 = second, etc.)
 */
export declare function invertChord(notes: number[], inversion: number): number[];
/**
 * Calculate the interval name between two MIDI notes.
 */
export declare function intervalName(semitones: number): string;
/**
 * Get the available scale names.
 */
export declare function listScales(): string[];
/**
 * Get the available chord quality names.
 */
export declare function listChords(): string[];
/**
 * Get the available named progressions.
 */
export declare function listProgressions(): string[];
/**
 * Get the available drum pattern genres.
 */
export declare function listDrumPatterns(): string[];
/**
 * Get the available rhythm patterns.
 */
export declare function listRhythmPatterns(): string[];
//# sourceMappingURL=music-theory.d.ts.map