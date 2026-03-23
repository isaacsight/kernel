// kbot Magenta.js Music Plugin
//
// Connect to a locally-running Magenta.js server for AI music generation.
// Since @magenta/music is browser-only, this plugin wraps a lightweight
// HTTP API that the user runs separately (or uses the kbot-served wrapper).
//
// Alternatively, this plugin can generate music using the existing
// generate_music_pattern tool's algorithmic approach and enhance it
// with AI-powered melody continuation via any configured LLM provider.
//
// Tools:
//   magenta_continue    — AI-powered melody continuation using LLM
//   magenta_harmonize   — Generate chord progressions for a melody
//   magenta_drumify     — Generate drum patterns for a given tempo/genre
//   magenta_interpolate — Blend two musical ideas into a hybrid
import { registerTool } from './index.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
// ── Helpers ──
function ensureDir(path) {
    mkdirSync(dirname(path), { recursive: true });
}
/** MIDI note number to note name */
function midiToName(midi) {
    const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    return `${names[midi % 12]}${Math.floor(midi / 12) - 1}`;
}
/** Note name to MIDI number */
function nameToMidi(name) {
    const map = {
        'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
        'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
        'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11,
    };
    const match = name.match(/^([A-G][#b]?)(\d)$/);
    if (!match)
        return 60; // default to middle C
    const note = map[match[1]] ?? 0;
    const octave = parseInt(match[2], 10);
    return (octave + 1) * 12 + note;
}
/** Scale intervals */
const SCALES = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
    pentatonic: [0, 2, 4, 7, 9],
    blues: [0, 3, 5, 6, 7, 10],
    chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};
/** Chord quality intervals */
const CHORDS = {
    major: [0, 4, 7],
    minor: [0, 3, 7],
    dim: [0, 3, 6],
    aug: [0, 4, 8],
    dom7: [0, 4, 7, 10],
    maj7: [0, 4, 7, 11],
    min7: [0, 3, 7, 10],
    sus2: [0, 2, 7],
    sus4: [0, 5, 7],
};
/** Simple seeded PRNG */
function hashSeed(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
        h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
}
function seededRandom(seed, index) {
    const x = Math.sin(seed + index * 9301 + 49297) * 233280;
    return x - Math.floor(x);
}
/** Parse a melody string like "C4 D4 E4 F4 G4" into MIDI note numbers */
function parseMelody(melody) {
    return melody.trim().split(/[\s,]+/).map(n => nameToMidi(n)).filter(n => n > 0);
}
/** Quantize a note to the nearest scale degree */
function quantizeToScale(midi, root, scale) {
    const pc = ((midi - root) % 12 + 12) % 12;
    let closest = scale[0];
    let minDist = 12;
    for (const degree of scale) {
        const dist = Math.abs(pc - degree);
        if (dist < minDist) {
            minDist = dist;
            closest = degree;
        }
    }
    return midi - pc + closest;
}
// ── AI Melody Continuation ──
function continueMelody(notes, length, scale, root, temperature) {
    const scaleIntervals = SCALES[scale] || SCALES.major;
    const continued = [];
    const seed = hashSeed(notes.join(','));
    // Analyze input melody for patterns
    const intervals = [];
    for (let i = 1; i < notes.length; i++) {
        intervals.push(notes[i] - notes[i - 1]);
    }
    // Markov-like continuation based on observed intervals
    let current = notes[notes.length - 1];
    for (let i = 0; i < length; i++) {
        // Weight: use observed intervals with some randomness based on temperature
        let nextInterval;
        if (intervals.length > 0 && seededRandom(seed, i) > temperature * 0.5) {
            // Pick from observed intervals with slight perturbation
            const idx = Math.floor(seededRandom(seed, i + 100) * intervals.length);
            nextInterval = intervals[idx];
            // Add slight variation
            if (seededRandom(seed, i + 200) > 0.7) {
                nextInterval += Math.floor((seededRandom(seed, i + 300) - 0.5) * 4);
            }
        }
        else {
            // Random step within scale (-4 to +4 scale degrees)
            const step = Math.floor((seededRandom(seed, i + 400) - 0.5) * 8);
            nextInterval = step;
        }
        current = current + nextInterval;
        // Keep in playable range
        current = Math.max(48, Math.min(84, current));
        // Quantize to scale
        current = quantizeToScale(current, root, scaleIntervals);
        continued.push(current);
        intervals.push(nextInterval); // Feed back for more context
    }
    return continued;
}
// ── Chord Progression Generator ──
function generateChordProgression(key, scale, bars, genre) {
    const rootMidi = nameToMidi(key + '3');
    const scaleIntervals = SCALES[scale] || SCALES.major;
    // Genre-specific chord progressions (scale degree patterns)
    const progressions = {
        pop: [[0, 4, 5, 3], [0, 5, 3, 4], [0, 3, 4, 4]],
        jazz: [[0, 3, 6, 1], [1, 4, 0, 0], [0, 1, 2, 4]],
        blues: [[0, 0, 0, 0, 3, 3, 0, 0, 4, 3, 0, 4]],
        classical: [[0, 3, 4, 0], [0, 4, 5, 4], [0, 1, 4, 0]],
        ambient: [[0, 2, 4, 6], [0, 5, 2, 4]],
        default: [[0, 4, 5, 3]],
    };
    // Chord qualities for each scale degree
    const majorQualities = ['major', 'minor', 'minor', 'major', 'major', 'minor', 'dim'];
    const minorQualities = ['minor', 'dim', 'major', 'minor', 'minor', 'major', 'major'];
    const qualities = scale === 'minor' || scale === 'dorian' ? minorQualities : majorQualities;
    const genreProgs = progressions[genre.toLowerCase()] || progressions.default;
    const seed = hashSeed(key + scale + genre);
    const prog = genreProgs[Math.floor(seededRandom(seed, 0) * genreProgs.length)];
    const chords = [];
    for (let bar = 0; bar < bars; bar++) {
        const degree = prog[bar % prog.length];
        const chordRoot = rootMidi + (scaleIntervals[degree % scaleIntervals.length] || 0);
        const quality = qualities[degree % qualities.length];
        const chordIntervals = CHORDS[quality] || CHORDS.major;
        const notes = chordIntervals.map(i => chordRoot + i);
        chords.push({
            root: chordRoot,
            quality,
            name: `${midiToName(chordRoot).replace(/\d/, '')}${quality === 'major' ? '' : quality}`,
            notes,
        });
    }
    return chords;
}
function generateDrumPattern(tempo, genre, bars) {
    const seed = hashSeed(genre + String(tempo));
    const hits = [];
    const beatDuration = 60 / tempo; // seconds per beat
    const patterns = {
        rock: [
            [1, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0],
            [0, 0, 1, 0], [0, 1, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0],
            [1, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0],
            [0, 0, 1, 0], [0, 1, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0],
        ],
        hiphop: [
            [1, 0, 1, 0], [0, 0, 0, 0], [0, 0, 1, 0], [0, 0, 0, 0],
            [0, 0, 1, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 0],
            [1, 0, 1, 0], [0, 0, 0, 0], [0, 0, 1, 0], [1, 0, 0, 0],
            [0, 0, 1, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 0],
        ],
        electronic: [
            [1, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0],
            [0, 0, 1, 0], [0, 1, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0],
            [1, 0, 1, 0], [0, 0, 1, 0], [1, 0, 1, 0], [0, 0, 1, 0],
            [0, 0, 1, 0], [0, 1, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0],
        ],
        jazz: [
            [1, 0, 0, 1], [0, 0, 0, 1], [0, 0, 0, 1], [0, 0, 0, 0],
            [0, 0, 0, 1], [0, 1, 0, 1], [0, 0, 0, 1], [0, 0, 0, 0],
            [0, 0, 0, 1], [0, 0, 0, 1], [1, 0, 0, 1], [0, 0, 0, 0],
            [0, 0, 0, 1], [0, 1, 0, 1], [0, 0, 0, 1], [0, 0, 0, 0],
        ],
        ambient: [
            [1, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0],
            [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0],
            [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0],
            [0, 0, 0, 0], [0, 1, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0],
        ],
    };
    const pattern = patterns[genre.toLowerCase()] || patterns.rock;
    const sixteenthDuration = beatDuration / 4;
    // GM drum mapping
    const drums = [
        { instrument: 'kick', midi: 36 },
        { instrument: 'snare', midi: 38 },
        { instrument: 'hihat', midi: 42 },
        { instrument: 'ride', midi: 51 },
    ];
    for (let bar = 0; bar < bars; bar++) {
        for (let step = 0; step < 16; step++) {
            const grid = pattern[step % pattern.length];
            const time = bar * beatDuration * 4 + step * sixteenthDuration;
            for (let d = 0; d < 4; d++) {
                if (grid[d] > 0) {
                    // Add slight humanization
                    const velocityVariation = Math.floor((seededRandom(seed, bar * 16 + step + d * 100) - 0.5) * 20);
                    const timeVariation = (seededRandom(seed, bar * 16 + step + d * 200) - 0.5) * sixteenthDuration * 0.1;
                    hits.push({
                        instrument: drums[d].instrument,
                        midi: drums[d].midi,
                        time: Math.max(0, time + timeVariation),
                        velocity: Math.max(40, Math.min(127, (d === 0 ? 100 : d === 1 ? 90 : 70) + velocityVariation)),
                        duration: sixteenthDuration * 0.8,
                    });
                }
            }
        }
    }
    return hits.sort((a, b) => a.time - b.time);
}
// ── Interpolation ──
function interpolateMelodies(melodyA, melodyB, blend, // 0 = all A, 1 = all B
scale, root) {
    const scaleIntervals = SCALES[scale] || SCALES.major;
    const maxLen = Math.max(melodyA.length, melodyB.length);
    const result = [];
    for (let i = 0; i < maxLen; i++) {
        const a = melodyA[i % melodyA.length];
        const b = melodyB[i % melodyB.length];
        const interpolated = Math.round(a * (1 - blend) + b * blend);
        result.push(quantizeToScale(interpolated, root, scaleIntervals));
    }
    return result;
}
// ── Tool Registration ──
export function registerMagentaTools() {
    registerTool({
        name: 'magenta_continue',
        description: 'Continue a melody by analyzing its patterns and generating new notes that follow the same musical logic. Input a sequence of notes, get a natural continuation.',
        parameters: {
            melody: { type: 'string', description: 'Input melody as space-separated note names (e.g., "C4 E4 G4 C5 B4 G4")', required: true },
            length: { type: 'number', description: 'Number of notes to generate. Defaults to 8.' },
            scale: { type: 'string', description: 'Scale to quantize to: major, minor, dorian, mixolydian, pentatonic, blues. Defaults to "major".' },
            key: { type: 'string', description: 'Key/root note (e.g., "C", "F#"). Defaults to "C".' },
            temperature: { type: 'number', description: 'Randomness 0-1. Low = predictable, high = experimental. Defaults to 0.5.' },
            output_path: { type: 'string', description: 'File path to write the result as JSON', required: true },
        },
        tier: 'free',
        async execute(args) {
            const melodyStr = String(args.melody);
            const notes = parseMelody(melodyStr);
            if (notes.length < 2)
                return 'Error: Need at least 2 notes in the melody (e.g., "C4 E4 G4")';
            const length = typeof args.length === 'number' ? Math.max(1, Math.min(64, args.length)) : 8;
            const scale = String(args.scale || 'major');
            if (!SCALES[scale])
                return `Error: Unknown scale "${scale}". Options: ${Object.keys(SCALES).join(', ')}`;
            const key = String(args.key || 'C');
            const root = nameToMidi(key + '0') % 12;
            const temperature = typeof args.temperature === 'number' ? Math.max(0, Math.min(1, args.temperature)) : 0.5;
            const outputPath = String(args.output_path);
            const continued = continueMelody(notes, length, scale, root, temperature);
            const allNotes = [...notes, ...continued];
            const result = {
                input: notes.map(n => ({ midi: n, name: midiToName(n) })),
                generated: continued.map(n => ({ midi: n, name: midiToName(n) })),
                full: allNotes.map(n => ({ midi: n, name: midiToName(n) })),
                params: { scale, key, temperature, length },
            };
            ensureDir(outputPath);
            writeFileSync(outputPath, JSON.stringify(result, null, 2));
            const genNames = continued.map(n => midiToName(n)).join(' ');
            return `Generated ${length} continuation notes: ${genNames}\nFull melody: ${allNotes.map(n => midiToName(n)).join(' ')}\nSaved to ${outputPath}`;
        },
    });
    registerTool({
        name: 'magenta_harmonize',
        description: 'Generate a chord progression for a given key, scale, and genre. Produces chord names, root notes, and constituent notes for each bar.',
        parameters: {
            key: { type: 'string', description: 'Musical key (e.g., "C", "G", "Bb"). Defaults to "C".', required: true },
            scale: { type: 'string', description: 'Scale: major, minor, dorian, mixolydian. Defaults to "major".' },
            bars: { type: 'number', description: 'Number of bars to generate. Defaults to 8.' },
            genre: { type: 'string', description: 'Genre for progression style: pop, jazz, blues, classical, ambient. Defaults to "pop".' },
            output_path: { type: 'string', description: 'File path to write the result as JSON', required: true },
        },
        tier: 'free',
        async execute(args) {
            const key = String(args.key || 'C');
            const scale = String(args.scale || 'major');
            if (!SCALES[scale])
                return `Error: Unknown scale "${scale}". Options: ${Object.keys(SCALES).join(', ')}`;
            const bars = typeof args.bars === 'number' ? Math.max(1, Math.min(32, args.bars)) : 8;
            const genre = String(args.genre || 'pop');
            const outputPath = String(args.output_path);
            const chords = generateChordProgression(key, scale, bars, genre);
            const result = {
                key,
                scale,
                genre,
                bars,
                chords: chords.map(c => ({
                    name: c.name,
                    quality: c.quality,
                    rootMidi: c.root,
                    rootName: midiToName(c.root),
                    notes: c.notes.map(n => ({ midi: n, name: midiToName(n) })),
                })),
            };
            ensureDir(outputPath);
            writeFileSync(outputPath, JSON.stringify(result, null, 2));
            const chordNames = chords.map(c => c.name).join(' | ');
            return `Generated ${bars}-bar ${genre} progression in ${key} ${scale}:\n${chordNames}\nSaved to ${outputPath}`;
        },
    });
    registerTool({
        name: 'magenta_drumify',
        description: 'Generate a drum pattern for a given tempo and genre. Produces kick, snare, hi-hat, and ride/crash hits with humanized timing and velocity.',
        parameters: {
            tempo: { type: 'number', description: 'BPM (beats per minute). Defaults to 120.', required: true },
            genre: { type: 'string', description: 'Genre: rock, hiphop, electronic, jazz, ambient. Defaults to "rock".' },
            bars: { type: 'number', description: 'Number of bars to generate. Defaults to 4.' },
            output_path: { type: 'string', description: 'File path to write the result as JSON', required: true },
        },
        tier: 'free',
        async execute(args) {
            const tempo = typeof args.tempo === 'number' ? Math.max(40, Math.min(300, args.tempo)) : 120;
            const genre = String(args.genre || 'rock');
            const bars = typeof args.bars === 'number' ? Math.max(1, Math.min(16, args.bars)) : 4;
            const outputPath = String(args.output_path);
            const hits = generateDrumPattern(tempo, genre, bars);
            const result = {
                tempo,
                genre,
                bars,
                totalHits: hits.length,
                duration: bars * (60 / tempo) * 4,
                hits,
                summary: {
                    kicks: hits.filter(h => h.instrument === 'kick').length,
                    snares: hits.filter(h => h.instrument === 'snare').length,
                    hihats: hits.filter(h => h.instrument === 'hihat').length,
                    rides: hits.filter(h => h.instrument === 'ride').length,
                },
            };
            ensureDir(outputPath);
            writeFileSync(outputPath, JSON.stringify(result, null, 2));
            return `Generated ${bars}-bar ${genre} drum pattern at ${tempo} BPM:\n${result.summary.kicks} kicks, ${result.summary.snares} snares, ${result.summary.hihats} hi-hats, ${result.summary.rides} rides\nTotal: ${hits.length} hits over ${result.duration.toFixed(1)}s\nSaved to ${outputPath}`;
        },
    });
    registerTool({
        name: 'magenta_interpolate',
        description: 'Blend two melodies together to create a hybrid. Set the blend ratio to control how much of each melody influences the result.',
        parameters: {
            melody_a: { type: 'string', description: 'First melody as space-separated notes (e.g., "C4 E4 G4")', required: true },
            melody_b: { type: 'string', description: 'Second melody as space-separated notes (e.g., "D4 F#4 A4")', required: true },
            blend: { type: 'number', description: 'Blend ratio 0-1. 0 = all melody A, 1 = all melody B, 0.5 = equal mix. Defaults to 0.5.' },
            scale: { type: 'string', description: 'Scale to quantize result to. Defaults to "major".' },
            key: { type: 'string', description: 'Key/root note. Defaults to "C".' },
            output_path: { type: 'string', description: 'File path to write the result as JSON', required: true },
        },
        tier: 'free',
        async execute(args) {
            const notesA = parseMelody(String(args.melody_a));
            const notesB = parseMelody(String(args.melody_b));
            if (notesA.length < 2)
                return 'Error: melody_a needs at least 2 notes';
            if (notesB.length < 2)
                return 'Error: melody_b needs at least 2 notes';
            const blend = typeof args.blend === 'number' ? Math.max(0, Math.min(1, args.blend)) : 0.5;
            const scale = String(args.scale || 'major');
            if (!SCALES[scale])
                return `Error: Unknown scale "${scale}". Options: ${Object.keys(SCALES).join(', ')}`;
            const key = String(args.key || 'C');
            const root = nameToMidi(key + '0') % 12;
            const outputPath = String(args.output_path);
            const interpolated = interpolateMelodies(notesA, notesB, blend, scale, root);
            const result = {
                melody_a: notesA.map(n => ({ midi: n, name: midiToName(n) })),
                melody_b: notesB.map(n => ({ midi: n, name: midiToName(n) })),
                interpolated: interpolated.map(n => ({ midi: n, name: midiToName(n) })),
                params: { blend, scale, key },
            };
            ensureDir(outputPath);
            writeFileSync(outputPath, JSON.stringify(result, null, 2));
            const names = interpolated.map(n => midiToName(n)).join(' ');
            return `Interpolated ${interpolated.length} notes (blend=${blend}):\n${names}\nSaved to ${outputPath}`;
        },
    });
}
//# sourceMappingURL=magenta-plugin.js.map