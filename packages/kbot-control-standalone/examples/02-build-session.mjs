#!/usr/bin/env node
/**
 * 02-build-session.mjs — create tracks and set their properties.
 *
 * Spins up three fresh tracks (audio, MIDI, return), renames them,
 * picks a color, and sets mixer volume. Assumes kbot-control.amxd
 * is loaded in Ableton.
 *
 * Run: node examples/02-build-session.mjs
 */
import { KbotControlClient, kc } from '../dist/client.js'

function setupHint(err) {
  console.error('\nkbot-control is not reachable on 127.0.0.1:9000.')
  console.error('Load kbot-control.amxd onto any Ableton track, then retry.')
  console.error('Underlying error:', err.message)
}

const client = KbotControlClient.get()

try {
  await client.connect()

  const before = await kc('track.list')
  const startCount = before.length
  console.log(`tracks before: ${startCount}`)

  console.log('\ncreating: audio + midi + return')
  await kc('track.create', { type: 'audio' })
  await kc('track.create', { type: 'midi' })
  await kc('track.create', { type: 'return' })

  const after = await kc('track.list')
  console.log(`tracks after: ${after.length}`)

  // The two session tracks we just made are the last two in the list.
  // Return tracks live in a separate collection — we won't rename that one
  // via the session index, just the two session tracks.
  const audioIdx = startCount
  const midiIdx = startCount + 1

  const styling = [
    { idx: audioIdx, name: 'kbot audio',  color: 12, vol: 0.72 },
    { idx: midiIdx,  name: 'kbot midi',   color: 26, vol: 0.80 },
  ]

  for (const t of styling) {
    console.log(`\ntrack ${t.idx}:`)
    console.log('  rename ->', t.name)
    await kc('track.rename', { index: t.idx, name: t.name })
    console.log('  color  ->', t.color)
    await kc('track.color', { index: t.idx, color_index: t.color })
    console.log('  volume ->', t.vol)
    await kc('track.volume', { index: t.idx, value: t.vol })
  }

  const final = await kc('track.list')
  console.log('\nfinal state of new tracks:')
  for (const t of styling) {
    const row = final[t.idx]
    if (!row) continue
    console.log(`  [${row.index}] ${row.name}  color=${row.color_index}  vol=${row.volume?.toFixed?.(3) ?? row.volume}`)
  }
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
