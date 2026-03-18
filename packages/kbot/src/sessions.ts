// kbot Session Persistence — Save, Resume, and List Conversations
//
// Like Gemini CLI's /chat save/resume and Claude Code's session history.
// Sessions store conversation history + metadata so users can:
//   /save [name]    — Save current conversation with optional name
//   /resume [name]  — Resume a saved conversation
//   /sessions       — List all saved sessions
//
// Stored at ~/.kbot/sessions/

import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  existsSync, readFileSync, writeFileSync, mkdirSync,
  readdirSync, unlinkSync, statSync,
} from 'node:fs'
import { getHistory, type ConversationTurn } from './memory.js'

const SESSIONS_DIR = join(homedir(), '.kbot', 'sessions')
const MAX_SESSIONS = 50

export interface Session {
  /** Unique session ID */
  id: string
  /** Human-readable name */
  name: string
  /** When the session was created */
  created: string
  /** When it was last updated */
  updated: string
  /** Working directory when session was created */
  cwd: string
  /** Number of turns in the conversation */
  turnCount: number
  /** First user message (for preview) */
  preview: string
  /** The conversation history */
  history: ConversationTurn[]
  /** Agent that was active */
  agent?: string
  /** Any context notes */
  notes?: string
}

function ensureDir(): void {
  if (!existsSync(SESSIONS_DIR)) mkdirSync(SESSIONS_DIR, { recursive: true })
}

function sessionPath(id: string): string {
  return join(SESSIONS_DIR, `${id}.json`)
}

function generateId(): string {
  const now = new Date()
  const date = now.toISOString().split('T')[0].replace(/-/g, '')
  const rand = Math.random().toString(36).slice(2, 6)
  return `${date}-${rand}`
}

function slugify(name: string): string {
  return name.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 40)
}

/** Save the current conversation as a session */
export function saveSession(name?: string, agent?: string): Session {
  ensureDir()
  const history = getHistory()
  if (history.length === 0) {
    throw new Error('No conversation to save')
  }

  const id = name ? slugify(name) : generateId()
  const firstUserMsg = history.find(t => t.role === 'user')?.content || ''
  const preview = firstUserMsg.slice(0, 100)

  const session: Session = {
    id,
    name: name || `Session ${id}`,
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    cwd: process.cwd(),
    turnCount: history.length,
    preview,
    history: [...history],
    agent,
  }

  writeFileSync(sessionPath(id), JSON.stringify(session, null, 2))

  // Cleanup old sessions if over limit
  pruneOldSessions()

  return session
}

/** Load a session by ID or name */
export function loadSession(idOrName: string): Session | null {
  ensureDir()
  const slug = slugify(idOrName)

  // Try exact match first
  const exactPath = sessionPath(slug)
  if (existsSync(exactPath)) {
    try {
      return JSON.parse(readFileSync(exactPath, 'utf-8'))
    } catch { return null }
  }

  // Try fuzzy match on ID or name
  const files = readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json'))
  for (const file of files) {
    const id = file.replace('.json', '')
    if (id.includes(slug) || id === idOrName) {
      try {
        return JSON.parse(readFileSync(join(SESSIONS_DIR, file), 'utf-8'))
      } catch { continue }
    }
  }

  // Try matching by name field
  for (const file of files) {
    try {
      const session: Session = JSON.parse(readFileSync(join(SESSIONS_DIR, file), 'utf-8'))
      if (session.name.toLowerCase().includes(idOrName.toLowerCase())) {
        return session
      }
    } catch { continue }
  }

  return null
}

/** List all saved sessions, newest first */
export function listSessions(): Session[] {
  ensureDir()
  const files = readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json'))

  const sessions: Session[] = []
  for (const file of files) {
    try {
      const session: Session = JSON.parse(readFileSync(join(SESSIONS_DIR, file), 'utf-8'))
      sessions.push(session)
    } catch { continue }
  }

  return sessions.sort((a, b) =>
    new Date(b.updated).getTime() - new Date(a.updated).getTime()
  )
}

/** Delete a session */
export function deleteSession(idOrName: string): boolean {
  const session = loadSession(idOrName)
  if (!session) return false
  const path = sessionPath(session.id)
  if (existsSync(path)) {
    unlinkSync(path)
    return true
  }
  return false
}

/** Update an existing session with current history */
export function updateSession(id: string, agent?: string): Session | null {
  const session = loadSession(id)
  if (!session) return null

  const history = getHistory()
  session.history = [...history]
  session.turnCount = history.length
  session.updated = new Date().toISOString()
  if (agent) session.agent = agent

  writeFileSync(sessionPath(session.id), JSON.stringify(session, null, 2))
  return session
}

/** Keep only the most recent MAX_SESSIONS sessions */
function pruneOldSessions(): void {
  const sessions = listSessions()
  if (sessions.length <= MAX_SESSIONS) return

  const toDelete = sessions.slice(MAX_SESSIONS)
  for (const session of toDelete) {
    const path = sessionPath(session.id)
    if (existsSync(path)) unlinkSync(path)
  }
}

/** Get the most recent session for auto-resume */
export function getLastSession(): Session | null {
  const sessions = listSessions()
  return sessions.length > 0 ? sessions[0] : null
}

/** Format session list for display */
export function formatSessionList(sessions: Session[]): string {
  if (sessions.length === 0) return '  No saved sessions.'

  const lines: string[] = []
  for (const s of sessions.slice(0, 15)) {
    const date = new Date(s.updated).toLocaleDateString()
    const turns = `${s.turnCount} turns`
    const preview = s.preview.slice(0, 50) + (s.preview.length > 50 ? '...' : '')
    lines.push(`  ${s.id}  ${date}  ${turns}  "${preview}"`)
  }

  if (sessions.length > 15) {
    lines.push(`  ... and ${sessions.length - 15} more`)
  }

  return lines.join('\n')
}
