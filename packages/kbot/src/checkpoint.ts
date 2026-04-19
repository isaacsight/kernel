// kbot Checkpoint System — Serialize agent state after every tool execution
//
// If a session crashes mid-execution, the checkpoint allows resuming from
// the last successful tool call instead of starting over. Persists to
// ~/.kbot/checkpoints/<session-id>.json
//
// Design:
//   - Atomic writes (write to .tmp, then rename) to prevent corruption
//   - Only keeps last 20 checkpoints per session to bound disk usage
//   - 7-day TTL for cleanup of stale checkpoints
//   - All operations are async and non-blocking

import { homedir } from 'node:os'
import { join } from 'node:path'
import { mkdir, writeFile, readFile, readdir, unlink, rename, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

// ── Types ──

export interface Checkpoint {
  /** Unique checkpoint ID */
  id: string
  /** Session this checkpoint belongs to */
  sessionId: string
  /** Unix timestamp (ms) when checkpoint was created */
  timestamp: number
  /** Tool loop iteration index */
  iteration: number
  /** Conversation messages accumulated so far */
  messages: any[]
  /** Ordered list of tool names called in this session */
  toolSequenceLog: string[]
  /** Total number of tool calls executed */
  toolCallCount: number
  /** Cumulative cost in USD across all API calls */
  cumulativeCostUsd: number
  /** Which specialist agent is running */
  agentId: string
  /** LLM model being used */
  model: string
  /** Full system prompt for context reconstruction */
  systemPrompt: string
  /** Session status — 'in_progress' means resume-eligible */
  status: 'in_progress' | 'completed' | 'failed'
}

// ── Constants ──

const CHECKPOINTS_DIR = join(homedir(), '.kbot', 'checkpoints')
const MAX_CHECKPOINTS_PER_SESSION = 20
const DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

// ── CheckpointManager ──

export class CheckpointManager {
  private dir: string
  private initialized: boolean = false

  constructor(dir?: string) {
    this.dir = dir || CHECKPOINTS_DIR
  }

  /** Ensure the checkpoints directory exists */
  private async ensureDir(): Promise<void> {
    if (this.initialized) return
    if (!existsSync(this.dir)) {
      await mkdir(this.dir, { recursive: true })
    }
    this.initialized = true
  }

  /**
   * Save a checkpoint atomically.
   * Writes to a .tmp file first, then renames to prevent corruption on crash.
   * Prunes old checkpoints to keep only the most recent MAX_CHECKPOINTS_PER_SESSION.
   */
  async save(checkpoint: Checkpoint): Promise<void> {
    await this.ensureDir()

    const filename = `${checkpoint.sessionId}_${checkpoint.timestamp}_${checkpoint.iteration}.json`
    const finalPath = join(this.dir, filename)
    const tmpPath = finalPath + '.tmp'

    // Atomic write: write to .tmp, then rename
    await writeFile(tmpPath, JSON.stringify(checkpoint, null, 2), 'utf-8')
    await rename(tmpPath, finalPath)

    // Prune old checkpoints for this session (keep only the most recent N)
    this.pruneSession(checkpoint.sessionId).catch(() => {
      // Pruning is best-effort — don't block the agent loop
    })
  }

  /**
   * Load the most recent checkpoint for a specific session.
   */
  async load(sessionId: string): Promise<Checkpoint | null> {
    await this.ensureDir()

    const files = await this.getSessionFiles(sessionId)
    if (files.length === 0) return null

    // Files are sorted by timestamp descending — first is most recent
    const latestFile = files[0]
    return this.readCheckpoint(join(this.dir, latestFile))
  }

  /**
   * Find the most recent incomplete checkpoint across all sessions.
   * Used on startup to detect crashed sessions that can be resumed.
   */
  async loadLatest(): Promise<Checkpoint | null> {
    const incomplete = await this.listIncomplete()
    return incomplete.length > 0 ? incomplete[0] : null
  }

  /**
   * Mark a session's checkpoints as completed (no resume needed).
   * Updates the most recent checkpoint's status to 'completed'.
   */
  async markCompleted(sessionId: string): Promise<void> {
    await this.ensureDir()

    const files = await this.getSessionFiles(sessionId)
    if (files.length === 0) return

    const latestFile = files[0]
    const filePath = join(this.dir, latestFile)
    const checkpoint = await this.readCheckpoint(filePath)
    if (!checkpoint) return

    checkpoint.status = 'completed'

    const tmpPath = filePath + '.tmp'
    await writeFile(tmpPath, JSON.stringify(checkpoint, null, 2), 'utf-8')
    await rename(tmpPath, filePath)
  }

  /**
   * Flip any `in_progress` checkpoint older than `staleMs` to `completed`.
   * A live run couldn't possibly still be pending after this cutoff — these
   * are all crashed/killed sessions whose exit path never marked them done.
   * Called on startup so stale checkpoints don't spam the recovery banner.
   */
  async expireStaleInProgress(staleMs = 30 * 60 * 1000): Promise<number> {
    await this.ensureDir()
    let files: string[]
    try { files = await readdir(this.dir) } catch { return 0 }
    const cutoff = Date.now() - staleMs
    let expired = 0
    for (const file of files) {
      if (!file.endsWith('.json')) continue
      const path = join(this.dir, file)
      const cp = await this.readCheckpoint(path)
      if (!cp) continue
      if (cp.status !== 'in_progress') continue
      if (cp.timestamp >= cutoff) continue // too recent, might still be live
      cp.status = 'completed'
      try {
        const tmpPath = path + '.tmp'
        await writeFile(tmpPath, JSON.stringify(cp, null, 2), 'utf-8')
        await rename(tmpPath, path)
        expired++
      } catch { /* best-effort */ }
    }
    return expired
  }

  /**
   * Find all checkpoints with status 'in_progress'.
   * Returns them sorted by timestamp descending (most recent first).
   */
  async listIncomplete(): Promise<Checkpoint[]> {
    await this.ensureDir()

    let files: string[]
    try {
      files = await readdir(this.dir)
    } catch {
      return []
    }

    const jsonFiles = files.filter(f => f.endsWith('.json') && !f.endsWith('.tmp'))
    const checkpoints: Checkpoint[] = []

    // Read all checkpoint files, collecting in_progress ones
    // Use a set to deduplicate by sessionId (only keep the latest per session)
    const seenSessions = new Set<string>()

    // Sort files by name descending (timestamp is embedded in filename)
    jsonFiles.sort((a, b) => b.localeCompare(a))

    for (const file of jsonFiles) {
      const checkpoint = await this.readCheckpoint(join(this.dir, file))
      if (!checkpoint) continue
      if (checkpoint.status !== 'in_progress') continue
      if (seenSessions.has(checkpoint.sessionId)) continue

      seenSessions.add(checkpoint.sessionId)
      checkpoints.push(checkpoint)
    }

    // Sort by timestamp descending
    checkpoints.sort((a, b) => b.timestamp - a.timestamp)
    return checkpoints
  }

  /**
   * Remove checkpoints older than maxAge.
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
      if (!file.endsWith('.json') && !file.endsWith('.tmp')) continue

      const filePath = join(this.dir, file)
      try {
        const fileStat = await stat(filePath)
        if (fileStat.mtimeMs < cutoff) {
          await unlink(filePath)
          removed++
        }
      } catch {
        // File may have been removed by another process — ignore
      }
    }

    return removed
  }

  // ── Private helpers ──

  /**
   * Get all checkpoint files for a session, sorted by timestamp descending.
   */
  private async getSessionFiles(sessionId: string): Promise<string[]> {
    let files: string[]
    try {
      files = await readdir(this.dir)
    } catch {
      return []
    }

    return files
      .filter(f => f.startsWith(sessionId + '_') && f.endsWith('.json') && !f.endsWith('.tmp'))
      .sort((a, b) => b.localeCompare(a)) // descending by timestamp in filename
  }

  /**
   * Read and parse a checkpoint file. Returns null on any error.
   */
  private async readCheckpoint(filePath: string): Promise<Checkpoint | null> {
    try {
      const raw = await readFile(filePath, 'utf-8')
      return JSON.parse(raw) as Checkpoint
    } catch {
      return null
    }
  }

  /**
   * Remove excess checkpoints for a session, keeping only the most recent N.
   */
  private async pruneSession(sessionId: string): Promise<void> {
    const files = await this.getSessionFiles(sessionId)
    if (files.length <= MAX_CHECKPOINTS_PER_SESSION) return

    // Remove oldest files (files are sorted descending, so slice from the end)
    const toRemove = files.slice(MAX_CHECKPOINTS_PER_SESSION)
    for (const file of toRemove) {
      try {
        await unlink(join(this.dir, file))
      } catch {
        // Best-effort cleanup
      }
    }
  }
}

// ── Convenience: module-level singleton ──

let _instance: CheckpointManager | null = null

export function getCheckpointManager(): CheckpointManager {
  if (!_instance) _instance = new CheckpointManager()
  return _instance
}

/** Generate a new unique session ID for checkpointing */
export function newSessionId(): string {
  return randomUUID()
}
