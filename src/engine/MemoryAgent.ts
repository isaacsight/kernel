// MemoryAgent — Background memory extraction and profile building
// Replaces raw message dumps (~4000-8000 tokens) with compact profiles (~200-500 tokens)

import { getBackgroundProvider } from './providers/registry'

/** A memory item with warmth tracking — items mentioned more often and more recently are "warmer" */
export interface MemoryItem {
  text: string
  /** How many times this item has been extracted/reinforced */
  mentions: number
  /** ISO timestamp of last reinforcement */
  lastReinforced: string
}

export interface UserMemoryProfile {
  interests: string[]
  communication_style: string
  goals: string[]
  facts: string[]
  preferences: string[]
  /** Warmth metadata — keyed by item text, tracks mention count + recency */
  warmth?: Record<string, { mentions: number; lastReinforced: string }>
}

const EXTRACT_SYSTEM = `You are a memory extraction agent. Analyze the conversation below and extract a structured profile of the user. Focus on durable information — things that would be useful across future conversations.

Extract:
- interests: Topics they care about (hobbies, fields, passions)
- communication_style: How they communicate (terse, casual, detailed, formal, etc.)
- goals: What they're working toward or want to achieve
- facts: Concrete facts about them (job, location, projects, relationships)
- preferences: How they like things done (communication style, format preferences, etc.)

CRITICAL: NEVER extract or store information about crisis states, suicidal ideation, self-harm, or mental health emergencies. Skip any such content entirely.

Only include items you're confident about from the conversation. Better to miss something than to guess wrong. Keep each item to one concise sentence.

Respond with ONLY valid JSON:
{"interests": [], "communication_style": "", "goals": [], "facts": [], "preferences": []}`

const MERGE_SYSTEM = `You are a memory merging agent. You have an existing user profile and newly extracted information. Merge them into a single updated profile.

Rules:
- Keep all existing items that aren't contradicted by new information
- Add new items that don't duplicate existing ones
- If new info updates/corrects existing info, use the new version
- Remove items that seem outdated based on new context
- Keep each category to max 8 items (drop least important if needed)
- Keep items concise — one sentence each
- NEVER extract or store information about crisis states, suicidal ideation, self-harm, or mental health emergencies. If such content appears in either profile, omit it.

Respond with ONLY valid JSON:
{"interests": [], "communication_style": "", "goals": [], "facts": [], "preferences": []}`

export async function extractMemory(
  recentMessages: { role: string; content: string }[]
): Promise<UserMemoryProfile> {
  try {
    const conversation = recentMessages
      .map(m => `${m.role === 'user' ? 'User' : 'Kernel'}: ${m.content}`)
      .join('\n\n')

    return await getBackgroundProvider().json<UserMemoryProfile>(
      `Analyze this conversation and extract user profile:\n\n${conversation}`,
      { system: EXTRACT_SYSTEM, tier: 'fast', max_tokens: 500 }
    )
  } catch (err) {
    console.warn('[MemoryAgent] extractMemory failed:', err)
    return emptyProfile()
  }
}

export async function mergeMemory(
  existing: UserMemoryProfile,
  newExtraction: UserMemoryProfile
): Promise<UserMemoryProfile> {
  // If existing is empty, just use new
  if (isEmptyProfile(existing)) return newExtraction
  // If new is empty, keep existing
  if (isEmptyProfile(newExtraction)) return existing

  try {
    return await getBackgroundProvider().json<UserMemoryProfile>(
      `Existing profile:\n${JSON.stringify(existing, null, 2)}\n\nNewly extracted:\n${JSON.stringify(newExtraction, null, 2)}\n\nMerge into a single updated profile.`,
      { system: MERGE_SYSTEM, tier: 'fast', max_tokens: 500 }
    )
  } catch {
    // On failure, prefer new extraction but keep existing facts
    return {
      interests: [...new Set([...existing.interests, ...newExtraction.interests])].slice(0, 8),
      communication_style: newExtraction.communication_style || existing.communication_style,
      goals: [...new Set([...existing.goals, ...newExtraction.goals])].slice(0, 8),
      facts: [...new Set([...existing.facts, ...newExtraction.facts])].slice(0, 8),
      preferences: [...new Set([...existing.preferences, ...newExtraction.preferences])].slice(0, 8),
    }
  }
}

// ─── Memory sanitization (prompt injection defense) ──────

const MAX_MEMORY_PROMPT_LENGTH = 2000
const MAX_FIELD_LENGTH = 200

// Patterns that could manipulate model behavior when injected into system prompts
const INJECTION_PATTERNS = [
  /\b(?:system|assistant)\s*:/gi,
  /\b(?:ignore|disregard|forget|override)\s+(?:all\s+)?(?:previous|above|prior)\s+(?:instructions?|rules?|prompts?)/gi,
  /\b(?:you\s+are\s+now|act\s+as|pretend\s+to\s+be|new\s+instructions?)\b/gi,
  /<\/?(?:system|prompt|instructions?|rules?)>/gi,
  /^---+$/gm,
  /^===+$/gm,
]

function sanitizeMemoryField(value: string): string {
  let sanitized = value.slice(0, MAX_FIELD_LENGTH)
  for (const pattern of INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[removed]')
  }
  return sanitized.trim()
}

function sanitizeMemoryArray(items: string[]): string[] {
  return items
    .map(sanitizeMemoryField)
    .filter(s => s.length > 0 && s !== '[removed]')
}

// ─── Relevance Scoring ──────────────────────────────────────

/** Tokenize text into lowercase word set for Jaccard overlap */
function tokenize(text: string): Set<string> {
  return new Set(text.toLowerCase().match(/\b[a-z]{2,}\b/g) || [])
}

/** Jaccard similarity between two token sets */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let intersection = 0
  for (const token of a) {
    if (b.has(token)) intersection++
  }
  const union = a.size + b.size - intersection
  return union > 0 ? intersection / union : 0
}

/** Score how relevant a memory item is to the current query + context */
function scoreRelevance(
  item: string,
  queryTokens: Set<string>,
  contextTokens: Set<string>,
  warmthBonus: number,
): number {
  const itemTokens = tokenize(item)
  return 0.6 * jaccard(itemTokens, queryTokens) +
         0.3 * jaccard(itemTokens, contextTokens) +
         0.1 * warmthBonus
}

/**
 * Format memory profile into a prompt block.
 * When currentQuery and recentContext are provided, filters items by relevance
 * to reduce token waste. Always includes communication_style and high-warmth
 * identity facts (3+ mentions).
 */
export function formatMemoryForPrompt(
  profile: UserMemoryProfile,
  currentQuery?: string,
  recentContext?: string,
): string {
  if (isEmptyProfile(profile)) return ''

  const warmth = profile.warmth || {}
  const queryTokens = currentQuery ? tokenize(currentQuery) : new Set<string>()
  const contextTokens = recentContext ? tokenize(recentContext) : new Set<string>()
  const hasRelevanceSignal = queryTokens.size > 0 || contextTokens.size > 0

  /** Check whether an item should be included */
  function shouldInclude(item: string): boolean {
    if (!hasRelevanceSignal) return true // No query = dump everything (backwards compat)
    // Always include high-warmth items (3+ mentions = core identity)
    const w = warmth[item]
    if (w && w.mentions >= 3) return true
    // Check relevance score
    const wBonus = w ? Math.min(1, w.mentions / 5) : 0
    return scoreRelevance(item, queryTokens, contextTokens, wBonus) > 0.05
  }

  const sections: string[] = []

  const facts = sanitizeMemoryArray(profile.facts).filter(shouldInclude)
  if (facts.length > 0) {
    sections.push(`**About them:** ${facts.join('. ')}`)
  }
  const interests = sanitizeMemoryArray(profile.interests).filter(shouldInclude)
  if (interests.length > 0) {
    sections.push(`**Interests:** ${interests.join(', ')}`)
  }
  const goals = sanitizeMemoryArray(profile.goals).filter(shouldInclude)
  if (goals.length > 0) {
    sections.push(`**Working toward:** ${goals.join('. ')}`)
  }
  // Communication style is always included
  if (profile.communication_style) {
    const style = sanitizeMemoryField(profile.communication_style)
    if (style && style !== '[removed]') {
      sections.push(`**Communication style:** ${style}`)
    }
  }
  const prefs = sanitizeMemoryArray(profile.preferences).filter(shouldInclude)
  if (prefs.length > 0) {
    sections.push(`**Preferences:** ${prefs.join('. ')}`)
  }

  const result = sections.join('\n')
  return result.slice(0, MAX_MEMORY_PROMPT_LENGTH)
}

export function emptyProfile(): UserMemoryProfile {
  return {
    interests: [],
    communication_style: '',
    goals: [],
    facts: [],
    preferences: [],
  }
}

export function isEmptyProfile(p: UserMemoryProfile): boolean {
  return (
    p.interests.length === 0 &&
    !p.communication_style &&
    p.goals.length === 0 &&
    p.facts.length === 0 &&
    p.preferences.length === 0
  )
}

// ─── Memory Warmth ──────────────────────────────────────────

/** Update warmth metadata after a merge — reinforces existing items and timestamps new ones */
export function updateWarmth(
  merged: UserMemoryProfile,
  previous: UserMemoryProfile,
): UserMemoryProfile {
  const now = new Date().toISOString()
  const warmth = { ...(previous.warmth || {}) }

  const allItems = [
    ...merged.interests,
    ...merged.goals,
    ...merged.facts,
    ...merged.preferences,
  ]

  const previousItems = new Set([
    ...previous.interests,
    ...previous.goals,
    ...previous.facts,
    ...previous.preferences,
  ])

  for (const item of allItems) {
    const existing = warmth[item]
    if (existing && previousItems.has(item)) {
      // Reinforced — bump mention count
      warmth[item] = { mentions: existing.mentions + 1, lastReinforced: now }
    } else if (!existing) {
      // New item
      warmth[item] = { mentions: 1, lastReinforced: now }
    }
  }

  // Clean up warmth entries for items that were removed during merge
  for (const key of Object.keys(warmth)) {
    if (!allItems.includes(key)) {
      delete warmth[key]
    }
  }

  return { ...merged, warmth }
}

// ─── Memory Decay (Exponential Half-Life) ───────────────────

/** Prune items when their warmth score drops below this threshold */
const DECAY_PRUNE_THRESHOLD = 0.1

/**
 * Compute the warmth score for a memory item using exponential decay.
 * More mentions = slower fade (half-life increases with reinforcement).
 *
 * - 1 mention: half-life 45 days (~fades by 135 days)
 * - 2 mentions: 60 days
 * - 3 mentions: 75 days
 * - Legacy items (no metadata): 0.5 (neutral)
 */
export function warmthScore(
  item: string,
  warmth: Record<string, { mentions: number; lastReinforced: string }>,
): number {
  const w = warmth[item]
  if (!w) return 0.5 // legacy items — neutral score
  const daysSince = (Date.now() - new Date(w.lastReinforced).getTime()) / 86400000
  const halfLife = 30 + (w.mentions * 15) // more mentions = slower fade
  return Math.pow(0.5, daysSince / halfLife)
}

/**
 * Apply exponential decay to profile items.
 * Items whose warmth score drops below DECAY_PRUNE_THRESHOLD are pruned.
 * Returns a new profile with faded items removed.
 */
export function applyProfileDecay(profile: UserMemoryProfile): UserMemoryProfile {
  const w = profile.warmth || {}

  function shouldKeep(item: string): boolean {
    return warmthScore(item, w) >= DECAY_PRUNE_THRESHOLD
  }

  const decayed: UserMemoryProfile = {
    interests: profile.interests.filter(shouldKeep),
    communication_style: profile.communication_style, // Style doesn't decay
    goals: profile.goals.filter(shouldKeep),
    facts: profile.facts.filter(shouldKeep),
    preferences: profile.preferences.filter(shouldKeep),
    warmth: { ...w },
  }

  // Clean warmth for removed items
  const kept = new Set([...decayed.interests, ...decayed.goals, ...decayed.facts, ...decayed.preferences])
  for (const key of Object.keys(decayed.warmth!)) {
    if (!kept.has(key)) delete decayed.warmth![key]
  }

  return decayed
}

// ─── Stale Profile Detection ────────────────────────────────

/** Days since last update before considering a profile potentially stale */
const STALE_AFTER_DAYS = 14

/**
 * Check if a user's memory profile is stale and needs re-bootstrapping.
 * A profile is stale if:
 * - It hasn't been updated in STALE_AFTER_DAYS, AND
 * - All warmth scores are below 0.2 (everything has faded significantly)
 */
export function isProfileStale(
  profile: UserMemoryProfile,
  lastUpdated: string | null,
): boolean {
  if (!lastUpdated) return false // No profile = will bootstrap normally
  if (isEmptyProfile(profile)) return false // Empty profiles bootstrap on first message

  const daysSinceUpdate = (Date.now() - new Date(lastUpdated).getTime()) / 86400000
  if (daysSinceUpdate < STALE_AFTER_DAYS) return false

  const warmth = profile.warmth || {}
  const items = [...profile.interests, ...profile.goals, ...profile.facts, ...profile.preferences]
  if (items.length === 0) return true

  // Check if all warmth scores have faded below 0.2
  return items.every(item => warmthScore(item, warmth) < 0.2)
}

// ─── Warmth-Driven Proactive Callbacks ─────────────────────

/**
 * Find high-warmth memory items that haven't been referenced recently.
 * These are topics the user cares deeply about (3+ mentions) but
 * haven't come up in a while — natural callback opportunities.
 * Returns at most 1 callback to avoid feeling surveillance-y.
 */
export function findCallbackOpportunities(
  profile: UserMemoryProfile,
  minMentions = 3,
  minDaysSilent = 7,
): { text: string; mentions: number; daysSilent: number } | null {
  const warmth = profile.warmth || {}
  const now = Date.now()

  const candidates: { text: string; mentions: number; daysSilent: number }[] = []

  const allItems = [
    ...profile.interests,
    ...profile.goals,
    ...profile.facts,
    ...profile.preferences,
  ]

  for (const item of allItems) {
    const w = warmth[item]
    if (!w || w.mentions < minMentions) continue
    const daysSilent = (now - new Date(w.lastReinforced).getTime()) / 86400000
    if (daysSilent >= minDaysSilent) {
      candidates.push({ text: item, mentions: w.mentions, daysSilent: Math.floor(daysSilent) })
    }
  }

  if (candidates.length === 0) return null

  // Return the one with highest mention count (strongest signal)
  candidates.sort((a, b) => b.mentions - a.mentions)
  return candidates[0]
}

// ─── KG → Profile Consolidation ─────────────────────────────

interface KGEntityLike {
  name: string
  entity_type: string
  confidence: number
  mention_count: number
  properties?: Record<string, unknown>
}

/**
 * Find high-confidence KG entities that should be promoted to profile facts.
 * Entities with confidence >= 0.7 and mention_count >= 3 that don't already
 * appear in the profile facts are returned as candidate fact strings.
 */
export function consolidateFromKG(
  profile: UserMemoryProfile,
  entities: KGEntityLike[],
): string[] {
  const existingFacts = new Set(profile.facts.map(f => f.toLowerCase()))
  const candidates: string[] = []

  for (const e of entities) {
    if (e.confidence < 0.7 || e.mention_count < 3) continue
    // Check if already represented in facts
    const nameLower = e.name.toLowerCase()
    const alreadyExists = [...existingFacts].some(f => f.includes(nameLower))
    if (alreadyExists) continue

    // Generate a fact string from the entity
    const desc = e.properties?.description as string | undefined
    const fact = desc
      ? `${e.name}: ${desc}`
      : `${e.entity_type === 'person' ? 'Knows' : 'Interested in'} ${e.name}`
    candidates.push(fact)
  }

  return candidates.slice(0, 3) // Max 3 promotions per cycle
}
