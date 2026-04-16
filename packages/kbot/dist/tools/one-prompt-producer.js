// kbot One-Prompt Producer — Natural language to complete musical arrangement
//
// The killer feature: one sentence -> full track.
// Input:  "dark trap beat, 140bpm, F minor, 808-heavy"
// Output: Complete arrangement with drums, bass, chords, melody, structure, synth suggestions.
//
// Uses music-theory.ts for all theory computations — zero AI needed for generation.
// Deterministic output: same genre + key + tempo = reproducible musical patterns.
import { registerTool } from './index.js';
import { GENRE_DRUM_PATTERNS, GM_DRUMS, getScaleNotes, midiToNoteName, parseProgression, quantizeToScale, voiceChord, } from './music-theory.js';
// ── Helpers ───────────────────────────────────────────────────────────────
function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
}
function randInt(lo, hi) {
    return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}
const GENRE_BLUEPRINTS = {
    trap: {
        tempoRange: [130, 170],
        defaultKey: 'F',
        defaultScale: 'natural_minor',
        progressions: ['i bVI bVII i', 'i bVII bVI V', 'i iv bVI bVII'],
        drumPattern: 'trap',
        bassStyle: 'slides',
        bassOctave: 1,
        melodyDensity: 'sparse',
        melodyOctave: 4,
        chordVoicing: 'spread',
        chordRhythm: 'pads',
        structure: [
            { name: 'Intro', bars: 4, instruments: ['drums'], energy: 0.3 },
            { name: 'Verse 1', bars: 8, instruments: ['drums', 'bass'], energy: 0.5 },
            { name: 'Hook', bars: 8, instruments: ['drums', 'bass', 'chords', 'melody'], energy: 0.9 },
            { name: 'Verse 2', bars: 8, instruments: ['drums', 'bass', 'melody'], energy: 0.6 },
            { name: 'Hook 2', bars: 8, instruments: ['drums', 'bass', 'chords', 'melody'], energy: 0.95 },
            { name: 'Bridge', bars: 4, instruments: ['chords', 'melody'], energy: 0.3 },
            { name: 'Final Hook', bars: 8, instruments: ['drums', 'bass', 'chords', 'melody'], energy: 1.0 },
            { name: 'Outro', bars: 4, instruments: ['chords'], energy: 0.15 },
        ],
        synthSuggestions: [
            { instrument: 'bass', description: 'heavy 808 sub bass with long decay and pitch glide', synth_type: '2027_sub', character: 'deep, booming, distorted low end' },
            { instrument: 'lead', description: 'dark bell melody with reverb and delay', synth_type: '2027_pluck', character: 'metallic, sparse, haunting' },
            { instrument: 'pad', description: 'dark atmospheric pad, low-passed, wide stereo', synth_type: '2027_pad', character: 'ominous, evolving, cinematic' },
            { instrument: 'drums', description: 'tight 808 kit: punchy kick, sharp snare, rapid hi-hats', synth_type: 'drum_machine', character: 'crisp, aggressive, modern' },
        ],
        titlePrefixes: ['Midnight', 'Shadow', 'Void', 'Neon', 'Phantom', 'Eclipse'],
    },
    house: {
        tempoRange: [120, 130],
        defaultKey: 'A',
        defaultScale: 'natural_minor',
        progressions: ['i bVII bVI bVII', 'i iv bVI V', 'i bVII iv bVII'],
        drumPattern: 'house',
        bassStyle: 'eighth',
        bassOctave: 2,
        melodyDensity: 'moderate',
        melodyOctave: 4,
        chordVoicing: 'open',
        chordRhythm: 'stabs',
        structure: [
            { name: 'Intro', bars: 8, instruments: ['drums'], energy: 0.3 },
            { name: 'Build', bars: 8, instruments: ['drums', 'bass'], energy: 0.5 },
            { name: 'Main A', bars: 16, instruments: ['drums', 'bass', 'chords', 'melody'], energy: 0.8 },
            { name: 'Breakdown', bars: 8, instruments: ['chords', 'melody'], energy: 0.3 },
            { name: 'Build 2', bars: 4, instruments: ['drums', 'bass'], energy: 0.6 },
            { name: 'Main B', bars: 16, instruments: ['drums', 'bass', 'chords', 'melody'], energy: 0.9 },
            { name: 'Outro', bars: 8, instruments: ['drums'], energy: 0.2 },
        ],
        synthSuggestions: [
            { instrument: 'bass', description: 'deep round sub bass with slight saturation', synth_type: '2027_sub', character: 'warm, round, punchy' },
            { instrument: 'lead', description: 'bright piano stab or vocal chop melody', synth_type: '2027_keys', character: 'rhythmic, soulful, uplifting' },
            { instrument: 'pad', description: 'warm filtered pad with slow LFO modulation', synth_type: '2027_pad', character: 'warm, deep, groovy' },
            { instrument: 'drums', description: 'classic house kit: punchy kick, crisp clap, shimmering hats', synth_type: 'drum_machine', character: 'tight, clean, danceable' },
        ],
        titlePrefixes: ['Groove', 'Deep', 'Velvet', 'Pulse', 'Echo', 'Dusk'],
    },
    lofi: {
        tempoRange: [70, 90],
        defaultKey: 'E',
        defaultScale: 'natural_minor',
        progressions: ['i iv bVI V', 'i bVII bVI bVII', 'i iv v i'],
        drumPattern: 'lofi',
        bassStyle: 'walking',
        bassOctave: 2,
        melodyDensity: 'sparse',
        melodyOctave: 4,
        chordVoicing: 'drop2',
        chordRhythm: 'half',
        structure: [
            { name: 'Intro', bars: 4, instruments: ['chords'], energy: 0.2 },
            { name: 'Verse', bars: 8, instruments: ['drums', 'bass', 'chords'], energy: 0.4 },
            { name: 'Hook', bars: 8, instruments: ['drums', 'bass', 'chords', 'melody'], energy: 0.6 },
            { name: 'Verse 2', bars: 8, instruments: ['drums', 'bass', 'chords'], energy: 0.45 },
            { name: 'Hook 2', bars: 8, instruments: ['drums', 'bass', 'chords', 'melody'], energy: 0.65 },
            { name: 'Outro', bars: 4, instruments: ['chords', 'melody'], energy: 0.15 },
        ],
        synthSuggestions: [
            { instrument: 'bass', description: 'mellow upright bass or muted electric bass', synth_type: '2027_bass', character: 'warm, woody, rounded' },
            { instrument: 'lead', description: 'Rhodes electric piano with chorus and vinyl crackle', synth_type: '2027_keys', character: 'nostalgic, warm, gentle' },
            { instrument: 'pad', description: 'tape-saturated pad with slow filter sweep', synth_type: '2027_pad', character: 'dusty, warm, intimate' },
            { instrument: 'drums', description: 'vinyl-sampled drums: soft kick, brushed snare, loose hats', synth_type: 'drum_machine', character: 'dusty, swung, lo-fi' },
        ],
        titlePrefixes: ['Rainy', 'Dusty', 'Moonlit', 'Faded', 'Sleepy', 'Golden'],
    },
    dnb: {
        tempoRange: [160, 180],
        defaultKey: 'A',
        defaultScale: 'natural_minor',
        progressions: ['i bVII bVI V', 'i bVI bIII bVII', 'i iv bVI bVII'],
        drumPattern: 'dnb',
        bassStyle: 'arp',
        bassOctave: 1,
        melodyDensity: 'moderate',
        melodyOctave: 4,
        chordVoicing: 'spread',
        chordRhythm: 'pads',
        structure: [
            { name: 'Intro', bars: 8, instruments: ['chords'], energy: 0.2 },
            { name: 'Build', bars: 8, instruments: ['drums', 'chords'], energy: 0.5 },
            { name: 'Drop', bars: 16, instruments: ['drums', 'bass', 'chords', 'melody'], energy: 0.95 },
            { name: 'Breakdown', bars: 8, instruments: ['chords', 'melody'], energy: 0.3 },
            { name: 'Drop 2', bars: 16, instruments: ['drums', 'bass', 'chords', 'melody'], energy: 1.0 },
            { name: 'Outro', bars: 8, instruments: ['drums'], energy: 0.2 },
        ],
        synthSuggestions: [
            { instrument: 'bass', description: 'reese bass: detuned saw waves with movement and grit', synth_type: '2027_bass', character: 'growling, wide, aggressive' },
            { instrument: 'lead', description: 'bright supersaw lead with reverb tail', synth_type: '2027_lead', character: 'soaring, emotional, energetic' },
            { instrument: 'pad', description: 'atmospheric pad with granular texture', synth_type: '2027_pad', character: 'ethereal, wide, evolving' },
            { instrument: 'drums', description: 'jungle break: tight snare, punchy kick, fast rides', synth_type: 'drum_machine', character: 'snappy, fast, syncopated' },
        ],
        titlePrefixes: ['Liquid', 'Fracture', 'Neural', 'Voltage', 'Horizon', 'Cascade'],
    },
    drill: {
        tempoRange: [140, 150],
        defaultKey: 'C',
        defaultScale: 'natural_minor',
        progressions: ['i bVI bVII i', 'i bII bVII i', 'i bVI V i'],
        drumPattern: 'drill',
        bassStyle: 'slides',
        bassOctave: 1,
        melodyDensity: 'sparse',
        melodyOctave: 4,
        chordVoicing: 'close',
        chordRhythm: 'stabs',
        structure: [
            { name: 'Intro', bars: 4, instruments: ['chords'], energy: 0.2 },
            { name: 'Verse 1', bars: 8, instruments: ['drums', 'bass'], energy: 0.5 },
            { name: 'Hook', bars: 8, instruments: ['drums', 'bass', 'chords', 'melody'], energy: 0.85 },
            { name: 'Verse 2', bars: 8, instruments: ['drums', 'bass', 'melody'], energy: 0.55 },
            { name: 'Hook 2', bars: 8, instruments: ['drums', 'bass', 'chords', 'melody'], energy: 0.9 },
            { name: 'Outro', bars: 4, instruments: ['chords'], energy: 0.1 },
        ],
        synthSuggestions: [
            { instrument: 'bass', description: 'sliding 808 with heavy distortion and pitch bend', synth_type: '2027_sub', character: 'menacing, sliding, deep' },
            { instrument: 'lead', description: 'dark piano melody with reverb', synth_type: '2027_keys', character: 'cinematic, eerie, minimal' },
            { instrument: 'pad', description: 'dark string ensemble, slow attack', synth_type: '2027_pad', character: 'ominous, orchestral, tense' },
            { instrument: 'drums', description: 'drill kit: bouncy kick, sharp clap, rapid hi-hats', synth_type: 'drum_machine', character: 'aggressive, bouncy, relentless' },
        ],
        titlePrefixes: ['Block', 'Concrete', 'Grime', 'Frost', 'Iron', 'Smoke'],
    },
    ambient: {
        tempoRange: [60, 90],
        defaultKey: 'C',
        defaultScale: 'major',
        progressions: ['I II', 'I IVmaj7', 'i bVII', 'i bVI'],
        drumPattern: 'ambient',
        bassStyle: 'sustained',
        bassOctave: 2,
        melodyDensity: 'sparse',
        melodyOctave: 5,
        chordVoicing: 'spread',
        chordRhythm: 'pads',
        structure: [
            { name: 'Opening', bars: 8, instruments: ['chords'], energy: 0.1 },
            { name: 'Evolution A', bars: 16, instruments: ['chords', 'bass'], energy: 0.3 },
            { name: 'Peak', bars: 16, instruments: ['chords', 'bass', 'melody', 'drums'], energy: 0.6 },
            { name: 'Dissolution', bars: 16, instruments: ['chords', 'melody'], energy: 0.3 },
            { name: 'Coda', bars: 8, instruments: ['chords'], energy: 0.05 },
        ],
        synthSuggestions: [
            { instrument: 'bass', description: 'sub drone with slow filter modulation', synth_type: '2027_drone', character: 'deep, still, immersive' },
            { instrument: 'lead', description: 'granular piano with long reverb and shimmer', synth_type: '2027_granular', character: 'ethereal, delicate, crystalline' },
            { instrument: 'pad', description: 'evolving wavetable pad with spectral morphing', synth_type: '2027_pad', character: 'vast, celestial, slowly shifting' },
            { instrument: 'drums', description: 'textural percussion: soft mallets, distant shakers, field recordings', synth_type: 'textural', character: 'organic, subtle, ambient' },
        ],
        titlePrefixes: ['Drift', 'Aurora', 'Stillness', 'Horizon', 'Ether', 'Vapor'],
    },
    industrial: {
        tempoRange: [130, 160],
        defaultKey: 'A',
        defaultScale: 'phrygian',
        progressions: ['i bII', 'i bII bVII i', 'i v bII i'],
        drumPattern: 'techno',
        bassStyle: 'pulse',
        bassOctave: 1,
        melodyDensity: 'sparse',
        melodyOctave: 3,
        chordVoicing: 'close',
        chordRhythm: 'stabs',
        structure: [
            { name: 'Intro', bars: 8, instruments: ['drums'], energy: 0.4 },
            { name: 'Build', bars: 8, instruments: ['drums', 'bass'], energy: 0.6 },
            { name: 'Assault', bars: 16, instruments: ['drums', 'bass', 'chords', 'melody'], energy: 0.95 },
            { name: 'Breakdown', bars: 8, instruments: ['chords'], energy: 0.3 },
            { name: 'Assault 2', bars: 16, instruments: ['drums', 'bass', 'chords', 'melody'], energy: 1.0 },
            { name: 'Outro', bars: 8, instruments: ['drums', 'bass'], energy: 0.4 },
        ],
        synthSuggestions: [
            { instrument: 'bass', description: 'heavily distorted square wave bass with bitcrushing', synth_type: '2027_distorted', character: 'brutal, crushing, abrasive' },
            { instrument: 'lead', description: 'metallic FM synthesis with ring modulation', synth_type: '2027_fm', character: 'harsh, atonal, mechanical' },
            { instrument: 'pad', description: 'noise-based texture with resonant filter sweeps', synth_type: '2027_noise', character: 'chaotic, aggressive, industrial' },
            { instrument: 'drums', description: 'distorted 909 kit: overdriven kick, noisy snare, metallic hats', synth_type: 'drum_machine', character: 'punishing, mechanical, relentless' },
        ],
        titlePrefixes: ['Rust', 'Machine', 'Collapse', 'Grind', 'Furnace', 'Wreck'],
    },
    techno: {
        tempoRange: [130, 145],
        defaultKey: 'A',
        defaultScale: 'natural_minor',
        progressions: ['i bVII', 'i iv', 'i bVI bVII i'],
        drumPattern: 'techno',
        bassStyle: 'pulse',
        bassOctave: 1,
        melodyDensity: 'sparse',
        melodyOctave: 3,
        chordVoicing: 'shell',
        chordRhythm: 'stabs',
        structure: [
            { name: 'Intro', bars: 8, instruments: ['drums'], energy: 0.3 },
            { name: 'Build', bars: 8, instruments: ['drums', 'bass'], energy: 0.5 },
            { name: 'Peak A', bars: 16, instruments: ['drums', 'bass', 'chords', 'melody'], energy: 0.85 },
            { name: 'Breakdown', bars: 8, instruments: ['chords'], energy: 0.25 },
            { name: 'Peak B', bars: 16, instruments: ['drums', 'bass', 'chords', 'melody'], energy: 0.95 },
            { name: 'Outro', bars: 8, instruments: ['drums'], energy: 0.2 },
        ],
        synthSuggestions: [
            { instrument: 'bass', description: 'acid 303-style resonant bass with filter envelope', synth_type: '2027_acid', character: 'squelchy, hypnotic, driving' },
            { instrument: 'lead', description: 'detuned saw stab with delay feedback', synth_type: '2027_stab', character: 'sharp, metallic, percussive' },
            { instrument: 'pad', description: 'dark evolving pad with slow phaser', synth_type: '2027_pad', character: 'hypnotic, dark, cavernous' },
            { instrument: 'drums', description: '909 kit: booming kick, sharp clap, crisp ride', synth_type: 'drum_machine', character: 'driving, tight, mechanical' },
        ],
        titlePrefixes: ['Reactor', 'Axis', 'Strobe', 'Cipher', 'Monolith', 'Signal'],
    },
    phonk: {
        tempoRange: [130, 145],
        defaultKey: 'D',
        defaultScale: 'natural_minor',
        progressions: ['i bVI bVII i', 'i bII i bVII', 'i iv i V'],
        drumPattern: 'phonk',
        bassStyle: 'slides',
        bassOctave: 1,
        melodyDensity: 'moderate',
        melodyOctave: 4,
        chordVoicing: 'close',
        chordRhythm: 'stabs',
        structure: [
            { name: 'Intro', bars: 4, instruments: ['melody'], energy: 0.2 },
            { name: 'Verse 1', bars: 8, instruments: ['drums', 'bass', 'melody'], energy: 0.6 },
            { name: 'Hook', bars: 8, instruments: ['drums', 'bass', 'chords', 'melody'], energy: 0.9 },
            { name: 'Verse 2', bars: 8, instruments: ['drums', 'bass', 'melody'], energy: 0.65 },
            { name: 'Hook 2', bars: 8, instruments: ['drums', 'bass', 'chords', 'melody'], energy: 0.95 },
            { name: 'Outro', bars: 4, instruments: ['melody'], energy: 0.15 },
        ],
        synthSuggestions: [
            { instrument: 'bass', description: 'distorted 808 with hard clipping and pitch slides', synth_type: '2027_sub', character: 'dark, gritty, Memphis' },
            { instrument: 'lead', description: 'chopped soul vocal sample or dark bell', synth_type: '2027_pluck', character: 'lo-fi, eerie, chopped' },
            { instrument: 'pad', description: 'vinyl-textured dark pad with wow and flutter', synth_type: '2027_pad', character: 'gritty, nostalgic, haunted' },
            { instrument: 'drums', description: 'Memphis kit: punchy kick, snappy snare, cowbell, rapid hats', synth_type: 'drum_machine', character: 'aggressive, lo-fi, cowbell-heavy' },
        ],
        titlePrefixes: ['Hellcat', 'Demon', 'Drift', 'Burnout', 'Reaper', 'Phantom'],
    },
};
// Alias mappings for common genre variants
const GENRE_ALIASES = {
    'lo-fi': 'lofi', 'lo fi': 'lofi', 'lofi hip hop': 'lofi', 'lofi hiphop': 'lofi',
    'drum and bass': 'dnb', 'drum & bass': 'dnb', 'jungle': 'dnb',
    'uk drill': 'drill', 'ny drill': 'drill',
    'deep house': 'house', 'tech house': 'house',
    'hip hop': 'trap', 'hiphop': 'trap', 'hip-hop': 'trap', 'rap': 'trap',
    'dark ambient': 'ambient', 'atmospheric': 'ambient', 'dreamy': 'ambient',
    'noise': 'industrial', 'ebm': 'industrial', 'dark techno': 'industrial',
    'detroit techno': 'techno', 'acid': 'techno', 'minimal techno': 'techno',
    'drift phonk': 'phonk', 'memphis': 'phonk',
};
// ── Prompt Parser ─────────────────────────────────────────────────────────
function parsePrompt(raw) {
    const input = raw.toLowerCase().trim();
    // Extract tempo
    let tempo = 0;
    const bpmMatch = input.match(/(\d{2,3})\s*bpm/);
    if (bpmMatch)
        tempo = parseInt(bpmMatch[1], 10);
    // Extract key
    let keyRoot = '';
    let keyScale = '';
    const keyMatch = input.match(/\b([a-g][#b]?)\s*(minor|major|min|maj|m(?:in)?)?\b/i);
    if (keyMatch) {
        const rawRoot = keyMatch[1];
        keyRoot = rawRoot.charAt(0).toUpperCase() + rawRoot.slice(1);
        const qualifier = (keyMatch[2] || '').toLowerCase();
        if (qualifier.startsWith('maj'))
            keyScale = 'major';
        else if (qualifier === 'm' || qualifier.startsWith('min'))
            keyScale = 'natural_minor';
    }
    // Detect genre
    let genre = '';
    const knownGenres = Object.keys(GENRE_BLUEPRINTS);
    // Check direct matches first
    for (const g of knownGenres) {
        if (input.includes(g)) {
            genre = g;
            break;
        }
    }
    // Check aliases
    if (!genre) {
        for (const [alias, target] of Object.entries(GENRE_ALIASES)) {
            if (input.includes(alias)) {
                genre = target;
                break;
            }
        }
    }
    if (!genre)
        genre = 'trap'; // default
    const bp = GENRE_BLUEPRINTS[genre];
    // Apply defaults from genre if not specified
    if (!tempo)
        tempo = Math.round((bp.tempoRange[0] + bp.tempoRange[1]) / 2);
    tempo = clamp(tempo, 40, 300);
    if (!keyRoot)
        keyRoot = bp.defaultKey;
    if (!keyScale)
        keyScale = bp.defaultScale;
    // Extract mood keywords (anything that isn't genre/bpm/key)
    const moodWords = ['dark', 'bright', 'aggressive', 'chill', 'dreamy', 'heavy', 'light',
        'warm', 'cold', 'distorted', 'clean', 'chaotic', 'minimal', 'lush', 'sparse',
        'energetic', 'melancholic', 'uplifting', 'gritty', 'smooth', 'ethereal',
        'punchy', 'soft', 'hard', 'deep', 'gentle', 'intense', 'hypnotic', 'bouncy'];
    const mood = moodWords.filter(w => input.includes(w));
    // Extract instrument hints
    const instrumentWords = ['808', 'piano', 'guitar', 'strings', 'synth', 'pad', 'bells',
        'rhodes', 'organ', 'pluck', 'lead', 'vocal', 'brass', 'flute', 'sax', 'violin'];
    const instrumentHints = instrumentWords.filter(w => input.includes(w));
    return { genre, tempo, key: `${keyRoot}${keyScale.includes('minor') ? 'm' : ''}`, scale: keyScale, root: keyRoot, mood, instrumentHints };
}
// ── Drum Pattern Generator ────────────────────────────────────────────────
function generateDrums(genre, _mood) {
    const patternKey = GENRE_BLUEPRINTS[genre]?.drumPattern || genre;
    const genrePattern = GENRE_DRUM_PATTERNS[patternKey] || GENRE_DRUM_PATTERNS.house;
    const hits = [];
    for (const [voice, steps] of Object.entries(genrePattern.pattern)) {
        const gmNote = GM_DRUMS[voice];
        if (gmNote === undefined)
            continue;
        for (const step of steps) {
            // Genre-appropriate velocity shaping
            let velocity;
            if (voice === 'kick' || voice === 'bass_drum') {
                velocity = randInt(100, 127);
            }
            else if (voice === 'snare' || voice === 'clap' || voice === 'handclap') {
                velocity = randInt(90, 120);
            }
            else if (voice === 'closed_hihat') {
                // Create velocity pattern for hi-hats (accented, ghost, normal)
                const isAccent = step % 4 === 0;
                const isGhost = step % 2 === 1;
                velocity = isAccent ? randInt(90, 110) : isGhost ? randInt(40, 65) : randInt(65, 85);
            }
            else if (voice === 'open_hihat') {
                velocity = randInt(75, 100);
            }
            else {
                velocity = randInt(60, 95);
            }
            hits.push({ step, voice, velocity: clamp(velocity, 1, 127) });
        }
    }
    return hits;
}
// ── Bass Generator ────────────────────────────────────────────────────────
function generateBass(chords, parsed, bp) {
    const notes = [];
    const { root, scale } = parsed;
    const octave = bp.bassOctave;
    for (const chord of chords) {
        // Root note of chord in bass octave
        const chordRoot = chord.midi[0];
        const bassRootPc = ((chordRoot % 12) + 12) % 12;
        const bassMidi = (octave + 1) * 12 + bassRootPc;
        switch (bp.bassStyle) {
            case 'sustained': {
                // Whole note sustained bass
                notes.push({
                    bar: chord.bar, beat: 0,
                    note: midiToNoteName(bassMidi), midi: bassMidi,
                    duration: chord.duration, velocity: randInt(85, 105),
                });
                break;
            }
            case 'eighth': {
                // Eighth note pulse (house bass)
                const beatsInChord = chord.duration;
                for (let beat = 0; beat < beatsInChord; beat += 0.5) {
                    const isDownbeat = beat % 1 === 0;
                    const vel = isDownbeat ? randInt(90, 110) : randInt(70, 90);
                    notes.push({
                        bar: chord.bar, beat,
                        note: midiToNoteName(bassMidi), midi: bassMidi,
                        duration: 0.4, velocity: vel,
                    });
                }
                break;
            }
            case 'walking': {
                // Walking bass: root, 3rd, 5th, approach note
                const scaleNotes = getScaleNotes(root, scale, octave);
                const rootIdx = scaleNotes.midi.findIndex(n => n % 12 === bassRootPc);
                const walkNotes = [0, 2, 4, 3].map(offset => {
                    const idx = clamp((rootIdx >= 0 ? rootIdx : 0) + offset, 0, scaleNotes.midi.length - 1);
                    return scaleNotes.midi[idx];
                });
                for (let i = 0; i < 4 && i < chord.duration; i++) {
                    const midi = walkNotes[i % walkNotes.length];
                    notes.push({
                        bar: chord.bar, beat: i,
                        note: midiToNoteName(midi), midi,
                        duration: 0.9, velocity: randInt(75, 100),
                    });
                }
                break;
            }
            case 'slides': {
                // 808-style: long notes on beats 1 and 3, pitch slides implied
                notes.push({
                    bar: chord.bar, beat: 0,
                    note: midiToNoteName(bassMidi), midi: bassMidi,
                    duration: 2.0, velocity: randInt(100, 127),
                });
                // Occasional second hit
                if (Math.random() > 0.4) {
                    const slideMidi = quantizeToScale(bassMidi + randInt(2, 5), root, scale);
                    notes.push({
                        bar: chord.bar, beat: 2.5,
                        note: midiToNoteName(slideMidi), midi: slideMidi,
                        duration: 1.0, velocity: randInt(85, 110),
                    });
                }
                break;
            }
            case 'arp': {
                // Arpeggiated bass (dnb style)
                const scaleNotes = getScaleNotes(root, scale, octave);
                const rootIdx = scaleNotes.midi.findIndex(n => n % 12 === bassRootPc);
                const arpNotes = [0, 2, 4, 2].map(offset => {
                    const idx = clamp((rootIdx >= 0 ? rootIdx : 0) + offset, 0, scaleNotes.midi.length - 1);
                    return scaleNotes.midi[idx];
                });
                for (let i = 0; i < 8 && i * 0.5 < chord.duration; i++) {
                    const midi = arpNotes[i % arpNotes.length];
                    notes.push({
                        bar: chord.bar, beat: i * 0.5,
                        note: midiToNoteName(midi), midi,
                        duration: 0.4, velocity: randInt(80, 110),
                    });
                }
                break;
            }
            case 'pulse': {
                // Steady pulse (techno/industrial)
                for (let beat = 0; beat < chord.duration; beat += 1) {
                    notes.push({
                        bar: chord.bar, beat,
                        note: midiToNoteName(bassMidi), midi: bassMidi,
                        duration: 0.8, velocity: randInt(90, 115),
                    });
                }
                break;
            }
            case 'sparse':
            default: {
                // Just the root on beat 1
                notes.push({
                    bar: chord.bar, beat: 0,
                    note: midiToNoteName(bassMidi), midi: bassMidi,
                    duration: 3.5, velocity: randInt(80, 100),
                });
                break;
            }
        }
    }
    return notes;
}
// ── Chord Generator ───────────────────────────────────────────────────────
function generateChords(parsed, bp, totalBars) {
    const { root, scale } = parsed;
    const progression = pick(bp.progressions);
    const chordMidi = parseProgression(progression, root, scale);
    const chordTokens = progression.trim().split(/\s+/);
    const events = [];
    // How many bars per chord
    const chordsPerCycle = chordMidi.length;
    const barsPerChord = Math.max(1, Math.round(4 / chordsPerCycle)); // default: 4-bar cycle
    let bar = 0;
    while (bar < totalBars) {
        for (let ci = 0; ci < chordsPerCycle && bar < totalBars; ci++) {
            const rawNotes = chordMidi[ci];
            const voicedNotes = voiceChord(rawNotes, bp.chordVoicing);
            let duration;
            switch (bp.chordRhythm) {
                case 'whole':
                    duration = 4;
                    break;
                case 'half':
                    duration = 2;
                    break;
                case 'stabs':
                    duration = 0.5;
                    break;
                case 'pads':
                    duration = barsPerChord * 4;
                    break;
                case 'arp':
                    duration = 4;
                    break;
                default: duration = 4;
            }
            events.push({
                bar,
                chord_name: chordTokens[ci],
                notes: voicedNotes.map(n => midiToNoteName(n)),
                midi: voicedNotes,
                duration: Math.min(duration, (totalBars - bar) * 4),
            });
            bar += barsPerChord;
        }
    }
    return events;
}
// ── Melody Generator ──────────────────────────────────────────────────────
function generateMelody(chords, parsed, bp, totalBars) {
    const { root, scale } = parsed;
    const octave = bp.melodyOctave;
    const scaleData = getScaleNotes(root, scale, octave);
    const scaleMidi = [...scaleData.midi, ...scaleData.midi.map(n => n + 12)];
    const notes = [];
    // Generate a 2-4 bar motif then repeat with variation
    const motifBars = parsed.genre === 'ambient' ? 4 : 2;
    const motif = [];
    // Build motif
    let prevIdx = Math.floor(scaleMidi.length / 3); // start in lower third
    const density = bp.melodyDensity;
    const notesPerBar = density === 'sparse' ? 2 : density === 'moderate' ? 4 : 8;
    const stepDuration = 4 / notesPerBar;
    for (let bar = 0; bar < motifBars; bar++) {
        for (let n = 0; n < notesPerBar; n++) {
            // Rest probability
            const restChance = density === 'sparse' ? 0.4 : density === 'moderate' ? 0.2 : 0.1;
            if (Math.random() < restChance)
                continue;
            // Step-wise motion with occasional leaps
            const step = Math.random() < 0.7
                ? (Math.random() < 0.5 ? 1 : -1)
                : (Math.random() < 0.5 ? randInt(2, 4) : randInt(-4, -2));
            prevIdx = clamp(prevIdx + step, 0, scaleMidi.length - 1);
            const isDownbeat = n === 0;
            let velocity = randInt(60, 90);
            if (isDownbeat)
                velocity = randInt(85, 110);
            velocity = clamp(velocity, 1, 127);
            motif.push({
                beatOffset: bar * 4 + n * stepDuration,
                scaleIdx: prevIdx,
                duration: stepDuration * (0.6 + Math.random() * 0.6),
                velocity,
            });
        }
    }
    // Repeat motif across total bars with slight variation
    const motifBeats = motifBars * 4;
    for (let bar = 0; bar < totalBars; bar += motifBars) {
        for (const m of motif) {
            const absoluteBar = bar + Math.floor(m.beatOffset / 4);
            if (absoluteBar >= totalBars)
                break;
            // Slight variation on repeats
            let idx = m.scaleIdx;
            if (bar > 0 && Math.random() < 0.25) {
                idx = clamp(idx + (Math.random() < 0.5 ? 1 : -1), 0, scaleMidi.length - 1);
            }
            const pitch = quantizeToScale(scaleMidi[idx], root, scale);
            const beatInBar = m.beatOffset % 4;
            notes.push({
                bar: absoluteBar,
                beat: Math.round(beatInBar * 1000) / 1000,
                note: midiToNoteName(pitch),
                midi: pitch,
                duration: Math.round(m.duration * 1000) / 1000,
                velocity: clamp(m.velocity + randInt(-5, 5), 1, 127),
            });
        }
    }
    return notes;
}
// ── Arrangement Builder ───────────────────────────────────────────────────
function buildArrangement(bp) {
    let bar = 0;
    return bp.structure.map(section => {
        const s = {
            section: section.name,
            start_bar: bar,
            end_bar: bar + section.bars,
            active_instruments: section.instruments,
            energy: section.energy,
        };
        bar += section.bars;
        return s;
    });
}
// ── Title Generator ───────────────────────────────────────────────────────
function generateTitle(parsed, bp) {
    const suffixes = ['Nights', 'Dreams', 'State', 'Wave', 'Zone', 'Mode',
        'District', 'Ritual', 'Code', 'Frequency', 'Protocol', 'Dimension'];
    const prefix = pick(bp.titlePrefixes);
    const suffix = pick(suffixes);
    return `${prefix} ${suffix}`;
}
// ── Main Producer ─────────────────────────────────────────────────────────
function produceTrack(prompt) {
    const parsed = parsePrompt(prompt);
    const bp = GENRE_BLUEPRINTS[parsed.genre];
    // Calculate total bars from arrangement
    const totalBars = bp.structure.reduce((sum, s) => sum + s.bars, 0);
    // Generate all elements
    const chords = generateChords(parsed, bp, totalBars);
    const drums = generateDrums(parsed.genre, parsed.mood);
    const bass = generateBass(chords, parsed, bp);
    const melody = generateMelody(chords, parsed, bp, totalBars);
    const arrangement = buildArrangement(bp);
    const title = generateTitle(parsed, bp);
    // Duration calculation
    const beatsPerMinute = parsed.tempo;
    const totalBeats = totalBars * 4;
    const durationSeconds = Math.round((totalBeats / beatsPerMinute) * 60);
    return {
        metadata: {
            title,
            genre: parsed.genre,
            tempo: parsed.tempo,
            key: parsed.key,
            scale: parsed.scale,
            time_signature: '4/4',
            total_bars: totalBars,
            duration_seconds: durationSeconds,
        },
        drums,
        bass,
        chords,
        melody,
        arrangement,
        synth_suggestions: bp.synthSuggestions,
    };
}
// ── Tool Registration ─────────────────────────────────────────────────────
export function registerOnePromptTools() {
    registerTool({
        name: 'produce_track',
        description: '[One-Prompt Producer] Generate a complete musical arrangement from a single natural language description. ' +
            'Input a prompt like "dark trap beat, 140bpm, F minor, 808-heavy" and get back a full track: ' +
            'drum pattern, bass line, chord progression, melody, arrangement map, and 2027 synth suggestions. ' +
            'Supports genres: trap, house, lofi, dnb, drill, ambient, industrial, techno, phonk. ' +
            'Output is structured JSON ready for MIDI export or Ableton Live integration.',
        parameters: {
            prompt: {
                type: 'string',
                description: 'Natural language description of the track. Include any of: genre, tempo (e.g. "140bpm"), ' +
                    'key (e.g. "F minor"), mood (e.g. "dark", "dreamy", "aggressive"), instrument preferences ' +
                    '(e.g. "808-heavy", "piano"). Examples: "dark trap beat, 140bpm, F minor", ' +
                    '"ambient lo-fi, 85bpm, gentle and dreamy", "aggressive industrial, 160bpm, distorted"',
                required: true,
            },
        },
        tier: 'free',
        timeout: 30_000,
        async execute(args) {
            const prompt = String(args.prompt || '');
            if (!prompt.trim()) {
                return JSON.stringify({ error: 'Please provide a track description. Example: "dark trap beat, 140bpm, F minor, 808-heavy"' });
            }
            try {
                const track = produceTrack(prompt);
                // Build a summary header for readability
                const summary = [
                    `## ${track.metadata.title}`,
                    `**Genre**: ${track.metadata.genre} | **Tempo**: ${track.metadata.tempo} BPM | **Key**: ${track.metadata.key} (${track.metadata.scale})`,
                    `**Duration**: ${Math.floor(track.metadata.duration_seconds / 60)}:${String(track.metadata.duration_seconds % 60).padStart(2, '0')} | **Bars**: ${track.metadata.total_bars}`,
                    '',
                    `**Arrangement**: ${track.arrangement.map(s => `${s.section} (${s.start_bar}-${s.end_bar})`).join(' -> ')}`,
                    '',
                    `**Drum pattern** (1 bar, 16th grid): ${track.drums.length} hits`,
                    `**Bass line**: ${track.bass.length} notes`,
                    `**Chord progression**: ${track.chords.slice(0, 8).map(c => c.chord_name).join(' | ')} (${track.chords.length} total events)`,
                    `**Melody**: ${track.melody.length} notes`,
                    '',
                    '**2027 Synth Suggestions**:',
                    ...track.synth_suggestions.map(s => `  - ${s.instrument}: ${s.description} (${s.character})`),
                ].join('\n');
                return JSON.stringify({ summary, track }, null, 2);
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                return JSON.stringify({ error: `Track generation failed: ${msg}` });
            }
        },
    });
}
//# sourceMappingURL=one-prompt-producer.js.map