// kbot Music Theory Engine
// Shared foundation for ableton.ts, magenta-plugin.ts, and creative.ts.
// All music theory primitives: scales, chords, MIDI, progressions, rhythm, voice leading.
// Zero external dependencies.
// ─── Constants ─────────────────────────────────────────────────────
const NOTE_NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTE_NAMES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
/** Prefer flats for keys commonly written with flats */
const FLAT_KEYS = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm']);
// ─── Scales (20+) ──────────────────────────────────────────────────
// Intervals from root, ascending within one octave.
export const SCALES = {
    // Diatonic modes
    major: [0, 2, 4, 5, 7, 9, 11],
    natural_minor: [0, 2, 3, 5, 7, 8, 10],
    harmonic_minor: [0, 2, 3, 5, 7, 8, 11],
    melodic_minor: [0, 2, 3, 5, 7, 9, 11],
    // Church modes
    dorian: [0, 2, 3, 5, 7, 9, 10],
    phrygian: [0, 1, 3, 5, 7, 8, 10],
    lydian: [0, 2, 4, 6, 7, 9, 11],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
    locrian: [0, 1, 3, 5, 6, 8, 10],
    // Pentatonic / blues
    pentatonic_major: [0, 2, 4, 7, 9],
    pentatonic_minor: [0, 3, 5, 7, 10],
    blues: [0, 3, 5, 6, 7, 10],
    // Symmetric
    whole_tone: [0, 2, 4, 6, 8, 10],
    diminished: [0, 1, 3, 4, 6, 7, 9, 10], // half-whole
    diminished_whole_half: [0, 2, 3, 5, 6, 8, 9, 11], // whole-half
    // Bebop
    bebop_dominant: [0, 2, 4, 5, 7, 9, 10, 11],
    bebop_major: [0, 2, 4, 5, 7, 8, 9, 11],
    // Exotic
    hungarian_minor: [0, 2, 3, 6, 7, 8, 11],
    phrygian_dominant: [0, 1, 4, 5, 7, 8, 10],
    double_harmonic: [0, 1, 4, 5, 7, 8, 11],
    enigmatic: [0, 1, 4, 6, 8, 10, 11],
    neapolitan_minor: [0, 1, 3, 5, 7, 8, 11],
    neapolitan_major: [0, 1, 3, 5, 7, 9, 11],
    // Chromatic
    chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};
// ─── Chords (25+) ──────────────────────────────────────────────────
// Intervals from root.
export const CHORDS = {
    // Triads
    major: [0, 4, 7],
    minor: [0, 3, 7],
    dim: [0, 3, 6],
    aug: [0, 4, 8],
    // Seventh chords
    dom7: [0, 4, 7, 10],
    maj7: [0, 4, 7, 11],
    min7: [0, 3, 7, 10],
    dim7: [0, 3, 6, 9],
    m7b5: [0, 3, 6, 10], // half-diminished
    aug7: [0, 4, 8, 10],
    minmaj7: [0, 3, 7, 11],
    // Extended chords
    dom9: [0, 4, 7, 10, 14],
    maj9: [0, 4, 7, 11, 14],
    min9: [0, 3, 7, 10, 14],
    dom11: [0, 4, 7, 10, 14, 17],
    min11: [0, 3, 7, 10, 14, 17],
    dom13: [0, 4, 7, 10, 14, 17, 21],
    min13: [0, 3, 7, 10, 14, 17, 21],
    // Added-tone / suspended
    add9: [0, 4, 7, 14],
    '6': [0, 4, 7, 9],
    m6: [0, 3, 7, 9],
    sus2: [0, 2, 7],
    sus4: [0, 5, 7],
    '7sus4': [0, 5, 7, 10],
    // Altered dominants
    '7sharp9': [0, 4, 7, 10, 15], // Hendrix chord
    '7flat9': [0, 4, 7, 10, 13],
    '7sharp5': [0, 4, 8, 10],
    '7flat5': [0, 4, 6, 10],
    '9sharp11': [0, 4, 7, 10, 14, 18],
    // Power / cluster
    power: [0, 7],
    power8: [0, 7, 12],
};
// ─── MIDI Conversion ───────────────────────────────────────────────
const NAME_TO_PC = {
    'C': 0, 'C#': 1, 'Db': 1,
    'D': 2, 'D#': 3, 'Eb': 3,
    'E': 4, 'Fb': 4, 'E#': 5,
    'F': 5, 'F#': 6, 'Gb': 6,
    'G': 7, 'G#': 8, 'Ab': 8,
    'A': 9, 'A#': 10, 'Bb': 10,
    'B': 11, 'Cb': 11, 'B#': 0,
};
/**
 * Convert a note name to MIDI number.
 * Accepts: "C4", "F#3", "Bb5", "Eb2", etc.
 * Uses scientific pitch notation where C4 = 60 (middle C).
 */
export function noteNameToMidi(name) {
    const match = name.match(/^([A-Ga-g][#b]?)(-?\d)$/);
    if (!match)
        throw new Error(`Invalid note name: "${name}"`);
    const pc = NAME_TO_PC[match[1].charAt(0).toUpperCase() + match[1].slice(1)];
    if (pc === undefined)
        throw new Error(`Unknown pitch class: "${match[1]}"`);
    const octave = parseInt(match[2], 10);
    return (octave + 1) * 12 + pc;
}
/**
 * Convert MIDI number to note name.
 * Returns sharps by default. Pass `preferFlats: true` for flat names.
 */
export function midiToNoteName(midi, preferFlats = false) {
    const names = preferFlats ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;
    const pc = ((midi % 12) + 12) % 12;
    const octave = Math.floor(midi / 12) - 1;
    return `${names[pc]}${octave}`;
}
/**
 * Convert MIDI number to frequency in Hz (A4 = 440 Hz).
 */
export function midiToFrequency(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
}
/**
 * Convert frequency in Hz to the nearest MIDI number.
 */
export function frequencyToMidi(freq) {
    return Math.round(12 * Math.log2(freq / 440) + 69);
}
// ─── Internal Helpers ──────────────────────────────────────────────
/** Parse a root note name (without octave) to pitch class 0-11. */
function parseRoot(name) {
    const cleaned = name.charAt(0).toUpperCase() + name.slice(1);
    const pc = NAME_TO_PC[cleaned];
    if (pc === undefined)
        throw new Error(`Unknown root note: "${name}"`);
    return pc;
}
/** Build MIDI notes from a root MIDI number and interval array. */
function buildChordMidi(rootMidi, intervals) {
    return intervals.map(i => rootMidi + i);
}
// ─── Chord Symbol Parser ───────────────────────────────────────────
/**
 * Quality alias mapping. Order matters — longer matches first.
 * Maps common chord symbol suffixes to CHORDS keys.
 */
const QUALITY_ALIASES = [
    // Extended altered
    [/^(?:dom)?9#11$/i, '9sharp11'],
    [/^(?:dom)?13$/i, 'dom13'],
    [/^m(?:in)?13$/i, 'min13'],
    [/^(?:dom)?11$/i, 'dom11'],
    [/^m(?:in)?11$/i, 'min11'],
    [/^(?:dom)?9$/i, 'dom9'],
    [/^maj9$/i, 'maj9'],
    [/^m(?:in)?9$/i, 'min9'],
    // Altered 7ths
    [/^7[#\+]9$/i, '7sharp9'],
    [/^7b9$/i, '7flat9'],
    [/^7[#\+]5$/i, '7sharp5'],
    [/^7b5$/i, '7flat5'],
    [/^7sus4$/i, '7sus4'],
    // 7ths
    [/^maj7$/i, 'maj7'],
    [/^(?:M7|ma7|Maj7|\u0394 ?7)$/, 'maj7'],
    [/^m(?:in)?(?:maj|M)7$/, 'minmaj7'],
    [/^m(?:in)?7b5$/i, 'm7b5'],
    [/^(?:half)?dim7$/i, 'm7b5'],
    [/^dim7$/i, 'dim7'],
    [/^m(?:in)?7$/i, 'min7'],
    [/^(?:dom)?7$/i, 'dom7'],
    [/^aug7$/i, 'aug7'],
    // 6ths
    [/^m6$/i, 'm6'],
    [/^6$/i, '6'],
    // Triads & sus
    [/^add9$/i, 'add9'],
    [/^sus2$/i, 'sus2'],
    [/^sus4$/i, 'sus4'],
    [/^sus$/i, 'sus4'],
    [/^dim$/i, 'dim'],
    [/^[o°]$/i, 'dim'],
    [/^aug$/i, 'aug'],
    [/^[+]$/i, 'aug'],
    [/^m(?:in)?$/i, 'minor'],
    [/^[-]$/i, 'minor'],
    [/^(?:maj|M)?$/i, 'major'], // empty suffix or "maj" = major triad
    // Power
    [/^5$/i, 'power'],
];
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
export function parseChordSymbol(symbol, octave = 4) {
    const match = symbol.match(/^([A-Ga-g][#b]?)(.*)$/);
    if (!match)
        throw new Error(`Cannot parse chord symbol: "${symbol}"`);
    const rootPc = parseRoot(match[1]);
    const qualitySuffix = match[2];
    const rootMidi = (octave + 1) * 12 + rootPc;
    // Find matching quality
    for (const [pattern, chordKey] of QUALITY_ALIASES) {
        if (pattern.test(qualitySuffix)) {
            const intervals = CHORDS[chordKey];
            if (!intervals)
                throw new Error(`Unknown chord quality key: "${chordKey}"`);
            return buildChordMidi(rootMidi, intervals);
        }
    }
    throw new Error(`Unknown chord quality: "${qualitySuffix}" in "${symbol}"`);
}
// ─── Roman Numeral Parser ──────────────────────────────────────────
/** Roman numeral values */
const ROMAN_VALUES = {
    'i': 0, 'ii': 1, 'iii': 2, 'iv': 3, 'v': 4, 'vi': 5, 'vii': 6,
};
/** Map from scale degree to default triad quality in major scale */
const MAJOR_TRIAD_QUALITIES = ['major', 'minor', 'minor', 'major', 'major', 'minor', 'dim'];
/** Map from scale degree to default triad quality in natural minor scale */
const MINOR_TRIAD_QUALITIES = ['minor', 'dim', 'major', 'minor', 'minor', 'major', 'major'];
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
export function parseRomanNumeral(numeral, key, scale = 'major') {
    const scaleIntervals = SCALES[scale] || SCALES.major;
    // Extract accidental prefix (b or #)
    let accidental = 0;
    let rest = numeral;
    while (rest.startsWith('b') || rest.startsWith('#')) {
        if (rest.startsWith('b')) {
            accidental -= 1;
            rest = rest.slice(1);
        }
        else {
            accidental += 1;
            rest = rest.slice(1);
        }
    }
    // Extract the roman numeral (case-sensitive)
    const romanMatch = rest.match(/^(I{1,3}V?|IV|V?I{0,3}|i{1,3}v?|iv|v?i{0,3})/i);
    if (!romanMatch || !romanMatch[0])
        throw new Error(`Cannot parse Roman numeral: "${numeral}"`);
    const romanPart = romanMatch[0];
    const suffix = rest.slice(romanPart.length);
    const isUpper = romanPart === romanPart.toUpperCase();
    const degree = ROMAN_VALUES[romanPart.toLowerCase()];
    if (degree === undefined)
        throw new Error(`Unknown Roman numeral: "${romanPart}"`);
    // Calculate root pitch class
    const keyPc = parseRoot(key);
    const scaleDegreeInterval = scaleIntervals[degree % scaleIntervals.length] || 0;
    const rootPc = (keyPc + scaleDegreeInterval + accidental + 12) % 12;
    // Root MIDI in octave 4
    const rootMidi = 48 + rootPc; // octave 3 base for Roman numerals (sounds better)
    // Determine quality from suffix and case
    let quality;
    if (suffix) {
        // Parse explicit suffix
        const suffixLower = suffix.toLowerCase();
        if (suffixLower === 'dim7')
            quality = 'dim7';
        else if (suffixLower === 'dim')
            quality = 'dim';
        else if (suffixLower === 'aug7')
            quality = 'aug7';
        else if (suffixLower === 'aug')
            quality = 'aug';
        else if (suffixLower === 'maj7' || suffixLower === 'M7')
            quality = 'maj7';
        else if (suffixLower === '7')
            quality = isUpper ? 'dom7' : 'min7';
        else if (suffixLower === '9')
            quality = isUpper ? 'dom9' : 'min9';
        else if (suffixLower === '11')
            quality = isUpper ? 'dom11' : 'min11';
        else if (suffixLower === '13')
            quality = isUpper ? 'dom13' : 'min13';
        else if (suffixLower === 'sus2')
            quality = 'sus2';
        else if (suffixLower === 'sus4' || suffixLower === 'sus')
            quality = 'sus4';
        else if (suffixLower === '7sus4')
            quality = '7sus4';
        else if (suffixLower === 'm7b5' || suffixLower === 'ø' || suffixLower === 'halfdim')
            quality = 'm7b5';
        else
            quality = isUpper ? 'major' : 'minor';
    }
    else {
        // Default quality from scale degree
        const qualities = scale === 'natural_minor' || scale === 'harmonic_minor' || scale === 'melodic_minor'
            ? MINOR_TRIAD_QUALITIES
            : MAJOR_TRIAD_QUALITIES;
        quality = isUpper
            ? (qualities[degree] === 'minor' ? 'major' : qualities[degree])
            : (qualities[degree] === 'major' ? 'minor' : qualities[degree]);
        // But respect the case convention: uppercase = major, lowercase = minor
        if (isUpper && quality !== 'dim' && quality !== 'aug')
            quality = 'major';
        if (!isUpper && quality !== 'dim' && quality !== 'aug')
            quality = 'minor';
    }
    const intervals = CHORDS[quality];
    if (!intervals)
        throw new Error(`Unknown chord quality: "${quality}"`);
    const notes = buildChordMidi(rootMidi, intervals);
    return { root: rootMidi, quality, notes };
}
// ─── Progression Parser ────────────────────────────────────────────
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
export function parseProgression(progression, key, scale = 'major', octave = 4) {
    const tokens = progression.trim().split(/\s+/);
    return tokens.map(token => {
        // Detect Roman numeral: starts with optional accidental + roman chars
        if (/^[#b]*[IiVv]/.test(token)) {
            return parseRomanNumeral(token, key, scale).notes;
        }
        // Otherwise treat as chord symbol
        return parseChordSymbol(token, octave);
    });
}
// ─── Voice Leading / Voicings ──────────────────────────────────────
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
export function voiceChord(notes, voicing) {
    if (notes.length === 0)
        return [];
    const sorted = [...notes].sort((a, b) => a - b);
    switch (voicing) {
        case 'close':
            return sorted;
        case 'open': {
            if (sorted.length < 3)
                return sorted;
            const result = [...sorted];
            // Drop the second note from bottom down an octave
            result[1] = result[1] - 12;
            return result.sort((a, b) => a - b);
        }
        case 'drop2': {
            if (sorted.length < 3)
                return sorted;
            const result = [...sorted];
            // Second from the top drops an octave
            const dropIdx = result.length - 2;
            result[dropIdx] = result[dropIdx] - 12;
            return result.sort((a, b) => a - b);
        }
        case 'drop3': {
            if (sorted.length < 4)
                return voiceChord(sorted, 'drop2'); // fallback
            const result = [...sorted];
            // Third from the top drops an octave
            const dropIdx = result.length - 3;
            result[dropIdx] = result[dropIdx] - 12;
            return result.sort((a, b) => a - b);
        }
        case 'spread': {
            // Distribute across 2-3 octaves from the root
            const root = sorted[0];
            const intervals = sorted.map(n => n - root);
            const result = [root];
            for (let i = 1; i < intervals.length; i++) {
                // Alternate between adding 12 and keeping, spreading upward
                const octaveBoost = i <= 1 ? 0 : (i <= 3 ? 12 : 24);
                result.push(root + intervals[i] + octaveBoost);
            }
            return result.sort((a, b) => a - b);
        }
        case 'shell': {
            // Root + 3rd (or 2nd/4th for sus) + 7th
            if (sorted.length < 3)
                return sorted;
            const root = sorted[0];
            const intervals = sorted.map(n => ((n - root) % 12 + 12) % 12);
            // Find the "3rd" voice (interval 2-5 semitones from root)
            const third = sorted.find((_, i) => intervals[i] >= 2 && intervals[i] <= 5);
            // Find the "7th" voice (interval 9-11 semitones from root)
            const seventh = sorted.find((_, i) => intervals[i] >= 9 && intervals[i] <= 11);
            const shell = [root];
            if (third !== undefined)
                shell.push(third);
            if (seventh !== undefined)
                shell.push(seventh);
            // If no 7th found, include the 5th as fallback
            if (seventh === undefined) {
                const fifth = sorted.find((_, i) => intervals[i] >= 6 && intervals[i] <= 8);
                if (fifth !== undefined)
                    shell.push(fifth);
            }
            return shell.sort((a, b) => a - b);
        }
        default:
            return sorted;
    }
}
// ─── Arpeggiator ───────────────────────────────────────────────────
/**
 * Arpeggiate a chord into a sequence of MidiNote events.
 *
 * @param notes - MIDI note numbers to arpeggiate
 * @param pattern - Direction pattern
 * @param divisions - Number of notes to generate
 * @param durationBeats - Total duration in beats
 * @returns Array of MidiNote events
 */
export function arpeggiate(notes, pattern, divisions, durationBeats) {
    if (notes.length === 0 || divisions <= 0)
        return [];
    const sorted = [...notes].sort((a, b) => a - b);
    const stepDuration = durationBeats / divisions;
    // Build the pitch sequence for one cycle
    let sequence;
    switch (pattern) {
        case 'up':
            sequence = sorted;
            break;
        case 'down':
            sequence = [...sorted].reverse();
            break;
        case 'updown': {
            // Up then down, excluding endpoints to avoid double-hits
            const up = [...sorted];
            const down = sorted.length > 2
                ? [...sorted].reverse().slice(1, -1)
                : [...sorted].reverse();
            sequence = [...up, ...down];
            break;
        }
        case 'random':
            // Deterministic pseudo-shuffle based on index
            sequence = sorted;
            break;
    }
    const result = [];
    for (let i = 0; i < divisions; i++) {
        let pitch;
        if (pattern === 'random') {
            // Simple deterministic "random" using modular arithmetic
            const idx = (i * 7 + 3) % sorted.length;
            pitch = sorted[idx];
        }
        else {
            pitch = sequence[i % sequence.length];
        }
        // Slight velocity variation for musicality
        const baseVelocity = 80;
        const accentBoost = (i % sequence.length === 0) ? 20 : 0;
        const velocity = Math.min(127, baseVelocity + accentBoost);
        result.push({
            pitch,
            start: i * stepDuration,
            duration: stepDuration * 0.9, // 90% gate for legato feel
            velocity,
        });
    }
    return result;
}
// ─── Named Progressions (50+) ──────────────────────────────────────
export const NAMED_PROGRESSIONS = {
    // ── Pop / Rock ──
    axis: { name: 'Axis of Awesome', numerals: 'I V vi IV', description: 'Most popular pop progression (Let It Be, No Woman No Cry, etc.)' },
    fifties: { name: '50s Doo-Wop', numerals: 'I vi IV V', description: '50s rock and doo-wop standard' },
    sensitive: { name: 'Sensitive Female', numerals: 'vi IV I V', description: 'Emotional pop ballad (Safe & Sound, Zombie)' },
    pop_punk: { name: 'Pop Punk', numerals: 'I V vi IV', description: 'Standard pop-punk and rock anthem' },
    pachelbel: { name: 'Pachelbel Canon', numerals: 'I V vi iii IV I IV V', description: 'Pachelbel\'s Canon in D — endlessly borrowed' },
    creep: { name: 'Creep (Radiohead)', numerals: 'I III IV iv', description: 'Chromatic major-to-minor IV movement' },
    wonderwall: { name: 'Wonderwall', numerals: 'vi IV I V', description: 'Oasis-style Britpop (vi starting)' },
    dont_stop: { name: 'Don\'t Stop Believin\'', numerals: 'I V vi IV', description: 'Classic arena-rock anthem progression' },
    despacito: { name: 'Despacito', numerals: 'vi IV I V', description: 'Reggaeton / Latin pop staple' },
    let_it_be: { name: 'Let It Be', numerals: 'I V vi IV', description: 'Beatles classic — the axis progression' },
    // ── Blues ──
    twelve_bar_blues: { name: '12-Bar Blues', numerals: 'I I I I IV IV I I V IV I V', description: 'Standard 12-bar blues form' },
    minor_blues: { name: 'Minor Blues', numerals: 'i i i i iv iv i i v iv i v', description: '12-bar minor blues' },
    quick_change_blues: { name: 'Quick Change Blues', numerals: 'I IV I I IV IV I I V IV I V', description: '12-bar with quick IV in bar 2' },
    eight_bar_blues: { name: '8-Bar Blues', numerals: 'I I IV IV I V I V', description: 'Shorter 8-bar blues form' },
    // ── Jazz ──
    jazz_ii_v_i: { name: 'Jazz ii-V-I', numerals: 'ii7 V7 Imaj7', description: 'The foundational jazz cadence' },
    jazz_turnaround: { name: 'Jazz Turnaround', numerals: 'Imaj7 vi7 ii7 V7', description: 'Standard jazz turnaround / rhythm changes A' },
    rhythm_changes: { name: 'Rhythm Changes', numerals: 'Imaj7 vi7 ii7 V7', description: 'I Got Rhythm — Gershwin / bebop standard' },
    coltrane_changes: { name: 'Coltrane Changes', numerals: 'Imaj7 bIIImaj7 Vmaj7', description: 'Giant Steps — Coltrane\'s symmetric cycle' },
    backdoor: { name: 'Backdoor ii-V', numerals: 'iv bVII7 I', description: 'Backdoor resolution, softer than V7-I' },
    bird_blues: { name: 'Bird Blues', numerals: 'Imaj7 iv7 bVII7 Imaj7 ii7 V7', description: 'Charlie Parker\'s reharmonized blues' },
    minor_ii_v_i: { name: 'Minor ii-V-i', numerals: 'ii7 V7 i', description: 'Jazz minor cadence with half-dim ii' },
    lady_bird: { name: 'Lady Bird', numerals: 'Imaj7 bIIImaj7 IVmaj7 bVImaj7', description: 'Tadd Dameron — chromatic turnaround' },
    so_what: { name: 'So What', numerals: 'i i i i i i i i bII bII bII bII bII bII bII i', description: 'Miles Davis modal jazz — Dm to Ebm' },
    autumn_leaves: { name: 'Autumn Leaves', numerals: 'ii7 V7 Imaj7 IVmaj7 vii7 III7 vi', description: 'Jazz standard — descending cycle' },
    // ── Classical ──
    classical_cadence: { name: 'Classical Cadence', numerals: 'I IV V I', description: 'Simple authentic cadence (classical)' },
    deceptive: { name: 'Deceptive Cadence', numerals: 'I IV V vi', description: 'Expected resolution to I, goes to vi instead' },
    plagal: { name: 'Plagal Cadence', numerals: 'I IV I', description: 'Amen cadence — IV to I' },
    andalusian: { name: 'Andalusian Cadence', numerals: 'i bVII bVI V', description: 'Flamenco / Mediterranean descending cadence' },
    neapolitan: { name: 'Neapolitan', numerals: 'i bII V i', description: 'Neapolitan 6th — bII approach to V' },
    picardy: { name: 'Picardy Third', numerals: 'iv V I', description: 'Minor piece resolving to major I' },
    circle_of_fifths: { name: 'Circle of Fifths', numerals: 'vi ii V I', description: 'Descending fifths — Baroque standard' },
    romanesca: { name: 'Romanesca', numerals: 'III bVII i V', description: 'Renaissance ground bass pattern' },
    lament: { name: 'Lament Bass', numerals: 'i i7 bVII bVI', description: 'Descending chromatic bass — passacaglia' },
    // ── Modal / Film ──
    modal_interchange: { name: 'Modal Interchange', numerals: 'I bVII IV iv', description: 'Borrowing bVII and iv from parallel minor' },
    epic_film: { name: 'Epic Film', numerals: 'i bVI bIII bVII', description: 'Cinematic minor progression (Hans Zimmer feel)' },
    dorian_vamp: { name: 'Dorian Vamp', numerals: 'i IV', description: 'Simple Dorian two-chord groove (So What, Oye Como Va)' },
    mixolydian_vamp: { name: 'Mixolydian Vamp', numerals: 'I bVII', description: 'Two-chord rock/folk groove (Sweet Home Alabama feel)' },
    lydian_float: { name: 'Lydian Float', numerals: 'I II', description: 'Lydian two-chord — dreamy, ambiguous' },
    phrygian_dark: { name: 'Phrygian Dark', numerals: 'i bII', description: 'Dark Phrygian two-chord (metal / flamenco)' },
    // ── Japanese / K-Pop / Anime ──
    royal_road: { name: 'Royal Road (Ouji)', numerals: 'IV V iii vi', description: 'J-pop / anime staple — the "ouji-shiki" progression' },
    jpop_classic: { name: 'J-Pop Classic', numerals: 'IV V I vi', description: 'Standard J-pop cadence' },
    kpop_vi: { name: 'K-Pop Minor Start', numerals: 'vi IV I V', description: 'K-pop and anime emotional opening' },
    anime_sad: { name: 'Anime Sadness', numerals: 'vi V IV V', description: 'Sad anime scene — stepwise minor descent' },
    // ── EDM / Electronic ──
    edm_anthem: { name: 'EDM Anthem', numerals: 'vi IV I V', description: 'Festival EDM build-and-drop' },
    trance_gate: { name: 'Trance Gate', numerals: 'i bVII bVI V', description: 'Trance uplifter — Andalusian variant' },
    house_vamp: { name: 'House Vamp', numerals: 'i bVII bVI bVII', description: 'Deep house hypnotic minor loop' },
    // ── Reggae / Latin ──
    reggae_one_drop: { name: 'Reggae One-Drop', numerals: 'I IV V IV', description: 'Bob Marley style — relaxed reggae groove' },
    bossa_nova: { name: 'Bossa Nova', numerals: 'Imaj7 ii7 iii7 bIIImaj7 ii7 V7 Imaj7', description: 'Girl from Ipanema — bossa standard' },
    son_montuno: { name: 'Son Montuno', numerals: 'I IV V IV', description: 'Cuban son / salsa groove' },
    // ── R&B / Soul / Gospel ──
    soul_turnaround: { name: 'Soul Turnaround', numerals: 'I vi ii V', description: 'Classic Motown / soul turnaround' },
    gospel_shout: { name: 'Gospel Shout', numerals: 'I I7 IV iv I V I', description: 'Gospel with chromatic iv — church shout' },
    neo_soul: { name: 'Neo-Soul', numerals: 'Imaj7 iii7 vi7 ii7 V7', description: 'Erykah Badu / D\'Angelo smooth cycle' },
    // ── Ragtime / Stride ──
    ragtime: { name: 'Ragtime', numerals: 'I I IV iv I V I', description: 'Classic ragtime with chromatic passing iv' },
    entertainer: { name: 'The Entertainer', numerals: 'I V I IV I V I', description: 'Scott Joplin stride pattern' },
    // ── Metal / Prog ──
    metal_power: { name: 'Metal Power', numerals: 'i bVII bVI bVII', description: 'Power-chord metal riff pattern' },
    prog_chromatic: { name: 'Prog Chromatic', numerals: 'I bII I bVII', description: 'Progressive rock chromatic movement' },
    djent: { name: 'Djent', numerals: 'i bII bVII i', description: 'Modern prog-metal — Meshuggah/Periphery feel' },
    // ── Country / Folk ──
    country_walk: { name: 'Country Walk', numerals: 'I I IV IV V IV I V', description: 'Nashville-style 8-bar walking progression' },
    folk_circle: { name: 'Folk Circle', numerals: 'I V vi iii IV I ii V', description: 'Folk — extended circle of fifths' },
    three_chord_wonder: { name: 'Three-Chord Wonder', numerals: 'I IV V I', description: 'The simplest rock/country/punk progression' },
    // ── Funk ──
    funk_one_chord: { name: 'Funk One-Chord', numerals: 'I7', description: 'James Brown — one-chord funk (rhythm is everything)' },
    funk_cycle: { name: 'Funk Cycle', numerals: 'I7 IV7 I7 V7', description: 'Funk with dominant 7ths throughout' },
};
// ─── Rhythm Patterns ───────────────────────────────────────────────
// Beat positions within a bar (in quarter notes, 4/4 time).
// 0 = beat 1, 1 = beat 2, 2 = beat 3, 3 = beat 4.
export const RHYTHM_PATTERNS = {
    // Standard divisions
    whole: [0],
    half: [0, 2],
    quarter: [0, 1, 2, 3],
    eighth: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5],
    sixteenth: [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.25, 3.5, 3.75],
    triplet: [0, 1 / 3, 2 / 3, 1, 4 / 3, 5 / 3, 2, 7 / 3, 8 / 3, 3, 10 / 3, 11 / 3],
    // Dotted patterns
    dotted_quarter: [0, 1.5, 3],
    dotted_eighth: [0, 0.75, 1.5, 2.25, 3],
    // Syncopation
    offbeat_eighth: [0.5, 1.5, 2.5, 3.5],
    anticipated: [0, 1, 1.5, 2.5, 3],
    charleston: [0, 1.5],
    habanera: [0, 1.5, 2, 3],
    // Swing / shuffle
    swing: [0, 2 / 3, 1, 5 / 3, 2, 8 / 3, 3, 11 / 3], // triplet feel
    shuffle: [0, 2 / 3, 1, 5 / 3, 2, 8 / 3, 3, 11 / 3], // same as swing
    half_time_shuffle: [0, 2 / 3, 2, 8 / 3], // Purdie shuffle, half as dense
    // Latin / world
    clave_son: [0, 1.5, 2.5, 3, 3.5], // 3-2 son clave (within one bar approximation)
    clave_rumba: [0, 1.5, 2.75, 3, 3.5], // 3-2 rumba clave
    tresillo: [0, 1.5, 3], // 3-3-2 feel
    cinquillo: [0, 0.5, 1.5, 2, 3], // Afro-Cuban five-stroke
    // Montuno / reggaeton
    reggaeton: [0, 0.75, 1.5, 2.25, 3], // dembow-ish
    dembow: [0, 0.75, 1.5, 2.25, 3],
};
// ─── Scale Quantization ────────────────────────────────────────────
/**
 * Snap a MIDI note to the nearest note in the given scale and key.
 *
 * @param note - MIDI note number to quantize
 * @param key - Root pitch class (0-11) or note name
 * @param scale - Scale name from SCALES
 * @returns Nearest MIDI note in the scale
 */
export function quantizeToScale(note, key, scale) {
    const keyPc = typeof key === 'string' ? parseRoot(key) : key;
    const scaleIntervals = SCALES[scale] || SCALES.major;
    // Build the set of valid pitch classes
    const validPcs = new Set(scaleIntervals.map(i => (keyPc + i) % 12));
    const pc = ((note % 12) + 12) % 12;
    if (validPcs.has(pc))
        return note;
    // Find nearest valid pitch class
    let bestDist = Infinity;
    let bestOffset = 0;
    for (let offset = 1; offset <= 6; offset++) {
        if (validPcs.has((pc + offset) % 12)) {
            if (offset < bestDist) {
                bestDist = offset;
                bestOffset = offset;
            }
            break;
        }
    }
    for (let offset = 1; offset <= 6; offset++) {
        if (validPcs.has(((pc - offset) % 12 + 12) % 12)) {
            if (offset < bestDist) {
                bestDist = offset;
                bestOffset = -offset;
            }
            break;
        }
    }
    // Tie-break: prefer rounding down
    if (bestDist === Infinity)
        return note; // chromatic or empty scale, no change
    return note + bestOffset;
}
// ─── Key Detection ─────────────────────────────────────────────────
/**
 * Detect the most likely key and scale for a set of MIDI notes.
 * Uses the Krumhansl-Schmuckler key-finding algorithm (simplified).
 *
 * @param notes - Array of MIDI note numbers
 * @returns Best-fit key, scale, and confidence (0-1)
 */
export function detectKey(notes) {
    if (notes.length === 0)
        return { key: 'C', scale: 'major', confidence: 0 };
    // Count pitch class occurrences
    const pcCounts = new Array(12).fill(0);
    for (const n of notes) {
        pcCounts[((n % 12) + 12) % 12]++;
    }
    const total = notes.length;
    // Krumhansl-Kessler profiles (empirical key profiles)
    const majorProfile = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
    const minorProfile = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
    /** Pearson correlation between two arrays */
    function correlate(a, b) {
        const n = a.length;
        const meanA = a.reduce((s, v) => s + v, 0) / n;
        const meanB = b.reduce((s, v) => s + v, 0) / n;
        let num = 0, denA = 0, denB = 0;
        for (let i = 0; i < n; i++) {
            const da = a[i] - meanA;
            const db = b[i] - meanB;
            num += da * db;
            denA += da * da;
            denB += db * db;
        }
        const den = Math.sqrt(denA * denB);
        return den === 0 ? 0 : num / den;
    }
    let bestKey = 0;
    let bestScale = 'major';
    let bestScore = -Infinity;
    for (let root = 0; root < 12; root++) {
        // Rotate pitch class counts so that `root` is index 0
        const rotated = Array.from({ length: 12 }, (_, i) => pcCounts[(root + i) % 12]);
        const majScore = correlate(rotated, majorProfile);
        const minScore = correlate(rotated, minorProfile);
        if (majScore > bestScore) {
            bestScore = majScore;
            bestKey = root;
            bestScale = 'major';
        }
        if (minScore > bestScore) {
            bestScore = minScore;
            bestKey = root;
            bestScale = 'natural_minor';
        }
    }
    // Confidence: map correlation from [0,1] range
    const confidence = Math.max(0, Math.min(1, (bestScore + 1) / 2));
    const keyName = NOTE_NAMES_SHARP[bestKey];
    return { key: keyName, scale: bestScale, confidence: Math.round(confidence * 1000) / 1000 };
}
// ─── General MIDI Drum Map ─────────────────────────────────────────
export const GM_DRUMS = {
    // Bass drums
    kick: 36,
    kick_alt: 35,
    bass_drum: 36,
    // Snares
    snare: 38,
    snare_alt: 40,
    electric_snare: 40,
    rim: 37,
    rimshot: 37,
    side_stick: 37,
    cross_stick: 37,
    // Hi-hats
    closed_hihat: 42,
    hihat_closed: 42,
    pedal_hihat: 44,
    open_hihat: 46,
    hihat_open: 46,
    // Toms
    low_floor_tom: 41,
    high_floor_tom: 43,
    low_tom: 45,
    low_mid_tom: 47,
    hi_mid_tom: 48,
    high_tom: 50,
    // Cymbals
    crash: 49,
    crash_1: 49,
    crash_2: 57,
    ride: 51,
    ride_bell: 53,
    splash: 55,
    china: 52,
    // Percussion
    clap: 39,
    handclap: 39,
    tambourine: 54,
    cowbell: 56,
    vibraslap: 58,
    // Latin
    bongo_high: 60,
    bongo_low: 61,
    conga_muted: 62,
    conga_open: 63,
    conga_low: 64,
    timbale_high: 65,
    timbale_low: 66,
    agogo_high: 67,
    agogo_low: 68,
    cabasa: 69,
    maracas: 70,
    guiro_short: 73,
    guiro_long: 74,
    claves: 75,
    // Woodblock / triangle
    woodblock_high: 76,
    woodblock_low: 77,
    triangle_muted: 80,
    triangle_open: 81,
    shaker: 82,
};
// ─── Genre Drum Patterns ───────────────────────────────────────────
// Pattern arrays indicate which 16th-note subdivisions (0-15) have hits.
// 0 = beat 1, 4 = beat 2, 8 = beat 3, 12 = beat 4.
export const GENRE_DRUM_PATTERNS = {
    house: {
        bpm: [120, 130],
        pattern: {
            kick: [0, 4, 8, 12], // four on the floor
            clap: [4, 12], // clap on 2 & 4
            closed_hihat: [0, 2, 4, 6, 8, 10, 12, 14], // steady 8ths
            open_hihat: [3, 7, 11, 15], // offbeat opens
        },
    },
    techno: {
        bpm: [130, 145],
        pattern: {
            kick: [0, 4, 8, 12],
            clap: [4, 12],
            closed_hihat: [0, 2, 4, 6, 8, 10, 12, 14],
            ride: [2, 6, 10, 14],
        },
    },
    hiphop: {
        bpm: [85, 100],
        pattern: {
            kick: [0, 5, 8, 13], // syncopated boom-bap
            snare: [4, 12],
            closed_hihat: [0, 2, 4, 6, 8, 10, 12, 14],
            open_hihat: [7],
        },
    },
    trap: {
        bpm: [130, 170],
        pattern: {
            kick: [0, 7, 8], // sparse kick, half-time feel
            snare: [8], // snare on beat 3 (half-time)
            closed_hihat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], // 16th hi-hats
            open_hihat: [6, 14],
            clap: [8],
        },
    },
    dnb: {
        bpm: [160, 180],
        pattern: {
            kick: [0, 10], // syncopated kick
            snare: [4, 12], // backbeat
            closed_hihat: [0, 2, 4, 6, 8, 10, 12, 14],
            ride: [1, 3, 5, 7, 9, 11, 13, 15],
        },
    },
    reggaeton: {
        bpm: [88, 100],
        pattern: {
            kick: [0, 3, 4, 7, 8, 11, 12, 15], // dembow kick
            snare: [3, 7, 11, 15], // dembow snare
            closed_hihat: [0, 2, 4, 6, 8, 10, 12, 14],
            rim: [3, 7, 11, 15],
        },
    },
    jazz: {
        bpm: [100, 180],
        pattern: {
            kick: [0, 10], // feathered bass drum
            snare: [7, 14], // ghost notes / comping
            ride: [0, 3, 4, 7, 8, 11, 12, 15], // swing ride pattern
            closed_hihat: [4, 12], // hi-hat on 2 & 4
        },
    },
    rock: {
        bpm: [100, 140],
        pattern: {
            kick: [0, 8], // beats 1 & 3
            snare: [4, 12], // beats 2 & 4
            closed_hihat: [0, 2, 4, 6, 8, 10, 12, 14], // straight 8ths
            crash: [0], // crash on 1 (start of pattern)
        },
    },
    pop: {
        bpm: [100, 130],
        pattern: {
            kick: [0, 6, 8], // kick with a push
            snare: [4, 12], // standard backbeat
            closed_hihat: [0, 2, 4, 6, 8, 10, 12, 14],
            tambourine: [4, 12],
        },
    },
    lofi: {
        bpm: [70, 90],
        pattern: {
            kick: [0, 5, 8, 13], // boom bap, slightly loose
            snare: [4, 12],
            closed_hihat: [0, 2, 4, 6, 8, 10, 12, 14],
            open_hihat: [6, 14],
            rim: [3, 11], // ghost rimshot
        },
    },
    ambient: {
        bpm: [60, 90],
        pattern: {
            kick: [0], // minimal — one kick per bar
            ride: [0, 8], // sparse ride
            shaker: [0, 4, 8, 12], // gentle pulse
        },
    },
    funk: {
        bpm: [95, 115],
        pattern: {
            kick: [0, 3, 6, 8, 11], // syncopated funk kick
            snare: [4, 12], // backbeat
            closed_hihat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], // 16th hats
            open_hihat: [7, 15],
        },
    },
    bossa_nova: {
        bpm: [120, 145],
        pattern: {
            kick: [0, 5, 8, 13],
            rim: [3, 6, 9, 12, 15], // cross-stick pattern
            closed_hihat: [0, 2, 4, 6, 8, 10, 12, 14],
            shaker: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
        },
    },
    reggae: {
        bpm: [65, 85],
        pattern: {
            kick: [0, 10], // one-drop kick
            snare: [12], // rim on beat 3 (one-drop)
            closed_hihat: [0, 2, 4, 6, 8, 10, 12, 14],
            rim: [12],
        },
    },
    afrobeat: {
        bpm: [100, 130],
        pattern: {
            kick: [0, 6, 8, 14],
            snare: [4, 12],
            closed_hihat: [0, 2, 4, 6, 8, 10, 12, 14],
            open_hihat: [3, 11],
            shaker: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
            claves: [0, 3, 6, 10, 12], // Afrobeat bell pattern
        },
    },
    drill: {
        bpm: [140, 150],
        pattern: {
            kick: [0, 3, 8, 11],
            snare: [6, 14], // displaced snare
            closed_hihat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
            open_hihat: [5, 13],
        },
    },
};
// ─── Utility Exports ───────────────────────────────────────────────
/**
 * Get scale note names for a given key and scale.
 * Useful for display and reference.
 */
export function getScaleNotes(key, scale, octave = 4) {
    const intervals = SCALES[scale] || SCALES.major;
    const keyPc = parseRoot(key);
    const preferFlats = FLAT_KEYS.has(key);
    const rootMidi = (octave + 1) * 12 + keyPc;
    const midi = intervals.map(i => rootMidi + i);
    const names = midi.map(m => midiToNoteName(m, preferFlats));
    return { names, midi };
}
/**
 * Transpose an array of MIDI notes by a given number of semitones.
 */
export function transpose(notes, semitones) {
    return notes.map(n => n + semitones);
}
/**
 * Invert a chord (rotate the lowest note up an octave).
 * @param notes - MIDI notes (sorted ascending)
 * @param inversion - Number of inversions (1 = first, 2 = second, etc.)
 */
export function invertChord(notes, inversion) {
    const result = [...notes].sort((a, b) => a - b);
    for (let i = 0; i < inversion && i < result.length; i++) {
        result.push(result.shift() + 12);
    }
    return result;
}
/**
 * Calculate the interval name between two MIDI notes.
 */
export function intervalName(semitones) {
    const names = {
        0: 'unison', 1: 'minor 2nd', 2: 'major 2nd', 3: 'minor 3rd',
        4: 'major 3rd', 5: 'perfect 4th', 6: 'tritone', 7: 'perfect 5th',
        8: 'minor 6th', 9: 'major 6th', 10: 'minor 7th', 11: 'major 7th',
        12: 'octave',
    };
    const mod = ((semitones % 12) + 12) % 12;
    const octaves = Math.floor(Math.abs(semitones) / 12);
    const base = names[mod] || `${mod} semitones`;
    if (octaves > 1)
        return `${base} + ${octaves - 1} octave${octaves > 2 ? 's' : ''}`;
    if (semitones === 12)
        return 'octave';
    if (semitones > 12)
        return `${base} + octave`;
    return base;
}
/**
 * Get the available scale names.
 */
export function listScales() {
    return Object.keys(SCALES);
}
/**
 * Get the available chord quality names.
 */
export function listChords() {
    return Object.keys(CHORDS);
}
/**
 * Get the available named progressions.
 */
export function listProgressions() {
    return Object.keys(NAMED_PROGRESSIONS);
}
/**
 * Get the available drum pattern genres.
 */
export function listDrumPatterns() {
    return Object.keys(GENRE_DRUM_PATTERNS);
}
/**
 * Get the available rhythm patterns.
 */
export function listRhythmPatterns() {
    return Object.keys(RHYTHM_PATTERNS);
}
//# sourceMappingURL=music-theory.js.map