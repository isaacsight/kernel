// kbot Cache Warmth — Anthropic prompt cache TTL warning
//
// Anthropic's prompt cache has a 5-minute TTL. If the next API call lands
// after the cache expired, the user pays full input-token price instead
// of the cached price. This module tracks per-(model, prompt-hash) call
// timestamps and warns once per cold event.
//
// State persists at ~/.kbot/cache-warmth.json (atomic tmp+rename writes).

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import chalk from 'chalk'

/** Anthropic prompt cache TTL — 5 minutes */
export const CACHE_TTL_MS = 5 * 60 * 1000

/** State file location — overridable via KBOT_CACHE_WARMTH_PATH (test hook) */
function statePath(): string {
  return process.env.KBOT_CACHE_WARMTH_PATH || join(homedir(), '.kbot', 'cache-warmth.json')
}

/** Hash a system prompt to a short stable key */
export function hashPrompt(text: string): string {
  return createHash('md5').update(text).digest('hex').slice(0, 16)
}

interface WarmthState {
  /** key = `${model}::${promptHash}` → last-call epoch ms */
  lastCall: Record<string, number>
  /** Same key → set of "cold-event" markers we've already warned about
   *  (a cold-event marker is the prior lastCall ts when we detected cold) */
  warnedColdEvents: Record<string, number[]>
}

let cached: WarmthState | undefined

function emptyState(): WarmthState {
  return { lastCall: {}, warnedColdEvents: {} }
}

function loadState(): WarmthState {
  if (cached) return cached
  try {
    const path = statePath()
    if (!existsSync(path)) {
      cached = emptyState()
      return cached
    }
    const raw = readFileSync(path, 'utf8')
    const parsed = JSON.parse(raw) as Partial<WarmthState>
    cached = {
      lastCall: parsed.lastCall || {},
      warnedColdEvents: parsed.warnedColdEvents || {},
    }
    return cached
  } catch {
    cached = emptyState()
    return cached
  }
}

function saveState(state: WarmthState): void {
  try {
    const path = statePath()
    const dir = dirname(path)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    const tmp = `${path}.${process.pid}.tmp`
    writeFileSync(tmp, JSON.stringify(state), 'utf8')
    renameSync(tmp, path)
  } catch {
    // Non-fatal — state is best-effort
  }
}

/** Reset in-memory cache (test hook) */
export function _resetCacheWarmthCache(): void {
  cached = undefined
}

/** Build the composite key */
function key(model: string, promptHash: string): string {
  return `${model}::${promptHash}`
}

/** Record a successful API call's timestamp */
export function recordCacheCall(
  model: string,
  promptHash: string,
  now: number = Date.now(),
): void {
  const state = loadState()
  state.lastCall[key(model, promptHash)] = now
  saveState(state)
}

export interface CacheWarmthCheck {
  warm: boolean
  ageMs?: number
  estimatedExtraCostUSD?: number
  message?: string
}

/** Format ms as "Nm Ss" */
function formatAge(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}m ${s}s`
}

/**
 * Check whether the prompt cache is still warm for (model, promptHash).
 * Returns warm=true if no prior call OR within TTL. Returns warm=false
 * with a chalk.yellow message when cold AND we haven't warned for this
 * specific cold-event yet.
 *
 * @param costPerMTokInput USD per million input tokens (from auth.ts)
 * @param promptTokenEstimate rough token count (e.g. text.length / 4)
 */
export function checkCacheWarmth(
  model: string,
  promptHash: string,
  costPerMTokInput: number,
  promptTokenEstimate: number,
  now: number = Date.now(),
): CacheWarmthCheck {
  if (process.env.KBOT_CACHE_WARMTH_WARN === 'off') {
    return { warm: true }
  }

  const state = loadState()
  const k = key(model, promptHash)
  const last = state.lastCall[k]

  // First call ever for this (model, prompt) — cache wasn't expected to exist
  if (!last) return { warm: true }

  const ageMs = now - last
  if (ageMs <= CACHE_TTL_MS) {
    return { warm: true, ageMs }
  }

  // Cold — but only warn once per cold-event (keyed on the prior lastCall ts)
  const warned = state.warnedColdEvents[k] || []
  if (warned.includes(last)) {
    return { warm: false, ageMs }
  }

  // Cost estimate: cached reads are ~10% of full input price; the cold
  // call pays roughly 90% extra vs. the warm path it would have hit.
  // We report the full input cost as the "extra" — a conservative upper
  // bound that matches what the user actually pays for these tokens.
  const extraUSD = (costPerMTokInput * promptTokenEstimate) / 1_000_000

  // Persist that we've warned so subsequent calls in the same cold-event
  // (e.g. a tool loop) don't re-warn until a fresh warm window opens.
  warned.push(last)
  // Keep the list bounded
  if (warned.length > 32) warned.splice(0, warned.length - 32)
  state.warnedColdEvents[k] = warned
  saveState(state)

  const message = chalk.yellow(
    `[kbot] Anthropic prompt cache likely cold — last call was ${formatAge(ageMs)} ago (TTL is 5m). ` +
    `This call will pay full input price (~$${extraUSD.toFixed(2)} more). ` +
    `Run kbot doctor cache for tips.`,
  )

  return { warm: false, ageMs, estimatedExtraCostUSD: extraUSD, message }
}
