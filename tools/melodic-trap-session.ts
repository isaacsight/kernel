#!/usr/bin/env npx tsx
/**
 * melodic-trap-session.ts — Full melodic trap session with emotional depth
 *
 * Concept: "Emotional Drift"
 * Melodic trap foundation with micro-variation on every element,
 * subtle genre blending (R&B chords, lo-fi textures, ambient pads),
 * and controlled randomness that makes every bar feel alive.
 *
 * Tracks:
 *   1. LEAD    — Serum 2 "Reactive Bounce" melody (F minor, velocity-reactive)
 *   2. PAD     — Serum 2 lush emotional pad (slow WT movement, reverb wash)
 *   3. CHORDS  — Serum 2 R&B-tinged chord stabs (7ths, 9ths, genre-blending)
 *   4. 808     — Deep sub bass (Operator or Serum sine)
 *   5. DRUMS   — Drum Rack (kick, snare, hats, perc)
 *   6. TEXTURE — Noise/atmosphere layer (lo-fi vinyl, ambient hiss)
 *
 * Key:   F minor (trap standard, emotional weight)
 * BPM:   145 (modern melodic trap zone)
 * Bars:  8 (2 scenes: A=main, B=variation)
 *
 * Run: npx tsx tools/melodic-trap-session.ts
 */

import * as net from 'node:net'

// ── M4L Bridge ─────────────────────────────────────────────────────────

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
          const r = JSON.parse(trimmed)
          if (r.id && pending.has(r.id)) {
            const req = pending.get(r.id)!
            pending.delete(r.id)
            req.resolve(r)
          }
        } catch {}
      }
    })
    socket.on('error', () => resolve(false))
    socket.connect(PORT, HOST, () => resolve(true))
    setTimeout(() => { socket?.destroy(); resolve(false) }, 5000)
  })
}

function send(cmd: Record<string, unknown>): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!socket) return reject(new Error('Not connected'))
    const id = nextId++
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timeout: ${cmd.action}`)) }, TIMEOUT)
    pending.set(id, {
      resolve: (r) => { clearTimeout(timer); resolve(r) },
      reject: (e) => { clearTimeout(timer); reject(e) },
    })
    socket.write(JSON.stringify({ id, ...cmd }) + '\n')
  })
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]
const rand = (min: number, max: number) => min + Math.random() * (max - min)
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

// ── Music Theory ───────────────────────────────────────────────────────

// F minor scale (natural)
const F_MINOR = [53, 55, 56, 58, 60, 61, 63, 65, 67, 68, 70, 72, 73, 75, 77, 79, 80]
// F minor pentatonic (for melody)
const F_MINOR_PENTA = [65, 68, 70, 72, 75, 77, 80, 82, 84]
// Chord voicings in F minor (MIDI note arrays) — R&B-flavored with 7ths/9ths
const CHORDS = {
  // Fm9: F Ab C Eb G
  Fm9:   [53, 56, 60, 63, 67],
  // Dbmaj7: Db F Ab C
  Dbmaj7: [61, 65, 68, 72],
  // Bbm7: Bb Db F Ab
  Bbm7:  [58, 61, 65, 68],
  // Cmaj7sus: C F G Bb (sus4 flavor)
  Csus:  [60, 65, 67, 70],
  // Abmaj9: Ab C Eb G Bb
  Abmaj9: [56, 60, 63, 67, 70],
  // Ebmaj7: Eb G Bb D
  Ebmaj7: [63, 67, 70, 74],
}

// Chord progression (8 bars, 2 chords per bar = 16 changes)
const PROGRESSION = [
  'Fm9', 'Fm9', 'Dbmaj7', 'Dbmaj7',
  'Bbm7', 'Bbm7', 'Csus', 'Csus',
  'Abmaj9', 'Abmaj9', 'Ebmaj7', 'Ebmaj7',
  'Fm9', 'Fm9', 'Dbmaj7', 'Csus',
]

type Note = [number, number, number, number] // [pitch, start, duration, velocity]

// ── Melody Generator (emotional, breathing) ────────────────────────────

function generateMelody(bars: number): Note[] {
  const notes: Note[] = []
  const totalBeats = bars * 4
  let pos = 0
  let lastIdx = 4 // Start mid-range

  while (pos < totalBeats) {
    // Breathing rhythm: mix long and short notes with rests
    const rhythms = [0.5, 0.5, 0.75, 1.0, 1.5, 0.25, 0.5]
    const dur = pick(rhythms)

    // Rest probability increases on off-beats (breathing space)
    const beatInBar = pos % 4
    const restChance = beatInBar === 0 ? 0.05 : beatInBar === 2 ? 0.1 : 0.2
    if (Math.random() < restChance) {
      pos += pick([0.25, 0.5, 0.75])
      continue
    }

    // Pitch: mostly stepwise with emotional leaps (4ths, 5ths)
    let step: number
    if (Math.random() < 0.6) step = pick([-1, 1])
    else if (Math.random() < 0.8) step = pick([-2, 2])
    else step = pick([-3, -4, 3, 4]) // Emotional leap

    lastIdx = clamp(lastIdx + step, 0, F_MINOR_PENTA.length - 1)
    const pitch = F_MINOR_PENTA[lastIdx]

    // Velocity: emotional dynamics
    // Downbeats stronger, phrase peaks louder, phrase ends softer
    const phrasePos = (pos % 8) / 8 // 0-1 within 2-bar phrase
    let vel: number
    if (phrasePos < 0.3) vel = rand(85, 110)      // Opening: confident
    else if (phrasePos < 0.6) vel = rand(95, 120)  // Peak: emotional climax
    else vel = rand(65, 90)                         // Tail: pulling back

    // Micro-variation: timing humanization
    const timeShift = rand(-0.02, 0.02) // ±~7ms at 145 BPM

    notes.push([
      pitch,
      Math.max(0, pos + timeShift),
      dur * rand(0.8, 0.95), // Slightly shorter than grid (breathing)
      Math.round(clamp(vel, 1, 127)),
    ])

    pos += dur
  }
  return notes
}

// ── Melody Mutation (Scene B variation) ────────────────────────────────

function mutateMelody(orig: Note[]): Note[] {
  return orig.map(([pitch, start, dur, vel]) => {
    // Timing: ±15ms drift
    const newStart = Math.max(0, start + rand(-0.035, 0.035))
    // Velocity: ±20% variation
    const newVel = Math.round(clamp(vel * (1 + rand(-0.2, 0.2)), 1, 127))
    // Pitch: 10% chance of octave jump
    let newPitch = pitch
    if (Math.random() < 0.1) newPitch = pitch + (pitch > 74 ? -12 : 12)
    // Duration: slight variation
    const newDur = dur * rand(0.85, 1.15)
    return [newPitch, newStart, newDur, newVel] as Note
  })
}

// ── Chord Pattern Generator ────────────────────────────────────────────

function generateChords(bars: number): Note[] {
  const notes: Note[] = []
  for (let bar = 0; bar < bars; bar++) {
    const chordName = PROGRESSION[bar % PROGRESSION.length] as keyof typeof CHORDS
    const chord = CHORDS[chordName]

    // R&B stab rhythm: hit on 1, sometimes on 2.5 or 3
    const beatStart = bar * 4
    const mainVel = Math.round(rand(75, 100))

    // Main hit
    for (const p of chord) {
      notes.push([p, beatStart + rand(-0.01, 0.01), rand(1.5, 2.5), mainVel])
    }

    // Secondary hit (60% chance) — off-beat stab
    if (Math.random() < 0.6) {
      const offBeat = pick([1.5, 2.0, 2.5, 3.0])
      const offVel = Math.round(rand(55, 80))
      for (const p of chord) {
        notes.push([p, beatStart + offBeat + rand(-0.01, 0.01), rand(0.5, 1.0), offVel])
      }
    }
  }
  return notes
}

// ── Pad Generator (long sustained notes) ───────────────────────────────

function generatePad(bars: number): Note[] {
  const notes: Note[] = []
  // Whole-note pads following root + 5th of each chord
  for (let bar = 0; bar < bars; bar += 2) {
    const chordName = PROGRESSION[bar % PROGRESSION.length] as keyof typeof CHORDS
    const chord = CHORDS[chordName]
    const root = chord[0]
    const fifth = chord.length > 2 ? chord[2] : chord[1]

    const vel = Math.round(rand(50, 70)) // Soft, background
    notes.push([root, bar * 4, 7.5, vel])       // Root, nearly 2 bars
    notes.push([fifth, bar * 4, 7.5, vel - 10]) // 5th, slightly softer
    // Add high octave root for shimmer
    notes.push([root + 12, bar * 4, 7.5, Math.round(vel * 0.6)])
  }
  return notes
}

// ── 808 Bass Pattern ───────────────────────────────────────────────────

function generate808(bars: number): Note[] {
  const notes: Note[] = []
  // Follow root of chord progression, trap rhythm
  for (let bar = 0; bar < bars; bar++) {
    const chordName = PROGRESSION[bar % PROGRESSION.length] as keyof typeof CHORDS
    const root = CHORDS[chordName][0] - 12 // One octave below chord root

    const beatStart = bar * 4

    // Trap 808 pattern: hit on 1, sometimes 3, occasional 16th fills
    notes.push([root, beatStart, 1.5, Math.round(rand(100, 120))])

    // Beat 3 hit (70% chance)
    if (Math.random() < 0.7) {
      notes.push([root, beatStart + 2, 1.0, Math.round(rand(90, 110))])
    }

    // 16th note fill before next bar (30% chance)
    if (Math.random() < 0.3) {
      notes.push([root, beatStart + 3.5, 0.25, Math.round(rand(80, 100))])
      notes.push([root + 2, beatStart + 3.75, 0.25, Math.round(rand(70, 90))])
    }
  }
  return notes
}

// ── Drum Pattern Generator ─────────────────────────────────────────────

// GM drum map
const KICK = 36
const SNARE = 38
const CLAP = 39
const CLOSED_HH = 42
const OPEN_HH = 46
const PERC = 56 // Cowbell slot — use for perc

function generateDrums(bars: number): Note[] {
  const notes: Note[] = []

  for (let bar = 0; bar < bars; bar++) {
    const b = bar * 4

    // Kick: 1, (2.5), 3 — standard trap
    notes.push([KICK, b, 0.5, Math.round(rand(110, 127))])
    if (Math.random() < 0.5) notes.push([KICK, b + 2.5, 0.25, Math.round(rand(95, 115))])
    notes.push([KICK, b + 2, 0.5, Math.round(rand(100, 120))])

    // Snare/Clap: 2, 4
    notes.push([SNARE, b + 1, 0.5, Math.round(rand(95, 115))])
    notes.push([CLAP, b + 1 + rand(-0.01, 0.01), 0.5, Math.round(rand(80, 100))]) // Layered slightly off
    notes.push([SNARE, b + 3, 0.5, Math.round(rand(95, 115))])
    notes.push([CLAP, b + 3 + rand(-0.01, 0.01), 0.5, Math.round(rand(80, 100))])

    // Hi-hats: 16th note pattern with velocity variation + open hat accents
    for (let i = 0; i < 16; i++) {
      const hhPos = b + i * 0.25
      // Skip some for groove (trap hihat pattern)
      if (i % 4 === 0 && Math.random() < 0.2) continue // Sometimes skip downbeats

      const isAccent = i % 2 === 0
      const isRoll = i >= 12 && Math.random() < 0.4 // Rolls at end of bar
      let hhVel = isAccent ? rand(70, 95) : rand(40, 65)
      if (isRoll) hhVel = rand(50, 80)

      // Open hat on some off-beats
      const isOpen = !isAccent && Math.random() < 0.15
      const hhNote = isOpen ? OPEN_HH : CLOSED_HH

      // Micro-timing humanization
      const hhShift = rand(-0.015, 0.015)

      notes.push([hhNote, hhPos + hhShift, isOpen ? 0.4 : 0.15, Math.round(clamp(hhVel, 1, 127))])
    }

    // Percussion hits (sparse, textural)
    if (Math.random() < 0.3) {
      notes.push([PERC, b + pick([1.5, 2.5, 3.5]), 0.25, Math.round(rand(50, 75))])
    }
  }

  return notes
}

// ── Serum 2 Patch Definitions ──────────────────────────────────────────

// Lead: "Emotional Drift" — reactive bounce with feeling
const LEAD_PATCH: Record<string, number> = {
  'A Enable': 1,
  'A Level': 0.8,
  'A Pan': 0.5,
  'A Position': 0.3,      // Saw-ish zone, warm
  'A Octave': 0.5,
  'A Semi': 0.5,
  'A Fine': 0.5,
  'A Unison': 0.12,       // 2 voices, tight
  'A Uni Detune': 0.06,
  'A Uni Width': 0.55,
  'B Enable': 1,
  'B Level': 0.18,         // Subtle metallic layer
  'B Pan': 0.5,
  'B Position': 0.6,       // Digital/vocal zone
  'B Octave': 0.5,
  'B Uni Detune': 0.04,
  'C Enable': 0,
  'Noise Level': 0.04,     // Whisper texture
  'Env 1 Attack': 0.02,
  'Env 1 Decay': 0.35,
  'Env 1 Sustain': 0.18,   // Groove sustain
  'Env 1 Release': 0.15,
  'Env 2 Attack': 0.0,
  'Env 2 Decay': 0.22,
  'Env 2 Sustain': 0.08,
  'Env 2 Release': 0.1,
  'Filter 1 Cutoff': 0.48,
  'Filter 1 Res': 0.18,
  'Filter 1 Drive': 0.12,
  'LFO 1 Rate': 0.42,      // S&H rate
  'LFO 1 Smooth': 0.35,
  'Main Vol': 0.5,
}

// Pad: "Emotional Wash" — lush, evolving, wide
const PAD_PATCH: Record<string, number> = {
  'A Enable': 1,
  'A Level': 0.7,
  'A Pan': 0.5,
  'A Position': 0.2,       // Warm, smooth zone
  'A Unison': 0.35,        // 5-6 voices, wide
  'A Uni Detune': 0.18,    // Rich detune
  'A Uni Width': 0.8,      // Very wide
  'B Enable': 1,
  'B Level': 0.4,
  'B Pan': 0.5,
  'B Position': 0.45,      // Slightly different texture
  'B Unison': 0.25,        // 4 voices
  'B Uni Detune': 0.15,
  'C Enable': 0,
  'Noise Level': 0.03,
  'Env 1 Attack': 0.4,     // Slow fade in
  'Env 1 Decay': 0.2,
  'Env 1 Sustain': 0.85,   // Full sustain
  'Env 1 Release': 0.55,   // Long release (atmosphere)
  'Filter 1 Cutoff': 0.55,
  'Filter 1 Res': 0.1,
  'Filter 1 Drive': 0.05,
  'LFO 1 Rate': 0.2,       // Slow movement
  'LFO 1 Smooth': 0.6,     // Very smooth
  'Main Vol': 0.45,
}

// Chords: "R&B Glass" — clean, bright, stab-like
const CHORD_PATCH: Record<string, number> = {
  'A Enable': 1,
  'A Level': 0.75,
  'A Pan': 0.5,
  'A Position': 0.5,       // Bright, clean zone
  'A Unison': 0.08,        // 2 voices, very tight
  'A Uni Detune': 0.03,
  'A Uni Width': 0.5,
  'B Enable': 1,
  'B Level': 0.25,
  'B Pan': 0.5,
  'B Position': 0.7,       // Bell-ish overtone
  'C Enable': 0,
  'Noise Level': 0.0,
  'Env 1 Attack': 0.01,
  'Env 1 Decay': 0.45,     // Medium decay
  'Env 1 Sustain': 0.25,
  'Env 1 Release': 0.2,
  'Env 2 Attack': 0.0,
  'Env 2 Decay': 0.3,
  'Env 2 Sustain': 0.15,
  'Env 2 Release': 0.15,
  'Filter 1 Cutoff': 0.6,  // Brighter than lead
  'Filter 1 Res': 0.12,
  'Filter 1 Drive': 0.08,
  'Main Vol': 0.45,
}

// ── FX Chains (Ableton native) ─────────────────────────────────────────

const LEAD_FX = [
  { name: 'Saturator', params: { 'Drive': 0.15, 'Dry/Wet': 0.35 } },
  { name: 'Chorus-Ensemble', params: { 'Amount 1': 0.2, 'Dry/Wet': 0.25 } },
  { name: 'Delay', params: { 'Feedback': 0.2, 'Dry/Wet': 0.18 } },
  { name: 'Reverb', params: { 'DecayTime': 0.3, 'Dry/Wet': 0.15 } },
]

const PAD_FX = [
  { name: 'Chorus-Ensemble', params: { 'Amount 1': 0.4, 'Dry/Wet': 0.4 } },
  { name: 'Reverb', params: { 'DecayTime': 0.6, 'Room Size': 0.7, 'Dry/Wet': 0.45 } },
]

const CHORD_FX = [
  { name: 'Saturator', params: { 'Drive': 0.1, 'Dry/Wet': 0.2 } },
  { name: 'Delay', params: { 'Feedback': 0.15, 'Dry/Wet': 0.12 } },
  { name: 'Reverb', params: { 'DecayTime': 0.2, 'Dry/Wet': 0.2 } },
]

// ── Track Colors ───────────────────────────────────────────────────────

const COLORS = {
  lead:    0x6B5B95, // Amethyst
  pad:     0x4A90D9, // Steel blue
  chords:  0xD4A574, // Warm gold
  bass:    0xE74C3C, // Deep red
  drums:   0xF39C12, // Orange
  texture: 0x7F8C8D, // Muted grey
}

// ── Main Build ─────────────────────────────────────────────────────────

async function main() {
  console.log('\n  EMOTIONAL DRIFT — Melodic Trap Session')
  console.log('  Building in Ableton + Serum 2...\n')

  // Connect
  const ok = await connect()
  if (!ok) {
    console.error('  Cannot connect to M4L bridge on localhost:9999')
    console.error('  Open Ableton + load kbot-bridge.amxd\n')
    process.exit(1)
  }
  const pong = await send({ action: 'ping' })
  if (!pong.ok) { console.error('  Ping failed'); process.exit(1) }
  console.log('  Connected to M4L bridge\n')

  // Session setup
  console.log('  Setting tempo: 145 BPM')
  await send({ action: 'set_tempo', bpm: 145 })

  // ── Track 1: LEAD ──────────────────────────────────────────────────

  console.log('\n  [1/6] LEAD — Emotional Drift melody')
  const leadTrack = await send({ action: 'create_midi_track' })
  const lt = leadTrack.track ?? leadTrack.index ?? 0
  await send({ action: 'set_track_name', track: lt, name: 'LEAD' })
  await send({ action: 'set_track_color', track: lt, color: COLORS.lead })

  // Load Serum 2
  console.log('        Loading Serum 2...')
  let loaded = false
  for (const name of ['Serum', 'Serum 2']) {
    for (const mfr of ['Xfer Records', 'Xfer', '']) {
      const r = await send({ action: 'load_plugin', track: lt, name, manufacturer: mfr })
      if (r.ok) { loaded = true; break }
    }
    if (loaded) break
  }
  if (!loaded) await send({ action: 'browse_and_load', track: lt, category: 'Instruments', search: 'Serum' })
  await sleep(1500)

  // Set lead params
  console.log('        Programming patch...')
  const leadParams = await send({ action: 'get_device_params', track: lt, device: 0 })
  for (const [name, value] of Object.entries(LEAD_PATCH)) {
    await send({ action: 'set_param', track: lt, device: 0, param: name, value })
  }

  // Generate melody clips
  const melodyA = generateMelody(8)
  const melodyB = mutateMelody(melodyA)

  await send({ action: 'create_clip', track: lt, slot: 0, length: 32, name: 'Lead A' })
  await send({ action: 'add_notes', track: lt, slot: 0, notes: melodyA })
  await send({ action: 'create_clip', track: lt, slot: 1, length: 32, name: 'Lead B (drift)' })
  await send({ action: 'add_notes', track: lt, slot: 1, notes: melodyB })
  console.log(`        ${melodyA.length} notes + mutated variant`)

  // Lead FX
  for (const fx of LEAD_FX) {
    await send({ action: 'browse_and_load', track: lt, category: 'Audio Effects', search: fx.name })
    await sleep(300)
  }
  await send({ action: 'set_volume', track: lt, volume: 0.75 })
  console.log('        FX: Saturator > Chorus > Delay > Reverb')

  // ── Track 2: PAD ───────────────────────────────────────────────────

  console.log('\n  [2/6] PAD — Emotional Wash')
  const padTrack = await send({ action: 'create_midi_track' })
  const pt = padTrack.track ?? padTrack.index ?? 1
  await send({ action: 'set_track_name', track: pt, name: 'PAD' })
  await send({ action: 'set_track_color', track: pt, color: COLORS.pad })

  // Load Serum 2 on pad track
  loaded = false
  for (const name of ['Serum', 'Serum 2']) {
    for (const mfr of ['Xfer Records', 'Xfer', '']) {
      const r = await send({ action: 'load_plugin', track: pt, name, manufacturer: mfr })
      if (r.ok) { loaded = true; break }
    }
    if (loaded) break
  }
  if (!loaded) await send({ action: 'browse_and_load', track: pt, category: 'Instruments', search: 'Serum' })
  await sleep(1500)

  // Set pad params
  for (const [name, value] of Object.entries(PAD_PATCH)) {
    await send({ action: 'set_param', track: pt, device: 0, param: name, value })
  }

  const padNotes = generatePad(8)
  await send({ action: 'create_clip', track: pt, slot: 0, length: 32, name: 'Pad A' })
  await send({ action: 'add_notes', track: pt, slot: 0, notes: padNotes })
  console.log(`        ${padNotes.length} sustained notes`)

  // Pad FX
  for (const fx of PAD_FX) {
    await send({ action: 'browse_and_load', track: pt, category: 'Audio Effects', search: fx.name })
    await sleep(300)
  }
  await send({ action: 'set_volume', track: pt, volume: 0.55 })
  console.log('        FX: Chorus > Reverb (wet)')

  // ── Track 3: CHORDS ────────────────────────────────────────────────

  console.log('\n  [3/6] CHORDS — R&B Glass stabs')
  const chordTrack = await send({ action: 'create_midi_track' })
  const ct = chordTrack.track ?? chordTrack.index ?? 2
  await send({ action: 'set_track_name', track: ct, name: 'CHORDS' })
  await send({ action: 'set_track_color', track: ct, color: COLORS.chords })

  // Load Serum 2 on chord track
  loaded = false
  for (const name of ['Serum', 'Serum 2']) {
    for (const mfr of ['Xfer Records', 'Xfer', '']) {
      const r = await send({ action: 'load_plugin', track: ct, name, manufacturer: mfr })
      if (r.ok) { loaded = true; break }
    }
    if (loaded) break
  }
  if (!loaded) await send({ action: 'browse_and_load', track: ct, category: 'Instruments', search: 'Serum' })
  await sleep(1500)

  // Set chord params
  for (const [name, value] of Object.entries(CHORD_PATCH)) {
    await send({ action: 'set_param', track: ct, device: 0, param: name, value })
  }

  const chordNotes = generateChords(8)
  await send({ action: 'create_clip', track: ct, slot: 0, length: 32, name: 'Chords A' })
  await send({ action: 'add_notes', track: ct, slot: 0, notes: chordNotes })
  console.log(`        ${chordNotes.length} notes (7ths + 9ths)`)

  // Chord FX
  for (const fx of CHORD_FX) {
    await send({ action: 'browse_and_load', track: ct, category: 'Audio Effects', search: fx.name })
    await sleep(300)
  }
  await send({ action: 'set_volume', track: ct, volume: 0.6 })
  console.log('        FX: Saturator > Delay > Reverb')

  // ── Track 4: 808 BASS ──────────────────────────────────────────────

  console.log('\n  [4/6] 808 — Deep sub')
  const bassTrack = await send({ action: 'create_midi_track' })
  const bt = bassTrack.track ?? bassTrack.index ?? 3
  await send({ action: 'set_track_name', track: bt, name: '808' })
  await send({ action: 'set_track_color', track: bt, color: COLORS.bass })

  // Load Operator for 808 (native, reliable)
  await send({ action: 'browse_and_load', track: bt, category: 'Instruments', search: 'Operator' })
  await sleep(1000)

  const bassNotes = generate808(8)
  await send({ action: 'create_clip', track: bt, slot: 0, length: 32, name: '808 A' })
  await send({ action: 'add_notes', track: bt, slot: 0, notes: bassNotes })
  console.log(`        ${bassNotes.length} notes`)

  // 808 FX: Saturator for harmonics
  await send({ action: 'browse_and_load', track: bt, category: 'Audio Effects', search: 'Saturator' })
  await sleep(300)
  await send({ action: 'set_volume', track: bt, volume: 0.85 })
  console.log('        FX: Saturator (warmth)')

  // ── Track 5: DRUMS ─────────────────────────────────────────────────

  console.log('\n  [5/6] DRUMS — Trap kit')
  const drumTrack = await send({ action: 'create_midi_track' })
  const dt = drumTrack.track ?? drumTrack.index ?? 4
  await send({ action: 'set_track_name', track: dt, name: 'DRUMS' })
  await send({ action: 'set_track_color', track: dt, color: COLORS.drums })

  // Load Drum Rack
  await send({ action: 'browse_and_load', track: dt, category: 'Drums', search: 'Kit-Core 808' })
  await sleep(1000)

  const drumNotes = generateDrums(8)
  await send({ action: 'create_clip', track: dt, slot: 0, length: 32, name: 'Drums A' })
  await send({ action: 'add_notes', track: dt, slot: 0, notes: drumNotes })
  console.log(`        ${drumNotes.length} hits (kick, snare, hats, perc)`)
  await send({ action: 'set_volume', track: dt, volume: 0.8 })

  // ── Track 6: TEXTURE ───────────────────────────────────────────────

  console.log('\n  [6/6] TEXTURE — Lo-fi atmosphere')
  const texTrack = await send({ action: 'create_midi_track' })
  const tt = texTrack.track ?? texTrack.index ?? 5
  await send({ action: 'set_track_name', track: tt, name: 'TEXTURE' })
  await send({ action: 'set_track_color', track: tt, color: COLORS.texture })

  // Load Drift (Ableton native, good for textures)
  await send({ action: 'browse_and_load', track: tt, category: 'Instruments', search: 'Drift' })
  await sleep(1000)

  // Long sustained texture notes
  const texNotes: Note[] = [
    [65, 0, 31, 40],  // F4, full 8 bars, very quiet
    [72, 0, 31, 30],  // C5, even quieter
  ]
  await send({ action: 'create_clip', track: tt, slot: 0, length: 32, name: 'Atmos' })
  await send({ action: 'add_notes', track: tt, slot: 0, notes: texNotes })

  // Texture FX: heavy reverb + EQ
  await send({ action: 'browse_and_load', track: tt, category: 'Audio Effects', search: 'Reverb' })
  await sleep(300)
  await send({ action: 'set_volume', track: tt, volume: 0.3 }) // Very quiet, just atmosphere
  console.log('        Ambient drone layer')

  // ── Fire & Play ────────────────────────────────────────────────────

  console.log('\n  Firing all clips...')
  for (const track of [lt, pt, ct, bt, dt, tt]) {
    await send({ action: 'fire_clip', track, slot: 0 })
  }
  await send({ action: 'start_playing' })
  console.log('  Playing!\n')

  // ── Summary ────────────────────────────────────────────────────────

  console.log('  ================================================================')
  console.log('  EMOTIONAL DRIFT — Melodic Trap Session')
  console.log('  ================================================================')
  console.log('  Key: F minor  |  BPM: 145  |  Bars: 8')
  console.log('  Progression: Fm9 > Dbmaj7 > Bbm7 > Csus > Abmaj9 > Ebmaj7')
  console.log()
  console.log('  TRACKS:')
  console.log(`  ${lt}  LEAD     Serum 2 "Emotional Drift" (velocity-reactive bounce)`)
  console.log(`  ${pt}  PAD      Serum 2 "Emotional Wash" (wide unison, slow evolution)`)
  console.log(`  ${ct}  CHORDS   Serum 2 "R&B Glass" (7th/9th stabs, off-beat hits)`)
  console.log(`  ${bt}  808      Operator sine sub (following chord roots)`)
  console.log(`  ${dt}  DRUMS    Kit-Core 808 (humanized hats, layered snare/clap)`)
  console.log(`  ${tt}  TEXTURE  Drift ambient drone (very quiet atmosphere)`)
  console.log()
  console.log('  GENRE BLENDING:')
  console.log('  - R&B: maj7/min9 chord voicings, velocity dynamics')
  console.log('  - Lo-Fi: texture layer, soft saturation, timing drift')
  console.log('  - Ambient: pad wash, long reverb tails, drone layer')
  console.log('  - Trap: 808 pattern, hihat rolls, snare/clap layers')
  console.log()
  console.log('  MICRO-VARIATION:')
  console.log('  - Melody: velocity follows 2-bar emotional arc')
  console.log('  - Timing: all notes humanized +/-15ms')
  console.log('  - Hihats: velocity + timing randomized per hit')
  console.log('  - Chords: off-beat stabs randomized (60% chance)')
  console.log('  - Scene B: melody mutated (timing/velocity/octave drift)')
  console.log()
  console.log('  SERUM 2 MANUAL TWEAKS:')
  console.log('  LEAD:   LFO 1 > S&H shape, Trigger mode')
  console.log('          Mod: Vel>Cutoff, Vel>WT Pos, LFO1>Pitch/Pan')
  console.log('  PAD:    LFO 1 > slow triangle, modulate A Position')
  console.log('  CHORDS: Env 2 > Filter cutoff (plucky sweep)')
  console.log('  ================================================================\n')

  socket?.destroy()
  process.exit(0)
}

main().catch(err => {
  console.error('  Error:', err.message)
  socket?.destroy()
  process.exit(1)
})
