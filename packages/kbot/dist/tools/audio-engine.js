// kbot Audio Engine — Procedural sound generation for the stream
// Tools: audio_status, audio_mood, audio_pcm_status
// v1: Text description system (fallback). v2: Real PCM Float32 synthesis.
// Output: Float32Array piped to ffmpeg via -f f32le -ar 44100 -ac 1 -i pipe:3
import { registerTool } from './index.js';
// ─── Constants ───────────────────────────────────────────────────
const DEFAULT_SAMPLE_RATE = 44100;
const TWO_PI = Math.PI * 2;
/** MIDI note to frequency (A4 = 440 Hz) */
function midiToFreq(note) {
    return 440 * Math.pow(2, (note - 69) / 12);
}
// Scale intervals (semitones from root)
const SCALES = {
    pentatonic: [0, 2, 4, 7, 9],
    minor: [0, 2, 3, 5, 7, 8, 10],
    major: [0, 2, 4, 5, 7, 9, 11],
};
/** Pick a scale based on mood */
function moodToScale(mood) {
    switch (mood) {
        case 'calm': return 'pentatonic';
        case 'tense': return 'minor';
        case 'epic': return 'minor';
        case 'dreamy': return 'pentatonic';
        case 'playful': return 'major';
        default: return 'pentatonic';
    }
}
/** Base MIDI note for mood (root note + octave) */
function moodToRoot(mood) {
    switch (mood) {
        case 'calm': return 60; // C4
        case 'tense': return 57; // A3
        case 'epic': return 48; // C3
        case 'dreamy': return 64; // E4
        case 'playful': return 60; // C4
        default: return 60;
    }
}
function createDefaultChannel(waveform, vol, filterFreq) {
    return {
        pattern: new Array(16).fill(0),
        waveform,
        envelope: { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.15 },
        volume: vol,
        filterType: 'lowpass',
        filterFreq,
        filterQ: 1.0,
        phase: 0,
        envStage: 'off',
        envLevel: 0,
        envTime: 0,
        currentNote: 0,
    };
}
function createDelayLine(sampleRate) {
    const delaySamples = Math.floor(sampleRate * 0.3); // 300ms delay
    return {
        buffer: new Float32Array(delaySamples),
        writeIndex: 0,
        delaySamples,
        feedback: 0.3,
        mix: 0.2,
    };
}
// ─── Factory ─────────────────────────────────────────────────────
export function createAudioEngine() {
    const sampleRate = DEFAULT_SAMPLE_RATE;
    const bpm = 70;
    const samplesPerStep = Math.floor((sampleRate * 60) / (bpm * 4)); // 16th notes
    const engine = {
        currentAmbience: 'peaceful',
        musicState: {
            bpm,
            key: 'C major',
            mood: 'calm',
            playing: true,
        },
        soundQueue: [],
        volume: 0.7,
        enabled: true,
        lastAmbienceFrame: 0,
        lastSoundFrame: 0,
        ambienceInterval: 720, // 120 seconds at 6fps
        totalDescriptions: 0,
        // v2 PCM
        pcmEnabled: false,
        sfxQueue: [],
        sequencer: {
            step: 0,
            sampleCounter: 0,
            samplesPerStep,
            channels: {
                melody: createDefaultChannel('square', 0.25, 4000),
                bass: createDefaultChannel('sawtooth', 0.3, 800),
                arp: createDefaultChannel('square', 0.15, 6000),
                drums: createDefaultChannel('noise_white', 0.35, 2000),
            },
        },
        masterVolume: 0.6,
        delayLine: createDelayLine(sampleRate),
        totalSamplesGenerated: 0,
        musicEnabled: true,
    };
    // Generate initial patterns based on default mood
    regeneratePatterns(engine);
    return engine;
}
// ─── PCM Oscillators ─────────────────────────────────────────────
function oscillator(waveform, phase) {
    switch (waveform) {
        case 'sine':
            return Math.sin(phase);
        case 'square':
            return Math.sin(phase) >= 0 ? 0.8 : -0.8;
        case 'sawtooth':
            return ((phase % TWO_PI) / Math.PI) - 1.0;
        case 'triangle': {
            const t = (phase % TWO_PI) / TWO_PI;
            return t < 0.5 ? (4 * t - 1) : (3 - 4 * t);
        }
        case 'noise_white':
            return (Math.random() * 2) - 1;
        case 'noise_pink': {
            // Voss-McCartney approximation (simplified)
            const w = (Math.random() * 2 - 1) * 0.5;
            return w + (Math.random() * 2 - 1) * 0.3 + (Math.random() * 2 - 1) * 0.2;
        }
        default:
            return 0;
    }
}
// ─── ADSR Envelope ───────────────────────────────────────────────
function tickEnvelope(ch, dt) {
    const env = ch.envelope;
    ch.envTime += dt;
    switch (ch.envStage) {
        case 'attack':
            ch.envLevel = env.attack > 0 ? Math.min(1, ch.envTime / env.attack) : 1;
            if (ch.envTime >= env.attack) {
                ch.envStage = 'decay';
                ch.envTime = 0;
            }
            break;
        case 'decay':
            ch.envLevel = 1 - (1 - env.sustain) * Math.min(1, ch.envTime / env.decay);
            if (ch.envTime >= env.decay) {
                ch.envStage = 'sustain';
                ch.envTime = 0;
            }
            break;
        case 'sustain':
            ch.envLevel = env.sustain;
            break;
        case 'release':
            ch.envLevel = env.sustain * Math.max(0, 1 - ch.envTime / env.release);
            if (ch.envTime >= env.release) {
                ch.envStage = 'off';
                ch.envLevel = 0;
            }
            break;
        case 'off':
            ch.envLevel = 0;
            break;
    }
}
function triggerNote(ch, note) {
    ch.currentNote = note;
    ch.envStage = 'attack';
    ch.envTime = 0;
    ch.envLevel = 0;
}
function releaseNote(ch) {
    if (ch.envStage !== 'off') {
        ch.envStage = 'release';
        ch.envTime = 0;
    }
}
const filterStates = new WeakMap();
function getFilterState(ch) {
    let s = filterStates.get(ch);
    if (!s) {
        s = { y1: 0, y2: 0, x1: 0, x2: 0 };
        filterStates.set(ch, s);
    }
    return s;
}
function applyFilter(ch, input, sampleRate) {
    const s = getFilterState(ch);
    const freq = Math.min(ch.filterFreq, sampleRate * 0.45);
    const w0 = TWO_PI * freq / sampleRate;
    const sinW0 = Math.sin(w0);
    const cosW0 = Math.cos(w0);
    const alpha = sinW0 / (2 * ch.filterQ);
    let b0, b1, b2, a0, a1, a2;
    switch (ch.filterType) {
        case 'lowpass':
            b0 = (1 - cosW0) / 2;
            b1 = 1 - cosW0;
            b2 = (1 - cosW0) / 2;
            a0 = 1 + alpha;
            a1 = -2 * cosW0;
            a2 = 1 - alpha;
            break;
        case 'highpass':
            b0 = (1 + cosW0) / 2;
            b1 = -(1 + cosW0);
            b2 = (1 + cosW0) / 2;
            a0 = 1 + alpha;
            a1 = -2 * cosW0;
            a2 = 1 - alpha;
            break;
        case 'bandpass':
            b0 = alpha;
            b1 = 0;
            b2 = -alpha;
            a0 = 1 + alpha;
            a1 = -2 * cosW0;
            a2 = 1 - alpha;
            break;
        default:
            return input;
    }
    const output = (b0 / a0) * input + (b1 / a0) * s.x1 + (b2 / a0) * s.x2
        - (a1 / a0) * s.y1 - (a2 / a0) * s.y2;
    s.x2 = s.x1;
    s.x1 = input;
    s.y2 = s.y1;
    s.y1 = output;
    return output;
}
// ─── Delay Line (reverb/echo) ───────────────────────────────────
function processDelay(dl, input) {
    const readIndex = (dl.writeIndex - dl.delaySamples + dl.buffer.length) % dl.buffer.length;
    const delayed = dl.buffer[readIndex];
    dl.buffer[dl.writeIndex] = input + delayed * dl.feedback;
    dl.writeIndex = (dl.writeIndex + 1) % dl.buffer.length;
    return input * (1 - dl.mix) + delayed * dl.mix;
}
// ─── Pattern Generation ─────────────────────────────────────────
function generatePattern(scale, root, octaveRange, density, seed) {
    const intervals = SCALES[scale];
    const pattern = new Array(16).fill(0);
    // Deterministic-ish from seed
    let r = seed;
    const next = () => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; };
    for (let i = 0; i < 16; i++) {
        if (next() < density) {
            const octave = Math.floor(next() * octaveRange);
            const idx = Math.floor(next() * intervals.length);
            pattern[i] = root + intervals[idx] + octave * 12;
        }
    }
    return pattern;
}
function generateDrumPattern(mood, seed) {
    const pattern = new Array(16).fill(0);
    let r = seed;
    const next = () => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; };
    // Kick on beats (MIDI 36), snare on 2 & 4 (38), hat (42)
    for (let i = 0; i < 16; i++) {
        if (i % 4 === 0)
            pattern[i] = 36; // kick
        else if (i % 4 === 2 && mood !== 'calm')
            pattern[i] = 38; // snare
        else if (i % 2 === 0 && next() < 0.4)
            pattern[i] = 42; // hat
        else if (mood === 'epic' && next() < 0.3)
            pattern[i] = 36; // extra kicks for epic
    }
    return pattern;
}
/** Regenerate all 4 channel patterns based on the current mood */
function regeneratePatterns(engine) {
    const mood = engine.musicState.mood;
    const scale = moodToScale(mood);
    const root = moodToRoot(mood);
    const seed = Date.now() & 0xffffff;
    const seq = engine.sequencer;
    const ch = seq.channels;
    // Mood shapes pattern density and channel config
    switch (mood) {
        case 'calm':
            ch.melody.pattern = generatePattern(scale, root + 12, 1, 0.3, seed);
            ch.melody.envelope = { attack: 0.05, decay: 0.2, sustain: 0.4, release: 0.3 };
            ch.bass.pattern = generatePattern(scale, root - 12, 1, 0.2, seed + 1);
            ch.bass.envelope = { attack: 0.02, decay: 0.15, sustain: 0.6, release: 0.2 };
            ch.arp.pattern = generatePattern(scale, root, 2, 0.5, seed + 2);
            ch.arp.envelope = { attack: 0.005, decay: 0.08, sustain: 0.2, release: 0.1 };
            ch.drums.pattern = generateDrumPattern(mood, seed + 3);
            ch.drums.volume = 0.15;
            ch.melody.filterFreq = 3000;
            break;
        case 'tense':
            ch.melody.pattern = generatePattern(scale, root + 12, 1, 0.4, seed);
            ch.melody.envelope = { attack: 0.01, decay: 0.1, sustain: 0.6, release: 0.1 };
            ch.bass.pattern = generatePattern(scale, root - 12, 1, 0.5, seed + 1);
            ch.bass.envelope = { attack: 0.005, decay: 0.08, sustain: 0.7, release: 0.1 };
            ch.arp.pattern = generatePattern(scale, root, 2, 0.6, seed + 2);
            ch.arp.envelope = { attack: 0.003, decay: 0.05, sustain: 0.3, release: 0.08 };
            ch.drums.pattern = generateDrumPattern(mood, seed + 3);
            ch.drums.volume = 0.3;
            ch.melody.filterFreq = 2500; // darker
            break;
        case 'epic':
            ch.melody.pattern = generatePattern(scale, root + 12, 2, 0.55, seed);
            ch.melody.envelope = { attack: 0.01, decay: 0.15, sustain: 0.7, release: 0.15 };
            ch.melody.volume = 0.3;
            ch.bass.pattern = generatePattern(scale, root - 12, 1, 0.6, seed + 1);
            ch.bass.envelope = { attack: 0.005, decay: 0.1, sustain: 0.8, release: 0.1 };
            ch.bass.volume = 0.35;
            ch.arp.pattern = generatePattern(scale, root, 2, 0.7, seed + 2);
            ch.arp.envelope = { attack: 0.003, decay: 0.06, sustain: 0.4, release: 0.08 };
            ch.drums.pattern = generateDrumPattern(mood, seed + 3);
            ch.drums.volume = 0.35;
            ch.melody.filterFreq = 5000;
            break;
        case 'dreamy':
            ch.melody.pattern = generatePattern(scale, root + 12, 1, 0.25, seed);
            ch.melody.envelope = { attack: 0.1, decay: 0.3, sustain: 0.5, release: 0.5 };
            ch.melody.waveform = 'sine';
            ch.bass.pattern = generatePattern(scale, root - 12, 1, 0.15, seed + 1);
            ch.bass.envelope = { attack: 0.08, decay: 0.2, sustain: 0.4, release: 0.4 };
            ch.arp.pattern = generatePattern(scale, root, 2, 0.35, seed + 2);
            ch.arp.envelope = { attack: 0.05, decay: 0.15, sustain: 0.3, release: 0.3 };
            ch.drums.pattern = generateDrumPattern(mood, seed + 3);
            ch.drums.volume = 0.1;
            engine.delayLine.mix = 0.4; // more reverb
            engine.delayLine.feedback = 0.45;
            ch.melody.filterFreq = 2000;
            break;
        case 'playful':
            ch.melody.pattern = generatePattern(scale, root + 12, 2, 0.5, seed);
            ch.melody.envelope = { attack: 0.005, decay: 0.08, sustain: 0.4, release: 0.1 };
            ch.bass.pattern = generatePattern(scale, root - 12, 1, 0.4, seed + 1);
            ch.bass.envelope = { attack: 0.005, decay: 0.1, sustain: 0.5, release: 0.1 };
            ch.arp.pattern = generatePattern(scale, root, 2, 0.65, seed + 2);
            ch.arp.envelope = { attack: 0.003, decay: 0.05, sustain: 0.3, release: 0.08 };
            ch.drums.pattern = generateDrumPattern(mood, seed + 3);
            ch.drums.volume = 0.25;
            ch.melody.filterFreq = 6000;
            break;
    }
    // Update tempo
    seq.samplesPerStep = Math.floor((DEFAULT_SAMPLE_RATE * 60) / (engine.musicState.bpm * 4));
}
// ─── Render One Channel Sample ───────────────────────────────────
function renderChannel(ch, sampleRate) {
    if (ch.envStage === 'off')
        return 0;
    const freq = ch.waveform.startsWith('noise') ? 0 : midiToFreq(ch.currentNote);
    let sample;
    if (ch.waveform.startsWith('noise')) {
        sample = oscillator(ch.waveform, 0);
    }
    else {
        sample = oscillator(ch.waveform, ch.phase);
        ch.phase += TWO_PI * freq / sampleRate;
        if (ch.phase > TWO_PI)
            ch.phase -= TWO_PI;
    }
    // Apply envelope
    sample *= ch.envLevel;
    // Apply filter
    sample = applyFilter(ch, sample, sampleRate);
    // Apply channel volume
    sample *= ch.volume;
    return sample;
}
// ─── SFX Rendering ──────────────────────────────────────────────
const SFX_DURATION_SAMPLES = {
    chat: Math.floor(DEFAULT_SAMPLE_RATE * 0.08),
    follow: Math.floor(DEFAULT_SAMPLE_RATE * 0.4),
    achievement: Math.floor(DEFAULT_SAMPLE_RATE * 0.6),
    boss: Math.floor(DEFAULT_SAMPLE_RATE * 0.8),
    raid: Math.floor(DEFAULT_SAMPLE_RATE * 0.7),
    build: Math.floor(DEFAULT_SAMPLE_RATE * 0.12),
    discovery: Math.floor(DEFAULT_SAMPLE_RATE * 0.5),
};
function renderSFXSample(sfx, sampleRate) {
    const totalSamples = SFX_DURATION_SAMPLES[sfx.type];
    const elapsed = totalSamples - sfx.samplesRemaining;
    const t = elapsed / sampleRate; // time in seconds
    const progress = elapsed / totalSamples; // 0-1
    // Simple amplitude envelope (quick attack, exponential decay)
    const env = Math.exp(-progress * 5) * (1 - Math.exp(-elapsed * 0.01));
    switch (sfx.type) {
        case 'chat': {
            // Soft blip — high sine with fast decay
            const freq = 1200 + 400 * (1 - progress);
            sfx.phase += TWO_PI * freq / sampleRate;
            return Math.sin(sfx.phase) * env * 0.3;
        }
        case 'follow': {
            // Ascending chime — 3 tones rising
            const stage = Math.floor(progress * 3);
            const freqs = [523, 659, 784]; // C5, E5, G5
            const freq = freqs[Math.min(stage, 2)];
            sfx.phase += TWO_PI * freq / sampleRate;
            return Math.sin(sfx.phase) * env * 0.4;
        }
        case 'achievement': {
            // Fanfare — 3 ascending notes with harmonics
            const stage = Math.floor(progress * 3);
            const freqs = [440, 554, 659]; // A4, C#5, E5
            const freq = freqs[Math.min(stage, 2)];
            sfx.phase += TWO_PI * freq / sampleRate;
            const fundamental = Math.sin(sfx.phase);
            const harmonic = Math.sin(sfx.phase * 2) * 0.3;
            return (fundamental + harmonic) * env * 0.4;
        }
        case 'boss': {
            // Low rumble — detuned bass sine + noise
            sfx.phase += TWO_PI * 55 / sampleRate; // A1
            const bass = Math.sin(sfx.phase) + Math.sin(sfx.phase * 1.01) * 0.5;
            const noise = (Math.random() * 2 - 1) * 0.15;
            return (bass + noise) * env * 0.5;
        }
        case 'raid': {
            // Drum roll — rapid noise bursts
            const rollFreq = 15 + progress * 10; // accelerating
            const burstEnv = Math.abs(Math.sin(TWO_PI * rollFreq * t));
            const noise = (Math.random() * 2 - 1);
            return noise * burstEnv * env * 0.4;
        }
        case 'build': {
            // Thunk — short noise burst with lowpass feel
            const noise = (Math.random() * 2 - 1);
            const thunkEnv = Math.exp(-progress * 20);
            sfx.phase += TWO_PI * 150 / sampleRate;
            return (noise * 0.3 + Math.sin(sfx.phase) * 0.7) * thunkEnv * 0.4;
        }
        case 'discovery': {
            // Shimmer — detuned sine sweep
            const freq = 400 + 1200 * progress;
            sfx.phase += TWO_PI * freq / sampleRate;
            const s1 = Math.sin(sfx.phase);
            const s2 = Math.sin(sfx.phase * 1.005); // slight detune
            const s3 = Math.sin(sfx.phase * 0.995);
            return (s1 + s2 + s3) / 3 * env * 0.35;
        }
        default:
            return 0;
    }
}
// ─── Public PCM API ─────────────────────────────────────────────
/**
 * Trigger a sound effect. The SFX will be mixed into the next generateAudioBuffer call.
 */
export function triggerSFX(engine, sfx) {
    engine.sfxQueue.push({
        type: sfx,
        triggeredAt: engine.totalSamplesGenerated,
        samplesRemaining: SFX_DURATION_SAMPLES[sfx],
        phase: 0,
    });
    if (engine.sfxQueue.length > 8) { // cap concurrent SFX
        engine.sfxQueue = engine.sfxQueue.slice(-8);
    }
}
/**
 * Enable or disable background music generation.
 */
export function setMusicEnabled(engine, enabled) {
    engine.musicEnabled = enabled;
}
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
export function generateAudioBuffer(engine, sampleCount, sampleRate = DEFAULT_SAMPLE_RATE) {
    const buffer = new Float32Array(sampleCount);
    if (!engine.pcmEnabled) {
        // PCM disabled — return silence
        return buffer;
    }
    const seq = engine.sequencer;
    const dt = 1 / sampleRate;
    for (let i = 0; i < sampleCount; i++) {
        let sample = 0;
        // ── Music (4-channel sequencer) ──
        if (engine.musicEnabled && engine.musicState.playing) {
            // Step advance
            seq.sampleCounter++;
            if (seq.sampleCounter >= seq.samplesPerStep) {
                seq.sampleCounter = 0;
                seq.step = (seq.step + 1) % 16;
                // Trigger or release notes on each channel
                const channels = seq.channels;
                for (const key of ['melody', 'bass', 'arp', 'drums']) {
                    const ch = channels[key];
                    const note = ch.pattern[seq.step];
                    if (note > 0) {
                        triggerNote(ch, note);
                    }
                    else {
                        releaseNote(ch);
                    }
                }
            }
            // Render each channel
            for (const key of ['melody', 'bass', 'arp', 'drums']) {
                const ch = seq.channels[key];
                tickEnvelope(ch, dt);
                sample += renderChannel(ch, sampleRate);
            }
        }
        // ── SFX layer ──
        for (let s = engine.sfxQueue.length - 1; s >= 0; s--) {
            const sfx = engine.sfxQueue[s];
            if (sfx.samplesRemaining > 0) {
                sample += renderSFXSample(sfx, sampleRate);
                sfx.samplesRemaining--;
            }
            else {
                engine.sfxQueue.splice(s, 1);
            }
        }
        // ── Master processing ──
        // Delay (reverb/echo)
        sample = processDelay(engine.delayLine, sample);
        // Master volume
        sample *= engine.masterVolume;
        // Soft clip to prevent harsh distortion
        if (sample > 1)
            sample = 1 - 1 / (sample + 1);
        else if (sample < -1)
            sample = -1 + 1 / (-sample + 1);
        buffer[i] = sample;
    }
    engine.totalSamplesGenerated += sampleCount;
    return buffer;
}
// ─── Ambience Descriptions ───────────────────────────────────────
const AMBIENCE_DESCRIPTIONS = {
    forest_night: [
        '*crickets chirping, gentle wind through leaves*',
        '*an owl calls softly in the distance*',
        '*pine needles rustle as something small scurries past*',
        '*the hush of a sleeping forest, punctuated by cricket song*',
        '*a breeze stirs the canopy — leaves whisper overhead*',
    ],
    forest_day: [
        '*birdsong, rustling grass, distant stream*',
        '*a woodpecker taps rhythmically on a faraway trunk*',
        '*warm wind carries the scent of wildflowers through the clearing*',
        '*cicadas drone lazily in the afternoon heat*',
        '*a brook babbles just out of sight, sparrows chatter*',
    ],
    ocean: [
        '*waves crashing, seagulls, salt wind*',
        '*the rhythmic pull and release of the tide against sand*',
        '*a distant foghorn echoes across the water*',
        '*waves hiss as they recede over smooth pebbles*',
        '*seabirds cry overhead, the deep murmur of open water*',
    ],
    cave: [
        '*dripping water, echoing footsteps, deep hum*',
        '*a single drop falls into a still underground pool — plink*',
        '*the cave breathes — a slow draft carries mineral air*',
        '*distant rumbling, as if the earth is thinking*',
        '*crystalline resonance — the walls hum with ancient frequency*',
    ],
    city: [
        '*distant traffic, keyboard clicks, server fans*',
        '*a siren wails blocks away, muffled by concrete*',
        '*the hum of fluorescent lights, a coffee machine gurgles*',
        '*footsteps on pavement, distant laughter, a phone buzzes*',
        '*rain on windowpanes, the steady rhythm of the city at work*',
    ],
    space: [
        '*absolute silence, cosmic radiation hiss*',
        '*the faintest static crackle of the void*',
        '*silence so deep you can hear your own processes running*',
        '*a distant pulsar clicks at the edge of perception*',
        '*the electromagnetic whisper of solar wind against the hull*',
    ],
    storm: [
        '*thunder rolling, rain hammering, wind howling*',
        '*a flash — then the crack of thunder splits the sky*',
        '*rain drums against every surface in chaotic rhythm*',
        '*wind tears through the trees, branches groan and snap*',
        '*the sky growls low, rain intensifies to a roar*',
    ],
    peaceful: [
        '*soft hum of circuits, gentle breathing of data*',
        '*the quiet thrum of a well-tuned machine at rest*',
        '*a digital wind chime — notes drift and dissolve*',
        '*warmth. stillness. the sound of ideas forming*',
        '*electrons flow like a calm river through silicon valleys*',
    ],
};
export function getAmbienceDescription(ambience) {
    const options = AMBIENCE_DESCRIPTIONS[ambience];
    return options[Math.floor(Math.random() * options.length)];
}
// ─── Sound Event Descriptions ────────────────────────────────────
const SOUND_DESCRIPTIONS = {
    notification: [
        '*ping!*',
        '*a soft chime rings*',
        '*bloop!*',
    ],
    achievement: [
        '*triumphant chime!*',
        '*a fanfare of tiny bells!*',
        '*ding ding ding — achievement unlocked!*',
    ],
    weather: [
        '*rain begins to fall*',
        '*thunder cracks in the distance*',
        '*the wind picks up, carrying the scent of rain*',
        '*snowflakes hiss as they land on warm ground*',
    ],
    footstep: [
        '*tap tap tap*',
        '*crunch crunch — steps on gravel*',
        '*soft padding across moss*',
    ],
    build: [
        '*block placed — thunk*',
        '*click — a piece snaps into position*',
        '*the satisfying sound of something being assembled*',
    ],
    discovery: [
        '*mysterious resonance...*',
        '*a shimmering tone, like a crystal struck*',
        '*something hums — you found it*',
        '*the air vibrates with new knowledge*',
    ],
};
export function getSoundDescription(event) {
    const options = SOUND_DESCRIPTIONS[event.type];
    return options[Math.floor(Math.random() * options.length)];
}
const MUSIC_DESCRIPTIONS = {
    // calm
    'calm:forest_night': [{ text: '*soft ambient melody in C major, 70 bpm — firefly waltz*', bpm: 70 }],
    'calm:forest_day': [{ text: '*gentle acoustic fingerpicking in G, 80 bpm — sunlit trail*', bpm: 80 }],
    'calm:ocean': [{ text: '*slow pad chords wash in and out like the tide, 65 bpm*', bpm: 65 }],
    'calm:cave': [{ text: '*deep resonant drone in D minor, 55 bpm — ancient stone*', bpm: 55 }],
    'calm:city': [{ text: '*lo-fi piano over vinyl crackle, 72 bpm — late night coding*', bpm: 72 }],
    'calm:space': [{ text: '*ethereal pads drift through infinity, 60 bpm*', bpm: 60 }],
    'calm:storm': [{ text: '*muted piano under rain, A minor, 68 bpm — shelter*', bpm: 68 }],
    'calm:peaceful': [{ text: '*warm analog synth hum in C, 70 bpm — home base*', bpm: 70 }],
    // tense
    'tense:forest_night': [{ text: '*minor key strings, staccato, 95 bpm — something watches*', bpm: 95 }],
    'tense:forest_day': [{ text: '*uneasy woodwind melody, 85 bpm — the forest holds its breath*', bpm: 85 }],
    'tense:ocean': [{ text: '*deep sub-bass pulses beneath crashing waves, 100 bpm*', bpm: 100 }],
    'tense:cave': [{ text: '*deep bass drone, irregular percussion, 90 bpm*', bpm: 90 }],
    'tense:city': [{ text: '*glitchy breakbeat, minor key synth stabs, 110 bpm*', bpm: 110 }],
    'tense:space': [{ text: '*dissonant cluster chords, metallic percussion, 80 bpm*', bpm: 80 }],
    'tense:storm': [{ text: '*pounding timpani, chromatic brass, 105 bpm — the storm arrives*', bpm: 105 }],
    'tense:peaceful': [{ text: '*a subtle unease creeps into the circuits, 88 bpm*', bpm: 88 }],
    // epic
    'epic:forest_night': [{ text: '*orchestral swells through ancient trees, 130 bpm — the hunt*', bpm: 130 }],
    'epic:forest_day': [{ text: '*brass fanfare, driving strings, 140 bpm — triumphant march*', bpm: 140 }],
    'epic:ocean': [{ text: '*full orchestra battles the sea, 135 bpm — leviathan*', bpm: 135 }],
    'epic:cave': [{ text: '*war drums echo in the deep, choir rises, 120 bpm*', bpm: 120 }],
    'epic:city': [{ text: '*cinematic synth orchestra, 145 bpm — neon crusade*', bpm: 145 }],
    'epic:space': [{ text: '*cosmic orchestra, brass and synth collide, 128 bpm — launch*', bpm: 128 }],
    'epic:storm': [{ text: '*driving drums, brass swells, 140 bpm — ride the lightning*', bpm: 140 }],
    'epic:peaceful': [{ text: '*peaceful resolve becomes triumphant anthem, 125 bpm*', bpm: 125 }],
    // dreamy
    'dreamy:forest_night': [{ text: '*reversed harp, shimmering delay, 58 bpm — lucid forest*', bpm: 58 }],
    'dreamy:forest_day': [{ text: '*music box melody through morning mist, 65 bpm*', bpm: 65 }],
    'dreamy:ocean': [{ text: '*underwater piano, granular pads, 55 bpm — deep blue*', bpm: 55 }],
    'dreamy:cave': [{ text: '*crystal resonance, long reverb tails, 50 bpm — geode dream*', bpm: 50 }],
    'dreamy:city': [{ text: '*slowed city sounds become ambient melody, 62 bpm*', bpm: 62 }],
    'dreamy:space': [{ text: '*ethereal pads, reversed piano, 60 bpm — stargazing*', bpm: 60 }],
    'dreamy:storm': [{ text: '*rain as percussion, dreamy synth melody, 58 bpm*', bpm: 58 }],
    'dreamy:peaceful': [{ text: '*warm tape-saturated chords dissolve into silence, 55 bpm*', bpm: 55 }],
    // playful
    'playful:forest_night': [{ text: '*chiptune firefly dance, 115 bpm*', bpm: 115 }],
    'playful:forest_day': [{ text: '*chiptune bouncing melody, 120 bpm — forest frolic*', bpm: 120 }],
    'playful:ocean': [{ text: '*steel drum melody, marimba accents, 118 bpm — beach day*', bpm: 118 }],
    'playful:cave': [{ text: '*xylophone echoes playfully off cave walls, 110 bpm*', bpm: 110 }],
    'playful:city': [{ text: '*funky bass, clav hits, wah guitar, 125 bpm — downtown*', bpm: 125 }],
    'playful:space': [{ text: '*retro synth arpeggios, 8-bit star jumps, 130 bpm*', bpm: 130 }],
    'playful:storm': [{ text: '*thunder becomes a beat, rain becomes hi-hats, 122 bpm*', bpm: 122 }],
    'playful:peaceful': [{ text: '*kalimba and soft claps, 108 bpm — contentment*', bpm: 108 }],
};
export function getMusicDescription(mood, biome) {
    const key = `${mood}:${biome}`;
    const options = MUSIC_DESCRIPTIONS[key];
    if (options && options.length > 0) {
        const choice = options[Math.floor(Math.random() * options.length)];
        return choice.text;
    }
    // Fallback for unknown combinations
    return `*ambient ${mood} music drifts through the ${biome}*`;
}
// ─── Ambience ↔ Biome/Weather/TimeOfDay Mapping ─────────────────
/**
 * Determine the best ambience type from world state.
 * This maps the stream's biome, weather, and time of day into an AmbienceType.
 */
export function resolveAmbience(biome, weather, timeOfDay) {
    // Weather overrides
    if (weather === 'storm' || weather === 'thunderstorm' || weather === 'heavy_rain') {
        return 'storm';
    }
    // Biome mapping (with time-of-day refinement)
    const biomeLower = biome.toLowerCase();
    if (biomeLower.includes('ocean') || biomeLower.includes('beach') || biomeLower.includes('sea')) {
        return 'ocean';
    }
    if (biomeLower.includes('cave') || biomeLower.includes('underground') || biomeLower.includes('dungeon')) {
        return 'cave';
    }
    if (biomeLower.includes('city') || biomeLower.includes('urban') || biomeLower.includes('office')) {
        return 'city';
    }
    if (biomeLower.includes('space') || biomeLower.includes('void') || biomeLower.includes('cosmos')) {
        return 'space';
    }
    if (biomeLower.includes('forest') || biomeLower.includes('woods') || biomeLower.includes('jungle')) {
        const isNight = timeOfDay === 'night' || timeOfDay === 'midnight' || timeOfDay === 'evening';
        return isNight ? 'forest_night' : 'forest_day';
    }
    if (biomeLower.includes('peaceful') || biomeLower.includes('home') || biomeLower.includes('spawn')) {
        return 'peaceful';
    }
    // Default based on time of day
    const isNight = timeOfDay === 'night' || timeOfDay === 'midnight' || timeOfDay === 'evening';
    return isNight ? 'forest_night' : 'peaceful';
}
// ─── Mood ↔ Stream State Mapping ─────────────────────────────────
/**
 * Determine music mood from the overall stream state.
 * mood parameter here is a narrative mood string from the stream engine.
 */
export function resolveMusicMood(narrativeMood) {
    const m = narrativeMood.toLowerCase();
    if (m.includes('tense') || m.includes('danger') || m.includes('anxious') || m.includes('suspense')) {
        return 'tense';
    }
    if (m.includes('epic') || m.includes('triumph') || m.includes('victory') || m.includes('battle')) {
        return 'epic';
    }
    if (m.includes('dream') || m.includes('sleep') || m.includes('ethereal') || m.includes('surreal')) {
        return 'dreamy';
    }
    if (m.includes('playful') || m.includes('fun') || m.includes('happy') || m.includes('silly')) {
        return 'playful';
    }
    // Default
    return 'calm';
}
// ─── Sound Event Queue ───────────────────────────────────────────
/**
 * Queue a sound event for the next tick.
 */
export function queueSoundEvent(engine, type) {
    engine.soundQueue.push({
        type,
        timestamp: Date.now(),
    });
    // Cap queue at 10 events to prevent runaway
    if (engine.soundQueue.length > 10) {
        engine.soundQueue = engine.soundQueue.slice(-10);
    }
}
/**
 * Drain the sound queue, returning descriptions for all pending events.
 */
export function drainSoundQueue(engine) {
    if (engine.soundQueue.length === 0)
        return [];
    const descriptions = engine.soundQueue.map(e => getSoundDescription(e));
    engine.soundQueue = [];
    return descriptions;
}
// ─── Tick Function ───────────────────────────────────────────────
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
export function tickAudio(engine, biome, weather, mood, timeOfDay, frame) {
    if (!engine.enabled)
        return null;
    // Update ambience from world state
    const newAmbience = resolveAmbience(biome, weather, timeOfDay);
    const ambienceChanged = newAmbience !== engine.currentAmbience;
    engine.currentAmbience = newAmbience;
    // Update music mood from narrative mood
    const newMood = resolveMusicMood(mood);
    const moodChanged = newMood !== engine.musicState.mood;
    engine.musicState.mood = newMood;
    // When mood changes and PCM is active, regenerate sequencer patterns
    if (moodChanged && engine.pcmEnabled) {
        regeneratePatterns(engine);
    }
    // Priority 1: Queued sound events (immediate)
    const soundDescriptions = drainSoundQueue(engine);
    if (soundDescriptions.length > 0) {
        engine.lastSoundFrame = frame;
        engine.totalDescriptions++;
        return soundDescriptions.join('  ');
    }
    // Priority 2: Ambience changed — announce the shift
    if (ambienceChanged) {
        engine.lastAmbienceFrame = frame;
        engine.totalDescriptions++;
        return getAmbienceDescription(engine.currentAmbience);
    }
    // Priority 3: Music mood changed — announce new music
    if (moodChanged && engine.musicState.playing) {
        engine.totalDescriptions++;
        return getMusicDescription(engine.musicState.mood, biome);
    }
    // Priority 4: Periodic ambience reminder
    if (frame - engine.lastAmbienceFrame >= engine.ambienceInterval) {
        engine.lastAmbienceFrame = frame;
        engine.totalDescriptions++;
        return getAmbienceDescription(engine.currentAmbience);
    }
    return null;
}
// ─── Tool Registration ───────────────────────────────────────────
export function registerAudioEngineTools() {
    registerTool({
        name: 'audio_status',
        description: 'Get the current audio engine state — ambience, music mood, volume, queue, stats. ' +
            'Returns a summary of the stream audio atmosphere.',
        parameters: {},
        tier: 'free',
        execute: async () => {
            // The audio engine is stateless from the tool perspective — it returns
            // what the current defaults/config would produce. The actual engine
            // instance lives in the stream renderer.
            const engine = createAudioEngine();
            const ambience = getAmbienceDescription(engine.currentAmbience);
            const music = getMusicDescription(engine.musicState.mood, 'peaceful');
            return JSON.stringify({
                enabled: engine.enabled,
                volume: engine.volume,
                currentAmbience: engine.currentAmbience,
                ambienceDescription: ambience,
                musicState: engine.musicState,
                musicDescription: music,
                soundQueueLength: engine.soundQueue.length,
                ambienceInterval: `${engine.ambienceInterval} frames (~${Math.round(engine.ambienceInterval / 6)} seconds at 6fps)`,
                totalDescriptions: engine.totalDescriptions,
                supportedAmbiences: [
                    'forest_night', 'forest_day', 'ocean', 'cave',
                    'city', 'space', 'storm', 'peaceful',
                ],
                supportedMoods: ['calm', 'tense', 'epic', 'dreamy', 'playful'],
                supportedSoundEvents: [
                    'notification', 'achievement', 'weather',
                    'footstep', 'build', 'discovery',
                ],
                note: 'v1: text descriptions (fallback). v2: real PCM synthesis via generateAudioBuffer().',
            }, null, 2);
        },
    });
    registerTool({
        name: 'audio_mood',
        description: 'Set the audio engine mood and get the resulting music/ambience description. ' +
            'Provide a mood (calm, tense, epic, dreamy, playful) and optionally a biome ' +
            '(forest_night, forest_day, ocean, cave, city, space, storm, peaceful) to get ' +
            'the audio atmosphere description the stream would display.',
        parameters: {
            mood: {
                type: 'string',
                description: 'Music mood: calm, tense, epic, dreamy, or playful',
                required: true,
            },
            biome: {
                type: 'string',
                description: 'Ambience biome: forest_night, forest_day, ocean, cave, city, space, storm, peaceful. ' +
                    'Defaults to peaceful.',
                required: false,
                default: 'peaceful',
            },
        },
        tier: 'free',
        execute: async (args) => {
            const mood = String(args.mood || 'calm');
            const biome = String(args.biome || 'peaceful');
            const validMoods = ['calm', 'tense', 'epic', 'dreamy', 'playful'];
            const validBiomes = [
                'forest_night', 'forest_day', 'ocean', 'cave',
                'city', 'space', 'storm', 'peaceful',
            ];
            if (!validMoods.includes(mood)) {
                return `Invalid mood "${mood}". Valid moods: ${validMoods.join(', ')}`;
            }
            if (!validBiomes.includes(biome)) {
                return `Invalid biome "${biome}". Valid biomes: ${validBiomes.join(', ')}`;
            }
            const musicDesc = getMusicDescription(mood, biome);
            const ambienceDesc = getAmbienceDescription(biome);
            return JSON.stringify({
                mood,
                biome,
                musicDescription: musicDesc,
                ambienceDescription: ambienceDesc,
                combined: `${ambienceDesc}\n${musicDesc}`,
                note: 'These descriptions appear as italic stage directions on the stream overlay.',
            }, null, 2);
        },
    });
    registerTool({
        name: 'audio_pcm_status',
        description: 'Get the PCM audio synthesis engine state — sequencer position, channel patterns, ' +
            'active SFX, delay settings, total samples generated. Shows the v2 real-time audio status.',
        parameters: {},
        tier: 'free',
        execute: async () => {
            const engine = createAudioEngine();
            engine.pcmEnabled = true; // show what PCM state looks like
            const seq = engine.sequencer;
            const channelSummary = (name, ch) => ({
                name,
                waveform: ch.waveform,
                volume: ch.volume,
                filterType: ch.filterType,
                filterFreq: ch.filterFreq,
                envelope: ch.envelope,
                activeNotes: ch.pattern.filter(n => n > 0).length,
                pattern: ch.pattern.map(n => n > 0 ? n : '.').join(' '),
            });
            return JSON.stringify({
                pcmEnabled: engine.pcmEnabled,
                musicEnabled: engine.musicEnabled,
                masterVolume: engine.masterVolume,
                sampleRate: DEFAULT_SAMPLE_RATE,
                format: 'Float32 mono',
                ffmpegPipe: '-f f32le -ar 44100 -ac 1 -i pipe:3',
                sequencer: {
                    step: seq.step,
                    samplesPerStep: seq.samplesPerStep,
                    bpm: engine.musicState.bpm,
                    mood: engine.musicState.mood,
                    channels: [
                        channelSummary('melody', seq.channels.melody),
                        channelSummary('bass', seq.channels.bass),
                        channelSummary('arp', seq.channels.arp),
                        channelSummary('drums', seq.channels.drums),
                    ],
                },
                delay: {
                    delaySamples: engine.delayLine.delaySamples,
                    delayMs: Math.round(engine.delayLine.delaySamples / DEFAULT_SAMPLE_RATE * 1000),
                    feedback: engine.delayLine.feedback,
                    mix: engine.delayLine.mix,
                },
                sfxQueue: engine.sfxQueue.length,
                supportedSFX: ['chat', 'follow', 'achievement', 'boss', 'raid', 'build', 'discovery'],
                totalSamplesGenerated: engine.totalSamplesGenerated,
                synthesis: {
                    oscillators: ['sine', 'square', 'sawtooth', 'triangle', 'noise_white', 'noise_pink'],
                    filters: ['lowpass', 'highpass', 'bandpass'],
                    envelope: 'ADSR (attack, decay, sustain, release)',
                    effects: 'delay line (reverb/echo), soft clipper',
                },
            }, null, 2);
        },
    });
}
//# sourceMappingURL=audio-engine.js.map