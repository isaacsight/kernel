// kbot Ableton Knowledge Engine — Knows Ableton better than Ableton
// Every native device, parameter, effect chain, genre template, mixing rule, signal flow path.
// March 2026: Live 12 complete — Meld, Drift, Roar, Auto Shift, Drum Sampler, MIDI Generators/Transformations.

import { registerTool } from './index.js'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface DeviceEntry {
  name: string
  type: 'instrument' | 'audio_effect' | 'midi_effect' | 'midi_tool'
  category: string
  description: string
  keyParams: string[]
  sweetSpots: string[]
  goodFor: string[]
  cpuWeight: 'low' | 'medium' | 'high'
  sidechain?: boolean
  live12New?: boolean
}

interface EffectChain {
  name: string
  purpose: string
  chain: string[]
  notes: string
}

interface GenreTemplate {
  name: string
  bpm: [number, number]
  tracks: string[]
  chordStyle: string
  drumPattern: string
  mixNotes: string[]
  keys: string[]
}

interface MixingRule {
  instrument: string
  eq: string[]
  compression: string[]
  panning: string
  tips: string[]
}

// ═══════════════════════════════════════════════════════════════════════════
// INSTRUMENTS (20)
// ═══════════════════════════════════════════════════════════════════════════

const INSTRUMENTS: DeviceEntry[] = [
  { name: 'Wavetable', type: 'instrument', category: 'synth', description: 'Wavetable synthesizer with dual oscillators, sub osc, modulation matrix, and unison engine', keyParams: ['Osc 1/2 Position', 'Osc 1/2 Wavetable', 'Sub Osc Level', 'Filter Type', 'Filter Freq', 'Filter Res', 'Amp Env ADSR', 'Mod Matrix', 'Unison Voices', 'Unison Amount'], sweetSpots: ['Position modulated by LFO for movement', 'Sub Osc adds bass weight without mud', 'Unison 4 voices + 15% detune = super saw', 'Modern wavetable + filter env = aggressive bass', 'FM between oscillators for metallic textures'], goodFor: ['leads', 'pads', 'basses', 'textures', 'modern synthesis'], cpuWeight: 'medium' },
  { name: 'Operator', type: 'instrument', category: 'synth', description: 'FM synthesizer with 4 operators, 11 algorithms, filters, and LFOs', keyParams: ['Operator A-D Level', 'Operator A-D Coarse/Fine Ratio', 'Operator A-D Waveform', 'Algorithm (1-11)', 'Feedback', 'Filter Type/Freq/Res', 'LFO Rate/Amount'], sweetSpots: ['Algorithm 1 for classic FM bass', 'Op A feedback for grit and edge', 'Ratio 1:2:3:4 for bell/EP tones', 'All sine waves + high ratios = metallic', 'Low ratios + detune for warm pads'], goodFor: ['FM bass', 'bells', 'electric piano', 'metallic sounds', 'percussion', 'plucks'], cpuWeight: 'low' },
  { name: 'Analog', type: 'instrument', category: 'synth', description: 'Virtual analog subtractive synth — 2 oscillators, noise, 2 filters, 2 LFOs, amp env', keyParams: ['Osc 1/2 Shape', 'Osc 1/2 Octave/Semi/Detune', 'Osc 1 Sub/Sync', 'Filter 1/2 Type/Freq/Res', 'Filter Env Amount', 'Amp Env ADSR', 'LFO 1/2 Rate/Shape/Dest'], sweetSpots: ['PWM on Osc 1 for classic analog feel', 'Filter env short decay for plucks', 'Slight detune between oscs for width', 'Sub osc for solid bass foundation', 'Sync for aggressive lead tones'], goodFor: ['classic synth sounds', 'bass', 'leads', 'pads', 'vintage analog'], cpuWeight: 'low' },
  { name: 'Drift', type: 'instrument', category: 'synth', description: 'Organic vintage synth with built-in imperfection (drift). Simple interface, warm sound', keyParams: ['Shape', 'Shape Mod', 'Drift Amount', 'Filter Freq/Res', 'Filter Env', 'Amp Env', 'LFO Rate/Shape', 'Voice Count', 'Spread'], sweetSpots: ['Drift 30-50% for analog imperfection', 'Shape mod for timbral movement', 'Hi-Quality mode (right-click title bar) for oversampling', 'Single voice for mono leads', 'Stack voices with spread for thick pads'], goodFor: ['lo-fi', 'warm pads', 'organic leads', 'vintage sounds', 'ambient'], cpuWeight: 'low', live12New: false },
  { name: 'Meld', type: 'instrument', category: 'synth', description: 'Bi-timbral MPE synth — dual macro oscillators with various synthesis methods, extensive modulation matrix', keyParams: ['Engine 1/2 Type', 'Engine 1/2 Controls', 'Mix', 'Filter', 'Modulation Matrix', 'MPE Response', 'Macro Controls'], sweetSpots: ['Mix between engines for morphing textures', 'LFO from Engine 1 modulating Engine 2', 'Quantize oscillators to scale for melodic drones', 'MPE pressure mapped to filter for expression', 'Granular engine for atmospheric textures'], goodFor: ['textural soundscapes', 'MPE expression', 'drones', 'atonal textures', 'experimental'], cpuWeight: 'medium', live12New: true },
  { name: 'Collision', type: 'instrument', category: 'physical_model', description: 'Physical modeling — mallet hitting a resonator. Tuned percussion and experimental sounds', keyParams: ['Mallet Type', 'Mallet Stiffness', 'Mallet Noise Amount', 'Resonator Type (Beam/Marimba/String/Membrane/Plate/Pipe/Tube)', 'Resonator Tune', 'Resonator Decay', 'Resonator Material', 'Resonator Brightness'], sweetSpots: ['Beam resonator for marimba/vibraphone', 'Membrane for drum-like tones', 'High stiffness + short noise for sharp attacks', 'Long decay + plate for ambient metallic', 'Detune between resonator 1 and 2 for chorus'], goodFor: ['marimba', 'vibraphone', 'bells', 'tuned percussion', 'metallic textures', 'experimental'], cpuWeight: 'medium' },
  { name: 'Tension', type: 'instrument', category: 'physical_model', description: 'Physical modeling of strings — excitator, string, damper, body, and termination controls', keyParams: ['Excitator Type (Bow/Hammer/Plectrum)', 'Excitator Force/Friction', 'String Decay', 'String Damping', 'String Inharmonicity', 'Body Type/Size', 'Termination Finger Mass/Stiffness'], sweetSpots: ['Bow excitator for sustained strings', 'Plectrum for guitar-like plucks', 'High inharmonicity for gamelan/bell', 'Body size affects resonance character', 'Finger mass on termination for muted harmonics'], goodFor: ['bowed strings', 'plucked strings', 'experimental', 'ethnic instruments', 'sound design'], cpuWeight: 'high' },
  { name: 'Electric', type: 'instrument', category: 'electric_piano', description: 'Electric piano — models of Rhodes and Wurlitzer with fork, damper, and pickup simulation', keyParams: ['Fork Tine/Tone Color', 'Fork Tine/Tone Level', 'Fork Tine/Tone Decay', 'Damper On/Off Stiffness', 'Damper Tone', 'Pickup Type (Magnetic/Piezo)', 'Pickup Position', 'Pickup Symmetry'], sweetSpots: ['Magnetic pickup + low symmetry for classic Rhodes', 'Piezo pickup for Wurlitzer bark', 'High tine level for bright, bell-like', 'Damper stiffness controls release character', 'Position 50% for balanced tone'], goodFor: ['Rhodes', 'Wurlitzer', 'electric piano', 'neo-soul keys', 'jazz'], cpuWeight: 'medium' },
  { name: 'Simpler', type: 'instrument', category: 'sampler', description: 'Simple sampler — Classic, One-Shot, and Slice modes. Drag any sample, apply filter/env/LFO', keyParams: ['Mode (Classic/One-Shot/Slice)', 'Sample Start/End', 'Loop On/Off/Length', 'Filter Type/Freq/Res', 'Amp Env ADSR', 'LFO Rate/Amount/Dest', 'Warp On/Off/Mode', 'Voices', 'Spread'], sweetSpots: ['Slice mode for instant beat chopping', 'One-Shot for drums and hits', 'Classic + loop for sustained pads from any sample', 'Warp mode for time-stretching without pitch change', 'LFO on filter for movement'], goodFor: ['sampling', 'beat chopping', 'one-shots', 'quick sound design', 'pads from recordings'], cpuWeight: 'low' },
  { name: 'Sampler', type: 'instrument', category: 'sampler', description: 'Advanced multi-sample instrument — key/velocity zones, 3 LFOs, 3 aux envelopes, modulation matrix', keyParams: ['Zone Editor (Key/Vel/Sample Select)', 'Filter Type/Freq/Res', 'Amp Env ADSR', 'Mod Matrix', 'LFO 1-3 Rate/Shape/Dest', 'Aux Env 1-3', 'MIDI Tab controls', 'Glide', 'Spread'], sweetSpots: ['Multi-layer velocity zones for realistic instruments', 'Round-robin for avoiding machine-gun effect', 'Mod matrix: velocity→filter for dynamic response', 'LFO on sample start position for granular-like', 'Zone crossfade for smooth transitions'], goodFor: ['multi-sampled instruments', 'orchestral', 'realistic instruments', 'complex sample manipulation'], cpuWeight: 'medium' },
  { name: 'Drum Sampler', type: 'instrument', category: 'sampler', description: 'One-shot sample player optimized for drums — pitch, decay, body, transient shaping', keyParams: ['Sample', 'Pitch', 'Decay', 'Body (Freq/Amount)', 'Transient (Shape/Amount)', 'Filter', 'Volume'], sweetSpots: ['Transient shaper for punchier drums', 'Body freq to add or remove weight', 'Pitch down for deeper kicks/808s', 'Short decay for tight, controlled sounds', 'Layer multiple in a Drum Rack'], goodFor: ['drum sound design', 'one-shots', 'quick drum kits'], cpuWeight: 'low', live12New: true },
  { name: 'Impulse', type: 'instrument', category: 'sampler', description: '8-slot drum sampler — each slot has start, tune, decay, stretch, filter, pan, volume, saturate', keyParams: ['Per-slot: Start, Tune, Decay, Stretch, Filter, Pan, Volume, Saturate', 'Soft/Hard switch per slot', 'Velocity sensitivity'], sweetSpots: ['Saturate for gritty lo-fi drums', 'Stretch for time-stretching individual hits', 'Tune for pitch variations between hits', 'Velocity to volume for dynamic playing', 'Quick layering: assign same MIDI note to multiple slots'], goodFor: ['quick drum kits', 'sample triggering', 'lo-fi drums', 'sound design'], cpuWeight: 'low' },
  { name: 'Granulator III', type: 'instrument', category: 'granular', description: 'Granular synthesis — captures and manipulates audio in real-time. MPE support. Freeze and scan through audio', keyParams: ['Grain Size', 'Grain Density', 'Position/Scan', 'Spray (random position offset)', 'Pitch Variation', 'Freeze', 'File Selector', 'Filter', 'Envelope'], sweetSpots: ['Freeze + slow scan for ambient textures', 'Small grains + high density for smooth pad', 'Large spray for chaotic textures', 'Pitch variation for chorus-like effect', 'Feed it vocals for haunting textures'], goodFor: ['ambient', 'texture', 'sound design', 'experimental', 'atmospheric pads'], cpuWeight: 'high', live12New: true },
  { name: 'Poli', type: 'instrument', category: 'synth', description: 'Polyphonic analog-style synth — warm, characterful. Based on classic poly synths', keyParams: ['Oscillator Shape', 'Sub Level', 'Noise Level', 'Filter Freq/Res/Env', 'Chorus', 'Amp Env', 'LFO'], sweetSpots: ['Built-in chorus for instant width', 'Sub oscillator for solid low end', 'Filter resonance self-oscillation for leads'], goodFor: ['poly pads', 'warm chords', 'vintage analog', 'classic sounds'], cpuWeight: 'low' },
  { name: 'Bass', type: 'instrument', category: 'synth', description: 'Dedicated bass synthesizer optimized for low-frequency sounds', keyParams: ['Oscillator', 'Filter', 'Drive', 'Envelope', 'Sub'], sweetSpots: ['Drive for gritty bass tones', 'Sub oscillator for sub-bass layer', 'Short envelope for plucky bass'], goodFor: ['bass', 'sub-bass', '808-style'], cpuWeight: 'low' },
  { name: 'External Instrument', type: 'instrument', category: 'utility', description: 'Routes MIDI to external hardware synth and receives audio back. Essential for hardware integration', keyParams: ['MIDI To (device/channel)', 'Audio From (input)', 'Hardware Latency (ms)'], sweetSpots: ['Set hardware latency accurately for tight timing', 'Use with hardware synths, drum machines, eurorack', 'Monitor through Ableton effects chain'], goodFor: ['hardware synths', 'external gear', 'hybrid setup'], cpuWeight: 'low' },
  { name: 'Drum Rack', type: 'instrument', category: 'rack', description: 'Container for drum instruments — 128 pads, each with its own chain of instruments and effects. Macro controls', keyParams: ['Pad Assignment', 'Choke Groups', 'Receive/Send', 'Macro Controls', 'Chain List'], sweetSpots: ['Choke groups for closed/open hihat interaction', 'Return chains inside the rack for shared reverb/delay', 'Macro knobs for performance control', 'Pad view for visual layout', 'Layer samples on same pad for rich hits'], goodFor: ['drum programming', 'sample organization', 'finger drumming', 'performance'], cpuWeight: 'low' },
  { name: 'Instrument Rack', type: 'instrument', category: 'rack', description: 'Parallel instrument chains with key/velocity zones, chain selector, and macro controls', keyParams: ['Chain List', 'Key/Velocity Zones', 'Chain Selector', 'Macro Controls 1-16'], sweetSpots: ['Layer synths for rich textures', 'Velocity zones for dynamic switching', 'Key zones for keyboard splits', 'Chain selector automated for morphing sounds', 'Macros for live performance control'], goodFor: ['layering', 'keyboard splits', 'complex instruments', 'performance'], cpuWeight: 'low' },
  { name: 'CV Instrument', type: 'instrument', category: 'utility', description: 'Converts MIDI to CV/Gate for controlling Eurorack/modular synths via DC-coupled audio interface', keyParams: ['Pitch Output', 'Gate Output', 'Velocity Output', 'Modulation Output'], sweetSpots: ['Requires DC-coupled interface (Expert Sleepers, MOTU)', 'Map mod wheel to CV for filter control'], goodFor: ['eurorack', 'modular synths', 'hardware CV control'], cpuWeight: 'low' },
  { name: 'CV Triggers', type: 'instrument', category: 'utility', description: 'Sends trigger/gate CV signals for drum modules and sequencers', keyParams: ['Trigger Outputs 1-8', 'Gate Length', 'Trigger Mode'], sweetSpots: ['Map to drum module triggers', 'Use with step sequencer for eurorack drums'], goodFor: ['eurorack drums', 'trigger sequencing', 'modular'], cpuWeight: 'low' },
]

// ═══════════════════════════════════════════════════════════════════════════
// AUDIO EFFECTS (44+)
// ═══════════════════════════════════════════════════════════════════════════

const AUDIO_EFFECTS: DeviceEntry[] = [
  // — Dynamics —
  { name: 'Compressor', type: 'audio_effect', category: 'dynamics', description: 'Versatile compressor with Peak/RMS/Expand modes, sidechain filter, and flexible routing', keyParams: ['Threshold', 'Ratio', 'Attack', 'Release', 'Knee', 'Makeup', 'Mode (Peak/RMS/Expand)', 'Sidechain Filter', 'Dry/Wet'], sweetSpots: ['Vocals: ratio 3:1, attack 10ms, release 100ms', 'Drums: ratio 4:1-8:1, fast attack for control', 'Bus glue: ratio 2:1, slow attack (30ms), auto release', 'Expand mode for upward compression', 'Sidechain from kick for pumping effect'], goodFor: ['dynamics control', 'punch', 'sustain', 'sidechain pumping', 'bus glue'], cpuWeight: 'low', sidechain: true },
  { name: 'Glue Compressor', type: 'audio_effect', category: 'dynamics', description: 'SSL-style bus compressor — glues tracks together. Fixed ratio options, range control', keyParams: ['Threshold', 'Ratio (2:1/4:1/10:1)', 'Attack (0.01-30ms)', 'Release (0.1-1.2s/Auto)', 'Range', 'Makeup', 'Dry/Wet', 'Sidechain'], sweetSpots: ['Mix bus: ratio 2:1, attack 10ms, release auto, range -6dB', 'Drum bus: ratio 4:1, fast attack, range -12dB', 'Subtle glue: dry/wet 50% for parallel', 'Range limits max gain reduction — very musical'], goodFor: ['bus compression', 'mix glue', 'drum bus', 'mastering'], cpuWeight: 'low', sidechain: true },
  { name: 'Multiband Dynamics', type: 'audio_effect', category: 'dynamics', description: '3-band dynamics processor — compress/expand each band independently. OTT lives here', keyParams: ['Crossover Freqs (Low/High)', 'Per-band: Above Threshold/Ratio, Below Threshold/Ratio', 'Attack/Release per band', 'Output Gain per band', 'Sidechain'], sweetSpots: ['OTT preset: aggressive multiband compression', 'Tame low-end without affecting highs', 'Expand high band for air and presence', 'Below threshold = upward compression', 'Use as multiband gate on low band to tighten bass'], goodFor: ['multiband compression', 'OTT', 'mastering', 'surgical dynamics'], cpuWeight: 'medium', sidechain: true },
  { name: 'Limiter', type: 'audio_effect', category: 'dynamics', description: 'Brick-wall limiter with lookahead — prevents clipping. Live 12: improved release curve and metering', keyParams: ['Gain', 'Ceiling', 'Release', 'Lookahead', 'Stereo/L/R/Mid/Side mode'], sweetSpots: ['Master: ceiling -0.3dB, gain to taste (target -14 LUFS for streaming)', 'Mid/Side mode for mastering (Live 12)', 'Short release for transparent limiting', 'Long release for pumping effect'], goodFor: ['mastering', 'loudness', 'clipping prevention', 'bus limiting'], cpuWeight: 'low', live12New: true },
  { name: 'Gate', type: 'audio_effect', category: 'dynamics', description: 'Noise gate — mutes signal below threshold. Sidechain capable for rhythmic gating', keyParams: ['Threshold', 'Return (hysteresis)', 'Attack', 'Hold', 'Release', 'Floor', 'Sidechain Filter', 'Flip'], sweetSpots: ['Drums: gate bleed between mics', 'Sidechain from rhythm track for trance gate effect', 'Flip mode inverts — ducking instead of gating', 'Floor at -inf for hard gate, -20dB for soft'], goodFor: ['noise removal', 'drum cleanup', 'trance gate', 'sidechain ducking'], cpuWeight: 'low', sidechain: true },
  { name: 'Drum Buss', type: 'audio_effect', category: 'dynamics', description: 'All-in-one drum processor — drive, crunch, transient shaping, low-end boost, dry/wet', keyParams: ['Drive (Soft/Medium/Hard)', 'Crunch', 'Transients', 'Boom (freq/amount/decay)', 'Dry/Wet', 'Output'], sweetSpots: ['Boom for instant sub-bass on kick', 'Soft drive + transients for punchy drums', 'Hard drive for lo-fi/distorted drums', 'Crunch for adding harmonic content', 'Dry/Wet for parallel processing'], goodFor: ['drum processing', 'parallel drum compression', 'lo-fi drums', 'sub-bass enhancement'], cpuWeight: 'low' },

  // — EQ —
  { name: 'EQ Eight', type: 'audio_effect', category: 'eq', description: '8-band parametric EQ with multiple filter types, spectrum display, and mid/side mode', keyParams: ['Band 1-8: Freq, Gain, Q', 'Filter Type per band (LP/HP/BP/Notch/Low/High Shelf)', 'Scale', 'Oversampling', 'Mid/Side mode', 'Audition mode'], sweetSpots: ['High-pass on everything: 80Hz vocals, 100Hz guitars, 30Hz bass', 'Cut narrow (high Q), boost wide (low Q)', 'Audition mode to find problem frequencies', 'Mid/Side: widen highs, keep bass centered', 'Oversampling for surgical mastering EQ'], goodFor: ['mixing', 'mastering', 'surgical EQ', 'tone shaping'], cpuWeight: 'low' },
  { name: 'EQ Three', type: 'audio_effect', category: 'eq', description: 'Simple 3-band DJ EQ with kill switches — low, mid, high', keyParams: ['GainLow', 'GainMid', 'GainHigh', 'FreqLow', 'FreqHigh', '24/48 dB mode'], sweetSpots: ['Kill switches for DJ-style drops', 'Quick tonal adjustments in live performance', 'Use 48dB mode for sharper band separation'], goodFor: ['DJ performance', 'quick tone', 'live mixing'], cpuWeight: 'low' },
  { name: 'Channel EQ', type: 'audio_effect', category: 'eq', description: 'Simple channel strip EQ — high-pass, low shelf, bell, high shelf. Quick and visual', keyParams: ['HP Freq', 'Low Gain/Freq', 'Mid Gain/Freq/Q', 'High Gain/Freq', 'Output', 'Spectrum display'], sweetSpots: ['Fast for basic channel EQ needs', 'Good visual feedback for beginners', 'HP filter for low-end cleanup', 'Use EQ Eight for more complex work'], goodFor: ['channel strip EQ', 'quick adjustments', 'workflow speed'], cpuWeight: 'low' },

  // — Reverb —
  { name: 'Reverb', type: 'audio_effect', category: 'reverb', description: 'Algorithmic reverb — room size, decay, diffusion, damping, early reflections, chorus', keyParams: ['Decay Time', 'Room Size', 'Predelay', 'Diffusion', 'High/Low Damping', 'ER Level/Shape', 'Chorus Amount/Rate', 'Dry/Wet', 'Stereo', 'Freeze'], sweetSpots: ['Vocals: decay 1.5-2.5s, predelay 20-40ms, high damp 4kHz', 'Drums room: decay 0.5-1s, small size, low diffusion', 'Ambient wash: decay 5-10s, freeze for infinite', 'Predelay separates dry signal from reverb tail', 'High damping for darker, warmer reverb'], goodFor: ['general reverb', 'ambience', 'space', 'vocal reverb'], cpuWeight: 'low' },
  { name: 'Hybrid Reverb', type: 'audio_effect', category: 'reverb', description: 'Convolution + algorithmic hybrid — use IRs for realism plus algorithmic tail. Parallel or serial routing', keyParams: ['Convolution IR Select', 'Algorithm (Quartz/Dark Hall/Shimmer/Tides/Prism)', 'Blend (Conv↔Algo)', 'Routing (Serial/Parallel)', 'EQ', 'Decay', 'Size', 'Dry/Wet'], sweetSpots: ['Serial: real room early reflections → algorithmic tail', 'Parallel: blend realistic space with shimmer', 'Shimmer algo for ambient/post-rock', 'Dark Hall for cinematic reverb', 'Tides for modulated, evolving reverb'], goodFor: ['cinematic', 'ambient', 'realistic spaces', 'creative reverb', 'shimmer'], cpuWeight: 'high' },

  // — Delay —
  { name: 'Delay', type: 'audio_effect', category: 'delay', description: 'Stereo delay with sync, filter, modulation, and freeze', keyParams: ['L/R Delay Time', 'Sync Mode', 'Feedback', 'Filter HP/LP', 'Mod Rate/Amount', 'Dry/Wet', 'Freeze', 'Ping Pong'], sweetSpots: ['Ping pong 1/8 note for stereo width', 'Filter feedback for dub delay', 'Dotted 1/8 for The Edge style', 'Freeze for infinite repeats', 'Low feedback + short time for slapback'], goodFor: ['stereo delay', 'rhythmic delay', 'dub', 'ambience'], cpuWeight: 'low' },
  { name: 'Echo', type: 'audio_effect', category: 'delay', description: 'Character delay with reverb, modulation, noise, ducking, and gate. More creative than Delay', keyParams: ['L/R Time', 'Feedback', 'Input Filter HP/LP', 'Modulation', 'Noise Amount/Morph', 'Reverb Level/Decay', 'Duck Amount', 'Gate Threshold', 'Dry/Wet'], sweetSpots: ['Ducking: delay ducks under dry signal — stays out of the way', 'Noise + modulation for tape delay character', 'Built-in reverb on the feedback for washy repeats', 'Gate for rhythmic delay effects', 'Stereo offset for width'], goodFor: ['creative delay', 'tape delay', 'lo-fi delay', 'dub', 'ambient'], cpuWeight: 'low' },
  { name: 'Filter Delay', type: 'audio_effect', category: 'delay', description: '3-band filtered delay — L, L+R, R each with independent filter and delay time', keyParams: ['Per-channel: Delay Time, Feedback, Filter Freq/Width, Pan, Volume'], sweetSpots: ['Different times per channel for complex rhythms', 'Filter each band differently for separation', 'High band only with fast time for shimmer'], goodFor: ['creative delay', 'filtered echoes', 'complex rhythms'], cpuWeight: 'low' },
  { name: 'Grain Delay', type: 'audio_effect', category: 'delay', description: 'Granular delay — delays through a granular engine. Pitch-shifted, randomized grains', keyParams: ['Delay Time', 'Feedback', 'Pitch', 'Grain Frequency', 'Grain Random', 'Spray', 'Dry/Wet'], sweetSpots: ['Pitch up 12st + short delay for shimmer effect', 'High spray + random for granular textures', 'Short delay + no pitch for thickening', 'Feedback + pitch shift for rising/falling spirals'], goodFor: ['granular textures', 'pitch-shifted delay', 'ambient', 'experimental'], cpuWeight: 'medium' },

  // — Modulation —
  { name: 'Chorus-Ensemble', type: 'audio_effect', category: 'modulation', description: 'Chorus and ensemble effect — Classic, Ensemble, and Vibrato modes', keyParams: ['Mode (Classic/Ensemble/Vibrato)', 'Rate 1/2', 'Amount 1/2', 'Delay 1/2', 'Feedback', 'High-pass', 'Dry/Wet'], sweetSpots: ['Classic mode for standard chorus widening', 'Ensemble mode for thick, lush detuning (like Roland Dimension D)', 'Vibrato mode for pitch wobble', 'Low rate + subtle amount for gentle width'], goodFor: ['widening', 'thickening', 'lush pads', 'guitar chorus', 'vintage'], cpuWeight: 'low' },
  { name: 'Phaser-Flanger', type: 'audio_effect', category: 'modulation', description: 'Combined phaser and flanger — Phaser mode (allpass) and Flanger mode (comb filter)', keyParams: ['Mode (Phaser/Flanger/Doubler)', 'Rate', 'Amount', 'Center Freq', 'Feedback', 'Notches (Phaser)', 'Dry/Wet'], sweetSpots: ['Phaser: slow rate for sweeping movement', 'Flanger: negative feedback for hollow jet sound', 'Doubler mode for subtle thickening', 'High feedback for resonant sweeps'], goodFor: ['psychedelic', 'movement', 'guitar effects', 'synth processing'], cpuWeight: 'low' },
  { name: 'Auto Pan-Tremolo', type: 'audio_effect', category: 'modulation', description: 'LFO-driven panning or amplitude modulation', keyParams: ['Rate', 'Amount', 'Phase', 'Shape', 'Offset', 'Invert'], sweetSpots: ['Sine shape slow rate for gentle autopan', 'Square shape for hard L/R switching', 'Fast rate for tremolo effect', 'Phase offset for stereo width tricks'], goodFor: ['auto-panning', 'tremolo', 'stereo movement', 'rhythmic effects'], cpuWeight: 'low' },
  { name: 'Auto Filter', type: 'audio_effect', category: 'modulation', description: 'LFO/envelope-driven filter. Live 12: new filter types and visualization', keyParams: ['Filter Type (LP/HP/BP/Notch/Morph)', 'Frequency', 'Resonance', 'LFO Amount/Rate/Shape', 'Envelope Amount/Attack/Release', 'Sidechain', 'Dry/Wet'], sweetSpots: ['Envelope follower for dynamic wah effect', 'Sidechain from drums for rhythmic filtering', 'LFO sine on LP for classic filter sweep', 'Morph filter type for evolving timbres', 'BP + high res for acid sounds'], goodFor: ['filter sweeps', 'wah', 'acid bass', 'rhythmic filtering', 'sound design'], cpuWeight: 'low', sidechain: true, live12New: true },
  { name: 'Auto Shift', type: 'audio_effect', category: 'modulation', description: 'Real-time pitch correction, harmonization, vibrato, and formant shifting for monophonic sources', keyParams: ['Pitch Correction Amount', 'Scale/Key', 'Vibrato Rate/Amount', 'Formant Shift', 'Harmonize Interval', 'Dry/Wet'], sweetSpots: ['100% correction for T-Pain/Cher effect', '60-80% for subtle tuning with character', 'Formant shift down for deeper voice', 'Harmonize in thirds for vocal harmony', 'Vibrato adds life to corrected pitch'], goodFor: ['vocal tuning', 'pitch correction', 'harmonizer', 'vocal effects', 'creative pitch'], cpuWeight: 'medium', live12New: true },
  { name: 'Shifter', type: 'audio_effect', category: 'modulation', description: 'Pitch shifter and frequency shifter in one device. Ring mod mode available', keyParams: ['Mode (Pitch/Freq/Ring)', 'Coarse/Fine Pitch', 'Window Size', 'Delay', 'Feedback', 'Dry/Wet', 'LFO Rate/Amount'], sweetSpots: ['Pitch mode for harmonizer (set interval)', 'Freq mode for Bode-style frequency shifting', 'Ring mode for metallic/inharmonic sounds', 'Feedback for rising/falling pitch effects', 'Wide window for better quality on sustained sounds'], goodFor: ['pitch shifting', 'frequency shifting', 'harmonizer', 'ring modulation', 'special effects'], cpuWeight: 'medium' },

  // — Distortion —
  { name: 'Saturator', type: 'audio_effect', category: 'distortion', description: 'Waveshaping distortion — 6 curve types including Analog Clip, Soft Sine, and custom waveshaper. Live 12: Bass Shaper curve', keyParams: ['Drive', 'Curve Type (Analog Clip/Soft Sine/Medium/Hard/Sinoid Fold/Digital Clip)', 'Color', 'Base', 'Freq', 'Width', 'Depth', 'Output', 'Dry/Wet', 'Soft Clip'], sweetSpots: ['Analog Clip for warm tape-style saturation', 'Sinoid Fold for aggressive digital distortion', 'Soft Sine with low drive for subtle warmth', 'Bass Shaper curve (Live 12) for targeted low-end saturation', 'Dry/Wet for parallel saturation'], goodFor: ['warmth', 'tape saturation', 'distortion', 'bass enhancement', 'mastering color'], cpuWeight: 'low', live12New: true },
  { name: 'Overdrive', type: 'audio_effect', category: 'distortion', description: 'Guitar-style overdrive pedal — warm, tube-like distortion with tone control', keyParams: ['Drive', 'Tone', 'Dynamics', 'Band (filter range)', 'Dry/Wet'], sweetSpots: ['Low drive for subtle warmth', 'Dynamics control preserves transients', 'Band filter focuses distortion on specific range', 'Stack with Amp for full guitar rig'], goodFor: ['guitar overdrive', 'subtle warmth', 'bass grit', 'synth bite'], cpuWeight: 'low' },
  { name: 'Pedal', type: 'audio_effect', category: 'distortion', description: 'Guitar pedal emulations — OD (overdrive), Distortion, Fuzz', keyParams: ['Type (OD/Distortion/Fuzz)', 'Gain', 'Bass/Mid/Treble', 'Output', 'Dry/Wet', 'Sub'], sweetSpots: ['OD for classic tube overdrive', 'Fuzz for thick, sustained distortion', 'Sub switch adds low-end body', 'Stack OD → Distortion for high-gain'], goodFor: ['guitar tones', 'bass distortion', 'synth grit'], cpuWeight: 'low' },
  { name: 'Amp', type: 'audio_effect', category: 'distortion', description: 'Guitar amp emulation — 7 amp models with gain, bass, mid, treble, presence', keyParams: ['Amp Type (Clean/Boost/Blues/Rock/Lead/Heavy/Bass)', 'Gain', 'Bass/Mid/Treble/Presence', 'Output', 'Dry/Wet'], sweetSpots: ['Clean for warm color without breakup', 'Blues for edge-of-breakup crunch', 'Heavy for modern high-gain', 'Bass model for bass guitar/synth bass', 'Follow with Cabinet for full guitar sound'], goodFor: ['guitar amp', 'bass amp', 'synth warmth', 'distortion character'], cpuWeight: 'low' },
  { name: 'Cabinet', type: 'audio_effect', category: 'distortion', description: 'Speaker cabinet simulation — pair with Amp for full guitar rig', keyParams: ['Cabinet Type (1x12-4x12)', 'Microphone Type (Dynamic/Condenser)', 'Mic Position (Near/Far)', 'Dry/Wet'], sweetSpots: ['4x12 for full rock/metal', '1x12 for blues/jazz', 'Dynamic mic near for punchy, focused', 'Condenser far for room ambience', 'Always pair with Amp'], goodFor: ['speaker simulation', 'guitar rig', 'cabinet IR'], cpuWeight: 'low' },
  { name: 'Roar', type: 'audio_effect', category: 'distortion', description: 'Multi-stage saturation — 3 stages in serial, parallel, multiband, or mid/side. Feedback generator and modulation matrix. Live 12 flagship effect', keyParams: ['Stage 1-3 Type/Drive/Tone', 'Routing (Serial/Parallel/Multiband/Mid-Side)', 'Feedback Amount/Freq/Tone', 'Modulation Matrix', 'Input/Output Filter', 'Dry/Wet', 'MIDI Pitch control (12.2)'], sweetSpots: ['Serial routing for cascading distortion stages', 'Multiband: distort mids, leave bass clean', 'Mid/Side: saturate sides for width, keep center clean', 'Feedback generator for self-oscillation', 'MIDI control of feedback pitch (Live 12.2)', 'Parallel routing for blending distortion flavors'], goodFor: ['creative distortion', 'multiband saturation', 'sound design', 'texture', 'experimental'], cpuWeight: 'medium', live12New: true },
  { name: 'Dynamic Tube', type: 'audio_effect', category: 'distortion', description: 'Tube saturation with envelope follower — responds to input dynamics', keyParams: ['Drive', 'Tone', 'Bias', 'Envelope', 'Attack/Release', 'Output', 'Dry/Wet', 'Tube Model (A/B/C)'], sweetSpots: ['Tube A for subtle warmth', 'Tube C for aggressive breakup', 'Envelope makes it respond to playing dynamics', 'Bias affects the character of the distortion'], goodFor: ['tube warmth', 'dynamic saturation', 'bass warmth', 'vocal color'], cpuWeight: 'low' },
  { name: 'Erosion', type: 'audio_effect', category: 'distortion', description: 'Digital degradation — adds aliasing and quantization noise. Sine/Noise/Wide Noise modes', keyParams: ['Frequency', 'Amount', 'Mode (Sine/Noise/Wide Noise)', 'Width'], sweetSpots: ['Sine mode at specific freq for targeted aliasing', 'Noise for bit-crushing style degradation', 'Low amount for subtle digital edge', 'Wide Noise for broadband destruction'], goodFor: ['lo-fi', 'digital distortion', 'bit crushing', 'texture'], cpuWeight: 'low' },
  { name: 'Redux', type: 'audio_effect', category: 'distortion', description: 'Bit crusher and sample rate reducer — downsample and quantize', keyParams: ['Bit Depth', 'Sample Rate', 'Downsample Mode (Soft/Hard)', 'Filter (Off/Post/Pre+Post)', 'Jitter'], sweetSpots: ['12-bit for retro/lo-fi game sound', '8-bit for heavy crusher', 'Soft downsample for gentle vintage', 'Pre+Post filter to focus the effect', 'Jitter for analog-style randomness'], goodFor: ['bit crushing', 'lo-fi', 'retro sounds', 'destruction'], cpuWeight: 'low' },
  { name: 'Vinyl Distortion', type: 'audio_effect', category: 'distortion', description: 'Vinyl record simulation — crackle, tracing model, pinch', keyParams: ['Tracing Freq/Drive', 'Pinch Freq/Drive', 'Crackle Density/Volume', 'Dry/Wet'], sweetSpots: ['Crackle for instant vinyl nostalgia', 'Tracing model for subtle analog warmth', 'Layer crackle low in mix for texture', 'Combine with Redux for full lo-fi chain'], goodFor: ['vinyl simulation', 'lo-fi', 'nostalgia', 'texture'], cpuWeight: 'low' },

  // — Spectral —
  { name: 'Spectral Resonator', type: 'audio_effect', category: 'spectral', description: 'FFT-based resonator — tunes partials to MIDI, scales, or harmonics', keyParams: ['Mode (Pitched/Harmonic/Inharmonic)', 'Frequency/MIDI Input', 'Decay', 'Stretch', 'Shift', 'Dry/Wet', 'Freeze', 'Sidechain MIDI'], sweetSpots: ['Feed drums → tune to MIDI notes for melodic percussion', 'Freeze for infinite sustain', 'Inharmonic mode for bell-like tones', 'Stretch for unusual spectral spacing', 'Feed noise → pitched mode for synth-like sounds'], goodFor: ['spectral processing', 'melodic percussion', 'sound design', 'experimental'], cpuWeight: 'high', sidechain: true },
  { name: 'Spectral Time', type: 'audio_effect', category: 'spectral', description: 'FFT-based freeze and delay — spectral processing in frequency domain', keyParams: ['Freeze', 'Delay Time', 'Feedback', 'Fade In/Out', 'Tilt', 'Spray', 'Resolution', 'Dry/Wet'], sweetSpots: ['Freeze for spectral sustain/pad creation', 'Spectral delay for frequency-dependent echoes', 'High spray for diffused, granular-like texture', 'Tilt shifts spectral balance over time', 'Serial with Spectral Resonator for extreme processing'], goodFor: ['spectral freeze', 'ambient', 'sound design', 'creative effects'], cpuWeight: 'high' },
  { name: 'Vocoder', type: 'audio_effect', category: 'spectral', description: 'Classic vocoder — modulator (voice) shapes carrier (synth). External sidechain or noise carrier', keyParams: ['Carrier (Noise/External/Modulator)', 'Bands (4-40)', 'Range', 'Bandwidth', 'Gate', 'Depth', 'Attack/Release', 'Formant Shift', 'Dry/Wet'], sweetSpots: ['External carrier from synth pad for classic vocoder', 'Noise carrier for whispered robot voice', '20+ bands for intelligible speech', 'Formant shift for gender modification', 'Gate to clean up quiet parts'], goodFor: ['vocoder', 'robot voice', 'talk box', 'spectral processing'], cpuWeight: 'medium', sidechain: true },
  { name: 'Corpus', type: 'audio_effect', category: 'spectral', description: 'Physical resonator — models vibrating surfaces (beam, plate, membrane, string, pipe, tube)', keyParams: ['Resonator Type', 'Tune', 'Decay', 'Material', 'Brightness', 'Inharmonics', 'MIDI Freq', 'Dry/Wet'], sweetSpots: ['Feed drums through for tuned percussion', 'MIDI sidechain for pitched resonance', 'Plate type for metallic body', 'Membrane for drum-body resonance', 'Used inside Collision instrument'], goodFor: ['physical modeling effects', 'tuned resonance', 'sound design'], cpuWeight: 'medium', sidechain: true },
  { name: 'Resonators', type: 'audio_effect', category: 'spectral', description: '5 parallel tuned comb filters — creates pitched resonance from any input', keyParams: ['Note (I-V)', 'Fine Tune (I-V)', 'Gain (I-V)', 'Decay', 'Color', 'Brightness', 'Dry/Wet', 'Width', 'Filter'], sweetSpots: ['Tuned to chord tones for harmonic resonance', 'Feed drums for pitched metallic percussion', 'Feed noise for string-like drones', 'Width for stereo spread of resonances', 'Decay controls sustain length'], goodFor: ['resonant effects', 'pitched percussion', 'drones', 'harmonic enhancement'], cpuWeight: 'low' },

  // — Utility —
  { name: 'Utility', type: 'audio_effect', category: 'utility', description: 'Swiss army knife — gain, pan, width, phase, mono/stereo, L/R swap, mid/side', keyParams: ['Gain', 'Pan', 'Width (0%=mono, 100%=normal, 200%=super wide)', 'Mute', 'Phase Invert L/R', 'Channel Mode (Stereo/L/R/Mono/Swap/Mid/Side)', 'Bass Mono', 'Bass Mono Freq'], sweetSpots: ['Width 0% to check mono compatibility', 'Bass Mono below 200Hz for tight low end', 'Mid/Side mode: solo sides to check stereo content', 'Phase flip to check phase issues', 'Gain staging: use before/after effects for proper levels'], goodFor: ['gain staging', 'mono check', 'stereo width', 'bass mono', 'phase correction', 'utility'], cpuWeight: 'low' },
  { name: 'Spectrum', type: 'audio_effect', category: 'utility', description: 'Spectrum analyzer — visual frequency display. No audio processing', keyParams: ['Block Size', 'Channel (L+R/L/R/Mid/Side)', 'Avg/Max display', 'Range'], sweetSpots: ['Place on master to monitor frequency balance', 'Mid/Side view for stereo analysis', 'Larger block size = more frequency detail', 'Max hold to see peaks'], goodFor: ['frequency analysis', 'mixing reference', 'monitoring'], cpuWeight: 'low' },
  { name: 'Tuner', type: 'audio_effect', category: 'utility', description: 'Chromatic tuner for guitars and other instruments', keyParams: ['Display (Hz/Note)', 'Reference Pitch (default 440Hz)'], sweetSpots: ['Place first in chain for accurate reading', 'Works with any pitched instrument'], goodFor: ['tuning', 'pitch reference'], cpuWeight: 'low' },
  { name: 'Looper', type: 'audio_effect', category: 'utility', description: 'Audio looper — record, overdub, play, reverse. Sync to session tempo', keyParams: ['Speed', 'Reverse', 'Tempo Control', 'Quantization', 'Song Control', 'Feedback/Input Volume'], sweetSpots: ['Quantize to bar for synced looping', 'Half speed for octave-down effect', 'Reverse for ambient textures', 'Map to MIDI foot controller for live looping'], goodFor: ['live looping', 'performance', 'ambient', 'sound-on-sound'], cpuWeight: 'low' },
  { name: 'Beat Repeat', type: 'audio_effect', category: 'utility', description: 'Glitch/stutter effect — randomly or rhythmically repeats audio segments', keyParams: ['Interval', 'Offset', 'Grid', 'Variation', 'Chance', 'Gate', 'Pitch Decay', 'Filter', 'Volume', 'Mix Mode (Mix/Insert/Gate)'], sweetSpots: ['1/8 grid for classic stutter', 'Pitch decay for descending glitch', 'Low chance for occasional random repeats', 'Gate mode for clean glitch transitions', 'Filter to darken/brighten repeats over time'], goodFor: ['glitch', 'stutter', 'IDM', 'performance', 'build-ups'], cpuWeight: 'low' },
  { name: 'External Audio Effect', type: 'audio_effect', category: 'utility', description: 'Send/return for external hardware effects — audio out to hardware, audio in back', keyParams: ['Audio To', 'Audio From', 'Hardware Latency', 'Gain', 'Dry/Wet', 'Phase Invert'], sweetSpots: ['Compensate latency accurately for tight timing', 'Dry/Wet for parallel hardware processing', 'Use with guitar pedals, hardware reverbs, etc.'], goodFor: ['hardware effects', 'hybrid setup', 'external processing'], cpuWeight: 'low' },
]

// ═══════════════════════════════════════════════════════════════════════════
// MIDI EFFECTS (8)
// ═══════════════════════════════════════════════════════════════════════════

const MIDI_EFFECTS: DeviceEntry[] = [
  { name: 'Arpeggiator', type: 'midi_effect', category: 'midi', description: 'Classic arpeggiator — hold chord, get arpeggiated pattern. Multiple styles, gate, and retrigger', keyParams: ['Style (Up/Down/UpDown/Random/Order/etc)', 'Rate', 'Gate', 'Steps', 'Offset', 'Velocity', 'Retrigger', 'Repeats', 'Groove'], sweetSpots: ['Random style for generative melodies', 'Gate <50% for staccato arpeggios', 'Steps to repeat notes before moving', 'Groove for swing/shuffle'], goodFor: ['arpeggios', 'sequences', 'generative', 'performance'], cpuWeight: 'low' },
  { name: 'Chord', type: 'midi_effect', category: 'midi', description: 'Generates chords from single notes — up to 6 additional notes with individual transposition', keyParams: ['Shift 1-6 (semitones)', 'Velocity 1-6'], sweetSpots: ['Major chord: +4, +7', 'Minor chord: +3, +7', 'Power chord: +7, +12', 'Octave stack: +12, +24', 'Minor 7th: +3, +7, +10'], goodFor: ['chord generation', 'stacking', 'power chords', 'octave doubling'], cpuWeight: 'low' },
  { name: 'Note Length', type: 'midi_effect', category: 'midi', description: 'Controls MIDI note length and gate. Can also trigger on note-off', keyParams: ['Length (ms or synced)', 'Gate', 'Trigger (Note On/Note Off)', 'Decay/Release Mode'], sweetSpots: ['Fixed length for consistent staccato', 'Note Off trigger for inverted playing style', 'Gate to percentage of original length'], goodFor: ['note length control', 'staccato', 'gate effects'], cpuWeight: 'low' },
  { name: 'Pitch', type: 'midi_effect', category: 'midi', description: 'Transpose MIDI notes — range and lowest settings for octave/range control', keyParams: ['Pitch (semitones)', 'Range (limit transposition)', 'Lowest (set floor note)'], sweetSpots: ['Quick octave shift: +12 or -12', 'Range to keep notes within playable octave'], goodFor: ['transposition', 'octave shift'], cpuWeight: 'low' },
  { name: 'Random', type: 'midi_effect', category: 'midi', description: 'Adds random pitch offset to MIDI notes — controlled randomness for variation', keyParams: ['Chance', 'Choices', 'Scale', 'Sign (Add/Subtract/Both)'], sweetSpots: ['Low chance + few choices for subtle variation', 'Scale to quantize random to key', 'High randomness for experimental/generative'], goodFor: ['variation', 'generative', 'humanization', 'experimental'], cpuWeight: 'low' },
  { name: 'Scale', type: 'midi_effect', category: 'midi', description: 'Forces MIDI notes to a specific scale — maps each chromatic note to nearest scale degree', keyParams: ['Base Note', 'Scale Type', 'Fold/Nearest mode'], sweetSpots: ['Set to song key to prevent wrong notes', 'Use before Arpeggiator for in-key arpeggios', 'Fold mode wraps notes, Nearest snaps to closest'], goodFor: ['scale locking', 'wrong note prevention', 'key constraint'], cpuWeight: 'low' },
  { name: 'Velocity', type: 'midi_effect', category: 'midi', description: 'Remaps MIDI velocity — compress, expand, randomize velocity curves', keyParams: ['Drive', 'Compand', 'Random', 'Out Hi/Low', 'Range', 'Mode (Clip/Gate/Fixed)'], sweetSpots: ['Compand to even out velocity differences', 'Random for humanization', 'Fixed mode for consistent velocity (drum machines)', 'Gate mode to filter out quiet notes'], goodFor: ['velocity control', 'humanization', 'dynamics shaping'], cpuWeight: 'low' },
  { name: 'CC Control', type: 'midi_effect', category: 'midi', description: 'Send MIDI CC messages from clip envelopes or modulation', keyParams: ['CC Number', 'Channel', 'Value Range'], sweetSpots: ['Automate hardware synth parameters via CC', 'Send expression (CC11) to external instruments'], goodFor: ['MIDI CC control', 'hardware control', 'expression'], cpuWeight: 'low' },
]

// ═══════════════════════════════════════════════════════════════════════════
// MIDI TOOLS (Live 12)
// ═══════════════════════════════════════════════════════════════════════════

const MIDI_TOOLS: DeviceEntry[] = [
  // Transformations
  { name: 'Arpeggiate', type: 'midi_tool', category: 'transformation', description: 'Transform chords into arpeggiated patterns within clips', keyParams: ['Style', 'Rate', 'Direction'], sweetSpots: ['Apply to existing chord clips for instant arpeggios'], goodFor: ['arpeggio patterns', 'clip transformation'], cpuWeight: 'low', live12New: true },
  { name: 'Chop', type: 'midi_tool', category: 'transformation', description: 'Chop notes into repeated segments', keyParams: ['Grid', 'Velocity Curve'], sweetSpots: ['Chop sustained notes into rhythmic patterns'], goodFor: ['rhythmic chopping', 'stutter'], cpuWeight: 'low', live12New: true },
  { name: 'Connect', type: 'midi_tool', category: 'transformation', description: 'Connect successive notes — legato effect', keyParams: ['Amount'], sweetSpots: ['Create legato phrases from staccato notes'], goodFor: ['legato', 'smooth phrases'], cpuWeight: 'low', live12New: true },
  { name: 'Glissando', type: 'midi_tool', category: 'transformation', description: 'Add pitch slides between notes', keyParams: ['Time', 'Shape'], sweetSpots: ['Smooth transitions between melody notes'], goodFor: ['pitch slides', 'portamento'], cpuWeight: 'low', live12New: true },
  { name: 'Ornament', type: 'midi_tool', category: 'transformation', description: 'Add grace notes and ornaments', keyParams: ['Type', 'Interval'], sweetSpots: ['Add trills, mordents, and turns'], goodFor: ['ornamentation', 'classical', 'embellishment'], cpuWeight: 'low', live12New: true },
  { name: 'Quantize', type: 'midi_tool', category: 'transformation', description: 'Snap notes to grid', keyParams: ['Grid', 'Amount', 'Swing'], sweetSpots: ['50% amount for tighter but still human feel'], goodFor: ['timing correction', 'groove'], cpuWeight: 'low', live12New: true },
  { name: 'Recombine', type: 'midi_tool', category: 'transformation', description: 'Shuffle and recombine note properties (pitch, velocity, timing)', keyParams: ['Pitch/Velocity/Time shuffle'], sweetSpots: ['Randomize pitch order keeping rhythm = new melody'], goodFor: ['generative variation', 'remix'], cpuWeight: 'low', live12New: true },
  { name: 'Span', type: 'midi_tool', category: 'transformation', description: 'Stretch or compress note timing', keyParams: ['Factor', 'Anchor'], sweetSpots: ['2x for half-time feel, 0.5x for double-time'], goodFor: ['time stretching', 'tempo variation'], cpuWeight: 'low', live12New: true },
  { name: 'Strum', type: 'midi_tool', category: 'transformation', description: 'Apply strum timing to chords — simulates guitar strumming', keyParams: ['Direction (Up/Down)', 'Speed', 'Humanize'], sweetSpots: ['Apply to block chords for guitar-like strum', 'Humanize for natural feel'], goodFor: ['guitar simulation', 'chord humanization'], cpuWeight: 'low', live12New: true },
  { name: 'Velocity Shaper', type: 'midi_tool', category: 'transformation', description: 'Draw velocity curves across notes', keyParams: ['Shape', 'Range'], sweetSpots: ['Crescendo/decrescendo shapes for dynamics'], goodFor: ['velocity shaping', 'dynamics'], cpuWeight: 'low', live12New: true },
  // Generators
  { name: 'Rhythm Generator', type: 'midi_tool', category: 'generator', description: 'Generate rhythmic patterns algorithmically', keyParams: ['Density', 'Pattern', 'Grid'], sweetSpots: ['Quick drum pattern generation', 'Euclidean-like rhythms'], goodFor: ['rhythm generation', 'drum patterns'], cpuWeight: 'low', live12New: true },
  { name: 'Seed Generator', type: 'midi_tool', category: 'generator', description: 'Generate melodic seeds/motifs', keyParams: ['Scale', 'Range', 'Density', 'Seed'], sweetSpots: ['Starting point for melodies', 'Randomize seed for variations'], goodFor: ['melody generation', 'motif creation'], cpuWeight: 'low', live12New: true },
  { name: 'Shape Generator', type: 'midi_tool', category: 'generator', description: 'Generate patterns based on drawn shapes', keyParams: ['Shape', 'Range', 'Grid'], sweetSpots: ['Draw contour → get melody'], goodFor: ['contour-based melody', 'visual composition'], cpuWeight: 'low', live12New: true },
  { name: 'Stacks Generator', type: 'midi_tool', category: 'generator', description: 'Generate stacked chord patterns', keyParams: ['Interval', 'Voicing', 'Pattern'], sweetSpots: ['Instant chord progressions and voicings'], goodFor: ['chord generation', 'harmony'], cpuWeight: 'low', live12New: true },
  { name: 'Euclidean Generator', type: 'midi_tool', category: 'generator', description: 'Generate Euclidean rhythm patterns — evenly distributed hits', keyParams: ['Steps', 'Pulses', 'Rotation', 'Pitch'], sweetSpots: ['3 pulses in 8 steps = tresillo', '5 in 8 = cinquillo', '7 in 16 for complex polyrhythm'], goodFor: ['euclidean rhythms', 'polyrhythm', 'world music'], cpuWeight: 'low', live12New: true },
]

// ═══════════════════════════════════════════════════════════════════════════
// EFFECT CHAINS (20+)
// ═══════════════════════════════════════════════════════════════════════════

const EFFECT_CHAINS: EffectChain[] = [
  { name: 'Warm Vocals', purpose: 'Warm, present vocal chain', chain: ['EQ Eight (HP 80Hz, cut 200-300Hz muddy range)', 'Compressor (ratio 3:1, attack 10ms, release 100ms)', 'Saturator (Analog Clip, drive 2-3dB, dry/wet 30%)', 'EQ Eight (boost 3kHz presence, shelf 10kHz air)', 'Reverb (plate, decay 1.8s, predelay 30ms, dry/wet 15%)'], notes: 'De-ess before the chain if sibilant. Automate reverb wet for verses vs chorus.' },
  { name: 'Radio Vocals', purpose: 'Bright, upfront broadcast vocal', chain: ['EQ Eight (HP 120Hz, cut 300Hz, boost 5kHz, shelf 12kHz)', 'Compressor (ratio 4:1, fast attack, medium release)', 'Multiband Dynamics (OTT preset, dry/wet 30%)', 'Limiter (ceiling -1dB)', 'Echo (short slapback 50ms, 10% wet)'], notes: 'Aggressive processing — meant to cut through dense mixes.' },
  { name: 'Punchy Drums', purpose: 'Hard-hitting drum bus', chain: ['Drum Buss (soft drive, transients +30%, boom 80Hz)', 'Glue Compressor (ratio 4:1, attack 3ms, release auto, range -6dB)', 'EQ Eight (boost 4kHz snap, cut 400Hz box)'], notes: 'Sidechain kick from the compressor for extra pump if desired.' },
  { name: 'Fat Kick', purpose: 'Deep, punchy kick drum', chain: ['EQ Eight (HP 30Hz, cut 300-400Hz box, boost 60Hz sub, boost 3-5kHz click)', 'Compressor (ratio 4:1, attack 10ms to let transient through)', 'Saturator (drive 3dB for harmonic weight)'], notes: 'Layer sub sine under acoustic kick for extra depth.' },
  { name: 'Crispy Snare', purpose: 'Bright, cracking snare', chain: ['EQ Eight (HP 100Hz, boost 200Hz body, boost 5kHz crack)', 'Compressor (ratio 6:1, fast attack)', 'Reverb (room, decay 0.5s, dry/wet 10%)'], notes: 'Parallel compress a copy with heavy ratio for extra impact.' },
  { name: 'Wide Pad', purpose: 'Lush, wide synth pad', chain: ['Chorus-Ensemble (Ensemble mode, subtle amount)', 'Auto Filter (LP, freq 8kHz, slow LFO for gentle sweep)', 'Reverb (hall, decay 4s, high diffusion, dry/wet 40%)', 'Utility (width 140%)'], notes: 'Keep pad in upper-mid range, leave low end for bass.' },
  { name: 'Clean Bass', purpose: 'Tight, defined bass', chain: ['EQ Eight (HP 30Hz, slight boost 80Hz fundamental, cut 200-300Hz if muddy)', 'Compressor (ratio 4:1, medium attack to keep pluck, fast release)', 'Utility (bass mono below 200Hz, width 0%)'], notes: 'Bass should be mono. Sidechain from kick for space.' },
  { name: 'Distorted Bass', purpose: 'Gritty, aggressive bass', chain: ['Saturator (Hard Curve, drive 10dB)', 'Auto Filter (LP, freq 2kHz)', 'EQ Eight (HP 40Hz, boost 100Hz)', 'Compressor (ratio 8:1, fast)'], notes: 'Run parallel with clean bass for definition + grit.' },
  { name: '808 Bass', purpose: 'Sub-heavy 808 bass', chain: ['Saturator (Analog Clip, drive 5dB, for harmonics on small speakers)', 'EQ Eight (HP 25Hz, boost 50-60Hz, cut 200Hz)', 'Glue Compressor (ratio 4:1, slow attack for transient)', 'Utility (bass mono 200Hz)'], notes: 'Saturation creates harmonics that make 808 audible on laptop speakers.' },
  { name: 'Master Bus', purpose: 'Mastering chain', chain: ['EQ Eight (gentle HP 25Hz, subtle broad boosts/cuts)', 'Glue Compressor (ratio 2:1, attack 10ms, release auto, range -3dB)', 'Multiband Dynamics (subtle, just evening bands)', 'Saturator (Analog Clip, drive 1dB, for warmth)', 'Limiter (ceiling -0.3dB, target -14 LUFS streaming)'], notes: 'Mastering should be subtle. If you need more than 3dB of gain reduction, fix the mix.' },
  { name: 'Lo-Fi Chain', purpose: 'Vintage lo-fi processing', chain: ['EQ Eight (HP 200Hz, LP 8kHz — narrow bandwidth)', 'Saturator (drive 5dB for warmth)', 'Redux (12-bit, downsample to taste)', 'Vinyl Distortion (crackle 20%, tracing subtle)', 'Chorus-Ensemble (Classic, slow rate for warble)', 'Utility (width 80% for focused stereo)'], notes: 'Key to lo-fi: bandwidth reduction + subtle imperfection.' },
  { name: 'Ambient Wash', purpose: 'Huge ambient reverb', chain: ['Auto Filter (LP sweep, LFO slow)', 'Grain Delay (pitch +12, spray 50, feedback 60%)', 'Hybrid Reverb (Shimmer algo, decay 8s, blend 70% algo)', 'Utility (width 150%)'], notes: 'Freeze the Hybrid Reverb for infinite sustain.' },
  { name: 'Sidechain Pump', purpose: 'Classic EDM sidechain pumping', chain: ['Compressor (sidechain from kick, ratio 10:1, attack 0.1ms, release 100-200ms, threshold -30dB)'], notes: 'Route kick audio to the compressor sidechain input. Release time controls pump shape. Or use Auto Filter with envelope follower sidechained from kick.' },
  { name: 'Parallel Compression', purpose: 'NY compression for punch + dynamics', chain: ['On a Return track: Compressor (ratio 10:1, fast attack, slow release, heavy compression)', 'EQ Eight (HP 100Hz to avoid bass bloat)'], notes: 'Send drums/vocals to this return. Blend the crushed return with dry signal. Adds punch without killing dynamics.' },
  { name: 'Vocal Chop', purpose: 'Chopped and processed vocal', chain: ['Simpler (Slice mode, load vocal sample)', 'Auto Filter (BP, resonant, LFO modulated)', 'Grain Delay (short time, pitch random)', 'Reverb (plate, decay 1.5s, dry/wet 25%)'], notes: 'Slice the vocal in Simpler, trigger slices via MIDI.' },
  { name: 'Synth Lead Cut-Through', purpose: 'Make a lead synth cut through the mix', chain: ['EQ Eight (cut 200-400Hz to reduce mud, boost 2-4kHz for presence)', 'Compressor (ratio 4:1 for consistent level)', 'Saturator (subtle drive for harmonics)', 'Delay (1/8 dotted, 15% wet for space)'], notes: 'Slightly widen with Chorus-Ensemble if it needs more space.' },
  { name: 'String Ensemble', purpose: 'Warm orchestral strings', chain: ['EQ Eight (HP 100Hz, gentle boost 1-3kHz for presence)', 'Compressor (ratio 2:1, slow attack, slow release for smooth dynamics)', 'Reverb (hall, decay 3s, dry/wet 30%)', 'Chorus-Ensemble (Ensemble, subtle for lushness)'], notes: 'Strings need space — don\'t over-compress.' },
  { name: 'Acoustic Guitar', purpose: 'Warm, present acoustic guitar', chain: ['EQ Eight (HP 80Hz, cut 200Hz if boomy, boost 5kHz sparkle)', 'Compressor (ratio 3:1, medium attack)', 'Reverb (room, decay 1s, dry/wet 15%)', 'Chorus-Ensemble (Classic, very subtle for width)'], notes: 'Less is more with acoustic guitar. Keep it natural.' },
]

// ═══════════════════════════════════════════════════════════════════════════
// GENRE TEMPLATES (12)
// ═══════════════════════════════════════════════════════════════════════════

const GENRE_TEMPLATES: GenreTemplate[] = [
  { name: 'House', bpm: [120, 130], tracks: ['Kick (Drum Rack)', 'Hats/Perc (Drum Rack)', 'Bass (Operator/Analog)', 'Chords (Wavetable/Electric)', 'Lead/Vocal', 'FX/Riser', 'Return A: Reverb (plate)', 'Return B: Delay (ping-pong 1/8)'], chordStyle: 'Major 7ths, jazzy voicings, extended chords', drumPattern: 'house', mixNotes: ['Sidechain bass + chords from kick', 'Keep kick and bass mono', 'Wide pads and FX', 'High-pass everything except kick and bass'], keys: ['C', 'F', 'G', 'Am', 'Dm'] },
  { name: 'Techno', bpm: [125, 140], tracks: ['Kick (Drum Rack, layered)', 'Hats (Drum Rack)', 'Percussion (Drum Rack)', 'Bass (Operator, dark)', 'Pad/Texture (Wavetable/Drift)', 'FX/Noise sweep', 'Return A: Reverb (dark hall)', 'Return B: Delay (ping-pong)'], chordStyle: 'Minimal — single notes, drones, sparse chords', drumPattern: 'techno', mixNotes: ['Heavy kick processing (Drum Buss)', 'Dark, low-passed reverb', 'Automate filter sweeps for builds', 'Less is more — space is key'], keys: ['Am', 'Cm', 'Dm', 'Em'] },
  { name: 'Hip-Hop', bpm: [80, 100], tracks: ['Kick (Drum Sampler, boomy)', 'Snare/Clap (Drum Rack)', 'Hats (Drum Rack, swing)', 'Bass (Operator 808 or Simpler)', 'Chords/Sample (Simpler/Electric)', 'Lead/Melody', 'Vocal', 'Return A: Reverb (plate)', 'Return B: Delay (1/4 note)'], chordStyle: 'Soul chords, minor 7ths, 9ths, sample-based', drumPattern: 'hiphop', mixNotes: ['Heavy swing on hats', 'Layer 808 with short kick for attack', 'Sample chops for character', 'Wide vocal ad-libs, centered lead vocal'], keys: ['Cm', 'Fm', 'Am', 'Gm'] },
  { name: 'Trap', bpm: [130, 170], tracks: ['808 (Operator/Simpler)', 'Kick (short, punchy)', 'Snare/Clap', 'Hi-hats (fast rolls)', 'Melody (Wavetable/bells)', 'Vocal/Ad-libs', 'FX (risers, impacts)', 'Return A: Reverb', 'Return B: Delay'], chordStyle: 'Minor, dark, sparse. Melodies > chords', drumPattern: 'trap', mixNotes: ['808 is the bass — tune it to key', 'Hi-hat rolls: 1/16, 1/32 with velocity variation', 'Half-time feel despite high BPM', 'Reverb on snare for depth'], keys: ['Cm', 'Em', 'Am', 'F#m'] },
  { name: 'Pop', bpm: [100, 130], tracks: ['Drums (Drum Rack, punchy)', 'Bass (clean, consistent)', 'Keys/Piano (Electric/Wavetable)', 'Pad/Strings', 'Lead Synth', 'Vocal (main)', 'Vocal (harmonies)', 'Return A: Reverb (plate)', 'Return B: Delay (1/8)'], chordStyle: 'I V vi IV, bright major keys, simple progressions', drumPattern: 'pop', mixNotes: ['Vocal is king — everything serves the vocal', 'Bright, wide, polished mix', 'Layers and stacks for energy in choruses', 'Compression for consistency'], keys: ['C', 'G', 'D', 'A', 'E'] },
  { name: 'Jazz', bpm: [80, 160], tracks: ['Drums (Drum Rack, brushes/sticks)', 'Upright Bass (Simpler)', 'Piano (Electric/Grand)', 'Horns (Sampler)', 'Guitar (Simpler)', 'Return A: Reverb (room)', 'Return B: Delay (subtle)'], chordStyle: 'ii-V-I, extended chords (9ths, 11ths, 13ths), altered dominants, tritone subs', drumPattern: 'jazz', mixNotes: ['Minimal processing — natural dynamics', 'Room reverb for live feel', 'Subtle compression if any', 'Wide stereo image mimicking stage placement'], keys: ['Bb', 'Eb', 'F', 'Ab', 'Db'] },
  { name: 'Ambient', bpm: [60, 100], tracks: ['Pad 1 (Wavetable/Drift, long attack)', 'Pad 2 (Granulator III)', 'Texture (field recordings via Simpler)', 'Bass (deep sub, slow)', 'Melody (sparse, reverbed)', 'Return A: Hybrid Reverb (shimmer, 8s+)', 'Return B: Grain Delay'], chordStyle: 'Suspended chords, open voicings, drones, ambiguous tonality', drumPattern: 'ambient', mixNotes: ['Long reverb tails — let things breathe', 'Automate everything slowly', 'Less notes = more impact', 'Spectral effects (Spectral Time/Resonator) for texture'], keys: ['C', 'Am', 'Em', 'D'] },
  { name: 'Drum & Bass', bpm: [170, 180], tracks: ['Breaks (Drum Rack, sliced Amen/Think)', 'Sub Bass (Operator sine)', 'Reese Bass (Wavetable, detuned)', 'Pad/Atmosphere', 'Lead/Stab', 'FX (risers, impacts)', 'Return A: Reverb (short)', 'Return B: Delay (1/8)'], chordStyle: 'Minor keys, simple progressions, bass is melodic', drumPattern: 'dnb', mixNotes: ['Layer sub + mid-range bass', 'Heavy processing on breaks (Drum Buss, distortion)', 'Sidechain bass from kick hits in breaks', 'Tight, fast mixing'], keys: ['Am', 'Em', 'Dm', 'Cm'] },
  { name: 'Lo-Fi', bpm: [70, 90], tracks: ['Drums (Drum Rack, vintage samples)', 'Bass (warm, round)', 'Keys (Electric Rhodes)', 'Guitar (Simpler, jazzy sample)', 'Vinyl texture (Simpler, ambient loop)', 'Return A: Reverb (warm room)', 'Return B: Echo (tape style)'], chordStyle: 'Jazz chords — Maj7, m7, 9ths. Lush, smooth harmony', drumPattern: 'lofi', mixNotes: ['Lo-fi chain on master (EQ bandwidth reduction + vinyl + redux)', 'Swing on drums (60-70%)', 'Everything slightly detuned', 'Sidechain bass from kick subtly'], keys: ['C', 'F', 'Bb', 'Eb'] },
  { name: 'R&B', bpm: [65, 85], tracks: ['Drums (Drum Rack, tight)', '808/Bass (deep, sustained)', 'Keys (Electric, neo-soul)', 'Pad (warm, lush)', 'Lead vocal', 'Backing vocals/harmonies', 'Return A: Reverb (plate)', 'Return B: Delay (1/4)'], chordStyle: '9ths, 11ths, add9, neo-soul voicings, chromatic movement', drumPattern: 'hiphop', mixNotes: ['Vocals centered and upfront', 'Warm, smooth overall tone', 'Subtle sidechain on bass', 'Lots of reverb on vocals and pads'], keys: ['Db', 'Ab', 'Eb', 'Bb', 'Gb'] },
  { name: 'Reggaeton', bpm: [90, 100], tracks: ['Kick/Snare (Drum Rack, Dembow pattern)', 'Hi-hats/Perc', 'Bass (808 style)', 'Chords/Synth', 'Lead vocal', 'Ad-libs/FX', 'Return A: Reverb', 'Return B: Delay (1/8 dotted)'], chordStyle: 'Minor keys, simple progressions, i-VII-VI-V', drumPattern: 'reggaeton', mixNotes: ['Dembow rhythm is the foundation — kick on 1, snare on 3', 'Bass follows vocal melody', 'Bright, punchy mix', 'Heavy reverb on snare'], keys: ['Am', 'Dm', 'Em', 'Cm'] },
  { name: 'Rock', bpm: [100, 140], tracks: ['Drums (Drum Rack, acoustic kit)', 'Bass (Amp + Cabinet)', 'Guitar L (Amp + Pedal)', 'Guitar R (Amp + Pedal)', 'Keys (if needed)', 'Vocal', 'Return A: Reverb (room)', 'Return B: Delay (slapback)'], chordStyle: 'Power chords, major/minor, pentatonic riffs', drumPattern: 'rock', mixNotes: ['Double-track guitars hard L/R for width', 'Bass fills the center with kick', 'Room reverb for live feel', 'Slapback delay on vocals'], keys: ['E', 'A', 'D', 'G', 'C'] },
]

// ═══════════════════════════════════════════════════════════════════════════
// MIXING RULES (15 instruments)
// ═══════════════════════════════════════════════════════════════════════════

const MIXING_RULES: MixingRule[] = [
  { instrument: 'kick', eq: ['HP 30Hz to remove sub-rumble', 'Boost 50-80Hz for weight', 'Cut 200-400Hz to remove boxiness', 'Boost 3-5kHz for beater click/attack'], compression: ['Ratio 4:1-6:1', 'Attack 10-30ms (let transient through)', 'Release: fast for punchy, slow for sustained'], panning: 'Center always', tips: ['Layer a sub sine underneath for extra low end', 'Sidechain other bass elements from kick', 'Gate if kick mic has bleed'] },
  { instrument: 'snare', eq: ['HP 80-100Hz', 'Boost 150-250Hz for body', 'Cut 400-800Hz if boxy', 'Boost 3-5kHz for crack', 'Boost 8-10kHz for sizzle/snare wires'], compression: ['Ratio 4:1-8:1', 'Fast attack for controlled, slow attack for punchy', 'Medium release'], panning: 'Center or slightly off-center', tips: ['Parallel compress heavily for impact', 'Reverb (plate or room) for depth', 'Layer with clap for hybrid sound'] },
  { instrument: 'hihats', eq: ['HP 300-500Hz aggressively', 'Boost 8-12kHz for shimmer', 'Cut 1-2kHz if harsh'], compression: ['Light compression if any', 'Transient shaper more useful'], panning: 'Slight off-center (10-30%)', tips: ['Velocity variation is key to realism', 'Pan open/closed hats slightly differently', 'Less is more — hats carry groove through velocity, not volume'] },
  { instrument: 'bass', eq: ['HP 30Hz to remove sub-rumble', 'Boost 60-100Hz for fundamental', 'Cut 200-300Hz if muddy', 'Boost 700Hz-1kHz for definition/growl'], compression: ['Ratio 4:1-6:1', 'Medium attack to keep pluck', 'Fast release'], panning: 'Center always — bass must be mono', tips: ['Utility: bass mono below 200Hz', 'Sidechain from kick for space', 'Saturate for harmonics on small speakers'] },
  { instrument: 'synth_lead', eq: ['HP 100-200Hz (no bass needed)', 'Cut 200-400Hz if muddy', 'Boost 2-4kHz for presence', 'Boost 8kHz for air'], compression: ['Ratio 3:1-4:1 for consistency', 'Medium attack/release'], panning: 'Center or slight off-center', tips: ['Delay (dotted 1/8) for space', 'Saturate for harmonic richness', 'Automate filter cutoff for movement'] },
  { instrument: 'synth_pad', eq: ['HP 100-200Hz to leave room for bass', 'Cut 200-500Hz to prevent muddiness', 'Gentle boost 3-5kHz for presence'], compression: ['Light compression or none', 'Slow attack, slow release'], panning: 'Wide (120-150% width)', tips: ['Chorus-Ensemble for lushness', 'Reverb for depth', 'Sidechain from drums to keep pads out of transient space', 'Roll off highs if competing with vocals'] },
  { instrument: 'vocals', eq: ['HP 80-100Hz', 'Cut 200-300Hz if muddy/boxy', 'Boost 3-5kHz for presence/clarity', 'Boost 10-12kHz shelf for air', 'Narrow cut at 2.5kHz if nasal'], compression: ['Ratio 3:1-4:1', 'Attack 5-15ms', 'Release 50-100ms', 'Gain reduction: 3-6dB max'], panning: 'Lead vocal: dead center. Harmonies: wide L/R', tips: ['De-ess before/after compression', 'Plate reverb for smooth tail', 'Delay (1/4 or 1/8) for space', 'Automate volume rides for consistent level', 'Double-track and pan harmonies hard L/R'] },
  { instrument: 'acoustic_guitar', eq: ['HP 80-100Hz', 'Cut 200Hz if boomy (especially close-mic)', 'Boost 3-5kHz for sparkle', 'Boost 10-12kHz for air'], compression: ['Ratio 3:1, medium attack/release', 'Gentle — preserve dynamics'], panning: 'One guitar center or slight off. Two guitars: hard L/R', tips: ['Double-track for width', 'Light chorus for shimmer', 'Short room reverb for space'] },
  { instrument: 'electric_guitar', eq: ['HP 80-100Hz', 'Cut 200-400Hz if muddy', 'Boost 1-3kHz for bite', 'LP 10-12kHz to remove fizz (distorted)'], compression: ['Amp already compresses — add light bus comp', 'Ratio 2:1-3:1'], panning: 'Two guitars: hard L/R. One guitar: off-center', tips: ['Double-track is standard for rock', 'Amp → Cabinet → room reverb', 'High-pass aggressively if bass is present'] },
  { instrument: 'piano', eq: ['HP 60Hz', 'Cut 200-400Hz if boomy', 'Boost 3-5kHz for clarity', 'Boost 10kHz for air'], compression: ['Light 2:1-3:1', 'Slow attack to preserve transients', 'Slow release'], panning: 'Stereo: natural L/R. Mono: center or slightly off', tips: ['Less processing is better for piano', 'Room reverb for realism', 'Avoid over-EQing — piano covers wide frequency range'] },
  { instrument: 'strings', eq: ['HP 100Hz', 'Cut 200-300Hz if muddy', 'Boost 1-3kHz gently for presence', 'LP 12-15kHz for darker tone if desired'], compression: ['Very light 2:1 if any', 'Slow attack/release to preserve expression'], panning: 'Wide stereo for orchestral, or pan sections (violins L, cellos R)', tips: ['Hall reverb for orchestral depth', 'Less is more — let the arrangement breathe', 'Layer with synth pad for hybrid sound'] },
  { instrument: 'brass', eq: ['HP 100Hz', 'Cut 300-500Hz if honky', 'Boost 1-2kHz for body', 'Boost 5-8kHz for brilliance'], compression: ['Ratio 3:1-4:1', 'Medium attack/release'], panning: 'Pan sections across stereo field', tips: ['Reverb (room or hall) for space', 'Can handle more compression than strings', 'Saturate for grit in funk/soul context'] },
  { instrument: 'organ', eq: ['HP 60Hz', 'Boost 800Hz-1kHz for body', 'Boost 3-5kHz for bite', 'Cut 200Hz if boomy'], compression: ['Light or none — organ is already sustained'], panning: 'Slight off-center or stereo if Leslie sim', tips: ['Auto Pan-Tremolo or Chorus for Leslie speaker effect', 'Overdrive for gospel/rock organ', 'Reverb for church organ sound'] },
  { instrument: 'percussion', eq: ['HP varies by instrument', 'Boost attack frequencies (2-5kHz)', 'Cut muddiness (200-400Hz)'], compression: ['Transient shaper more useful than compression', 'Gate if needed for bleed'], panning: 'Spread across stereo field for width', tips: ['Pan different percussion elements to different positions', 'Use groove/swing for feel', 'Layer subtle percussion for texture'] },
  { instrument: 'master', eq: ['HP 25-30Hz to remove sub-rumble', 'Gentle broad adjustments only', 'If you need big moves, fix the mix'], compression: ['Glue Compressor ratio 2:1', 'Slow attack (10-30ms)', 'Auto release', 'Max 2-3dB gain reduction'], panning: 'N/A — check mono compatibility with Utility', tips: ['Limiter last: ceiling -0.3dB, target -14 LUFS for streaming', 'Reference against commercial tracks', 'Take breaks — ear fatigue is real', 'If the master sounds bad, the mix needs work, not more mastering'] },
]

// ═══════════════════════════════════════════════════════════════════════════
// SIGNAL FLOW PATHS
// ═══════════════════════════════════════════════════════════════════════════

const SIGNAL_FLOWS: Array<{ name: string, steps: string[], notes: string }> = [
  { name: 'Basic Audio Signal Flow', steps: ['Audio Input/Sample → Device Chain (instruments → audio effects) → Track Volume/Pan → Sends → Main Out'], notes: 'Audio flows left-to-right through the device chain. Pre-fader sends go before volume, post-fader after.' },
  { name: 'MIDI Signal Flow', steps: ['MIDI Input → MIDI Effects (arpeggiator, chord, etc.) → Instrument → Audio Effects → Track Volume → Sends → Main Out'], notes: 'MIDI effects process before the instrument. Audio effects process after.' },
  { name: 'Sidechain Compression', steps: ['1. Place Compressor on the track you want to duck (e.g., bass)', '2. Expand the Sidechain section (triangle arrow)', '3. Enable Sidechain', '4. Set Audio From to the trigger track (e.g., Kick)', '5. Set ratio high (10:1+), fast attack, release to taste (100-200ms)', '6. Threshold controls how much ducking'], notes: 'The bass ducks every time the kick hits. Release time controls the pump shape.' },
  { name: 'Parallel Compression (NY Compression)', steps: ['1. Create a Return track (Cmd+Alt+T)', '2. Add Compressor with aggressive settings (10:1, fast attack, slow release)', '3. Send signal from source track to this return', '4. Blend the compressed return with the dry signal using send amount'], notes: 'You get the punch of heavy compression AND the dynamics of the uncompressed signal.' },
  { name: 'Resampling', steps: ['1. Create a new Audio track', '2. Set "Audio From" to the track you want to resample', '3. Set "Audio From" channel to "Post FX"', '4. Arm the new track and record'], notes: 'Captures the full processed output of a track including all effects. Great for committing effects or creating new samples.' },
  { name: 'Group Bus Processing', steps: ['1. Select multiple tracks', '2. Cmd+G to group them', '3. Add effects to the Group track (e.g., Glue Compressor, EQ)', '4. All grouped tracks are summed and processed together'], notes: 'Classic for drum bus compression. Also useful for vocal groups, synth groups.' },
  { name: 'Send/Return Effects', steps: ['1. Create Return track (Cmd+Alt+T)', '2. Add reverb/delay to the Return', '3. On source tracks, increase Send amount', '4. Multiple tracks can share the same reverb'], notes: 'More CPU efficient than effect per track. Provides cohesive space (same reverb on multiple elements).' },
  { name: 'Mid/Side Processing', steps: ['1. Add Utility, set to Mid or Side mode', '2. Process mid and side differently', '3. Or: use EQ Eight in M/S mode for independent EQ'], notes: 'Mid = center (vocals, kick, bass). Side = stereo width (pads, reverb tails). Widen sides and keep bass centered.' },
  { name: 'Vocoder Routing', steps: ['1. Add Vocoder on a synth track (this is the carrier)', '2. Set Carrier to "External"', '3. Route a vocal track to the Vocoder sidechain input', '4. Play synth chords while vocal plays — synth takes shape of voice'], notes: 'Classic robot voice / talk box effect. More bands = more intelligible speech.' },
  { name: 'Freeze & Flatten', steps: ['1. Right-click track → Freeze Track (renders to audio, saves CPU)', '2. Right-click frozen track → Flatten (commits to audio permanently)'], notes: 'Freeze when running out of CPU. Flatten when you\'re done editing and want to commit.' },
]

// ═══════════════════════════════════════════════════════════════════════════
// WARP MODES
// ═══════════════════════════════════════════════════════════════════════════

const WARP_MODES = [
  { name: 'Beats', bestFor: 'Drums, percussion, rhythmic loops', description: 'Preserves transients. Best for material with clear rhythmic hits.', artifacts: 'Can sound choppy on sustained sounds.' },
  { name: 'Tones', bestFor: 'Vocals, single instruments with clear pitch', description: 'Preserves pitch and formants. Good for monophonic melodic material.', artifacts: 'Can flutter on polyphonic material.' },
  { name: 'Texture', bestFor: 'Ambient, noise, pads, complex textures', description: 'Treats audio as texture, not individual events. Good for atmospheric material.', artifacts: 'Smears transients — not good for drums.' },
  { name: 'Re-Pitch', bestFor: 'DJ-style pitched speeding/slowing, vinyl simulation', description: 'Changes pitch with tempo, like vinyl/tape. No time-stretching artifacts.', artifacts: 'Pitch changes with tempo — not suitable if you need fixed pitch.' },
  { name: 'Complex', bestFor: 'Full mixes, complex polyphonic material', description: 'Advanced algorithm for complex audio. Handles multiple elements well.', artifacts: 'Higher CPU than other modes. Can still artifact on extreme stretching.' },
  { name: 'Complex Pro', bestFor: 'High-quality stretching of complex material, mastering', description: 'Highest quality warping. Formant control for natural pitch shifting.', artifacts: 'Highest CPU usage. Use only when needed.' },
]

// ═══════════════════════════════════════════════════════════════════════════
// SEARCH FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

const ALL_DEVICES = [...INSTRUMENTS, ...AUDIO_EFFECTS, ...MIDI_EFFECTS, ...MIDI_TOOLS]

function searchDevices(query: string): DeviceEntry[] {
  const q = query.toLowerCase()
  return ALL_DEVICES.filter(d =>
    d.name.toLowerCase().includes(q) ||
    d.category.toLowerCase().includes(q) ||
    d.description.toLowerCase().includes(q) ||
    d.goodFor.some(g => g.toLowerCase().includes(q)) ||
    d.keyParams.some(p => p.toLowerCase().includes(q))
  )
}

function searchChains(query: string): EffectChain[] {
  const q = query.toLowerCase()
  return EFFECT_CHAINS.filter(c =>
    c.name.toLowerCase().includes(q) ||
    c.purpose.toLowerCase().includes(q) ||
    c.chain.some(d => d.toLowerCase().includes(q))
  )
}

function searchMixingRules(query: string): MixingRule[] {
  const q = query.toLowerCase()
  return MIXING_RULES.filter(r =>
    r.instrument.toLowerCase().includes(q) ||
    r.tips.some(t => t.toLowerCase().includes(q))
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// TOOL REGISTRATION
// ═══════════════════════════════════════════════════════════════════════════

export function registerAbletonKnowledgeTools(): void {

  registerTool({
    name: 'ableton_knowledge',
    description: 'Deep Ableton Live 12 knowledge base — every native device with parameters, effect chains, genre templates, mixing rules, signal flow, warp modes, and MIDI tools. Ask anything about Ableton.',
    parameters: {
      query: { type: 'string', description: 'What to look up — device name, category, mixing topic, genre, workflow question, etc.', required: true },
      category: { type: 'string', description: 'Optional filter: "device", "chain", "genre", "mixing", "signal_flow", "warp", "midi_tools", "all_devices", "all_effects", "all_instruments"' },
    },
    tier: 'free',
    timeout: 10_000,
    async execute(args) {
      const query = String(args.query).toLowerCase()
      const category = String(args.category || '').toLowerCase()
      const lines: string[] = []

      // List all devices
      if (category === 'all_devices' || query === 'all devices' || query === 'list all') {
        lines.push('## All Ableton Live 12 Devices', '')
        lines.push(`### Instruments (${INSTRUMENTS.length})`)
        for (const d of INSTRUMENTS) lines.push(`- **${d.name}** — ${d.description.slice(0, 80)}${d.live12New ? ' ⭐ NEW' : ''}`)
        lines.push(`\n### Audio Effects (${AUDIO_EFFECTS.length})`)
        for (const d of AUDIO_EFFECTS) lines.push(`- **${d.name}** (${d.category}) — ${d.description.slice(0, 80)}${d.live12New ? ' ⭐ NEW' : ''}`)
        lines.push(`\n### MIDI Effects (${MIDI_EFFECTS.length})`)
        for (const d of MIDI_EFFECTS) lines.push(`- **${d.name}** — ${d.description.slice(0, 80)}`)
        lines.push(`\n### MIDI Tools (${MIDI_TOOLS.length}) ⭐ Live 12`)
        for (const d of MIDI_TOOLS) lines.push(`- **${d.name}** (${d.category}) — ${d.description.slice(0, 80)}`)
        lines.push(`\n**Total: ${ALL_DEVICES.length} native devices**`)
        return lines.join('\n')
      }

      if (category === 'all_instruments') {
        lines.push('## Ableton Instruments', '')
        for (const d of INSTRUMENTS) {
          lines.push(`### ${d.name}${d.live12New ? ' ⭐ NEW' : ''}`)
          lines.push(d.description)
          lines.push(`**Good for**: ${d.goodFor.join(', ')}`)
          lines.push(`**Key params**: ${d.keyParams.join(', ')}`)
          lines.push('')
        }
        return lines.join('\n')
      }

      if (category === 'all_effects') {
        lines.push('## Ableton Audio Effects', '')
        const byCategory: Record<string, DeviceEntry[]> = {}
        for (const d of AUDIO_EFFECTS) {
          if (!byCategory[d.category]) byCategory[d.category] = []
          byCategory[d.category].push(d)
        }
        for (const [cat, devices] of Object.entries(byCategory)) {
          lines.push(`### ${cat.charAt(0).toUpperCase() + cat.slice(1)} (${devices.length})`)
          for (const d of devices) lines.push(`- **${d.name}**: ${d.description.slice(0, 100)}${d.live12New ? ' ⭐' : ''}`)
          lines.push('')
        }
        return lines.join('\n')
      }

      // Genre templates
      if (category === 'genre' || /template|genre|set.?up/i.test(query)) {
        const template = GENRE_TEMPLATES.find(t => query.includes(t.name.toLowerCase()))
        if (template) {
          lines.push(`## ${template.name} Template`, '')
          lines.push(`**BPM**: ${template.bpm[0]}-${template.bpm[1]}`)
          lines.push(`**Keys**: ${template.keys.join(', ')}`)
          lines.push(`**Chord style**: ${template.chordStyle}`)
          lines.push('', '**Track setup**:')
          template.tracks.forEach((t, i) => lines.push(`${i + 1}. ${t}`))
          lines.push('', '**Mix notes**:')
          template.mixNotes.forEach(n => lines.push(`- ${n}`))
          return lines.join('\n')
        }
        // List all genres
        lines.push('## Genre Templates', '')
        for (const t of GENRE_TEMPLATES) {
          lines.push(`- **${t.name}** (${t.bpm[0]}-${t.bpm[1]} BPM): ${t.chordStyle.slice(0, 60)}`)
        }
        return lines.join('\n')
      }

      // Signal flow
      if (category === 'signal_flow' || /signal|routing|sidechain|parallel|resampl|freeze|flatten|send|return|mid.?side|vocoder/i.test(query)) {
        const matched = SIGNAL_FLOWS.filter(s => s.name.toLowerCase().includes(query) || s.steps.some(st => st.toLowerCase().includes(query)) || s.notes.toLowerCase().includes(query))
        if (matched.length > 0) {
          for (const flow of matched) {
            lines.push(`## ${flow.name}`, '')
            flow.steps.forEach(s => lines.push(`${s}`))
            lines.push(`\n*${flow.notes}*`, '')
          }
          return lines.join('\n')
        }
        // List all signal flows
        lines.push('## Signal Flow Paths', '')
        for (const s of SIGNAL_FLOWS) lines.push(`- **${s.name}**: ${s.notes.slice(0, 80)}`)
        return lines.join('\n')
      }

      // Warp modes
      if (category === 'warp' || /warp|stretch|time.?stretch/i.test(query)) {
        lines.push('## Warp Modes', '')
        for (const w of WARP_MODES) {
          lines.push(`### ${w.name}`)
          lines.push(`**Best for**: ${w.bestFor}`)
          lines.push(w.description)
          lines.push(`*Artifacts*: ${w.artifacts}`, '')
        }
        return lines.join('\n')
      }

      // MIDI tools
      if (category === 'midi_tools' || /midi tool|generator|transformation/i.test(query)) {
        lines.push('## MIDI Tools (Live 12)', '')
        lines.push('### Transformations')
        for (const t of MIDI_TOOLS.filter(t => t.category === 'transformation')) {
          lines.push(`- **${t.name}**: ${t.description}`)
        }
        lines.push('', '### Generators')
        for (const t of MIDI_TOOLS.filter(t => t.category === 'generator')) {
          lines.push(`- **${t.name}**: ${t.description}`)
          if (t.sweetSpots.length) lines.push(`  *Tip*: ${t.sweetSpots[0]}`)
        }
        return lines.join('\n')
      }

      // Effect chains
      if (category === 'chain' || /chain|how.?to.?(mix|process|eq|compress)|vocal chain|drum chain|master chain/i.test(query)) {
        const matched = searchChains(query)
        if (matched.length > 0) {
          for (const chain of matched.slice(0, 3)) {
            lines.push(`## ${chain.name}`, `*${chain.purpose}*`, '')
            chain.chain.forEach((d, i) => lines.push(`${i + 1}. ${d}`))
            lines.push(`\n*${chain.notes}*`, '')
          }
          return lines.join('\n')
        }
        // List all chains
        lines.push('## Effect Chains', '')
        for (const c of EFFECT_CHAINS) lines.push(`- **${c.name}**: ${c.purpose}`)
        return lines.join('\n')
      }

      // Mixing rules
      if (category === 'mixing' || /mix|eq tip|compress|panning|gain stag/i.test(query)) {
        const matched = searchMixingRules(query)
        if (matched.length > 0) {
          for (const rule of matched.slice(0, 3)) {
            lines.push(`## Mixing: ${rule.instrument}`, '')
            lines.push('**EQ**:')
            rule.eq.forEach(e => lines.push(`- ${e}`))
            lines.push('\n**Compression**:')
            rule.compression.forEach(c => lines.push(`- ${c}`))
            lines.push(`\n**Panning**: ${rule.panning}`)
            lines.push('\n**Tips**:')
            rule.tips.forEach(t => lines.push(`- ${t}`))
            lines.push('')
          }
          return lines.join('\n')
        }
        lines.push('## Mixing Rules', '')
        for (const r of MIXING_RULES) lines.push(`- **${r.instrument}**: ${r.tips[0]}`)
        return lines.join('\n')
      }

      // Device search (default)
      const matched = searchDevices(query)
      if (matched.length > 0) {
        for (const d of matched.slice(0, 5)) {
          lines.push(`## ${d.name}${d.live12New ? ' ⭐ Live 12' : ''}`)
          lines.push(`**Type**: ${d.type} | **Category**: ${d.category} | **CPU**: ${d.cpuWeight}${d.sidechain ? ' | **Sidechain**: Yes' : ''}`)
          lines.push('')
          lines.push(d.description)
          lines.push('')
          lines.push('**Key Parameters**: ' + d.keyParams.join(', '))
          lines.push('')
          if (d.sweetSpots.length) {
            lines.push('**Sweet Spots**:')
            d.sweetSpots.forEach(s => lines.push(`- ${s}`))
          }
          lines.push('')
          lines.push('**Good for**: ' + d.goodFor.join(', '))
          lines.push('')
        }
        return lines.join('\n')
      }

      return `No results for "${args.query}". Try: a device name (Wavetable, Compressor), category (reverb, delay, synth), genre (house, jazz), topic (sidechain, mastering, vocal chain), or use category="all_devices" to list everything.`
    },
  })
}
