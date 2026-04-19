#!/usr/bin/env node
/**
 * basic.mjs — smoke test for kbot-control
 *
 * Prerequisites:
 *   1. Ableton Live is running
 *   2. kbot-control.amxd is loaded on any track
 *
 * Run: node examples/basic.mjs
 */
import { KbotControlClient, kc } from '../dist/client.js'

const client = KbotControlClient.get()

try {
  console.log('connecting to kbot-control on 127.0.0.1:9000...')
  await client.connect()
  console.log('connected')

  const hb = await kc('kbot.heartbeat')
  console.log('heartbeat:', hb)

  console.log('setting tempo to 120 BPM...')
  await kc('song.tempo', { value: 120 })

  const tracks = await kc('track.list')
  console.log(`tracks (${Array.isArray(tracks) ? tracks.length : '?'}):`, tracks)

  console.log('done')
} catch (err) {
  console.error('error:', err instanceof Error ? err.message : err)
  process.exitCode = 1
} finally {
  client.disconnect()
}
