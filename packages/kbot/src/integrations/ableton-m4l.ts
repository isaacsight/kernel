/**
 * ableton-m4l.ts — kbot ↔ Max for Live Bridge Client
 *
 * Connects to the kbot-bridge M4L device via TCP on localhost:9999.
 * Sends JSON commands, receives JSON responses.
 * Replaces ableton-osc.ts for M4L-based Ableton control.
 *
 * Protocol:
 *   Send:    {"id": 1, "action": "ping"}\n
 *   Receive: {"id": 1, "ok": true, "version": "1.0.0"}\n
 *
 * Advantages over OSC:
 *   - Full LOM access (41 classes, every property/method)
 *   - Proper boolean values (no T/F encoding issues)
 *   - No UDP packet size limits
 *   - Request/response correlation via IDs
 *   - Direct drum pad sample loading
 *   - Plugin preset browsing
 */

import * as net from 'node:net'

// ── Types ─────────────────────────────────────────────────────────────

export interface M4LCommand {
  id: number
  action: string
  [key: string]: unknown
}

export interface M4LResponse {
  id: number
  ok: boolean
  error?: string
  [key: string]: unknown
}

export type M4LEventHandler = (event: M4LResponse) => void

interface PendingRequest {
  resolve: (response: M4LResponse) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

// ── Client ────────────────────────────────────────────────────────────

export class AbletonM4L {
  private static instance: AbletonM4L | null = null

  private socket: net.Socket | null = null
  private connected = false
  private pending = new Map<number, PendingRequest>()
  private nextId = 1
  private buffer = ''
  private eventHandlers = new Set<M4LEventHandler>()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null

  static PORT = 9999
  static HOST = '127.0.0.1'
  static TIMEOUT = 10_000
  static RECONNECT_DELAY = 3000

  private constructor() {}

  /**
   * Get the singleton instance.
   */
  static getInstance(): AbletonM4L {
    if (!AbletonM4L.instance) {
      AbletonM4L.instance = new AbletonM4L()
    }
    return AbletonM4L.instance
  }

  /**
   * Connect to the M4L bridge device.
   * Returns true if connected and the bridge responds to ping.
   */
  async connect(): Promise<boolean> {
    if (this.connected && this.socket) {
      // Already connected — verify with ping
      try {
        await this.send({ action: 'ping' })
        return true
      } catch {
        // Connection stale, reconnect
        this.disconnect()
      }
    }

    return new Promise((resolve) => {
      this.socket = new net.Socket()
      this.buffer = ''

      this.socket.on('data', (data: Buffer) => {
        this.buffer += data.toString()
        const lines = this.buffer.split('\n')
        this.buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          try {
            const response: M4LResponse = JSON.parse(trimmed)
            this.handleResponse(response)
          } catch {
            // Malformed JSON — skip
          }
        }
      })

      this.socket.on('error', (err: Error) => {
        if (!this.connected) {
          resolve(false)
        }
        this.handleDisconnect()
      })

      this.socket.on('close', () => {
        this.handleDisconnect()
      })

      this.socket.connect(AbletonM4L.PORT, AbletonM4L.HOST, async () => {
        this.connected = true

        // Verify with ping
        try {
          const pong = await this.send({ action: 'ping' })
          if (pong.ok) {
            resolve(true)
          } else {
            resolve(false)
          }
        } catch {
          resolve(false)
        }
      })

      // Connection timeout
      setTimeout(() => {
        if (!this.connected) {
          this.socket?.destroy()
          resolve(false)
        }
      }, 5000)
    })
  }

  /**
   * Disconnect from the bridge.
   */
  disconnect(): void {
    this.connected = false
    if (this.socket) {
      this.socket.destroy()
      this.socket = null
    }
    // Reject all pending requests
    for (const [id, req] of this.pending) {
      clearTimeout(req.timer)
      req.reject(new Error('Disconnected'))
    }
    this.pending.clear()
    this.buffer = ''
  }

  /**
   * Send a command and wait for a response.
   */
  async send(cmd: Omit<M4LCommand, 'id'> & { action: string }): Promise<M4LResponse> {
    if (!this.connected || !this.socket) {
      throw new Error('Not connected to M4L bridge. Is the kbot-bridge device loaded in Ableton?')
    }

    const id = this.nextId++
    const fullCmd: M4LCommand = { id, ...cmd }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Timeout: ${cmd.action}`))
      }, AbletonM4L.TIMEOUT)

      this.pending.set(id, { resolve, reject, timer })

      const json = JSON.stringify(fullCmd) + '\n'
      this.socket!.write(json)
    })
  }

  /**
   * Send a command without waiting for a response (fire-and-forget).
   * Still sends with an ID but doesn't track the response.
   */
  fire(cmd: Omit<M4LCommand, 'id'> & { action: string }): void {
    if (!this.connected || !this.socket) return
    const id = this.nextId++
    const fullCmd: M4LCommand = { id, ...cmd }
    this.socket.write(JSON.stringify(fullCmd) + '\n')
  }

  /**
   * Register an event handler for push notifications from the bridge.
   */
  onEvent(handler: M4LEventHandler): () => void {
    this.eventHandlers.add(handler)
    return () => this.eventHandlers.delete(handler)
  }

  /**
   * Check if connected.
   */
  get isConnected(): boolean {
    return this.connected
  }

  // ── Response handling ─────────────────────────────────────────────

  private handleResponse(response: M4LResponse): void {
    if (response.id && this.pending.has(response.id)) {
      const req = this.pending.get(response.id)!
      this.pending.delete(response.id)
      clearTimeout(req.timer)
      req.resolve(response)
    } else {
      // No pending request — this is a push event (observer notification)
      for (const handler of this.eventHandlers) {
        try { handler(response) } catch { /* skip */ }
      }
    }
  }

  private handleDisconnect(): void {
    if (!this.connected) return
    this.connected = false
    this.socket = null

    // Reject pending
    for (const [, req] of this.pending) {
      clearTimeout(req.timer)
      req.reject(new Error('Connection lost'))
    }
    this.pending.clear()
  }

  // ── Convenience methods ───────────────────────────────────────────
  // These wrap common commands for ergonomic use in kbot tools.

  async ping(): Promise<boolean> {
    try {
      const r = await this.send({ action: 'ping' })
      return r.ok
    } catch {
      return false
    }
  }

  async setTempo(bpm: number): Promise<M4LResponse> {
    return this.send({ action: 'set_tempo', bpm })
  }

  async createMidiTrack(index?: number): Promise<M4LResponse> {
    return this.send({ action: 'create_midi_track', index })
  }

  async deleteTrack(track: number): Promise<M4LResponse> {
    return this.send({ action: 'delete_track', track })
  }

  async loadPlugin(track: number, name: string, manufacturer?: string): Promise<M4LResponse> {
    return this.send({ action: 'load_plugin', track, name, manufacturer: manufacturer || '' })
  }

  async loadSampleToPad(track: number, pad: number, path: string): Promise<M4LResponse> {
    return this.send({ action: 'load_sample_to_pad', track, pad, path })
  }

  async createClip(track: number, slot: number, length: number, name?: string): Promise<M4LResponse> {
    return this.send({ action: 'create_clip', track, slot, length, name })
  }

  async addNotes(track: number, slot: number, notes: Array<[number, number, number, number]>): Promise<M4LResponse> {
    return this.send({ action: 'add_notes', track, slot, notes })
  }

  async fireClip(track: number, slot: number): Promise<M4LResponse> {
    return this.send({ action: 'fire_clip', track, slot })
  }

  async setVolume(track: number, volume: number): Promise<M4LResponse> {
    return this.send({ action: 'set_volume', track, volume })
  }

  async setSend(track: number, sendIdx: number, level: number): Promise<M4LResponse> {
    return this.send({ action: 'set_send', track, send: sendIdx, level })
  }

  async getTrackInfo(track: number): Promise<M4LResponse> {
    return this.send({ action: 'get_track_info', track })
  }

  async getDeviceParams(track: number, device: number): Promise<M4LResponse> {
    return this.send({ action: 'get_device_params', track, device })
  }

  async setParam(track: number, device: number, param: string, value: number): Promise<M4LResponse> {
    return this.send({ action: 'set_param', track, device, param, value })
  }

  async getSessionInfo(): Promise<M4LResponse> {
    return this.send({ action: 'get_session_info' })
  }

  async startPlaying(): Promise<M4LResponse> {
    return this.send({ action: 'start_playing' })
  }

  async stopPlaying(): Promise<M4LResponse> {
    return this.send({ action: 'stop_playing' })
  }

  async setClipTriggerQuantization(value: number): Promise<M4LResponse> {
    return this.send({ action: 'set_clip_trigger_quantization', value })
  }

  async setTrackName(track: number, name: string): Promise<M4LResponse> {
    return this.send({ action: 'set_track_name', track, name })
  }

  async setTrackColor(track: number, color: number): Promise<M4LResponse> {
    return this.send({ action: 'set_track_color', track, color })
  }

  async muteTrack(track: number, mute: boolean): Promise<M4LResponse> {
    return this.send({ action: 'mute_track', track, mute })
  }

  async armTrack(track: number, arm: boolean): Promise<M4LResponse> {
    return this.send({ action: 'arm_track', track, arm })
  }

  async getNotes(track: number, slot: number): Promise<M4LResponse> {
    return this.send({ action: 'get_notes', track, slot })
  }

  async removeNotes(track: number, slot: number): Promise<M4LResponse> {
    return this.send({ action: 'remove_notes', track, slot })
  }

  async getDrumPads(track: number): Promise<M4LResponse> {
    return this.send({ action: 'get_drum_pads', track })
  }

  async browseAndLoad(track: number, category: string, search: string): Promise<M4LResponse> {
    return this.send({ action: 'browse_and_load', track, category, search })
  }

  /** Generic LOM getter — access any property at any path */
  async lomGet(path: string, property: string): Promise<M4LResponse> {
    return this.send({ action: 'lom_get', path, property })
  }

  /** Generic LOM setter — set any property at any path */
  async lomSet(path: string, property: string, value: unknown): Promise<M4LResponse> {
    return this.send({ action: 'lom_set', path, property, value })
  }

  /** Generic LOM method call — call any method at any path */
  async lomCall(path: string, method: string, args?: unknown[]): Promise<M4LResponse> {
    return this.send({ action: 'lom_call', path, method, args })
  }
}

// ── Convenience export ──────────────────────────────────────────────

/**
 * Get a connected M4L bridge instance.
 * Throws if the bridge is not available.
 */
export async function ensureM4L(): Promise<AbletonM4L> {
  const m4l = AbletonM4L.getInstance()
  if (m4l.isConnected) return m4l

  const ok = await m4l.connect()
  if (!ok) {
    throw new Error(
      'Cannot connect to kbot M4L bridge.\n\n' +
      'Make sure:\n' +
      '1. Ableton Live is running\n' +
      '2. The kbot-bridge.amxd device is loaded on any track\n' +
      '3. The device shows "kbot bridge running on port 9999"\n'
    )
  }
  return m4l
}

/**
 * Format a friendly error message for M4L connection failures.
 */
export function formatM4LError(): string {
  return [
    '**M4L Bridge not connected**',
    '',
    'To use kbot with Ableton:',
    '1. Open Ableton Live',
    '2. Drag **kbot-bridge.amxd** onto any track',
    '3. The device status should show "Connected"',
    '',
    'The M4L bridge gives kbot full control over Ableton — instruments, effects, clips, mixing, everything.',
  ].join('\n')
}
