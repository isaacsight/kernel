// kbot Audio Engine — Procedural sound generation for the stream
//
// Tools: audio_status, audio_mood
//
// v1: Audio Description System
// The stream currently pipes silent audio via ffmpeg's anullsrc filter.
// Piping actual PCM audio requires significant architecture changes (separate
// pipe fd, real-time audio synthesis, mixing). For v1, this engine generates
// textual audio atmosphere descriptions that the narrative engine and renderer
// can display as italic stage directions (like a screenplay).
//
// v2 roadmap: Generate actual PCM Float32 audio and pipe to ffmpeg via pipe:3.
//
// FUTURE: Generate actual PCM audio
// export function generatePCMAudio(engine: AudioEngine, sampleRate: number, samples: number): Float32Array
// This would generate procedural audio using:
// - Oscillators (sine, square, sawtooth for chiptune)
// - Noise generators (white noise for wind/rain)
// - Envelope generators (ADSR for notes)
// - Simple reverb (delay line)
// - Mix to mono PCM, pipe to ffmpeg via separate audio input
// ffmpeg would need: -f f32le -ar 44100 -ac 1 -i pipe:3 (additional pipe for audio)
import { registerTool } from './index.js';
// ─── Factory ─────────────────────────────────────────────────────
export function createAudioEngine() {
    return {
        currentAmbience: 'peaceful',
        musicState: {
            bpm: 70,
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
    };
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
                note: 'v1 generates audio descriptions (text). PCM audio generation is planned for v2.',
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
}
//# sourceMappingURL=audio-engine.js.map