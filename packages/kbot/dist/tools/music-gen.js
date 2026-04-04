// kbot Music Generation Engine — AI-powered songwriting + pattern generation
//
// Suno-style creative music generation using local Ollama models ($0 cost).
// Outputs are compatible with kbot's Ableton tools so users can pipe:
//   music_idea -> generate_drum_pattern -> ableton_midi
//
// Tools:
//   generate_lyrics          — AI lyrics from genre + mood + topic
//   generate_melody_pattern  — MIDI melody from key + scale + BPM + genre
//   generate_drum_pattern    — MIDI drums from genre + BPM + feel
//   generate_song_structure  — Full arrangement plan from genre + BPM + key
//   music_idea               — Creative prompt -> full production blueprint
//
// All generation uses local Ollama (kernel:latest) — zero API cost.
// Music theory computations use music-theory.ts — zero AI needed.
import { registerTool } from './index.js';
import { SCALES, NAMED_PROGRESSIONS, GENRE_DRUM_PATTERNS, GM_DRUMS, RHYTHM_PATTERNS, getScaleNotes, noteNameToMidi, midiToNoteName, parseProgression, quantizeToScale, } from './music-theory.js';
// ── Ollama Integration ─────────────────────────────────────────────────────
const OLLAMA_URL = process.env.OLLAMA_HOST || 'http://localhost:11434';
const DEFAULT_MODEL = 'kernel:latest';
/**
 * Call local Ollama for creative generation. Returns raw text.
 * Falls back gracefully if Ollama is offline.
 */
async function ollamaGenerate(prompt, opts) {
    const model = opts?.model || DEFAULT_MODEL;
    const temperature = opts?.temperature ?? 0.8;
    const maxTokens = opts?.maxTokens ?? 1024;
    try {
        const res = await fetch(`${OLLAMA_URL}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                prompt,
                stream: false,
                options: { num_predict: maxTokens, temperature },
            }),
            signal: AbortSignal.timeout(120_000),
        });
        if (!res.ok) {
            return `[Ollama error: HTTP ${res.status}. Is Ollama running? Try: ollama serve]`;
        }
        const data = (await res.json());
        // Strip thinking tags that some models emit
        return (data.response || '')
            .replace(/<think>[\s\S]*?<\/think>/g, '')
            .trim();
    }
    catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
            return '[Ollama timed out after 120s. Model may still be loading.]';
        }
        return `[Ollama offline. Start with: ollama serve]`;
    }
}
/**
 * Call Ollama and parse the response as JSON.
 * Extracts the first JSON object or array from the response.
 */
async function ollamaGenerateJSON(prompt, opts) {
    const raw = await ollamaGenerate(prompt, opts);
    if (raw.startsWith('[Ollama'))
        return null;
    // Try to extract JSON from the response
    const jsonMatch = raw.match(/[\[{][\s\S]*[\]}]/);
    if (!jsonMatch)
        return null;
    try {
        return JSON.parse(jsonMatch[0]);
    }
    catch {
        return null;
    }
}
// ── Helpers ────────────────────────────────────────────────────────────────
function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
function randomInRange(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
/** Parse a key string like "Cm", "F#m", "Bb" into root + scale */
function parseKeyString(keyStr) {
    const match = keyStr.match(/^([A-Ga-g][#b]?)(m|min|minor)?$/i);
    if (!match)
        return { root: 'C', scale: 'natural_minor' };
    const root = match[1].charAt(0).toUpperCase() + match[1].slice(1);
    const isMinor = !!match[2];
    return { root, scale: isMinor ? 'natural_minor' : 'major' };
}
/** Get available genre names from GENRE_DRUM_PATTERNS */
function availableGenres() {
    return Object.keys(GENRE_DRUM_PATTERNS);
}
/** Format a MidiNote array as readable JSON for output */
function formatMidiNotes(notes) {
    return JSON.stringify(notes.map(n => ({
        note: midiToNoteName(n.pitch),
        midi: n.pitch,
        velocity: n.velocity,
        start_beat: Math.round(n.start * 1000) / 1000,
        duration: Math.round(n.duration * 1000) / 1000,
    })), null, 2);
}
const GENRE_PROFILES = {
    trap: {
        bpmRange: [130, 170],
        preferredKeys: ['Cm', 'Dm', 'Am', 'Em', 'Fm'],
        preferredScales: ['natural_minor', 'phrygian', 'harmonic_minor'],
        feel: 'straight',
        progressions: ['i bVI bVII i', 'i bVII bVI V', 'i iv bVI bVII'],
        instruments: ['808 bass', 'hi-hats', 'snare/clap', 'dark pads', 'bells', 'plucks'],
        energyProfile: 'half-time feel with rapid hi-hats, sparse arrangement, heavy 808',
        description: 'Modern trap: half-time drums, 808 bass slides, rapid hi-hat patterns, dark minor tonality',
    },
    drill: {
        bpmRange: [140, 150],
        preferredKeys: ['Cm', 'Dm', 'Bbm', 'Gm'],
        preferredScales: ['natural_minor', 'harmonic_minor', 'phrygian'],
        feel: 'straight',
        progressions: ['i bVI bVII i', 'i bII bVII i', 'i bVI V i'],
        instruments: ['sliding 808', 'clap', 'hi-hats', 'dark piano', 'strings'],
        energyProfile: 'relentless hi-hats, syncopated kicks, sliding 808 bass',
        description: 'UK/NY drill: sliding 808s, displaced snare, aggressive hi-hat patterns, minor keys',
    },
    house: {
        bpmRange: [120, 130],
        preferredKeys: ['Am', 'Cm', 'Dm', 'Gm'],
        preferredScales: ['natural_minor', 'dorian', 'major'],
        feel: 'straight',
        progressions: ['i bVII bVI bVII', 'i iv bVI V', 'vi IV I V'],
        instruments: ['four-on-floor kick', 'open hats', 'claps', 'synth bass', 'piano stabs', 'vocal chops'],
        energyProfile: 'steady four-on-floor, build-and-release dynamics',
        description: 'House: four-on-floor kick, offbeat hi-hats, piano chords, deep bassline',
    },
    lofi: {
        bpmRange: [70, 90],
        preferredKeys: ['Em', 'Am', 'Dm', 'Cm', 'Gm'],
        preferredScales: ['natural_minor', 'dorian', 'pentatonic_minor'],
        feel: 'swing',
        progressions: ['ii7 V7 Imaj7', 'Imaj7 vi7 ii7 V7', 'i iv bVI V'],
        instruments: ['dusty drums', 'jazz piano', 'Rhodes', 'vinyl crackle', 'bass guitar', 'guitar'],
        energyProfile: 'chill, relaxed, nostalgic, lo-fi warmth',
        description: 'Lo-fi hip hop: jazzy chords, dusty drums, vinyl texture, mellow bass',
    },
    pop: {
        bpmRange: [100, 130],
        preferredKeys: ['C', 'G', 'D', 'A', 'F'],
        preferredScales: ['major', 'mixolydian'],
        feel: 'straight',
        progressions: ['I V vi IV', 'vi IV I V', 'I IV vi V'],
        instruments: ['drums', 'bass', 'piano', 'synth pad', 'guitar', 'vocal'],
        energyProfile: 'verse-chorus dynamics, catchy hooks, bright tones',
        description: 'Pop: standard backbeat, singable melodies, major keys, verse-chorus structure',
    },
    rnb: {
        bpmRange: [65, 95],
        preferredKeys: ['Dm', 'Am', 'Em', 'Cm', 'Gm'],
        preferredScales: ['dorian', 'natural_minor', 'pentatonic_minor'],
        feel: 'swing',
        progressions: ['Imaj7 iii7 vi7 ii7 V7', 'i iv bVI V', 'ii7 V7 Imaj7'],
        instruments: ['Rhodes', 'bass guitar', 'drums', 'strings', 'vocal harmonies', 'synth pad'],
        energyProfile: 'smooth, laid-back groove with lush harmony',
        description: 'R&B: jazzy extended chords, smooth bass, expressive melody, intimate feel',
    },
    phonk: {
        bpmRange: [130, 145],
        preferredKeys: ['Cm', 'Dm', 'Em', 'Am'],
        preferredScales: ['natural_minor', 'blues', 'phrygian'],
        feel: 'straight',
        progressions: ['i bVI bVII i', 'i bII i bVII', 'i iv i V'],
        instruments: ['Memphis drums', 'cowbell', '808 bass', 'distorted vocals', 'chopped soul samples'],
        energyProfile: 'dark, aggressive, lo-fi Memphis rap aesthetic',
        description: 'Phonk: cowbells, dark melodies, distorted 808, Memphis rap influence',
    },
    ambient: {
        bpmRange: [60, 90],
        preferredKeys: ['Am', 'Em', 'Dm', 'C', 'G'],
        preferredScales: ['major', 'lydian', 'dorian', 'pentatonic_major'],
        feel: 'straight',
        progressions: ['I II', 'i bVII', 'Imaj7 IVmaj7', 'i bVI'],
        instruments: ['evolving pads', 'granular textures', 'reverb piano', 'field recordings', 'drones'],
        energyProfile: 'slow evolution, wide stereo, textural layers',
        description: 'Ambient: long evolving textures, wide reverb, minimal rhythm, atmospheric',
    },
    techno: {
        bpmRange: [130, 145],
        preferredKeys: ['Am', 'Dm', 'Em', 'Cm'],
        preferredScales: ['natural_minor', 'phrygian', 'dorian'],
        feel: 'straight',
        progressions: ['i bVII', 'i iv', 'i bVI bVII i'],
        instruments: ['four-on-floor kick', 'clap', 'ride cymbal', 'acid bass', 'synth stabs', 'noise sweeps'],
        energyProfile: 'hypnotic, driving, build-and-release over long sections',
        description: 'Techno: driving kick, industrial textures, acid basslines, hypnotic repetition',
    },
    jazz: {
        bpmRange: [100, 180],
        preferredKeys: ['F', 'Bb', 'Eb', 'Ab', 'Db', 'C'],
        preferredScales: ['major', 'dorian', 'mixolydian', 'bebop_dominant'],
        feel: 'swing',
        progressions: ['ii7 V7 Imaj7', 'Imaj7 vi7 ii7 V7', 'Imaj7 bIIImaj7 IVmaj7 bVImaj7'],
        instruments: ['piano/Rhodes', 'upright bass', 'drums (brushes/sticks)', 'saxophone', 'trumpet'],
        energyProfile: 'conversational dynamics, improvisation, swing feel',
        description: 'Jazz: extended chords, swing rhythm, walking bass, improvisation-friendly',
    },
    dnb: {
        bpmRange: [160, 180],
        preferredKeys: ['Am', 'Dm', 'Em', 'Cm'],
        preferredScales: ['natural_minor', 'harmonic_minor', 'phrygian'],
        feel: 'straight',
        progressions: ['i bVII bVI V', 'i bVI bIII bVII', 'i iv bVI bVII'],
        instruments: ['breakbeat drums', 'reese bass', 'pads', 'vocal samples', 'synth leads'],
        energyProfile: 'fast breaks, heavy bass, liquid or aggressive textures',
        description: 'Drum & bass: breakbeat at 170+, deep reese bass, atmospheric pads',
    },
    reggaeton: {
        bpmRange: [88, 100],
        preferredKeys: ['Am', 'Dm', 'Em', 'Cm'],
        preferredScales: ['natural_minor', 'harmonic_minor', 'phrygian_dominant'],
        feel: 'straight',
        progressions: ['vi IV I V', 'i bVII bVI V', 'i iv V i'],
        instruments: ['dembow drums', 'bass', 'reggaeton snare', 'synth lead', 'vocal', 'perc'],
        energyProfile: 'dembow rhythm, steady energy, danceable groove',
        description: 'Reggaeton: dembow beat pattern, Latin percussion, catchy vocal hooks',
    },
};
function getStructureForGenre(genre, bpm) {
    // Adapt bar counts to BPM — faster tempos need fewer bars per section to stay in typical song length
    const tempoFactor = bpm > 150 ? 1.5 : bpm > 120 ? 1.0 : 0.75;
    const structures = {
        trap: [
            { name: 'Intro', bars: 4, energy: 0.2, instruments: ['pads', 'melody'], description: 'Atmospheric intro, filtered melody teaser' },
            { name: 'Verse 1', bars: 8, energy: 0.5, instruments: ['drums', 'bass', 'melody'], description: 'Drums enter, half-time feel, bass holds' },
            { name: 'Pre-Hook', bars: 4, energy: 0.7, instruments: ['drums', 'bass', 'melody', 'perc'], description: 'Build energy with hi-hat rolls, rising 808' },
            { name: 'Hook', bars: 8, energy: 0.9, instruments: ['drums', 'bass', 'melody', 'pads', 'perc'], description: 'Full arrangement, catchiest melody, heavy 808' },
            { name: 'Verse 2', bars: 8, energy: 0.5, instruments: ['drums', 'bass', 'melody', 'perc'], description: 'Variation on verse 1, added percussion' },
            { name: 'Hook 2', bars: 8, energy: 0.95, instruments: ['drums', 'bass', 'melody', 'pads', 'perc', 'fx'], description: 'Full arrangement with extra energy layers' },
            { name: 'Bridge', bars: 4, energy: 0.4, instruments: ['pads', 'melody', 'bass'], description: 'Stripped back, emotional break, no drums' },
            { name: 'Final Hook', bars: 8, energy: 1.0, instruments: ['drums', 'bass', 'melody', 'pads', 'perc', 'fx'], description: 'Maximum energy, double-time hats, full stack' },
            { name: 'Outro', bars: 4, energy: 0.15, instruments: ['pads', 'melody'], description: 'Elements drop out, reverb tail, fade' },
        ],
        house: [
            { name: 'Intro', bars: 8, energy: 0.3, instruments: ['kick', 'hats'], description: 'Kick and hats build, hi-pass filter opening' },
            { name: 'Build A', bars: 8, energy: 0.5, instruments: ['drums', 'bass'], description: 'Bass enters, groove established' },
            { name: 'Main A', bars: 16, energy: 0.8, instruments: ['drums', 'bass', 'chords', 'melody'], description: 'Full groove, main hook, chord stabs' },
            { name: 'Breakdown', bars: 8, energy: 0.3, instruments: ['pads', 'melody', 'fx'], description: 'Kick drops, pads swell, tension builds' },
            { name: 'Build B', bars: 4, energy: 0.6, instruments: ['drums', 'bass', 'fx'], description: 'Riser, snare roll, kick returns' },
            { name: 'Main B', bars: 16, energy: 0.9, instruments: ['drums', 'bass', 'chords', 'melody', 'perc'], description: 'Peak energy, all elements, extra percussion' },
            { name: 'Breakdown 2', bars: 8, energy: 0.35, instruments: ['pads', 'chords'], description: 'Second breakdown, different melodic element' },
            { name: 'Main C', bars: 16, energy: 0.85, instruments: ['drums', 'bass', 'chords', 'melody'], description: 'Return to groove, slight variation' },
            { name: 'Outro', bars: 8, energy: 0.2, instruments: ['kick', 'hats'], description: 'Elements drop, kick and hats ride out' },
        ],
        pop: [
            { name: 'Intro', bars: 4, energy: 0.3, instruments: ['guitar/piano', 'light drums'], description: 'Instrumental hook or vocal ad-lib' },
            { name: 'Verse 1', bars: 8, energy: 0.5, instruments: ['drums', 'bass', 'guitar/piano'], description: 'Verse melody, simple arrangement' },
            { name: 'Pre-Chorus', bars: 4, energy: 0.7, instruments: ['drums', 'bass', 'synth', 'guitar/piano'], description: 'Harmonic lift, building anticipation' },
            { name: 'Chorus', bars: 8, energy: 0.9, instruments: ['drums', 'bass', 'synth', 'guitar/piano', 'vocal layers'], description: 'Biggest hook, full arrangement, singable melody' },
            { name: 'Verse 2', bars: 8, energy: 0.55, instruments: ['drums', 'bass', 'guitar/piano', 'perc'], description: 'Slightly bigger than verse 1' },
            { name: 'Pre-Chorus 2', bars: 4, energy: 0.75, instruments: ['drums', 'bass', 'synth', 'guitar/piano'], description: 'Same lift, slight variation' },
            { name: 'Chorus 2', bars: 8, energy: 0.95, instruments: ['drums', 'bass', 'synth', 'guitar/piano', 'vocal layers', 'strings'], description: 'Bigger chorus with added elements' },
            { name: 'Bridge', bars: 8, energy: 0.4, instruments: ['piano', 'strings', 'vocal'], description: 'New harmony, emotional contrast, stripped back' },
            { name: 'Final Chorus', bars: 8, energy: 1.0, instruments: ['drums', 'bass', 'synth', 'guitar/piano', 'vocal layers', 'strings', 'perc'], description: 'Key change optional, maximum energy' },
            { name: 'Outro', bars: 4, energy: 0.2, instruments: ['guitar/piano', 'vocal'], description: 'Instrumental hook callback, fade or hard stop' },
        ],
        ambient: [
            { name: 'Opening', bars: 8, energy: 0.1, instruments: ['drone', 'field recording'], description: 'Single texture emerges from silence' },
            { name: 'Evolution A', bars: 16, energy: 0.3, instruments: ['pad', 'drone', 'granular'], description: 'Slowly evolving textures layer in' },
            { name: 'Peak', bars: 16, energy: 0.6, instruments: ['pad', 'piano', 'granular', 'bass drone'], description: 'Richest harmonic content, widest stereo' },
            { name: 'Dissolution', bars: 16, energy: 0.35, instruments: ['pad', 'drone'], description: 'Elements fade, space opens up' },
            { name: 'Coda', bars: 8, energy: 0.05, instruments: ['drone'], description: 'Return to near-silence, single texture' },
        ],
    };
    // Default structure for genres not explicitly defined
    const defaultStructure = [
        { name: 'Intro', bars: 4, energy: 0.25, instruments: ['melody', 'pads'], description: 'Establish mood and key' },
        { name: 'Verse 1', bars: 8, energy: 0.5, instruments: ['drums', 'bass', 'melody'], description: 'Main groove, primary melody' },
        { name: 'Chorus/Hook', bars: 8, energy: 0.85, instruments: ['drums', 'bass', 'melody', 'chords', 'perc'], description: 'Full energy, hook section' },
        { name: 'Verse 2', bars: 8, energy: 0.55, instruments: ['drums', 'bass', 'melody', 'perc'], description: 'Variation with added elements' },
        { name: 'Chorus/Hook 2', bars: 8, energy: 0.9, instruments: ['drums', 'bass', 'melody', 'chords', 'perc', 'fx'], description: 'Bigger hook with layers' },
        { name: 'Bridge', bars: 4, energy: 0.35, instruments: ['pads', 'melody'], description: 'Contrast section, stripped back' },
        { name: 'Final Hook', bars: 8, energy: 1.0, instruments: ['drums', 'bass', 'melody', 'chords', 'perc', 'fx'], description: 'Maximum energy climax' },
        { name: 'Outro', bars: 4, energy: 0.15, instruments: ['melody', 'pads'], description: 'Wind down, elements exit' },
    ];
    const sections = structures[genre] || defaultStructure;
    // Scale bar counts by tempo factor
    const scaled = sections.map(s => ({
        ...s,
        bars: Math.max(2, Math.round(s.bars * tempoFactor)),
    }));
    const totalBars = scaled.reduce((sum, s) => sum + s.bars, 0);
    return { sections: scaled, totalBars };
}
/**
 * Generate a melodic pattern using music theory rules.
 * Uses scale-constrained note selection with genre-appropriate rhythmic patterns.
 */
function generateMelodyFromTheory(config) {
    const { key, scale, bars, octave, genre, density } = config;
    const scaleData = getScaleNotes(key, scale, octave);
    const scaleMidi = scaleData.midi;
    // Add upper octave notes for melodic range
    const extendedScale = [...scaleMidi, ...scaleMidi.map(n => n + 12)];
    const notes = [];
    const beatsPerBar = 4;
    const totalBeats = bars * beatsPerBar;
    // Genre-specific rhythm selection
    let rhythmKey;
    if (genre === 'trap' || genre === 'drill' || genre === 'phonk') {
        rhythmKey = density === 'dense' ? 'sixteenth' : density === 'moderate' ? 'eighth' : 'quarter';
    }
    else if (genre === 'lofi' || genre === 'jazz' || genre === 'rnb') {
        rhythmKey = density === 'dense' ? 'swing' : density === 'moderate' ? 'eighth' : 'dotted_quarter';
    }
    else if (genre === 'ambient') {
        rhythmKey = density === 'dense' ? 'quarter' : 'whole';
    }
    else if (genre === 'house' || genre === 'techno') {
        rhythmKey = density === 'dense' ? 'sixteenth' : 'eighth';
    }
    else {
        rhythmKey = density === 'dense' ? 'eighth' : 'quarter';
    }
    const rhythmPositions = RHYTHM_PATTERNS[rhythmKey] || RHYTHM_PATTERNS.quarter;
    // Walk through bars generating notes
    let prevScaleIdx = Math.floor(scaleMidi.length / 2); // Start near middle of scale
    const scaleLen = extendedScale.length;
    for (let bar = 0; bar < bars; bar++) {
        const barStart = bar * beatsPerBar;
        for (const pos of rhythmPositions) {
            const beat = barStart + pos;
            if (beat >= totalBeats)
                break;
            // Probability of placing a note (rest probability)
            const restChance = genre === 'ambient' ? 0.5 : genre === 'lofi' ? 0.25 : 0.15;
            if (Math.random() < restChance)
                continue;
            // Step-wise motion with occasional leaps (good melody writing)
            const stepSize = Math.random() < 0.7
                ? (Math.random() < 0.5 ? 1 : -1) // step
                : (Math.random() < 0.5 ? randomInRange(2, 4) : randomInRange(-4, -2)); // leap
            prevScaleIdx = clamp(prevScaleIdx + stepSize, 0, scaleLen - 1);
            const pitch = extendedScale[prevScaleIdx];
            // Velocity shaping
            const isDownbeat = pos === 0;
            const isBackbeat = pos === 1 || pos === 3;
            let velocity = randomInRange(60, 90);
            if (isDownbeat)
                velocity = randomInRange(85, 110);
            else if (isBackbeat)
                velocity = randomInRange(70, 95);
            velocity = clamp(velocity, 1, 127);
            // Note duration varies by density
            const maxDur = density === 'sparse' ? 2.0 : density === 'moderate' ? 1.0 : 0.5;
            const minDur = density === 'sparse' ? 0.5 : density === 'moderate' ? 0.25 : 0.125;
            const duration = minDur + Math.random() * (maxDur - minDur);
            notes.push({ pitch, start: beat, duration, velocity });
        }
    }
    // Quantize all notes to scale (safety)
    return notes.map(n => ({
        ...n,
        pitch: quantizeToScale(n.pitch, key, scale),
    }));
}
/**
 * Generate a drum pattern as MidiNote[].
 * Uses GENRE_DRUM_PATTERNS as a base, then applies feel/humanize/density.
 */
function generateDrumPattern(config) {
    const { genre, bars, feel, humanize, density } = config;
    const pattern = GENRE_DRUM_PATTERNS[genre] || GENRE_DRUM_PATTERNS.hiphop;
    const notes = [];
    for (let bar = 0; bar < bars; bar++) {
        const barStart = bar * 4; // 4 beats per bar
        for (const [instrument, positions] of Object.entries(pattern.pattern)) {
            const midiNote = GM_DRUMS[instrument];
            if (!midiNote)
                continue;
            for (const pos16th of positions) {
                // Density filter: randomly skip hits based on density parameter
                // Low density = more skips, high density = fewer skips
                if (density < 1.0 && Math.random() > density + 0.3)
                    continue;
                // Convert 16th note position to beat position
                let beatPos = pos16th / 4;
                // Apply feel
                if (feel === 'swing' || feel === 'triplet') {
                    // Swing the even 16th notes (the "e" and "a")
                    const sub = pos16th % 4;
                    if (sub === 1 || sub === 3) {
                        beatPos = (pos16th - sub) / 4 + (sub === 1 ? 2 / 3 : 3.5 / 4);
                    }
                }
                const start = barStart + beatPos;
                // Humanize: slight timing and velocity variation
                const timingOffset = humanize ? (Math.random() - 0.5) * 0.02 : 0;
                const velocityBase = instrument === 'kick' || instrument === 'snare' || instrument === 'clap'
                    ? randomInRange(90, 120)
                    : instrument.includes('hihat') || instrument.includes('closed')
                        ? randomInRange(60, 100)
                        : randomInRange(70, 105);
                const velocityOffset = humanize ? randomInRange(-10, 10) : 0;
                // Hi-hat velocity patterns for trap/drill: accent rolls
                let velocity = clamp(velocityBase + velocityOffset, 1, 127);
                if ((genre === 'trap' || genre === 'drill' || genre === 'phonk') &&
                    (instrument === 'closed_hihat') && humanize) {
                    // Create a rolling accent pattern
                    const accent = (pos16th % 4 === 0) ? 20 : (pos16th % 2 === 0) ? 10 : 0;
                    velocity = clamp(velocity + accent, 1, 127);
                }
                notes.push({
                    pitch: midiNote,
                    start: start + timingOffset,
                    duration: 0.1, // drums are short
                    velocity,
                });
            }
        }
    }
    // Sort by start time
    return notes.sort((a, b) => a.start - b.start);
}
// ── Tool Registration ──────────────────────────────────────────────────────
export function registerMusicGenTools() {
    // ─── 1. Generate Lyrics ─────────────────────────────────────────────
    registerTool({
        name: 'generate_lyrics',
        description: '[Music Gen] Generate song lyrics using local AI (Ollama, $0 cost). Produces verse/chorus/bridge structure with genre-appropriate language and flow. Output is plain text with section markers.',
        parameters: {
            genre: {
                type: 'string',
                description: 'Music genre (e.g., "trap", "pop", "rnb", "rock", "country", "jazz", "indie", "reggaeton")',
                required: true,
            },
            mood: {
                type: 'string',
                description: 'Emotional mood (e.g., "melancholic", "hype", "romantic", "aggressive", "dreamy", "uplifting")',
                required: true,
            },
            topic: {
                type: 'string',
                description: 'What the song is about (e.g., "late night drives", "heartbreak", "grinding for success", "summer love")',
                required: true,
            },
            structure: {
                type: 'string',
                description: 'Song structure — comma-separated sections. Default: "verse,chorus,verse,chorus,bridge,chorus". Other options: "verse,chorus", "intro,verse,hook,verse,hook,outro"',
            },
            style_reference: {
                type: 'string',
                description: 'Optional style reference — artist or song to channel (e.g., "Drake", "Billie Eilish", "Frank Ocean"). The AI uses this for tone/cadence, not copying.',
            },
        },
        tier: 'free',
        timeout: 120_000,
        async execute(args) {
            const genre = String(args.genre);
            const mood = String(args.mood);
            const topic = String(args.topic);
            const structure = String(args.structure || 'verse,chorus,verse,chorus,bridge,chorus');
            const styleRef = args.style_reference ? ` Channel the writing style/cadence of ${args.style_reference} (tone only, not copying lyrics).` : '';
            const sections = structure.split(',').map(s => s.trim());
            const prompt = `You are a professional songwriter. Write ${genre} song lyrics about "${topic}" with a ${mood} mood.${styleRef}

Structure: ${sections.map(s => `[${s.toUpperCase()}]`).join(' -> ')}

Rules:
- Each section should be 4-8 lines
- Use genre-appropriate language, cadence, and syllable patterns for ${genre}
- The chorus should be catchy and memorable — the emotional peak
- The bridge should offer contrast (new perspective, key change feel, or stripped-back moment)
- Include natural rhythm and internal rhyme schemes
- Mark each section with [SECTION_NAME] headers
- Do NOT include any explanation — only output the lyrics

Write the lyrics now:`;
            const lyrics = await ollamaGenerate(prompt, { temperature: 0.85, maxTokens: 1500 });
            if (lyrics.startsWith('[Ollama')) {
                return `Error: ${lyrics}\n\nTo use generate_lyrics, ensure Ollama is running with kernel:latest:\n  ollama serve\n  ollama pull kernel:latest`;
            }
            return `# Generated Lyrics\n\n**Genre:** ${genre} | **Mood:** ${mood} | **Topic:** ${topic}\n**Structure:** ${sections.join(' -> ')}${styleRef ? `\n**Style ref:** ${args.style_reference}` : ''}\n\n---\n\n${lyrics}`;
        },
    });
    // ─── 2. Generate Melody Pattern ─────────────────────────────────────
    registerTool({
        name: 'generate_melody_pattern',
        description: '[Music Gen] Generate a MIDI melody pattern using music theory + local AI for creative decisions. Output is a JSON array of {note, midi, velocity, start_beat, duration} compatible with kbot\'s ableton_midi tool. Uses scale quantization and genre-appropriate rhythm.',
        parameters: {
            key: {
                type: 'string',
                description: 'Musical key (e.g., "Cm", "F#m", "Bb", "Em"). Append "m" for minor.',
                required: true,
            },
            scale: {
                type: 'string',
                description: `Scale type. Default: auto-detected from key. Options: ${Object.keys(SCALES).join(', ')}`,
            },
            bpm: {
                type: 'number',
                description: 'Tempo in BPM (20-300). Default: 120.',
            },
            genre: {
                type: 'string',
                description: `Genre for rhythm/feel selection. Options: ${Object.keys(GENRE_PROFILES).join(', ')}. Default: "pop".`,
            },
            bars: {
                type: 'number',
                description: 'Number of bars to generate (1-16). Default: 4.',
            },
            octave: {
                type: 'number',
                description: 'Starting octave (2-6). Default: 4 (middle C range).',
            },
            density: {
                type: 'string',
                description: 'Note density: "sparse" (whole/half notes), "moderate" (quarter/eighth), "dense" (sixteenth). Default: "moderate".',
            },
            creative_prompt: {
                type: 'string',
                description: 'Optional: describe the melody character for AI-assisted note choices (e.g., "ascending hopeful melody", "dark descending phrase"). If provided, Ollama shapes the melodic contour.',
            },
        },
        tier: 'free',
        timeout: 60_000,
        async execute(args) {
            const keyStr = String(args.key || 'Cm');
            const { root, scale: autoScale } = parseKeyString(keyStr);
            const scale = String(args.scale || autoScale);
            const bpm = clamp(Number(args.bpm) || 120, 20, 300);
            const genre = String(args.genre || 'pop');
            const bars = clamp(Number(args.bars) || 4, 1, 16);
            const octave = clamp(Number(args.octave) || 4, 2, 6);
            const density = (String(args.density || 'moderate'));
            const creativePrompt = args.creative_prompt ? String(args.creative_prompt) : null;
            if (!SCALES[scale]) {
                return `Error: Unknown scale "${scale}". Available: ${Object.keys(SCALES).join(', ')}`;
            }
            let melodyNotes;
            if (creativePrompt) {
                // Use Ollama to get a melodic contour suggestion, then realize it with music theory
                const scaleNotes = getScaleNotes(root, scale, octave);
                const aiPrompt = `You are a music theory expert. Given this request:
Genre: ${genre}, Key: ${root} ${scale}, BPM: ${bpm}
Creative direction: "${creativePrompt}"
Available notes: ${scaleNotes.names.join(', ')} (octave ${octave}) and ${scaleNotes.names.map(n => n.replace(/\d/, String(octave + 1))).join(', ')} (octave ${octave + 1})

Generate a ${bars}-bar melody as a JSON array. Each element: {"note": "C4", "velocity": 80, "start_beat": 0.0, "duration": 0.5}
- start_beat is absolute position (0 = bar 1 beat 1, 4 = bar 2 beat 1, etc.)
- Total beats: ${bars * 4}
- Use genre-appropriate rhythm for ${genre}
- velocity: 1-127 (louder on downbeats)
- Only use notes from the ${root} ${scale} scale
- ${density} density: ${density === 'sparse' ? '8-16 notes' : density === 'moderate' ? '16-32 notes' : '32-64 notes'} total

Output ONLY the JSON array, no explanation:`;
                const aiResult = await ollamaGenerateJSON(aiPrompt, { temperature: 0.7, maxTokens: 2048 });
                if (aiResult && Array.isArray(aiResult) && aiResult.length > 0) {
                    // Convert AI output to MidiNote, quantizing to scale for safety
                    melodyNotes = aiResult
                        .filter(n => n.note && typeof n.start_beat === 'number')
                        .map(n => {
                        let pitch;
                        try {
                            pitch = noteNameToMidi(n.note);
                        }
                        catch {
                            pitch = 60;
                        }
                        pitch = quantizeToScale(pitch, root, scale);
                        return {
                            pitch,
                            start: Math.max(0, n.start_beat),
                            duration: Math.max(0.0625, n.duration || 0.5),
                            velocity: clamp(n.velocity || 80, 1, 127),
                        };
                    });
                }
                else {
                    // Fallback to theory-based generation
                    melodyNotes = generateMelodyFromTheory({ key: root, scale, bpm, bars, octave, genre, density });
                }
            }
            else {
                melodyNotes = generateMelodyFromTheory({ key: root, scale, bpm, bars, octave, genre, density });
            }
            const formatted = formatMidiNotes(melodyNotes);
            const scaleInfo = getScaleNotes(root, scale, octave);
            return [
                `# Melody Pattern`,
                ``,
                `**Key:** ${root} ${scale} | **BPM:** ${bpm} | **Genre:** ${genre}`,
                `**Bars:** ${bars} | **Octave:** ${octave} | **Density:** ${density}`,
                `**Scale notes:** ${scaleInfo.names.join(', ')}`,
                `**Notes generated:** ${melodyNotes.length}`,
                creativePrompt ? `**Creative direction:** ${creativePrompt}` : '',
                ``,
                `## MIDI Data (compatible with ableton_midi)`,
                ``,
                '```json',
                formatted,
                '```',
                ``,
                `## Usage`,
                `Pipe this to ableton_midi to write directly to a clip in Ableton Live.`,
            ].filter(Boolean).join('\n');
        },
    });
    // ─── 3. Generate Drum Pattern ───────────────────────────────────────
    registerTool({
        name: 'generate_drum_pattern',
        description: `[Music Gen] Generate a genre-specific drum pattern as MIDI-compatible JSON. Includes genre defaults (trap: 808 kick, clap on 2&4, hi-hat rolls; house: four-on-floor, open hats on &; drill: sliding 808, syncopated kicks). Output is compatible with kbot's ableton_midi tool. Available genres: ${availableGenres().join(', ')}.`,
        parameters: {
            genre: {
                type: 'string',
                description: `Drum genre/style. Options: ${availableGenres().join(', ')}. Default: "trap".`,
                required: true,
            },
            bpm: {
                type: 'number',
                description: 'Tempo in BPM. Default: auto from genre.',
            },
            bars: {
                type: 'number',
                description: 'Number of bars to generate (1-16). Default: 4.',
            },
            feel: {
                type: 'string',
                description: 'Rhythmic feel: "straight" (default), "swing", "triplet".',
            },
            humanize: {
                type: 'string',
                description: 'Humanize timing and velocity: "true" or "false". Default: "true".',
            },
            density: {
                type: 'number',
                description: 'Pattern density 0.0 (minimal) to 1.0 (full). Default: 0.8. Lower values randomly omit hits for sparser grooves.',
            },
            variation: {
                type: 'string',
                description: 'If "true", add subtle variations each bar (fills, ghost notes, hat opens). Default: "true".',
            },
        },
        tier: 'free',
        timeout: 10_000,
        async execute(args) {
            const genre = String(args.genre || 'trap').toLowerCase();
            const pattern = GENRE_DRUM_PATTERNS[genre];
            const genreProfile = GENRE_PROFILES[genre];
            if (!pattern) {
                return `Error: Unknown genre "${genre}". Available genres: ${availableGenres().join(', ')}`;
            }
            const bpmRange = pattern.bpm;
            const bpm = clamp(Number(args.bpm) || randomInRange(bpmRange[0], bpmRange[1]), 20, 300);
            const bars = clamp(Number(args.bars) || 4, 1, 16);
            const feel = (String(args.feel || genreProfile?.feel || 'straight'));
            const humanize = String(args.humanize ?? 'true') !== 'false';
            const density = clamp(Number(args.density ?? 0.8), 0.0, 1.0);
            const variation = String(args.variation ?? 'true') !== 'false';
            let notes = generateDrumPattern({ genre, bpm, bars, feel, humanize, density });
            // Add variations if requested
            if (variation && bars > 1) {
                const additionalNotes = [];
                for (let bar = 1; bar < bars; bar++) {
                    const barStart = bar * 4;
                    // Occasional ghost snare
                    if (Math.random() < 0.3) {
                        const ghostPos = barStart + pick([0.75, 1.75, 2.75, 3.75]);
                        additionalNotes.push({
                            pitch: GM_DRUMS.snare,
                            start: ghostPos,
                            duration: 0.1,
                            velocity: randomInRange(25, 45), // very quiet ghost
                        });
                    }
                    // Fill on last bar before section change
                    if (bar === bars - 1 && Math.random() < 0.6) {
                        // Snare roll fill on beat 4
                        for (let i = 0; i < 4; i++) {
                            additionalNotes.push({
                                pitch: GM_DRUMS.snare,
                                start: barStart + 3 + (i * 0.25),
                                duration: 0.1,
                                velocity: randomInRange(70 + i * 10, 90 + i * 10),
                            });
                        }
                    }
                    // Occasional open hat replacing closed hat
                    if (Math.random() < 0.2) {
                        const openPos = barStart + pick([1.5, 3.5]);
                        additionalNotes.push({
                            pitch: GM_DRUMS.open_hihat,
                            start: openPos,
                            duration: 0.25,
                            velocity: randomInRange(70, 95),
                        });
                    }
                }
                notes = [...notes, ...additionalNotes].sort((a, b) => a.start - b.start);
            }
            // Map MIDI numbers to drum names for readable output
            const reverseDrumMap = new Map();
            for (const [name, midi] of Object.entries(GM_DRUMS)) {
                if (!reverseDrumMap.has(midi))
                    reverseDrumMap.set(midi, name);
            }
            const formatted = JSON.stringify(notes.map(n => ({
                drum: reverseDrumMap.get(n.pitch) || `midi_${n.pitch}`,
                midi: n.pitch,
                velocity: n.velocity,
                start_beat: Math.round(n.start * 1000) / 1000,
                duration: Math.round(n.duration * 1000) / 1000,
            })), null, 2);
            const patternDesc = Object.entries(pattern.pattern)
                .map(([inst, positions]) => `  ${inst}: hits on 16th positions [${positions.join(', ')}]`)
                .join('\n');
            return [
                `# Drum Pattern: ${genre}`,
                ``,
                `**BPM:** ${bpm} | **Bars:** ${bars} | **Feel:** ${feel}`,
                `**Humanize:** ${humanize} | **Density:** ${density} | **Variation:** ${variation}`,
                `**Total hits:** ${notes.length}`,
                ``,
                `## Base Pattern (per bar)`,
                patternDesc,
                ``,
                `## MIDI Data (compatible with ableton_midi)`,
                ``,
                '```json',
                formatted,
                '```',
                ``,
                genreProfile ? `## Genre Notes\n${genreProfile.description}` : '',
                ``,
                `## Usage`,
                `Pipe to ableton_midi to write to a drum rack clip in Ableton Live.`,
            ].filter(Boolean).join('\n');
        },
    });
    // ─── 4. Generate Song Structure ─────────────────────────────────────
    registerTool({
        name: 'generate_song_structure',
        description: '[Music Gen] Generate a complete song structure with section plan, bar counts, energy curve, and instrument suggestions based on genre conventions. Useful for planning a full production before writing any notes.',
        parameters: {
            genre: {
                type: 'string',
                description: `Genre for structure conventions. Options: ${Object.keys(GENRE_PROFILES).join(', ')}. Default: "trap".`,
                required: true,
            },
            bpm: {
                type: 'number',
                description: 'Tempo in BPM. Default: auto from genre.',
            },
            key: {
                type: 'string',
                description: 'Musical key (e.g., "Cm", "F#m", "Bb"). Default: auto from genre.',
            },
            progression: {
                type: 'string',
                description: 'Chord progression as Roman numerals (e.g., "I V vi IV") or named preset. If omitted, a genre-appropriate progression is chosen.',
            },
            target_minutes: {
                type: 'number',
                description: 'Target song length in minutes. Default: 3.5.',
            },
        },
        tier: 'free',
        timeout: 30_000,
        async execute(args) {
            const genre = String(args.genre || 'trap').toLowerCase();
            const profile = GENRE_PROFILES[genre];
            if (!profile) {
                return `Error: Unknown genre "${genre}". Available: ${Object.keys(GENRE_PROFILES).join(', ')}`;
            }
            const bpm = clamp(Number(args.bpm) || randomInRange(profile.bpmRange[0], profile.bpmRange[1]), 20, 300);
            const keyStr = String(args.key || pick(profile.preferredKeys));
            const { root, scale } = parseKeyString(keyStr);
            const targetMinutes = clamp(Number(args.target_minutes) || 3.5, 1, 10);
            // Calculate bars from target duration
            const barsPerMinute = bpm / 4; // 4 beats per bar in 4/4
            const targetBars = Math.round(targetMinutes * barsPerMinute);
            // Select chord progression
            let progressionStr;
            if (args.progression) {
                const namedProg = NAMED_PROGRESSIONS[String(args.progression).toLowerCase()];
                progressionStr = namedProg ? namedProg.numerals : String(args.progression);
            }
            else {
                progressionStr = pick(profile.progressions);
            }
            // Parse the progression to verify it works
            let chordNames;
            try {
                const parsedChords = parseProgression(progressionStr, root, scale);
                chordNames = parsedChords.map(chord => chord.map(n => midiToNoteName(n)).join('/'));
            }
            catch {
                chordNames = progressionStr.split(/\s+/);
            }
            // Get song structure
            const structure = getStructureForGenre(genre, bpm);
            // Scale to target bars
            const currentTotal = structure.totalBars;
            const scaleFactor = targetBars / currentTotal;
            const scaledSections = structure.sections.map(s => ({
                ...s,
                bars: Math.max(2, Math.round(s.bars * scaleFactor)),
            }));
            const actualBars = scaledSections.reduce((sum, s) => sum + s.bars, 0);
            const actualMinutes = Math.round((actualBars / barsPerMinute) * 10) / 10;
            // Get scale info
            const scaleInfo = getScaleNotes(root, scale);
            // Energy curve as ASCII art
            const maxWidth = 30;
            const energyCurve = scaledSections.map(s => {
                const barWidth = Math.max(1, Math.round(s.energy * maxWidth));
                const bar = '#'.repeat(barWidth) + '.'.repeat(maxWidth - barWidth);
                return `  ${s.name.padEnd(16)} |${bar}| ${Math.round(s.energy * 100)}%`;
            }).join('\n');
            // Suggested instruments
            const instrumentPalette = profile.instruments.join(', ');
            // Available progressions for this genre
            const suggestedProgs = profile.progressions.map((p, i) => `  ${i + 1}. ${p}`).join('\n');
            return [
                `# Song Structure: ${genre.toUpperCase()}`,
                ``,
                `**Key:** ${root} ${scale} | **BPM:** ${bpm} | **Duration:** ~${actualMinutes} min (${actualBars} bars)`,
                `**Chord Progression:** ${progressionStr}`,
                `**Chords (MIDI):** ${chordNames.join(' | ')}`,
                `**Scale:** ${scaleInfo.names.join(', ')}`,
                ``,
                `## Sections`,
                ``,
                scaledSections.map((s, i) => [
                    `### ${i + 1}. ${s.name} (${s.bars} bars)`,
                    `**Energy:** ${Math.round(s.energy * 100)}% | **Instruments:** ${s.instruments.join(', ')}`,
                    `${s.description}`,
                ].join('\n')).join('\n\n'),
                ``,
                `## Energy Curve`,
                ``,
                '```',
                energyCurve,
                '```',
                ``,
                `## Instrument Palette`,
                instrumentPalette,
                ``,
                `## Alternative Progressions for ${genre}`,
                suggestedProgs,
                ``,
                `## Production Notes`,
                profile.energyProfile,
                ``,
                `## Next Steps`,
                `1. \`generate_drum_pattern\` with genre="${genre}", bpm=${bpm}`,
                `2. \`generate_melody_pattern\` with key="${keyStr}", genre="${genre}", bpm=${bpm}`,
                `3. \`generate_lyrics\` with genre="${genre}" for vocal content`,
                `4. Pipe MIDI data to \`ableton_midi\` to build the session`,
            ].join('\n');
        },
    });
    // ─── 5. Music Idea ──────────────────────────────────────────────────
    registerTool({
        name: 'music_idea',
        description: '[Music Gen] Creative idea generator — describe a vibe, reference track, or mood and get a complete production blueprint: BPM, key, genre, chord progression, instrument palette, drum pattern style, and melody approach. Uses local Ollama for creative reasoning ($0 cost). Perfect starting point for any production.',
        parameters: {
            prompt: {
                type: 'string',
                description: 'Describe the vibe, mood, reference track, or feeling (e.g., "late night drive through Tokyo", "something like Playboi Carti but with jazz chords", "aggressive dark energy, 808 heavy")',
                required: true,
            },
        },
        tier: 'free',
        timeout: 120_000,
        async execute(args) {
            const userPrompt = String(args.prompt);
            const availableProgressions = Object.entries(NAMED_PROGRESSIONS)
                .slice(0, 20) // limit for prompt size
                .map(([id, p]) => `${id}: "${p.numerals}" (${p.name})`)
                .join('\n');
            const genreList = Object.entries(GENRE_PROFILES)
                .map(([id, p]) => `${id}: BPM ${p.bpmRange[0]}-${p.bpmRange[1]}, ${p.description}`)
                .join('\n');
            const aiPrompt = `You are a music producer and creative director. Given this creative brief, design a complete production blueprint.

Creative brief: "${userPrompt}"

Available genres:
${genreList}

Some named chord progressions:
${availableProgressions}

Respond in this EXACT JSON format (no markdown, no explanation):
{
  "genre": "one of: ${Object.keys(GENRE_PROFILES).join(', ')}",
  "bpm": 140,
  "key": "Cm",
  "scale": "natural_minor",
  "mood": "dark, aggressive, nocturnal",
  "chord_progression": "i bVI bVII i",
  "progression_name": "name if using a named one, or 'custom'",
  "instruments": ["808 bass", "dark pads", "bells", "hi-hats", "clap"],
  "drum_style": "description of drum approach",
  "melody_approach": "description of melodic strategy",
  "production_notes": "2-3 sentences on overall production direction",
  "reference_artists": ["Artist 1", "Artist 2"],
  "energy_arc": "description of the song's energy journey"
}

Be specific and creative. Match the user's vibe exactly.`;
            const aiResult = await ollamaGenerateJSON(aiPrompt, { temperature: 0.85, maxTokens: 1024 });
            // Build the blueprint — use AI result if available, fall back to smart defaults
            const genre = aiResult?.genre && GENRE_PROFILES[aiResult.genre] ? aiResult.genre : 'trap';
            const profile = GENRE_PROFILES[genre];
            const bpm = aiResult?.bpm ? clamp(aiResult.bpm, 20, 300) : randomInRange(profile.bpmRange[0], profile.bpmRange[1]);
            const keyStr = aiResult?.key || pick(profile.preferredKeys);
            const { root, scale: autoScale } = parseKeyString(keyStr);
            const scale = aiResult?.scale && SCALES[aiResult.scale] ? aiResult.scale : autoScale;
            const progression = aiResult?.chord_progression || pick(profile.progressions);
            const instruments = aiResult?.instruments || profile.instruments;
            const drumStyle = aiResult?.drum_style || profile.energyProfile;
            const melodyApproach = aiResult?.melody_approach || 'Genre-appropriate melody following scale intervals';
            const mood = aiResult?.mood || 'not specified';
            const productionNotes = aiResult?.production_notes || profile.description;
            const references = aiResult?.reference_artists || [];
            const energyArc = aiResult?.energy_arc || 'Standard verse-chorus energy dynamics';
            // Verify chord progression
            let chordNotes = [];
            try {
                const parsed = parseProgression(progression, root, scale);
                chordNotes = parsed.map(chord => chord.map(n => midiToNoteName(n)).join('/'));
            }
            catch {
                chordNotes = progression.split(/\s+/);
            }
            // Get scale info
            const scaleInfo = getScaleNotes(root, scale);
            // Get drum pattern info
            const drumPattern = GENRE_DRUM_PATTERNS[genre];
            const drumInfo = drumPattern
                ? Object.entries(drumPattern.pattern).map(([inst, pos]) => `  ${inst}: [${pos.join(', ')}]`).join('\n')
                : '  (custom pattern needed)';
            return [
                `# Music Idea Blueprint`,
                ``,
                `> "${userPrompt}"`,
                ``,
                `## Core Parameters`,
                `| Parameter | Value |`,
                `|---|---|`,
                `| **Genre** | ${genre} |`,
                `| **BPM** | ${bpm} |`,
                `| **Key** | ${root} ${scale} |`,
                `| **Mood** | ${mood} |`,
                `| **Scale** | ${scaleInfo.names.join(', ')} |`,
                ``,
                `## Chord Progression`,
                `**Roman numerals:** ${progression}`,
                `**Notes:** ${chordNotes.join(' | ')}`,
                aiResult?.progression_name ? `**Based on:** ${aiResult.progression_name}` : '',
                ``,
                `## Instrument Palette`,
                instruments.map(i => `- ${i}`).join('\n'),
                ``,
                `## Drum Pattern`,
                `**Style:** ${drumStyle}`,
                `**Base pattern (16th positions):**`,
                '```',
                drumInfo,
                '```',
                ``,
                `## Melody Approach`,
                melodyApproach,
                ``,
                `## Production Notes`,
                productionNotes,
                ``,
                `## Energy Arc`,
                energyArc,
                ``,
                references.length > 0 ? `## Reference Artists\n${references.map(r => `- ${r}`).join('\n')}\n` : '',
                `## Quick Start Commands`,
                ``,
                '```',
                `# 1. Generate drums`,
                `generate_drum_pattern genre="${genre}" bpm=${bpm}`,
                ``,
                `# 2. Generate melody`,
                `generate_melody_pattern key="${keyStr}" genre="${genre}" bpm=${bpm} density="moderate"`,
                ``,
                `# 3. Generate song structure`,
                `generate_song_structure genre="${genre}" bpm=${bpm} key="${keyStr}" progression="${progression}"`,
                ``,
                `# 4. Generate lyrics`,
                `generate_lyrics genre="${genre}" mood="${mood}" topic="${userPrompt}"`,
                '```',
            ].filter(Boolean).join('\n');
        },
    });
}
//# sourceMappingURL=music-gen.js.map