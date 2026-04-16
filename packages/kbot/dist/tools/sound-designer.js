// kbot Sound Designer — AI-powered synthesizer programming from text descriptions
// "dark 808 with tape distortion" → loads synth + sets all parameters
//
// Tools:
//   design_sound — Parse a text description and program a synth on a track
//
// Requires: AbletonOSC loaded in Ableton Live
import { registerTool } from './index.js';
import { ensureAbleton } from '../integrations/ableton-osc.js';
// ── Helpers ──────────────────────────────────────────────────────────────────
function extractArgs(args) {
    return args.map(a => {
        if (a.type === 'b')
            return '[blob]';
        return a.value;
    });
}
function userTrack(track) {
    const n = Number(track);
    return Math.max(0, n - 1);
}
/**
 * Set a device parameter by name. Fetches the parameter list, finds the index
 * matching `paramName`, then sets by index.
 */
async function setParamByName(osc, track, device, paramName, value) {
    const paramNames = await osc.query('/live/device/get/parameters/name', track, device);
    const names = extractArgs(paramNames).slice(2); // skip track + device idx echo
    const idx = names.findIndex(n => String(n).toLowerCase() === paramName.toLowerCase());
    if (idx === -1)
        return false;
    osc.send('/live/device/set/parameter/value', track, device, idx, value);
    return true;
}
/**
 * Batch-set multiple parameters by name. Returns which ones succeeded/failed.
 */
async function setParamsBatch(osc, track, device, params) {
    // Fetch all parameter names once
    const paramNames = await osc.query('/live/device/get/parameters/name', track, device);
    const names = extractArgs(paramNames).slice(2);
    const nameMap = new Map();
    for (let i = 0; i < names.length; i++) {
        nameMap.set(String(names[i]).toLowerCase(), i);
    }
    const set = [];
    const failed = [];
    for (const [name, value] of Object.entries(params)) {
        const idx = nameMap.get(name.toLowerCase());
        if (idx !== undefined) {
            osc.send('/live/device/set/parameter/value', track, device, idx, value);
            set.push(name);
        }
        else {
            failed.push(name);
        }
    }
    return { set, failed };
}
// ── Sound Recipes ────────────────────────────────────────────────────────────
// Each recipe maps to a synth + parameter settings. Parameter names match
// Ableton's exposed parameter names through AbletonOSC.
const SOUND_RECIPES = {
    // ─── 808 Bass ──────────────────────────────────────────────────────────
    '808_basic': {
        synth: 'Operator',
        params: {
            'Osc-A Wave': 0, // Sine
            'Osc-A Level': 1.0,
            'Osc-A Coarse': 0,
            'Algorithm': 0, // Single carrier
            'Ae Attack': 0,
            'Ae Decay': 3.0,
            'Ae Sustain': 0,
            'Ae Release': 0.5,
            'Osc-B On': 0,
            'Osc-C On': 0,
            'Osc-D On': 0,
            'Volume': 0.85,
        },
        description: 'Pure sine 808 sub bass — clean, round, deep',
    },
    '808_dirty': {
        synth: 'Operator',
        params: {
            'Osc-A Wave': 0, // Sine
            'Osc-A Level': 1.0,
            'Algorithm': 2, // B modulates A
            'Osc-B On': 1,
            'Osc-B Wave': 0, // Sine
            'Osc-B Level': 0.35,
            'Osc-B Coarse': 1,
            'Be Decay': 0.8,
            'Be Sustain': 0,
            'Ae Attack': 0,
            'Ae Decay': 2.5,
            'Ae Sustain': 0,
            'Ae Release': 0.4,
            'Osc-C On': 0,
            'Osc-D On': 0,
            'Volume': 0.85,
        },
        description: 'Dirty/dark 808 — FM distortion on the attack, gritty harmonics',
        effects: [{
                name: 'Saturator',
                params: { 'Drive': 12, 'Type': 2, 'Output': -3, 'Dry/Wet': 0.6 },
            }],
    },
    '808_slide': {
        synth: 'Operator',
        params: {
            'Osc-A Wave': 0,
            'Osc-A Level': 1.0,
            'Algorithm': 0,
            'Ae Attack': 0,
            'Ae Decay': 3.5,
            'Ae Sustain': 0.15,
            'Ae Release': 0.8,
            'Osc-B On': 0,
            'Osc-C On': 0,
            'Osc-D On': 0,
            'Glide Time': 0.15,
            'Volume': 0.85,
        },
        description: '808 with glide/portamento for slides between notes',
    },
    '808_hardclip': {
        synth: 'Operator',
        params: {
            'Osc-A Wave': 0,
            'Osc-A Level': 1.0,
            'Algorithm': 0,
            'Ae Attack': 0,
            'Ae Decay': 2.0,
            'Ae Sustain': 0,
            'Ae Release': 0.3,
            'Osc-B On': 0,
            'Osc-C On': 0,
            'Osc-D On': 0,
            'Volume': 1.0,
        },
        description: 'Hard-clipped 808 — slammed into a limiter for aggressive punch',
        effects: [{
                name: 'Saturator',
                params: { 'Drive': 20, 'Type': 4, 'Output': -6, 'Dry/Wet': 1.0 },
            }],
    },
    // ─── Sub Bass ──────────────────────────────────────────────────────────
    'sub_sine': {
        synth: 'Operator',
        params: {
            'Osc-A Wave': 0, // Sine
            'Osc-A Level': 1.0,
            'Algorithm': 0,
            'Ae Attack': 0.01,
            'Ae Decay': 0,
            'Ae Sustain': 1.0,
            'Ae Release': 0.15,
            'Osc-B On': 0,
            'Osc-C On': 0,
            'Osc-D On': 0,
            'Volume': 0.9,
        },
        description: 'Pure sine sub bass — sustained, fundamental-only',
    },
    'sub_triangle': {
        synth: 'Analog',
        params: {
            'Osc1 Shape': 0.0, // Triangle
            'Osc1 Octave': -1,
            'Osc1 Level': 1.0,
            'Osc2 On/Off': 0,
            'F1 Freq': 200,
            'F1 Res': 0.1,
            'F1 Type': 0, // LP
            'Amp1 Attack': 0.01,
            'Amp1 Decay': 0,
            'Amp1 Sustain': 1.0,
            'Amp1 Release': 0.15,
            'Volume': 0.9,
        },
        description: 'Triangle sub bass — slightly more overtones than sine',
    },
    'sub_warm': {
        synth: 'Analog',
        params: {
            'Osc1 Shape': 0.5, // Saw-ish
            'Osc1 Octave': -1,
            'Osc1 Level': 1.0,
            'Osc2 On/Off': 0,
            'F1 Freq': 120,
            'F1 Res': 0.2,
            'F1 Type': 0, // LP
            'Amp1 Attack': 0.02,
            'Amp1 Decay': 0.3,
            'Amp1 Sustain': 0.85,
            'Amp1 Release': 0.2,
            'Volume': 0.85,
        },
        description: 'Warm sub bass — filtered saw, round low end',
    },
    // ─── Leads ─────────────────────────────────────────────────────────────
    'dark_bell': {
        synth: 'Operator',
        params: {
            'Algorithm': 4, // FM: B→A, D→C
            'Osc-A Wave': 0, // Sine
            'Osc-A Level': 1.0,
            'Osc-B On': 1,
            'Osc-B Wave': 0,
            'Osc-B Level': 0.5,
            'Osc-B Coarse': 3.5, // Inharmonic ratio
            'Osc-B Fine': 0.07,
            'Be Attack': 0,
            'Be Decay': 2.0,
            'Be Sustain': 0,
            'Ae Attack': 0,
            'Ae Decay': 3.0,
            'Ae Sustain': 0,
            'Ae Release': 1.0,
            'Osc-C On': 0,
            'Osc-D On': 0,
            'Volume': 0.7,
        },
        description: 'Dark FM bell — inharmonic ratios, metallic decay',
    },
    'bright_lead': {
        synth: 'Analog',
        params: {
            'Osc1 Shape': 1.0, // Saw
            'Osc1 Octave': 0,
            'Osc1 Level': 0.8,
            'Osc2 On/Off': 1,
            'Osc2 Shape': 1.0, // Saw
            'Osc2 Octave': 0,
            'Osc2 Level': 0.8,
            'Osc2 Detune': 0.12,
            'F1 Freq': 3500,
            'F1 Res': 0.3,
            'F1 Type': 0, // LP
            'FE1 Attack': 0.01,
            'FE1 Decay': 0.3,
            'FE1 Sustain': 0.5,
            'FE1 Amount': 0.4,
            'Amp1 Attack': 0.01,
            'Amp1 Decay': 0,
            'Amp1 Sustain': 0.9,
            'Amp1 Release': 0.15,
            'Volume': 0.75,
        },
        description: 'Bright detuned saw lead — punchy, present, slightly wide',
    },
    'acid_lead': {
        synth: 'Analog',
        params: {
            'Osc1 Shape': 1.0, // Saw
            'Osc1 Octave': 0,
            'Osc1 Level': 1.0,
            'Osc2 On/Off': 0,
            'F1 Freq': 800,
            'F1 Res': 0.7, // High resonance = acid squelch
            'F1 Type': 0, // LP
            'FE1 Attack': 0.001,
            'FE1 Decay': 0.25,
            'FE1 Sustain': 0,
            'FE1 Amount': 0.8, // Heavy filter envelope
            'Amp1 Attack': 0.001,
            'Amp1 Decay': 0.3,
            'Amp1 Sustain': 0,
            'Amp1 Release': 0.1,
            'Volume': 0.75,
        },
        description: 'Acid lead — resonant filter sweep, 303-style squelch',
    },
    'supersaw_lead': {
        synth: 'Wavetable',
        params: {
            'Osc 1 Pos': 0.8, // Saw-like position
            'Osc 1 Effect Type': 1, // FM
            'Osc 1 Effect Amount': 0.3,
            'Sub On': 1,
            'Sub Gain': -12,
            'Sub Tone': 0.5,
            'Filter Type': 0, // LP
            'Filter Freq': 5000,
            'Filter Res': 0.15,
            'Amp Attack': 0.01,
            'Amp Decay': 0,
            'Amp Sustain': 1.0,
            'Amp Release': 0.2,
            'Unison Amount': 0.5,
            'Unison Voices': 4,
            'Volume': 0.75,
        },
        description: 'Supersaw lead — wide unison, thick and full',
    },
    // ─── Pads ──────────────────────────────────────────────────────────────
    'dark_pad': {
        synth: 'Drift',
        params: {
            'Osc Shape': 0.6, // Between triangle and saw
            'Drift Amount': 0.4, // Analog drift
            'Filter Freq': 600,
            'Filter Res': 0.15,
            'Filter Type': 0, // LP
            'Amp Attack': 1.5,
            'Amp Decay': 2.0,
            'Amp Sustain': 0.6,
            'Amp Release': 2.0,
            'LFO Rate': 0.3,
            'LFO Amount': 0.15,
            'Volume': 0.7,
        },
        description: 'Dark ambient pad — slow drift, filtered, brooding',
    },
    'warm_pad': {
        synth: 'Analog',
        params: {
            'Osc1 Shape': 1.0, // Saw
            'Osc1 Octave': 0,
            'Osc1 Level': 0.7,
            'Osc2 On/Off': 1,
            'Osc2 Shape': 1.0, // Saw
            'Osc2 Octave': 0,
            'Osc2 Level': 0.7,
            'Osc2 Detune': 0.08,
            'F1 Freq': 1500,
            'F1 Res': 0.1,
            'F1 Type': 0, // LP
            'Amp1 Attack': 0.8,
            'Amp1 Decay': 1.0,
            'Amp1 Sustain': 0.7,
            'Amp1 Release': 1.5,
            'Volume': 0.7,
        },
        description: 'Warm pad — detuned saws, low-pass filtered, lush',
    },
    'ambient_pad': {
        synth: 'Wavetable',
        params: {
            'Osc 1 Pos': 0.4,
            'Osc 1 Effect Type': 2, // Classic
            'Osc 1 Effect Amount': 0.2,
            'Filter Type': 0, // LP
            'Filter Freq': 2000,
            'Filter Res': 0.1,
            'Amp Attack': 2.5,
            'Amp Decay': 3.0,
            'Amp Sustain': 0.5,
            'Amp Release': 4.0,
            'Mod Amount A': 0.2, // Slow modulation
            'Volume': 0.65,
        },
        description: 'Ambient pad — evolving wavetable, very slow attack, spacious',
        effects: [{
                name: 'Reverb',
                params: { 'Decay Time': 6.0, 'Room Size': 0.8, 'Dry/Wet': 0.5 },
            }],
    },
    'shimmer_pad': {
        synth: 'Wavetable',
        params: {
            'Osc 1 Pos': 0.6,
            'Osc 1 Effect Type': 1, // FM
            'Osc 1 Effect Amount': 0.15,
            'Filter Type': 1, // HP
            'Filter Freq': 800,
            'Filter Res': 0.2,
            'Amp Attack': 1.5,
            'Amp Decay': 2.0,
            'Amp Sustain': 0.6,
            'Amp Release': 3.5,
            'Unison Amount': 0.4,
            'Unison Voices': 3,
            'Volume': 0.6,
        },
        description: 'Shimmer pad — bright, airy, high-pass filtered with unison spread',
        effects: [
            { name: 'Chorus', params: { 'Rate 1': 0.5, 'Amount 1': 0.3, 'Dry/Wet': 0.4 } },
            { name: 'Reverb', params: { 'Decay Time': 5.0, 'Room Size': 0.85, 'Dry/Wet': 0.45 } },
        ],
    },
    'strings_pad': {
        synth: 'Analog',
        params: {
            'Osc1 Shape': 1.0, // Saw
            'Osc1 Octave': 0,
            'Osc1 Level': 0.6,
            'Osc2 On/Off': 1,
            'Osc2 Shape': 1.0, // Saw
            'Osc2 Octave': 1,
            'Osc2 Level': 0.4,
            'Osc2 Detune': 0.06,
            'F1 Freq': 2500,
            'F1 Res': 0.05,
            'F1 Type': 0, // LP
            'Amp1 Attack': 0.6,
            'Amp1 Decay': 0.5,
            'Amp1 Sustain': 0.8,
            'Amp1 Release': 1.0,
            'Volume': 0.7,
        },
        description: 'String ensemble pad — layered octave saws, gentle filter',
        effects: [{
                name: 'Chorus',
                params: { 'Rate 1': 0.8, 'Amount 1': 0.25, 'Dry/Wet': 0.35 },
            }],
    },
    // ─── Keys ──────────────────────────────────────────────────────────────
    'rhodes': {
        synth: 'Electric',
        params: {
            'M Stiffness': 0.4,
            'M Force': 0.5,
            'F Tine Color': 0.5,
            'F Tine Decay': 0.6,
            'F Tine Vol': 0.8,
            'F Tone Color': 0.4,
            'F Tone Decay': 0.5,
            'F Tone Vol': 0.6,
            'P Pickup Sym': 0.5,
            'P Pickup Dist': 0.3,
            'Damper On': 1,
            'D Damper Tone': 0.5,
            'Volume': 0.75,
        },
        description: 'Rhodes electric piano — warm, magnetic pickup, classic tone',
    },
    'wurlitzer': {
        synth: 'Electric',
        params: {
            'M Stiffness': 0.55,
            'M Force': 0.6,
            'F Tine Color': 0.65,
            'F Tine Decay': 0.5,
            'F Tine Vol': 0.7,
            'F Tone Color': 0.6,
            'F Tone Decay': 0.4,
            'F Tone Vol': 0.5,
            'P Pickup Sym': 0.6,
            'P Pickup Dist': 0.4,
            'Damper On': 1,
            'D Damper Tone': 0.6,
            'Volume': 0.75,
        },
        description: 'Wurlitzer — brighter, more bark, piezo-style character',
    },
    'organ': {
        synth: 'Operator',
        params: {
            'Algorithm': 10, // Additive — all carriers
            'Osc-A Wave': 0, // Sine
            'Osc-A Level': 1.0,
            'Osc-A Coarse': 0, // 8 foot
            'Osc-B On': 1,
            'Osc-B Wave': 0,
            'Osc-B Level': 0.7,
            'Osc-B Coarse': 12, // 4 foot
            'Osc-C On': 1,
            'Osc-C Wave': 0,
            'Osc-C Level': 0.5,
            'Osc-C Coarse': 19, // 2 2/3 foot
            'Osc-D On': 1,
            'Osc-D Wave': 0,
            'Osc-D Level': 0.4,
            'Osc-D Coarse': 24, // 2 foot
            'Ae Attack': 0.005,
            'Ae Decay': 0,
            'Ae Sustain': 1.0,
            'Ae Release': 0.08,
            'Volume': 0.7,
        },
        description: 'Organ — additive sine drawbars (8\', 4\', 2 2/3\', 2\')',
    },
    // ─── Plucks ────────────────────────────────────────────────────────────
    'pluck_acoustic': {
        synth: 'Wavetable',
        params: {
            'Osc 1 Pos': 0.3,
            'Filter Type': 0, // LP
            'Filter Freq': 4000,
            'Filter Res': 0.1,
            'Fe Attack': 0,
            'Fe Decay': 0.15,
            'Fe Sustain': 0,
            'Fe Amount': 0.5,
            'Amp Attack': 0.001,
            'Amp Decay': 0.4,
            'Amp Sustain': 0,
            'Amp Release': 0.2,
            'Volume': 0.75,
        },
        description: 'Acoustic pluck — short filter envelope, natural decay',
    },
    'pluck_digital': {
        synth: 'Wavetable',
        params: {
            'Osc 1 Pos': 0.7, // Digital/harmonic-rich position
            'Osc 1 Effect Type': 1, // FM
            'Osc 1 Effect Amount': 0.25,
            'Filter Type': 0, // LP
            'Filter Freq': 6000,
            'Filter Res': 0.2,
            'Fe Attack': 0,
            'Fe Decay': 0.1,
            'Fe Sustain': 0,
            'Fe Amount': 0.6,
            'Amp Attack': 0,
            'Amp Decay': 0.3,
            'Amp Sustain': 0,
            'Amp Release': 0.15,
            'Volume': 0.7,
        },
        description: 'Digital pluck — FM-modulated wavetable, crisp and synthetic',
    },
    'pluck_metallic': {
        synth: 'Operator',
        params: {
            'Algorithm': 2,
            'Osc-A Wave': 0,
            'Osc-A Level': 1.0,
            'Osc-B On': 1,
            'Osc-B Wave': 0,
            'Osc-B Level': 0.6,
            'Osc-B Coarse': 7, // Inharmonic
            'Osc-B Fine': 0.03,
            'Be Attack': 0,
            'Be Decay': 0.08,
            'Be Sustain': 0,
            'Ae Attack': 0,
            'Ae Decay': 0.5,
            'Ae Sustain': 0,
            'Ae Release': 0.3,
            'Osc-C On': 0,
            'Osc-D On': 0,
            'Volume': 0.7,
        },
        description: 'Metallic pluck — inharmonic FM, bell-like attack, short decay',
    },
    // ─── Drift (analog-modeled synth) ───────────────────────────────────────
    'drift_dark_bass': {
        synth: 'Drift',
        params: {
            'Osc 1 Shape': 0.8, // Near-saw, harmonically rich
            'Osc 2 On': 1,
            'Osc 2 Shape': 0.6,
            'Osc 2 Detune': 0.05,
            'Osc 2 Level': 0.7,
            'Filter Freq': 300,
            'Filter Res': 0.25,
            'Filter Drive': 0.4,
            'Filter Type': 0, // LP
            'Drift Amount': 0.3,
            'LFO Rate': 0.4,
            'LFO Amount': 0.1,
            'LFO Dest': 0, // Filter
            'Amp Attack': 0.005,
            'Amp Decay': 0.4,
            'Amp Sustain': 0.8,
            'Amp Release': 0.2,
            'Volume': 0.85,
        },
        description: 'Dark Drift bass — filtered saw with analog drift and subtle movement',
    },
    'drift_warm_bass': {
        synth: 'Drift',
        params: {
            'Osc 1 Shape': 0.4, // Between triangle and saw
            'Osc 2 On': 1,
            'Osc 2 Shape': 0.3,
            'Osc 2 Detune': 0.08,
            'Osc 2 Level': 0.6,
            'Filter Freq': 500,
            'Filter Res': 0.15,
            'Filter Drive': 0.2,
            'Filter Type': 0, // LP
            'Drift Amount': 0.5,
            'LFO Rate': 0.2,
            'LFO Amount': 0.08,
            'LFO Dest': 0, // Filter
            'Amp Attack': 0.01,
            'Amp Decay': 0.3,
            'Amp Sustain': 0.85,
            'Amp Release': 0.25,
            'Volume': 0.85,
        },
        description: 'Warm Drift bass — round and fat, gentle analog drift',
    },
    'drift_analog_lead': {
        synth: 'Drift',
        params: {
            'Osc 1 Shape': 1.0, // Full saw
            'Osc 2 On': 1,
            'Osc 2 Shape': 0.9,
            'Osc 2 Detune': 0.12,
            'Osc 2 Level': 0.8,
            'Filter Freq': 2500,
            'Filter Res': 0.35,
            'Filter Drive': 0.3,
            'Filter Type': 0, // LP
            'Drift Amount': 0.25,
            'LFO Rate': 3.0,
            'LFO Amount': 0.05,
            'LFO Dest': 0, // Filter
            'Amp Attack': 0.01,
            'Amp Decay': 0.2,
            'Amp Sustain': 0.85,
            'Amp Release': 0.15,
            'Volume': 0.75,
        },
        description: 'Analog Drift lead — detuned saws, resonant filter, vintage character',
    },
    'drift_lo_fi': {
        synth: 'Drift',
        params: {
            'Osc 1 Shape': 0.5,
            'Osc 2 On': 0,
            'Filter Freq': 1200,
            'Filter Res': 0.1,
            'Filter Drive': 0.6, // Drive for lo-fi saturation
            'Filter Type': 0, // LP
            'Drift Amount': 0.7, // Heavy drift for wobble
            'LFO Rate': 0.15,
            'LFO Amount': 0.2,
            'LFO Dest': 0, // Filter
            'Amp Attack': 0.01,
            'Amp Decay': 0.5,
            'Amp Sustain': 0.6,
            'Amp Release': 0.3,
            'Volume': 0.7,
        },
        description: 'Lo-fi Drift — heavy drift, filter drive, warped and vintage',
        effects: [{
                name: 'Saturator',
                params: { 'Drive': 8, 'Type': 1, 'Output': -3, 'Dry/Wet': 0.4 },
            }],
    },
    'drift_ethereal_pad': {
        synth: 'Drift',
        params: {
            'Osc 1 Shape': 0.3, // Soft, triangle-ish
            'Osc 2 On': 1,
            'Osc 2 Shape': 0.2,
            'Osc 2 Detune': 0.15,
            'Osc 2 Level': 0.6,
            'Filter Freq': 1800,
            'Filter Res': 0.2,
            'Filter Drive': 0.1,
            'Filter Type': 0, // LP
            'Drift Amount': 0.6, // High drift for organic movement
            'LFO Rate': 0.1,
            'LFO Amount': 0.25,
            'LFO Dest': 0, // Filter
            'Amp Attack': 2.0,
            'Amp Decay': 2.5,
            'Amp Sustain': 0.5,
            'Amp Release': 3.0,
            'Volume': 0.65,
        },
        description: 'Ethereal Drift pad — slow, drifting, organic and alive',
        effects: [{
                name: 'Reverb',
                params: { 'Decay Time': 5.0, 'Room Size': 0.85, 'Dry/Wet': 0.45 },
            }],
    },
    // ─── Meld (MPE-capable bi-timbral synth) ──────────────────────────────
    'meld_bright_pad': {
        synth: 'Meld',
        params: {
            'Engine 1 Type': 0, // Harmonic engine
            'Engine 1 Brightness': 0.7,
            'Engine 1 Color': 0.6,
            'Engine 1 Level': 0.8,
            'Engine 2 On': 1,
            'Engine 2 Type': 0, // Harmonic engine
            'Engine 2 Brightness': 0.8,
            'Engine 2 Color': 0.4,
            'Engine 2 Level': 0.6,
            'Filter Type': 0, // LP
            'Filter Freq': 4000,
            'Filter Res': 0.15,
            'Amp Attack': 1.0,
            'Amp Decay': 1.5,
            'Amp Sustain': 0.7,
            'Amp Release': 2.5,
            'Volume': 0.7,
        },
        description: 'Bright Meld pad — dual harmonic engines, open and airy',
        effects: [{
                name: 'Chorus',
                params: { 'Rate 1': 0.4, 'Amount 1': 0.25, 'Dry/Wet': 0.3 },
            }],
    },
    'meld_dark_pad': {
        synth: 'Meld',
        params: {
            'Engine 1 Type': 1, // Noise engine
            'Engine 1 Brightness': 0.2,
            'Engine 1 Color': 0.3,
            'Engine 1 Level': 0.7,
            'Engine 2 On': 1,
            'Engine 2 Type': 0, // Harmonic engine
            'Engine 2 Brightness': 0.2,
            'Engine 2 Color': 0.5,
            'Engine 2 Level': 0.8,
            'Filter Type': 0, // LP
            'Filter Freq': 600,
            'Filter Res': 0.2,
            'Amp Attack': 1.5,
            'Amp Decay': 2.0,
            'Amp Sustain': 0.6,
            'Amp Release': 2.5,
            'Volume': 0.7,
        },
        description: 'Dark Meld pad — noise + harmonic blend, moody and textured',
    },
    'meld_fm_bass': {
        synth: 'Meld',
        params: {
            'Engine 1 Type': 2, // FM engine
            'Engine 1 Brightness': 0.4,
            'Engine 1 Color': 0.6,
            'Engine 1 Level': 1.0,
            'Engine 2 On': 0,
            'Filter Type': 0, // LP
            'Filter Freq': 450,
            'Filter Res': 0.3,
            'Amp Attack': 0.005,
            'Amp Decay': 0.5,
            'Amp Sustain': 0.7,
            'Amp Release': 0.2,
            'Volume': 0.85,
        },
        description: 'Meld FM bass — single FM engine, warm and punchy low end',
    },
    'meld_harmonic_lead': {
        synth: 'Meld',
        params: {
            'Engine 1 Type': 0, // Harmonic engine
            'Engine 1 Brightness': 0.6,
            'Engine 1 Color': 0.7,
            'Engine 1 Level': 1.0,
            'Engine 2 On': 1,
            'Engine 2 Type': 2, // FM engine
            'Engine 2 Brightness': 0.5,
            'Engine 2 Color': 0.5,
            'Engine 2 Level': 0.4,
            'Filter Type': 0, // LP
            'Filter Freq': 3500,
            'Filter Res': 0.25,
            'Amp Attack': 0.01,
            'Amp Decay': 0.3,
            'Amp Sustain': 0.85,
            'Amp Release': 0.15,
            'Volume': 0.75,
        },
        description: 'Meld harmonic lead — bright harmonic engine with FM shimmer',
    },
    'meld_noise_texture': {
        synth: 'Meld',
        params: {
            'Engine 1 Type': 1, // Noise engine
            'Engine 1 Brightness': 0.5,
            'Engine 1 Color': 0.4,
            'Engine 1 Level': 0.8,
            'Engine 2 On': 1,
            'Engine 2 Type': 1, // Noise engine
            'Engine 2 Brightness': 0.6,
            'Engine 2 Color': 0.7,
            'Engine 2 Level': 0.6,
            'Filter Type': 1, // HP
            'Filter Freq': 500,
            'Filter Res': 0.15,
            'Amp Attack': 2.0,
            'Amp Decay': 3.0,
            'Amp Sustain': 0.4,
            'Amp Release': 3.5,
            'Volume': 0.6,
        },
        description: 'Meld noise texture — dual noise engines, evolving ambient atmosphere',
        effects: [{
                name: 'Reverb',
                params: { 'Decay Time': 6.0, 'Room Size': 0.9, 'Dry/Wet': 0.55 },
            }],
    },
    // ─── FX ────────────────────────────────────────────────────────────────
    'fx_riser': {
        synth: 'Wavetable',
        params: {
            'Osc 1 Pos': 0.5,
            'Osc 1 Effect Type': 2, // Classic
            'Osc 1 Effect Amount': 0.3,
            'Filter Type': 0, // LP
            'Filter Freq': 200,
            'Filter Res': 0.3,
            'Fe Attack': 4.0, // Slow filter open = riser
            'Fe Decay': 0,
            'Fe Sustain': 1.0,
            'Fe Amount': 0.9,
            'Amp Attack': 0.5,
            'Amp Decay': 0,
            'Amp Sustain': 1.0,
            'Amp Release': 0.3,
            'Unison Amount': 0.6,
            'Unison Voices': 4,
            'Volume': 0.7,
        },
        description: 'Riser — slow filter sweep upward, building tension',
    },
    'fx_noise_sweep': {
        synth: 'Operator',
        params: {
            'Algorithm': 0,
            'Osc-A Wave': 5, // Noise
            'Osc-A Level': 1.0,
            'Ae Attack': 2.0,
            'Ae Decay': 3.0,
            'Ae Sustain': 0,
            'Ae Release': 1.0,
            'Filter On': 1,
            'Filter Freq': 400,
            'Filter Res': 0.4,
            'Fe Attack': 3.0,
            'Fe Decay': 0,
            'Fe Sustain': 1.0,
            'Fe Amount': 0.8,
            'Osc-B On': 0,
            'Osc-C On': 0,
            'Osc-D On': 0,
            'Volume': 0.6,
        },
        description: 'Noise sweep — filtered noise rising and fading, transition FX',
    },
    'fx_impact': {
        synth: 'Operator',
        params: {
            'Algorithm': 2,
            'Osc-A Wave': 0, // Sine
            'Osc-A Level': 1.0,
            'Osc-A Coarse': -12, // Very low
            'Osc-B On': 1,
            'Osc-B Wave': 5, // Noise
            'Osc-B Level': 0.7,
            'Be Attack': 0,
            'Be Decay': 0.05,
            'Be Sustain': 0,
            'Ae Attack': 0,
            'Ae Decay': 1.5,
            'Ae Sustain': 0,
            'Ae Release': 0.5,
            'Osc-C On': 0,
            'Osc-D On': 0,
            'Volume': 0.85,
        },
        description: 'Impact — low boom + noise burst, cinematic hit',
        effects: [{
                name: 'Reverb',
                params: { 'Decay Time': 3.0, 'Room Size': 0.7, 'Dry/Wet': 0.35 },
            }],
    },
};
// ── Keyword Matching Rules ───────────────────────────────────────────────────
// Ordered by specificity — first match wins. More specific patterns first.
const MATCH_RULES = [
    // 808 variants (most specific first)
    { keywords: ['808', 'slide', 'glide'], recipe: '808_slide' },
    { keywords: ['808', 'hard', 'clip'], recipe: '808_hardclip' },
    { keywords: ['808', 'clip'], recipe: '808_hardclip' },
    { keywords: ['808', 'dirty'], recipe: '808_dirty' },
    { keywords: ['808', 'dark'], recipe: '808_dirty' },
    { keywords: ['808', 'distort'], recipe: '808_dirty' },
    { keywords: ['808', 'tape'], recipe: '808_dirty' },
    { keywords: ['808', 'grit'], recipe: '808_dirty' },
    { keywords: ['808', 'saturate'], recipe: '808_dirty' },
    { keywords: ['808', 'clean'], recipe: '808_basic' },
    { keywords: ['808', 'sub'], recipe: '808_basic' },
    { keywords: ['808', 'pure'], recipe: '808_basic' },
    { keywords: ['808'], recipe: '808_basic' },
    // Sub bass
    { keywords: ['sub', 'warm'], recipe: 'sub_warm' },
    { keywords: ['sub', 'triangle'], recipe: 'sub_triangle' },
    { keywords: ['sub', 'tri'], recipe: 'sub_triangle' },
    { keywords: ['sub', 'sine'], recipe: 'sub_sine' },
    { keywords: ['sub', 'bass'], recipe: 'sub_sine' },
    { keywords: ['sub'], recipe: 'sub_sine' },
    // Leads
    { keywords: ['acid'], recipe: 'acid_lead' },
    { keywords: ['303'], recipe: 'acid_lead' },
    { keywords: ['supersaw'], recipe: 'supersaw_lead' },
    { keywords: ['super', 'saw'], recipe: 'supersaw_lead' },
    { keywords: ['bell', 'dark'], recipe: 'dark_bell' },
    { keywords: ['bell', 'metal'], recipe: 'dark_bell' },
    { keywords: ['bell'], recipe: 'dark_bell' },
    { keywords: ['lead', 'bright'], recipe: 'bright_lead' },
    { keywords: ['lead', 'saw'], recipe: 'bright_lead' },
    { keywords: ['lead', 'dark'], recipe: 'acid_lead' },
    { keywords: ['lead', 'acid'], recipe: 'acid_lead' },
    { keywords: ['lead'], recipe: 'bright_lead' },
    // Pads
    { keywords: ['pad', 'shimmer'], recipe: 'shimmer_pad' },
    { keywords: ['pad', 'sparkle'], recipe: 'shimmer_pad' },
    { keywords: ['pad', 'bright'], recipe: 'shimmer_pad' },
    { keywords: ['pad', 'string'], recipe: 'strings_pad' },
    { keywords: ['pad', 'ensemble'], recipe: 'strings_pad' },
    { keywords: ['pad', 'ambient'], recipe: 'ambient_pad' },
    { keywords: ['pad', 'evolve'], recipe: 'ambient_pad' },
    { keywords: ['pad', 'space'], recipe: 'ambient_pad' },
    { keywords: ['pad', 'warm'], recipe: 'warm_pad' },
    { keywords: ['pad', 'lush'], recipe: 'warm_pad' },
    { keywords: ['pad', 'dark'], recipe: 'dark_pad' },
    { keywords: ['pad', 'moody'], recipe: 'dark_pad' },
    { keywords: ['pad'], recipe: 'warm_pad' },
    { keywords: ['string'], recipe: 'strings_pad' },
    { keywords: ['ambient'], recipe: 'ambient_pad' },
    // Keys
    { keywords: ['rhodes'], recipe: 'rhodes' },
    { keywords: ['wurlitzer'], recipe: 'wurlitzer' },
    { keywords: ['wurli'], recipe: 'wurlitzer' },
    { keywords: ['organ'], recipe: 'organ' },
    { keywords: ['electric', 'piano'], recipe: 'rhodes' },
    { keywords: ['ep'], recipe: 'rhodes' },
    { keywords: ['keys', 'warm'], recipe: 'rhodes' },
    { keywords: ['keys', 'bright'], recipe: 'wurlitzer' },
    { keywords: ['keys'], recipe: 'rhodes' },
    { keywords: ['piano'], recipe: 'rhodes' },
    // Plucks
    { keywords: ['pluck', 'metal'], recipe: 'pluck_metallic' },
    { keywords: ['pluck', 'digital'], recipe: 'pluck_digital' },
    { keywords: ['pluck', 'synth'], recipe: 'pluck_digital' },
    { keywords: ['pluck', 'acoustic'], recipe: 'pluck_acoustic' },
    { keywords: ['pluck', 'natural'], recipe: 'pluck_acoustic' },
    { keywords: ['pluck'], recipe: 'pluck_acoustic' },
    // Drift synth
    { keywords: ['drift', 'bass', 'dark'], recipe: 'drift_dark_bass' },
    { keywords: ['drift', 'bass', 'warm'], recipe: 'drift_warm_bass' },
    { keywords: ['drift', 'bass'], recipe: 'drift_dark_bass' },
    { keywords: ['drift', 'lead'], recipe: 'drift_analog_lead' },
    { keywords: ['drift', 'lo', 'fi'], recipe: 'drift_lo_fi' },
    { keywords: ['drift', 'lofi'], recipe: 'drift_lo_fi' },
    { keywords: ['drift', 'pad', 'dark'], recipe: 'dark_pad' },
    { keywords: ['drift', 'pad', 'ethereal'], recipe: 'drift_ethereal_pad' },
    { keywords: ['drift', 'pad'], recipe: 'drift_ethereal_pad' },
    { keywords: ['drift', 'analog'], recipe: 'drift_analog_lead' },
    { keywords: ['drift'], recipe: 'drift_dark_bass' },
    // Meld synth
    { keywords: ['meld', 'pad', 'bright'], recipe: 'meld_bright_pad' },
    { keywords: ['meld', 'pad', 'dark'], recipe: 'meld_dark_pad' },
    { keywords: ['meld', 'pad'], recipe: 'meld_bright_pad' },
    { keywords: ['meld', 'bass'], recipe: 'meld_fm_bass' },
    { keywords: ['meld', 'fm'], recipe: 'meld_fm_bass' },
    { keywords: ['meld', 'lead'], recipe: 'meld_harmonic_lead' },
    { keywords: ['meld', 'harmonic'], recipe: 'meld_harmonic_lead' },
    { keywords: ['meld', 'noise'], recipe: 'meld_noise_texture' },
    { keywords: ['meld', 'texture'], recipe: 'meld_noise_texture' },
    { keywords: ['meld', 'ambient'], recipe: 'meld_noise_texture' },
    { keywords: ['meld', 'bright'], recipe: 'meld_bright_pad' },
    { keywords: ['meld', 'dark'], recipe: 'meld_dark_pad' },
    { keywords: ['meld'], recipe: 'meld_bright_pad' },
    // FX
    { keywords: ['riser'], recipe: 'fx_riser' },
    { keywords: ['rise'], recipe: 'fx_riser' },
    { keywords: ['build', 'up'], recipe: 'fx_riser' },
    { keywords: ['sweep', 'noise'], recipe: 'fx_noise_sweep' },
    { keywords: ['noise', 'sweep'], recipe: 'fx_noise_sweep' },
    { keywords: ['whoosh'], recipe: 'fx_noise_sweep' },
    { keywords: ['impact'], recipe: 'fx_impact' },
    { keywords: ['hit'], recipe: 'fx_impact' },
    { keywords: ['boom'], recipe: 'fx_impact' },
];
// Map user-facing synth names to Ableton instrument names
const SYNTH_NAME_MAP = {
    'operator': 'Operator',
    'wavetable': 'Wavetable',
    'drift': 'Drift',
    'analog': 'Analog',
    'electric': 'Electric',
    'meld': 'Meld',
    'serum2': 'Serum 2',
    'serum': 'Serum 2',
    'vital': 'Vital',
};
// ── Matching Engine ──────────────────────────────────────────────────────────
/**
 * Normalize a description into lowercase tokens with stemming-like suffix stripping.
 */
function tokenize(description) {
    return description
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(Boolean)
        .flatMap(token => {
        // Also include stemmed variants for fuzzy matching
        const stems = [token];
        if (token.endsWith('ed'))
            stems.push(token.slice(0, -2));
        if (token.endsWith('ing'))
            stems.push(token.slice(0, -3));
        if (token.endsWith('tion'))
            stems.push(token.slice(0, -4));
        if (token.endsWith('ly'))
            stems.push(token.slice(0, -2));
        if (token.endsWith('y'))
            stems.push(token.slice(0, -1));
        return stems;
    });
}
/**
 * Match a description against the rules. Returns the best recipe key or null.
 */
function matchDescription(description) {
    const tokens = tokenize(description);
    const tokenSet = new Set(tokens);
    for (const rule of MATCH_RULES) {
        const allMatch = rule.keywords.every(kw => {
            // Check if any token starts with the keyword (prefix match for stemming)
            return tokenSet.has(kw) || tokens.some(t => t.startsWith(kw));
        });
        if (!allMatch)
            continue;
        if (rule.exclude) {
            const excluded = rule.exclude.some(kw => tokenSet.has(kw) || tokens.some(t => t.startsWith(kw)));
            if (excluded)
                continue;
        }
        return rule.recipe;
    }
    return null;
}
// ── Tool Registration ────────────────────────────────────────────────────────
export function registerSoundDesignerTools() {
    registerTool({
        name: 'design_sound',
        description: 'AI Sound Designer — program a synthesizer from a text description. ' +
            'Describe the sound you want (e.g. "dark 808 with tape distortion", "warm shimmer pad", ' +
            '"acid lead", "metallic pluck") and this tool loads the right synth and sets all parameters. ' +
            'Supports 808s, sub bass, leads, pads, keys, plucks, and FX. Requires AbletonOSC.',
        parameters: {
            description: {
                type: 'string',
                description: 'Text description of the desired sound (e.g. "dark 808 with tape distortion", "warm lush pad", "acid lead")',
                required: true,
            },
            track: {
                type: 'number',
                description: 'Track number (1-based) to load the synth onto',
                required: true,
            },
            synth: {
                type: 'string',
                description: 'Override synth choice: "operator", "wavetable", "drift", "meld", "analog", "electric", "serum2". If omitted, the best synth is chosen automatically from the recipe.',
            },
        },
        tier: 'free',
        timeout: 30_000,
        async execute(args) {
            const description = String(args.description).trim();
            const t = userTrack(args.track);
            const synthOverride = args.synth ? String(args.synth).toLowerCase() : null;
            if (!description)
                return 'Error: description is required';
            if (isNaN(t) || t < 0)
                return 'Error: valid track number required';
            try {
                const osc = await ensureAbleton();
                // ── 1. Match description to recipe ─────────────────────────────────
                const recipeKey = matchDescription(description);
                if (!recipeKey || !SOUND_RECIPES[recipeKey]) {
                    // List available sound categories to help the user
                    const categories = [
                        '**808 bass**: "808", "dark 808", "808 slide", "808 hard clip"',
                        '**Sub bass**: "sub bass", "warm sub", "triangle sub"',
                        '**Leads**: "bright lead", "acid lead", "supersaw", "dark bell", "drift lead", "meld lead"',
                        '**Pads**: "dark pad", "warm pad", "ambient pad", "shimmer pad", "string pad", "drift pad", "meld pad"',
                        '**Drift synth**: "drift bass", "drift lead", "drift lo-fi", "drift pad"',
                        '**Meld synth**: "meld pad", "meld bass", "meld lead", "meld noise texture"',
                        '**Keys**: "rhodes", "wurlitzer", "organ", "electric piano"',
                        '**Plucks**: "pluck", "digital pluck", "metallic pluck"',
                        '**FX**: "riser", "noise sweep", "impact"',
                    ];
                    return [
                        `Could not match "${description}" to a sound recipe.`,
                        '',
                        'Try describing your sound with these keywords:',
                        ...categories.map(c => `- ${c}`),
                    ].join('\n');
                }
                const recipe = SOUND_RECIPES[recipeKey];
                // ── 2. Determine synth to load ─────────────────────────────────────
                let synthName = recipe.synth;
                if (synthOverride) {
                    synthName = SYNTH_NAME_MAP[synthOverride] || synthOverride;
                }
                // ── 3. Load the synth ──────────────────────────────────────────────
                const loadResult = await osc.query('/live/kbot/load_plugin', t, synthName, '');
                const loadStatus = extractArgs(loadResult);
                if (loadStatus[0] !== 'ok') {
                    // Fallback: try with name as both manufacturer and plugin
                    const retry = await osc.query('/live/kbot/load_plugin', t, synthName, synthName);
                    const retryStatus = extractArgs(retry);
                    if (retryStatus[0] !== 'ok') {
                        return `Failed to load **${synthName}** on track ${args.track}: ${retryStatus.join(', ')}`;
                    }
                }
                // Brief pause to let the plugin initialize its parameters
                await new Promise(resolve => setTimeout(resolve, 500));
                // ── 4. Set synth parameters ────────────────────────────────────────
                const { set, failed } = await setParamsBatch(osc, t, 0, recipe.params);
                // ── 5. Load and configure effects ──────────────────────────────────
                const effectResults = [];
                if (recipe.effects) {
                    for (const fx of recipe.effects) {
                        // Load effect after the synth (it will be device index 1, 2, etc.)
                        const fxResult = await osc.query('/live/kbot/load_plugin', t, fx.name, '');
                        const fxStatus = extractArgs(fxResult);
                        if (fxStatus[0] === 'ok') {
                            await new Promise(resolve => setTimeout(resolve, 300));
                            // Get the device count to find the newly loaded effect's index
                            const devCount = await osc.query('/live/device/get/num_devices', t);
                            const numDevices = Number(extractArgs(devCount)[1] || 1);
                            const fxDeviceIdx = numDevices - 1;
                            const fxParams = await setParamsBatch(osc, t, fxDeviceIdx, fx.params);
                            effectResults.push(`${fx.name} (${fxParams.set.length} params set)`);
                        }
                        else {
                            effectResults.push(`${fx.name} (failed to load)`);
                        }
                    }
                }
                // ── 6. Report ──────────────────────────────────────────────────────
                const lines = [
                    `## Sound Designer: ${recipe.description}`,
                    '',
                    `**Recipe**: \`${recipeKey}\``,
                    `**Synth**: ${synthName} on track ${args.track}`,
                    `**Parameters set**: ${set.length}`,
                ];
                if (failed.length > 0) {
                    lines.push(`**Parameters not found**: ${failed.join(', ')}`);
                    lines.push('_(These may have different names in your Ableton version)_');
                }
                if (effectResults.length > 0) {
                    lines.push(`**Effects**: ${effectResults.join(', ')}`);
                }
                lines.push('', `> Matched "${description}" → \`${recipeKey}\``);
                if (set.length > 0) {
                    lines.push('', '| Parameter | Value |');
                    lines.push('|-----------|-------|');
                    for (const name of set) {
                        lines.push(`| ${name} | ${recipe.params[name]} |`);
                    }
                }
                return lines.join('\n');
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                if (msg.includes('ECONNREFUSED') || msg.includes('timeout')) {
                    return [
                        'Cannot connect to AbletonOSC.',
                        '',
                        '1. Open Ableton Live',
                        '2. Ensure AbletonOSC is loaded (Preferences > Link/Tempo/MIDI > Control Surface)',
                        '3. AbletonOSC should be listening on UDP 11000',
                    ].join('\n');
                }
                return `Sound Designer error: ${msg}`;
            }
        },
    });
}
//# sourceMappingURL=sound-designer.js.map