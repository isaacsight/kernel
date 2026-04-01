// kbot Dream Engine — In-Process Memory Consolidation
//
// Inspired by Claude Code's autoDream system, but built kbot's way:
//   - Uses local Ollama models ($0 cost) instead of cloud API
//   - Runs post-session or on-demand via `kbot dream`
//   - Ages memories with exponential decay scoring
//   - Extracts cross-session insights ("dreams")
//   - Produces a dream journal that feeds back into system prompts
//
// The metaphor: after a session, kbot "sleeps" — consolidating short-term
// session history into long-term durable insights, just like biological memory.
//
// Storage: ~/.kbot/memory/dreams/
//   - journal.json   — consolidated insights (the "dream journal")
//   - state.json     — last dream timestamp, cycle count, stats
//   - archive/       — old dreams that aged out (kept for archaeology)

import { homedir } from 'node:os'
import { join } from 'node:path'
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, renameSync } from 'node:fs'
import { getHistory, type ConversationTurn } from './memory.js'
import { loadMemory } from './memory.js'

// ── Constants ──

const DREAM_DIR = join(homedir(), '.kbot', 'memory', 'dreams')
const JOURNAL_FILE = join(DREAM_DIR, 'journal.json')
const STATE_FILE = join(DREAM_DIR, 'state.json')
const ARCHIVE_DIR = join(DREAM_DIR, 'archive')

const MAX_INSIGHTS = 100         // Keep top 100 insights
const DECAY_RATE = 0.03          // ~3% relevance loss per day
const MIN_RELEVANCE = 0.15       // Below this → archive
const CONSOLIDATION_MODEL = 'kernel:latest'  // Local Ollama model
const OLLAMA_URL = 'http://localhost:11434'
const OLLAMA_TIMEOUT = 60_000    // 60s per generation

// ── Types ──

export interface DreamInsight {
  /** Unique ID */
  id: string
  /** The consolidated insight */
  content: string
  /** Category: pattern | preference | skill | project | relationship */
  category: DreamCategory
  /** Keywords for retrieval */
  keywords: string[]
  /** Relevance score (0-1), decays over time */
  relevance: number
  /** How many sessions contributed to this insight */
  sessions: number
  /** Created timestamp */
  created: string
  /** Last reinforced (refreshed relevance) */
  lastReinforced: string
  /** Source: which sessions/topics generated this */
  source: string
}

export type DreamCategory = 'pattern' | 'preference' | 'skill' | 'project' | 'relationship'

export interface DreamState {
  /** Total dream cycles completed */
  cycles: number
  /** Last dream timestamp */
  lastDream: string | null
  /** Total insights ever created */
  totalInsights: number
  /** Total insights archived (aged out) */
  totalArchived: number
  /** Insights currently active */
  activeInsights: number
  /** Last session turn count that was dreamed about */
  lastSessionTurns: number
}

// ── Helpers ──

function ensureDirs(): void {
  for (const dir of [DREAM_DIR, ARCHIVE_DIR]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  }
}

function loadJournal(): DreamInsight[] {
  ensureDirs()
  if (!existsSync(JOURNAL_FILE)) return []
  try { return JSON.parse(readFileSync(JOURNAL_FILE, 'utf-8')) } catch { return [] }
}

function saveJournal(insights: DreamInsight[]): void {
  ensureDirs()
  writeFileSync(JOURNAL_FILE, JSON.stringify(insights, null, 2))
}

function loadState(): DreamState {
  ensureDirs()
  const defaults: DreamState = {
    cycles: 0, lastDream: null, totalInsights: 0,
    totalArchived: 0, activeInsights: 0, lastSessionTurns: 0,
  }
  if (!existsSync(STATE_FILE)) return defaults
  try { return { ...defaults, ...JSON.parse(readFileSync(STATE_FILE, 'utf-8')) } } catch { return defaults }
}

function saveState(state: DreamState): void {
  ensureDirs()
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
}

function generateId(): string {
  return `dream_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/** Calculate days between two ISO dates */
function daysBetween(a: string, b: string): number {
  return Math.abs(new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24)
}

// ── Ollama Integration ──

async function ollamaGenerate(prompt: string, model = CONSOLIDATION_MODEL): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT)

    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: { temperature: 0.3, num_predict: 512 },
      }),
      signal: controller.signal,
    })

    clearTimeout(timer)
    if (!res.ok) return null

    const data = await res.json() as { response?: string }
    return data.response?.trim() || null
  } catch {
    return null
  }
}

async function isOllamaAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(3000) })
    return res.ok
  } catch {
    return false
  }
}

// ── Memory Aging ──

/** Apply exponential decay to all insights based on time elapsed */
export function ageMemories(insights: DreamInsight[]): { aged: DreamInsight[]; archived: DreamInsight[] } {
  const now = new Date().toISOString()
  const aged: DreamInsight[] = []
  const archived: DreamInsight[] = []

  for (const insight of insights) {
    const days = daysBetween(insight.lastReinforced, now)
    // Exponential decay: relevance * e^(-rate * days)
    const decayed = insight.relevance * Math.exp(-DECAY_RATE * days)

    if (decayed < MIN_RELEVANCE) {
      archived.push({ ...insight, relevance: decayed })
    } else {
      aged.push({ ...insight, relevance: Math.round(decayed * 1000) / 1000 })
    }
  }

  return { aged, archived }
}

/** Archive old insights to disk */
function archiveInsights(insights: DreamInsight[]): void {
  if (insights.length === 0) return
  ensureDirs()
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const archivePath = join(ARCHIVE_DIR, `archived_${timestamp}.json`)
  writeFileSync(archivePath, JSON.stringify(insights, null, 2))
}

// ── Consolidation Prompts ──

function buildConsolidationPrompt(
  sessionHistory: ConversationTurn[],
  existingInsights: DreamInsight[],
  existingMemory: string,
): string {
  const historyText = sessionHistory
    .map(t => `[${t.role}]: ${t.content.slice(0, 500)}`)
    .join('\n')

  const existingText = existingInsights.length > 0
    ? existingInsights.slice(0, 20).map(i => `- [${i.category}] ${i.content}`).join('\n')
    : '(none yet)'

  return `You are a memory consolidation system. Analyze this conversation session and extract durable insights.

EXISTING INSIGHTS:
${existingText}

EXISTING PERSISTENT MEMORY:
${existingMemory.slice(0, 2000) || '(empty)'}

SESSION TO CONSOLIDATE:
${historyText}

INSTRUCTIONS:
Extract 1-5 insights from this session. Each insight should be:
- Durable (useful beyond this session)
- Non-obvious (not derivable from reading code)
- About the USER, their preferences, patterns, or project context

Format each insight as a JSON array of objects:
[
  {
    "content": "the insight text",
    "category": "pattern|preference|skill|project|relationship",
    "keywords": ["keyword1", "keyword2"]
  }
]

If the session is too short or trivial for insights, return: []

Respond ONLY with the JSON array, no other text.`
}

function buildReinforcePrompt(
  sessionHistory: ConversationTurn[],
  existingInsights: DreamInsight[],
): string {
  const historyText = sessionHistory
    .map(t => `[${t.role}]: ${t.content.slice(0, 300)}`)
    .join('\n')

  const insightList = existingInsights
    .map((i, idx) => `${idx}: [${i.category}] ${i.content}`)
    .join('\n')

  return `You are a memory reinforcement system. Given this conversation, which existing insights are confirmed/relevant?

EXISTING INSIGHTS (by index):
${insightList}

SESSION:
${historyText}

Return a JSON array of insight indices that this session reinforces. Example: [0, 3, 7]
If none are reinforced, return: []

Respond ONLY with the JSON array.`
}

// ── Core Dream Functions ──

/** Run a full dream cycle — consolidate, reinforce, age */
export async function dream(sessionId = 'default'): Promise<DreamResult> {
  const result: DreamResult = {
    success: false,
    newInsights: 0,
    reinforced: 0,
    archived: 0,
    cycle: 0,
    duration: 0,
    error: null,
  }

  const start = Date.now()

  // Check Ollama availability
  if (!(await isOllamaAvailable())) {
    // Fallback: still do aging even without Ollama
    const journal = loadJournal()
    if (journal.length > 0) {
      const { aged, archived } = ageMemories(journal)
      archiveInsights(archived)
      saveJournal(aged)
      result.archived = archived.length
    }
    result.error = 'Ollama not available — aging only (no new consolidation)'
    result.duration = Date.now() - start
    return result
  }

  const state = loadState()
  let journal = loadJournal()
  const history = getHistory(sessionId)
  const memory = loadMemory()

  // Skip if session too short
  if (history.length < 4) {
    result.error = 'Session too short for consolidation (< 4 turns)'
    result.duration = Date.now() - start
    return result
  }

  // Phase 1: Age existing memories
  const { aged, archived } = ageMemories(journal)
  archiveInsights(archived)
  journal = aged
  result.archived = archived.length

  // Phase 2: Extract new insights from session
  const consolidationPrompt = buildConsolidationPrompt(history, journal, memory)
  const rawInsights = await ollamaGenerate(consolidationPrompt)

  if (rawInsights) {
    try {
      const parsed = JSON.parse(rawInsights) as Array<{
        content: string
        category: DreamCategory
        keywords: string[]
      }>

      if (Array.isArray(parsed)) {
        const now = new Date().toISOString()
        for (const p of parsed.slice(0, 5)) {
          // Dedup: skip if very similar content exists
          const isDupe = journal.some(j =>
            j.content.toLowerCase().includes(p.content.toLowerCase().slice(0, 50)) ||
            p.content.toLowerCase().includes(j.content.toLowerCase().slice(0, 50))
          )
          if (isDupe) continue

          journal.push({
            id: generateId(),
            content: p.content,
            category: p.category || 'pattern',
            keywords: p.keywords || [],
            relevance: 0.9,
            sessions: 1,
            created: now,
            lastReinforced: now,
            source: `session_${state.cycles + 1}`,
          })
          result.newInsights++
        }
      }
    } catch {
      // JSON parse failed — Ollama output wasn't clean
    }
  }

  // Phase 3: Reinforce existing insights mentioned in session
  if (journal.length > 0 && history.length >= 4) {
    const reinforcePrompt = buildReinforcePrompt(history, journal)
    const rawReinforce = await ollamaGenerate(reinforcePrompt)

    if (rawReinforce) {
      try {
        const indices = JSON.parse(rawReinforce) as number[]
        if (Array.isArray(indices)) {
          const now = new Date().toISOString()
          for (const idx of indices) {
            if (idx >= 0 && idx < journal.length) {
              journal[idx].relevance = Math.min(1, journal[idx].relevance + 0.15)
              journal[idx].sessions++
              journal[idx].lastReinforced = now
              result.reinforced++
            }
          }
        }
      } catch {
        // Reinforcement parse failed — non-critical
      }
    }
  }

  // Phase 4: Sort by relevance, trim to max
  journal.sort((a, b) => b.relevance - a.relevance)
  if (journal.length > MAX_INSIGHTS) {
    const overflow = journal.slice(MAX_INSIGHTS)
    archiveInsights(overflow)
    journal = journal.slice(0, MAX_INSIGHTS)
    result.archived += overflow.length
  }

  // Save everything
  saveJournal(journal)

  state.cycles++
  state.lastDream = new Date().toISOString()
  state.totalInsights += result.newInsights
  state.totalArchived += result.archived
  state.activeInsights = journal.length
  state.lastSessionTurns = history.length
  saveState(state)

  result.success = true
  result.cycle = state.cycles
  result.duration = Date.now() - start
  return result
}

export interface DreamResult {
  success: boolean
  newInsights: number
  reinforced: number
  archived: number
  cycle: number
  duration: number
  error: string | null
}

// ── Query Functions ──

/** Get dream insights for inclusion in system prompt */
export function getDreamPrompt(maxInsights = 10): string {
  const journal = loadJournal()
  if (journal.length === 0) return ''

  const top = journal
    .filter(i => i.relevance > 0.3)
    .slice(0, maxInsights)

  if (top.length === 0) return ''

  const lines = top.map(i =>
    `- [${i.category}] ${i.content} (relevance: ${Math.round(i.relevance * 100)}%)`
  )

  return `\n[Dream Journal — Consolidated Insights]\n${lines.join('\n')}\n`
}

/** Get full dream status */
export function getDreamStatus(): { state: DreamState; insights: DreamInsight[]; archiveCount: number } {
  const state = loadState()
  const insights = loadJournal()

  let archiveCount = 0
  if (existsSync(ARCHIVE_DIR)) {
    archiveCount = readdirSync(ARCHIVE_DIR).filter(f => f.endsWith('.json')).length
  }

  return { state, insights, archiveCount }
}

/** Search dream insights by keyword */
export function searchDreams(query: string): DreamInsight[] {
  const journal = loadJournal()
  const terms = query.toLowerCase().split(/\s+/)

  return journal
    .filter(i => {
      const text = `${i.content} ${i.keywords.join(' ')} ${i.category}`.toLowerCase()
      return terms.some(t => text.includes(t))
    })
    .sort((a, b) => b.relevance - a.relevance)
}

/** Manually reinforce a specific insight (user confirms it's still relevant) */
export function reinforceInsight(insightId: string): boolean {
  const journal = loadJournal()
  const insight = journal.find(i => i.id === insightId)
  if (!insight) return false

  insight.relevance = Math.min(1, insight.relevance + 0.2)
  insight.lastReinforced = new Date().toISOString()
  insight.sessions++
  saveJournal(journal)
  return true
}

/** Run dream after session ends (non-blocking) */
export function dreamAfterSession(sessionId = 'default'): void {
  // Fire and forget — don't block the user
  dream(sessionId).catch(() => {
    // Dream failed silently — non-critical
  })
}
