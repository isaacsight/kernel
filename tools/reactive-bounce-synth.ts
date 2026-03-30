#!/usr/bin/env npx tsx
/**
 * reactive-bounce-synth.ts — Build the "Reactive Bounce Synth" in Ableton + Serum 2
 *
 * Modes:
 *   npx tsx tools/reactive-bounce-synth.ts                — Build full patch + MIDI + FX
 *   npx tsx tools/reactive-bounce-synth.ts --discover [t] — List all params on track t device 0
 *   npx tsx tools/reactive-bounce-synth.ts --scan         — Scan all tracks for Serum 2 instances
 *   npx tsx tools/reactive-bounce-synth.ts --set t:p:v    — Set param index p to value v on track t
 *   npx tsx tools/reactive-bounce-synth.ts --get t:p      — Get param index p value on track t
 *   npx tsx tools/reactive-bounce-synth.ts --snapshot t   — Dump all param values as JSON (saveable)
 *   npx tsx tools/reactive-bounce-synth.ts --load file.json t — Load a param snapshot onto track t
 *   npx tsx tools/reactive-bounce-synth.ts --search name  — Search param names across all devices
 *   npx tsx tools/reactive-bounce-synth.ts --randomize t  — Randomize Serum 2 params within musical ranges
 *   npx tsx tools/reactive-bounce-synth.ts --morph t a b  — Morph between snapshot a.json and b.json
 *
 * Creates (in build mode):
 *   1. MIDI track with Serum 2 loaded
 *   2. All Serum 2 parameters set (OSC A/B, envelopes, filter, LFOs)
 *   3. 4-bar melody clip with velocity humanization
 *   4. "Mutated" duplicate clip with timing/velocity/octave variations
 *   5. Ableton FX chain: Saturator → Chorus → Delay → Reverb
 *
 * Requires:
 *   - Ableton Live running
 *   - kbot-bridge.amxd loaded on any track
 *   - Serum 2 (Xfer Records) installed
 *
 * Run: npx tsx tools/reactive-bounce-synth.ts
 */

import * as net from 'node:net'
import * as fs from 'node:fs'
import * as path from 'node:path'

// ── M4L Bridge Client (inline for standalone use) ──────────────────────

const PORT = 9999
const HOST = '127.0.0.1'
const TIMEOUT = 15_000

let socket: net.Socket | null = null
let nextId = 1
let buffer = ''
const pending = new Map<number, { resolve: (r: any) => void; reject: (e: Error) => void }>()

function connect(): Promise<boolean> {
  return new Promise((resolve) => {
    socket = new net.Socket()
    buffer = ''

    socket.on('data', (data: Buffer) => {
      buffer += data.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        try {
          const response = JSON.parse(trimmed)
          if (response.id && pending.has(response.id)) {
            const req = pending.get(response.id)!
            pending.delete(response.id)
            req.resolve(response)
          }
        } catch { /* skip */ }
      }
    })

    socket.on('error', () => {
      resolve(false)
    })

    socket.connect(PORT, HOST, () => {
      resolve(true)
    })

    setTimeout(() => {
      if (!socket?.connecting) return
      socket?.destroy()
      resolve(false)
    }, 5000)
  })
}

function send(cmd: Record<string, unknown>): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!socket) return reject(new Error('Not connected'))
    const id = nextId++
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error(`Timeout: ${cmd.action}`))
    }, TIMEOUT)

    pending.set(id, {
      resolve: (r) => { clearTimeout(timer); resolve(r) },
      reject: (e) => { clearTimeout(timer); reject(e) },
    })

    socket.write(JSON.stringify({ id, ...cmd }) + '\n')
  })
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function ensureConnected(): Promise<void> {
  const ok = await connect()
  if (!ok) {
    console.error('\n  Cannot connect to M4L bridge on localhost:9999')
    console.error('  Make sure Ableton is running with kbot-bridge.amxd loaded\n')
    process.exit(1)
  }
  const pong = await send({ action: 'ping' })
  if (!pong.ok) {
    console.error('  Bridge responded but ping failed')
    process.exit(1)
  }
}

function die(): never {
  socket?.destroy()
  process.exit(0)
}

// ── Serum 2 Parameter Knowledge Base ───────────────────────────────────
// Based on Serum/Serum 2 VST3 automation parameter naming conventions.
// Serum 2 exposes ~230+ automatable parameters via VST3.
// All values are normalized 0.0–1.0 in the DAW.

/**
 * Known Serum 2 parameter sections and common names.
 * Used for fuzzy matching when the bridge returns slightly different names.
 */
/**
 * Serum 2 VST3 parameter sections — actual names from parameter dump.
 * Reference: docs/serum2-technical-reference.md
 * Full dump: 542 core params (2,622 total incl. MIDI CC/AT/PB)
 *
 * ID scheme:
 *   0-20         Global (Main Vol, Tuning, Porta, Bend, Swing)
 *   1000000+     Osc A (1001000=B, 1002000=C, 1003000=Noise, 1004000=Sub)
 *   2000000+     Filter 1 (2001000=Filter 2)
 *   3000000+     Env 1 (3001000=Env2, 3002000=Env3, 3003000=Env4)
 *   4000000+     LFO 1 (4001000=LFO2, ... 4009000=LFO10)
 *   6000000+     Mod Matrix (64 slots, Amount + Out per slot)
 *   7000000+     Macros 1-8
 *   9000000+     Routing (Osc>Filter Balance, Osc>Bus, Filter>Bus)
 *   10000000+    Clip Player
 *   12000000+    Arpeggiator
 *   15000000+    Global Osc randomization
 *   17000000+    FX (Main 1-16, Bus1 1-16, Bus2 1-16)
 */
const SERUM2_PARAM_SECTIONS = {
  // Oscillator A (ID 1000000+)
  oscA: [
    'A Enable', 'A Level', 'A Pan', 'A Octave', 'A Semi', 'A Fine',
    'A Coarse Pitch', 'A Ratio', 'A Hz Offset', 'A Pitch Track',
    'A Start', 'A End', 'A Reverse', 'A Scan Rate', 'A Scan BPM Rate',
    'A Scan Key Track', 'A Position', 'A Loop Start', 'A Loop End',
    'A Loop X-Fade', 'A Loop Mode', 'A Relative Loop', 'A Single Slice',
    'A Slice Play Mode', 'A Unison', 'A Uni Stack', 'A Uni Detune',
    'A Uni Blend', 'A Uni Width', 'A Uni Span', 'A Uni Rand Start',
    'A Uni Warp', 'A Uni Warp 2',
  ],
  // Oscillator B (ID 1001000+)
  oscB: [
    'B Enable', 'B Level', 'B Pan', 'B Octave', 'B Semi', 'B Fine',
    'B Coarse Pitch', 'B Ratio', 'B Position', 'B Unison',
    'B Uni Detune', 'B Uni Blend', 'B Uni Width',
  ],
  // Oscillator C (ID 1002000+)
  oscC: [
    'C Enable', 'C Level', 'C Pan', 'C Octave', 'C Semi', 'C Fine',
    'C Position', 'C Unison', 'C Uni Detune',
  ],
  // Noise (ID 1003000+)
  noise: [
    'Noise Level', 'Noise Pan', 'Noise Pitch', 'Noise Fine',
    'Noise Phase', 'Noise Rand Phase',
  ],
  // Sub (ID 1004000+)
  sub: [
    'Sub Osc Level', 'Sub Osc Pan',
  ],
  // Envelopes 1-4 (ID 3000000+)
  envelopes: [
    'Env 1 Attack', 'Env 1 Hold', 'Env 1 Decay', 'Env 1 Sustain', 'Env 1 Release',
    'Env 1 Atk Curve', 'Env 1 Dec Curve', 'Env 1 Rel Curve',
    'Env 2 Attack', 'Env 2 Hold', 'Env 2 Decay', 'Env 2 Sustain', 'Env 2 Release',
    'Env 2 Atk Curve', 'Env 2 Dec Curve', 'Env 2 Rel Curve',
    'Env 2 Start', 'Env 2 End',
    'Env 3 Attack', 'Env 3 Decay', 'Env 3 Sustain', 'Env 3 Release',
    'Env 4 Attack', 'Env 4 Decay', 'Env 4 Sustain', 'Env 4 Release',
  ],
  // LFOs 1-10 (ID 4000000+)
  lfos: [
    'LFO 1 Rate', 'LFO 1 Smooth', 'LFO 1 Rise', 'LFO 1 Delay', 'LFO 1 Phase',
    'LFO 2 Rate', 'LFO 2 Smooth', 'LFO 2 Rise', 'LFO 2 Delay', 'LFO 2 Phase',
    'LFO 3 Rate', 'LFO 3 Smooth', 'LFO 3 Rise', 'LFO 3 Delay', 'LFO 3 Phase',
    'LFO 4 Rate', 'LFO 4 Smooth', 'LFO 4 Rise', 'LFO 4 Delay', 'LFO 4 Phase',
    // LFOs 5-10 follow same pattern
  ],
  // Filter 1 (ID 2000000+)
  filter1: [
    'Filter 1 Type', 'Filter 1 Cutoff', 'Filter 1 Res', 'Filter 1 Drive',
    'Filter 1 Var', 'Filter 1 Stereo', 'Filter 1 Level',
    'Filter 1 X', 'Filter 1 Y', 'Filter 1 Wet',
  ],
  // Filter 2 (ID 2001000+)
  filter2: [
    'Filter 2 Type', 'Filter 2 Cutoff', 'Filter 2 Res', 'Filter 2 Drive',
    'Filter 2 Var', 'Filter 2 Stereo', 'Filter 2 Level',
  ],
  // Mod Matrix — 64 slots (ID 6000000+)
  modMatrix: [
    ...Array.from({ length: 64 }, (_, i) => `Mod ${i + 1} Amount`),
    ...Array.from({ length: 64 }, (_, i) => `Mod ${i + 1} Out`),
  ],
  // FX — 3 buses x 16 param slots (ID 17000000+)
  fx: [
    ...Array.from({ length: 16 }, (_, i) => `FX Main Param ${i + 1}`),
    ...Array.from({ length: 16 }, (_, i) => `FX Bus 1 Param ${i + 1}`),
    ...Array.from({ length: 16 }, (_, i) => `FX Bus 2 Param ${i + 1}`),
  ],
  // Macros 1-8 (ID 7000000+)
  macros: [
    'Macro 1', 'Macro 2', 'Macro 3', 'Macro 4',
    'Macro 5', 'Macro 6', 'Macro 7', 'Macro 8',
  ],
  // Global (ID 0-20)
  master: [
    'Main Vol', 'Main Tuning', 'Amp', 'Porta Time', 'Porta Curve',
    'Bend Up', 'Bend Down', 'Pitch Bend', 'Mod Wheel',
    'Mono Toggle', 'Legato', 'Porta Always', 'Porta Scaled',
    'Swing', 'Swing Div', 'Transpose', 'Bypass',
    'Direct Vol', 'Bus 1 Vol', 'Bus 2 Vol',
  ],
  // Routing (ID 9000000+)
  routing: [
    'A>Filter Balance', 'A>BUS1', 'A>BUS2',
    'B>Filter Balance', 'B>BUS1', 'B>BUS2',
    'C>Filter Balance', 'C>BUS1', 'C>BUS2',
    'Noise>Filter Balance', 'Noise>BUS1', 'Noise>BUS2',
    'Sub Osc>Filter Balance', 'Sub Osc>BUS1', 'Sub Osc>BUS2',
    'Filter 1>BUS1', 'Filter 1>BUS2',
    'Filter 2>BUS1', 'Filter 2>BUS2',
  ],
  // Arpeggiator (ID 12000000+)
  arp: [
    'Arp Enable', 'Arp Rate', 'Arp Shift', 'Arp Range', 'Arp Offset',
    'Arp Repeats', 'Arp Gate', 'Arp Chance', 'Arp Retrig Rate',
    'Arp Velo Decay', 'Arp Velo Target', 'Arp Transpose',
  ],
  // Clip Sequencer (ID 10000000+)
  clipPlayer: [
    'Clip Player Enable', 'Clip Player Transpose',
    'Clip Player Rate', 'Clip Player Offset',
  ],
  // Global Osc randomization (ID 15000000+)
  globalOsc: [
    'Detune Rand', 'Pan Rand', 'Env Rand', 'Cutoff Rand',
  ],
}

// Flatten for search
const ALL_KNOWN_PARAMS = Object.values(SERUM2_PARAM_SECTIONS).flat()

// ── Serum 2 Editing Functions ──────────────────────────────────────────

interface ParamInfo {
  index: number
  name: string
  value: number
}

/**
 * Get all parameters from a device on a track.
 */
async function getDeviceParams(track: number, device: number = 0): Promise<ParamInfo[]> {
  const result = await send({ action: 'get_device_params', track, device })
  if (!result.ok) return []

  const params = result.params as any[]
  if (!Array.isArray(params)) return []

  return params.map((p, i) => ({
    index: p.index ?? i,
    name: p.name ?? `Param ${i}`,
    value: typeof p.value === 'number' ? p.value : 0,
  }))
}

/**
 * Set a parameter by index.
 */
async function setParam(track: number, device: number, paramIdx: number, value: number): Promise<boolean> {
  const r = await send({ action: 'set_param', track, device, param: paramIdx, value })
  return r.ok ?? false
}

/**
 * Find a parameter by name (fuzzy match).
 */
function findParam(params: ParamInfo[], name: string): ParamInfo | undefined {
  const lower = name.toLowerCase()
  // Exact match
  let found = params.find(p => p.name.toLowerCase() === lower)
  if (found) return found
  // Contains match
  found = params.find(p => p.name.toLowerCase().includes(lower))
  if (found) return found
  // Reverse contains
  found = params.find(p => lower.includes(p.name.toLowerCase()))
  return found
}

/**
 * Set a parameter by name (fuzzy match).
 */
async function setParamByName(
  track: number, device: number, params: ParamInfo[],
  name: string, value: number,
): Promise<{ ok: boolean; matchedName?: string; index?: number }> {
  const match = findParam(params, name)
  if (match) {
    const ok = await setParam(track, device, match.index, value)
    return { ok, matchedName: match.name, index: match.index }
  }
  // Try by name string directly
  const r = await send({ action: 'set_param', track, device, param: name, value })
  return { ok: r.ok ?? false }
}

/**
 * Dump all params as a saveable snapshot.
 */
function createSnapshot(params: ParamInfo[]): Record<string, number> {
  const snapshot: Record<string, number> = {}
  for (const p of params) {
    snapshot[p.name] = p.value
  }
  return snapshot
}

/**
 * Morph between two snapshots (linear interpolation).
 */
function morphSnapshots(
  a: Record<string, number>,
  b: Record<string, number>,
  t: number, // 0.0 = a, 1.0 = b
): Record<string, number> {
  const result: Record<string, number> = {}
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const key of allKeys) {
    const va = a[key] ?? 0
    const vb = b[key] ?? va
    result[key] = va + (vb - va) * t
  }
  return result
}

// ── Music Theory Helpers ───────────────────────────────────────────────

// F minor pentatonic scale notes across 2 octaves (Tecca-type range)
const F_MINOR_PENTA = [
  65, 68, 70, 72, 75, // F4, Ab4, Bb4, C5, Eb5
  77, 80, 82, 84,      // F5, Ab5, Bb5, C6
]

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val))
}

// ── Melody Generator ───────────────────────────────────────────────────

interface Note {
  pitch: number
  start: number
  duration: number
  velocity: number
}

function generateMelody(bars: number = 4, beatsPerBar: number = 4): Note[] {
  const notes: Note[] = []
  const totalBeats = bars * beatsPerBar
  let position = 0
  let lastPitchIdx = Math.floor(F_MINOR_PENTA.length / 2)

  while (position < totalBeats) {
    const rhythmOptions = [0.25, 0.25, 0.5, 0.5, 0.5, 1.0]
    const duration = pick(rhythmOptions)

    if (Math.random() < 0.15) {
      position += pick([0.25, 0.5])
      continue
    }

    const step = Math.random() < 0.7 ? pick([-1, 1]) : pick([-3, -2, 2, 3])
    lastPitchIdx = clamp(lastPitchIdx + step, 0, F_MINOR_PENTA.length - 1)
    const pitch = F_MINOR_PENTA[lastPitchIdx]

    const beatInBar = position % beatsPerBar
    let velocity: number
    if (beatInBar === 0) velocity = randomInRange(95, 115)
    else if (beatInBar === 2) velocity = randomInRange(85, 105)
    else if (Number.isInteger(beatInBar)) velocity = randomInRange(70, 95)
    else velocity = randomInRange(60, 90)
    velocity = Math.round(clamp(velocity, 1, 127))

    const actualDuration = duration * randomInRange(0.85, 1.0)
    notes.push({ pitch, start: position, duration: Math.max(0.1, actualDuration), velocity })
    position += duration
  }

  return notes
}

function mutateMelody(original: Note[]): Note[] {
  const mutated = original.map(note => ({
    pitch: note.pitch,
    start: Math.max(0, note.start + randomInRange(-0.03, 0.03)),
    duration: note.duration,
    velocity: Math.round(clamp(note.velocity * (1 + randomInRange(-0.15, 0.15)), 1, 127)),
  }))

  const numShifts = Math.random() < 0.5 ? 1 : 2
  for (let i = 0; i < numShifts; i++) {
    const idx = Math.floor(Math.random() * mutated.length)
    const direction = mutated[idx].pitch > 72 ? -12 : 12
    mutated[idx].pitch = clamp(mutated[idx].pitch + direction, 48, 96)
  }

  return mutated
}

// ── Serum 2 Patch Definition ───────────────────────────────────────────

/**
 * Serum 2 VST3 Reactive Bounce Patch.
 *
 * Parameter names match Serum 2 VST3 automation names.
 * IDs are documented in docs/serum2-technical-reference.md
 * All values normalized 0.0–1.0 unless noted.
 *
 * Signal flow: OSC A + OSC B → Filter 1 (MG Low 12) → Direct Out → FX
 */
const SERUM2_PATCH: Record<string, number> = {
  // ── OSC A: Saw/Square blend, tight unison ──
  'A Enable':       1,       // On
  'A Level':        0.85,    // Main oscillator, prominent
  'A Pan':          0.5,     // Center
  'A Position':     0.35,    // Wavetable position — saw/square blend (~35%)
  'A Octave':       0.5,     // 0 octave offset (0.5 = center)
  'A Semi':         0.5,     // 0 semitone
  'A Fine':         0.5,     // No detuning
  'A Unison':       0.15,    // 2-3 voices (tight, not supersaw)
  'A Uni Detune':   0.08,    // Slight detune for width
  'A Uni Blend':    0.5,     // Even blend
  'A Uni Width':    0.6,     // Moderate stereo width

  // ── OSC B: Digital/metallic wavetable, subtle layer ──
  'B Enable':       1,       // On
  'B Level':        0.2,     // Low level (15-25%), adds hidden complexity
  'B Pan':          0.5,     // Center
  'B Position':     0.55,    // Different WT position — metallic/vocal zone
  'B Octave':       0.5,     // Same octave as A
  'B Semi':         0.5,     // Same semitone
  'B Fine':         0.5,     // No detuning
  'B Uni Detune':   0.05,    // Very slight detune

  // ── OSC C: Off ──
  'C Enable':       0,

  // ── Noise: Very subtle per-hit texture ──
  'Noise Level':    0.05,    // Barely there — adds texture on ghost notes

  // ── ENV 1 (Amp): NOT standard pluck — slight sustain for groove ──
  'Env 1 Attack':   0.02,    // ~2-5ms attack (near instant)
  'Env 1 Hold':     0.0,     // No hold
  'Env 1 Decay':    0.35,    // ~300-500ms decay
  'Env 1 Sustain':  0.15,    // 10-20% sustain — THIS is the groove element
  'Env 1 Release':  0.12,    // Short release

  // ── ENV 2 (Filter): Plucky filter sweep ──
  'Env 2 Attack':   0.0,     // Instant
  'Env 2 Decay':    0.25,    // ~200-350ms
  'Env 2 Sustain':  0.1,     // Low sustain
  'Env 2 Release':  0.1,     // Short

  // ── Filter 1: MG Low 12 (Moog-style LP) — the bounce driver ──
  'Filter 1 Type':  0.009434, // MG Low 12 (default Serum 2 value)
  'Filter 1 Cutoff': 0.45,   // ~45% — warm but not dark
  'Filter 1 Res':   0.2,     // Moderate resonance
  'Filter 1 Drive': 0.15,    // Slight drive for character

  // ── LFO 1: Sample & Hold — micro-variation per hit ──
  // Note: LFO shape (S&H) must be set in Serum 2 UI
  'LFO 1 Rate':     0.45,    // ~1/8-1/16 rate
  'LFO 1 Rise':     0.0,     // Instant (trigger mode)
  'LFO 1 Delay':    0.0,     // No delay
  'LFO 1 Smooth':   0.3,     // Some smoothing

  // ── Master ──
  'Main Vol':       0.5,     // 50% = -9dB (leave headroom for FX)
  'Main Tuning':    0.5,     // A440
  'Porta Time':     0.0,     // No portamento
  'Mono Toggle':    0.0,     // Polyphonic
}

/**
 * Serum 2 Mod Matrix (64 slots available).
 * VST3 params: "Mod N Amount" (bipolar, 0.5 = no modulation)
 * Source/destination are set in the Serum 2 UI (not exposed as automatable VST3 params).
 * These define the modulation routing for the Reactive Bounce patch.
 *
 * Amount encoding: 0.5 = center (no mod), >0.5 = positive, <0.5 = negative
 * So 0.6 = +20% depth, 0.4 = -20% depth
 */
const SERUM2_MOD_MATRIX = [
  // Slot 1: Velocity → Filter 1 Cutoff (dynamics = brightness)
  { slot: 1, src: 'Velocity', dst: 'Filter 1 Cutoff', amount: 0.6 },   // +20%
  // Slot 2: Velocity → OSC A Wavetable Position (dynamics = timbre)
  { slot: 2, src: 'Velocity', dst: 'A Position', amount: 0.575 },       // +15%
  // Slot 3: Velocity → Noise Level (ghost notes get texture)
  { slot: 3, src: 'Velocity', dst: 'Noise Level', amount: 0.55 },       // +10%
  // Slot 4: LFO 1 (S&H) → Main Tuning (micro-detune per hit, ±5-10 cents)
  { slot: 4, src: 'LFO 1', dst: 'Main Tuning', amount: 0.515 },        // +3%
  // Slot 5: LFO 1 (S&H) → Filter 1 Cutoff (tiny filter wobble)
  { slot: 5, src: 'LFO 1', dst: 'Filter 1 Cutoff', amount: 0.54 },     // +8%
  // Slot 6: LFO 1 (S&H) → OSC A Pan (slight stereo micro-movement)
  { slot: 6, src: 'LFO 1', dst: 'A Pan', amount: 0.56 },               // +12%
]

const FX_CHAIN = [
  { name: 'Saturator', params: { 'Drive': 0.2, 'Type': 0.4, 'Output': 0.45, 'Dry/Wet': 0.4 } },
  { name: 'Chorus-Ensemble', params: { 'Rate 1 Hz': 0.3, 'Amount 1': 0.25, 'Dry/Wet': 0.3 } },
  { name: 'Delay', params: { 'L Beat Delay': 0.3, 'R Beat Delay': 0.35, 'Feedback': 0.2, 'Dry/Wet': 0.2 } },
  { name: 'Reverb', params: { 'DecayTime': 0.25, 'Room Size': 0.3, 'Pre Delay': 0.15, 'Dry/Wet': 0.15 } },
]

// ── Randomization Ranges ───────────────────────────────────────────────
// Musical ranges for each parameter section — prevents garbage sounds

const RANDOM_RANGES: Record<string, [number, number]> = {
  // Oscillators
  'Wt Pos':    [0.0, 1.0],
  'Level':     [0.3, 1.0],
  'Pan':       [0.3, 0.7],
  'UniDetune': [0.0, 0.25],
  'UniBlend':  [0.2, 0.8],
  'Voices':    [0.0, 0.4],
  'Fine':      [0.45, 0.55],
  'Phase':     [0.0, 1.0],
  // Envelopes
  'Atk':       [0.0, 0.3],
  'Dec':       [0.1, 0.7],
  'Sus':       [0.0, 0.8],
  'Rel':       [0.05, 0.4],
  'Hold':      [0.0, 0.1],
  // Filter
  'Cutoff':    [0.2, 0.8],
  'Res':       [0.0, 0.5],
  'Drive':     [0.0, 0.4],
  'Fat':       [0.0, 0.6],
  'Env Depth': [0.0, 0.6],
  // LFOs
  'Rate':      [0.1, 0.7],
  'Rise':      [0.0, 0.3],
  'Delay':     [0.0, 0.3],
  'Smooth':    [0.0, 0.5],
  // Noise
  'Noise Level': [0.0, 0.15],
  // Master
  'Master Vol':  [0.6, 0.85],
  'Portamento':  [0.0, 0.2],
  // FX
  'FX':        [0.0, 0.5],
  'Mix':       [0.0, 0.4],
}

function getRandomRange(paramName: string): [number, number] {
  // Try exact match
  if (RANDOM_RANGES[paramName]) return RANDOM_RANGES[paramName]
  // Try suffix match
  for (const [key, range] of Object.entries(RANDOM_RANGES)) {
    if (paramName.includes(key)) return range
  }
  // Default: full range
  return [0.0, 1.0]
}

// ── CLI Modes ──────────────────────────────────────────────────────────

async function modeDiscover(track: number) {
  console.log(`\n  Discovering params on track ${track}, device 0...\n`)
  await ensureConnected()

  const params = await getDeviceParams(track, 0)
  if (params.length === 0) {
    console.log('  No params found (is there a device on this track?)')
    die()
  }

  // Group params by section using Serum 2 VST3 naming conventions
  const grouped = new Map<string, ParamInfo[]>()
  for (const p of params) {
    let section = 'Other'
    const name = p.name
    if (name.startsWith('A ') || name.startsWith('A>')) section = 'Oscillator A'
    else if (name.startsWith('B ') || name.startsWith('B>')) section = 'Oscillator B'
    else if (name.startsWith('C ') || name.startsWith('C>')) section = 'Oscillator C'
    else if (name.startsWith('Noise')) section = 'Noise'
    else if (name.startsWith('Sub')) section = 'Sub Oscillator'
    else if (name.startsWith('Env')) section = 'Envelopes'
    else if (name.startsWith('LFO')) section = 'LFOs'
    else if (name.startsWith('Filter 1')) section = 'Filter 1'
    else if (name.startsWith('Filter 2')) section = 'Filter 2'
    else if (name.startsWith('Mod ')) section = 'Mod Matrix'
    else if (name.startsWith('FX')) section = 'FX'
    else if (name.startsWith('Macro')) section = 'Macros'
    else if (name.startsWith('Arp')) section = 'Arpeggiator'
    else if (name.startsWith('Clip')) section = 'Clip Sequencer'
    else if (name.startsWith('Main') || name.startsWith('Porta') || name.startsWith('Bend') ||
             name.startsWith('Mono') || name.startsWith('Legato') || name.startsWith('Swing') ||
             name.startsWith('Transpose') || name.startsWith('Bypass') || name.startsWith('Amp') ||
             name.startsWith('Direct') || name.startsWith('Bus') || name.startsWith('Pitch Bend') ||
             name.startsWith('Mod Wheel')) section = 'Global / Master'
    else if (name.includes('>Filter') || name.includes('>BUS')) section = 'Routing'
    else if (name.includes('Rand')) section = 'Global Randomization'

    if (!grouped.has(section)) grouped.set(section, [])
    grouped.get(section)!.push(p)
  }

  const sectionOrder = [
    'Global / Master', 'Oscillator A', 'Oscillator B', 'Oscillator C',
    'Noise', 'Sub Oscillator', 'Filter 1', 'Filter 2', 'Envelopes', 'LFOs',
    'Mod Matrix', 'Routing', 'FX', 'Macros', 'Arpeggiator',
    'Clip Sequencer', 'Global Randomization', 'Other',
  ]

  console.log(`  Total parameters: ${params.length}\n`)

  for (const section of sectionOrder) {
    const sectionParams = grouped.get(section)
    if (!sectionParams?.length) continue

    console.log(`  ── ${section} ${'─'.repeat(50 - section.length)}`)
    console.log('  │ Idx │ Name                    │ Value  │')
    console.log('  ├─────┼─────────────────────────┼────────┤')
    for (const p of sectionParams) {
      const idx = String(p.index).padStart(3)
      const name = p.name.padEnd(23)
      const val = p.value.toFixed(3).padStart(6)
      console.log(`  │ ${idx} │ ${name} │ ${val} │`)
    }
    console.log('  └─────┴─────────────────────────┴────────┘\n')
  }

  die()
}

async function modeScan() {
  console.log('\n  Scanning all tracks for Serum 2 instances...\n')
  await ensureConnected()

  const session = await send({ action: 'get_session_info' })
  const trackCount = session.tracks ?? session.track_count ?? 8

  const found: Array<{ track: number; name: string; device: string }> = []

  for (let t = 0; t < trackCount; t++) {
    const info = await send({ action: 'get_track_info', track: t })
    const trackName = info.name ?? `Track ${t}`

    // Check devices on this track
    const deviceCount = info.device_count ?? info.devices?.length ?? 0
    for (let d = 0; d < deviceCount; d++) {
      const params = await send({ action: 'get_device_params', track: t, device: d })
      if (params.ok && Array.isArray(params.params)) {
        // Check if any param names match Serum 2 patterns
        const paramNames = params.params.map((p: any) => p.name || '').join(' ')
        const isSerum = paramNames.includes('Wt Pos') || paramNames.includes('UniDetune') ||
                        paramNames.includes('LFO1 Rate') || paramNames.includes('Macro 1')
        if (isSerum) {
          found.push({ track: t, name: trackName, device: `Device ${d}` })
        }
      }
    }
  }

  if (found.length === 0) {
    console.log('  No Serum 2 instances found.')
  } else {
    console.log(`  Found ${found.length} Serum 2 instance(s):\n`)
    for (const f of found) {
      console.log(`  Track ${f.track}: "${f.name}" — ${f.device}`)
    }
  }
  console.log()
  die()
}

async function modeSet(spec: string) {
  // Format: track:paramIdx:value
  const [tStr, pStr, vStr] = spec.split(':')
  const track = parseInt(tStr, 10)
  const paramIdx = parseInt(pStr, 10)
  const value = parseFloat(vStr)

  if (isNaN(track) || isNaN(paramIdx) || isNaN(value)) {
    console.error('  Usage: --set track:paramIndex:value  (e.g. --set 0:5:0.75)')
    process.exit(1)
  }

  await ensureConnected()

  // Get the param name for confirmation
  const params = await getDeviceParams(track, 0)
  const param = params.find(p => p.index === paramIdx)
  const name = param?.name ?? `Param ${paramIdx}`
  const oldValue = param?.value ?? '?'

  const ok = await setParam(track, 0, paramIdx, value)
  if (ok) {
    console.log(`\n  Set "${name}" (idx ${paramIdx}): ${oldValue} → ${value} on track ${track}\n`)
  } else {
    console.error(`\n  Failed to set param ${paramIdx} on track ${track}\n`)
  }
  die()
}

async function modeGet(spec: string) {
  const [tStr, pStr] = spec.split(':')
  const track = parseInt(tStr, 10)
  const paramIdx = parseInt(pStr, 10)

  if (isNaN(track) || isNaN(paramIdx)) {
    console.error('  Usage: --get track:paramIndex  (e.g. --get 0:5)')
    process.exit(1)
  }

  await ensureConnected()
  const params = await getDeviceParams(track, 0)
  const param = params.find(p => p.index === paramIdx)

  if (param) {
    console.log(`\n  Track ${track}, Param ${paramIdx}: "${param.name}" = ${param.value.toFixed(4)}\n`)
  } else {
    console.error(`\n  Param ${paramIdx} not found on track ${track}\n`)
  }
  die()
}

async function modeSnapshot(track: number) {
  console.log(`\n  Creating snapshot of track ${track}, device 0...\n`)
  await ensureConnected()

  const params = await getDeviceParams(track, 0)
  if (params.length === 0) {
    console.error('  No params found')
    die()
  }

  const snapshot = createSnapshot(params)
  const filename = `serum2-snapshot-${Date.now()}.json`
  const filepath = path.join(process.cwd(), filename)

  fs.writeFileSync(filepath, JSON.stringify(snapshot, null, 2))
  console.log(`  Saved ${params.length} params to ${filename}`)
  console.log(`  Use --load ${filename} ${track} to restore\n`)
  die()
}

async function modeLoad(file: string, track: number) {
  console.log(`\n  Loading snapshot from ${file} onto track ${track}...\n`)
  await ensureConnected()

  const raw = fs.readFileSync(file, 'utf8')
  const snapshot: Record<string, number> = JSON.parse(raw)
  const params = await getDeviceParams(track, 0)

  let setCount = 0
  let failCount = 0

  for (const [name, value] of Object.entries(snapshot)) {
    const result = await setParamByName(track, 0, params, name, value)
    if (result.ok) setCount++
    else failCount++
  }

  console.log(`  Applied: ${setCount} params, failed: ${failCount}\n`)
  die()
}

async function modeSearch(name: string) {
  console.log(`\n  Searching for "${name}" across all devices...\n`)
  await ensureConnected()

  const session = await send({ action: 'get_session_info' })
  const trackCount = session.tracks ?? session.track_count ?? 8
  const lower = name.toLowerCase()

  for (let t = 0; t < trackCount; t++) {
    const params = await getDeviceParams(t, 0)
    const matches = params.filter(p => p.name.toLowerCase().includes(lower))
    if (matches.length > 0) {
      const info = await send({ action: 'get_track_info', track: t })
      console.log(`  Track ${t} "${info.name ?? '?'}":`)
      for (const m of matches) {
        console.log(`    [${m.index}] ${m.name} = ${m.value.toFixed(4)}`)
      }
      console.log()
    }
  }
  die()
}

async function modeRandomize(track: number) {
  console.log(`\n  Randomizing Serum 2 params on track ${track} (musical ranges)...\n`)
  await ensureConnected()

  const params = await getDeviceParams(track, 0)
  if (params.length === 0) {
    console.error('  No params found')
    die()
  }

  // Save current state as backup
  const backup = createSnapshot(params)
  const backupFile = `serum2-pre-random-${Date.now()}.json`
  fs.writeFileSync(path.join(process.cwd(), backupFile), JSON.stringify(backup, null, 2))
  console.log(`  Backup saved to ${backupFile}`)

  let count = 0
  for (const p of params) {
    // Skip mod matrix src/dst (those are discrete), macros (user-set), and master vol
    if (p.name.includes('Src') || p.name.includes('Dst') || p.name === 'Master Vol') continue
    if (p.name.startsWith('Macro')) continue

    const [min, max] = getRandomRange(p.name)
    const newValue = min + Math.random() * (max - min)
    await setParam(track, 0, p.index, newValue)
    count++
  }

  console.log(`  Randomized ${count} params within musical ranges`)
  console.log(`  Restore with: --load ${backupFile} ${track}\n`)
  die()
}

async function modeMorph(track: number, fileA: string, fileB: string) {
  console.log(`\n  Morphing between ${fileA} and ${fileB} on track ${track}...\n`)
  await ensureConnected()

  const snapshotA: Record<string, number> = JSON.parse(fs.readFileSync(fileA, 'utf8'))
  const snapshotB: Record<string, number> = JSON.parse(fs.readFileSync(fileB, 'utf8'))
  const params = await getDeviceParams(track, 0)

  // Morph at 50% (midpoint) — could be made into an argument
  const morphAmount = 0.5
  const morphed = morphSnapshots(snapshotA, snapshotB, morphAmount)

  let count = 0
  for (const [name, value] of Object.entries(morphed)) {
    const result = await setParamByName(track, 0, params, name, value)
    if (result.ok) count++
  }

  console.log(`  Morphed ${count} params at ${(morphAmount * 100).toFixed(0)}% blend`)
  console.log(`  A=${fileA}, B=${fileB}\n`)
  die()
}

// ── Build Mode (default) ──────────────────────────────────────────────

async function modeBuild() {
  console.log('\n  Reactive Bounce Synth — Building in Ableton...\n')
  await ensureConnected()
  console.log('  Connected to M4L bridge\n')

  // Session info
  const session = await send({ action: 'get_session_info' })
  console.log(`  Session: ${session.tempo || '?'} BPM, ${session.tracks || '?'} tracks\n`)

  // Tempo
  console.log('  Setting tempo to 140 BPM...')
  await send({ action: 'set_tempo', bpm: 140 })

  // Create track
  console.log('  Creating MIDI track...')
  const trackResult = await send({ action: 'create_midi_track' })
  const synthTrack = trackResult.track ?? trackResult.index ?? 0
  await send({ action: 'set_track_name', track: synthTrack, name: 'Reactive Bounce' })
  await send({ action: 'set_track_color', track: synthTrack, color: 0x6B5B95 })
  console.log(`  Track ${synthTrack}: "Reactive Bounce"\n`)

  // Load Serum 2
  console.log('  Loading Serum 2...')
  let pluginLoaded = false
  for (const name of ['Serum', 'Serum 2', 'SerumFX', 'Serum_x64']) {
    for (const mfr of ['Xfer Records', 'Xfer', '']) {
      const r = await send({ action: 'load_plugin', track: synthTrack, name, manufacturer: mfr })
      if (r.ok) { pluginLoaded = true; break }
    }
    if (pluginLoaded) break
  }

  if (!pluginLoaded) {
    console.log('  Could not auto-load Serum 2. Trying browse...')
    await send({ action: 'browse_and_load', track: synthTrack, category: 'Instruments', search: 'Serum' })
  }
  console.log('  Instrument loaded')
  await sleep(1500) // Let plugin initialize fully

  // Query actual params
  console.log('  Querying Serum 2 parameters...')
  const deviceParams = await getDeviceParams(synthTrack, 0)
  console.log(`  Found ${deviceParams.length} automatable parameters\n`)

  // Set patch
  console.log('  Programming Reactive Bounce patch...')
  let setCount = 0
  let failCount = 0
  const failedParams: string[] = []

  for (const [name, value] of Object.entries(SERUM2_PATCH)) {
    const result = await setParamByName(synthTrack, 0, deviceParams, name, value)
    if (result.ok) {
      setCount++
    } else {
      failCount++
      failedParams.push(name)
    }
  }
  console.log(`  Set ${setCount} parameters`)
  if (failCount > 0) {
    console.log(`  ${failCount} params not matched: ${failedParams.join(', ')}`)
  }

  // Try to set mod matrix amounts via VST3 params
  // Note: Serum 2 mod matrix sources/destinations are set in the UI,
  // but amounts are automatable as "Mod N Amount" (ID 6000000 + (N-1)*1000)
  console.log('\n  Setting mod matrix amounts...')
  let modSetCount = 0
  for (const mod of SERUM2_MOD_MATRIX) {
    // Try exact VST3 name: "Mod N Amount"
    const paramName = `Mod ${mod.slot} Amount`
    const amtParam = findParam(deviceParams, paramName)
    if (amtParam) {
      await setParam(synthTrack, 0, amtParam.index, mod.amount)
      modSetCount++
    } else {
      // Fallback: try by name string
      const r = await send({ action: 'set_param', track: synthTrack, device: 0, param: paramName, value: mod.amount })
      if (r.ok) modSetCount++
    }
  }
  if (modSetCount > 0) {
    console.log(`  Set ${modSetCount} mod matrix amounts`)
    console.log('  NOTE: Mod sources/destinations must be set in Serum 2 UI')
  } else {
    console.log('  Mod matrix params not found via VST3 — set manually in Serum 2')
  }

  // Save the initial snapshot
  const snapshot = createSnapshot(await getDeviceParams(synthTrack, 0))
  const snapshotFile = 'reactive-bounce-init.json'
  fs.writeFileSync(path.join(process.cwd(), snapshotFile), JSON.stringify(snapshot, null, 2))
  console.log(`  Snapshot saved to ${snapshotFile}`)

  // Generate melody
  console.log('\n  Generating melody...')
  const melody = generateMelody(4, 4)
  const mutatedMelody = mutateMelody(melody)

  const m4lNotes = melody.map(n => [n.pitch, n.start, n.duration, n.velocity] as [number, number, number, number])
  const m4lMutated = mutatedMelody.map(n => [n.pitch, n.start, n.duration, n.velocity] as [number, number, number, number])

  console.log(`  ${melody.length} notes (F minor pentatonic)`)
  console.log(`  Mutated variant: ${mutatedMelody.length} notes\n`)

  // Create clips
  console.log('  Creating clips...')
  await send({ action: 'create_clip', track: synthTrack, slot: 0, length: 16, name: 'Bounce A' })
  await send({ action: 'add_notes', track: synthTrack, slot: 0, notes: m4lNotes })
  console.log('  Clip 0: "Bounce A" (original)')

  await send({ action: 'create_clip', track: synthTrack, slot: 1, length: 16, name: 'Bounce B (mutated)' })
  await send({ action: 'add_notes', track: synthTrack, slot: 1, notes: m4lMutated })
  console.log('  Clip 1: "Bounce B (mutated)"\n')

  // Load FX chain
  console.log('  Loading Ableton FX chain...')
  for (const fx of FX_CHAIN) {
    const fxResult = await send({
      action: 'browse_and_load',
      track: synthTrack,
      category: 'Audio Effects',
      search: fx.name,
    })

    if (fxResult.ok) {
      await sleep(500)
      const trackInfo = await send({ action: 'get_track_info', track: synthTrack })
      const deviceCount = trackInfo.device_count || trackInfo.devices?.length || 2
      const fxDeviceIdx = deviceCount - 1

      for (const [paramName, value] of Object.entries(fx.params)) {
        await send({ action: 'set_param', track: synthTrack, device: fxDeviceIdx, param: paramName, value })
      }
      console.log(`  ${fx.name} loaded + configured`)
    } else {
      console.log(`  Could not load ${fx.name} — add manually`)
    }
  }

  // Set volume and fire
  await send({ action: 'set_volume', track: synthTrack, volume: 0.8 })
  console.log('\n  Firing clip A...')
  await send({ action: 'fire_clip', track: synthTrack, slot: 0 })
  await send({ action: 'start_playing' })
  console.log('  Playing!\n')

  // Summary
  console.log('  ══════════════════════════════════════════════════════')
  console.log('  REACTIVE BOUNCE SYNTH — READY')
  console.log('  ══════════════════════════════════════════════════════')
  console.log(`  Track: ${synthTrack} "Reactive Bounce"`)
  console.log('  Tempo: 140 BPM  |  Key: F minor pentatonic')
  console.log('  Clips: 2 (A=original, B=mutated)')
  console.log('  FX: Saturator > Chorus > Delay > Reverb')
  console.log('  Snapshot: reactive-bounce-init.json')
  console.log()
  console.log('  WHAT MAKES IT "REACTIVE":')
  console.log('  Velocity -> filter cutoff (dynamics = brightness)')
  console.log('  Velocity -> wavetable pos  (dynamics = timbre)')
  console.log('  Velocity -> noise level    (ghost notes get texture)')
  console.log('  LFO S&H  -> pitch          (micro-detune per hit)')
  console.log('  LFO S&H  -> cutoff          (tiny filter wobble)')
  console.log('  LFO S&H  -> pan             (stereo micro-movement)')
  console.log()
  console.log('  MANUAL TWEAKS (in Serum 2 UI):')
  console.log('  1. Set LFO 1 shape to Sample & Hold')
  console.log('  2. Set LFO 1 mode to Trigger')
  console.log('  3. OSC A: pick "Basic Shapes" wavetable')
  console.log('  4. OSC B: pick a Digital/metallic wavetable')
  console.log('  5. Drag mod matrix routes if not auto-set:')
  console.log()
  console.log('  Mod Matrix:')
  console.log('  Source       | Destination     | Amount')
  console.log('  -------------|-----------------|-------')
  for (const mod of SERUM2_MOD_MATRIX) {
    console.log(`  ${mod.src.padEnd(13)}| ${mod.dst.padEnd(16)}| ${(mod.amount * 100).toFixed(0)}%`)
  }
  console.log()
  console.log('  EDITING COMMANDS:')
  console.log(`  --discover ${synthTrack}      List all Serum 2 params`)
  console.log(`  --set ${synthTrack}:5:0.75     Set param 5 to 0.75`)
  console.log(`  --get ${synthTrack}:5          Get param 5 value`)
  console.log(`  --snapshot ${synthTrack}       Save all params to JSON`)
  console.log(`  --randomize ${synthTrack}      Randomize within musical ranges`)
  console.log(`  --load file.json ${synthTrack}  Restore from snapshot`)
  console.log('  ══════════════════════════════════════════════════════\n')

  die()
}

// ── Entry Point ────────────────────────────────────────────────────────

const args = process.argv.slice(2)

if (args[0] === '--discover') {
  modeDiscover(parseInt(args[1] ?? '0', 10))
} else if (args[0] === '--scan') {
  modeScan()
} else if (args[0] === '--set') {
  modeSet(args[1])
} else if (args[0] === '--get') {
  modeGet(args[1])
} else if (args[0] === '--snapshot') {
  modeSnapshot(parseInt(args[1] ?? '0', 10))
} else if (args[0] === '--load') {
  modeLoad(args[1], parseInt(args[2] ?? '0', 10))
} else if (args[0] === '--search') {
  modeSearch(args[1])
} else if (args[0] === '--randomize') {
  modeRandomize(parseInt(args[1] ?? '0', 10))
} else if (args[0] === '--morph') {
  modeMorph(parseInt(args[1] ?? '0', 10), args[2], args[3])
} else {
  modeBuild()
}
