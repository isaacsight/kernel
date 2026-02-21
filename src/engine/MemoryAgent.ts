// MemoryAgent — Background memory extraction and profile building
// Replaces raw message dumps (~4000-8000 tokens) with compact profiles (~200-500 tokens)

import { getProvider } from './providers/registry'

export interface UserMemoryProfile {
  interests: string[]
  communication_style: string
  goals: string[]
  facts: string[]
  preferences: string[]
}

const EXTRACT_SYSTEM = `You are a memory extraction agent. Analyze the conversation below and extract a structured profile of the user. Focus on durable information — things that would be useful across future conversations.

Extract:
- interests: Topics they care about (hobbies, fields, passions)
- communication_style: How they communicate (terse, casual, detailed, formal, etc.)
- goals: What they're working toward or want to achieve
- facts: Concrete facts about them (job, location, projects, relationships)
- preferences: How they like things done (communication style, format preferences, etc.)

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

Respond with ONLY valid JSON:
{"interests": [], "communication_style": "", "goals": [], "facts": [], "preferences": []}`

export async function extractMemory(
  recentMessages: { role: string; content: string }[]
): Promise<UserMemoryProfile> {
  try {
    const conversation = recentMessages
      .map(m => `${m.role === 'user' ? 'User' : 'Kernel'}: ${m.content}`)
      .join('\n\n')

    return await getProvider().json<UserMemoryProfile>(
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
    return await getProvider().json<UserMemoryProfile>(
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

export function formatMemoryForPrompt(profile: UserMemoryProfile): string {
  if (isEmptyProfile(profile)) return ''

  const sections: string[] = []

  const facts = sanitizeMemoryArray(profile.facts)
  if (facts.length > 0) {
    sections.push(`**About them:** ${facts.join('. ')}`)
  }
  const interests = sanitizeMemoryArray(profile.interests)
  if (interests.length > 0) {
    sections.push(`**Interests:** ${interests.join(', ')}`)
  }
  const goals = sanitizeMemoryArray(profile.goals)
  if (goals.length > 0) {
    sections.push(`**Working toward:** ${goals.join('. ')}`)
  }
  if (profile.communication_style) {
    const style = sanitizeMemoryField(profile.communication_style)
    if (style && style !== '[removed]') {
      sections.push(`**Communication style:** ${style}`)
    }
  }
  const prefs = sanitizeMemoryArray(profile.preferences)
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

function isEmptyProfile(p: UserMemoryProfile): boolean {
  return (
    p.interests.length === 0 &&
    !p.communication_style &&
    p.goals.length === 0 &&
    p.facts.length === 0 &&
    p.preferences.length === 0
  )
}
