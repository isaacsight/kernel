#!/usr/bin/env node
/**
 * 01-transport-control.mjs — the most basic kbot-control loop.
 *
 * Connects to kbot-control.amxd (assumed loaded on any track in Ableton),
 * reads song state, tweaks tempo, taps, toggles metronome, plays briefly,
 * then stops. Prints before/after snapshots so you can see what changed.
 *
 * Run: node examples/01-transport-control.mjs
 */
import { KbotControlClient, kc } from '../dist/client.js'

function setupHint(err) {
  console.error('\nkbot-control is not reachable on 127.0.0.1:9000.')
  console.error('Setup:')
  console.error('  1. Open Ableton Live 11 or 12')
  console.error('  2. Drag kbot-control.amxd onto any track')
  console.error('  3. Re-run this script')
  console.error('\nUnderlying error:', err.message)
}

const client = KbotControlClient.get()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

try {
  await client.connect()

  const hb = await kc('kbot.heartbeat')
  console.log('connected — kbot-control', hb.version || hb)

  const before = await kc('song.get_state')
  console.log('\nbefore:')
  console.log('  tempo        :', before.tempo)
  console.log('  is_playing   :', before.is_playing)
  console.log('  metronome    :', before.metronome)
  console.log('  time_sig     :', `${before.signature_numerator}/${before.signature_denominator}`)

  console.log('\nset tempo -> 124 BPM')
  await kc('song.tempo', { value: 124 })

  console.log('tap_tempo x3')
  await kc('song.tap_tempo')
  await sleep(200)
  await kc('song.tap_tempo')
  await sleep(200)
  await kc('song.tap_tempo')

  console.log('toggle metronome on')
  await kc('song.metronome', { value: true })

  console.log('play for 2s then stop')
  await kc('song.play')
  await sleep(2000)
  await kc('song.stop')

  console.log('toggle metronome off')
  await kc('song.metronome', { value: false })

  const after = await kc('song.get_state')
  console.log('\nafter:')
  console.log('  tempo        :', after.tempo)
  console.log('  is_playing   :', after.is_playing)
  console.log('  metronome    :', after.metronome)
  console.log('  current_time :', after.current_time)
} catch (err) {
  if (err && /ECONNREFUSED|connect timeout|not connected/i.test(err.message || '')) {
    setupHint(err)
    process.exitCode = 2
  } else {
    console.error('error:', err?.message || err)
    process.exitCode = 1
  }
} finally {
  client.disconnect()
}
