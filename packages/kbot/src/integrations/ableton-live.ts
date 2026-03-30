/**
 * ableton-live.ts — kbot ↔ Ableton Live via AbletonOSC (UDP)
 *
 * Provides full Ableton control:
 *   - Transport (play, stop, tempo)
 *   - Tracks (create, name, volume, pan, mute, solo)
 *   - Devices (load any instrument/effect by name)
 *   - Clips (create, add notes, fire, stop)
 *   - Mixing (volume, sends)
 *   - Exec (arbitrary Python inside Ableton's runtime)
 *
 * Requires AbletonOSC installed: kbot ableton setup
 */

import * as dgram from 'node:dgram'
import { Buffer } from 'node:buffer'

const OSC_SEND_PORT = 11000
const OSC_RECV_PORT = 11001
const OSC_HOST = '127.0.0.1'

// ── OSC Protocol ────────────────────────────────────────────────────────

function oscEncode(addr: string, ...args: (number | string)[]): Buffer {
  let addrBuf = Buffer.from(addr + '\0')
  while (addrBuf.length % 4) addrBuf = Buffer.concat([addrBuf, Buffer.alloc(1)])

  let typetag = ','
  const argBufs: Buffer[] = []

  for (const a of args) {
    if (typeof a === 'number' && Number.isInteger(a)) {
      typetag += 'i'
      const b = Buffer.alloc(4)
      b.writeInt32BE(a)
      argBufs.push(b)
    } else if (typeof a === 'number') {
      typetag += 'f'
      const b = Buffer.alloc(4)
      b.writeFloatBE(a)
      argBufs.push(b)
    } else {
      typetag += 's'
      let sb = Buffer.from(a + '\0')
      while (sb.length % 4) sb = Buffer.concat([sb, Buffer.alloc(1)])
      argBufs.push(sb)
    }
  }

  let ttBuf = Buffer.from(typetag + '\0')
  while (ttBuf.length % 4) ttBuf = Buffer.concat([ttBuf, Buffer.alloc(1)])

  return Buffer.concat([addrBuf, ttBuf, ...argBufs])
}

function oscParse(data: Buffer): { address: string; args: (number | string)[] } {
  const end = data.indexOf(0)
  const address = data.subarray(0, end).toString()
  let pos = end + 1
  while (pos % 4) pos++

  const args: (number | string)[] = []
  if (pos < data.length && data[pos] === 0x2c) { // ','
    const tagEnd = data.indexOf(0, pos)
    const tags = data.subarray(pos + 1, tagEnd).toString()
    pos = tagEnd + 1
    while (pos % 4) pos++

    for (const t of tags) {
      if (t === 'i') {
        args.push(data.readInt32BE(pos))
        pos += 4
      } else if (t === 'f') {
        args.push(Math.round(data.readFloatBE(pos) * 10000) / 10000)
        pos += 4
      } else if (t === 's') {
        const sEnd = data.indexOf(0, pos)
        args.push(data.subarray(pos, sEnd).toString())
        pos = sEnd + 1
        while (pos % 4) pos++
      }
    }
  }

  return { address, args }
}

// ── AbletonLive Client ──────────────────────────────────────────────────

export class AbletonLive {
  private static instance: AbletonLive | null = null
  private socket: dgram.Socket | null = null
  private connected = false

  static getInstance(): AbletonLive {
    if (!AbletonLive.instance) {
      AbletonLive.instance = new AbletonLive()
    }
    return AbletonLive.instance
  }

  async connect(): Promise<boolean> {
    if (this.connected && this.socket) return true

    return new Promise((resolve) => {
      this.socket = dgram.createSocket('udp4')
      this.socket.bind(OSC_RECV_PORT, OSC_HOST, () => {
        // Test connection with tempo query
        this.query('/live/song/get/tempo')
          .then(r => {
            this.connected = r.args.length > 0
            resolve(this.connected)
          })
          .catch(() => {
            this.connected = false
            resolve(false)
          })
      })

      this.socket.on('error', () => {
        this.connected = false
        resolve(false)
      })

      setTimeout(() => {
        if (!this.connected) resolve(false)
      }, 5000)
    })
  }

  disconnect(): void {
    this.socket?.close()
    this.socket = null
    this.connected = false
  }

  get isConnected(): boolean {
    return this.connected
  }

  /** Send OSC message, no response expected. */
  send(addr: string, ...args: (number | string)[]): void {
    if (!this.socket) return
    this.socket.send(oscEncode(addr, ...args), OSC_SEND_PORT, OSC_HOST)
  }

  /** Send OSC message and wait for response. */
  async query(addr: string, ...args: (number | string)[]): Promise<{ address: string; args: (number | string)[] }> {
    return new Promise((resolve, reject) => {
      if (!this.socket) return reject(new Error('Not connected'))

      // Flush pending messages
      this.socket.removeAllListeners('message')

      const timer = setTimeout(() => {
        reject(new Error('Timeout'))
      }, 10000)

      this.socket.once('message', (msg) => {
        clearTimeout(timer)
        resolve(oscParse(msg))
      })

      this.socket.send(oscEncode(addr, ...args), OSC_SEND_PORT, OSC_HOST)
    })
  }

  // ── Convenience Methods ─────────────────────────────────────────────

  async getTempo(): Promise<number> {
    const r = await this.query('/live/song/get/tempo')
    return r.args[0] as number
  }

  setTempo(bpm: number): void {
    this.send('/live/song/set/tempo', bpm)
  }

  play(): void { this.send('/live/song/start_playing') }
  stop(): void { this.send('/live/song/stop_playing') }

  async getTrackCount(): Promise<number> {
    const r = await this.query('/live/song/get/num_tracks')
    return r.args[0] as number
  }

  async createMidiTrack(name: string): Promise<number> {
    this.send('/live/song/create_midi_track', -1)
    await new Promise(r => setTimeout(r, 400))
    const count = await this.getTrackCount()
    const trackIdx = count - 2
    this.send('/live/track/set/name', trackIdx, name)
    return trackIdx
  }

  async loadDevice(track: number, searchTerm: string): Promise<string> {
    const r = await this.query('/live/track/load/device', track, searchTerm)
    return r.args[1] as string || 'unknown'
  }

  setVolume(track: number, volume: number): void {
    this.send('/live/track/set/volume', track, volume)
  }

  async createClip(track: number, slot: number, length: number, name: string): Promise<void> {
    this.send('/live/clip_slot/create_clip', track, slot, length)
    await new Promise(r => setTimeout(r, 300))
    this.send('/live/clip/set/name', track, slot, name)
  }

  addNote(track: number, slot: number, pitch: number, start: number, duration: number, velocity: number): void {
    this.send('/live/clip/add/notes', track, slot, pitch, start, duration, velocity, 0)
  }

  fireClip(track: number, slot: number): void {
    this.send('/live/clip_slot/fire', track, slot)
  }

  /** Execute arbitrary Python in Ableton's runtime. */
  async exec(code: string): Promise<string> {
    const r = await this.query('/live/exec', code)
    return r.args[0] as string || ''
  }

  /** Delete all tracks for a clean slate. */
  async clearAllTracks(): Promise<void> {
    const count = await this.getTrackCount()
    for (let t = count - 2; t >= 0; t--) {
      this.send('/live/song/delete_track', t)
      await new Promise(r => setTimeout(r, 120))
    }
    await new Promise(r => setTimeout(r, 500))
  }

  /** Get all track names and devices. */
  async getSessionInfo(): Promise<Array<{ index: number; name: string; devices: string[] }>> {
    const count = await this.getTrackCount()
    const tracks: Array<{ index: number; name: string; devices: string[] }> = []
    for (let t = 0; t < count - 1; t++) {
      const nameR = await this.query('/live/track/get/name', t)
      const devR = await this.query('/live/track/get/devices/name', t)
      tracks.push({
        index: t,
        name: nameR.args[1] as string || `Track ${t}`,
        devices: devR.args.slice(1) as string[],
      })
    }
    return tracks
  }
}

// ── Convenience export ──────────────────────────────────────────────────

export async function ensureAbleton(): Promise<AbletonLive> {
  const live = AbletonLive.getInstance()
  if (live.isConnected) return live

  const ok = await live.connect()
  if (!ok) {
    throw new Error(
      'Cannot connect to Ableton Live via AbletonOSC.\n\n' +
      'Make sure:\n' +
      '1. Ableton Live is running\n' +
      '2. AbletonOSC is enabled in Preferences > Link, Tempo & MIDI > Control Surface\n' +
      '3. Run `kbot ableton setup` if AbletonOSC is not installed\n'
    )
  }
  return live
}
