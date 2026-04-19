#!/usr/bin/env node
/**
 * 05-mixer-snapshot.mjs — read every track and print a mixer table.
 *
 * Pulls volume/pan/mute/solo/arm for each track in the current Live
 * set, then prints a fixed-width console table. Pure introspection,
 * no state mutations. Assumes kbot-control.amxd is loaded.
 *
 * Run: node examples/05-mixer-snapshot.mjs
 */
import { KbotControlClient, kc } from '../dist/client.js'

function setupHint(err) {
  console.error('\nkbot-control is not reachable on 127.0.0.1:9000.')
  console.error('Load kbot-control.amxd onto any Ableton track, then retry.')
  console.error('Underlying error:', err.message)
}

function pad(str, width, align = 'left') {
  const s = String(str)
  if (s.length >= width) return s.slice(0, width)
  const gap = ' '.repeat(width - s.length)
  return align === 'right' ? gap + s : s + gap
}

function bar(value) {
  // value is a Live linear fader 0..1; 0.85 ≈ 0 dB. Draw a 10-char meter.
  const n = Math.max(0, Math.min(10, Math.round(value * 10)))
  return '#'.repeat(n) + '.'.repeat(10 - n)
}

function flag(v) { return v ? 'Y' : '.' }

const client = KbotControlClient.get()

try {
  await client.connect()
  const tracks = await kc('track.list')
  const song = await kc('song.get_state')

  console.log(`\nmixer snapshot — ${tracks.length} tracks @ ${song.tempo} BPM`)
  console.log('-'.repeat(72))
  console.log(
    pad('#', 3, 'right'), pad('name', 24), pad('vol', 12), pad('pan', 7, 'right'),
    pad('M', 2), pad('S', 2), pad('A', 2),
  )
  console.log('-'.repeat(72))

  for (const t of tracks) {
    const vol = typeof t.volume === 'number' ? t.volume : 0
    const pan = typeof t.panning === 'number' ? t.panning : 0
    console.log(
      pad(t.index, 3, 'right'),
      pad(t.name, 24),
      pad(`${bar(vol)} ${vol.toFixed(2)}`, 12),
      pad(pan.toFixed(2), 7, 'right'),
      pad(flag(t.mute), 2),
      pad(flag(t.solo), 2),
      pad(flag(t.arm), 2),
    )
  }
  console.log('-'.repeat(72))
  console.log('M=mute  S=solo  A=arm   bar: 10-char linear gain meter\n')
} catch (err) {
  if (err && /ECONNREFUSED|connect timeout|not connected/i.test(err.message || '')) {
    setupHint(err); process.exitCode = 2
  } else { console.error('error:', err?.message || err); process.exitCode = 1 }
} finally {
  client.disconnect()
}
