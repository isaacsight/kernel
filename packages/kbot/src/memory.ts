// K:BOT Memory — Persistent local memory across sessions
// Stored in ~/.kbot/memory/context.md
// Keeps track of accumulated knowledge about the user's projects

import { homedir } from 'node:os'
import { join } from 'node:path'
import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs'

const MEMORY_DIR = join(homedir(), '.kbot', 'memory')
const CONTEXT_FILE = join(MEMORY_DIR, 'context.md')
const MAX_MEMORY_SIZE = 50_000 // 50KB max — keeps token usage reasonable

function ensureMemoryDir(): void {
  if (!existsSync(MEMORY_DIR)) {
    mkdirSync(MEMORY_DIR, { recursive: true })
  }
}

/** Load memory context. Returns empty string if none exists. */
export function loadMemory(): string {
  ensureMemoryDir()
  if (!existsSync(CONTEXT_FILE)) return ''
  try {
    const content = readFileSync(CONTEXT_FILE, 'utf-8')
    // Truncate if too large (keep the most recent entries)
    if (content.length > MAX_MEMORY_SIZE) {
      const lines = content.split('\n')
      const truncated = lines.slice(-500).join('\n')
      writeFileSync(CONTEXT_FILE, truncated)
      return truncated
    }
    return content
  } catch {
    return ''
  }
}

/** Append a memory entry. Used by the agent to remember things. */
export function appendMemory(entry: string): void {
  ensureMemoryDir()
  const timestamp = new Date().toISOString().split('T')[0]
  appendFileSync(CONTEXT_FILE, `\n## ${timestamp}\n${entry}\n`)
}

/** Clear all memory */
export function clearMemory(): void {
  ensureMemoryDir()
  writeFileSync(CONTEXT_FILE, '# K:BOT Memory\n\nPersistent knowledge across sessions.\n')
}

/** Get memory for inclusion in system prompt */
export function getMemoryPrompt(): string {
  const memory = loadMemory()
  if (!memory.trim()) return ''
  return `\n[Persistent Memory]\n${memory}\n`
}

/** Conversation history for current session */
export interface ConversationTurn {
  role: 'user' | 'assistant'
  content: string
}

let sessionHistory: ConversationTurn[] = []

/** Add a turn to session history */
export function addTurn(turn: ConversationTurn): void {
  sessionHistory.push(turn)
  // Keep last 20 turns to control context size
  if (sessionHistory.length > 20) {
    sessionHistory = sessionHistory.slice(-20)
  }
}

/** Get session history */
export function getHistory(): ConversationTurn[] {
  return sessionHistory
}

/** Clear session history */
export function clearHistory(): void {
  sessionHistory = []
}

/** Get the previous_messages array for the API */
export function getPreviousMessages(): Array<{ role: string; content: string }> {
  // Send last 6 turns to keep token usage efficient
  return sessionHistory.slice(-6).map(t => ({ role: t.role, content: t.content }))
}
