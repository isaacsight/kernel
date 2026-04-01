// kbot Collective Dreams — Anonymized Dream Sharing
//
// The dream engine consolidates personal insights. This module prepares
// those insights for anonymous sharing with the collective, and merges
// collective wisdom back into the local journal.
//
// What gets shared (anonymized):
//   - Dream category (pattern, preference, skill, project, music)
//   - Keywords (stripped of names, paths, identifiers)
//   - Generalized content (personal details removed, abstracted)
//
// What NEVER gets shared:
//   - Raw insight content, file paths, project names, user identity
//   - API keys, source code, conversation content
//   - Anything from ~/.kbot/config.json
//
// The flywheel:
//   Your dreams → anonymized → collective pool
//   Collective pool → filtered, deduplicated → enriches your journal
//   Every kbot dreamer makes every other kbot smarter.

import { createHash } from 'node:crypto'
import type { DreamInsight, DreamCategory } from './dream.js'

// ── Types ──

export interface AnonymizedInsight {
  /** Category preserved as-is */
  category: DreamCategory
  /** Keywords with PII stripped */
  keywords: string[]
  /** Generalized version of the content (no personal details) */
  generalizedContent: string
  /** How many contributors have shared similar insights */
  contributorCount: number
  /** First time this insight appeared in the collective */
  firstSeen: string
  /** Most recent contribution timestamp */
  lastSeen: string
}

// ── PII Stripping ──

/** Patterns that indicate PII or project-specific content */
const PII_PATTERNS: RegExp[] = [
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,   // emails
  /\b(?:\/[^\s/]+){2,}\b/g,                                     // file paths
  /\b(?:https?:\/\/)[^\s]+/g,                                    // URLs
  /\b(?:sk-|pk-|key-|token-|ghp_|gho_|kn_)[A-Za-z0-9_-]+/g,   // API keys/tokens
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, // UUIDs
  /\b(?:Isaac|openclaw)\b/gi,                                    // known user names
]

/** Words that should be stripped from keywords (project-specific, PII-ish) */
const KEYWORD_BLOCKLIST = new Set([
  'isaac', 'openclaw', 'kernel', 'kbot', 'supabase',
  'eoxxpyixdieprsxlpwcs', 'isaacsight', 'isaachernandez',
])

/** Strip PII from a text string, replacing matches with generic placeholders */
function stripPII(text: string): string {
  let cleaned = text
  for (const pattern of PII_PATTERNS) {
    cleaned = cleaned.replace(pattern, '[REDACTED]')
  }
  return cleaned
}

/** Remove blocklisted and PII-ish keywords */
function sanitizeKeywords(keywords: string[]): string[] {
  return keywords
    .map(k => k.toLowerCase().trim())
    .filter(k =>
      k.length >= 2 &&
      k.length <= 30 &&
      !KEYWORD_BLOCKLIST.has(k) &&
      !/^[0-9a-f-]{8,}$/.test(k) && // hex strings / UUIDs
      !/[@/\\]/.test(k)              // paths / emails
    )
}

// ── Generalization ──

/**
 * Generalize insight content by:
 *   1. Stripping PII
 *   2. Replacing specific project/file references with generic terms
 *   3. Keeping the abstract pattern intact
 */
function generalizeContent(content: string): string {
  let text = stripPII(content)

  // Replace specific filenames with generic references
  text = text.replace(/\b\w+\.(ts|tsx|js|jsx|py|rs|go|css|html|json|yaml|yml|toml)\b/g, '[file]')

  // Replace specific variable/function names that look project-specific
  // (camelCase or snake_case longer than 15 chars — likely domain-specific)
  text = text.replace(/\b[a-z][a-zA-Z0-9]{15,}\b/g, '[identifier]')
  text = text.replace(/\b[a-z][a-z0-9_]{15,}\b/g, '[identifier]')

  // Collapse multiple [REDACTED] into one
  text = text.replace(/(\[REDACTED\]\s*)+/g, '[REDACTED] ')

  return text.trim()
}

// ── Core Functions ──

/**
 * Anonymize a single dream insight for collective sharing.
 * Strips personal info, keeps only category, keywords, and generalized content.
 */
export function anonymizeDreamInsight(insight: DreamInsight): AnonymizedInsight {
  const now = new Date().toISOString()

  return {
    category: insight.category,
    keywords: sanitizeKeywords(insight.keywords),
    generalizedContent: generalizeContent(insight.content),
    contributorCount: 1,
    firstSeen: now,
    lastSeen: now,
  }
}

/**
 * Prepare a batch of dream insights for collective sharing.
 *   1. Filter to high-relevance insights (> 0.7)
 *   2. Anonymize each
 *   3. Deduplicate by content similarity
 */
export function prepareCollectiveDreams(insights: DreamInsight[]): AnonymizedInsight[] {
  // Step 1: Filter to high-relevance only
  const highRelevance = insights.filter(i => i.relevance > 0.7)
  if (highRelevance.length === 0) return []

  // Step 2: Anonymize
  const anonymized = highRelevance.map(i => anonymizeDreamInsight(i))

  // Step 3: Deduplicate by content hash
  const seen = new Map<string, AnonymizedInsight>()

  for (const insight of anonymized) {
    // Skip if generalized content is too short or entirely redacted
    if (insight.generalizedContent.length < 10) continue
    if (insight.generalizedContent.replace(/\[REDACTED\]/g, '').trim().length < 10) continue

    const hash = createHash('sha256')
      .update(insight.category + ':' + insight.generalizedContent.toLowerCase().replace(/\s+/g, ' '))
      .digest('hex')
      .slice(0, 16)

    if (!seen.has(hash)) {
      seen.set(hash, insight)
    } else {
      // Merge: bump contributor count, keep the one with more keywords
      const existing = seen.get(hash)!
      existing.contributorCount++
      if (insight.keywords.length > existing.keywords.length) {
        existing.keywords = insight.keywords
      }
    }
  }

  return Array.from(seen.values())
}

/**
 * Merge collective wisdom into the local dream journal.
 *
 * Collective insights are injected with a lower base relevance (0.5) so they
 * don't drown out the user's own insights but still surface when relevant.
 * Deduplicates against existing local insights by content similarity.
 */
export function mergeCollectiveDreams(
  local: DreamInsight[],
  collective: AnonymizedInsight[],
): DreamInsight[] {
  const merged = [...local]
  const now = new Date().toISOString()

  // Build a set of content hashes from local insights for dedup
  const localHashes = new Set<string>()
  for (const insight of local) {
    const hash = createHash('sha256')
      .update(insight.category + ':' + insight.content.toLowerCase().replace(/\s+/g, ' ').slice(0, 100))
      .digest('hex')
      .slice(0, 16)
    localHashes.add(hash)
  }

  for (const collective_insight of collective) {
    // Skip low-quality collective insights
    if (collective_insight.generalizedContent.length < 10) continue
    if (collective_insight.contributorCount < 2) continue // Need at least 2 contributors

    // Check for duplication against local
    const hash = createHash('sha256')
      .update(
        collective_insight.category + ':' +
        collective_insight.generalizedContent.toLowerCase().replace(/\s+/g, ' ').slice(0, 100)
      )
      .digest('hex')
      .slice(0, 16)

    if (localHashes.has(hash)) continue

    // Convert to DreamInsight with lower relevance
    const dreamInsight: DreamInsight = {
      id: `collective_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      content: collective_insight.generalizedContent,
      category: collective_insight.category,
      keywords: collective_insight.keywords,
      relevance: 0.5, // Lower base relevance for collective insights
      sessions: collective_insight.contributorCount,
      created: collective_insight.firstSeen,
      lastReinforced: collective_insight.lastSeen,
      source: `collective:${collective_insight.contributorCount}_contributors`,
    }

    merged.push(dreamInsight)
    localHashes.add(hash) // Prevent duplicates within the collective batch
  }

  // Sort by relevance descending — local insights (higher relevance) surface first
  merged.sort((a, b) => b.relevance - a.relevance)

  return merged
}
