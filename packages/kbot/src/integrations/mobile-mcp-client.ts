/**
 * mobile-mcp-client.ts — kbot <-> mobile-mcp integration
 *
 * Singleton client that manages the mobile-mcp server process lifecycle.
 * Communicates via MCP protocol over stdio transport.
 * Auto-installs @mobilenext/mobile-mcp via npm if not present.
 *
 * mobile-mcp provides native accessibility-tree-based automation for
 * iOS and Android devices connected via USB or WiFi.
 *
 * @see https://github.com/mobile-next/mobile-mcp
 */

import { spawn, execSync, type ChildProcess } from 'node:child_process'
import { Buffer } from 'node:buffer'

// ── JSON-RPC over stdio ────────────────────────────────────────────────

interface JsonRpcMessage {
  jsonrpc: '2.0'
  id?: number
  method?: string
  params?: unknown
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}

function encodeJsonRpc(msg: JsonRpcMessage): string {
  const body = JSON.stringify(msg)
  return `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`
}

// ── Types ──────────────────────────────────────────────────────────────

export interface MobileDevice {
  id: string
  name: string
  platform: 'ios' | 'android'
  type: 'real' | 'simulator' | 'emulator'
  version: string
  state: 'online' | 'offline'
}

export interface MobileElement {
  type: string
  text?: string
  label?: string
  name?: string
  value?: string
  identifier?: string
  x: number
  y: number
  width: number
  height: number
}

export interface MobileScreenSize {
  width: number
  height: number
}

// ── MobileMCPClient ────────────────────────────────────────────────────

export class MobileMCPClient {
  private static instance: MobileMCPClient | null = null

  private process: ChildProcess | null = null
  private messageId = 0
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()
  private buffer = ''
  private initialized = false
  private activeDeviceId: string | null = null

  static getInstance(): MobileMCPClient {
    if (!MobileMCPClient.instance) {
      MobileMCPClient.instance = new MobileMCPClient()
    }
    return MobileMCPClient.instance
  }

  /** Whether the MCP server process is running and initialized */
  get isConnected(): boolean {
    return this.initialized && this.process !== null && !this.process.killed
  }

  /** The device ID currently being controlled */
  get currentDeviceId(): string | null {
    return this.activeDeviceId
  }

  // ── Process lifecycle ──────────────────────────────────────────────

  /** Start the mobile-mcp server process and perform MCP handshake */
  async start(): Promise<void> {
    if (this.isConnected) return

    // Ensure npx is available
    try {
      execSync('which npx', { stdio: 'pipe' })
    } catch {
      throw new Error('npx not found. Ensure Node.js >= 22 is installed.')
    }

    // Spawn the mobile-mcp server via npx (auto-installs if needed)
    this.process = spawn('npx', ['-y', '@mobilenext/mobile-mcp@latest'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    })

    this.buffer = ''
    this.messageId = 0
    this.pending.clear()

    this.process.stdout?.on('data', (chunk: Buffer) => {
      this.buffer += chunk.toString()
      this.parseMessages()
    })

    // Log stderr for debugging but don't crash
    this.process.stderr?.on('data', (chunk: Buffer) => {
      const msg = chunk.toString().trim()
      if (msg && process.env.KBOT_DEBUG) {
        console.error(`[mobile-mcp stderr] ${msg}`)
      }
    })

    this.process.on('error', (err) => {
      this.initialized = false
      this.process = null
      if (process.env.KBOT_DEBUG) {
        console.error(`[mobile-mcp] Process error: ${err.message}`)
      }
    })

    this.process.on('exit', (code) => {
      this.initialized = false
      this.process = null
      // Reject any pending requests
      const pendingEntries = Array.from(this.pending.entries())
      for (const [id, { reject }] of pendingEntries) {
        reject(new Error(`mobile-mcp process exited with code ${code}`))
        this.pending.delete(id)
      }
    })

    // MCP initialize handshake
    try {
      await this.sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'kbot', version: '3.61.0' },
      })

      this.sendNotification('initialized', {})
      this.initialized = true
    } catch (err) {
      this.stop()
      throw new Error(
        `mobile-mcp handshake failed: ${err instanceof Error ? err.message : String(err)}\n` +
        'Ensure @mobilenext/mobile-mcp is installed: npm install -g @mobilenext/mobile-mcp',
      )
    }
  }

  /** Stop the mobile-mcp server process */
  stop(): void {
    if (this.process) {
      try {
        // Graceful shutdown
        this.sendNotification('exit', null)
      } catch { /* best effort */ }
      this.process.kill()
      this.process = null
    }
    this.initialized = false
    this.activeDeviceId = null
    this.buffer = ''
    this.pending.clear()
  }

  // ── MCP protocol ───────────────────────────────────────────────────

  private parseMessages(): void {
    while (true) {
      const headerEnd = this.buffer.indexOf('\r\n\r\n')
      if (headerEnd === -1) break

      const header = this.buffer.slice(0, headerEnd)
      const lengthMatch = header.match(/Content-Length:\s*(\d+)/i)
      if (!lengthMatch) {
        this.buffer = this.buffer.slice(headerEnd + 4)
        continue
      }

      const contentLength = parseInt(lengthMatch[1], 10)
      const bodyStart = headerEnd + 4
      if (this.buffer.length < bodyStart + contentLength) break

      const body = this.buffer.slice(bodyStart, bodyStart + contentLength)
      this.buffer = this.buffer.slice(bodyStart + contentLength)

      try {
        const msg: JsonRpcMessage = JSON.parse(body)
        if (msg.id !== undefined && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id)!
          this.pending.delete(msg.id)
          if (msg.error) {
            reject(new Error(msg.error.message))
          } else {
            resolve(msg.result)
          }
        }
      } catch {
        // Skip malformed messages
      }
    }
  }

  private sendRequest(method: string, params: unknown, timeout = 30_000): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.process?.stdin?.writable) {
        reject(new Error('mobile-mcp process is not running. Call mobile_connect first.'))
        return
      }

      const id = ++this.messageId
      this.pending.set(id, { resolve, reject })
      const msg: JsonRpcMessage = { jsonrpc: '2.0', id, method, params }
      this.process.stdin.write(encodeJsonRpc(msg))

      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id)
          reject(new Error(`mobile-mcp request timeout after ${timeout / 1000}s: ${method}`))
        }
      }, timeout)
    })
  }

  private sendNotification(method: string, params: unknown): void {
    if (!this.process?.stdin?.writable) return
    const msg: JsonRpcMessage = { jsonrpc: '2.0', method, params }
    this.process.stdin.write(encodeJsonRpc(msg))
  }

  /** Call a tool on the mobile-mcp server */
  async callTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.isConnected) {
      throw new Error('Not connected to mobile-mcp. Call mobile_connect first.')
    }

    const result = await this.sendRequest('tools/call', {
      name: toolName,
      arguments: args,
    }, 60_000) as { content?: Array<{ type: string; text?: string; data?: string; mimeType?: string }> }

    return result
  }

  /** Extract text content from an MCP tool result */
  extractText(result: unknown): string {
    const r = result as { content?: Array<{ type: string; text?: string }> }
    if (r?.content) {
      return r.content
        .filter(c => c.type === 'text' && c.text)
        .map(c => c.text!)
        .join('\n')
    }
    return JSON.stringify(result, null, 2)
  }

  /** Extract image content (base64) from an MCP tool result */
  extractImage(result: unknown): { data: string; mimeType: string } | null {
    const r = result as { content?: Array<{ type: string; data?: string; mimeType?: string }> }
    if (r?.content) {
      const img = r.content.find(c => c.type === 'image' && c.data)
      if (img) return { data: img.data!, mimeType: img.mimeType || 'image/png' }
    }
    return null
  }

  // ── High-level device operations ───────────────────────────────────

  /** List all available devices */
  async listDevices(): Promise<MobileDevice[]> {
    const result = await this.callTool('mobile_list_available_devices', {})
    const text = this.extractText(result)
    try {
      return JSON.parse(text)
    } catch {
      // Try to parse from structured output
      return []
    }
  }

  /** Set the active device for subsequent operations */
  setActiveDevice(deviceId: string): void {
    this.activeDeviceId = deviceId
  }

  /** Get the active device ID, throwing if none set */
  private requireDevice(deviceId?: string): string {
    const id = deviceId || this.activeDeviceId
    if (!id) {
      throw new Error(
        'No device selected. Use mobile_connect to connect to a device, or pass a device ID.',
      )
    }
    return id
  }

  /** List apps on the active device */
  async listApps(deviceId?: string): Promise<string> {
    const device = this.requireDevice(deviceId)
    const result = await this.callTool('mobile_list_apps', { device })
    return this.extractText(result)
  }

  /** Launch an app by bundle ID */
  async launchApp(packageName: string, deviceId?: string): Promise<string> {
    const device = this.requireDevice(deviceId)
    const result = await this.callTool('mobile_launch_app', { device, packageName })
    return this.extractText(result)
  }

  /** Take a screenshot, returns base64 image data */
  async takeScreenshot(deviceId?: string): Promise<{ data: string; mimeType: string } | string> {
    const device = this.requireDevice(deviceId)
    const result = await this.callTool('mobile_take_screenshot', { device })
    const img = this.extractImage(result)
    if (img) return img
    return this.extractText(result)
  }

  /** Save screenshot to a file */
  async saveScreenshot(saveTo: string, deviceId?: string): Promise<string> {
    const device = this.requireDevice(deviceId)
    const result = await this.callTool('mobile_save_screenshot', { device, saveTo })
    return this.extractText(result)
  }

  /** List UI elements on screen via accessibility tree */
  async listElements(deviceId?: string): Promise<string> {
    const device = this.requireDevice(deviceId)
    const result = await this.callTool('mobile_list_elements_on_screen', { device })
    return this.extractText(result)
  }

  /** Tap at coordinates */
  async tap(x: number, y: number, deviceId?: string): Promise<string> {
    const device = this.requireDevice(deviceId)
    const result = await this.callTool('mobile_click_on_screen_at_coordinates', { device, x, y })
    return this.extractText(result)
  }

  /** Swipe on screen */
  async swipe(
    direction: 'up' | 'down' | 'left' | 'right',
    opts?: { x?: number; y?: number; distance?: number; deviceId?: string },
  ): Promise<string> {
    const device = this.requireDevice(opts?.deviceId)
    const args: Record<string, unknown> = { device, direction }
    if (opts?.x !== undefined) args.x = opts.x
    if (opts?.y !== undefined) args.y = opts.y
    if (opts?.distance !== undefined) args.distance = opts.distance
    const result = await this.callTool('mobile_swipe_on_screen', args)
    return this.extractText(result)
  }

  /** Type text */
  async typeText(text: string, submit = false, deviceId?: string): Promise<string> {
    const device = this.requireDevice(deviceId)
    const result = await this.callTool('mobile_type_keys', { device, text, submit })
    return this.extractText(result)
  }

  /** Press a device button */
  async pressButton(
    button: 'HOME' | 'BACK' | 'VOLUME_UP' | 'VOLUME_DOWN' | 'ENTER',
    deviceId?: string,
  ): Promise<string> {
    const device = this.requireDevice(deviceId)
    const result = await this.callTool('mobile_press_button', { device, button })
    return this.extractText(result)
  }

  /** Get screen size */
  async getScreenSize(deviceId?: string): Promise<string> {
    const device = this.requireDevice(deviceId)
    const result = await this.callTool('mobile_get_screen_size', { device })
    return this.extractText(result)
  }

  /** Open a URL in the device browser */
  async openUrl(url: string, deviceId?: string): Promise<string> {
    const device = this.requireDevice(deviceId)
    const result = await this.callTool('mobile_open_url', { device, url })
    return this.extractText(result)
  }

  /** Get device orientation */
  async getOrientation(deviceId?: string): Promise<string> {
    const device = this.requireDevice(deviceId)
    const result = await this.callTool('mobile_get_orientation', { device })
    return this.extractText(result)
  }

  /** Terminate an app */
  async terminateApp(packageName: string, deviceId?: string): Promise<string> {
    const device = this.requireDevice(deviceId)
    const result = await this.callTool('mobile_terminate_app', { device, packageName })
    return this.extractText(result)
  }

  /** Double tap at coordinates */
  async doubleTap(x: number, y: number, deviceId?: string): Promise<string> {
    const device = this.requireDevice(deviceId)
    const result = await this.callTool('mobile_double_tap_on_screen', { device, x, y })
    return this.extractText(result)
  }

  /** Long press at coordinates */
  async longPress(x: number, y: number, duration?: number, deviceId?: string): Promise<string> {
    const device = this.requireDevice(deviceId)
    const args: Record<string, unknown> = { device, x, y }
    if (duration !== undefined) args.duration = duration
    const result = await this.callTool('mobile_long_press_on_screen_at_coordinates', args)
    return this.extractText(result)
  }
}
