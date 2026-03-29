// kbot Multi-Session — Parallel Named Sessions
//
// Run multiple independent kbot agent sessions on the same project.
// Each session gets isolated conversation history but shares learning
// data, memory, teachings, and user profile.
//
// Sessions can run in the foreground (one at a time) or background
// (via child_process.fork). They communicate through a simple message bus.
//
// Storage: ~/.kbot/sessions/managed/
// Limit: 8 concurrent sessions (prevents resource exhaustion)

import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  existsSync, readFileSync, writeFileSync, mkdirSync,
  readdirSync, unlinkSync,
} from 'node:fs'
import { fork, type ChildProcess } from 'node:child_process'
import chalk from 'chalk'

// ── Constants ──

const MANAGED_DIR = join(homedir(), '.kbot', 'sessions', 'managed')
const MESSAGE_BUS_DIR = join(homedir(), '.kbot', 'sessions', 'bus')
const MAX_CONCURRENT_SESSIONS = 8
const MAX_HISTORY_TURNS = 100
const SESSION_STALE_MS = 24 * 60 * 60 * 1000 // 24 hours

// ── NO_COLOR support ──

const useColor = !process.env.NO_COLOR && process.stdout.isTTY !== false

const colors = {
  green: useColor ? chalk.hex('#4ADE80') : (s: string) => s,
  yellow: useColor ? chalk.hex('#FBBF24') : (s: string) => s,
  blue: useColor ? chalk.hex('#60A5FA') : (s: string) => s,
  dim: useColor ? chalk.dim : (s: string) => s,
  accent: useColor ? chalk.hex('#A78BFA') : (s: string) => s,
  red: useColor ? chalk.hex('#F87171') : (s: string) => s,
  cyan: useColor ? chalk.hex('#67E8F9') : (s: string) => s,
  bold: useColor ? chalk.bold : (s: string) => s,
  white: useColor ? chalk.white : (s: string) => s,
}

// ── Types ──

export interface ManagedSession {
  /** Unique session ID (slug or generated) */
  id: string
  /** Human-readable name */
  name: string
  /** PID if running in background */
  pid?: number
  /** Session status */
  status: 'active' | 'paused' | 'background' | 'completed'
  /** Specialist agent assigned to this session */
  agent?: string
  /** Description of what this session is working on */
  task?: string
  /** Conversation history (isolated per session) */
  history: Array<{ role: string; content: string }>
  /** When the session was created */
  createdAt: string
  /** When the session was last active */
  lastActiveAt: string
  /** Token usage tracking */
  tokenUsage: { input: number; output: number }
  /** Number of tool calls made */
  toolCalls: number
}

export interface SessionMessage {
  /** Session ID that sent the message */
  from: string
  /** Message content */
  message: string
  /** ISO timestamp */
  timestamp: string
}

// ── Internal state ──

/** The currently active foreground session ID */
let activeSessionId: string | null = null

/** Map of background child processes by session ID */
const backgroundProcesses = new Map<string, ChildProcess>()

// ── Directory management ──

function ensureManagedDir(): void {
  if (!existsSync(MANAGED_DIR)) mkdirSync(MANAGED_DIR, { recursive: true })
}

function ensureBusDir(): void {
  if (!existsSync(MESSAGE_BUS_DIR)) mkdirSync(MESSAGE_BUS_DIR, { recursive: true })
}

function sessionPath(id: string): string {
  return join(MANAGED_DIR, `${id}.json`)
}

function busInboxPath(sessionId: string): string {
  return join(MESSAGE_BUS_DIR, `${sessionId}.json`)
}

// ── ID generation ──

function generateId(): string {
  const now = new Date()
  const date = now.toISOString().split('T')[0].replace(/-/g, '')
  const rand = Math.random().toString(36).slice(2, 6)
  return `ms-${date}-${rand}`
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 40)
}

// ── Persistence helpers ──

function readSession(id: string): ManagedSession | null {
  const path = sessionPath(id)
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf-8'))
  } catch {
    return null
  }
}

function writeSession(session: ManagedSession): void {
  ensureManagedDir()
  writeFileSync(sessionPath(session.id), JSON.stringify(session, null, 2))
}

function readBusInbox(sessionId: string): SessionMessage[] {
  const path = busInboxPath(sessionId)
  if (!existsSync(path)) return []
  try {
    return JSON.parse(readFileSync(path, 'utf-8'))
  } catch {
    return []
  }
}

function writeBusInbox(sessionId: string, messages: SessionMessage[]): void {
  ensureBusDir()
  writeFileSync(busInboxPath(sessionId), JSON.stringify(messages, null, 2))
}

// ── Lookup helper ──

/**
 * Find a session by exact ID, slug match, or fuzzy name match.
 * Used by all public functions that accept nameOrId.
 */
function findSession(nameOrId: string): ManagedSession | null {
  ensureManagedDir()

  // 1. Try exact ID match
  const exact = readSession(nameOrId)
  if (exact) return exact

  // 2. Try slugified name as ID
  const slugged = slugify(nameOrId)
  const bySlug = readSession(slugged)
  if (bySlug) return bySlug

  // 3. Scan all sessions for partial ID or name match
  const files = readdirSync(MANAGED_DIR).filter(f => f.endsWith('.json'))
  const lowerQuery = nameOrId.toLowerCase()

  for (const file of files) {
    const id = file.replace('.json', '')
    if (id.includes(lowerQuery)) {
      return readSession(id)
    }
  }

  // 4. Fuzzy match on name field
  for (const file of files) {
    const session = readSession(file.replace('.json', ''))
    if (session && session.name.toLowerCase().includes(lowerQuery)) {
      return session
    }
  }

  return null
}

// ── Validation ──

function countActiveSessions(): number {
  const sessions = listSessions()
  return sessions.filter(s => s.status === 'active' || s.status === 'background').length
}

function validateSessionLimit(): void {
  const active = countActiveSessions()
  if (active >= MAX_CONCURRENT_SESSIONS) {
    throw new Error(
      `Session limit reached (${MAX_CONCURRENT_SESSIONS} concurrent). ` +
      `Kill or pause a session first. Use listSessions() to see all sessions.`
    )
  }
}

function validateUniqueName(name: string): void {
  const existing = findSession(name)
  if (existing && existing.status !== 'completed') {
    throw new Error(
      `Session "${name}" already exists (status: ${existing.status}). ` +
      `Use a different name or kill the existing session.`
    )
  }
}

// ── Core API ──

/**
 * Create a new named session.
 * Each session starts with empty history and tracks its own token usage.
 */
export function createSession(opts: {
  name: string
  agent?: string
  task?: string
}): ManagedSession {
  validateSessionLimit()
  validateUniqueName(opts.name)

  const id = slugify(opts.name) || generateId()
  const now = new Date().toISOString()

  const session: ManagedSession = {
    id,
    name: opts.name,
    status: 'active',
    agent: opts.agent,
    task: opts.task,
    history: [],
    createdAt: now,
    lastActiveAt: now,
    tokenUsage: { input: 0, output: 0 },
    toolCalls: 0,
  }

  writeSession(session)

  // Set as active foreground session
  activeSessionId = session.id

  return session
}

/**
 * List all managed sessions, newest first.
 * Cleans up stale background sessions whose processes are no longer running.
 */
export function listSessions(): ManagedSession[] {
  ensureManagedDir()
  const files = readdirSync(MANAGED_DIR).filter(f => f.endsWith('.json'))

  const sessions: ManagedSession[] = []
  for (const file of files) {
    const session = readSession(file.replace('.json', ''))
    if (session) {
      // Clean up stale background sessions
      if (session.status === 'background' && session.pid) {
        if (!isProcessRunning(session.pid)) {
          session.status = 'completed'
          session.pid = undefined
          writeSession(session)
        }
      }
      sessions.push(session)
    }
  }

  return sessions.sort(
    (a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime()
  )
}

/**
 * Switch the active foreground session.
 * The previous active session is paused. Returns the newly active session.
 */
export function switchSession(nameOrId: string): ManagedSession | null {
  const target = findSession(nameOrId)
  if (!target) return null

  if (target.status === 'completed') {
    throw new Error(`Cannot switch to completed session "${target.name}". Resume it first.`)
  }

  // Pause current active session
  if (activeSessionId && activeSessionId !== target.id) {
    const current = readSession(activeSessionId)
    if (current && current.status === 'active') {
      current.status = 'paused'
      current.lastActiveAt = new Date().toISOString()
      writeSession(current)
    }
  }

  // Activate target
  target.status = 'active'
  target.lastActiveAt = new Date().toISOString()
  writeSession(target)

  activeSessionId = target.id
  return target
}

/**
 * Send a message to a background session.
 * The message is delivered via the message bus and the session's
 * background process picks it up on its next iteration.
 */
export async function sendToSession(nameOrId: string, message: string): Promise<string> {
  const target = findSession(nameOrId)
  if (!target) return `Session "${nameOrId}" not found.`

  if (target.status !== 'background') {
    return `Session "${target.name}" is not running in background (status: ${target.status}).`
  }

  // Deliver via message bus
  const busMessage: SessionMessage = {
    from: activeSessionId || 'user',
    message,
    timestamp: new Date().toISOString(),
  }

  const inbox = readBusInbox(target.id)
  inbox.push(busMessage)
  writeBusInbox(target.id, inbox)

  // Also try IPC if the background process is still tracked
  const proc = backgroundProcesses.get(target.id)
  if (proc && proc.connected) {
    try {
      proc.send({ type: 'message', from: busMessage.from, content: message })
    } catch {
      // IPC send failed — message is still in the file-based bus
    }
  }

  return `Message delivered to "${target.name}".`
}

/**
 * Pause a session — preserve context, free resources.
 * Background sessions have their child process killed.
 */
export function pauseSession(nameOrId: string): boolean {
  const session = findSession(nameOrId)
  if (!session) return false
  if (session.status === 'completed' || session.status === 'paused') return false

  // Kill background process if running
  if (session.status === 'background' && session.pid) {
    killBackgroundProcess(session.id, session.pid)
  }

  session.status = 'paused'
  session.pid = undefined
  session.lastActiveAt = new Date().toISOString()
  writeSession(session)

  if (activeSessionId === session.id) {
    activeSessionId = null
  }

  return true
}

/**
 * Resume a paused session back to active status.
 */
export function resumeSession(nameOrId: string): ManagedSession | null {
  const session = findSession(nameOrId)
  if (!session) return null
  if (session.status !== 'paused' && session.status !== 'completed') return null

  validateSessionLimit()

  session.status = 'active'
  session.lastActiveAt = new Date().toISOString()
  writeSession(session)

  // Auto-switch to this session
  activeSessionId = session.id

  return session
}

/**
 * Kill a session — terminate background process, mark as completed.
 */
export function killSession(nameOrId: string): boolean {
  const session = findSession(nameOrId)
  if (!session) return false

  // Kill background process if running
  if (session.pid) {
    killBackgroundProcess(session.id, session.pid)
  }

  session.status = 'completed'
  session.pid = undefined
  session.lastActiveAt = new Date().toISOString()
  writeSession(session)

  if (activeSessionId === session.id) {
    activeSessionId = null
  }

  return true
}

/**
 * Get a session by name or ID.
 */
export function getSession(nameOrId: string): ManagedSession | null {
  return findSession(nameOrId)
}

/**
 * Get the currently active foreground session.
 */
export function getActiveSession(): ManagedSession | null {
  if (!activeSessionId) return null
  return readSession(activeSessionId)
}

/**
 * Set the active session ID without changing status.
 * Used internally when restoring state on startup.
 */
export function setActiveSessionId(id: string | null): void {
  activeSessionId = id
}

// ── History management ──

/**
 * Append a turn to a session's conversation history.
 * Enforces MAX_HISTORY_TURNS — compacts when exceeded.
 */
export function appendToSessionHistory(
  nameOrId: string,
  turn: { role: string; content: string }
): boolean {
  const session = findSession(nameOrId)
  if (!session) return false

  session.history.push(turn)
  session.lastActiveAt = new Date().toISOString()

  // Compact if over limit: summarize old turns, keep recent ones
  if (session.history.length > MAX_HISTORY_TURNS) {
    const keepVerbatim = session.history.slice(-20)
    const toSummarize = session.history.slice(0, -20)

    const userTopics: string[] = []
    const assistantTopics: string[] = []

    for (const t of toSummarize) {
      if (t.role === 'user') {
        userTopics.push(t.content.slice(0, 80))
      } else {
        assistantTopics.push(t.content.split('\n')[0].slice(0, 80))
      }
    }

    const summary = [
      '[Compacted conversation summary]',
      userTopics.length > 0 ? `User asked about: ${userTopics.join('; ')}` : '',
      assistantTopics.length > 0 ? `Topics covered: ${assistantTopics.join('; ')}` : '',
    ].filter(Boolean).join('\n')

    session.history = [
      { role: 'assistant', content: summary },
      ...keepVerbatim,
    ]
  }

  writeSession(session)
  return true
}

/**
 * Update token usage counters for a session.
 */
export function updateSessionTokens(
  nameOrId: string,
  input: number,
  output: number,
  toolCalls?: number
): boolean {
  const session = findSession(nameOrId)
  if (!session) return false

  session.tokenUsage.input += input
  session.tokenUsage.output += output
  if (toolCalls) session.toolCalls += toolCalls
  session.lastActiveAt = new Date().toISOString()

  writeSession(session)
  return true
}

// ── Background execution ──

/**
 * Move a session to background execution.
 * Forks a child process that continues the session independently.
 * The child shares ~/.kbot/ learning data but has isolated history.
 */
export function backgroundSession(
  nameOrId: string,
  scriptPath?: string
): ManagedSession | null {
  const session = findSession(nameOrId)
  if (!session) return null

  if (session.status === 'background') {
    throw new Error(`Session "${session.name}" is already running in background.`)
  }
  if (session.status === 'completed') {
    throw new Error(`Cannot background a completed session. Resume it first.`)
  }

  validateSessionLimit()

  // Use the provided script path or fall back to default background worker
  const workerScript = scriptPath || join(__dirname, 'session-worker.js')

  if (!existsSync(workerScript)) {
    // If no worker script exists, we still mark the session as background
    // and rely on external orchestration (e.g., planner.ts or daemon)
    session.status = 'background'
    session.lastActiveAt = new Date().toISOString()
    writeSession(session)

    if (activeSessionId === session.id) {
      activeSessionId = null
    }

    return session
  }

  try {
    const child = fork(workerScript, [session.id], {
      detached: true,
      stdio: 'ignore',
      env: {
        ...process.env,
        KBOT_SESSION_ID: session.id,
        KBOT_SESSION_NAME: session.name,
        KBOT_SESSION_AGENT: session.agent || '',
        KBOT_SESSION_TASK: session.task || '',
      },
    })

    child.unref()

    session.status = 'background'
    session.pid = child.pid
    session.lastActiveAt = new Date().toISOString()
    writeSession(session)

    backgroundProcesses.set(session.id, child)

    // Listen for exit
    child.on('exit', (code) => {
      backgroundProcesses.delete(session.id)
      const s = readSession(session.id)
      if (s && s.status === 'background') {
        s.status = 'completed'
        s.pid = undefined
        s.lastActiveAt = new Date().toISOString()
        writeSession(s)
      }
    })

    if (activeSessionId === session.id) {
      activeSessionId = null
    }

    return session
  } catch (err) {
    // Fork failed — mark as paused so user can retry
    session.status = 'paused'
    session.lastActiveAt = new Date().toISOString()
    writeSession(session)
    throw new Error(`Failed to background session "${session.name}": ${err}`)
  }
}

// ── Message bus ──

/**
 * Broadcast a message to all active/background sessions.
 * Messages are delivered via the file-based bus — each session has an inbox.
 */
export function broadcastToSessions(message: string, fromSession?: string): void {
  ensureBusDir()

  const sessions = listSessions()
  const sender = fromSession || activeSessionId || 'system'

  const busMessage: SessionMessage = {
    from: sender,
    message,
    timestamp: new Date().toISOString(),
  }

  for (const session of sessions) {
    // Don't send to the sender or to completed sessions
    if (session.id === sender) continue
    if (session.status === 'completed') continue

    const inbox = readBusInbox(session.id)
    inbox.push(busMessage)

    // Keep inbox bounded — last 50 messages
    const trimmed = inbox.slice(-50)
    writeBusInbox(session.id, trimmed)

    // Also try IPC for background sessions
    const proc = backgroundProcesses.get(session.id)
    if (proc && proc.connected) {
      try {
        proc.send({ type: 'broadcast', from: sender, content: message })
      } catch {
        // IPC failed — file bus is the fallback
      }
    }
  }
}

/**
 * Get pending messages for a session and clear the inbox.
 */
export function getSessionMessages(sessionId: string): SessionMessage[] {
  const messages = readBusInbox(sessionId)

  // Clear inbox after reading
  if (messages.length > 0) {
    writeBusInbox(sessionId, [])
  }

  return messages
}

/**
 * Peek at messages without clearing (non-destructive read).
 */
export function peekSessionMessages(sessionId: string): SessionMessage[] {
  return readBusInbox(sessionId)
}

// ── Session cleanup ──

/**
 * Remove completed sessions older than the stale threshold.
 */
export function pruneCompletedSessions(maxAge: number = SESSION_STALE_MS): number {
  ensureManagedDir()
  const files = readdirSync(MANAGED_DIR).filter(f => f.endsWith('.json'))
  const now = Date.now()
  let pruned = 0

  for (const file of files) {
    const session = readSession(file.replace('.json', ''))
    if (!session) continue
    if (session.status !== 'completed') continue

    const age = now - new Date(session.lastActiveAt).getTime()
    if (age > maxAge) {
      const path = sessionPath(session.id)
      if (existsSync(path)) {
        unlinkSync(path)
        pruned++
      }
      // Also clean up bus inbox
      const busPath = busInboxPath(session.id)
      if (existsSync(busPath)) {
        unlinkSync(busPath)
      }
    }
  }

  return pruned
}

/**
 * Delete a session entirely — removes all data.
 */
export function deleteSession(nameOrId: string): boolean {
  const session = findSession(nameOrId)
  if (!session) return false

  // Kill if running
  if (session.pid) {
    killBackgroundProcess(session.id, session.pid)
  }

  // Remove session file
  const path = sessionPath(session.id)
  if (existsSync(path)) unlinkSync(path)

  // Remove bus inbox
  const busPath = busInboxPath(session.id)
  if (existsSync(busPath)) unlinkSync(busPath)

  if (activeSessionId === session.id) {
    activeSessionId = null
  }

  backgroundProcesses.delete(session.id)

  return true
}

// ── Display formatting ──

const STATUS_LABELS: Record<ManagedSession['status'], (s: string) => string> = {
  active: colors.green,
  paused: colors.yellow,
  background: colors.blue,
  completed: colors.dim,
}

const STATUS_ICONS: Record<ManagedSession['status'], string> = {
  active: '●',
  paused: '◐',
  background: '◉',
  completed: '○',
}

/**
 * Format a list of sessions as a table for terminal display.
 */
export function formatSessionList(sessions: ManagedSession[]): string {
  if (sessions.length === 0) {
    return colors.dim('  No managed sessions.')
  }

  const lines: string[] = []

  // Header
  lines.push(colors.bold('  Sessions'))
  lines.push(colors.dim('  ' + '─'.repeat(72)))

  // Column header
  lines.push(
    colors.dim(
      '  ' +
      pad('Status', 12) +
      pad('Name', 22) +
      pad('Agent', 14) +
      pad('Tokens', 12) +
      'Task'
    )
  )
  lines.push(colors.dim('  ' + '─'.repeat(72)))

  for (const session of sessions) {
    const statusColor = STATUS_LABELS[session.status]
    const icon = STATUS_ICONS[session.status]
    const isActive = session.id === activeSessionId

    const statusStr = statusColor(`${icon} ${session.status}`)
    const nameStr = isActive
      ? colors.accent(`${session.name} *`)
      : colors.white(session.name)
    const agentStr = session.agent ? colors.cyan(session.agent) : colors.dim('—')
    const totalTokens = session.tokenUsage.input + session.tokenUsage.output
    const tokenStr = totalTokens > 0 ? formatTokenCount(totalTokens) : colors.dim('0')
    const taskStr = session.task
      ? colors.dim(truncate(session.task, 30))
      : colors.dim('—')

    lines.push(
      '  ' +
      pad(statusStr, 12 + ansiLenDiff(statusStr, `${icon} ${session.status}`)) +
      pad(nameStr, 22 + ansiLenDiff(nameStr, isActive ? `${session.name} *` : session.name)) +
      pad(agentStr, 14 + ansiLenDiff(agentStr, session.agent || '—')) +
      pad(tokenStr, 12 + ansiLenDiff(tokenStr, totalTokens > 0 ? formatTokenCountRaw(totalTokens) : '0')) +
      taskStr
    )
  }

  lines.push(colors.dim('  ' + '─'.repeat(72)))

  // Footer summary
  const active = sessions.filter(s => s.status === 'active').length
  const background = sessions.filter(s => s.status === 'background').length
  const paused = sessions.filter(s => s.status === 'paused').length
  const parts: string[] = []
  if (active > 0) parts.push(colors.green(`${active} active`))
  if (background > 0) parts.push(colors.blue(`${background} background`))
  if (paused > 0) parts.push(colors.yellow(`${paused} paused`))
  parts.push(colors.dim(`${sessions.length} total`))
  lines.push(`  ${parts.join(colors.dim(' · '))}`)

  return lines.join('\n')
}

/**
 * Format a single session's status for detailed display.
 */
export function formatSessionStatus(session: ManagedSession): string {
  const lines: string[] = []
  const statusColor = STATUS_LABELS[session.status]
  const icon = STATUS_ICONS[session.status]
  const isActive = session.id === activeSessionId

  // Header
  lines.push(
    colors.bold(`  ${session.name}`) +
    (isActive ? colors.accent(' (active)') : '') +
    '  ' + statusColor(`${icon} ${session.status}`)
  )
  lines.push(colors.dim('  ' + '─'.repeat(50)))

  // Details
  lines.push(`  ${colors.dim('ID:')}        ${session.id}`)
  if (session.agent) {
    lines.push(`  ${colors.dim('Agent:')}     ${colors.cyan(session.agent)}`)
  }
  if (session.task) {
    lines.push(`  ${colors.dim('Task:')}      ${session.task}`)
  }
  if (session.pid) {
    lines.push(`  ${colors.dim('PID:')}       ${session.pid}`)
  }

  // Timeline
  lines.push(`  ${colors.dim('Created:')}   ${formatTimestamp(session.createdAt)}`)
  lines.push(`  ${colors.dim('Last seen:')} ${formatTimestamp(session.lastActiveAt)}`)

  // Stats
  const totalTokens = session.tokenUsage.input + session.tokenUsage.output
  lines.push(
    `  ${colors.dim('Tokens:')}    ${formatTokenCount(session.tokenUsage.input)} in / ` +
    `${formatTokenCount(session.tokenUsage.output)} out ` +
    colors.dim(`(${formatTokenCount(totalTokens)} total)`)
  )
  lines.push(`  ${colors.dim('Tools:')}     ${session.toolCalls} calls`)
  lines.push(`  ${colors.dim('History:')}   ${session.history.length} turns`)

  // Recent history preview
  if (session.history.length > 0) {
    lines.push('')
    lines.push(colors.dim('  Recent:'))
    const recent = session.history.slice(-4)
    for (const turn of recent) {
      const role = turn.role === 'user' ? colors.green('you') : colors.accent('kbot')
      const preview = truncate(turn.content.replace(/\n/g, ' '), 60)
      lines.push(`    ${role}: ${colors.dim(preview)}`)
    }
  }

  // Pending messages
  const messages = peekSessionMessages(session.id)
  if (messages.length > 0) {
    lines.push('')
    lines.push(colors.yellow(`  ${messages.length} pending message${messages.length > 1 ? 's' : ''}`))
  }

  return lines.join('\n')
}

// ── Utilities ──

/**
 * Check if a process is still running by PID.
 */
function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0) // Signal 0 = check existence, don't kill
    return true
  } catch {
    return false
  }
}

/**
 * Kill a background process by PID and clean up.
 */
function killBackgroundProcess(sessionId: string, pid: number): void {
  try {
    process.kill(pid, 'SIGTERM')
  } catch {
    // Process already dead
  }
  backgroundProcesses.delete(sessionId)
}

/**
 * Pad a string to a target width. Accounts for ANSI color codes.
 */
function pad(str: string, width: number): string {
  const visible = stripAnsi(str)
  const padding = Math.max(0, width - visible.length)
  return str + ' '.repeat(padding)
}

/**
 * Calculate the difference in length between an ANSI-colored string
 * and its visible content. Used for column alignment.
 */
function ansiLenDiff(ansiStr: string, plainStr: string): number {
  return ansiStr.length - plainStr.length
}

/**
 * Strip ANSI escape codes for length calculations.
 */
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\u001b\[[0-9;]*m/g, '')
}

/**
 * Truncate a string with ellipsis.
 */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen - 1) + '…'
}

/**
 * Format a token count for display (e.g., "12.3K", "1.2M").
 */
function formatTokenCount(count: number): string {
  const raw = formatTokenCountRaw(count)
  return colors.white(raw)
}

function formatTokenCountRaw(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`
  return `${count}`
}

/**
 * Format an ISO timestamp as relative time.
 */
function formatTimestamp(iso: string): string {
  const date = new Date(iso)
  const now = Date.now()
  const diff = now - date.getTime()

  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// ── Session snapshot / restore ──

/**
 * Export a session as a portable JSON snapshot.
 * Useful for sharing or archiving.
 */
export function exportSession(nameOrId: string): string | null {
  const session = findSession(nameOrId)
  if (!session) return null

  const snapshot = {
    ...session,
    exportedAt: new Date().toISOString(),
    version: 1,
  }

  return JSON.stringify(snapshot, null, 2)
}

/**
 * Import a session from a JSON snapshot.
 */
export function importSession(json: string): ManagedSession {
  let data: ManagedSession & { exportedAt?: string; version?: number }

  try {
    data = JSON.parse(json)
  } catch {
    throw new Error('Invalid session JSON.')
  }

  if (!data.id || !data.name || !Array.isArray(data.history)) {
    throw new Error('Invalid session format — missing required fields (id, name, history).')
  }

  validateSessionLimit()

  // Generate a new ID if the original already exists
  const existing = readSession(data.id)
  if (existing) {
    data.id = `${data.id}-${Math.random().toString(36).slice(2, 6)}`
  }

  const session: ManagedSession = {
    id: data.id,
    name: data.name,
    status: 'paused', // Imported sessions start paused
    agent: data.agent,
    task: data.task,
    history: data.history,
    createdAt: data.createdAt || new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
    tokenUsage: data.tokenUsage || { input: 0, output: 0 },
    toolCalls: data.toolCalls || 0,
  }

  writeSession(session)
  return session
}

// ── Multi-session overview ──

/**
 * Get a high-level summary of all sessions for inclusion in system prompts.
 * Keeps it compact — just names, statuses, and tasks.
 */
export function getSessionContextSummary(): string {
  const sessions = listSessions()
  if (sessions.length === 0) return ''

  const active = sessions.filter(s => s.status !== 'completed')
  if (active.length === 0) return ''

  const lines = ['[Active Sessions]']
  for (const s of active) {
    const parts = [`- ${s.name} (${s.status})`]
    if (s.agent) parts.push(`agent:${s.agent}`)
    if (s.task) parts.push(`task: ${truncate(s.task, 50)}`)
    lines.push(parts.join(' '))
  }

  return lines.join('\n')
}

/**
 * Get aggregate stats across all sessions.
 */
export function getMultiSessionStats(): {
  totalSessions: number
  active: number
  paused: number
  background: number
  completed: number
  totalTokensIn: number
  totalTokensOut: number
  totalToolCalls: number
} {
  const sessions = listSessions()

  let totalTokensIn = 0
  let totalTokensOut = 0
  let totalToolCalls = 0

  for (const s of sessions) {
    totalTokensIn += s.tokenUsage.input
    totalTokensOut += s.tokenUsage.output
    totalToolCalls += s.toolCalls
  }

  return {
    totalSessions: sessions.length,
    active: sessions.filter(s => s.status === 'active').length,
    paused: sessions.filter(s => s.status === 'paused').length,
    background: sessions.filter(s => s.status === 'background').length,
    completed: sessions.filter(s => s.status === 'completed').length,
    totalTokensIn,
    totalTokensOut,
    totalToolCalls,
  }
}
