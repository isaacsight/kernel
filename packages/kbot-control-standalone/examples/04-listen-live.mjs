#!/usr/bin/env node
/**
 * 04-listen-live.mjs — real-time subscriptions for 30 seconds.
 *
 * Subscribes to song.is_playing, song.tempo, and song.current_song_time.
 * Prints every update it gets from Live. Try pressing Play / nudging
 * tempo in Ableton while this runs and you will see events stream in.
 * Assumes kbot-control.amxd is loaded.
 *
 * Run: node examples/04-listen-live.mjs
 */
import { KbotControlClient } from '../dist/client.js'

function setupHint(err) {
  console.error('\nkbot-control is not reachable on 127.0.0.1:9000.')
  console.error('Load kbot-control.amxd onto any Ableton track, then retry.')
  console.error('Underlying error:', err.message)
}

const client = KbotControlClient.get()
const DURATION_MS = 30_000

function stamp() {
  return new Date().toISOString().split('T')[1].replace('Z', '')
}

try {
  await client.connect()
  console.log('subscribed — nudge tempo / press play in Ableton to see events')
  console.log(`listening for ${DURATION_MS / 1000}s...\n`)

  const paths = [
    { path: 'song.is_playing',        fmt: (v) => `is_playing     = ${!!v}` },
    { path: 'song.tempo',             fmt: (v) => `tempo          = ${Number(v).toFixed(2)} BPM` },
    { path: 'song.current_song_time', fmt: (v) => `song_time      = ${Number(v).toFixed(3)} beats` },
  ]

  // Throttle current_song_time so we don't flood the console.
  let lastTime = 0
  for (const { path, fmt } of paths) {
    await client.subscribe(path, (value) => {
      if (path === 'song.current_song_time') {
        const now = Date.now()
        if (now - lastTime < 500) return
        lastTime = now
      }
      console.log(`[${stamp()}] ${fmt(value)}`)
    })
  }

  await new Promise((resolve) => setTimeout(resolve, DURATION_MS))
  console.log('\ntime up — unsubscribing')
  for (const { path } of paths) {
    // Passing a dummy listener clears our reference; the client clears LOM-side state.
    await client.unsubscribe(path, () => {}).catch(() => {})
  }
} catch (err) {
  if (err && /ECONNREFUSED|connect timeout|not connected/i.test(err.message || '')) {
    setupHint(err); process.exitCode = 2
  } else { console.error('error:', err?.message || err); process.exitCode = 1 }
} finally {
  client.disconnect()
}
