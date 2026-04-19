/**
 * Tests for KbotControlClient — standalone TCP JSON-RPC 2.0 client.
 *
 * Uses node:test. Spins up a fake TCP server on 127.0.0.1:0 (ephemeral port)
 * speaking newline-delimited JSON-RPC, points the client at it by overriding
 * KbotControlClient.PORT/HOST, and exercises each method.
 */

import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import * as net from 'node:net'
import { KbotControlClient } from './client.js'

// --- fake server ----------------------------------------------------------

interface FakeServer {
  port: number
  server: net.Server
  sockets: Set<net.Socket>
  received: Array<{ method: string; id: number | null; params: unknown }>
  /** Registered handlers: method -> produce result or error */
  handlers: Map<string, (params: unknown, id: number) => unknown>
  /** Optional custom raw write hook — if set, handlers are bypassed. */
  onRequest?: (sock: net.Socket, req: { id: number; method: string; params: unknown }) => void
  close(): Promise<void>
  /** Send a notification ("notify" method) to all connected sockets. */
  notify(path: string, value: unknown): void
}

async function startFakeServer(): Promise<FakeServer> {
  const sockets = new Set<net.Socket>()
  const received: FakeServer['received'] = []
  const handlers = new Map<string, (params: unknown, id: number) => unknown>()

  const server = net.createServer((sock) => {
    sockets.add(sock)
    let buf = ''
    sock.on('data', (chunk) => {
      buf += chunk.toString()
      const lines = buf.split('\n')
      buf = lines.pop() || ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        let req: { id: number; method: string; params: unknown }
        try { req = JSON.parse(trimmed) } catch { continue }
        received.push({ method: req.method, id: req.id ?? null, params: req.params })
        if (fake.onRequest) {
          fake.onRequest(sock, req)
          continue
        }
        const h = handlers.get(req.method)
        if (h) {
          try {
            const result = h(req.params, req.id)
            if (result !== undefined) {
              sock.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result }) + '\n')
            }
          } catch (err) {
            sock.write(JSON.stringify({
              jsonrpc: '2.0',
              id: req.id,
              error: { code: -32000, message: (err as Error).message },
            }) + '\n')
          }
        } else {
          // default: echo empty result
          sock.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: null }) + '\n')
        }
      }
    })
    sock.on('close', () => sockets.delete(sock))
    sock.on('error', () => { /* ignore */ })
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as net.AddressInfo
  const port = address.port

  const fake: FakeServer = {
    port,
    server,
    sockets,
    received,
    handlers,
    notify(path, value) {
      const msg = JSON.stringify({
        jsonrpc: '2.0',
        method: 'notify',
        params: { path, value },
      }) + '\n'
      for (const s of sockets) s.write(msg)
    },
    async close() {
      for (const s of sockets) s.destroy()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    },
  }
  return fake
}

function pointClientAt(port: number): void {
  KbotControlClient._resetForTests()
  KbotControlClient.HOST = '127.0.0.1'
  KbotControlClient.PORT = port
  // keep fairly short timeouts so tests are snappy
  KbotControlClient.CONNECT_TIMEOUT = 1_000
  KbotControlClient.TIMEOUT = 15_000
}

// --- tests ----------------------------------------------------------------

test('connect() succeeds against a fake server', async () => {
  const fake = await startFakeServer()
  try {
    pointClientAt(fake.port)
    const client = KbotControlClient.get()
    await client.connect()
    assert.equal(client.isConnected, true)
  } finally {
    KbotControlClient.get().disconnect()
    await fake.close()
  }
})

test('connect() fails fast with clear error when server not listening', async () => {
  // find an unused port: open + close a server, re-use port
  const probe = net.createServer()
  await new Promise<void>((r) => probe.listen(0, '127.0.0.1', r))
  const port = (probe.address() as net.AddressInfo).port
  await new Promise<void>((r) => probe.close(() => r()))

  pointClientAt(port)
  const client = KbotControlClient.get()
  await assert.rejects(
    () => client.connect(),
    (err: Error) => /kbot-control:/.test(err.message),
  )
})

test('call() sends JSON-RPC request and resolves with result', async () => {
  const fake = await startFakeServer()
  fake.handlers.set('echo', (params) => ({ got: params }))
  try {
    pointClientAt(fake.port)
    const client = KbotControlClient.get()
    const result = await client.call<{ got: { x: number } }>('echo', { x: 42 })
    assert.deepEqual(result, { got: { x: 42 } })
    const recv = fake.received.find((r) => r.method === 'echo')
    assert.ok(recv, 'server received echo call')
    assert.deepEqual(recv!.params, { x: 42 })
  } finally {
    KbotControlClient.get().disconnect()
    await fake.close()
  }
})

test('call() rejects with error when server returns error response', async () => {
  const fake = await startFakeServer()
  fake.onRequest = (sock, req) => {
    sock.write(JSON.stringify({
      jsonrpc: '2.0',
      id: req.id,
      error: { code: -32601, message: 'method not found' },
    }) + '\n')
  }
  try {
    pointClientAt(fake.port)
    const client = KbotControlClient.get()
    await assert.rejects(
      () => client.call('bogus'),
      (err: Error) => /\[-32601\].*method not found/.test(err.message),
    )
  } finally {
    KbotControlClient.get().disconnect()
    await fake.close()
  }
})

test('call() times out with a clear error message', async () => {
  const fake = await startFakeServer()
  // do nothing — swallow the request so client must time out
  fake.onRequest = () => { /* no reply */ }
  try {
    pointClientAt(fake.port)
    KbotControlClient.TIMEOUT = 120 // tiny
    const client = KbotControlClient.get()
    await assert.rejects(
      () => client.call('slow'),
      (err: Error) => /timeout on slow/.test(err.message),
    )
  } finally {
    KbotControlClient.TIMEOUT = 15_000
    KbotControlClient.get().disconnect()
    await fake.close()
  }
})

test('subscribe() sends listen.subscribe and handler receives notified values', async () => {
  const fake = await startFakeServer()
  fake.handlers.set('listen.subscribe', () => ({ ok: true }))
  fake.handlers.set('listen.poll', () => ({ events: [], latest_seq: 0 }))
  try {
    pointClientAt(fake.port)
    const client = KbotControlClient.get()
    const received: unknown[] = []
    await client.subscribe('live/track/0/volume', (v) => received.push(v))

    // confirm the subscribe call hit the server
    assert.ok(fake.received.some((r) => r.method === 'listen.subscribe'),
      'server saw listen.subscribe')

    // server pushes a notify
    fake.notify('live/track/0/volume', 0.5)

    // small wait — notify is pushed async
    await new Promise((r) => setTimeout(r, 50))
    assert.deepEqual(received, [0.5])
  } finally {
    KbotControlClient.get().disconnect()
    await fake.close()
  }
})

test('subscribe() polling fallback picks up events when no notify stream arrives', async () => {
  const fake = await startFakeServer()
  let seq = 0
  const pending: Array<{ seq: number; value: unknown; at: number }> = []
  fake.handlers.set('listen.subscribe', () => ({ ok: true }))
  fake.handlers.set('listen.poll', () => {
    if (pending.length > 0) {
      const events = pending.splice(0, pending.length)
      return { events, latest_seq: events[events.length - 1].seq }
    }
    return { events: [], latest_seq: seq }
  })
  try {
    pointClientAt(fake.port)
    const client = KbotControlClient.get()
    const received: unknown[] = []
    await client.subscribe('live/track/0/name', (v) => received.push(v))

    // queue an event via poll — no `notify` is pushed
    seq += 1
    pending.push({ seq, value: 'kick', at: Date.now() })

    // poll interval is 150ms — wait a couple cycles
    await new Promise((r) => setTimeout(r, 450))
    assert.deepEqual(received, ['kick'])
  } finally {
    KbotControlClient.get().disconnect()
    await fake.close()
  }
})

test('unsubscribe() stops the polling loop', async () => {
  const fake = await startFakeServer()
  fake.handlers.set('listen.subscribe', () => ({ ok: true }))
  fake.handlers.set('listen.unsubscribe', () => ({ ok: true }))
  fake.handlers.set('listen.poll', () => ({ events: [], latest_seq: 0 }))
  try {
    pointClientAt(fake.port)
    const client = KbotControlClient.get()
    const fn = () => { /* noop */ }
    await client.subscribe('live/transport/playing', fn)

    // wait long enough for at least one poll to land
    await new Promise((r) => setTimeout(r, 250))
    await client.unsubscribe('live/transport/playing', fn)

    const pollsBefore = fake.received.filter((r) => r.method === 'listen.poll').length
    await new Promise((r) => setTimeout(r, 500))
    const pollsAfter = fake.received.filter((r) => r.method === 'listen.poll').length

    assert.equal(pollsAfter, pollsBefore, 'no more polls after unsubscribe')
    assert.ok(fake.received.some((r) => r.method === 'listen.unsubscribe'),
      'listen.unsubscribe was sent')
  } finally {
    KbotControlClient.get().disconnect()
    await fake.close()
  }
})

test('disconnect() closes socket and rejects pending calls', async () => {
  const fake = await startFakeServer()
  // swallow request — client will be waiting when we disconnect
  fake.onRequest = () => { /* no reply */ }
  try {
    pointClientAt(fake.port)
    const client = KbotControlClient.get()
    await client.connect()
    const pending = client.call('never')
    // give it a moment to register
    await new Promise((r) => setTimeout(r, 20))
    client.disconnect()
    await assert.rejects(
      () => pending,
      (err: Error) => /connection closed/.test(err.message),
    )
    assert.equal(client.isConnected, false)
  } finally {
    await fake.close()
  }
})

test('multiple subscribers on same path only send one listen.subscribe', async () => {
  const fake = await startFakeServer()
  fake.handlers.set('listen.subscribe', () => ({ ok: true }))
  fake.handlers.set('listen.poll', () => ({ events: [], latest_seq: 0 }))
  try {
    pointClientAt(fake.port)
    const client = KbotControlClient.get()
    const a: unknown[] = []
    const b: unknown[] = []
    await client.subscribe('live/track/1/volume', (v) => a.push(v))
    await client.subscribe('live/track/1/volume', (v) => b.push(v))

    const subs = fake.received.filter((r) => r.method === 'listen.subscribe')
    assert.equal(subs.length, 1, 'only one listen.subscribe sent for shared path')

    // both handlers should fire on notify
    fake.notify('live/track/1/volume', 0.75)
    await new Promise((r) => setTimeout(r, 50))
    assert.deepEqual(a, [0.75])
    assert.deepEqual(b, [0.75])
  } finally {
    KbotControlClient.get().disconnect()
    await fake.close()
  }
})
