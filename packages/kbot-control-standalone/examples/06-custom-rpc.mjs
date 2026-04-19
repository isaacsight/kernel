#!/usr/bin/env node
/**
 * 06-custom-rpc.mjs — escape hatch: call any dispatcher method directly.
 *
 * The TypeScript client is intentionally thin — `kc(method, params)`
 * sends raw JSON-RPC. Anything in PROTOCOL.md (or any method the amxd
 * dispatcher grows later) is reachable without a client update.
 * Demonstrates: heartbeat, browser.inspect, view.focus_track, and a
 * deliberately-unknown method to show how errors come back.
 *
 * Assumes kbot-control.amxd is loaded. Run: node examples/06-custom-rpc.mjs
 */
import { KbotControlClient, kc } from '../dist/client.js'

function setupHint(err) {
  console.error('\nkbot-control is not reachable on 127.0.0.1:9000.')
  console.error('Load kbot-control.amxd onto any Ableton track, then retry.')
  console.error('Underlying error:', err.message)
}

const client = KbotControlClient.get()

async function showcase(title, method, params) {
  console.log(`\n--- ${title} ---`)
  console.log(`  kc('${method}', ${params ? JSON.stringify(params) : ''})`)
  try {
    const result = await kc(method, params)
    const pretty = JSON.stringify(result, null, 2)
    const lines = pretty.split('\n').slice(0, 12)
    console.log(lines.map((l) => '  ' + l).join('\n'))
    if (pretty.split('\n').length > 12) console.log('  ...')
  } catch (err) {
    console.log('  error:', err.message)
  }
}

try {
  await client.connect()

  // 1. Version + liveness probe.
  await showcase('kbot.heartbeat — version / uptime / LOM version',
    'kbot.heartbeat')

  // 2. Debugging: dump the first 20 browser items in a category.
  await showcase('browser.inspect — peek into the Ableton library',
    'browser.inspect', { category: 'instruments' })

  // 3. UI control: scroll + select track 0 in session view.
  await showcase('view.focus_track — drive the Ableton UI',
    'view.focus_track', { index: 0 })

  // 4. song.get_state — full snapshot, often handy in debugging.
  await showcase('song.get_state — one-call snapshot',
    'song.get_state')

  // 5. Unknown method — shows how JSON-RPC errors surface as thrown Errors.
  await showcase('unknown.method — see how errors propagate',
    'unknown.method', { foo: 'bar' })

  console.log('\nTakeaway: if PROTOCOL.md lists it, kc(method, params) calls it.')
} catch (err) {
  if (err && /ECONNREFUSED|connect timeout|not connected/i.test(err.message || '')) {
    setupHint(err); process.exitCode = 2
  } else { console.error('error:', err?.message || err); process.exitCode = 1 }
} finally {
  client.disconnect()
}
