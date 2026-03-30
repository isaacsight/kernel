#!/usr/bin/env npx tsx
/**
 * write-80s-song.ts — Full 80s synthpop across 3 Juno tracks in Ableton
 *
 * Track 2: Arpeggiated chord progression (16th note sequencer)
 * Track 3: Lead melody (singable "Take On Me" style)
 * Track 4: Pumping octave bass
 *
 * All clips fire together. D major, 120 BPM, 16 bars (verse + chorus).
 */

import * as dgram from 'node:dgram'

// ── MIDI ─────────────────────────────────────────────────────────────

const N: Record<string, number> = {
  'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
  'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
  'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11,
}

const m = (name: string, oct: number) => (oct + 1) * 12 + N[name]

interface Note { pitch: number; start: number; duration: number; velocity: number }

// ── OSC ──────────────────────────────────────────────────────────────

const udp = dgram.createSocket('udp4')

function osc(addr: string, ...args: (number | string)[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const parts: Buffer[] = []
    parts.push(oscStr(addr))
    let tt = ','
    for (const a of args) tt += typeof a === 'number' ? (Number.isInteger(a) ? 'i' : 'f') : 's'
    parts.push(oscStr(tt))
    for (const a of args) {
      if (typeof a === 'number') {
        const b = Buffer.alloc(4)
        Number.isInteger(a) ? b.writeInt32BE(a, 0) : b.writeFloatBE(a, 0)
        parts.push(b)
      } else parts.push(oscStr(String(a)))
    }
    udp.send(Buffer.concat(parts), 11000, '127.0.0.1', e => e ? reject(e) : resolve())
  })
}

function oscStr(s: string): Buffer {
  const nt = s + '\0'
  const buf = Buffer.alloc(nt.length + (4 - nt.length % 4) % 4, 0)
  buf.write(s, 0, 'ascii')
  return buf
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ── Song ─────────────────────────────────────────────────────────────

const BARS = 16
const BEATS = BARS * 4

// Tracks (0-based for OSC — user sees 2, 3, 4)
const ARP_TRACK = 1
const MELODY_TRACK = 2
const BASS_TRACK = 3

// ── Arpeggiated Chords (Track 2) ─────────────────────────────────────

function arpChords(): Note[] {
  const notes: Note[] = []
  const chords = [
    // Verse: D A Bm G x2
    [m('D',3), m('F#',3), m('A',3), m('D',4)],
    [m('A',2), m('C#',3), m('E',3), m('A',3)],
    [m('B',2), m('D',3), m('F#',3), m('B',3)],
    [m('G',2), m('B',2), m('D',3), m('G',3)],
    [m('D',3), m('F#',3), m('A',3), m('D',4)],
    [m('A',2), m('C#',3), m('E',3), m('A',3)],
    [m('B',2), m('D',3), m('F#',3), m('B',3)],
    [m('G',2), m('B',2), m('D',3), m('G',3)],
    // Chorus: G A Bm D G A D D (octave up for lift)
    [m('G',3), m('B',3), m('D',4), m('G',4)],
    [m('A',3), m('C#',4), m('E',4), m('A',4)],
    [m('B',3), m('D',4), m('F#',4), m('B',4)],
    [m('D',4), m('F#',4), m('A',4), m('D',5)],
    [m('G',3), m('B',3), m('D',4), m('G',4)],
    [m('A',3), m('C#',4), m('E',4), m('A',4)],
    [m('D',4), m('F#',4), m('A',4), m('D',5)],
    [m('D',4), m('F#',4), m('A',4), m('D',5)],
  ]
  const pat = [0,1,2,3,2,1,0,1,2,3,2,1,0,1,2,3]
  for (let bar = 0; bar < BARS; bar++) {
    const t = chords[bar]
    for (let i = 0; i < 16; i++) {
      notes.push({
        pitch: t[pat[i]],
        start: bar * 4 + i * 0.25,
        duration: 0.2,
        velocity: i % 4 === 0 ? 95 : i % 2 === 0 ? 80 : 65,
      })
    }
  }
  return notes
}

// ── Lead Melody (Track 3) ────────────────────────────────────────────

function melody(): Note[] {
  const raw: [number, number, number, number][] = [
    // VERSE bars 1-8
    // Bar 1-2 (D - A)
    [m('D',5), 0, 1, 95], [m('E',5), 1, 0.5, 85], [m('F#',5), 1.5, 1.5, 90],
    [m('E',5), 3, 1, 80], [m('D',5), 4, 0.5, 85], [m('C#',5), 4.5, 0.5, 80],
    [m('A',4), 5, 2, 90], [m('B',4), 7, 0.5, 75], [m('C#',5), 7.5, 0.5, 80],
    // Bar 3-4 (Bm - G)
    [m('D',5), 8, 1.5, 90], [m('B',4), 9.5, 0.5, 80], [m('A',4), 10, 1, 85],
    [m('G',4), 11, 1, 80], [m('A',4), 12, 1, 85], [m('B',4), 13, 1, 90],
    [m('A',4), 14, 2, 85],
    // Bar 5-6 (D - A) variation
    [m('D',5), 16, 0.75, 95], [m('F#',5), 16.75, 0.75, 90], [m('E',5), 17.5, 1.5, 85],
    [m('D',5), 19, 1, 80], [m('C#',5), 20, 0.5, 85], [m('D',5), 20.5, 0.5, 80],
    [m('E',5), 21, 1.5, 90], [m('C#',5), 22.5, 1.5, 85],
    // Bar 7-8 (Bm - G) resolve
    [m('D',5), 24, 1, 90], [m('F#',5), 25, 0.5, 85], [m('E',5), 25.5, 0.5, 80],
    [m('D',5), 26, 2, 90], [m('B',4), 28, 1.5, 85], [m('A',4), 29.5, 1.5, 80],
    [m('D',5), 31, 1, 90],

    // CHORUS bars 9-16 — higher, bigger energy
    // Bar 9-10 (G - A) THE HOOK
    [m('B',5), 32, 1, 110], [m('A',5), 33, 0.5, 100], [m('F#',5), 33.5, 0.5, 95],
    [m('D',5), 34, 1, 100], [m('E',5), 35, 0.5, 90], [m('F#',5), 35.5, 0.5, 95],
    [m('A',5), 36, 1.5, 105], [m('G',5), 37.5, 0.5, 90],
    [m('F#',5), 38, 1, 95], [m('E',5), 39, 1, 90],
    // Bar 11-12 (Bm - D) soaring
    [m('F#',5), 40, 1.5, 105], [m('G',5), 41.5, 0.5, 95],
    [m('A',5), 42, 1, 100], [m('B',5), 43, 1, 110],
    [m('A',5), 44, 2, 105], [m('F#',5), 46, 2, 100],
    // Bar 13-14 (G - A) hook again
    [m('B',5), 48, 1, 110], [m('A',5), 49, 0.5, 100], [m('F#',5), 49.5, 0.5, 95],
    [m('D',5), 50, 1, 100], [m('E',5), 51, 0.5, 90], [m('F#',5), 51.5, 0.5, 95],
    [m('A',5), 52, 1.5, 105], [m('B',5), 53.5, 0.5, 100],
    [m('A',5), 54, 2, 100],
    // Bar 15-16 (D - D) big finish
    [m('D',6), 56, 2, 115], [m('B',5), 58, 1, 105], [m('A',5), 59, 1, 100],
    [m('F#',5), 60, 2, 110], [m('D',5), 62, 2, 105],
  ]
  return raw.map(([pitch, start, duration, velocity]) => ({ pitch, start, duration, velocity }))
}

// ── Pumping Bass (Track 4) ───────────────────────────────────────────

function bass(): Note[] {
  const notes: Note[] = []
  const roots = [
    m('D',2), m('A',1), m('B',1), m('G',1),
    m('D',2), m('A',1), m('B',1), m('G',1),
    m('G',1), m('A',1), m('B',1), m('D',2),
    m('G',1), m('A',1), m('D',2), m('D',2),
  ]
  for (let bar = 0; bar < BARS; bar++) {
    const r = roots[bar], u = r + 12
    const hits: [number, number, number][] = [
      [r, 0, 110], [u, 0.5, 85], [r, 1, 105], [u, 1.5, 80],
      [r, 2, 110], [r, 2.5, 80], [u, 3, 90], [r, 3.5, 75],
    ]
    for (const [p, b, v] of hits) {
      notes.push({ pitch: p, start: bar * 4 + b, duration: 0.4, velocity: v })
    }
  }
  return notes
}

// ── Write to Ableton ─────────────────────────────────────────────────

async function writeClip(track: number, slot: number, name: string, notes: Note[]) {
  await osc('/live/clip_slot/create_clip', track, slot, BEATS)
  await sleep(350)
  await osc('/live/clip/set/name', track, slot, name)
  for (const n of notes) {
    await osc('/live/clip/add/notes', track, slot,
      n.pitch, n.start, n.duration, n.velocity, 0)
  }
  console.log(`   ✓ Track ${track + 1}: ${name} (${notes.length} notes)`)
}

async function main() {
  console.log('🎹 80s Synthpop → Ableton (Tracks 2, 3, 4 — Juno)')
  console.log('   D major | 120 BPM | 16 bars')
  console.log('')

  await osc('/live/song/set/tempo', 120.0)
  await sleep(100)

  // Name the tracks
  await osc('/live/track/set/name', ARP_TRACK, '80s Arp')
  await osc('/live/track/set/name', MELODY_TRACK, '80s Lead')
  await osc('/live/track/set/name', BASS_TRACK, '80s Bass')
  await sleep(100)

  // Write clips
  const arpNotes = arpChords()
  const melodyNotes = melody()
  const bassNotes = bass()

  await writeClip(ARP_TRACK, 0, '80s Arp — D major', arpNotes)
  await writeClip(MELODY_TRACK, 0, '80s Melody', melodyNotes)
  await writeClip(BASS_TRACK, 0, '80s Bass — Pumping', bassNotes)

  console.log('')
  console.log(`   Total: ${arpNotes.length + melodyNotes.length + bassNotes.length} notes across 3 tracks`)

  // Fire all clips together via scene
  console.log('')
  console.log('▶  Firing all clips...')
  await osc('/live/clip/fire', ARP_TRACK, 0)
  await osc('/live/clip/fire', MELODY_TRACK, 0)
  await osc('/live/clip/fire', BASS_TRACK, 0)
  await sleep(100)

  console.log('')
  console.log('🎶 Playing! Full 80s synthpop on 3 Juno tracks:')
  console.log('   Track 2: Arpeggiated chords (16th note sequencer)')
  console.log('   Track 3: Lead melody (verse → chorus)')
  console.log('   Track 4: Pumping octave bass')
  console.log('')
  console.log('   Verse (1-8):  D → A → Bm → G')
  console.log('   Chorus (9-16): G → A → Bm → D → big finish')

  udp.close()
}

main().catch(err => {
  console.error('Error:', err.message)
  udp.close()
  process.exit(1)
})
