/**
 * ableton-bridge.ts — kbot ↔ AbletonBridge TCP Client
 *
 * Connects to AbletonBridge (https://github.com/hidingwill/AbletonBridge),
 * a 353-tool Remote Script that exposes Ableton's full Browser API
 * via a TCP server on localhost:9001.
 *
 * Protocol:
 *   Send:    {"id": 1, "method": "search_browser", "params": {...}}\n
 *   Receive: {"id": 1, "result": {...}}\n
 *
 * Fallback chain (used by tools):
 *   1. AbletonBridge (port 9001) — full browser API
 *   2. KBotBridge (port 9998) — kbot's own Remote Script
 *   3. Error with install instructions
 *
 * Follows the same singleton + newline-delimited JSON pattern as AbletonM4L.
 */

import * as net from 'node:net'

// ── Types ─────────────────────────────────────────────────────────────

export interface BrowserItem {
  name: string
  uri: string
  isLoadable: boolean
  isDevice: boolean
  isFolder: boolean
}

export interface Preset {
  name: string
  uri: string
}

export interface Device {
  name: string
  className: string
  index: number
}

export interface BridgeCommand {
  id: number
  method: string
  params?: Record<string, unknown>
}

export interface BridgeResponse {
  id: number
  result?: unknown
  error?: string
}

interface PendingRequest<T = BridgeResponse> {
  resolve: (response: T) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

// ── Client ────────────────────────────────────────────────────────────

export class AbletonBridgeClient {
  private static instance: AbletonBridgeClient | null = null

  private socket: net.Socket | null = null
  private connected = false
  private pending = new Map<number, PendingRequest>()
  private nextId = 1
  private buffer = ''

  static PORT = 9001
  static HOST = '127.0.0.1'
  static TIMEOUT = 15_000
  static CONNECT_TIMEOUT = 5_000

  private constructor() {}

  /**
   * Get the singleton instance.
   */
  static getInstance(): AbletonBridgeClient {
    if (!AbletonBridgeClient.instance) {
      AbletonBridgeClient.instance = new AbletonBridgeClient()
    }
    return AbletonBridgeClient.instance
  }

  /**
   * Connect to AbletonBridge TCP server.
   * Returns true if connected and responds to a ping/handshake.
   */
  async connect(): Promise<boolean> {
    if (this.connected && this.socket) {
      // Already connected — verify with a lightweight call
      try {
        await this.send('ping')
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
            const response: BridgeResponse = JSON.parse(trimmed)
            this.handleResponse(response)
          } catch {
            // Malformed JSON — skip
          }
        }
      })

      this.socket.on('error', () => {
        if (!this.connected) {
          resolve(false)
        }
        this.handleDisconnect()
      })

      this.socket.on('close', () => {
        this.handleDisconnect()
      })

      this.socket.connect(AbletonBridgeClient.PORT, AbletonBridgeClient.HOST, async () => {
        this.connected = true

        // Verify connectivity
        try {
          const pong = await this.send('ping')
          resolve(!pong.error)
        } catch {
          // Even if ping fails, we may still be connected to a bridge
          // that doesn't support ping — consider it connected
          resolve(true)
        }
      })

      // Connection timeout
      setTimeout(() => {
        if (!this.connected) {
          this.socket?.destroy()
          resolve(false)
        }
      }, AbletonBridgeClient.CONNECT_TIMEOUT)
    })
  }

  /**
   * Check if connected.
   */
  isConnected(): boolean {
    return this.connected
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
    for (const [, req] of this.pending) {
      clearTimeout(req.timer)
      req.reject(new Error('Disconnected'))
    }
    this.pending.clear()
    this.buffer = ''
  }

  /**
   * Send a method call and wait for a response.
   */
  async send(method: string, params?: Record<string, unknown>): Promise<BridgeResponse> {
    if (!this.connected || !this.socket) {
      throw new Error('Not connected to AbletonBridge. Is Ableton running with the AbletonBridge Remote Script?')
    }

    const id = this.nextId++
    const cmd: BridgeCommand = { id, method }
    if (params) cmd.params = params

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Timeout: ${method}`))
      }, AbletonBridgeClient.TIMEOUT)

      this.pending.set(id, { resolve, reject, timer })

      const json = JSON.stringify(cmd) + '\n'
      this.socket!.write(json)
    })
  }

  // ── Response handling ─────────────────────────────────────────────

  private handleResponse(response: BridgeResponse): void {
    if (response.id && this.pending.has(response.id)) {
      const req = this.pending.get(response.id)!
      this.pending.delete(response.id)
      clearTimeout(req.timer)
      req.resolve(response)
    }
    // No event/push support for AbletonBridge — all request/response
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

  // ── Browser API ───────────────────────────────────────────────────

  /**
   * Search Ableton's browser for items matching a query.
   * Optionally filter by category: "instruments", "audio_effects", "midi_effects",
   * "drums", "sounds", "packs", "plugins", "samples", "presets".
   */
  async searchBrowser(query: string, category?: string): Promise<BrowserItem[]> {
    const params: Record<string, unknown> = { query }
    if (category) params.category = category

    const resp = await this.send('search_browser', params)
    if (resp.error) throw new Error(resp.error)

    const items = resp.result as Array<Record<string, unknown>> | undefined
    if (!Array.isArray(items)) return []

    return items.map((item) => ({
      name: String(item.name ?? ''),
      uri: String(item.uri ?? ''),
      isLoadable: Boolean(item.is_loadable ?? item.isLoadable ?? false),
      isDevice: Boolean(item.is_device ?? item.isDevice ?? false),
      isFolder: Boolean(item.is_folder ?? item.isFolder ?? false),
    }))
  }

  /**
   * Load a device onto a track by its browser URI.
   */
  async loadDevice(trackIndex: number, uri: string): Promise<boolean> {
    const resp = await this.send('load_device', { track: trackIndex, uri })
    if (resp.error) throw new Error(resp.error)
    return Boolean(resp.result)
  }

  /**
   * Search for a device by name and load the first loadable match onto a track.
   * Optionally filter by category to narrow results.
   */
  async loadDeviceByName(trackIndex: number, name: string, category?: string): Promise<boolean> {
    const items = await this.searchBrowser(name, category)

    // Find the first loadable device
    const device = items.find((item) => item.isLoadable && item.isDevice)
    if (!device) {
      // Fallback: try any loadable item
      const loadable = items.find((item) => item.isLoadable)
      if (!loadable) {
        throw new Error(`No loadable device found for "${name}"${category ? ` in category "${category}"` : ''}`)
      }
      return this.loadDevice(trackIndex, loadable.uri)
    }

    return this.loadDevice(trackIndex, device.uri)
  }

  /**
   * List presets available for a device by its URI.
   */
  async listPresets(deviceUri: string): Promise<Preset[]> {
    const resp = await this.send('list_presets', { uri: deviceUri })
    if (resp.error) throw new Error(resp.error)

    const presets = resp.result as Array<Record<string, unknown>> | undefined
    if (!Array.isArray(presets)) return []

    return presets.map((p) => ({
      name: String(p.name ?? ''),
      uri: String(p.uri ?? ''),
    }))
  }

  /**
   * Load a preset onto a device on a specific track.
   */
  async loadPreset(trackIndex: number, deviceIndex: number, presetUri: string): Promise<boolean> {
    const resp = await this.send('load_preset', {
      track: trackIndex,
      device: deviceIndex,
      uri: presetUri,
    })
    if (resp.error) throw new Error(resp.error)
    return Boolean(resp.result)
  }

  /**
   * Get the effect/device chain on a track.
   */
  async getEffectChain(trackIndex: number): Promise<Device[]> {
    const resp = await this.send('get_device_chain', { track: trackIndex })
    if (resp.error) throw new Error(resp.error)

    const devices = resp.result as Array<Record<string, unknown>> | undefined
    if (!Array.isArray(devices)) return []

    return devices.map((d, i) => ({
      name: String(d.name ?? ''),
      className: String(d.class_name ?? d.className ?? ''),
      index: typeof d.index === 'number' ? d.index : i,
    }))
  }
}

// ── KBotBridge fallback (port 9998) ────────────────────────────────────

/**
 * Lightweight TCP probe for the kbot Remote Script on port 9998.
 * Uses the same newline-delimited JSON protocol as AbletonM4L.
 */
export class KBotRemoteClient {
  private static instance: KBotRemoteClient | null = null

  private socket: net.Socket | null = null
  private connected = false
  private pending = new Map<number, PendingRequest<Record<string, unknown>>>()
  private nextId = 1
  private buffer = ''

  static PORT = 9998
  static HOST = '127.0.0.1'
  static TIMEOUT = 10_000
  static CONNECT_TIMEOUT = 3_000

  private constructor() {}

  static getInstance(): KBotRemoteClient {
    if (!KBotRemoteClient.instance) {
      KBotRemoteClient.instance = new KBotRemoteClient()
    }
    return KBotRemoteClient.instance
  }

  async connect(): Promise<boolean> {
    if (this.connected && this.socket) {
      try {
        await this.send({ action: 'ping' })
        return true
      } catch {
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
            const response = JSON.parse(trimmed)
            this.handleResponse(response)
          } catch {
            // skip
          }
        }
      })

      this.socket.on('error', () => {
        if (!this.connected) resolve(false)
        this.handleDisconnect()
      })

      this.socket.on('close', () => {
        this.handleDisconnect()
      })

      this.socket.connect(KBotRemoteClient.PORT, KBotRemoteClient.HOST, async () => {
        this.connected = true
        try {
          const pong = await this.send({ action: 'ping' })
          resolve(Boolean(pong.ok))
        } catch {
          resolve(true) // Connected but no ping support — still usable
        }
      })

      setTimeout(() => {
        if (!this.connected) {
          this.socket?.destroy()
          resolve(false)
        }
      }, KBotRemoteClient.CONNECT_TIMEOUT)
    })
  }

  isConnected(): boolean {
    return this.connected
  }

  disconnect(): void {
    this.connected = false
    if (this.socket) {
      this.socket.destroy()
      this.socket = null
    }
    for (const [, req] of this.pending) {
      clearTimeout(req.timer)
      req.reject(new Error('Disconnected'))
    }
    this.pending.clear()
    this.buffer = ''
  }

  async send(cmd: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (!this.connected || !this.socket) {
      throw new Error('Not connected to KBotBridge Remote Script')
    }

    const id = this.nextId++
    const fullCmd = { id, ...cmd }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Timeout: ${cmd.action ?? 'unknown'}`))
      }, KBotRemoteClient.TIMEOUT)

      this.pending.set(id, { resolve, reject, timer })

      this.socket!.write(JSON.stringify(fullCmd) + '\n')
    })
  }

  /** Load a device by name via the kbot Remote Script's search. */
  async loadDevice(trackIndex: number, name: string): Promise<boolean> {
    const resp = await this.send({ action: 'load_device', track: trackIndex, name })
    return Boolean(resp.ok)
  }

  /** Search the browser via the kbot Remote Script. */
  async searchBrowser(query: string): Promise<BrowserItem[]> {
    const resp = await this.send({ action: 'search_browser', query })
    const items = resp.results as Array<Record<string, unknown>> | undefined
    if (!Array.isArray(items)) return []

    return items.map((item) => ({
      name: String(item.name ?? ''),
      uri: String(item.uri ?? ''),
      isLoadable: Boolean(item.is_loadable ?? false),
      isDevice: Boolean(item.is_device ?? false),
      isFolder: Boolean(item.is_folder ?? false),
    }))
  }

  private handleResponse(response: Record<string, unknown>): void {
    const id = response.id as number
    if (id && this.pending.has(id)) {
      const req = this.pending.get(id)!
      this.pending.delete(id)
      clearTimeout(req.timer)
      req.resolve(response)
    }
  }

  private handleDisconnect(): void {
    if (!this.connected) return
    this.connected = false
    this.socket = null

    for (const [, req] of this.pending) {
      clearTimeout(req.timer)
      req.reject(new Error('Connection lost'))
    }
    this.pending.clear()
  }
}

// ── Convenience exports ────────────────────────────────────────────────

/**
 * Try to connect to AbletonBridge (port 9001).
 * Returns the connected client or null if unavailable.
 */
export async function tryAbletonBridge(): Promise<AbletonBridgeClient | null> {
  const client = AbletonBridgeClient.getInstance()
  if (client.isConnected()) return client

  const ok = await client.connect()
  return ok ? client : null
}

/**
 * Try to connect to KBotBridge Remote Script (port 9998).
 * Returns the connected client or null if unavailable.
 */
export async function tryKBotRemote(): Promise<KBotRemoteClient | null> {
  const client = KBotRemoteClient.getInstance()
  if (client.isConnected()) return client

  const ok = await client.connect()
  return ok ? client : null
}

/**
 * Get any available bridge, trying AbletonBridge first, then KBotBridge.
 * Returns { bridge, type } or null if neither is available.
 */
export async function getAvailableBridge(): Promise<{
  bridge: AbletonBridgeClient | KBotRemoteClient
  type: 'ableton-bridge' | 'kbot-remote'
} | null> {
  // Try AbletonBridge first (full browser API)
  const ab = await tryAbletonBridge()
  if (ab) return { bridge: ab, type: 'ableton-bridge' }

  // Fallback to KBotBridge Remote Script
  const kb = await tryKBotRemote()
  if (kb) return { bridge: kb, type: 'kbot-remote' }

  return null
}

/**
 * Format a helpful error message when no bridge is available.
 */
export function formatBridgeError(): string {
  return [
    '**No Ableton bridge connected**',
    '',
    'kbot tried two connection methods and neither is available:',
    '',
    '**Option 1 — AbletonBridge (recommended)**',
    '  Full browser API with 353 tools. Install:',
    '  1. Download from https://github.com/hidingwill/AbletonBridge',
    '  2. Copy the `AbletonBridge` folder to your Remote Scripts:',
    '     macOS: ~/Music/Ableton/User Library/Remote Scripts/',
    '     Win:   ~\\Documents\\Ableton\\User Library\\Remote Scripts\\',
    '  3. In Ableton: Preferences → Link/Tempo/MIDI → Control Surface → AbletonBridge',
    '  4. Verify: TCP server starts on localhost:9001',
    '',
    '**Option 2 — KBotBridge**',
    '  kbot\'s own Remote Script. Install:',
    '  1. Run `kbot ableton install` or copy KBotBridge to Remote Scripts',
    '  2. Enable in Ableton: Preferences → Link/Tempo/MIDI → Control Surface → KBotBridge',
    '  3. Verify: TCP server starts on localhost:9998',
    '',
    'Both require Ableton Live to be running.',
  ].join('\n')
}
