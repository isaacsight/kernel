#!/usr/bin/env node
/**
 * 03-write-midi.mjs — write a 4-chord C minor progression into a clip.
 *
 * Creates a MIDI track, makes a 16-beat clip in slot 0, writes
 * Cm - Ab - Eb - Bb (i - VI - III - VII, 4 beats each), then fires it.
 * Assumes kbot-control.amxd is loaded in Ableton.
 *
 * Run: node examples/03-write-midi.mjs
 */
import { KbotControlClient, kc } from '../dist/client.js'

function setupHint(err) {
  console.error('\nkbot-control is not reachable on 127.0.0.1:9000.')
  console.error('Load kbot-control.amxd onto any Ableton track, then retry.')
  console.error('Underlying error:', err.message)
}

// C minor chord progression — 4 chords, 4 beats each, 16 beats total.
// Each chord is a triad rooted at the given MIDI note.
const PROGRESSION = [
  { root: 60, quality: 'min', label: 'Cm' },   // C minor
  { root: 56, quality: 'maj', label: 'Ab' },   // Ab major
  { root: 51, quality: 'maj', label: 'Eb' },   // Eb major
  { root: 58, quality: 'maj', label: 'Bb' },   // Bb major
]

function triad(root, quality) {
  const third = quality === 'min' ? 3 : 4
  return [root, root + third, root + 7]
}

function buildNotes() {
  const notes = []
  PROGRESSION.forEach((chord, i) => {
    const start = i * 4
    for (const pitch of triad(chord.root, chord.quality)) {
      notes.push({ pitch, start_time: start, duration: 3.9, velocity: 90, mute: 0 })
    }
  })
  return notes
}

const client = KbotControlClient.get()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

try {
  await client.connect()

  console.log('creating MIDI track for the progression')
  const before = await kc('track.list')
  await kc('track.create', { type: 'midi' })
  const after = await kc('track.list')
  const track = after.length - 1
  await kc('track.rename', { index: track, name: 'Cm progression' })
  console.log(`track ${track} ready`)

  console.log('creating 16-beat clip in slot 0')
  await kc('clip.create', { track, slot: 0, length: 16, name: 'Cm - Ab - Eb - Bb' })

  const notes = buildNotes()
  console.log(`writing ${notes.length} notes (${PROGRESSION.map((c) => c.label).join(' - ')})`)

  // The protocol exposes clip.notes.set; try it, and fall back gracefully
  // if this build of kbot-control.amxd hasn't shipped the handler yet.
  try {
    await kc('clip.notes.set', { track, slot: 0, notes })
    console.log('notes written via clip.notes.set')
  } catch (e) {
    console.log('clip.notes.set not available in this dispatcher build:', e.message)
    console.log('(upgrade kbot-control.amxd, or write notes with kbot.create_progression)')
    await kc('kbot.create_progression', {
      track, key: 'C', progression: 'i-VI-III-VII',
      voicing: 'triad', rhythm: 'chord', bars: 4, octave: 4,
    }).catch(() => {})
  }

  console.log('firing clip...')
  await kc('clip.fire', { track, slot: 0 })
  await sleep(500)
  const state = await kc('clip.get_state', { track, slot: 0 })
  console.log('clip:', { name: state.name, length: state.length, is_midi: state.is_midi, is_playing: state.is_playing })
} catch (err) {
  if (err && /ECONNREFUSED|connect timeout|not connected/i.test(err.message || '')) {
    setupHint(err); process.exitCode = 2
  } else { console.error('error:', err?.message || err); process.exitCode = 1 }
} finally {
  client.disconnect()
}
