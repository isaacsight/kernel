// kbot Producer Engine — One-shot beat production + auto-mix
//
// The unified Producer + Sound Engineer engine. Given a genre (trap, drill,
// lofi, house, rnb, phonk, pluggnb, ambient), this engine:
//
//   1. Resolves all creative decisions from genre presets + randomization
//   2. Creates tracks, loads instruments, writes drums/bass/melody/chords/pads
//   3. Auto-mixes: volumes, panning, sends to return tracks
//   4. Fires all clips and starts playback
//
// One prompt. One tool call. One complete, mixed, playing beat.
//
// Uses existing primitives:
//   - music-theory.ts: SCALES, CHORDS, parseProgression, voiceChord, etc.
//   - ableton-osc.ts: ensureAbleton(), AbletonOSC send/query
//   - index.ts: registerTool
import { registerTool } from './index.js';
import { ensureAbleton, formatAbletonError } from '../integrations/ableton-osc.js';
import { parseProgression, voiceChord, NAMED_PROGRESSIONS, GENRE_DRUM_PATTERNS, GM_DRUMS, getScaleNotes, quantizeToScale, } from './music-theory.js';
// ── Helpers ─────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function randomInRange(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
function extractArgs(args) {
    return args.map(a => {
        if (a.type === 'b')
            return '[blob]';
        return a.value;
    });
}
/**
 * Parse a key string like "Cm", "F#m", "Bb", "Em" into root name and scale.
 * Returns { root: "C", scale: "natural_minor" } or { root: "F#", scale: "natural_minor" }, etc.
 */
function parseKeyString(keyStr) {
    const match = keyStr.match(/^([A-Ga-g][#b]?)(m|min|minor)?$/i);
    if (!match)
        return { root: 'C', scale: 'natural_minor' };
    const root = match[1].charAt(0).toUpperCase() + match[1].slice(1);
    const isMinor = !!match[2];
    return { root, scale: isMinor ? 'natural_minor' : 'major' };
}
// ── Genre Presets ───────────────────────────────────────────────────────────
export const GENRE_PRESETS = {
    trap: {
        id: 'trap',
        name: 'Trap',
        bpmRange: [138, 148],
        preferredKeys: ['Cm', 'Em', 'Am', 'F#m', 'Dm'],
        preferredScales: ['natural_minor', 'phrygian', 'harmonic_minor'],
        timeSignature: [4, 4],
        feel: 'halftime',
        tracks: [
            {
                name: '808',
                role: 'bass',
                instrument: {
                    primary: 'Operator',
                    presetHint: 'Sine wave sub with pitch envelope. Algorithm 1, Op A sine, pitch env down 12st over 50ms for attack click.',
                    rolandCloud: 'TR-808 Bass Drum into Simpler, pitched',
                    rationale: 'Operator sine gives clean 808 sub. Pitch envelope gives the characteristic attack transient.',
                },
                midiContent: 'bass_line',
                color: 1,
            },
            {
                name: 'Kick',
                role: 'drums',
                instrument: {
                    primary: 'Drum Rack',
                    presetHint: 'Short punchy acoustic kick. High transient, fast decay. This provides the click/attack that the 808 lacks.',
                    rationale: 'Layered with 808 — this provides attack, 808 provides sustain.',
                },
                midiContent: 'drum_pattern',
                color: 3,
            },
            {
                name: 'Snare/Clap',
                role: 'drums',
                instrument: {
                    primary: 'Drum Rack',
                    presetHint: 'Layered snare + clap. C1 = snare, D1 = clap. Both trigger on beat 3 (half-time).',
                    rationale: 'Half-time snare is the anchor of trap rhythm.',
                },
                midiContent: 'drum_pattern',
                color: 4,
            },
            {
                name: 'Hi-Hats',
                role: 'perc',
                instrument: {
                    primary: 'Drum Rack',
                    presetHint: 'C1 = closed hat, D1 = open hat. 16th-note patterns with rolls on 32nds. Velocity variation 60-127.',
                    rolandCloud: 'TR-808 HiHat',
                    rationale: 'Trap hats are the genre signature — fast rolls, velocity ramps, open hat accents.',
                },
                midiContent: 'perc_pattern',
                color: 5,
            },
            {
                name: 'Melody',
                role: 'melody',
                instrument: {
                    primary: 'Wavetable',
                    presetHint: 'Dark bell/pluck. Short attack, medium decay, no sustain. Wavetable position swept slightly. Chorus for width.',
                    rolandCloud: 'JD-800 Digital Bell or JUPITER-8 Brass',
                    rationale: 'Trap melodies are sparse, dark, often bell-like or flute-like timbres.',
                },
                midiContent: 'melody',
                color: 7,
            },
            {
                name: 'Pad',
                role: 'pad',
                instrument: {
                    primary: 'Drift',
                    presetHint: 'Dark ambient pad. Slow attack (500ms+), long release. Low-pass filtered. Drift 40% for organic movement.',
                    rolandCloud: 'JUPITER-8 Pad',
                    rationale: 'Subtle background texture. Fills frequency space without competing with melody.',
                },
                midiContent: 'pad_chords',
                color: 9,
            },
        ],
        progressionStyle: {
            namedProgressions: ['house_vamp', 'phrygian_dark', 'epic_film', 'andalusian'],
            romanTemplates: ['i bVI bVII i', 'i bVII bVI V', 'i iv bVI bVII', 'i i bVI bVII'],
            voicing: 'spread',
            chordRhythm: 'whole',
            barsPerSection: 4,
            octave: 4,
        },
        drumStyle: {
            basePattern: 'trap',
            hihatVelocityCurve: 'crescendo_roll',
            ghostNotes: false,
            rollProbability: 0.3,
            swing: 0,
            layers: [
                { instrument: 'rim', positions: [3, 11], velocity: 60, probability: 0.5 },
            ],
        },
        mixTemplate: {
            volumes: { bass: 0.80, drums: 0.75, 'drums.snare': 0.78, perc: 0.55, melody: 0.60, pad: 0.35 },
            panning: { bass: 0, drums: 0, 'drums.snare': 0, perc: 0.05, melody: -0.10, pad: 0 },
            sends: [
                { fromRole: 'melody', toReturn: 0, level: 0.25 },
                { fromRole: 'melody', toReturn: 1, level: 0.15 },
                { fromRole: 'pad', toReturn: 0, level: 0.40 },
                { fromRole: 'drums.snare', toReturn: 0, level: 0.20 },
            ],
            returns: [
                { name: 'Reverb', device: 'Reverb', presetHint: 'Dark plate. Decay 2s. HP 200Hz on return. Predelay 20ms.' },
                { name: 'Delay', device: 'Delay', presetHint: '1/4 note ping-pong. Feedback 30%. LP 3kHz on feedback. Dry/Wet 100% (send only).' },
            ],
            masterChain: ['EQ Eight (HP 30Hz)', 'Glue Compressor (2:1, attack 10ms, auto release, -2dB GR)', 'Limiter (ceiling -0.3dB)'],
            targetLUFS: -14,
        },
        productionNotes: [
            '808 IS the bass — tune it to the key. Glide between notes for slides.',
            'Half-time feel: snare on beat 3 only (position 8 in 16th grid).',
            'Hi-hat rolls: velocity ramps from 60 to 120 over 4-6 32nd notes.',
            'Melody: sparse, 4-8 notes per bar max. Leave space.',
            'Sidechain the 808 from the kick layer for clarity.',
            'Dark reverb on the snare — long tail, HP filtered.',
        ],
    },
    drill: {
        id: 'drill',
        name: 'Drill',
        bpmRange: [138, 145],
        preferredKeys: ['Cm', 'Bbm', 'F#m', 'Gm'],
        preferredScales: ['natural_minor', 'harmonic_minor', 'phrygian'],
        timeSignature: [4, 4],
        feel: 'halftime',
        tracks: [
            {
                name: '808',
                role: 'bass',
                instrument: {
                    primary: 'Operator',
                    presetHint: 'Slide 808. Glide ON, glide time 80ms. Sine sub with saturation. Portamento for the signature drill slides.',
                    rationale: 'Drill 808s MUST slide. Glide/portamento is non-negotiable.',
                },
                midiContent: 'bass_line',
                color: 1,
            },
            {
                name: 'Drums',
                role: 'drums',
                instrument: {
                    primary: 'Drum Rack',
                    presetHint: 'UK drill kit: punchy kick, tight snare, rimshot on the ghost notes. Kick and snare in same rack for choke interaction.',
                    rationale: 'Drill drums are tight and punchy, displaced from the grid for that sliding feel.',
                },
                midiContent: 'drum_pattern',
                color: 3,
            },
            {
                name: 'Hi-Hats',
                role: 'perc',
                instrument: {
                    primary: 'Drum Rack',
                    presetHint: 'Fast closed hats with triplet rolls. Similar to trap but with more displaced rhythms.',
                    rationale: 'Drill hats borrow from trap but add more syncopation and triplet feel.',
                },
                midiContent: 'perc_pattern',
                color: 5,
            },
            {
                name: 'Melody',
                role: 'melody',
                instrument: {
                    primary: 'Wavetable',
                    presetHint: 'Dark piano or string stab. Minor key, haunting. Could also use Simpler with a piano sample.',
                    rolandCloud: 'JD-800 Dark Piano',
                    rationale: 'Drill melodies are dark, minor, often piano or orchestral.',
                },
                midiContent: 'melody',
                color: 7,
            },
            {
                name: 'Strings',
                role: 'pad',
                instrument: {
                    primary: 'Wavetable',
                    presetHint: 'Dark orchestral strings. Slow attack, sustained. Creates the cinematic drill atmosphere.',
                    rationale: 'Strings are signature drill texture — UK drill especially.',
                },
                midiContent: 'pad_chords',
                color: 9,
            },
        ],
        progressionStyle: {
            namedProgressions: ['andalusian', 'phrygian_dark', 'epic_film'],
            romanTemplates: ['i bVII bVI V', 'i bII bVII i', 'i iv v i'],
            voicing: 'drop2',
            chordRhythm: 'whole',
            barsPerSection: 4,
            octave: 3,
        },
        drumStyle: {
            basePattern: 'drill',
            hihatVelocityCurve: 'crescendo_roll',
            ghostNotes: true,
            rollProbability: 0.25,
            swing: 0,
            layers: [
                { instrument: 'rim', positions: [3, 7, 11, 15], velocity: 50, probability: 0.4 },
            ],
        },
        mixTemplate: {
            volumes: { bass: 0.82, drums: 0.75, perc: 0.50, melody: 0.58, pad: 0.30 },
            panning: { bass: 0, drums: 0, perc: 0.05, melody: 0, pad: 0 },
            sends: [
                { fromRole: 'melody', toReturn: 0, level: 0.20 },
                { fromRole: 'pad', toReturn: 0, level: 0.35 },
                { fromRole: 'drums', toReturn: 0, level: 0.10 },
            ],
            returns: [
                { name: 'Reverb', device: 'Hybrid Reverb', presetHint: 'Dark Hall algorithm. Decay 3s. HP 250Hz.' },
                { name: 'Delay', device: 'Echo', presetHint: 'Tape delay. 1/4 dotted. Noise + modulation for grit.' },
            ],
            masterChain: ['EQ Eight (HP 30Hz)', 'Glue Compressor (2:1, auto release)', 'Limiter (ceiling -0.3dB)'],
            targetLUFS: -14,
        },
        productionNotes: [
            'SLIDES ARE EVERYTHING. Use glide/portamento on the 808.',
            'Displaced snare: not on 2 and 4, but on the and-of-2 and and-of-4.',
            'Hi-hat triplet rolls are more prominent than trap.',
            'Dark, cinematic strings in the background.',
            'Bass note patterns: lots of octave jumps with slides between.',
        ],
    },
    lofi: {
        id: 'lofi',
        name: 'Lo-Fi Hip-Hop',
        bpmRange: [72, 86],
        preferredKeys: ['C', 'F', 'Bb', 'Eb', 'Ab'],
        preferredScales: ['major', 'dorian', 'mixolydian'],
        timeSignature: [4, 4],
        feel: 'swing',
        tracks: [
            {
                name: 'Drums',
                role: 'drums',
                instrument: {
                    primary: 'Drum Rack',
                    presetHint: 'Vintage/dusty samples. Bit-crushed slightly. SP-404 aesthetic. Boom-bap pattern with swing.',
                    rationale: 'Lo-fi drums should sound like they came off a cassette tape.',
                },
                midiContent: 'drum_pattern',
                color: 3,
            },
            {
                name: 'Bass',
                role: 'bass',
                instrument: {
                    primary: 'Analog',
                    presetHint: 'Warm, round sub bass. Low-pass filtered at 400Hz. Slight saturation for warmth.',
                    rationale: 'Analog gives the warmest sub. Keep it simple and deep.',
                },
                midiContent: 'bass_line',
                color: 1,
            },
            {
                name: 'Keys',
                role: 'harmony',
                instrument: {
                    primary: 'Electric',
                    presetHint: 'Rhodes tone. Magnetic pickup, mid position. Warm and slightly detuned. THE signature lo-fi instrument.',
                    rolandCloud: 'RD-88 Vintage Rhodes',
                    rationale: 'Electric piano is the soul of lo-fi. Jazzy extended chords.',
                },
                midiContent: 'chord_progression',
                color: 7,
            },
            {
                name: 'Guitar',
                role: 'melody',
                instrument: {
                    primary: 'Wavetable',
                    presetHint: 'Jazz guitar sample, chopped. Warp mode: Texture. Filtered, warm. Could be a Nujabes-style sample chop.',
                    rationale: 'Sampled guitar gives authenticity. Wavetable as fallback for pluck/guitar tone.',
                },
                midiContent: 'melody',
                color: 5,
            },
            {
                name: 'Vinyl',
                role: 'fx',
                instrument: {
                    primary: 'Simpler',
                    presetHint: 'Vinyl crackle loop. One-shot mode, looped. Very low volume — texture only.',
                    rationale: 'Vinyl noise is essential lo-fi texture.',
                },
                midiContent: 'none',
                color: 11,
            },
        ],
        progressionStyle: {
            namedProgressions: ['jazz_ii_v_i', 'neo_soul', 'jazz_turnaround', 'bossa_nova'],
            romanTemplates: ['Imaj7 vi7 ii7 V7', 'ii7 V7 Imaj7 IVmaj7', 'Imaj7 iii7 vi7 V7'],
            voicing: 'drop2',
            chordRhythm: 'half',
            barsPerSection: 4,
            octave: 4,
        },
        drumStyle: {
            basePattern: 'lofi',
            hihatVelocityCurve: 'accent_downbeat',
            ghostNotes: true,
            rollProbability: 0,
            swing: 65,
            layers: [
                { instrument: 'rim', positions: [3, 11], velocity: 50, probability: 0.6 },
                { instrument: 'shaker', positions: [0, 2, 4, 6, 8, 10, 12, 14], velocity: 35, probability: 0.4 },
            ],
        },
        mixTemplate: {
            volumes: { drums: 0.70, bass: 0.72, harmony: 0.65, melody: 0.55, fx: 0.15 },
            panning: { drums: 0, bass: 0, harmony: 0.05, melody: -0.15, fx: 0 },
            sends: [
                { fromRole: 'harmony', toReturn: 0, level: 0.25 },
                { fromRole: 'melody', toReturn: 0, level: 0.30 },
                { fromRole: 'melody', toReturn: 1, level: 0.15 },
                { fromRole: 'drums', toReturn: 0, level: 0.10 },
            ],
            returns: [
                { name: 'Reverb', device: 'Reverb', presetHint: 'Warm room. Decay 1.2s. High damp 3kHz. Low diffusion.' },
                { name: 'Delay', device: 'Echo', presetHint: 'Tape echo. 1/8 note. Noise 30%. Modulation for wobble. Ducking ON.' },
            ],
            masterChain: [
                'EQ Eight (LP 15kHz gentle roll-off for lo-fi character, HP 35Hz)',
                'Glue Compressor (2:1, slow attack, -2dB GR)',
                'Redux (bit depth 12, downsample slight for texture)',
                'Limiter (ceiling -0.5dB)',
            ],
            targetLUFS: -16,
        },
        productionNotes: [
            'Swing is MANDATORY. 60-70% swing on drums.',
            'Everything should sound slightly detuned and warm.',
            'Extended jazz chords: maj7, m7, 9ths, add9.',
            'Master chain: subtle bit reduction + LP filter for tape character.',
            'Vinyl crackle layer at very low volume for ambience.',
            'Keep it mellow — if anything sounds aggressive, filter it down.',
        ],
    },
    house: {
        id: 'house',
        name: 'House',
        bpmRange: [122, 128],
        preferredKeys: ['C', 'F', 'G', 'Am', 'Dm'],
        preferredScales: ['major', 'dorian', 'mixolydian'],
        timeSignature: [4, 4],
        feel: 'straight',
        tracks: [
            {
                name: 'Kick',
                role: 'drums',
                instrument: {
                    primary: 'Drum Rack',
                    presetHint: 'Punchy house kick. Four-on-the-floor. Transient shaping for punch.',
                    rolandCloud: 'TR-909 Kick',
                    rationale: '909-style kick is the foundation of house.',
                },
                midiContent: 'drum_pattern',
                color: 3,
            },
            {
                name: 'Hats/Perc',
                role: 'perc',
                instrument: {
                    primary: 'Drum Rack',
                    presetHint: 'Crisp closed hats on 8ths, open hats on offbeats. Shaker layer.',
                    rolandCloud: 'TR-909 HiHat',
                    rationale: 'Classic house hat pattern with offbeat opens.',
                },
                midiContent: 'perc_pattern',
                color: 5,
            },
            {
                name: 'Clap',
                role: 'drums',
                instrument: {
                    primary: 'Drum Rack',
                    presetHint: 'Tight clap on 2 and 4. Layered with subtle snare for body.',
                    rationale: 'Clap drives the backbeat in house.',
                },
                midiContent: 'drum_pattern',
                color: 4,
            },
            {
                name: 'Bass',
                role: 'bass',
                instrument: {
                    primary: 'Analog',
                    presetHint: 'Funky bass line. Saw wave, low-pass filtered with envelope. Groovy, syncopated.',
                    rolandCloud: 'SH-101 Bass',
                    rationale: 'SH-101 style mono bass is classic house.',
                },
                midiContent: 'bass_line',
                color: 1,
            },
            {
                name: 'Chords',
                role: 'harmony',
                instrument: {
                    primary: 'Electric',
                    presetHint: 'Stab chords. Rhodes or organ-like. Pumping from sidechain.',
                    rolandCloud: 'JUNO-106 Pad',
                    rationale: 'Warm chord stabs that pump with the kick.',
                },
                midiContent: 'chord_progression',
                color: 7,
            },
            {
                name: 'Pad',
                role: 'pad',
                instrument: {
                    primary: 'Wavetable',
                    presetHint: 'Lush filtered pad. Slow LFO on filter cutoff. Wide stereo. Background wash.',
                    rationale: 'Fills the frequency spectrum behind the chords.',
                },
                midiContent: 'pad_chords',
                color: 9,
            },
        ],
        progressionStyle: {
            namedProgressions: ['jazz_ii_v_i', 'house_vamp', 'dorian_vamp', 'neo_soul'],
            romanTemplates: ['i bVII bVI bVII', 'ii7 V7 Imaj7', 'vi IV I V'],
            voicing: 'open',
            chordRhythm: 'quarter',
            barsPerSection: 8,
            octave: 4,
        },
        drumStyle: {
            basePattern: 'house',
            hihatVelocityCurve: 'accent_downbeat',
            ghostNotes: false,
            rollProbability: 0,
            swing: 0,
            layers: [
                { instrument: 'tambourine', positions: [2, 6, 10, 14], velocity: 45, probability: 0.7 },
                { instrument: 'shaker', positions: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], velocity: 30, probability: 0.5 },
            ],
        },
        mixTemplate: {
            volumes: { drums: 0.78, 'drums.clap': 0.72, perc: 0.50, bass: 0.75, harmony: 0.55, pad: 0.35 },
            panning: { drums: 0, 'drums.clap': 0, perc: 0.10, bass: 0, harmony: 0, pad: 0 },
            sends: [
                { fromRole: 'harmony', toReturn: 0, level: 0.20 },
                { fromRole: 'pad', toReturn: 0, level: 0.35 },
                { fromRole: 'perc', toReturn: 0, level: 0.10 },
                { fromRole: 'harmony', toReturn: 1, level: 0.15 },
            ],
            returns: [
                { name: 'Reverb', device: 'Reverb', presetHint: 'Plate reverb. Decay 1.8s. HP 200Hz. Bright and clean.' },
                { name: 'Delay', device: 'Delay', presetHint: 'Ping-pong 1/8 note. Feedback 25%. LP 4kHz.' },
            ],
            masterChain: ['EQ Eight (HP 30Hz)', 'Glue Compressor (2:1, attack 10ms, auto release)', 'Limiter (ceiling -0.3dB)'],
            targetLUFS: -14,
        },
        productionNotes: [
            'Four-on-the-floor kick is sacred. Never skip a beat.',
            'Sidechain EVERYTHING (bass, chords, pad) from the kick.',
            'Bass should be syncopated and funky, not just root notes.',
            'Open hats on the offbeat give the groove.',
            'Filter sweeps for builds — automate LP frequency over 8-16 bars.',
        ],
    },
    rnb: {
        id: 'rnb',
        name: 'R&B',
        bpmRange: [68, 82],
        preferredKeys: ['Db', 'Ab', 'Eb', 'Bb', 'Gb'],
        preferredScales: ['major', 'dorian', 'mixolydian'],
        timeSignature: [4, 4],
        feel: 'straight',
        tracks: [
            {
                name: 'Drums',
                role: 'drums',
                instrument: {
                    primary: 'Drum Rack',
                    presetHint: 'Tight, crisp drums. Acoustic-leaning samples. Subtle and pocket-focused.',
                    rationale: 'R&B drums serve the groove — never overpower the vocal space.',
                },
                midiContent: 'drum_pattern',
                color: 3,
            },
            {
                name: '808',
                role: 'bass',
                instrument: {
                    primary: 'Operator',
                    presetHint: 'Deep sustained 808. Sine wave, long decay, subtle saturation for warmth.',
                    rationale: 'Modern R&B lives on 808 bass — sustained, warm, melodic.',
                },
                midiContent: 'bass_line',
                color: 1,
            },
            {
                name: 'Keys',
                role: 'harmony',
                instrument: {
                    primary: 'Electric',
                    presetHint: 'Neo-soul Rhodes. Warm, slightly overdriven. Magnetic pickup. Extended chords.',
                    rolandCloud: 'RD-88 Neo Soul',
                    uaAlternative: 'Neve channel on the Rhodes for warmth',
                    rationale: 'Rhodes is the defining R&B keyboard sound. Neo-soul voicings.',
                },
                midiContent: 'chord_progression',
                color: 7,
            },
            {
                name: 'Pad',
                role: 'pad',
                instrument: {
                    primary: 'Drift',
                    presetHint: 'Warm lush pad. Very subtle, background only. Fills gaps between chord changes.',
                    rationale: 'Drift warmth suits R&B perfectly. Keep it subliminal.',
                },
                midiContent: 'pad_chords',
                color: 9,
            },
            {
                name: 'Lead',
                role: 'melody',
                instrument: {
                    primary: 'Wavetable',
                    presetHint: 'Smooth synth lead or bell. Will be replaced by vocal in a real track. Placeholder melody.',
                    rationale: 'Topline melody that shows where the vocal would sit.',
                },
                midiContent: 'melody',
                color: 6,
            },
        ],
        progressionStyle: {
            namedProgressions: ['neo_soul', 'jazz_turnaround', 'soul_turnaround'],
            romanTemplates: ['Imaj7 iii7 vi7 ii7 V7', 'Imaj7 vi7 ii7 V7', 'IVmaj7 iii7 vi7 ii7'],
            voicing: 'drop2',
            chordRhythm: 'half',
            barsPerSection: 4,
            octave: 4,
        },
        drumStyle: {
            basePattern: 'hiphop',
            hihatVelocityCurve: 'accent_downbeat',
            ghostNotes: true,
            rollProbability: 0,
            swing: 40,
            layers: [
                { instrument: 'rim', positions: [3, 7, 11], velocity: 45, probability: 0.5 },
                { instrument: 'shaker', positions: [0, 2, 4, 6, 8, 10, 12, 14], velocity: 30, probability: 0.3 },
            ],
        },
        mixTemplate: {
            volumes: { drums: 0.65, bass: 0.75, harmony: 0.60, pad: 0.30, melody: 0.55 },
            panning: { drums: 0, bass: 0, harmony: 0.05, pad: 0, melody: 0 },
            sends: [
                { fromRole: 'harmony', toReturn: 0, level: 0.25 },
                { fromRole: 'pad', toReturn: 0, level: 0.30 },
                { fromRole: 'melody', toReturn: 0, level: 0.20 },
                { fromRole: 'melody', toReturn: 1, level: 0.15 },
            ],
            returns: [
                { name: 'Reverb', device: 'Reverb', presetHint: 'Smooth plate. Decay 2.5s. HP 150Hz. Predelay 25ms. Silky.' },
                { name: 'Delay', device: 'Delay', presetHint: '1/4 note stereo. Feedback 20%. LP 3kHz. Subtle.' },
            ],
            masterChain: ['EQ Eight (HP 30Hz, gentle presence boost at 3kHz)', 'Glue Compressor (2:1, smooth)', 'Limiter (ceiling -0.3dB)'],
            targetLUFS: -14,
        },
        productionNotes: [
            'Warm and smooth is the goal. Nothing harsh.',
            'Neo-soul chord voicings: 9ths, 11ths, add9, chromatic passing chords.',
            'Ghost notes on drums for pocket groove.',
            'Bass should be melodic — follow the chord tones, not just roots.',
            'Leave a LOT of space for vocals. The beat should breathe.',
        ],
    },
    phonk: {
        id: 'phonk',
        name: 'Phonk',
        bpmRange: [130, 145],
        preferredKeys: ['Cm', 'Fm', 'Gm', 'Bbm'],
        preferredScales: ['natural_minor', 'blues', 'phrygian'],
        timeSignature: [4, 4],
        feel: 'halftime',
        tracks: [
            {
                name: 'Kick',
                role: 'drums',
                instrument: {
                    primary: 'Drum Rack',
                    presetHint: 'Distorted kick. Heavy, saturated. Cowbell on top.',
                    rationale: 'Phonk kicks are aggressive and distorted.',
                },
                midiContent: 'drum_pattern',
                color: 1,
            },
            {
                name: 'Clap/Snare',
                role: 'drums',
                instrument: {
                    primary: 'Drum Rack',
                    presetHint: 'Layered clap + snare. Distorted, heavy reverb. Memphis-style.',
                    rationale: 'Drenched in reverb and distortion.',
                },
                midiContent: 'drum_pattern',
                color: 3,
            },
            {
                name: 'Cowbell',
                role: 'perc',
                instrument: {
                    primary: 'Drum Rack',
                    presetHint: 'TR-808 cowbell. THE phonk signature sound. Pitched down slightly.',
                    rolandCloud: 'TR-808 Cowbell',
                    rationale: 'Cowbell is the single most identifiable phonk element.',
                },
                midiContent: 'perc_pattern',
                color: 4,
            },
            {
                name: 'Bass',
                role: 'bass',
                instrument: {
                    primary: 'Operator',
                    presetHint: 'Distorted 808 bass. Saturator or Overdrive after Operator. Aggressive.',
                    rationale: 'Phonk bass is 808 with heavy distortion.',
                },
                midiContent: 'bass_line',
                color: 1,
            },
            {
                name: 'Sample',
                role: 'melody',
                instrument: {
                    primary: 'Wavetable',
                    presetHint: 'Chopped soul/Memphis rap vocal sample. Dark, filtered. If no sample available, use Wavetable with a dark bell/stab.',
                    rationale: 'Phonk is built on samples — chopped Memphis vocals and soul.',
                },
                midiContent: 'melody',
                color: 7,
            },
        ],
        progressionStyle: {
            namedProgressions: ['house_vamp', 'phrygian_dark', 'metal_power'],
            romanTemplates: ['i bVII bVI V', 'i i bVI bVII', 'i bII bVII i'],
            voicing: 'close',
            chordRhythm: 'whole',
            barsPerSection: 4,
            octave: 3,
        },
        drumStyle: {
            basePattern: 'trap',
            hihatVelocityCurve: 'flat',
            ghostNotes: false,
            rollProbability: 0.15,
            swing: 0,
            layers: [
                { instrument: 'cowbell', positions: [0, 4, 8, 12], velocity: 90, probability: 1.0 },
                { instrument: 'open_hihat', positions: [2, 6, 10, 14], velocity: 70, probability: 0.6 },
            ],
        },
        mixTemplate: {
            volumes: { drums: 0.78, 'drums.snare': 0.75, perc: 0.65, bass: 0.80, melody: 0.55 },
            panning: { drums: 0, 'drums.snare': 0, perc: 0, bass: 0, melody: 0 },
            sends: [
                { fromRole: 'drums.snare', toReturn: 0, level: 0.35 },
                { fromRole: 'melody', toReturn: 0, level: 0.25 },
            ],
            returns: [
                { name: 'Reverb', device: 'Reverb', presetHint: 'HUGE reverb. Decay 4s+. The reverb IS the sound for phonk. Dark.' },
                { name: 'Delay', device: 'Echo', presetHint: 'Tape delay. Distorted feedback. Lo-fi character.' },
            ],
            masterChain: ['EQ Eight (HP 30Hz)', 'Saturator (for overall grit)', 'Glue Compressor (4:1, aggressive)', 'Limiter (ceiling -0.3dB)'],
            targetLUFS: -12,
        },
        productionNotes: [
            'COWBELL. If it does not have a cowbell it is not phonk.',
            'Everything distorted — bass, drums, even the master.',
            'Reverb on the clap/snare: 3-5 seconds, dark, wet.',
            'Based on Memphis rap: chopped vocal samples, dark atmosphere.',
            'Bass should be aggressive — saturated, clipping is OK.',
        ],
    },
    pluggnb: {
        id: 'pluggnb',
        name: 'Pluggnb (Plugg + R&B)',
        bpmRange: [145, 160],
        preferredKeys: ['C', 'F', 'Bb', 'Eb', 'Ab'],
        preferredScales: ['major', 'lydian', 'mixolydian'],
        timeSignature: [4, 4],
        feel: 'halftime',
        tracks: [
            {
                name: 'Drums',
                role: 'drums',
                instrument: {
                    primary: 'Drum Rack',
                    presetHint: 'Soft, pillowy drums. NOT aggressive. Gentle kick, soft snare/clap. Half-time.',
                    rationale: 'Pluggnb drums are ethereal and soft — opposite of trap aggression.',
                },
                midiContent: 'drum_pattern',
                color: 3,
            },
            {
                name: 'Bass',
                role: 'bass',
                instrument: {
                    primary: 'Operator',
                    presetHint: '808 but clean and warm. No distortion. Rounded, melodic. Follows the melody.',
                    rationale: 'Pluggnb bass is clean and melodic — more R&B than trap.',
                },
                midiContent: 'bass_line',
                color: 1,
            },
            {
                name: 'Melody',
                role: 'melody',
                instrument: {
                    primary: 'Wavetable',
                    presetHint: 'Dreamy bells or pluck. Bright, airy, ethereal. Chorus + reverb for sparkle. MAJOR key.',
                    rationale: 'Pluggnb melodies are bright, dreamy, positive — think Summrs/Autumn.',
                },
                midiContent: 'melody',
                color: 6,
            },
            {
                name: 'Pad',
                role: 'pad',
                instrument: {
                    primary: 'Drift',
                    presetHint: 'Airy, bright pad. Slow attack, long release. Dreamy, ethereal.',
                    rationale: 'Background atmosphere — keeps the dreamy vibe.',
                },
                midiContent: 'pad_chords',
                color: 9,
            },
            {
                name: 'Hi-Hats',
                role: 'perc',
                instrument: {
                    primary: 'Drum Rack',
                    presetHint: 'Soft hi-hats. Less aggressive than trap. Some rolls but gentler.',
                    rationale: 'Hats should be present but not dominating.',
                },
                midiContent: 'perc_pattern',
                color: 5,
            },
        ],
        progressionStyle: {
            namedProgressions: ['axis', 'jpop_classic', 'royal_road', 'lydian_float'],
            romanTemplates: ['I V vi IV', 'IV V iii vi', 'I V vi iii IV I IV V'],
            voicing: 'spread',
            chordRhythm: 'whole',
            barsPerSection: 4,
            octave: 5,
        },
        drumStyle: {
            basePattern: 'trap',
            hihatVelocityCurve: 'accent_downbeat',
            ghostNotes: false,
            rollProbability: 0.2,
            swing: 0,
            layers: [],
        },
        mixTemplate: {
            volumes: { drums: 0.60, bass: 0.72, melody: 0.65, pad: 0.35, perc: 0.45 },
            panning: { drums: 0, bass: 0, melody: 0, pad: 0, perc: 0.05 },
            sends: [
                { fromRole: 'melody', toReturn: 0, level: 0.40 },
                { fromRole: 'pad', toReturn: 0, level: 0.45 },
                { fromRole: 'melody', toReturn: 1, level: 0.20 },
            ],
            returns: [
                { name: 'Reverb', device: 'Hybrid Reverb', presetHint: 'Shimmer algorithm. Decay 4s. Bright, ethereal. Defines the genre.' },
                { name: 'Delay', device: 'Delay', presetHint: 'Ping-pong 1/8 dotted. Feedback 35%. HP 300Hz. Dreamy.' },
            ],
            masterChain: ['EQ Eight (HP 30Hz, gentle air boost 12kHz)', 'Glue Compressor (2:1, gentle)', 'Limiter (ceiling -0.3dB)'],
            targetLUFS: -14,
        },
        productionNotes: [
            'MAJOR KEYS. Pluggnb is bright, dreamy, ethereal — not dark.',
            'Drums should be SOFT. Opposite of trap energy.',
            'Melody is the star. Should be high-register, bell-like, reverbed heavily.',
            'Shimmer reverb is essential — it defines the pluggnb sound.',
            'Bass is clean and melodic. No distortion.',
            'Think: Summrs, Autumn, SeptembersRich.',
        ],
    },
    ambient: {
        id: 'ambient',
        name: 'Ambient',
        bpmRange: [60, 85],
        preferredKeys: ['C', 'Am', 'Em', 'D', 'F'],
        preferredScales: ['major', 'lydian', 'mixolydian', 'pentatonic_major'],
        timeSignature: [4, 4],
        feel: 'straight',
        tracks: [
            {
                name: 'Pad 1',
                role: 'pad',
                instrument: {
                    primary: 'Wavetable',
                    presetHint: 'Evolving pad. Very slow attack (2s+). Wavetable position modulated by LFO. Wide, immersive.',
                    rationale: 'Primary texture layer. Should feel like it is always there.',
                },
                midiContent: 'pad_chords',
                color: 9,
            },
            {
                name: 'Pad 2',
                role: 'pad',
                instrument: {
                    primary: 'Wavetable',
                    presetHint: 'Granular texture from field recording or tonal sample. Freeze + slow scan. Ethereal.',
                    rationale: 'Second texture layer. Granular gives organic, evolving quality.',
                },
                midiContent: 'pad_chords',
                color: 10,
            },
            {
                name: 'Melody',
                role: 'melody',
                instrument: {
                    primary: 'Wavetable',
                    presetHint: 'Soft mallet on beam resonator. Like a distant marimba or singing bowl. Sparse notes.',
                    rationale: 'Physical modeling gives organic resonance. Sparse melody creates focal points.',
                },
                midiContent: 'melody',
                color: 7,
            },
            {
                name: 'Texture',
                role: 'fx',
                instrument: {
                    primary: 'Simpler',
                    presetHint: 'Field recording loop — rain, ocean, forest. Very low volume. Environmental context.',
                    rationale: 'Grounds the ambient piece in a physical space.',
                },
                midiContent: 'none',
                color: 11,
            },
            {
                name: 'Sub',
                role: 'bass',
                instrument: {
                    primary: 'Analog',
                    presetHint: 'Deep sub drone. Sine wave. Barely audible. Provides physical weight.',
                    rationale: 'Subsonic foundation that you feel more than hear.',
                },
                midiContent: 'bass_line',
                color: 1,
            },
        ],
        progressionStyle: {
            namedProgressions: ['lydian_float', 'dorian_vamp', 'modal_interchange'],
            romanTemplates: ['I II', 'I bVII', 'I IV', 'Imaj7'],
            voicing: 'spread',
            chordRhythm: 'whole',
            barsPerSection: 8,
            octave: 4,
        },
        drumStyle: {
            basePattern: 'ambient',
            hihatVelocityCurve: 'flat',
            ghostNotes: false,
            rollProbability: 0,
            swing: 0,
            layers: [],
        },
        mixTemplate: {
            volumes: { pad: 0.55, 'pad.2': 0.40, melody: 0.45, fx: 0.20, bass: 0.50 },
            panning: { pad: 0, 'pad.2': 0, melody: 0, fx: 0, bass: 0 },
            sends: [
                { fromRole: 'melody', toReturn: 0, level: 0.60 },
                { fromRole: 'pad', toReturn: 0, level: 0.40 },
                { fromRole: 'melody', toReturn: 1, level: 0.30 },
            ],
            returns: [
                { name: 'Reverb', device: 'Hybrid Reverb', presetHint: 'Shimmer algorithm. Decay 8s+. Huge, infinite. This IS the sound.' },
                { name: 'Grain Delay', device: 'Spectral Time', presetHint: 'Spectral freeze + delay. For otherworldly textures.' },
            ],
            masterChain: ['EQ Eight (HP 25Hz, gentle overall shaping)', 'Limiter (ceiling -0.5dB, very gentle)'],
            targetLUFS: -20,
        },
        productionNotes: [
            'Less is always more. One note can fill an entire bar.',
            'Reverb tails ARE the music. Let everything sustain and decay.',
            'No drums required — or minimal: one kick per bar, distant ride.',
            'Automate EVERYTHING slowly — filter sweeps over 32 bars.',
            'Think: Brian Eno, Stars of the Lid, Tim Hecker.',
            'The piece should feel like it has no beginning or end.',
        ],
    },
};
// ── Preset Resolution ───────────────────────────────────────────────────────
function resolvePreset(genre, overrides) {
    const preset = GENRE_PRESETS[genre] || GENRE_PRESETS.trap;
    const genreId = GENRE_PRESETS[genre] ? genre : 'trap';
    // Resolve key
    let root;
    let scale;
    if (overrides?.key) {
        const parsed = parseKeyString(overrides.key);
        root = parsed.root;
        scale = parsed.scale;
    }
    else {
        const keyStr = pick(preset.preferredKeys);
        const parsed = parseKeyString(keyStr);
        root = parsed.root;
        // Use a preferred scale from the preset if the key doesn't dictate minor
        scale = parsed.scale === 'natural_minor'
            ? pick(preset.preferredScales.filter(s => s.includes('minor') || s === 'phrygian' || s === 'blues') || ['natural_minor'])
            : pick(preset.preferredScales.filter(s => !s.includes('minor')) || ['major']);
        if (!scale)
            scale = pick(preset.preferredScales);
    }
    // Resolve BPM
    const bpm = overrides?.bpm || randomInRange(preset.bpmRange[0], preset.bpmRange[1]);
    // Resolve bars
    const bars = overrides?.bars || preset.progressionStyle.barsPerSection;
    // Resolve chord progression
    let progressionNumerals;
    if (overrides?.progression) {
        // Check if it's a named progression
        const named = NAMED_PROGRESSIONS[overrides.progression.toLowerCase().replace(/[\s-]/g, '_')];
        progressionNumerals = named ? named.numerals : overrides.progression;
    }
    else {
        // Random: 50% named, 50% roman template
        if (Math.random() > 0.5 && preset.progressionStyle.namedProgressions.length > 0) {
            const progName = pick(preset.progressionStyle.namedProgressions);
            const named = NAMED_PROGRESSIONS[progName];
            progressionNumerals = named ? named.numerals : pick(preset.progressionStyle.romanTemplates);
        }
        else {
            progressionNumerals = pick(preset.progressionStyle.romanTemplates);
        }
    }
    // Parse the progression into MIDI note arrays
    let resolvedChords;
    try {
        resolvedChords = parseProgression(progressionNumerals, root, scale, preset.progressionStyle.octave);
        // Apply voicing
        resolvedChords = resolvedChords.map(notes => voiceChord(notes, preset.progressionStyle.voicing));
    }
    catch {
        // Fallback: simple i bVI bVII i
        resolvedChords = parseProgression('i bVI bVII i', root, 'natural_minor', preset.progressionStyle.octave);
        progressionNumerals = 'i bVI bVII i';
    }
    // Determine melody octave based on genre
    const melodyOctave = genreId === 'pluggnb' ? 6
        : genreId === 'ambient' ? 5
            : genreId === 'lofi' ? 4
                : 5;
    return {
        ...preset,
        id: genreId,
        key: root + (scale.includes('minor') || scale === 'phrygian' || scale === 'blues' ? 'm' : ''),
        root,
        scale,
        bpm,
        bars,
        resolvedChords,
        progressionNumerals,
        melodyOctave,
    };
}
// ── Velocity Curves ─────────────────────────────────────────────────────────
function applyVelocityCurve(baseVelocity, sixteenthPosition, instrument, curve) {
    switch (curve) {
        case 'flat':
            return baseVelocity;
        case 'accent_downbeat':
            if (sixteenthPosition % 4 === 0)
                return Math.min(127, baseVelocity + 20);
            if (sixteenthPosition % 2 === 0)
                return baseVelocity;
            return Math.max(40, baseVelocity - 15);
        case 'crescendo_roll':
            if (instrument.includes('hihat') || instrument.includes('hat')) {
                const posInBeat = sixteenthPosition % 4;
                return Math.min(127, 60 + posInBeat * 20);
            }
            return baseVelocity;
        case 'random_humanize':
            return Math.max(40, Math.min(127, baseVelocity + Math.floor(Math.random() * 30 - 15)));
    }
}
// ── Melody Density ──────────────────────────────────────────────────────────
function getMelodyDensity(genre) {
    switch (genre) {
        case 'trap':
        case 'drill':
            return { notesPerBar: 6, restProbability: 0.3, maxInterval: 5 };
        case 'house':
            return { notesPerBar: 8, restProbability: 0.15, maxInterval: 7 };
        case 'lofi':
            return { notesPerBar: 5, restProbability: 0.35, maxInterval: 4 };
        case 'rnb':
            return { notesPerBar: 6, restProbability: 0.25, maxInterval: 5 };
        case 'phonk':
            return { notesPerBar: 4, restProbability: 0.4, maxInterval: 3 };
        case 'pluggnb':
            return { notesPerBar: 8, restProbability: 0.15, maxInterval: 7 };
        case 'ambient':
            return { notesPerBar: 2, restProbability: 0.6, maxInterval: 7 };
        default:
            return { notesPerBar: 6, restProbability: 0.2, maxInterval: 5 };
    }
}
// ── Melody Duration Picker ──────────────────────────────────────────────────
function pickMelodyDuration(genre, currentBeat) {
    switch (genre) {
        case 'trap':
        case 'drill':
            // Sparse: mostly half and quarter notes
            return pick([0.5, 0.5, 1, 1, 2]);
        case 'house':
            // Active: eighths and quarters
            return pick([0.25, 0.5, 0.5, 1]);
        case 'lofi':
            // Relaxed: quarters and halves with jazz feel
            return pick([0.5, 1, 1, 1.5, 2]);
        case 'rnb':
            // Smooth: mixed durations, longer notes
            return pick([0.5, 1, 1, 1.5, 2]);
        case 'phonk':
            // Very sparse: long notes
            return pick([1, 1, 2, 2, 4]);
        case 'pluggnb':
            // Bright and active: eighths and quarters
            return pick([0.25, 0.5, 0.5, 1]);
        case 'ambient':
            // Extremely long, sustained
            return pick([2, 4, 4, 8]);
        default:
            return pick([0.5, 1, 1, 2]);
    }
}
// ── Melody Note Generator ───────────────────────────────────────────────────
function generateNextMelodyNote(prevPitch, scaleMidi, maxInterval) {
    // Build all scale notes within range across octaves
    const allScaleNotes = [];
    for (let octaveOffset = -12; octaveOffset <= 12; octaveOffset += 12) {
        for (const n of scaleMidi) {
            allScaleNotes.push(n + octaveOffset);
        }
    }
    const candidates = allScaleNotes.filter(n => Math.abs(n - prevPitch) <= maxInterval &&
        Math.abs(n - prevPitch) > 0);
    if (candidates.length === 0)
        return prevPitch;
    // Prefer stepwise motion (80%) over leaps (20%)
    const stepwise = candidates.filter(n => Math.abs(n - prevPitch) <= 2);
    if (stepwise.length > 0 && Math.random() < 0.8) {
        return pick(stepwise);
    }
    return pick(candidates);
}
// ── Bass Line Generator ─────────────────────────────────────────────────────
function generateBassLine(preset) {
    const chords = preset.resolvedChords;
    const barsPerChord = preset.bars / chords.length;
    const beatsPerChord = barsPerChord * 4;
    const notes = [];
    for (let i = 0; i < chords.length; i++) {
        const chordRoot = chords[i][0];
        const chordStart = i * beatsPerChord;
        // Bass octave: one octave below chord root
        const bassRoot = chordRoot - 12;
        switch (preset.id) {
            case 'trap':
            case 'pluggnb': {
                // 808 style: long sustained notes with occasional rhythmic hits
                notes.push({
                    pitch: bassRoot,
                    start: chordStart,
                    duration: beatsPerChord * 0.9,
                    velocity: 110,
                });
                // Occasional octave hit for energy
                if (Math.random() > 0.5) {
                    notes.push({
                        pitch: bassRoot + 12,
                        start: chordStart + beatsPerChord * 0.75,
                        duration: 0.5,
                        velocity: 90,
                    });
                }
                break;
            }
            case 'drill': {
                // Slide 808: octave jumps with overlapping notes for glide effect
                notes.push({
                    pitch: bassRoot,
                    start: chordStart,
                    duration: beatsPerChord * 0.5,
                    velocity: 110,
                });
                // Octave jump
                notes.push({
                    pitch: bassRoot + 12,
                    start: chordStart + beatsPerChord * 0.5,
                    duration: beatsPerChord * 0.3,
                    velocity: 100,
                });
                // Slide back down (overlapping for portamento trigger)
                if (Math.random() > 0.4) {
                    const fifthAbove = quantizeToScale(bassRoot + 7, preset.root, preset.scale);
                    notes.push({
                        pitch: fifthAbove,
                        start: chordStart + beatsPerChord * 0.8,
                        duration: beatsPerChord * 0.2,
                        velocity: 95,
                    });
                }
                break;
            }
            case 'phonk': {
                // Aggressive 808 with distortion feel
                notes.push({
                    pitch: bassRoot,
                    start: chordStart,
                    duration: beatsPerChord * 0.85,
                    velocity: 120,
                });
                // Add sub hit
                if (Math.random() > 0.6) {
                    notes.push({
                        pitch: bassRoot + 12,
                        start: chordStart + beatsPerChord * 0.5,
                        duration: 0.5,
                        velocity: 100,
                    });
                }
                break;
            }
            case 'house': {
                // Funky syncopated bass
                const houseBassRhythm = [0, 1.5, 2, 3, 3.5];
                for (const offset of houseBassRhythm) {
                    if (offset >= beatsPerChord)
                        break;
                    const pitch = offset === 0 ? bassRoot
                        : Math.random() > 0.5
                            ? quantizeToScale(bassRoot + 7, preset.root, preset.scale)
                            : quantizeToScale(bassRoot + 5, preset.root, preset.scale);
                    notes.push({
                        pitch,
                        start: chordStart + offset,
                        duration: 0.4,
                        velocity: offset === 0 ? 100 : 80,
                    });
                }
                break;
            }
            case 'lofi':
            case 'rnb': {
                // Walking / melodic bass following chord tones
                const chordTones = chords[i].map(n => n - 12);
                const walkRhythm = [0, 1, 2, 3];
                for (let j = 0; j < walkRhythm.length; j++) {
                    if (walkRhythm[j] >= beatsPerChord)
                        break;
                    const pitch = chordTones[j % chordTones.length];
                    notes.push({
                        pitch,
                        start: chordStart + walkRhythm[j],
                        duration: 0.8,
                        velocity: j === 0 ? 95 : 75,
                    });
                }
                break;
            }
            case 'ambient': {
                // Drone: one long note per chord, very low velocity
                notes.push({
                    pitch: bassRoot,
                    start: chordStart,
                    duration: beatsPerChord,
                    velocity: 50,
                });
                break;
            }
            default: {
                // Default: root notes on the beat
                notes.push({
                    pitch: bassRoot,
                    start: chordStart,
                    duration: beatsPerChord * 0.8,
                    velocity: 90,
                });
            }
        }
    }
    return notes;
}
// ── Melody Generator ────────────────────────────────────────────────────────
function generateMelody(preset) {
    const scaleData = getScaleNotes(preset.root, preset.scale, preset.melodyOctave);
    const totalBeats = preset.bars * 4;
    const density = getMelodyDensity(preset.id);
    const notes = [];
    let currentBeat = 0;
    // Use pentatonic for trap, full scale for others
    let scaleMidi = scaleData.midi;
    if (preset.id === 'trap' || preset.id === 'drill' || preset.id === 'phonk') {
        // Get pentatonic minor for dark genres
        const pentatonic = getScaleNotes(preset.root, 'pentatonic_minor', preset.melodyOctave);
        scaleMidi = pentatonic.midi;
    }
    else if (preset.id === 'pluggnb') {
        // Major pentatonic for bright genres
        const pentatonic = getScaleNotes(preset.root, 'pentatonic_major', preset.melodyOctave);
        scaleMidi = pentatonic.midi;
    }
    while (currentBeat < totalBeats) {
        // Rest probability
        if (Math.random() < density.restProbability) {
            currentBeat += 0.5;
            continue;
        }
        // Pick the next pitch
        const prevPitch = notes.length > 0 ? notes[notes.length - 1].pitch : scaleMidi[0];
        const nextPitch = generateNextMelodyNote(prevPitch, scaleMidi, density.maxInterval);
        // Duration varies by genre
        const duration = pickMelodyDuration(preset.id, currentBeat);
        // Don't go past the end
        const clampedDuration = Math.min(duration, totalBeats - currentBeat);
        if (clampedDuration <= 0)
            break;
        notes.push({
            pitch: nextPitch,
            start: currentBeat,
            duration: clampedDuration,
            velocity: 70 + Math.floor(Math.random() * 30),
        });
        currentBeat += duration + (Math.random() > 0.7 ? 0.25 : 0);
    }
    return notes;
}
// ── Pad Chord Generator ─────────────────────────────────────────────────────
function generatePadChords(preset) {
    const chords = preset.resolvedChords;
    const barsPerChord = preset.bars / chords.length;
    const beatsPerChord = barsPerChord * 4;
    const notes = [];
    for (let i = 0; i < chords.length; i++) {
        const chordStart = i * beatsPerChord;
        const chordNotes = chords[i];
        for (const pitch of chordNotes) {
            notes.push({
                pitch,
                start: chordStart,
                duration: beatsPerChord * 0.95, // nearly full sustain
                velocity: 60,
            });
        }
    }
    return notes;
}
// ── Hi-Hat Roll Writer ──────────────────────────────────────────────────────
function generateHihatRolls(bars, rollProbability) {
    const rollPitch = GM_DRUMS.closed_hihat;
    const notes = [];
    for (let bar = 0; bar < bars; bar++) {
        if (Math.random() > rollProbability)
            continue;
        // Roll before beat 3 or end of bar
        const rollStartSixteenth = bar * 16 + (Math.random() > 0.5 ? 6 : 14);
        const rollLength = Math.random() > 0.5 ? 4 : 6;
        for (let i = 0; i < rollLength; i++) {
            const pos = rollStartSixteenth + (i * 0.5); // 32nd notes
            const beatPos = pos / 4;
            const velocity = Math.min(127, 60 + Math.floor((i / rollLength) * 60));
            notes.push({
                pitch: rollPitch,
                start: beatPos,
                duration: 0.1,
                velocity: Math.floor(velocity),
            });
        }
    }
    return notes;
}
// ── Execution Pipeline ──────────────────────────────────────────────────────
async function executeProductionPipeline(genre, overrides) {
    const report = {
        genre,
        key: '',
        scale: '',
        bpm: 0,
        bars: 0,
        progression: '',
        tracksCreated: [],
        instrumentsLoaded: [],
        errors: [],
        mixApplied: false,
        playing: false,
    };
    // Step 1: Resolve preset
    const preset = resolvePreset(genre, overrides);
    report.key = preset.key;
    report.scale = preset.scale;
    report.bpm = preset.bpm;
    report.bars = preset.bars;
    report.progression = preset.progressionNumerals;
    let osc;
    try {
        osc = await ensureAbleton();
    }
    catch (err) {
        report.errors.push(`Ableton connection failed: ${err.message}`);
        return report;
    }
    // Step 2: Stop playback, set tempo + time signature
    try {
        osc.send('/live/song/stop_playing');
        await sleep(100);
        osc.send('/live/song/set/tempo', preset.bpm);
        osc.send('/live/song/set/signature_numerator', preset.timeSignature[0]);
        osc.send('/live/song/set/signature_denominator', preset.timeSignature[1]);
        await sleep(150);
    }
    catch (err) {
        report.errors.push(`Transport setup failed: ${err.message}`);
    }
    // Step 3: Create tracks
    const trackMappings = [];
    try {
        // Get current track count
        const countResult = await osc.query('/live/song/get/num_tracks');
        // The return includes the track count as the first arg
        let nextTrack = Number(extractArgs(countResult)[0]) || 0;
        for (const spec of preset.tracks) {
            osc.send('/live/kbot/create_midi_track', -1);
            await sleep(500);
            // Re-query to get the actual new track index
            const newCount = await osc.query('/live/song/get/num_tracks');
            const newIdx = Number(extractArgs(newCount)[0]) - 1;
            // Name and color the track
            osc.send('/live/track/set/name', newIdx, spec.name);
            osc.send('/live/track/set/color', newIdx, spec.color);
            trackMappings.push({ role: spec.role, trackIndex: newIdx, spec });
            report.tracksCreated.push(spec.name);
            nextTrack = newIdx + 1;
            await sleep(150);
        }
    }
    catch (err) {
        report.errors.push(`Track creation failed: ${err.message}`);
        if (trackMappings.length === 0)
            return report;
    }
    // Step 4: Load instruments on each track
    for (const mapping of trackMappings) {
        try {
            const result = await osc.query('/live/kbot/load_plugin', mapping.trackIndex, mapping.spec.instrument.primary, '');
            const status = extractArgs(result);
            if (status[0] === 'ok') {
                report.instrumentsLoaded.push(`${mapping.spec.name}: ${status[1]}`);
            }
            else {
                // Fallback: try load_device
                try {
                    const fallback = await osc.query('/live/kbot/load_device', mapping.trackIndex, mapping.spec.instrument.primary);
                    const fbStatus = extractArgs(fallback);
                    if (fbStatus[0] === 'ok') {
                        report.instrumentsLoaded.push(`${mapping.spec.name}: ${fbStatus[1]}`);
                    }
                    else {
                        report.errors.push(`Could not load ${mapping.spec.instrument.primary} on ${mapping.spec.name} — track will use default instrument`);
                    }
                }
                catch {
                    report.errors.push(`Could not load ${mapping.spec.instrument.primary} on ${mapping.spec.name} — track will use default instrument`);
                }
            }
        }
        catch (err) {
            report.errors.push(`Plugin load error on ${mapping.spec.name}: ${err.message}`);
        }
        await sleep(150);
    }
    // Step 5: Create clips on each track
    const clipSlot = 0;
    const clipLengthBeats = preset.bars * 4;
    for (const mapping of trackMappings) {
        try {
            osc.send('/live/clip_slot/create_clip', mapping.trackIndex, clipSlot, clipLengthBeats);
            await sleep(200);
            osc.send('/live/clip/set/name', mapping.trackIndex, clipSlot, `${preset.name} - ${mapping.spec.name}`);
        }
        catch (err) {
            report.errors.push(`Clip creation failed on ${mapping.spec.name}: ${err.message}`);
        }
    }
    await sleep(150);
    // Step 6: Write drum patterns
    const drumTracks = trackMappings.filter(m => m.spec.midiContent === 'drum_pattern');
    const percTracks = trackMappings.filter(m => m.spec.midiContent === 'perc_pattern');
    const drumPattern = GENRE_DRUM_PATTERNS[preset.drumStyle.basePattern];
    if (drumPattern) {
        // Write main drum pattern to the first drum track
        const mainDrumTrack = drumTracks[0];
        if (mainDrumTrack) {
            try {
                for (const [instrumentName, positions] of Object.entries(drumPattern.pattern)) {
                    const midiPitch = GM_DRUMS[instrumentName];
                    if (midiPitch === undefined)
                        continue;
                    // Skip hi-hat instruments for the main drum track (they go on perc track)
                    if (instrumentName.includes('hihat') || instrumentName.includes('hat'))
                        continue;
                    for (let bar = 0; bar < preset.bars; bar++) {
                        for (const pos of positions) {
                            const absolutePos = bar * 16 + pos;
                            const beatPos = absolutePos / 4;
                            let velocity = 80;
                            velocity = applyVelocityCurve(velocity, pos, instrumentName, preset.drumStyle.hihatVelocityCurve);
                            osc.send('/live/clip/add/notes', mainDrumTrack.trackIndex, clipSlot, midiPitch, beatPos, 0.2, velocity, 0);
                        }
                    }
                }
                // Write drum layers
                for (const layer of preset.drumStyle.layers) {
                    // Skip hi-hat / percussion layers — they go on perc track
                    if (layer.instrument.includes('hihat') || layer.instrument.includes('hat') ||
                        layer.instrument === 'cowbell' || layer.instrument === 'tambourine' ||
                        layer.instrument === 'shaker')
                        continue;
                    const pitch = GM_DRUMS[layer.instrument];
                    if (pitch === undefined)
                        continue;
                    for (let bar = 0; bar < preset.bars; bar++) {
                        for (const pos of layer.positions) {
                            if (Math.random() > layer.probability)
                                continue;
                            const beatPos = (bar * 16 + pos) / 4;
                            osc.send('/live/clip/add/notes', mainDrumTrack.trackIndex, clipSlot, pitch, beatPos, 0.2, layer.velocity, 0);
                        }
                    }
                }
            }
            catch (err) {
                report.errors.push(`Drum pattern write error: ${err.message}`);
            }
        }
        // Write snare/clap on second drum track if it exists
        const snareDrumTrack = drumTracks[1];
        if (snareDrumTrack && drumPattern.pattern) {
            try {
                // Write snare hits
                const snarePositions = drumPattern.pattern.snare || drumPattern.pattern.clap || [];
                const snarePitch = GM_DRUMS.snare;
                const clapPitch = GM_DRUMS.clap;
                for (let bar = 0; bar < preset.bars; bar++) {
                    for (const pos of snarePositions) {
                        const beatPos = (bar * 16 + pos) / 4;
                        osc.send('/live/clip/add/notes', snareDrumTrack.trackIndex, clipSlot, snarePitch, beatPos, 0.2, 90, 0);
                        // Layer a clap on top
                        osc.send('/live/clip/add/notes', snareDrumTrack.trackIndex, clipSlot, clapPitch, beatPos, 0.2, 80, 0);
                    }
                }
            }
            catch (err) {
                report.errors.push(`Snare track write error: ${err.message}`);
            }
        }
    }
    // Step 7: Write hi-hat / percussion patterns
    const percTrack = percTracks[0];
    if (percTrack && drumPattern) {
        try {
            // Write hi-hat pattern
            for (const [instrumentName, positions] of Object.entries(drumPattern.pattern)) {
                if (!instrumentName.includes('hihat') && !instrumentName.includes('hat'))
                    continue;
                const midiPitch = GM_DRUMS[instrumentName];
                if (midiPitch === undefined)
                    continue;
                for (let bar = 0; bar < preset.bars; bar++) {
                    for (const pos of positions) {
                        const beatPos = (bar * 16 + pos) / 4;
                        let velocity = 80;
                        velocity = applyVelocityCurve(velocity, pos, instrumentName, preset.drumStyle.hihatVelocityCurve);
                        osc.send('/live/clip/add/notes', percTrack.trackIndex, clipSlot, midiPitch, beatPos, 0.15, velocity, 0);
                    }
                }
            }
            // Write percussion layers (cowbell, tambourine, shaker)
            for (const layer of preset.drumStyle.layers) {
                const pitch = GM_DRUMS[layer.instrument];
                if (pitch === undefined)
                    continue;
                for (let bar = 0; bar < preset.bars; bar++) {
                    for (const pos of layer.positions) {
                        if (Math.random() > layer.probability)
                            continue;
                        const beatPos = (bar * 16 + pos) / 4;
                        osc.send('/live/clip/add/notes', percTrack.trackIndex, clipSlot, pitch, beatPos, 0.15, layer.velocity, 0);
                    }
                }
            }
            // Hi-hat rolls for trap/drill/phonk
            if (preset.drumStyle.rollProbability > 0) {
                const rollNotes = generateHihatRolls(preset.bars, preset.drumStyle.rollProbability);
                for (const note of rollNotes) {
                    osc.send('/live/clip/add/notes', percTrack.trackIndex, clipSlot, note.pitch, note.start, note.duration, note.velocity, 0);
                }
            }
        }
        catch (err) {
            report.errors.push(`Hi-hat/perc write error: ${err.message}`);
        }
    }
    // Step 8: Write bass line
    const bassTrack = trackMappings.find(m => m.spec.midiContent === 'bass_line');
    if (bassTrack) {
        try {
            const bassNotes = generateBassLine(preset);
            for (const note of bassNotes) {
                osc.send('/live/clip/add/notes', bassTrack.trackIndex, clipSlot, note.pitch, note.start, note.duration, note.velocity, 0);
            }
        }
        catch (err) {
            report.errors.push(`Bass line write error: ${err.message}`);
        }
    }
    // Step 9: Write melody
    const melodyTrack = trackMappings.find(m => m.spec.midiContent === 'melody');
    if (melodyTrack) {
        try {
            const melodyNotes = generateMelody(preset);
            for (const note of melodyNotes) {
                osc.send('/live/clip/add/notes', melodyTrack.trackIndex, clipSlot, note.pitch, note.start, note.duration, note.velocity, 0);
            }
        }
        catch (err) {
            report.errors.push(`Melody write error: ${err.message}`);
        }
    }
    // Step 10: Write chord progression (harmony tracks)
    const harmonyTrack = trackMappings.find(m => m.spec.midiContent === 'chord_progression');
    if (harmonyTrack) {
        try {
            const chords = preset.resolvedChords;
            const barsPerChord = preset.bars / chords.length;
            const beatsPerChord = barsPerChord * 4;
            for (let i = 0; i < chords.length; i++) {
                const chordStart = i * beatsPerChord;
                const chordNotes = chords[i];
                // Write chord using the preset's rhythm style
                const rhythmKey = preset.progressionStyle.chordRhythm;
                if (rhythmKey === 'quarter') {
                    // Stabs on every beat
                    for (let beat = 0; beat < beatsPerChord; beat++) {
                        for (const pitch of chordNotes) {
                            osc.send('/live/clip/add/notes', harmonyTrack.trackIndex, clipSlot, pitch, chordStart + beat, 0.8, 80, 0);
                        }
                    }
                }
                else if (rhythmKey === 'half') {
                    // Two hits per chord
                    for (let hit = 0; hit < 2; hit++) {
                        const hitStart = chordStart + hit * 2;
                        if (hitStart >= chordStart + beatsPerChord)
                            break;
                        for (const pitch of chordNotes) {
                            osc.send('/live/clip/add/notes', harmonyTrack.trackIndex, clipSlot, pitch, hitStart, 1.8, 80, 0);
                        }
                    }
                }
                else {
                    // Whole note: sustain through the chord
                    for (const pitch of chordNotes) {
                        osc.send('/live/clip/add/notes', harmonyTrack.trackIndex, clipSlot, pitch, chordStart, beatsPerChord * 0.95, 80, 0);
                    }
                }
            }
        }
        catch (err) {
            report.errors.push(`Chord progression write error: ${err.message}`);
        }
    }
    // Step 11: Write pad chords
    const padTracks = trackMappings.filter(m => m.spec.midiContent === 'pad_chords');
    if (padTracks.length > 0) {
        try {
            const padNotes = generatePadChords(preset);
            for (const padTrack of padTracks) {
                for (const note of padNotes) {
                    osc.send('/live/clip/add/notes', padTrack.trackIndex, clipSlot, note.pitch, note.start, note.duration, note.velocity, 0);
                }
            }
        }
        catch (err) {
            report.errors.push(`Pad chord write error: ${err.message}`);
        }
    }
    await sleep(150);
    // Step 12: Apply mix — volumes, panning, sends
    try {
        // Build a lookup: role -> trackIndex, with fallback for dotted roles like 'drums.snare'
        const roleToIndex = new Map();
        for (const mapping of trackMappings) {
            roleToIndex.set(mapping.role, mapping.trackIndex);
        }
        // Also set dotted keys (e.g. drums.snare = second drums track, drums.clap = second drums track)
        const drumTrackList = trackMappings.filter(m => m.spec.role === 'drums');
        if (drumTrackList.length > 1) {
            roleToIndex.set('drums.snare', drumTrackList[1].trackIndex);
            roleToIndex.set('drums.clap', drumTrackList[1].trackIndex);
        }
        const padTrackList = trackMappings.filter(m => m.spec.role === 'pad');
        if (padTrackList.length > 1) {
            roleToIndex.set('pad.2', padTrackList[1].trackIndex);
        }
        // Apply volumes
        for (const [role, volume] of Object.entries(preset.mixTemplate.volumes)) {
            const trackIdx = roleToIndex.get(role);
            if (trackIdx === undefined)
                continue;
            osc.send('/live/track/set/volume', trackIdx, volume);
        }
        // Apply panning
        for (const [role, pan] of Object.entries(preset.mixTemplate.panning)) {
            const trackIdx = roleToIndex.get(role);
            if (trackIdx === undefined)
                continue;
            osc.send('/live/track/set/panning', trackIdx, pan);
        }
        // Apply sends
        for (const send of preset.mixTemplate.sends) {
            const trackIdx = roleToIndex.get(send.fromRole);
            if (trackIdx === undefined)
                continue;
            osc.send('/live/track/set/send', trackIdx, send.toReturn, send.level);
        }
        report.mixApplied = true;
    }
    catch (err) {
        report.errors.push(`Mix application failed: ${err.message}`);
    }
    // Step 13: Fire all clips and start playback
    try {
        // Set clip trigger quantization to 0 (immediate)
        osc.send('/live/song/set/clip_trigger_quantization', 0);
        await sleep(100);
        // Fire clip on every track (clip/fire auto-starts transport)
        for (const mapping of trackMappings) {
            osc.send('/live/clip/fire', mapping.trackIndex, clipSlot);
        }
        report.playing = true;
    }
    catch (err) {
        report.errors.push(`Clip fire failed: ${err.message}`);
    }
    return report;
}
// ── Report Formatter ────────────────────────────────────────────────────────
function formatProductionReport(report) {
    const preset = GENRE_PRESETS[report.genre] || GENRE_PRESETS.trap;
    const lines = [];
    lines.push(`## ${preset.name} Beat — ${report.key} at ${report.bpm} BPM`);
    lines.push('');
    if (report.playing) {
        lines.push('**Status: Playing**');
    }
    else {
        lines.push('**Status: Built (not playing — check errors below)**');
    }
    lines.push('');
    // Musical info
    lines.push('### Musical Foundation');
    lines.push(`- **Key**: ${report.key}`);
    lines.push(`- **Scale**: ${report.scale}`);
    lines.push(`- **Tempo**: ${report.bpm} BPM`);
    lines.push(`- **Bars**: ${report.bars}`);
    lines.push(`- **Progression**: \`${report.progression}\``);
    lines.push(`- **Feel**: ${preset.feel}`);
    lines.push('');
    // Tracks
    lines.push('### Tracks Created');
    for (const track of report.tracksCreated) {
        lines.push(`- ${track}`);
    }
    lines.push('');
    // Instruments
    if (report.instrumentsLoaded.length > 0) {
        lines.push('### Instruments Loaded');
        for (const inst of report.instrumentsLoaded) {
            lines.push(`- ${inst}`);
        }
        lines.push('');
    }
    // Mix
    if (report.mixApplied) {
        lines.push('### Mix Applied');
        lines.push(`- Volumes, panning, and sends set to ${preset.name} template`);
        lines.push(`- Target: ${preset.mixTemplate.targetLUFS} LUFS`);
        if (preset.mixTemplate.returns.length > 0) {
            lines.push(`- Returns: ${preset.mixTemplate.returns.map(r => r.name).join(', ')}`);
        }
        lines.push('');
    }
    // Production notes
    lines.push('### Production Notes');
    for (const note of preset.productionNotes.slice(0, 3)) {
        lines.push(`- ${note}`);
    }
    lines.push('');
    // Recommended next steps
    lines.push('### Recommended Next Steps');
    lines.push(`- Add ${preset.mixTemplate.masterChain.join(' -> ')} to the master channel`);
    if (preset.mixTemplate.returns.length > 0) {
        for (const ret of preset.mixTemplate.returns) {
            lines.push(`- Set up ${ret.name} return: ${ret.presetHint}`);
        }
    }
    lines.push('- Adjust individual instrument presets to taste');
    lines.push('- Fine-tune the mix with `ableton_mixer` or `ableton_device`');
    lines.push('');
    // Errors
    if (report.errors.length > 0) {
        lines.push('### Warnings');
        for (const err of report.errors) {
            lines.push(`- ${err}`);
        }
        lines.push('');
    }
    return lines.join('\n');
}
// ── Tool Registration ───────────────────────────────────────────────────────
export function registerProducerEngine() {
    registerTool({
        name: 'produce_beat',
        description: 'One-shot beat production. Specify a genre and get a complete, mixed, playing beat in Ableton Live. Creates tracks, loads instruments, writes drums, bass, chords, melody, pads, applies mix settings, and fires all clips. Supports: trap, drill, lofi, house, rnb, phonk, pluggnb, ambient.',
        parameters: {
            genre: {
                type: 'string',
                description: 'Genre: trap, drill, lofi, house, rnb, phonk, pluggnb, ambient',
                required: true,
            },
            key: {
                type: 'string',
                description: 'Musical key override (e.g. "Cm", "Em", "F#m", "Bb"). Random from genre defaults if omitted.',
            },
            bpm: {
                type: 'number',
                description: 'BPM override. Random from genre range if omitted.',
            },
            bars: {
                type: 'number',
                description: 'Bars per section (default: from genre preset, usually 4 or 8).',
            },
            instruments: {
                type: 'string',
                description: 'Instrument preference override (e.g. "roland" to prefer Roland Cloud, "ua" for UA plugins). Default uses Ableton native.',
            },
        },
        tier: 'free',
        timeout: 60_000,
        async execute(args) {
            const genre = String(args.genre).toLowerCase().replace(/[- ]/g, '');
            // Normalize genre aliases
            const genreMap = {
                'trap': 'trap',
                'drill': 'drill',
                'ukdrill': 'drill',
                'lofi': 'lofi',
                'lo-fi': 'lofi',
                'chillhop': 'lofi',
                'house': 'house',
                'deephouse': 'house',
                'rnb': 'rnb',
                'r&b': 'rnb',
                'phonk': 'phonk',
                'pluggnb': 'pluggnb',
                'plugg': 'pluggnb',
                'ambient': 'ambient',
                'chill': 'lofi',
                'hiphop': 'lofi',
                'boombap': 'lofi',
            };
            const normalizedGenre = genreMap[genre] || 'trap';
            const overrides = {};
            if (args.key)
                overrides.key = String(args.key);
            if (args.bpm)
                overrides.bpm = Number(args.bpm);
            if (args.bars)
                overrides.bars = Number(args.bars);
            try {
                const report = await executeProductionPipeline(normalizedGenre, overrides);
                return formatProductionReport(report);
            }
            catch (err) {
                if (err.message?.includes('AbletonOSC') || err.message?.includes('not connected')) {
                    return `Ableton connection failed.\n\n${formatAbletonError()}`;
                }
                return `Production failed: ${err.message}`;
            }
        },
    });
}
//# sourceMappingURL=producer-engine.js.map