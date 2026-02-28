// ═══════════════════════════════════════════════════════════════
//  Guardian Review — Background code security & quality analysis
// ═══════════════════════════════════════════════════════════════
//
//  When the coder agent generates a code artifact >= 8 lines,
//  a background Haiku (fast-tier) call reviews it for security
//  vulnerabilities and quality issues. Non-blocking — the artifact
//  renders immediately while the review runs in parallel.

import { getBackgroundProvider } from './providers/registry'

// ─── Types ──────────────────────────────────────────────────

export interface GuardianFinding {
  severity: 'info' | 'advisory' | 'warning' | 'critical'
  line?: number
  message: string
}

export interface GuardianReview {
  severity: 'clean' | 'advisory' | 'warning' | 'critical'
  summary: string
  findings: GuardianFinding[]
  reviewedAt: number
}

// ─── System Prompt ──────────────────────────────────────────

const GUARDIAN_REVIEW_SYSTEM = `You are a code security and quality reviewer. Analyze the provided code artifact for:
- Security vulnerabilities (SQL injection, XSS, command injection, hardcoded secrets, SSRF)
- Quality issues (missing error handling, race conditions, resource leaks)
- Common pitfalls for the language/framework

Rules:
- Be specific — cite line numbers when possible
- Don't flag style preferences or minor formatting
- Focus on issues that could cause bugs, security holes, or data loss
- If the code is clean, say so — don't invent problems

Respond with ONLY valid JSON:
{"severity": "clean|advisory|warning|critical", "summary": "one-line summary", "findings": [{"severity": "info|advisory|warning|critical", "line": 5, "message": "description"}]}`

// ─── Review Cache ──────────────────────────────────────────
// Cache reviews by content hash to avoid re-calling API on re-renders,
// page reloads within session, and conversation history scrolling.

const MAX_CACHE_SIZE = 200
const reviewCache = new Map<string, GuardianReview>()
const inflight = new Map<string, Promise<GuardianReview>>()

function evictIfNeeded() {
  if (reviewCache.size <= MAX_CACHE_SIZE) return
  // Delete oldest entries (Map iteration order = insertion order)
  const toDelete = reviewCache.size - MAX_CACHE_SIZE + 50 // evict 50 extra to avoid frequent eviction
  let deleted = 0
  for (const key of reviewCache.keys()) {
    if (deleted >= toDelete) break
    reviewCache.delete(key)
    deleted++
  }
}

function hashKey(code: string, filename: string, language: string): string {
  // Simple djb2 hash — fast, collision-resistant enough for cache keys
  let hash = 5381
  const input = `${language}:${filename}:${code}`
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0
  }
  return hash.toString(36)
}

// ─── Review Function ────────────────────────────────────────

const VALID_SEVERITIES = ['clean', 'advisory', 'warning', 'critical'] as const

export async function reviewCodeArtifact(
  code: string,
  filename: string,
  language: string,
): Promise<GuardianReview> {
  const key = hashKey(code, filename, language)

  // Return cached result if available
  const cached = reviewCache.get(key)
  if (cached) return cached

  // Deduplicate concurrent requests for the same artifact
  const existing = inflight.get(key)
  if (existing) return existing

  const promise = _doReview(code, filename, language).then(review => {
    reviewCache.set(key, review)
    evictIfNeeded()
    inflight.delete(key)
    return review
  }).catch(err => {
    inflight.delete(key)
    throw err
  })

  inflight.set(key, promise)
  return promise
}

async function _doReview(
  code: string,
  filename: string,
  language: string,
): Promise<GuardianReview> {
  try {
    const result = await getBackgroundProvider().json<{
      severity: string
      summary: string
      findings: GuardianFinding[]
    }>(
      `Review this ${language} code artifact (${filename}):\n\n${code}`,
      { system: GUARDIAN_REVIEW_SYSTEM, tier: 'fast', max_tokens: 500 },
    )

    const severity = (VALID_SEVERITIES as readonly string[]).includes(result.severity)
      ? result.severity as GuardianReview['severity']
      : 'advisory'

    return {
      severity,
      summary: result.summary || 'Review complete',
      findings: (result.findings || []).slice(0, 8),
      reviewedAt: Date.now(),
    }
  } catch (err) {
    console.warn('[Guardian] Review failed:', err)
    return {
      severity: 'clean',
      summary: 'Review unavailable',
      findings: [],
      reviewedAt: Date.now(),
    }
  }
}
