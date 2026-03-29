# K:BOT Producer + Sound Engineer Agent — Architecture Specification

**Agent ID**: `producer` (upgraded from current)
**File**: `packages/kbot/src/agents/producer.ts`
**New companion**: `packages/kbot/src/tools/producer-engine.ts`
**Version**: v2.0 — Unified Producer + Sound Engineer

---

## 1. Problem Statement

The current `producer` agent is a DAW controller. It knows how to send OSC commands and has a solid knowledge base, but it lacks two critical capabilities:

1. **Producer intelligence** — When a user says "make a trap beat," the current agent needs the user to specify every detail. A real producer would make 50+ creative decisions instantly: key, tempo, scale, instruments, patterns, voicings, arrangement, sound selection.

2. **Sound engineer intelligence** — After creating tracks, the current agent does not auto-mix. A real engineer would set volumes, pan positions, EQ, compression, sends, sidechain, and master chain without being asked.

This spec designs a unified agent that combines both. One prompt, one engine, one shot.

---

## 2. Architecture Overview

```
User: "make a trap beat"
         │
         ▼
┌─────────────────────────┐
│   PRODUCER AGENT        │  (system prompt in producer.ts)
│   Understands intent    │
│   Picks genre           │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│   GENRE DECISION ENGINE │  (producer-engine.ts)
│   Resolves all creative │
│   decisions from genre  │
│   preset + randomization│
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│   EXECUTION PIPELINE    │  (producer-engine.ts)
│   13-step sequence      │
│   using existing tools  │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│   MIX ENGINE            │  (producer-engine.ts)
│   Auto-applies volumes, │
│   panning, sends, EQ    │
│   based on genre preset │
└────────┬────────────────┘
         │
         ▼
     Report to user
```

The engine is a **new tool** (`produce_beat` / `produce_track`) registered alongside the existing Ableton tools. The agent's system prompt instructs it to call this tool for full-track requests, while still having access to individual tools for surgical operations.

---

## 3. File Structure

```
packages/kbot/src/
├── agents/
│   └── producer.ts              # UPGRADED — new system prompt + exports
├── tools/
│   ├── ableton.ts               # UNCHANGED — 14 existing tools
│   ├── ableton-knowledge.ts     # UNCHANGED — knowledge base
│   ├── music-theory.ts          # UNCHANGED — theory primitives
│   └── producer-engine.ts       # NEW — decision engine + execution pipeline + mix engine
└── integrations/
    └── ableton-osc.ts           # UNCHANGED — UDP transport
```

---

## 4. Genre Decision Engine

### 4.1 Genre Preset Type

```typescript
export interface GenrePreset {
  id: string
  name: string

  // Musical foundation
  bpmRange: [number, number]
  preferredKeys: string[]
  preferredScales: string[]
  timeSignature: [number, number]
  feel: 'straight' | 'halftime' | 'shuffle' | 'swing'

  // Track layout
  tracks: TrackSpec[]

  // Progression
  progressionStyle: ProgressionStyle

  // Drum programming
  drumStyle: DrumStyle

  // Mix template
  mixTemplate: MixTemplate

  // Sound design notes for the agent's context
  productionNotes: string[]
}

export interface TrackSpec {
  name: string
  role: 'drums' | 'bass' | 'harmony' | 'melody' | 'pad' | 'perc' | 'fx' | 'vocal'
  instrument: InstrumentChoice
  midiContent: 'drum_pattern' | 'bass_line' | 'chord_progression' | 'melody' | 'pad_chords' | 'perc_pattern' | 'fx' | 'none'
  color: number  // Ableton track color index
}

export interface InstrumentChoice {
  /** Primary choice — native Ableton device */
  primary: string
  /** Specific preset name or description for the agent */
  presetHint: string
  /** Roland Cloud alternative if available */
  rolandCloud?: string
  /** UA alternative if available */
  uaAlternative?: string
  /** Why this instrument for this role */
  rationale: string
}

export interface ProgressionStyle {
  /** Named progressions that work for this genre */
  namedProgressions: string[]
  /** Roman numeral templates */
  romanTemplates: string[]
  /** Preferred voicing */
  voicing: 'close' | 'open' | 'drop2' | 'drop3' | 'spread' | 'shell'
  /** Preferred rhythm for chords */
  chordRhythm: string
  /** Bars per section */
  barsPerSection: number
  /** Octave for chords */
  octave: number
}

export interface DrumStyle {
  /** Base pattern from GENRE_DRUM_PATTERNS */
  basePattern: string
  /** Velocity curve for hi-hats */
  hihatVelocityCurve: 'flat' | 'accent_downbeat' | 'crescendo_roll' | 'random_humanize'
  /** Whether to add ghost notes */
  ghostNotes: boolean
  /** Hi-hat roll probability (0-1) — for trap/drill */
  rollProbability: number
  /** Swing amount 0-100 */
  swing: number
  /** Additional layers beyond the base pattern */
  layers: DrumLayer[]
}

export interface DrumLayer {
  instrument: string  // GM_DRUMS key
  positions: number[] // 16th note positions
  velocity: number
  probability: number // 0-1, for ghost notes / variation
}

export interface MixTemplate {
  /** Per-track volume (0-1 scale), keyed by role */
  volumes: Record<string, number>
  /** Per-track pan (-1 to 1), keyed by role */
  panning: Record<string, number>
  /** Send levels to return tracks */
  sends: SendConfig[]
  /** Return track setup */
  returns: ReturnTrack[]
  /** Master chain */
  masterChain: string[]
  /** Target LUFS */
  targetLUFS: number
}

export interface SendConfig {
  fromRole: string
  toReturn: number  // 0-based return index
  level: number     // 0-1
}

export interface ReturnTrack {
  name: string
  device: string
  presetHint: string
}
```

### 4.2 Genre Presets

Below are the 8 required presets. Each is a complete creative decision matrix.

```typescript
export const GENRE_PRESETS: Record<string, GenrePreset> = {

  trap: {
    id: 'trap',
    name: 'Trap',
    bpmRange: [138, 148],      // sweet spot, not the full 130-170 range
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
          rationale: 'Operator sine gives clean 808 sub. Pitch envelope gives the characteristic attack transient.'
        },
        midiContent: 'bass_line',
        color: 1,  // red
      },
      {
        name: 'Kick',
        role: 'drums',
        instrument: {
          primary: 'Drum Sampler',
          presetHint: 'Short punchy acoustic kick. High transient, fast decay. This provides the click/attack that the 808 lacks.',
          rationale: 'Layered with 808 — this provides attack, 808 provides sustain.'
        },
        midiContent: 'drum_pattern',
        color: 3,  // orange
      },
      {
        name: 'Snare/Clap',
        role: 'drums',
        instrument: {
          primary: 'Drum Rack',
          presetHint: 'Layered snare + clap. C1 = snare, D1 = clap. Both trigger on beat 3 (half-time).',
          rationale: 'Half-time snare is the anchor of trap rhythm.'
        },
        midiContent: 'drum_pattern',
        color: 4,  // yellow
      },
      {
        name: 'Hi-Hats',
        role: 'perc',
        instrument: {
          primary: 'Drum Rack',
          presetHint: 'C1 = closed hat, D1 = open hat. 16th-note patterns with rolls on 32nds. Velocity variation 60-127.',
          rolandCloud: 'TR-808 HiHat',
          rationale: 'Trap hats are the genre signature — fast rolls, velocity ramps, open hat accents.'
        },
        midiContent: 'perc_pattern',
        color: 5,  // green
      },
      {
        name: 'Melody',
        role: 'melody',
        instrument: {
          primary: 'Wavetable',
          presetHint: 'Dark bell/pluck. Short attack, medium decay, no sustain. Wavetable position swept slightly. Chorus for width.',
          rolandCloud: 'JD-800 Digital Bell or JUPITER-8 Brass',
          rationale: 'Trap melodies are sparse, dark, often bell-like or flute-like timbres.'
        },
        midiContent: 'melody',
        color: 7,  // blue
      },
      {
        name: 'Pad',
        role: 'pad',
        instrument: {
          primary: 'Drift',
          presetHint: 'Dark ambient pad. Slow attack (500ms+), long release. Low-pass filtered. Drift 40% for organic movement.',
          rolandCloud: 'JUPITER-8 Pad',
          rationale: 'Subtle background texture. Fills frequency space without competing with melody.'
        },
        midiContent: 'pad_chords',
        color: 9,  // purple
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
      rollProbability: 0.3,  // 30% chance of 32nd-note rolls on any given bar
      swing: 0,              // trap is straight
      layers: [
        { instrument: 'rim', positions: [3, 11], velocity: 60, probability: 0.5 },
      ],
    },

    mixTemplate: {
      volumes: {
        bass: 0.80,     // 808 dominates
        drums: 0.75,    // kick layer under 808
        'drums.snare': 0.78,
        perc: 0.55,     // hats sit back
        melody: 0.60,
        pad: 0.35,
      },
      panning: {
        bass: 0,
        drums: 0,
        'drums.snare': 0,
        perc: 0.05,    // very slightly off-center
        melody: -0.10, // slightly left
        pad: 0,        // stereo from device
      },
      sends: [
        { fromRole: 'melody', toReturn: 0, level: 0.25 },  // reverb
        { fromRole: 'melody', toReturn: 1, level: 0.15 },  // delay
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
          rationale: 'Drill 808s MUST slide. Glide/portamento is non-negotiable.'
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
          rationale: 'Drill drums are tight and punchy, displaced from the grid for that sliding feel.'
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
          rationale: 'Drill hats borrow from trap but add more syncopation and triplet feel.'
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
          rationale: 'Drill melodies are dark, minor, often piano or orchestral.'
        },
        midiContent: 'melody',
        color: 7,
      },
      {
        name: 'Strings',
        role: 'pad',
        instrument: {
          primary: 'Sampler',
          presetHint: 'Dark orchestral strings. Slow attack, sustained. Creates the cinematic drill atmosphere.',
          rationale: 'Strings are signature drill texture — UK drill especially.'
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
          rationale: 'Lo-fi drums should sound like they came off a cassette tape.'
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
          rationale: 'Analog gives the warmest sub. Keep it simple and deep.'
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
          rationale: 'Electric piano is the soul of lo-fi. Jazzy extended chords.'
        },
        midiContent: 'chord_progression',
        color: 7,
      },
      {
        name: 'Guitar',
        role: 'melody',
        instrument: {
          primary: 'Simpler',
          presetHint: 'Jazz guitar sample, chopped. Warp mode: Texture. Filtered, warm. Could be a Nujabes-style sample chop.',
          rationale: 'Sampled guitar gives authenticity. Simpler in Slice mode for chops.'
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
          rationale: 'Vinyl noise is essential lo-fi texture.'
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
      targetLUFS: -16,  // lo-fi is quieter by convention
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
          rationale: '909-style kick is the foundation of house.'
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
          rationale: 'Classic house hat pattern with offbeat opens.'
        },
        midiContent: 'perc_pattern',
        color: 5,
      },
      {
        name: 'Clap',
        role: 'drums',
        instrument: {
          primary: 'Drum Sampler',
          presetHint: 'Tight clap on 2 and 4. Layered with subtle snare for body.',
          rationale: 'Clap drives the backbeat in house.'
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
          rationale: 'SH-101 style mono bass is classic house.'
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
          rationale: 'Warm chord stabs that pump with the kick.'
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
          rationale: 'Fills the frequency spectrum behind the chords.'
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
          rationale: 'R&B drums serve the groove — never overpower the vocal space.'
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
          rationale: 'Modern R&B lives on 808 bass — sustained, warm, melodic.'
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
          rationale: 'Rhodes is the defining R&B keyboard sound. Neo-soul voicings.'
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
          rationale: 'Drift warmth suits R&B perfectly. Keep it subliminal.'
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
          rationale: 'Topline melody that shows where the vocal would sit.'
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
          rationale: 'Phonk kicks are aggressive and distorted.'
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
          rationale: 'Drenched in reverb and distortion.'
        },
        midiContent: 'drum_pattern',
        color: 3,
      },
      {
        name: 'Cowbell',
        role: 'perc',
        instrument: {
          primary: 'Drum Sampler',
          presetHint: 'TR-808 cowbell. THE phonk signature sound. Pitched down slightly.',
          rolandCloud: 'TR-808 Cowbell',
          rationale: 'Cowbell is the single most identifiable phonk element.'
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
          rationale: 'Phonk bass is 808 with heavy distortion.'
        },
        midiContent: 'bass_line',
        color: 1,
      },
      {
        name: 'Sample',
        role: 'melody',
        instrument: {
          primary: 'Simpler',
          presetHint: 'Chopped soul/Memphis rap vocal sample. Dark, filtered. If no sample available, use Wavetable with a dark bell/stab.',
          rationale: 'Phonk is built on samples — chopped Memphis vocals and soul.'
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
      targetLUFS: -12,  // phonk is LOUD
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
          rationale: 'Pluggnb drums are ethereal and soft — opposite of trap aggression.'
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
          rationale: 'Pluggnb bass is clean and melodic — more R&B than trap.'
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
          rationale: 'Pluggnb melodies are bright, dreamy, positive — think Summrs/Autumn.'
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
          rationale: 'Background atmosphere — keeps the dreamy vibe.'
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
          rationale: 'Hats should be present but not dominating.'
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
      octave: 5,  // higher octave for the dreamy feel
    },

    drumStyle: {
      basePattern: 'trap',  // based on trap but softer
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
          rationale: 'Primary texture layer. Should feel like it is always there.'
        },
        midiContent: 'pad_chords',
        color: 9,
      },
      {
        name: 'Pad 2',
        role: 'pad',
        instrument: {
          primary: 'Granulator III',
          presetHint: 'Granular texture from field recording or tonal sample. Freeze + slow scan. Ethereal.',
          rationale: 'Second texture layer. Granular gives organic, evolving quality.'
        },
        midiContent: 'pad_chords',
        color: 10,
      },
      {
        name: 'Melody',
        role: 'melody',
        instrument: {
          primary: 'Collision',
          presetHint: 'Soft mallet on beam resonator. Like a distant marimba or singing bowl. Sparse notes.',
          rationale: 'Physical modeling gives organic resonance. Sparse melody creates focal points.'
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
          rationale: 'Grounds the ambient piece in a physical space.'
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
          rationale: 'Subsonic foundation that you feel more than hear.'
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
      targetLUFS: -20,  // ambient is QUIET
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
}
```

---

## 5. Execution Pipeline

When the agent receives a beat request (e.g., "make a trap beat"), it calls the `produce_track` tool which executes this 13-step pipeline.

### 5.1 Pipeline Overview

```typescript
export async function executeProductionPipeline(
  genre: string,
  userOverrides?: Partial<ProductionOverrides>
): Promise<ProductionReport> {

  const preset = resolvePreset(genre, userOverrides)  // Step 0
  const report: ProductionReport = { steps: [], tracks: [], errors: [] }

  // Step 1: Set tempo + time signature
  await setTransport(preset)

  // Step 2: Create tracks
  const trackMap = await createTracks(preset)

  // Step 3: Set track colors and names
  await colorAndNameTracks(trackMap, preset)

  // Step 4: Create empty clips on all tracks
  await createClips(trackMap, preset)

  // Step 5: Write drum patterns
  await writeDrumPatterns(trackMap, preset)

  // Step 6: Write chord progression (harmony tracks)
  await writeChordProgression(trackMap, preset)

  // Step 7: Generate and write bass line
  await writeBassLine(trackMap, preset)

  // Step 8: Generate and write melody
  await writeMelody(trackMap, preset)

  // Step 9: Write pad chords
  await writePadChords(trackMap, preset)

  // Step 10: Set volumes and panning (mix engine)
  await applyMixTemplate(trackMap, preset)

  // Step 11: Set up return tracks and sends
  await setupSendsAndReturns(trackMap, preset)

  // Step 12: Fire all clips (scene 1)
  await fireAllClips(trackMap)

  // Step 13: Generate report
  return generateReport(preset, trackMap, report)
}
```

### 5.2 Step Details with OSC Timing

Every OSC message follows these timing rules from the existing codebase:
- **Create operations**: 200ms wait after (clip creation, track creation)
- **Fire-and-forget**: No wait needed (volume, pan, mute, note writes)
- **Query operations**: Await response (session_info, device params)
- **Batch writes**: 150ms between tool calls when chaining

```typescript
// Step 1: Transport
async function setTransport(preset: ResolvedPreset): Promise<void> {
  const osc = await ensureAbleton()
  const bpm = randomInRange(preset.bpmRange[0], preset.bpmRange[1])
  osc.send('/live/song/set/tempo', bpm)
  osc.send('/live/song/set/signature_numerator', preset.timeSignature[0])
  osc.send('/live/song/set/signature_denominator', preset.timeSignature[1])
  // No wait needed — these are fire-and-forget
}

// Step 2: Create tracks
// Uses the existing track count from session_info, creates new MIDI tracks
async function createTracks(preset: ResolvedPreset): Promise<Map<string, number>> {
  const osc = await ensureAbleton()
  const trackMap = new Map<string, number>()  // role -> track index (0-based)

  // Get current track count to know where new tracks start
  const countResult = await osc.query('/live/song/get/num_tracks')
  let nextTrack = Number(extractArgs(countResult)[0]) || 0

  for (const spec of preset.tracks) {
    // Create MIDI track at the end
    osc.send('/live/song/create_midi_track', nextTrack)
    await sleep(200)  // wait for track creation

    // Name the track
    osc.send('/live/track/set/name', nextTrack, spec.name)

    trackMap.set(spec.role, nextTrack)
    nextTrack++
  }

  // Create return tracks
  for (const ret of preset.mixTemplate.returns) {
    // Returns are created separately
    osc.send('/live/song/create_return_track')
    await sleep(200)
  }

  return trackMap
}

// Step 5: Drum patterns — the most complex step
async function writeDrumPatterns(
  trackMap: Map<string, number>,
  preset: ResolvedPreset
): Promise<void> {
  const osc = await ensureAbleton()
  const drumPattern = GENRE_DRUM_PATTERNS[preset.drumStyle.basePattern]
  if (!drumPattern) return

  const drumTrackIdx = trackMap.get('drums')
  if (drumTrackIdx === undefined) return

  const clipSlot = 0  // first slot
  const barsToWrite = preset.progressionStyle.barsPerSection
  const totalSixteenths = barsToWrite * 16

  // Write each instrument in the pattern
  for (const [instrumentName, positions] of Object.entries(drumPattern.pattern)) {
    const midiPitch = GM_DRUMS[instrumentName]
    if (midiPitch === undefined) continue

    for (let bar = 0; bar < barsToWrite; bar++) {
      for (const pos of positions) {
        const absolutePos = bar * 16 + pos
        if (absolutePos >= totalSixteenths) continue

        const beatPos = absolutePos / 4  // convert 16th-note index to beat position

        // Apply velocity curve
        let velocity = 80
        velocity = applyVelocityCurve(
          velocity, pos, instrumentName, preset.drumStyle.hihatVelocityCurve
        )

        // Apply ghost note probability
        if (preset.drumStyle.ghostNotes && instrumentName === 'snare') {
          // Add ghost notes at random positions with lower velocity
          // (handled separately below)
        }

        osc.send('/live/clip/add/notes', drumTrackIdx, clipSlot,
          midiPitch, beatPos, 0.2, velocity, 0)
      }
    }
  }

  // Write additional layers from the preset
  for (const layer of preset.drumStyle.layers) {
    const pitch = GM_DRUMS[layer.instrument]
    if (pitch === undefined) continue

    for (let bar = 0; bar < barsToWrite; bar++) {
      for (const pos of layer.positions) {
        // Probability check
        if (Math.random() > layer.probability) continue

        const beatPos = (bar * 16 + pos) / 4
        osc.send('/live/clip/add/notes', drumTrackIdx, clipSlot,
          pitch, beatPos, 0.2, layer.velocity, 0)
      }
    }
  }

  // Hi-hat rolls for trap/drill/phonk
  if (preset.drumStyle.rollProbability > 0) {
    writeHihatRolls(osc, drumTrackIdx, clipSlot, barsToWrite, preset)
  }
}
```

### 5.3 Velocity Curve Functions

```typescript
function applyVelocityCurve(
  baseVelocity: number,
  sixteenthPosition: number,
  instrument: string,
  curve: 'flat' | 'accent_downbeat' | 'crescendo_roll' | 'random_humanize'
): number {
  switch (curve) {
    case 'flat':
      return baseVelocity

    case 'accent_downbeat':
      // Beats 1 and 3 get accent, ghost notes on offbeats
      if (sixteenthPosition % 4 === 0) return Math.min(127, baseVelocity + 20)
      if (sixteenthPosition % 2 === 0) return baseVelocity
      return Math.max(40, baseVelocity - 15)

    case 'crescendo_roll':
      // For hi-hat rolls: velocity ramps up within each beat group
      if (instrument.includes('hihat') || instrument.includes('hat')) {
        const posInBeat = sixteenthPosition % 4
        return Math.min(127, 60 + posInBeat * 20)  // 60 → 80 → 100 → 120
      }
      return baseVelocity

    case 'random_humanize':
      // +/- 15 velocity randomly
      return Math.max(40, Math.min(127, baseVelocity + Math.floor(Math.random() * 30 - 15)))
  }
}

function writeHihatRolls(
  osc: AbletonOSC,
  trackIdx: number,
  clipSlot: number,
  bars: number,
  preset: ResolvedPreset
): void {
  const rollPitch = GM_DRUMS.closed_hihat

  for (let bar = 0; bar < bars; bar++) {
    // Decide if this bar gets a roll
    if (Math.random() > preset.drumStyle.rollProbability) continue

    // Pick a position for the roll (usually before a snare hit)
    const rollStartSixteenth = bar * 16 + (Math.random() > 0.5 ? 6 : 14) // before beat 3 or end of bar
    const rollLength = Math.random() > 0.5 ? 4 : 6  // 4 or 6 32nd notes

    for (let i = 0; i < rollLength; i++) {
      const pos = rollStartSixteenth + (i * 0.5) // 32nd notes = half a 16th
      const beatPos = pos / 4
      const velocity = Math.min(127, 60 + (i / rollLength) * 60)  // crescendo

      osc.send('/live/clip/add/notes', trackIdx, clipSlot,
        rollPitch, beatPos, 0.1, Math.floor(velocity), 0)
    }
  }
}
```

### 5.4 Bass Line Generation

```typescript
async function writeBassLine(
  trackMap: Map<string, number>,
  preset: ResolvedPreset
): Promise<void> {
  const osc = await ensureAbleton()
  const bassTrackIdx = trackMap.get('bass')
  if (bassTrackIdx === undefined) return

  const clipSlot = 0
  const key = preset.key
  const scale = preset.scale
  const chords = preset.resolvedChords  // from Step 6
  const barsPerChord = preset.progressionStyle.barsPerSection / chords.length
  const beatsPerChord = barsPerChord * 4

  const notes: MidiNote[] = []

  for (let i = 0; i < chords.length; i++) {
    const chordRoot = chords[i][0]  // lowest note of the chord
    const chordStart = i * beatsPerChord

    // Bass octave: one octave below chord root
    const bassRoot = chordRoot - 12

    switch (preset.id) {
      case 'trap':
      case 'drill':
      case 'phonk':
        // 808 style: long sustained notes with occasional rhythmic hits
        notes.push({
          pitch: bassRoot,
          start: chordStart,
          duration: beatsPerChord * 0.9,  // nearly full duration
          velocity: 110,
        })
        // Add an octave hit for energy
        if (Math.random() > 0.5) {
          notes.push({
            pitch: bassRoot + 12,
            start: chordStart + beatsPerChord * 0.75,
            duration: 0.5,
            velocity: 90,
          })
        }
        break

      case 'house':
        // Funky syncopated bass
        const houseBassRhythm = [0, 1.5, 2, 3, 3.5]
        for (const offset of houseBassRhythm) {
          if (chordStart + offset >= chordStart + beatsPerChord) break
          const pitch = offset === 0 ? bassRoot :
            Math.random() > 0.5 ? bassRoot + 7 : bassRoot + 5  // 5th or 4th
          notes.push({
            pitch: quantizeToScale(pitch, key, scale),
            start: chordStart + offset,
            duration: 0.4,
            velocity: offset === 0 ? 100 : 80,
          })
        }
        break

      case 'lofi':
      case 'rnb':
        // Walking / melodic bass following chord tones
        const walkRhythm = [0, 1, 2, 3]
        const chordTones = chords[i].map(n => n - 12)  // drop octave
        for (let j = 0; j < walkRhythm.length; j++) {
          const pitch = chordTones[j % chordTones.length]
          notes.push({
            pitch,
            start: chordStart + walkRhythm[j],
            duration: 0.8,
            velocity: j === 0 ? 95 : 75,
          })
        }
        break

      case 'ambient':
        // Drone — one long note per chord, very low velocity
        notes.push({
          pitch: bassRoot,
          start: chordStart,
          duration: beatsPerChord,
          velocity: 50,
        })
        break

      default:
        // Default: root notes on the beat
        notes.push({
          pitch: bassRoot,
          start: chordStart,
          duration: beatsPerChord * 0.8,
          velocity: 90,
        })
    }
  }

  // Write all bass notes
  for (const note of notes) {
    osc.send('/live/clip/add/notes', bassTrackIdx, clipSlot,
      note.pitch, note.start, note.duration, note.velocity, 0)
  }
}
```

### 5.5 Melody Generation

```typescript
async function writeMelody(
  trackMap: Map<string, number>,
  preset: ResolvedPreset
): Promise<void> {
  const osc = await ensureAbleton()
  const melodyTrackIdx = trackMap.get('melody')
  if (melodyTrackIdx === undefined) return

  const clipSlot = 0
  const key = preset.key
  const scale = preset.scale
  const scaleNotes = getScaleNotes(key, scale, preset.melodyOctave || 5)
  const totalBeats = preset.progressionStyle.barsPerSection * 4

  const notes: MidiNote[] = []
  let currentBeat = 0

  // Melody density varies by genre
  const density = getMelodyDensity(preset.id)
  // density = { notesPerBar: number, restProbability: number, maxInterval: number }

  while (currentBeat < totalBeats) {
    // Rest probability
    if (Math.random() < density.restProbability) {
      currentBeat += 0.5
      continue
    }

    // Pick a note from the scale
    const prevPitch = notes.length > 0 ? notes[notes.length - 1].pitch : scaleNotes.midi[0]
    const nextPitch = generateNextMelodyNote(
      prevPitch, scaleNotes.midi, density.maxInterval, preset
    )

    // Duration varies by genre
    const duration = pickMelodyDuration(preset.id, currentBeat)

    notes.push({
      pitch: nextPitch,
      start: currentBeat,
      duration,
      velocity: 70 + Math.floor(Math.random() * 30),
    })

    currentBeat += duration + (Math.random() > 0.7 ? 0.25 : 0)  // occasional short rest
  }

  for (const note of notes) {
    osc.send('/live/clip/add/notes', melodyTrackIdx, clipSlot,
      note.pitch, note.start, note.duration, note.velocity, 0)
  }
}

function getMelodyDensity(genre: string): { notesPerBar: number; restProbability: number; maxInterval: number } {
  switch (genre) {
    case 'trap':
    case 'drill':
      return { notesPerBar: 6, restProbability: 0.3, maxInterval: 5 }  // sparse, stepwise
    case 'house':
      return { notesPerBar: 8, restProbability: 0.15, maxInterval: 7 }
    case 'lofi':
      return { notesPerBar: 5, restProbability: 0.35, maxInterval: 4 }
    case 'rnb':
      return { notesPerBar: 6, restProbability: 0.25, maxInterval: 5 }
    case 'phonk':
      return { notesPerBar: 4, restProbability: 0.4, maxInterval: 3 }  // very sparse
    case 'pluggnb':
      return { notesPerBar: 8, restProbability: 0.15, maxInterval: 7 }  // bright, active
    case 'ambient':
      return { notesPerBar: 2, restProbability: 0.6, maxInterval: 7 }  // extremely sparse
    default:
      return { notesPerBar: 6, restProbability: 0.2, maxInterval: 5 }
  }
}

function generateNextMelodyNote(
  prevPitch: number,
  scaleMidi: number[],
  maxInterval: number,
  preset: ResolvedPreset
): number {
  // Find scale notes within maxInterval semitones of previous pitch
  // Extended across octaves
  const allScaleNotes: number[] = []
  for (let octaveOffset = -12; octaveOffset <= 12; octaveOffset += 12) {
    for (const n of scaleMidi) {
      allScaleNotes.push(n + octaveOffset)
    }
  }

  const candidates = allScaleNotes.filter(n =>
    Math.abs(n - prevPitch) <= maxInterval &&
    Math.abs(n - prevPitch) > 0
  )

  if (candidates.length === 0) return prevPitch

  // Prefer stepwise motion (80%) over leaps (20%)
  const stepwise = candidates.filter(n => Math.abs(n - prevPitch) <= 2)
  if (stepwise.length > 0 && Math.random() < 0.8) {
    return stepwise[Math.floor(Math.random() * stepwise.length)]
  }

  return candidates[Math.floor(Math.random() * candidates.length)]
}
```

---

## 6. Mix Engine

The mix engine applies the `MixTemplate` from the genre preset automatically after all musical content is written.

### 6.1 Volume Staging

```typescript
async function applyMixTemplate(
  trackMap: Map<string, number>,
  preset: ResolvedPreset
): Promise<void> {
  const osc = await ensureAbleton()

  // Apply volumes
  for (const [role, volume] of Object.entries(preset.mixTemplate.volumes)) {
    const trackIdx = trackMap.get(role)
    if (trackIdx === undefined) continue
    osc.send('/live/track/set/volume', trackIdx, volume)
  }

  // Apply panning
  for (const [role, pan] of Object.entries(preset.mixTemplate.panning)) {
    const trackIdx = trackMap.get(role)
    if (trackIdx === undefined) continue
    osc.send('/live/track/set/panning', trackIdx, pan)
  }
}
```

### 6.2 Send/Return Setup

```typescript
async function setupSendsAndReturns(
  trackMap: Map<string, number>,
  preset: ResolvedPreset
): Promise<void> {
  const osc = await ensureAbleton()

  // Name return tracks
  for (let i = 0; i < preset.mixTemplate.returns.length; i++) {
    const ret = preset.mixTemplate.returns[i]
    // Return tracks are after regular tracks in the track list
    // AbletonOSC: return tracks are accessed via /live/return_track/
    // For naming, we use the return track index
    // Note: device loading would need to be done via drag-drop or browser in Ableton
    // The agent should REPORT what devices to add on each return
  }

  // Set send levels
  for (const send of preset.mixTemplate.sends) {
    const trackIdx = trackMap.get(send.fromRole)
    if (trackIdx === undefined) continue
    osc.send('/live/track/set/send', trackIdx, send.toReturn, send.level)
  }
}
```

### 6.3 EQ Rules (Agent Knowledge, Not Tool Calls)

The agent's system prompt includes these EQ decision trees. The agent uses `ableton_device` to set parameters when devices are present, but the KNOWLEDGE lives in the prompt:

```
MIXING EQ DECISION TREE (used when user asks to "mix this" or when auto-mixing):

KICK:    HP 30Hz → Boost 50-80Hz (weight) → Cut 200-400Hz (boxiness) → Boost 3-5kHz (click)
SNARE:   HP 80Hz → Boost 150-250Hz (body) → Cut 400-800Hz (boxiness) → Boost 3-5kHz (crack)
HIHATS:  HP 300-500Hz → Boost 8-12kHz (shimmer) → Cut 1-2kHz if harsh
BASS:    HP 30Hz → Boost 60-100Hz (fundamental) → Cut 200-300Hz (mud) → Boost 700Hz-1kHz (definition)
MELODY:  HP 100-200Hz → Cut 200-400Hz (mud) → Boost 2-4kHz (presence) → Boost 8kHz (air)
PAD:     HP 100-200Hz → Cut 200-500Hz (mud) → Gentle boost 3-5kHz (presence)
VOCAL:   HP 80Hz → Cut 200-300Hz (mud) → Boost 3-5kHz (clarity) → Boost 10-12kHz (air)

COMPRESSION RULES:
  Kick:    4:1-6:1, attack 10-30ms (let transient), fast release
  Snare:   4:1-8:1, fast attack for control, medium release
  Bass:    4:1-6:1, medium attack, fast release
  Vocals:  3:1-4:1, attack 5-15ms, release 50-100ms, max 6dB GR
  Bus:     2:1, slow attack (30ms), auto release, max 3dB GR
  Master:  Glue Comp 2:1, then Limiter at -0.3dB, target -14 LUFS

SIDECHAIN RULES:
  Bass ← Kick (ratio 10:1, fast attack, release 100-200ms)
  Chords ← Kick (ratio 4:1, medium attack, release 150ms)
  Pad ← Kick (ratio 3:1, slow attack, release 200ms) — subtle pump
```

---

## 7. Tool Registration

### 7.1 The `produce_track` Tool

```typescript
registerTool({
  name: 'produce_track',
  description: 'One-shot beat/track production. Specify a genre and get a complete, mixed, playing beat in Ableton Live. Creates tracks, writes drums, bass, chords, melody, pads, sets volumes, sends, and fires all clips. Use for "make a beat", "set up a track", "build a song".',
  parameters: {
    genre: {
      type: 'string',
      description: 'Genre: trap, drill, lofi, house, rnb, phonk, pluggnb, ambient. Or describe the vibe.',
      required: true,
    },
    key: { type: 'string', description: 'Musical key override (e.g., "Cm", "F#m", "Bb"). Random from genre defaults if omitted.' },
    tempo: { type: 'number', description: 'BPM override. Random from genre range if omitted.' },
    progression: { type: 'string', description: 'Chord progression override (Roman numerals or named). Random from genre defaults if omitted.' },
    bars: { type: 'number', description: 'Bars per section (default: from genre preset, usually 4 or 8).' },
    vibe: { type: 'string', description: 'Additional vibe description: "dark", "ethereal", "aggressive", "chill", "bouncy".' },
  },
  tier: 'free',
  timeout: 60_000,  // 60 seconds — this is a complex operation
  async execute(args) {
    const genre = String(args.genre).toLowerCase()
    const overrides: Partial<ProductionOverrides> = {}
    if (args.key) overrides.key = String(args.key)
    if (args.tempo) overrides.bpm = Number(args.tempo)
    if (args.progression) overrides.progression = String(args.progression)
    if (args.bars) overrides.bars = Number(args.bars)
    if (args.vibe) overrides.vibe = String(args.vibe)

    const report = await executeProductionPipeline(genre, overrides)
    return formatProductionReport(report)
  },
})
```

### 7.2 The `auto_mix` Tool

```typescript
registerTool({
  name: 'auto_mix',
  description: 'Auto-mix the current Ableton session based on track roles. Reads track names, infers roles (drums, bass, melody, etc.), and applies genre-appropriate volume, panning, and send levels.',
  parameters: {
    genre: { type: 'string', description: 'Genre for mix reference (affects relative levels). Default: inferred from tempo.' },
    target_lufs: { type: 'number', description: 'Target loudness in LUFS. Default: -14 (streaming standard).' },
  },
  tier: 'free',
  timeout: 30_000,
  async execute(args) {
    // 1. Get session info
    // 2. Infer track roles from names
    // 3. Look up genre mix template
    // 4. Apply volumes, panning, sends
    // 5. Report changes
  },
})
```

---

## 8. Upgraded System Prompt

The `PRODUCER_PRESET.prompt` in `producer.ts` should be replaced with this:

```typescript
export const PRODUCER_PRESET = {
  name: 'Producer',
  prompt: `You are kbot's Music Producer & Sound Engineer — a world-class studio partner who produces, mixes, and masters music through Ableton Live via natural language. You combine the creative intuition of a hit producer with the technical precision of a mastering engineer.

## Who You Are

You don't suggest — you execute. When Isaac says "make a trap beat," you make the entire beat: pick the key, tempo, instruments, write the drums, bass, chords, melody, set the mix, and hit play. When he says "mix this," you set every volume, EQ, compressor, and send. You are the engineer he doesn't have to explain things to.

## Your Tools

### One-Shot Production
- **produce_track** — THE power tool. Give it a genre and it builds a complete, mixed, playing beat. Use this for "make a beat", "set up a track", "build a song" requests. Supports: trap, drill, lofi, house, rnb, phonk, pluggnb, ambient.

### Auto-Mix
- **auto_mix** — Reads the current session, infers track roles from names, and applies genre-appropriate volume, panning, and sends.

### Surgical Operations (existing tools)
- **ableton_session_info** — ALWAYS call first for any operation
- **ableton_transport** — Play, stop, record, tempo, time sig
- **ableton_track** — Create, mute, solo, arm, volume, pan, rename
- **ableton_clip** — Fire, stop, create, delete clips
- **ableton_scene** — Fire, list, create scenes
- **ableton_midi** — Write/read/clear MIDI notes
- **ableton_create_progression** — Chord progressions from Roman numerals, symbols, or named
- **ableton_device** — List, get/set device parameters
- **ableton_mixer** — Batch volume/pan/send operations
- **ableton_knowledge** — Deep knowledge base for any Ableton question

### Music Theory (via magenta)
- **magenta_continue** — AI melody continuation
- **magenta_harmonize** — Chord generation
- **magenta_drumify** — Genre drum patterns

## Decision Rules

1. **"Make a [genre] beat"** → Call produce_track with the genre. Override key/tempo/progression if specified.
2. **"Mix this track"** → Call auto_mix. Or if specific: use ableton_mixer + ableton_device for surgical adjustments.
3. **"Add reverb to the melody"** → Use ableton_device to load/configure. Consult ableton_knowledge for optimal settings.
4. **"Write a chord progression"** → Use ableton_create_progression. Suggest voicing and rhythm based on genre context.
5. **"Set up sidechain"** → Use ableton_device to configure compressor sidechain routing. Know the signal flow.
6. **Anything vague** → Check session state first, then make the creative decision yourself and execute.

## Producer Brain

When making creative decisions:
- **Key selection**: Dark genres (trap, drill, phonk) → minor keys (Cm, Em, F#m). Bright genres (pluggnb, house, pop) → major keys or modes (C, F, Bb, Dorian). R&B → flat keys (Db, Ab, Eb, Bb).
- **Instrument selection**: Know which synth suits which sound. Operator for FM/808. Analog for warm sub. Wavetable for modern leads. Drift for organic textures. Electric for Rhodes/Wurli. Collision for mallets. Granulator III for ambient.
- **Pattern writing**: Trap = half-time snare on 3, rolling hats, sparse 808. House = four-on-floor, offbeat hats, funky bass. Lo-fi = boom-bap with swing, jazz chords, vinyl texture.
- **Frequency allocation**: Kick 30-100Hz, Bass 50-250Hz, Melody 200Hz-5kHz, Pad 200Hz-3kHz, Hats 3-15kHz. HP everything that doesn't need low end.

## Engineer Brain

When mixing:
- **Gain staging**: -18dBFS average on tracks, -6dBFS on master before limiting
- **Volume hierarchy**: Kick/Bass > Snare > Melody > Chords > Pad > Hats > Percussion > FX
- **EQ**: HP everything except kick/bass. Cut mud (200-400Hz). Boost presence (2-5kHz). Cut narrow, boost wide.
- **Compression**: Drums 4:1-8:1. Bass 4:1-6:1. Bus glue 2:1. Master: Glue Comp → Limiter at -14 LUFS.
- **Reverb**: Plate for melody, hall for pads, room for drums. Send, not insert.
- **Sidechain**: Bass from kick, chords from kick, pad from kick (subtle).
- **Stereo**: Kick, bass, snare = CENTER. Hats = slight offset. Pads = WIDE. Returns = WIDE.
- **Master chain**: EQ Eight (HP 30Hz) → Glue Compressor (2:1, -2dB GR) → Limiter (-0.3dB ceiling)

## Isaac's Plugin Arsenal

Beyond Ableton stock, Isaac has:
- **UA plugins (170+)**: Neve, API, SSL, Pultec, 1176, LA-2A, Fairchild, Studer, Lexicon
- **Roland Cloud**: TR-808, TR-909, TB-303, SH-101, JUNO-106, JUPITER-8, JD-800, D-50
- **Serum 2**: Wavetable synth for modern sound design
- **Splice**: Sample library (access via splice_search tool)

When recommending, prefer Ableton stock for speed (OSC-controllable), but mention UA/Roland alternatives when they'd sound notably better.

## Reporting Style

After any production or mix action, report musically:
- Not: "Set parameter 3 to 0.7 on device 0, track 2"
- Yes: "Set the reverb decay to 3.2 seconds — long tail for that spacey drill vibe"
- Not: "Created 6 tracks with 16-beat clips"
- Yes: "Built a 142 BPM trap beat in C minor: 808 bass with slides, half-time snare, rolling hats, dark bell melody over i-bVI-bVII-i, mixed and playing."

If Ableton isn't responding: "Ableton's not responding on port 11000. Make sure AbletonOSC is loaded in Preferences > Control Surface."`,
}
```

---

## 9. Routing Integration

### 9.1 Updated Keywords

```typescript
export const PRODUCER_KEYWORDS = [
  // Existing keywords (kept)
  'ableton', 'daw', 'produce', 'producer', 'production', 'session',
  'track', 'clip', 'scene', 'tempo', 'bpm', 'transport',
  'play', 'stop', 'record', 'arm', 'mute', 'solo',
  'midi', 'note', 'chord', 'progression', 'melody', 'bassline',
  'mix', 'mixer', 'volume', 'pan', 'send', 'return',
  'device', 'plugin', 'vst', 'instrument', 'effect', 'fx',
  'drum', 'kick', 'snare', 'hihat', 'beat', 'pattern',
  'arrangement', 'launch', 'fire', 'warp', 'loop',
  'reverb', 'delay', 'compressor', 'eq', 'filter', 'sidechain',
  'key', 'scale', 'minor', 'major', 'dorian', 'mixolydian',
  'synth', 'wavetable', 'operator', 'analog', 'sampler', 'simpler',
  'mastering', 'loudness', 'limiter', 'stereo', 'width',
  'automation', 'envelope', 'modulation', 'lfo',
  'bounce', 'freeze', 'flatten', 'resample', 'stem',
  'groove', 'swing', 'quantize', 'humanize',

  // NEW — genre keywords for one-shot production
  'trap', 'drill', 'lofi', 'lo-fi', 'house', 'rnb', 'r&b',
  'phonk', 'pluggnb', 'plugg', 'ambient', 'techno',
  'hip-hop', 'hiphop', 'pop', 'jazz', 'rock', 'funk',
  'reggaeton', 'afrobeat', 'bossa', 'dnb', 'drum and bass',

  // NEW — sound engineering keywords
  'mix', 'master', 'mastering', 'loudness', 'lufs',
  'gain staging', 'headroom', 'frequency', 'spectrum',
  'saturation', 'harmonic', 'warmth', 'distortion',
  'stereo image', 'mono', 'width', 'mid side',
  'de-ess', 'sibilance', 'transient', 'parallel compression',
  'bus compression', 'glue', 'limiting', 'clipping',

  // NEW — sound design keywords
  'sound design', '808', 'sub bass', 'pluck', 'stab',
  'pad', 'texture', 'riser', 'impact', 'sweep',
  'roland', 'juno', 'jupiter', 'sh-101', 'tr-808', 'tr-909',
  'serum', 'ua', 'universal audio', 'splice',
]
```

### 9.2 Updated Routing Patterns

```typescript
export const PRODUCER_PATTERNS = [
  // Existing patterns (kept)
  { pattern: /\b(ableton|live\s*set|session\s*view|arrangement)\b/i, confidence: 0.85 },
  { pattern: /\b(play|stop|record)\b.*\b(track|clip|scene|session)\b/i, confidence: 0.8 },
  { pattern: /\b(mute|solo|arm)\b.*\b(track|channel)\b/i, confidence: 0.8 },
  { pattern: /\b(set|change)\b.*\b(tempo|bpm)\b/i, confidence: 0.8 },
  { pattern: /\b(add|write|create|make)\b.*\b(chord|melody|midi|notes?|progression|beat|pattern|drum)\b/i, confidence: 0.8 },
  { pattern: /\b(fire|launch)\b.*\b(scene|clip)\b/i, confidence: 0.8 },
  { pattern: /\b(mix|mixer|volume|pan|send|gain)\b.*\b(track|channel|master|bus)\b/i, confidence: 0.75 },
  { pattern: /\b(add|enable|disable|put)\b.*\b(effect|device|plugin|reverb|delay|compressor|eq|filter)\b/i, confidence: 0.8 },
  { pattern: /\b(sidechain|parallel\s*compress|ny\s*compress)\b/i, confidence: 0.85 },
  { pattern: /\b(wavetable|operator|analog|drift|meld|simpler|sampler|collision|tension|electric)\b/i, confidence: 0.8 },

  // NEW — one-shot production (highest confidence)
  { pattern: /\b(make|build|create|produce|set\s*up|cook|whip\s*up)\b.*\b(beat|track|song|instrumental|loop)\b/i, confidence: 0.90 },
  { pattern: /\b(make|build|produce)\b.*\b(trap|drill|house|lofi|lo-fi|ambient|phonk|plugg|rnb|r&b|techno|hip\s*hop|pop|jazz)\b/i, confidence: 0.90 },
  { pattern: /\b(trap|drill|house|lofi|phonk|pluggnb|ambient)\b.*\b(beat|track|type\s*beat)\b/i, confidence: 0.90 },

  // NEW — mixing/engineering
  { pattern: /\b(mix|master|balance|level)\b.*\b(track|session|song|beat|project)\b/i, confidence: 0.85 },
  { pattern: /\b(eq|compress|limit|de-?ess|satur|excit)\b.*\b(vocal|drum|bass|guitar|synth|master)\b/i, confidence: 0.85 },
  { pattern: /\b(gain\s*stag|headroom|lufs|loudness|rms|peak)\b/i, confidence: 0.85 },
  { pattern: /\b(stereo\s*image|mono\s*compat|mid.?side|width)\b/i, confidence: 0.80 },

  // NEW — sound design
  { pattern: /\b(design|create|make|build)\b.*\b(sound|808|bass|lead|pad|pluck|stab|riser)\b/i, confidence: 0.85 },
  { pattern: /\b(how\s*to|teach\s*me|show\s*me)\b.*\b(mix|produce|master|eq|compress|sidechain)\b/i, confidence: 0.80 },
]
```

---

## 10. Preset Resolution Logic

The preset resolver handles the gap between user intent and the fixed genre presets. It combines the preset defaults with user overrides and randomization.

```typescript
interface ProductionOverrides {
  key: string
  bpm: number
  progression: string
  bars: number
  vibe: string
}

interface ResolvedPreset extends GenrePreset {
  // Resolved (randomized + overridden) values
  key: string
  scale: string
  bpm: number
  resolvedProgression: string  // the actual Roman numeral string
  resolvedChords: number[][]   // parsed MIDI note arrays
}

function resolvePreset(genre: string, overrides?: Partial<ProductionOverrides>): ResolvedPreset {
  // 1. Find the genre preset
  const preset = GENRE_PRESETS[genre] || inferGenreFromVibe(genre)
  if (!preset) throw new Error(`Unknown genre: "${genre}". Available: ${Object.keys(GENRE_PRESETS).join(', ')}`)

  // 2. Resolve key
  const key = overrides?.key || randomFrom(preset.preferredKeys)

  // 3. Resolve scale
  const scale = preset.preferredScales[0]  // first is primary, override if vibe suggests different

  // 4. Resolve BPM
  const bpm = overrides?.bpm || randomInRange(preset.bpmRange[0], preset.bpmRange[1])

  // 5. Resolve progression
  let progressionStr: string
  if (overrides?.progression) {
    progressionStr = overrides.progression
  } else {
    // Pick randomly from the genre's options
    const allOptions = [
      ...preset.progressionStyle.romanTemplates,
      ...preset.progressionStyle.namedProgressions.map(name => {
        const named = NAMED_PROGRESSIONS[name]
        return named ? named.numerals : null
      }).filter(Boolean) as string[],
    ]
    progressionStr = randomFrom(allOptions)
  }

  // 6. Parse the progression
  const resolvedChords = parseProgression(progressionStr, key, scale, preset.progressionStyle.octave)
    .map(notes => voiceChord(notes, preset.progressionStyle.voicing))

  // 7. Apply vibe adjustments
  if (overrides?.vibe) {
    applyVibeAdjustments(preset, overrides.vibe)
  }

  return {
    ...preset,
    key,
    scale,
    bpm,
    resolvedProgression: progressionStr,
    resolvedChords: resolvedChords,
  }
}

function applyVibeAdjustments(preset: GenrePreset, vibe: string): void {
  const v = vibe.toLowerCase()
  if (v.includes('dark') || v.includes('aggressive')) {
    // Push toward minor, lower octave
    preset.progressionStyle.octave = Math.max(2, preset.progressionStyle.octave - 1)
  }
  if (v.includes('bright') || v.includes('happy') || v.includes('ethereal')) {
    // Push toward major, higher octave
    preset.progressionStyle.octave = Math.min(6, preset.progressionStyle.octave + 1)
  }
  if (v.includes('chill') || v.includes('mellow') || v.includes('soft')) {
    // Reduce all volumes by 10%
    for (const key of Object.keys(preset.mixTemplate.volumes)) {
      preset.mixTemplate.volumes[key] *= 0.9
    }
  }
  if (v.includes('bouncy') || v.includes('energetic')) {
    // Increase swing, boost drums
    preset.drumStyle.swing = Math.min(70, preset.drumStyle.swing + 20)
  }
}

// Helpers
function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomInRange(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1))
}
```

---

## 11. Production Report Format

After the pipeline completes, the agent reports what was built in musical terms.

```typescript
function formatProductionReport(report: ProductionReport): string {
  const p = report.preset
  const lines: string[] = []

  lines.push(`## Beat Built: ${p.name}`)
  lines.push('')
  lines.push(`**Key**: ${p.key} ${p.scale}`)
  lines.push(`**Tempo**: ${p.bpm} BPM (${p.feel})`)
  lines.push(`**Progression**: ${p.resolvedProgression}`)
  lines.push(`**Bars**: ${p.progressionStyle.barsPerSection}`)
  lines.push('')

  lines.push('### Tracks')
  for (const track of report.tracks) {
    lines.push(`- **${track.name}** (${track.role}) — ${track.instrument} → ${track.noteCount} notes`)
  }
  lines.push('')

  lines.push('### Mix')
  lines.push(`- Volumes: ${Object.entries(p.mixTemplate.volumes).map(([k, v]) => `${k}: ${(v * 100).toFixed(0)}%`).join(', ')}`)
  lines.push(`- Returns: ${p.mixTemplate.returns.map(r => r.name).join(', ')}`)
  lines.push(`- Master: ${p.mixTemplate.masterChain.join(' → ')}`)
  lines.push(`- Target: **${p.mixTemplate.targetLUFS} LUFS**`)
  lines.push('')

  lines.push('### Playing')
  lines.push('All clips fired on Scene 1. Hit **stop** when you want to change something.')
  lines.push('')

  if (p.productionNotes.length > 0) {
    lines.push('### Production Notes')
    for (const note of p.productionNotes.slice(0, 3)) {
      lines.push(`- ${note}`)
    }
  }

  if (report.errors.length > 0) {
    lines.push('')
    lines.push('### Issues')
    for (const err of report.errors) {
      lines.push(`- ${err}`)
    }
  }

  return lines.join('\n')
}
```

---

## 12. Registration in Matrix

Update `matrix.ts` to import the upgraded producer:

```typescript
// In matrix.ts, add to imports:
import { PRODUCER_PRESET, PRODUCER_BUILTIN } from './agents/producer.js'

// In BUILTIN_AGENTS, the producer entry already exists via SPECIALISTS.
// The SPECIALISTS entry in specialists.ts needs to be updated to use the new prompt.
// OR: override it in BUILTIN_AGENTS directly:

const BUILTIN_AGENTS = {
  // ...existing entries...
  producer: {
    name: PRODUCER_BUILTIN.name,
    icon: PRODUCER_BUILTIN.icon,
    color: PRODUCER_BUILTIN.color,
    prompt: PRODUCER_BUILTIN.prompt,  // Uses the upgraded prompt
  },
}
```

The producer agent is already registered as a specialist in `specialists.ts` at line 111. The prompt there should be updated to match the new one, or the `BUILTIN_AGENTS` in `matrix.ts` should override it (like `creative`, `developer`, and `trader` already do).

---

## 13. Implementation Checklist

### Phase 1: Core Engine (producer-engine.ts)
- [ ] Define `GenrePreset` and related types
- [ ] Implement all 8 genre presets (trap, drill, lofi, house, rnb, phonk, pluggnb, ambient)
- [ ] Implement `resolvePreset()` with randomization and override logic
- [ ] Implement `executeProductionPipeline()` — the 13-step sequence
- [ ] Implement `setTransport()` — step 1
- [ ] Implement `createTracks()` — step 2
- [ ] Implement `createClips()` — step 4
- [ ] Implement `writeDrumPatterns()` with velocity curves and rolls — step 5
- [ ] Implement `writeChordProgression()` using existing `ableton_create_progression` logic — step 6
- [ ] Implement `writeBassLine()` with genre-specific patterns — step 7
- [ ] Implement `writeMelody()` with scale-quantized generation — step 8
- [ ] Implement `writePadChords()` — step 9
- [ ] Implement `applyMixTemplate()` — step 10
- [ ] Implement `setupSendsAndReturns()` — step 11
- [ ] Implement `fireAllClips()` — step 12
- [ ] Implement `formatProductionReport()` — step 13
- [ ] Register `produce_track` tool
- [ ] Register `auto_mix` tool

### Phase 2: Agent Upgrade (producer.ts)
- [ ] Replace system prompt with the new unified Producer + Engineer prompt
- [ ] Add new routing keywords
- [ ] Add new routing patterns
- [ ] Update specialist entry in `specialists.ts`

### Phase 3: Integration
- [ ] Import and register `producer-engine.ts` tools in the tool index
- [ ] Update `learned-router.ts` with new producer patterns
- [ ] Test with "make a trap beat" end-to-end
- [ ] Test with "mix this session" end-to-end
- [ ] Test each genre preset

### Phase 4: Polish
- [ ] Add more genre presets: techno, dnb, pop, jazz, rock, funk, reggaeton
- [ ] Add arrangement support: intro, verse, chorus, bridge, outro as separate scenes
- [ ] Add automation writing: filter sweeps, volume rides
- [ ] Add Splice integration: search for samples by genre, download, load into Simpler

---

## 14. Key Design Decisions

1. **New tool, not new agent**: The producer-engine is a TOOL (`produce_track`), not a separate agent. The producer agent calls it. This keeps the matrix simple — one `producer` agent ID, no confusion about routing.

2. **Genre presets are data, not code**: Each preset is a plain object. Adding a new genre means adding a new entry to `GENRE_PRESETS`. No new functions needed.

3. **Randomization with overrides**: Every creative decision has a sensible random default AND can be overridden by the user. "Make a trap beat" uses random key/tempo from the preset. "Make a trap beat in Em at 145" uses overrides.

4. **Existing tools as primitives**: The engine uses the SAME OSC messages as the existing tools. It doesn't bypass them — it composes them. This means if the OSC layer changes, everything still works.

5. **The agent knows mixing, the tool does production**: The system prompt contains the full EQ/compression/mixing knowledge as text. When the user asks to "mix this," the agent reads the session, makes decisions, and calls `ableton_device` and `ableton_mixer` surgically. The `produce_track` tool handles only the creation pipeline + initial mix levels.

6. **150ms timing rule respected**: All OSC operations follow the existing timing conventions from `ableton.ts`: 200ms after creates, fire-and-forget for sets, await for queries.

7. **Bass line is genre-aware**: 808 genres get sustained notes with slides. House gets funky syncopation. Lo-fi/R&B get walking bass following chord tones. Ambient gets drones. This is the single biggest difference between a generic beat and one that sounds right.

8. **Melody is scale-quantized and step-biased**: All generated melody notes are quantized to the chosen scale. 80% stepwise motion, 20% leaps. This prevents random-sounding melodies while maintaining variety.
