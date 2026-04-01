// kbot Memory Scanner — Passive In-Session Memory Detection
//
// The dream engine consolidates AFTER sessions end. This fills the gap:
// a passive scanner that watches conversation turns DURING a session and
// detects "memory-worthy" moments in real time.
//
// How it works:
//   1. Hook into addTurn() from memory.ts — observe every turn
//   2. After every N turns (default 5), scan the recent window
//   3. Use keyword + context windows (NOT regex sentiment — we're better than that)
//   4. When a memory-worthy moment is found, auto-save via the memory_save tool
//   5. Debounce and dedup to avoid noise
//
// Detection categories:
//   - Corrections:   "no, I meant...", "actually...", "don't do that"
//   - Preferences:   "I prefer...", "always use...", "never..."
//   - Project facts:  "the deadline is...", "we're using...", "the API key is in..."
//   - Emotional:      "this is frustrating", "perfect!", "exactly what I wanted"
//
// Storage: Scanner state persists to ~/.kbot/memory/scanner-state.json
// Memories saved via the memory_save tool (same as agent-initiated saves)

import { homedir } from 'node:os'
import { join } from 'node:path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { getHistory, type ConversationTurn } from './memory.js'

// ── Constants ──

const SCANNER_STATE_FILE = join(homedir(), '.kbot', 'memory', 'scanner-state.json')
const SCAN_INTERVAL = 5           // Scan every N turns
const CONTEXT_WINDOW = 6          // Look at the last N turns when scanning
const DEDUP_WINDOW_MS = 300_000   // 5 min — don't save duplicate memories within this window
const MAX_MEMORIES_PER_SESSION = 20 // Safety cap — don't flood memory store

// ── Types ──

export type MemorySignalKind = 'correction' | 'preference' | 'project_fact' | 'emotional'

export interface DetectedMemory {
  /** What kind of signal was detected */
  kind: MemorySignalKind
  /** The extracted memory content to save */
  content: string
  /** The key to use for memory_save */
  key: string
  /** Category for memory_save (fact | preference | pattern | solution) */
  category: 'fact' | 'preference' | 'pattern' | 'solution'
  /** Confidence score (0-1) */
  confidence: number
  /** Which turn triggered the detection */
  turnIndex: number
  /** Timestamp of detection */
  detectedAt: string
}

export interface ScannerStats {
  /** Whether the scanner is currently active */
  enabled: boolean
  /** Total turns observed this session */
  turnsObserved: number
  /** Total scans performed */
  scansPerformed: number
  /** Total moments detected */
  momentsDetected: number
  /** Total memories saved */
  memoriesSaved: number
  /** Breakdown by kind */
  byKind: Record<MemorySignalKind, number>
  /** Recent detections (last 10) */
  recentDetections: DetectedMemory[]
  /** Session start time */
  sessionStart: string
}

interface ScannerState {
  /** Cumulative stats across sessions */
  totalScans: number
  totalDetections: number
  totalSaved: number
  /** Last scan timestamp */
  lastScan: string | null
  /** Per-kind cumulative counts */
  cumulativeByKind: Record<MemorySignalKind, number>
}

// ── Signal Patterns ──
// Each pattern group defines keywords and context validators.
// Context validators look at surrounding turns to confirm the signal is real.

interface SignalPattern {
  /** Keywords that trigger a closer look (must appear in user message) */
  triggers: string[]
  /** Additional context validators — at least one must pass */
  validators: Array<(turn: ConversationTurn, context: ConversationTurn[]) => string | null>
  /** The memory signal kind this pattern detects */
  kind: MemorySignalKind
  /** The memory category to save as */
  category: 'fact' | 'preference' | 'pattern' | 'solution'
}

// Correction signals — user is fixing a misunderstanding
const CORRECTION_PATTERNS: SignalPattern = {
  triggers: [
    'no, i meant', 'no i meant', 'actually,', 'actually ', "that's not what i",
    "don't do that", 'dont do that', 'not what i asked', 'i said',
    'what i meant was', 'let me clarify', 'to clarify', 'i was referring to',
    'you misunderstood', 'that\'s not right', "that's wrong", 'incorrect',
    'no, use', 'no, it should', 'wrong approach', 'not like that',
    'i meant', 'what i want is', 'stop doing',
  ],
  validators: [
    // Validator: correction follows an assistant message (there's something to correct)
    (_turn, context) => {
      const prevAssistant = [...context].reverse().find(t => t.role === 'assistant')
      if (!prevAssistant) return null
      return 'correction after assistant response'
    },
  ],
  kind: 'correction',
  category: 'pattern',
}

// Preference signals — user states how they like things done
const PREFERENCE_PATTERNS: SignalPattern = {
  triggers: [
    'i prefer', 'i always', 'i never', 'always use', 'never use',
    'i like to', "i don't like", 'i dont like', 'my preference is',
    'i usually', 'i tend to', 'please always', 'please never',
    'from now on', 'going forward', "let's stick with", 'lets stick with',
    'i want you to always', 'i want you to never', 'keep using',
    'stop using', 'switch to', 'use this instead', 'my style is',
    'the way i like it', 'my convention is',
  ],
  validators: [
    // Validator: message is long enough to contain a real preference (not just "I prefer")
    (turn) => {
      const words = turn.content.trim().split(/\s+/)
      if (words.length >= 5) return 'substantive preference statement'
      return null
    },
  ],
  kind: 'preference',
  category: 'preference',
}

// Project fact signals — user shares project context
const PROJECT_FACT_PATTERNS: SignalPattern = {
  triggers: [
    'the deadline is', 'deadline is', 'due date is', 'due by',
    "we're using", 'we are using', "we're running", 'we use',
    'the api key is in', 'api key is stored', 'credentials are in',
    'the database is', 'our database', 'the repo is', 'our repo',
    'the stack is', 'our stack', 'tech stack is',
    'we deploy to', 'deployed on', 'hosted on', 'runs on',
    'the config is', 'config file is', 'settings are in',
    'the port is', 'it runs on port', 'the endpoint is',
    'the team uses', 'our team', 'my team',
    'the project is', 'this project', 'the codebase',
    'the convention is', 'our convention', 'the rule is',
    'we follow', 'the standard is', 'our standard',
    'the branch is', 'main branch is', 'we branch from',
  ],
  validators: [
    // Validator: contains specific details (numbers, paths, names)
    (turn) => {
      const content = turn.content
      // Check for specifics: paths, URLs, versions, port numbers, dates
      const hasSpecifics = /(?:\/[\w.-]+\/|https?:\/\/|v?\d+\.\d+|port\s+\d+|\d{4}-\d{2})/i.test(content)
      if (hasSpecifics) return 'contains specific project details'
      // Check for substantial content (at least a sentence)
      if (content.trim().split(/\s+/).length >= 8) return 'substantive project statement'
      return null
    },
  ],
  kind: 'project_fact',
  category: 'fact',
}

// Emotional signals — user's satisfaction/frustration
const EMOTIONAL_PATTERNS: SignalPattern = {
  triggers: [
    'this is frustrating', 'so frustrating', 'ugh', 'annoying',
    'perfect!', 'exactly what i wanted', 'exactly right', 'exactly!',
    'love it', 'great job', 'well done', 'nice work', 'nailed it',
    'this is amazing', 'this is terrible', 'this sucks', 'hate this',
    'finally!', 'thank god', 'thank you!', 'thanks!',
    'this is exactly', "that's exactly", "that's perfect",
    'much better', 'way better', 'huge improvement',
    'this keeps happening', 'same issue again', 'broken again',
  ],
  validators: [
    // Validator: emotional signals are only worth saving if they contain
    // actionable context (what was good/bad)
    (turn, context) => {
      // Positive signal after assistant response = something worked well
      const prevAssistant = [...context].reverse().find(t => t.role === 'assistant')
      if (prevAssistant) return 'emotional reaction to assistant output'
      return null
    },
  ],
  kind: 'emotional',
  category: 'pattern',
}

const ALL_PATTERNS: SignalPattern[] = [
  CORRECTION_PATTERNS,
  PREFERENCE_PATTERNS,
  PROJECT_FACT_PATTERNS,
  EMOTIONAL_PATTERNS,
]

// ── Scanner State ──

let enabled = true
let turnsObserved = 0
let scansPerformed = 0
let momentsDetected = 0
let memoriesSaved = 0
let sessionStart = new Date().toISOString()
const byKind: Record<MemorySignalKind, number> = {
  correction: 0,
  preference: 0,
  project_fact: 0,
  emotional: 0,
}
const recentDetections: DetectedMemory[] = []
const recentSavedKeys = new Map<string, number>() // key → timestamp, for dedup
let turnCountSinceLastScan = 0
let hooked = false

// ── Persistent State ──

function ensureDir(): void {
  const dir = join(homedir(), '.kbot', 'memory')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function loadScannerState(): ScannerState {
  ensureDir()
  const defaults: ScannerState = {
    totalScans: 0,
    totalDetections: 0,
    totalSaved: 0,
    lastScan: null,
    cumulativeByKind: { correction: 0, preference: 0, project_fact: 0, emotional: 0 },
  }
  if (!existsSync(SCANNER_STATE_FILE)) return defaults
  try {
    return { ...defaults, ...JSON.parse(readFileSync(SCANNER_STATE_FILE, 'utf-8')) }
  } catch {
    return defaults
  }
}

function saveScannerState(): void {
  ensureDir()
  const state = loadScannerState()
  state.totalScans += scansPerformed
  state.totalDetections += momentsDetected
  state.totalSaved += memoriesSaved
  state.lastScan = new Date().toISOString()
  for (const kind of Object.keys(byKind) as MemorySignalKind[]) {
    state.cumulativeByKind[kind] = (state.cumulativeByKind[kind] || 0) + byKind[kind]
  }
  try {
    writeFileSync(SCANNER_STATE_FILE, JSON.stringify(state, null, 2))
  } catch {
    // Non-critical — state can be rebuilt
  }
}

// ── Detection Engine ──

/** Extract a clean, saveable memory from a detected signal */
function extractMemoryContent(
  turn: ConversationTurn,
  context: ConversationTurn[],
  kind: MemorySignalKind,
): { content: string; key: string } {
  const userMsg = turn.content.trim()

  // For corrections, include what was corrected
  if (kind === 'correction') {
    const prevAssistant = [...context].reverse().find(t => t.role === 'assistant')
    const prevSnippet = prevAssistant ? prevAssistant.content.slice(0, 80) : ''
    const content = prevSnippet
      ? `User corrected: "${prevSnippet}..." → "${userMsg.slice(0, 200)}"`
      : `User correction: ${userMsg.slice(0, 250)}`
    const key = `correction-${slugify(userMsg.slice(0, 40))}`
    return { content, key }
  }

  // For preferences, capture the full preference statement
  if (kind === 'preference') {
    const content = `User preference: ${userMsg.slice(0, 300)}`
    const key = `pref-${slugify(userMsg.slice(0, 40))}`
    return { content, key }
  }

  // For project facts, capture the factual statement
  if (kind === 'project_fact') {
    const content = `Project fact: ${userMsg.slice(0, 300)}`
    const key = `fact-${slugify(userMsg.slice(0, 40))}`
    return { content, key }
  }

  // For emotional signals, note what provoked the reaction
  const prevAssistant = [...context].reverse().find(t => t.role === 'assistant')
  const prevSnippet = prevAssistant ? prevAssistant.content.slice(0, 100) : ''
  const sentiment = detectSentimentDirection(userMsg)
  const content = prevSnippet
    ? `User ${sentiment} reaction to: "${prevSnippet}..." — "${userMsg.slice(0, 150)}"`
    : `User ${sentiment} reaction: ${userMsg.slice(0, 200)}`
  const key = `emotion-${sentiment}-${slugify(userMsg.slice(0, 30))}`
  return { content, key }
}

/** Determine if the emotional signal is positive or negative */
function detectSentimentDirection(text: string): 'positive' | 'negative' {
  const lower = text.toLowerCase()
  const positiveWords = ['perfect', 'exactly', 'love', 'great', 'nice', 'nailed', 'amazing', 'better', 'improvement', 'finally', 'thank']
  const negativeWords = ['frustrating', 'annoying', 'terrible', 'sucks', 'hate', 'broken', 'ugh', 'same issue']

  let posScore = 0
  let negScore = 0
  for (const w of positiveWords) { if (lower.includes(w)) posScore++ }
  for (const w of negativeWords) { if (lower.includes(w)) negScore++ }

  return posScore >= negScore ? 'positive' : 'negative'
}

/** Create a filesystem-safe slug from text */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

/** Check if a key was recently saved (dedup within the window) */
function isRecentlySaved(key: string): boolean {
  const savedAt = recentSavedKeys.get(key)
  if (!savedAt) return false
  return (Date.now() - savedAt) < DEDUP_WINDOW_MS
}

/** Scan a window of conversation turns for memory-worthy signals */
function scanTurns(sessionId: string): DetectedMemory[] {
  const history = getHistory(sessionId)
  if (history.length < 2) return [] // Need at least one exchange

  // Look at the recent context window
  const windowStart = Math.max(0, history.length - CONTEXT_WINDOW)
  const window = history.slice(windowStart)
  const detected: DetectedMemory[] = []

  // Only scan user turns (assistant turns don't contain user memories)
  for (let i = 0; i < window.length; i++) {
    const turn = window[i]
    if (turn.role !== 'user') continue

    const lowerContent = turn.content.toLowerCase()

    for (const pattern of ALL_PATTERNS) {
      // Phase 1: Keyword trigger check — does the message contain any trigger phrase?
      const triggered = pattern.triggers.some(trigger => lowerContent.includes(trigger))
      if (!triggered) continue

      // Phase 2: Context validation — does the surrounding context confirm the signal?
      const contextBefore = window.slice(0, i)
      let validated = false

      for (const validator of pattern.validators) {
        const result = validator(turn, contextBefore)
        if (result !== null) {
          validated = true
          break
        }
      }

      if (!validated) continue

      // Phase 3: Extract memory content
      const { content, key } = extractMemoryContent(turn, contextBefore, pattern.kind)

      // Phase 4: Dedup — skip if we already saved this key recently
      if (isRecentlySaved(key)) continue

      // Phase 5: Confidence scoring
      // More triggers matched = higher confidence
      const triggerCount = pattern.triggers.filter(t => lowerContent.includes(t)).length
      const confidence = Math.min(0.5 + triggerCount * 0.15, 0.95)

      detected.push({
        kind: pattern.kind,
        content,
        key,
        category: pattern.category,
        confidence,
        turnIndex: windowStart + i,
        detectedAt: new Date().toISOString(),
      })
    }
  }

  return detected
}

// ── Memory Saving ──

/** Save a detected memory via the memory tool filesystem (bypasses tool execution) */
function saveDetectedMemory(memory: DetectedMemory): boolean {
  try {
    const memDir = join(homedir(), '.kbot', 'memory', memory.category)
    if (!existsSync(memDir)) mkdirSync(memDir, { recursive: true })

    const sanitizedKey = memory.key
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 128)

    const filePath = join(memDir, `${sanitizedKey}.json`)
    const now = new Date().toISOString()

    // Check if memory already exists — update instead of overwrite
    let existing: { created_at?: string; access_count?: number } | null = null
    if (existsSync(filePath)) {
      try {
        existing = JSON.parse(readFileSync(filePath, 'utf-8'))
      } catch {
        existing = null
      }
    }

    const entry = {
      key: sanitizedKey,
      content: memory.content,
      category: memory.category,
      created_at: existing?.created_at || now,
      modified_at: now,
      access_count: (existing?.access_count || 0) + 1,
      source: 'memory-scanner',
      signal_kind: memory.kind,
      confidence: memory.confidence,
    }

    writeFileSync(filePath, JSON.stringify(entry, null, 2))
    recentSavedKeys.set(memory.key, Date.now())
    return true
  } catch {
    return false
  }
}

// ── Turn Observer ──

/** Called after every addTurn — this is the scanner's heartbeat */
function onTurnAdded(turn: ConversationTurn, sessionId: string): void {
  if (!enabled) return

  turnsObserved++
  turnCountSinceLastScan++

  // Only scan on the interval
  if (turnCountSinceLastScan < SCAN_INTERVAL) return
  turnCountSinceLastScan = 0

  // Safety cap
  if (memoriesSaved >= MAX_MEMORIES_PER_SESSION) return

  // Run detection (synchronous — fast keyword matching, no I/O)
  const detected = scanTurns(sessionId)
  scansPerformed++

  for (const memory of detected) {
    momentsDetected++
    byKind[memory.kind]++

    // Save the memory
    const saved = saveDetectedMemory(memory)
    if (saved) {
      memoriesSaved++
      // Keep recent detections list bounded
      recentDetections.push(memory)
      if (recentDetections.length > 10) recentDetections.shift()
    }
  }
}

// ── Monkey-Patch Hook ──
//
// We wrap the original addTurn() to observe turns without modifying memory.ts.
// This is the same pattern used by learning.ts's async extraction.

/** Install the scanner hook on addTurn. Idempotent. */
function installHook(): void {
  if (hooked) return

  // We can't actually monkey-patch an imported function binding in ESM.
  // Instead, we expose a notifyTurn() function that the agent loop calls.
  // See: agent.ts calls addTurn() then notifyTurn() for scanner awareness.
  hooked = true
}

// ── Public API ──

/** Notify the scanner that a turn was added. Call after addTurn(). */
export function notifyTurn(turn: ConversationTurn, sessionId = 'default'): void {
  onTurnAdded(turn, sessionId)
}

/** Start the memory scanner for the current session */
export function startMemoryScanner(): void {
  enabled = true
  turnsObserved = 0
  scansPerformed = 0
  momentsDetected = 0
  memoriesSaved = 0
  turnCountSinceLastScan = 0
  sessionStart = new Date().toISOString()
  byKind.correction = 0
  byKind.preference = 0
  byKind.project_fact = 0
  byKind.emotional = 0
  recentDetections.length = 0
  recentSavedKeys.clear()
  installHook()
}

/** Stop the memory scanner and persist stats */
export function stopMemoryScanner(): void {
  if (memoriesSaved > 0 || scansPerformed > 0) {
    saveScannerState()
  }
  enabled = false
}

/** Get current scanner stats */
export function getMemoryScannerStats(): ScannerStats {
  return {
    enabled,
    turnsObserved,
    scansPerformed,
    momentsDetected,
    memoriesSaved,
    byKind: { ...byKind },
    recentDetections: [...recentDetections],
    sessionStart,
  }
}

/** Check if the scanner is currently enabled */
export function isScannerEnabled(): boolean {
  return enabled
}

/** Get cumulative stats from disk (across all sessions) */
export function getCumulativeScannerStats(): ScannerState {
  return loadScannerState()
}
