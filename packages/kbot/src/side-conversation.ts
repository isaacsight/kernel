// kbot Side Conversations — /btw tangent system
//
// Start a tangent without losing main context.
// Saves current conversation context to a stack, starts fresh
// for the side topic. When done, pops the side conversation
// and restores main context.
//
// Storage: ~/.kbot/side-conversations/

import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  existsSync, readFileSync, writeFileSync, mkdirSync,
  readdirSync, rmSync,
} from 'node:fs'
import { getHistory, clearHistory, restoreHistory, type ConversationTurn } from './memory.js'

const SIDE_DIR = join(homedir(), '.kbot', 'side-conversations')
const STACK_FILE = join(SIDE_DIR, 'stack.json')

/** A side conversation record */
export interface SideConversation {
  /** Unique side conversation ID */
  id: string
  /** Topic of the side conversation */
  topic: string
  /** When it was started */
  started_at: string
  /** When it was ended (null if still active) */
  ended_at: string | null
  /** The saved main context history at the time of branching */
  main_context: ConversationTurn[]
  /** The side conversation's own history */
  side_history: ConversationTurn[]
  /** Summary/findings from the side conversation */
  findings: string[]
  /** Whether the side conversation is still active */
  active: boolean
}

/** Stack of side conversations — supports nesting */
interface SideStack {
  /** Ordered list of active side conversation IDs (most recent last) */
  active_ids: string[]
}

function ensureDir(): void {
  if (!existsSync(SIDE_DIR)) mkdirSync(SIDE_DIR, { recursive: true })
}

function generateSideId(): string {
  const now = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 6)
  return `side-${now}-${rand}`
}

function loadStack(): SideStack {
  ensureDir()
  if (!existsSync(STACK_FILE)) return { active_ids: [] }
  try {
    return JSON.parse(readFileSync(STACK_FILE, 'utf-8'))
  } catch {
    return { active_ids: [] }
  }
}

function saveStack(stack: SideStack): void {
  ensureDir()
  writeFileSync(STACK_FILE, JSON.stringify(stack, null, 2))
}

function sideConvoPath(id: string): string {
  return join(SIDE_DIR, `${id}.json`)
}

function loadSideConvo(id: string): SideConversation | null {
  const path = sideConvoPath(id)
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf-8'))
  } catch {
    return null
  }
}

function saveSideConvo(convo: SideConversation): void {
  ensureDir()
  writeFileSync(sideConvoPath(convo.id), JSON.stringify(convo, null, 2))
}

/**
 * Start a side conversation.
 * Saves current conversation context to a stack, starts fresh
 * context for the side topic.
 */
export function startSideConversation(topic: string): {
  side_id: string
  main_context_preserved: boolean
} {
  ensureDir()

  const id = generateSideId()
  const currentHistory = getHistory()

  // Create the side conversation record
  const convo: SideConversation = {
    id,
    topic,
    started_at: new Date().toISOString(),
    ended_at: null,
    main_context: [...currentHistory],
    side_history: [],
    findings: [],
    active: true,
  }

  saveSideConvo(convo)

  // Push onto the stack
  const stack = loadStack()
  stack.active_ids.push(id)
  saveStack(stack)

  // Clear the current history to start fresh for the side topic
  clearHistory()

  return {
    side_id: id,
    main_context_preserved: true,
  }
}

/**
 * End a side conversation.
 * Pops the side conversation from the stack, restores main context.
 * Extracts useful findings from the side convo to merge into main.
 */
export function endSideConversation(sideId: string): {
  restored: boolean
  findings_merged: number
} {
  const convo = loadSideConvo(sideId)
  if (!convo) {
    throw new Error(`Side conversation "${sideId}" not found`)
  }

  if (!convo.active) {
    throw new Error(`Side conversation "${sideId}" is already ended`)
  }

  // Capture the side conversation's history before restoring
  const sideHistory = getHistory()
  convo.side_history = [...sideHistory]
  convo.ended_at = new Date().toISOString()
  convo.active = false

  // Extract findings from the side conversation
  const findings = extractFindings(sideHistory)
  convo.findings = findings
  saveSideConvo(convo)

  // Remove from the active stack
  const stack = loadStack()
  stack.active_ids = stack.active_ids.filter(id => id !== sideId)
  saveStack(stack)

  // Restore the main context
  restoreHistory(convo.main_context)

  return {
    restored: true,
    findings_merged: findings.length,
  }
}

/**
 * List all side conversations (active and completed).
 */
export function listSideConversations(): SideConversation[] {
  ensureDir()
  const files = readdirSync(SIDE_DIR).filter(f => f.startsWith('side-') && f.endsWith('.json'))
  const conversations: SideConversation[] = []

  for (const file of files) {
    try {
      const convo: SideConversation = JSON.parse(
        readFileSync(join(SIDE_DIR, file), 'utf-8'),
      )
      conversations.push(convo)
    } catch {
      continue
    }
  }

  return conversations.sort((a, b) =>
    new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
  )
}

/**
 * Get the result/summary of a completed side conversation.
 */
export function getSideConversationResult(sideId: string): {
  id: string
  topic: string
  findings: string[]
  turn_count: number
  duration_ms: number
} | null {
  const convo = loadSideConvo(sideId)
  if (!convo) return null

  const startTime = new Date(convo.started_at).getTime()
  const endTime = convo.ended_at
    ? new Date(convo.ended_at).getTime()
    : Date.now()

  return {
    id: convo.id,
    topic: convo.topic,
    findings: convo.findings,
    turn_count: convo.side_history.length,
    duration_ms: endTime - startTime,
  }
}

/**
 * Extract useful findings from a side conversation's history.
 * Looks for conclusions, code snippets, decisions, and answers.
 */
function extractFindings(history: ConversationTurn[]): string[] {
  const findings: string[] = []

  for (const turn of history) {
    if (turn.role !== 'assistant') continue

    const lines = turn.content.split('\n')
    for (const line of lines) {
      const trimmed = line.trim()

      // Look for conclusion markers
      if (
        trimmed.startsWith('In summary') ||
        trimmed.startsWith('The answer') ||
        trimmed.startsWith('Solution:') ||
        trimmed.startsWith('Result:') ||
        trimmed.startsWith('Found:') ||
        trimmed.startsWith('TL;DR') ||
        trimmed.startsWith('Key takeaway') ||
        trimmed.startsWith('The fix')
      ) {
        findings.push(trimmed.slice(0, 200))
      }

      // Look for decision markers
      if (
        trimmed.startsWith('I recommend') ||
        trimmed.startsWith('The best approach') ||
        trimmed.startsWith('You should use') ||
        trimmed.startsWith('The issue was')
      ) {
        findings.push(trimmed.slice(0, 200))
      }
    }
  }

  // If no explicit findings, take the last assistant message as a summary
  if (findings.length === 0) {
    const lastAssistant = history.filter(t => t.role === 'assistant').pop()
    if (lastAssistant) {
      const firstLine = lastAssistant.content.split('\n')[0].trim()
      if (firstLine) {
        findings.push(firstLine.slice(0, 200))
      }
    }
  }

  // Deduplicate
  return [...new Set(findings)]
}

/**
 * Clean up old completed side conversations.
 * Keeps only the most recent N completed conversations.
 */
export function pruneOldSideConversations(keepCount: number = 20): number {
  const all = listSideConversations()
  const completed = all.filter(c => !c.active)

  if (completed.length <= keepCount) return 0

  const toRemove = completed.slice(keepCount)
  let removed = 0

  for (const convo of toRemove) {
    const path = sideConvoPath(convo.id)
    if (existsSync(path)) {
      rmSync(path)
      removed++
    }
  }

  return removed
}
