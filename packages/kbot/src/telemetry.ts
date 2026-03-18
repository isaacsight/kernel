// kbot Telemetry — Structured JSON event logging, local-only
//
// Writes telemetry events to ~/.kbot/telemetry/ as NDJSON files (one per day).
// No external reporting — all data stays on the user's machine.
// Events are buffered in memory and flushed every 5 seconds or 50 events,
// whichever comes first.
//
// NDJSON format: one JSON object per line, newline-separated.
// File naming: YYYY-MM-DD.ndjson
//
// Event types:
//   session_start / session_end   — session lifecycle
//   tool_call_start / tool_call_end / tool_call_error — tool execution
//   checkpoint_save / checkpoint_resume — checkpoint system
//   agent_route — agent routing decisions
//   api_call / api_error — LLM API interactions
//   cost_update — cumulative cost tracking

import { homedir } from 'node:os'
import { join } from 'node:path'
import { mkdir, appendFile, readFile, readdir, unlink, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'

// ── Types ──

export interface TelemetryEvent {
  /** Unix timestamp (ms) when event occurred */
  timestamp: number
  /** Session this event belongs to */
  sessionId: string
  /** Event type identifier */
  event: string
  /** Arbitrary event-specific data */
  data: Record<string, any>
  /** Duration in milliseconds (for timed events) */
  duration_ms?: number
}

export type EventType =
  | 'session_start'
  | 'session_end'
  | 'tool_call_start'
  | 'tool_call_end'
  | 'tool_call_error'
  | 'checkpoint_save'
  | 'checkpoint_resume'
  | 'agent_route'
  | 'api_call'
  | 'api_error'
  | 'cost_update'

// ── Constants ──

const TELEMETRY_DIR = join(homedir(), '.kbot', 'telemetry')
const FLUSH_INTERVAL_MS = 5_000     // Flush every 5 seconds
const FLUSH_THRESHOLD = 50          // Or when buffer reaches 50 events
const DEFAULT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

// ── TelemetryEmitter ──

export class TelemetryEmitter {
  private dir: string
  private sessionId: string
  private buffer: TelemetryEvent[] = []
  private flushTimer: ReturnType<typeof setInterval> | null = null
  private initialized: boolean = false
  private flushing: boolean = false

  constructor(sessionId: string, dir?: string) {
    this.sessionId = sessionId
    this.dir = dir || TELEMETRY_DIR

    // Start periodic flush
    this.flushTimer = setInterval(() => {
      this.flush().catch(() => {
        // Flush errors are non-critical — events may be lost but agent keeps running
      })
    }, FLUSH_INTERVAL_MS)

    // Prevent the timer from keeping the process alive
    if (this.flushTimer && typeof this.flushTimer.unref === 'function') {
      this.flushTimer.unref()
    }
  }

  /** Ensure the telemetry directory exists */
  private async ensureDir(): Promise<void> {
    if (this.initialized) return
    if (!existsSync(this.dir)) {
      await mkdir(this.dir, { recursive: true })
    }
    this.initialized = true
  }

  /**
   * Emit a telemetry event. Buffers it in memory.
   * When the buffer reaches FLUSH_THRESHOLD, triggers an immediate flush.
   */
  emit(event: EventType, data: Record<string, any>, duration_ms?: number): void {
    const telemetryEvent: TelemetryEvent = {
      timestamp: Date.now(),
      sessionId: this.sessionId,
      event,
      data,
    }
    if (duration_ms !== undefined) {
      telemetryEvent.duration_ms = duration_ms
    }

    this.buffer.push(telemetryEvent)

    // Flush immediately if buffer is full
    if (this.buffer.length >= FLUSH_THRESHOLD) {
      this.flush().catch(() => {
        // Non-critical
      })
    }
  }

  /**
   * Flush buffered events to the daily NDJSON file.
   * Each event is one JSON line, appended atomically.
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return
    if (this.flushing) return // Prevent concurrent flushes
    this.flushing = true

    try {
      await this.ensureDir()

      // Drain buffer atomically
      const events = this.buffer.splice(0)

      // Group events by date (in case buffer spans midnight)
      const byDate = new Map<string, TelemetryEvent[]>()
      for (const event of events) {
        const dateKey = new Date(event.timestamp).toISOString().slice(0, 10) // YYYY-MM-DD
        const existing = byDate.get(dateKey) || []
        existing.push(event)
        byDate.set(dateKey, existing)
      }

      // Append to each day's file
      for (const [dateKey, dayEvents] of byDate) {
        const filePath = join(this.dir, `${dateKey}.ndjson`)
        const lines = dayEvents.map(e => JSON.stringify(e)).join('\n') + '\n'
        await appendFile(filePath, lines, 'utf-8')
      }
    } catch {
      // Telemetry writes failing should never crash the agent
    } finally {
      this.flushing = false
    }
  }

  /**
   * Read all telemetry events for a specific session.
   * Scans all NDJSON files and filters by sessionId.
   */
  async getSessionEvents(sessionId: string): Promise<TelemetryEvent[]> {
    await this.ensureDir()

    let files: string[]
    try {
      files = await readdir(this.dir)
    } catch {
      return []
    }

    const ndjsonFiles = files
      .filter(f => f.endsWith('.ndjson'))
      .sort() // chronological order

    const events: TelemetryEvent[] = []

    for (const file of ndjsonFiles) {
      try {
        const content = await readFile(join(this.dir, file), 'utf-8')
        const lines = content.split('\n').filter(line => line.trim())

        for (const line of lines) {
          try {
            const event = JSON.parse(line) as TelemetryEvent
            if (event.sessionId === sessionId) {
              events.push(event)
            }
          } catch {
            // Skip malformed lines
          }
        }
      } catch {
        // Skip unreadable files
      }
    }

    return events
  }

  /**
   * Remove telemetry files older than maxAge.
   * Returns the number of files removed.
   */
  async cleanup(maxAge?: number): Promise<number> {
    await this.ensureDir()

    const maxAgeMs = maxAge ?? DEFAULT_MAX_AGE_MS
    const cutoff = Date.now() - maxAgeMs
    let removed = 0

    let files: string[]
    try {
      files = await readdir(this.dir)
    } catch {
      return 0
    }

    for (const file of files) {
      if (!file.endsWith('.ndjson')) continue

      const filePath = join(this.dir, file)
      try {
        const fileStat = await stat(filePath)
        if (fileStat.mtimeMs < cutoff) {
          await unlink(filePath)
          removed++
        }
      } catch {
        // File may have been removed — ignore
      }
    }

    return removed
  }

  /**
   * Flush remaining events and stop the periodic flush timer.
   * Call this when the session ends or the process is exiting.
   */
  async destroy(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }
    // Final flush
    await this.flush()
  }
}

// ── Convenience: module-level singleton ──

let _instance: TelemetryEmitter | null = null

export function getTelemetryEmitter(sessionId?: string): TelemetryEmitter {
  if (!_instance) {
    if (!sessionId) throw new Error('TelemetryEmitter requires a sessionId on first call')
    _instance = new TelemetryEmitter(sessionId)
  }
  return _instance
}

export function destroyTelemetryEmitter(): Promise<void> {
  if (_instance) {
    const p = _instance.destroy()
    _instance = null
    return p
  }
  return Promise.resolve()
}
