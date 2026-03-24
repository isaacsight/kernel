// kbot Provider Fallback — Multi-level retry, failover, and load balancing
//
// Inspired by LiteLLM's fallback strategy. Three levels of resilience:
//   1. Retry — exponential backoff on same provider (1s, 2s, 4s)
//   2. Same-tier failover — try another provider at the same quality tier
//   3. Cross-tier fallback — degrade to a cheaper tier if all same-tier fail
//
// Health tracking per provider enables smart routing: prefer low-latency,
// high-reliability providers. The /dashboard command reads this data.

import type { ByokProvider } from './auth.js'
import { getMachineProfile } from './machine.js'

// ── Tier definitions ──

export const TIERS = {
  premium:  ['anthropic', 'openai', 'google', 'xai'] as ByokProvider[],
  standard: ['mistral', 'deepseek', 'cohere', 'perplexity', 'openrouter'] as ByokProvider[],
  fast:     ['groq', 'together', 'fireworks', 'sambanova', 'cerebras', 'nvidia'] as ByokProvider[],
  local:    ['ollama', 'lmstudio', 'jan', 'kbot-local'] as ByokProvider[],
} as const

export type Tier = keyof typeof TIERS

/** Tier degradation order — premium → standard → fast → local */
const TIER_ORDER: Tier[] = ['premium', 'standard', 'fast', 'local']

// ── Health tracking ──

export interface ProviderHealth {
  provider: ByokProvider
  consecutiveFailures: number
  lastFailure: number | null
  lastSuccess: number | null
  avgLatencyMs: number
  isHealthy: boolean // false if >3 consecutive failures in last 5 min
}

/** Internal mutable health record */
interface HealthRecord {
  consecutiveFailures: number
  lastFailure: number | null
  lastSuccess: number | null
  totalLatencyMs: number
  requestCount: number
}

const HEALTH_WINDOW_MS = 5 * 60 * 1000 // 5 minutes
const UNHEALTHY_THRESHOLD = 3

const healthMap = new Map<ByokProvider, HealthRecord>()

function getRecord(provider: ByokProvider): HealthRecord {
  let rec = healthMap.get(provider)
  if (!rec) {
    rec = { consecutiveFailures: 0, lastFailure: null, lastSuccess: null, totalLatencyMs: 0, requestCount: 0 }
    healthMap.set(provider, rec)
  }
  return rec
}

function isHealthy(rec: HealthRecord): boolean {
  if (rec.consecutiveFailures <= UNHEALTHY_THRESHOLD) return true
  // Unhealthy only if the failures are recent (within window)
  if (rec.lastFailure && Date.now() - rec.lastFailure < HEALTH_WINDOW_MS) return false
  // Failures are stale — give it another chance
  return true
}

function avgLatency(rec: HealthRecord): number {
  if (rec.requestCount === 0) return 0
  return Math.round(rec.totalLatencyMs / rec.requestCount)
}

/** Record a successful provider call */
export function recordSuccess(provider: ByokProvider, latencyMs: number): void {
  const rec = getRecord(provider)
  rec.consecutiveFailures = 0
  rec.lastSuccess = Date.now()
  rec.totalLatencyMs += latencyMs
  rec.requestCount++
}

/** Record a failed provider call */
export function recordFailure(provider: ByokProvider, _error?: Error): void {
  const rec = getRecord(provider)
  rec.consecutiveFailures++
  rec.lastFailure = Date.now()
}

/** Get health snapshot for all tracked providers */
export function getProviderHealth(): ProviderHealth[] {
  const all: ByokProvider[] = TIER_ORDER.flatMap(t => TIERS[t])
  return all.map(provider => {
    const rec = getRecord(provider)
    return {
      provider,
      consecutiveFailures: rec.consecutiveFailures,
      lastFailure: rec.lastFailure,
      lastSuccess: rec.lastSuccess,
      avgLatencyMs: avgLatency(rec),
      isHealthy: isHealthy(rec),
    }
  })
}

/** Get the healthiest provider in a tier, preferring lowest latency */
export function getBestProvider(tier?: string): ByokProvider {
  const tierKey = (tier || 'premium') as Tier
  const providers = TIERS[tierKey] || TIERS.premium

  // Filter to healthy providers
  const healthy = providers.filter(p => isHealthy(getRecord(p)))
  const candidates = healthy.length > 0 ? healthy : providers // fallback to all if none healthy

  // Sort by: healthy first, then lowest avg latency, then fewest failures
  candidates.sort((a, b) => {
    const ra = getRecord(a)
    const rb = getRecord(b)
    // Healthy providers first
    const ha = isHealthy(ra) ? 0 : 1
    const hb = isHealthy(rb) ? 0 : 1
    if (ha !== hb) return ha - hb
    // Fewer consecutive failures
    if (ra.consecutiveFailures !== rb.consecutiveFailures) return ra.consecutiveFailures - rb.consecutiveFailures
    // Lower latency (0 means no data — sort last among healthy)
    const la = avgLatency(ra) || Infinity
    const lb = avgLatency(rb) || Infinity
    return la - lb
  })

  return candidates[0]
}

/**
 * Machine-aware tier preference.
 * If GPU acceleration is available and memory is sufficient, prefer local tier
 * for simple tasks (saves cost). Returns the recommended starting tier.
 */
export function getMachineAwareTier(taskComplexity: 'simple' | 'moderate' | 'complex'): Tier {
  const profile = getMachineProfile()
  if (!profile) return 'premium'

  const hasGpu = profile.gpuAcceleration !== 'cpu-only'
  const totalGB = profile.memory.totalBytes / (1024 ** 3)
  const lowPressure = profile.memory.pressure !== 'high'

  // Simple tasks: prefer local if hardware supports it
  if (taskComplexity === 'simple' && hasGpu && totalGB >= 8 && lowPressure) {
    // Check if any local provider is healthy
    const localHealthy = TIERS.local.some(p => isHealthy(getRecord(p)))
    if (localHealthy) return 'local'
  }

  // Moderate tasks: fast tier is good enough if available
  if (taskComplexity === 'moderate') {
    const fastHealthy = TIERS.fast.some(p => isHealthy(getRecord(p)))
    if (fastHealthy) return 'fast'
  }

  // Complex tasks: always premium
  return 'premium'
}

// ── Fallback options ──

export interface FallbackOptions {
  /** Max retries on same provider (default: 3) */
  maxRetries?: number
  /** Base delay in ms for exponential backoff (default: 1000) */
  baseDelayMs?: number
  /** Starting provider (default: inferred from config) */
  startProvider?: ByokProvider
  /** API key resolver — given a provider, return its key or null */
  getKey?: (provider: ByokProvider) => string | null
  /** Skip cross-tier fallback (default: false) */
  sameTierOnly?: boolean
  /** Errors that should NOT trigger fallback (e.g., 400 bad request) */
  noRetryErrors?: Array<string | RegExp>
  /** Called on each retry/failover for logging */
  onFallback?: (from: ByokProvider, to: ByokProvider, level: 'retry' | 'same-tier' | 'cross-tier', error: Error) => void
}

// ── Tier lookup ──

function getTier(provider: ByokProvider): Tier {
  for (const [tier, providers] of Object.entries(TIERS)) {
    if ((providers as readonly ByokProvider[]).includes(provider)) return tier as Tier
  }
  return 'premium'
}

function getSameTierAlternatives(provider: ByokProvider): ByokProvider[] {
  const tier = getTier(provider)
  return TIERS[tier].filter(p => p !== provider)
}

function getCheaperTiers(provider: ByokProvider): Tier[] {
  const tier = getTier(provider)
  const idx = TIER_ORDER.indexOf(tier)
  return TIER_ORDER.slice(idx + 1)
}

// ── Error classification ──

function isNonRetryable(error: Error, patterns?: Array<string | RegExp>): boolean {
  const msg = error.message || ''
  // Always non-retryable: auth errors, bad requests, content policy
  if (/\b(401|403|invalid.api.key|unauthorized|forbidden)\b/i.test(msg)) return true
  if (/\b(400|bad.request|invalid.model|content.policy)\b/i.test(msg)) return true
  // User-specified patterns
  if (patterns) {
    for (const p of patterns) {
      if (typeof p === 'string' && msg.includes(p)) return true
      if (p instanceof RegExp && p.test(msg)) return true
    }
  }
  return false
}

// ── Sleep ──

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ── Main fallback function ──

/**
 * Execute a provider call with multi-level fallback.
 *
 * Level 1: Retry same provider with exponential backoff
 * Level 2: Failover to another provider in the same tier
 * Level 3: Degrade to a cheaper tier
 */
export async function withFallback<T>(
  fn: (provider: ByokProvider, apiKey: string) => Promise<T>,
  options?: FallbackOptions,
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 3
  const baseDelay = options?.baseDelayMs ?? 1000
  const getKey = options?.getKey || (() => null)
  const startProvider = options?.startProvider || 'anthropic'
  const onFallback = options?.onFallback

  // Collect all errors for the final throw
  const allErrors: Array<{ provider: ByokProvider; error: Error }> = []

  // Try a single provider with retries
  async function tryProvider(provider: ByokProvider): Promise<T | null> {
    const key = getKey(provider)
    if (!key) return null // no key configured — skip

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const start = Date.now()
      try {
        const result = await fn(provider, key)
        recordSuccess(provider, Date.now() - start)
        return result
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        recordFailure(provider, error)
        allErrors.push({ provider, error })

        // Don't retry non-retryable errors
        if (isNonRetryable(error, options?.noRetryErrors)) break

        // Last attempt — don't sleep
        if (attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt) // 1s, 2s, 4s
          if (onFallback) onFallback(provider, provider, 'retry', error)
          await sleep(delay)
        }
      }
    }
    return null
  }

  // Level 1: Try the starting provider
  const result1 = await tryProvider(startProvider)
  if (result1 !== null) return result1

  // Level 2: Same-tier failover
  const alternatives = getSameTierAlternatives(startProvider)
    .filter(p => isHealthy(getRecord(p)))
    .sort((a, b) => {
      const la = avgLatency(getRecord(a)) || Infinity
      const lb = avgLatency(getRecord(b)) || Infinity
      return la - lb
    })

  for (const alt of alternatives) {
    if (onFallback && allErrors.length > 0) {
      onFallback(startProvider, alt, 'same-tier', allErrors[allErrors.length - 1].error)
    }
    const result2 = await tryProvider(alt)
    if (result2 !== null) return result2
  }

  // Level 3: Cross-tier fallback
  if (!options?.sameTierOnly) {
    const cheaperTiers = getCheaperTiers(startProvider)
    for (const tier of cheaperTiers) {
      const best = getBestProvider(tier)
      if (onFallback && allErrors.length > 0) {
        onFallback(startProvider, best, 'cross-tier', allErrors[allErrors.length - 1].error)
      }
      const result3 = await tryProvider(best)
      if (result3 !== null) return result3

      // Try remaining providers in this tier
      const remaining = TIERS[tier].filter(p => p !== best && isHealthy(getRecord(p)))
      for (const p of remaining) {
        const result4 = await tryProvider(p)
        if (result4 !== null) return result4
      }
    }
  }

  // Everything failed — throw with context
  const lastErr = allErrors[allErrors.length - 1]
  const providers = [...new Set(allErrors.map(e => e.provider))]
  const msg = `All providers failed (tried: ${providers.join(', ')}). Last error: ${lastErr?.error.message || 'unknown'}`
  const finalError = new Error(msg)
  ;(finalError as any).providerErrors = allErrors
  throw finalError
}

/** Reset all health data (for testing) */
export function resetHealth(): void {
  healthMap.clear()
}
