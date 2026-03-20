// kbot Collective Learning — The Hive Mind
//
// 4,619 installs learning independently. This module connects them.
// Every kbot contributes anonymized signals. Every kbot benefits from all.
//
// What gets shared (anonymized):
//   - Tool sequences that solved task types (not code, not file contents)
//   - Agent routing accuracy per category
//   - Strategy outcomes (which approach works for which task type)
//
// What NEVER gets shared:
//   - Source code, file contents, API keys, user identity
//   - Project names, file paths, conversation content
//   - Anything from ~/.kbot/config.json
//
// The flywheel:
//   1 user   → learns from own sessions
//   100      → patterns stabilize, routing gets accurate
//   1,000    → kbot knows best tool sequence for most tasks before you ask
//   10,000   → collective intelligence no single user could build alone

import { homedir } from 'node:os'
import { join } from 'node:path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'

const ENGINE_URL = 'https://eoxxpyixdieprsxlpwcs.supabase.co/functions/v1/kbot-engine'
const KBOT_DIR = join(homedir(), '.kbot')
const COLLECTIVE_DIR = join(KBOT_DIR, 'collective')
const HINTS_FILE = join(COLLECTIVE_DIR, 'routing-hints.json')
const PATTERNS_FILE = join(COLLECTIVE_DIR, 'collective-patterns.json')
const OPT_FILE = join(COLLECTIVE_DIR, 'opt-in.json')

// ── Types ──

export interface RoutingSignal {
  message_hash: string        // SHA-256 of normalized message (no PII)
  message_category: string    // Task category: coding, debugging, research, etc.
  message_length: number      // Character count (no content)
  routed_agent: string        // Which agent handled it
  classifier_confidence: number // 0-1, how confident the router was
  was_rerouted: boolean       // Did the user override the routing?
  response_quality: number    // 0-1, from self-eval or implicit signals
  tool_sequence: string[]     // Tool names used (not args/results)
  strategy: string            // Strategy chosen by reasoning module
  source: 'kbot'              // Always 'kbot' for CLI
}

export interface CollectivePattern {
  type: 'routing_rule' | 'tool_sequence' | 'strategy_outcome'
  pattern: Record<string, unknown>
  confidence: number          // 0-1, aggregated across users
  sample_count: number        // How many signals contributed
  last_updated: string        // ISO timestamp
}

export interface RoutingHint {
  category: string
  best_agent: string
  confidence: number
  sample_count: number
  tool_sequence?: string[]
}

export interface OptInState {
  enabled: boolean
  opted_in_at: string | null
  total_signals_sent: number
  last_signal_at: string | null
}

// ── Opt-in Management ──

function ensureDir(): void {
  if (!existsSync(COLLECTIVE_DIR)) {
    mkdirSync(COLLECTIVE_DIR, { recursive: true })
  }
}

export function getOptInState(): OptInState {
  ensureDir()
  try {
    if (existsSync(OPT_FILE)) {
      return JSON.parse(readFileSync(OPT_FILE, 'utf-8'))
    }
  } catch { /* corrupt file */ }
  return { enabled: false, opted_in_at: null, total_signals_sent: 0, last_signal_at: null }
}

export function setOptIn(enabled: boolean): void {
  ensureDir()
  const state = getOptInState()
  state.enabled = enabled
  if (enabled && !state.opted_in_at) {
    state.opted_in_at = new Date().toISOString()
  }
  writeFileSync(OPT_FILE, JSON.stringify(state, null, 2))
}

export function isCollectiveEnabled(): boolean {
  return getOptInState().enabled
}

// ── Anonymization ──

/** Hash a message into a non-reversible identifier. No PII leaks. */
function hashMessage(message: string): string {
  const normalized = message.toLowerCase().trim().replace(/\s+/g, ' ')
  return createHash('sha256').update(normalized).digest('hex').slice(0, 16)
}

/** Strip anything that could be PII from a tool sequence */
function sanitizeToolSequence(tools: string[]): string[] {
  // Only keep tool names, strip any args or paths that might have leaked in
  return tools.map(t => t.replace(/[^a-z0-9_-]/gi, '').slice(0, 50)).filter(Boolean)
}

// ── Signal Sending ──

/** Send an anonymized routing signal to the collective */
export async function sendSignal(signal: RoutingSignal): Promise<boolean> {
  if (!isCollectiveEnabled()) return false

  try {
    const sanitized = {
      message_hash: hashMessage(signal.message_hash),
      message_category: signal.message_category,
      message_length: Math.min(signal.message_length, 10000), // Cap length
      routed_agent: signal.routed_agent,
      classifier_confidence: Math.round(signal.classifier_confidence * 100) / 100,
      was_rerouted: signal.was_rerouted,
      response_quality: Math.round(signal.response_quality * 100) / 100,
      tool_sequence: sanitizeToolSequence(signal.tool_sequence).slice(0, 20),
      strategy: signal.strategy?.slice(0, 50) || 'default',
      source: 'kbot',
    }

    const res = await fetch(`${ENGINE_URL}/collective`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'signal', ...sanitized }),
      signal: AbortSignal.timeout(5_000),
    })

    if (res.ok) {
      // Update local stats
      const state = getOptInState()
      state.total_signals_sent++
      state.last_signal_at = new Date().toISOString()
      writeFileSync(OPT_FILE, JSON.stringify(state, null, 2))
      return true
    }
    return false
  } catch {
    return false // Network errors are silent — never block the agent loop
  }
}

// ── Signal Queue (batch sending) ──

const signalQueue: RoutingSignal[] = []
let flushTimer: NodeJS.Timeout | null = null
const FLUSH_INTERVAL_MS = 10_000 // Batch signals every 10 seconds

/** Queue a signal for batch sending */
export function queueSignal(signal: RoutingSignal): void {
  if (!isCollectiveEnabled()) return
  signalQueue.push(signal)

  if (!flushTimer) {
    flushTimer = setTimeout(() => {
      flushSignals()
      flushTimer = null
    }, FLUSH_INTERVAL_MS)
    // Don't keep the process alive just for signal flushing
    if (flushTimer && typeof flushTimer === 'object' && 'unref' in flushTimer) {
      (flushTimer as NodeJS.Timeout).unref()
    }
  }
}

/** Flush all queued signals (call on exit) */
export async function flushSignals(): Promise<void> {
  if (signalQueue.length === 0) return
  const batch = signalQueue.splice(0, signalQueue.length)

  // Send each signal sequentially to avoid race condition on opt-in.json
  for (const s of batch) {
    await sendSignal(s).catch(() => {})
  }
}

// Register exit handlers to flush signals
process.on('beforeExit', () => { flushSignals().catch(() => {}) })
process.on('SIGINT', () => { flushSignals().catch(() => {}); process.exit(0) })
process.on('SIGTERM', () => { flushSignals().catch(() => {}); process.exit(0) })

// ── Pulling Collective Intelligence ──

/** Pull routing hints from the collective (proven patterns from all users) */
export async function pullCollectiveHints(): Promise<RoutingHint[]> {
  try {
    const res = await fetch(`${ENGINE_URL}/collective`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'hints' }),
      signal: AbortSignal.timeout(5_000),
    })

    if (!res.ok) return loadCachedHints()

    const { hints } = await res.json() as { hints: RoutingHint[] }
    if (hints && Array.isArray(hints) && hints.length > 0) {
      // Cache locally for offline use
      ensureDir()
      writeFileSync(HINTS_FILE, JSON.stringify(hints, null, 2))
      return hints
    }
    return loadCachedHints()
  } catch {
    return loadCachedHints() // Offline fallback
  }
}

/** Pull collective patterns (tool sequences, strategies) */
export async function pullCollectivePatterns(): Promise<CollectivePattern[]> {
  try {
    const res = await fetch(`${ENGINE_URL}/collective`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'patterns' }),
      signal: AbortSignal.timeout(5_000),
    })

    if (!res.ok) return loadCachedPatterns()

    const { patterns } = await res.json() as { patterns: CollectivePattern[] }
    if (patterns && Array.isArray(patterns) && patterns.length > 0) {
      ensureDir()
      writeFileSync(PATTERNS_FILE, JSON.stringify(patterns, null, 2))
      return patterns
    }
    return loadCachedPatterns()
  } catch {
    return loadCachedPatterns()
  }
}

/** Load cached hints (for offline use) */
function loadCachedHints(): RoutingHint[] {
  try {
    if (existsSync(HINTS_FILE)) {
      return JSON.parse(readFileSync(HINTS_FILE, 'utf-8'))
    }
  } catch { /* corrupt cache */ }
  return []
}

/** Load cached patterns (for offline use) */
function loadCachedPatterns(): CollectivePattern[] {
  try {
    if (existsSync(PATTERNS_FILE)) {
      return JSON.parse(readFileSync(PATTERNS_FILE, 'utf-8'))
    }
  } catch { /* corrupt cache */ }
  return []
}

// ── Integration Helpers ──

/** Get the best agent for a task category based on collective wisdom */
export function getCollectiveRecommendation(category: string): { agent: string; confidence: number } | null {
  const hints = loadCachedHints()
  const match = hints.find(h => h.category === category && h.confidence > 0.7 && h.sample_count > 50)
  if (match) {
    return { agent: match.best_agent, confidence: match.confidence }
  }
  return null
}

/** Get the best tool sequence for a task category based on collective wisdom */
export function getCollectiveToolSequence(category: string): string[] | null {
  const patterns = loadCachedPatterns()
  const match = patterns.find(p =>
    p.type === 'tool_sequence' &&
    (p.pattern as any).category === category &&
    p.confidence > 0.7 &&
    p.sample_count > 50
  )
  if (match && (match.pattern as any).tools) {
    return (match.pattern as any).tools as string[]
  }
  return null
}

/** Format collective stats for display */
export function getCollectiveStats(): string {
  const state = getOptInState()
  const hints = loadCachedHints()
  const patterns = loadCachedPatterns()

  if (!state.enabled) {
    return 'Collective learning: disabled. Run `kbot collective --enable` to join.'
  }

  return [
    `Collective learning: enabled`,
    `Signals sent: ${state.total_signals_sent}`,
    `Last signal: ${state.last_signal_at || 'never'}`,
    `Routing hints cached: ${hints.length}`,
    `Patterns cached: ${patterns.length}`,
  ].join('\n')
}
