/**
 * kbot-control-client — TCP client for kbot-control.amxd
 *
 * Singleton client that connects to the kbot-control Max for Live device
 * at 127.0.0.1:9000. Newline-delimited JSON-RPC 2.0 over plain TCP.
 * Zero npm dependencies — uses node:net only.
 */

import * as net from 'node:net'

export interface RpcRequest {
  jsonrpc: '2.0'
  id: number
  method: string
  params?: Record<string, unknown>
}

export interface RpcResponse<T = unknown> {
  jsonrpc: '2.0'
  id: number | null
  result?: T
  error?: { code: number; message: string }
}

export type Listener = (value: unknown) => void

interface Pending {
  resolve: (result: unknown) => void
  reject: (err: Error) => void
  timer: ReturnType<typeof setTimeout>
}

export class KbotControlClient {
  private static instance: KbotControlClient | null = null

  private socket: net.Socket | null = null
  private connected = false
  private buffer = ''
  private pending = new Map<number, Pending>()
  private listeners = new Map<string, Set<Listener>>()
  private nextId = 1
  private connectAttempt: Promise<void> | null = null

  static HOST = '127.0.0.1'
  static PORT = 9000
  static TIMEOUT = 15_000
  static CONNECT_TIMEOUT = 3_000

  private constructor() {}

  static get(): KbotControlClient {
    if (!this.instance) this.instance = new KbotControlClient()
    return this.instance
  }

  /** Test-only: tear down singleton so tests can start fresh. */
  static _resetForTests(): void {
    if (this.instance) {
      try { this.instance.disconnect() } catch { /* ignore */ }
    }
    this.instance = null
  }

  async connect(): Promise<void> {
    if (this.connected) return
    if (this.connectAttempt) return this.connectAttempt

    this.connectAttempt = new Promise<void>((resolve, reject) => {
      const sock = new net.Socket()
      const timer = setTimeout(() => {
        sock.destroy()
        reject(new Error(`kbot-control: connect timeout (${KbotControlClient.CONNECT_TIMEOUT}ms)`))
      }, KbotControlClient.CONNECT_TIMEOUT)

      sock.connect(KbotControlClient.PORT, KbotControlClient.HOST, () => {
        clearTimeout(timer)
        this.socket = sock
        this.connected = true
        resolve()
      })

      sock.on('data', (chunk) => this.handleData(chunk.toString()))

      sock.on('close', () => {
        this.connected = false
        this.socket = null
        for (const [, p] of this.pending) {
          clearTimeout(p.timer)
          p.reject(new Error('kbot-control: connection closed'))
        }
        this.pending.clear()
      })

      sock.on('error', (e) => {
        clearTimeout(timer)
        this.connected = false
        reject(new Error(
          `kbot-control: ${e.message} — is kbot-control.amxd loaded in Ableton on a track?`
        ))
      })
    })

    try {
      await this.connectAttempt
    } finally {
      this.connectAttempt = null
    }
  }

  private handleData(chunk: string): void {
    this.buffer += chunk
    const lines = this.buffer.split('\n')
    this.buffer = lines.pop() || ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      this.handleMessage(trimmed)
    }
  }

  private handleMessage(raw: string): void {
    let msg: RpcResponse | (RpcRequest & { result?: unknown })
    try {
      msg = JSON.parse(raw)
    } catch {
      return
    }

    // Notifications (listener events) — no id
    if ('method' in msg && msg.method === 'notify') {
      const { path, value } = (msg.params as { path: string; value: unknown }) || {}
      if (path) {
        const set = this.listeners.get(path)
        if (set) for (const fn of set) fn(value)
      }
      return
    }

    // Server hello greeting
    if ('method' in msg && msg.method === 'hello') return

    const response = msg as RpcResponse
    if (response.id == null) return
    const p = this.pending.get(response.id)
    if (!p) return
    this.pending.delete(response.id)
    clearTimeout(p.timer)
    if (response.error) p.reject(new Error(`[${response.error.code}] ${response.error.message}`))
    else p.resolve(response.result)
  }

  async call<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
    await this.connect()
    if (!this.socket) throw new Error('kbot-control: not connected')

    const id = this.nextId++
    const req: RpcRequest = { jsonrpc: '2.0', id, method, params }

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`kbot-control: timeout on ${method} (${KbotControlClient.TIMEOUT}ms)`))
      }, KbotControlClient.TIMEOUT)

      this.pending.set(id, {
        resolve: (r) => resolve(r as T),
        reject,
        timer,
      })
      this.socket!.write(JSON.stringify(req) + '\n')
    })
  }

  async subscribe(path: string, fn: Listener): Promise<void> {
    let set = this.listeners.get(path)
    if (!set) {
      set = new Set()
      this.listeners.set(path, set)
      await this.call('listen.subscribe', { path })
      this.startPolling(path)
    }
    set.add(fn)
  }

  async unsubscribe(path: string, fn: Listener): Promise<void> {
    const set = this.listeners.get(path)
    if (!set) return
    set.delete(fn)
    if (set.size === 0) {
      this.listeners.delete(path)
      this.stopPolling(path)
      try { await this.call('listen.unsubscribe', { path }) } catch { /* ignore */ }
    }
  }

  private pollers = new Map<string, { timer: ReturnType<typeof setInterval>; since: number }>()

  private startPolling(path: string, intervalMs = 150): void {
    if (this.pollers.has(path)) return
    const state = { timer: null as unknown as ReturnType<typeof setInterval>, since: 0 }
    state.timer = setInterval(async () => {
      try {
        const r = await this.call<{ events: Array<{ seq: number; value: unknown; at: number }>; latest_seq: number }>(
          'listen.poll', { path, since: state.since },
        )
        if (r && r.events && r.events.length > 0) {
          state.since = r.latest_seq
          const set = this.listeners.get(path)
          if (set) {
            for (const ev of r.events) {
              // LiveAPI often reports values as [propertyName, value]; unwrap.
              let v: unknown = ev.value
              if (Array.isArray(v) && v.length === 2 && typeof v[0] === 'string') v = v[1]
              for (const fn of set) fn(v)
            }
          }
        } else if (r && typeof r.latest_seq === 'number') {
          state.since = r.latest_seq
        }
      } catch { /* ignore transient errors */ }
    }, intervalMs)
    this.pollers.set(path, state)
  }

  private stopPolling(path: string): void {
    const s = this.pollers.get(path)
    if (s) {
      clearInterval(s.timer)
      this.pollers.delete(path)
    }
  }

  disconnect(): void {
    for (const [, s] of this.pollers) clearInterval(s.timer)
    this.pollers.clear()
    if (this.socket) this.socket.destroy()
    this.socket = null
    this.connected = false
  }

  get isConnected(): boolean { return this.connected }
}

/**
 * Convenience: connect + call + return result.
 * Throws if kbot-control.amxd isn't loaded in Ableton.
 */
export async function kc<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
  return KbotControlClient.get().call<T>(method, params)
}
