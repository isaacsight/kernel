// MemoryAgent — Background memory extraction and profile building
// Replaces raw message dumps (~4000-8000 tokens) with compact profiles (~200-500 tokens)

import { claudeJSON } from './ClaudeClient'

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

    return await claudeJSON<UserMemoryProfile>(
      `Analyze this conversation and extract user profile:\n\n${conversation}`,
      { system: EXTRACT_SYSTEM, model: 'haiku', max_tokens: 500 }
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
    return await claudeJSON<UserMemoryProfile>(
      `Existing profile:\n${JSON.stringify(existing, null, 2)}\n\nNewly extracted:\n${JSON.stringify(newExtraction, null, 2)}\n\nMerge into a single updated profile.`,
      { system: MERGE_SYSTEM, model: 'haiku', max_tokens: 500 }
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

export function formatMemoryForPrompt(profile: UserMemoryProfile): string {
  if (isEmptyProfile(profile)) return ''

  const sections: string[] = []

  if (profile.facts.length > 0) {
    sections.push(`**About them:** ${profile.facts.join('. ')}`)
  }
  if (profile.interests.length > 0) {
    sections.push(`**Interests:** ${profile.interests.join(', ')}`)
  }
  if (profile.goals.length > 0) {
    sections.push(`**Working toward:** ${profile.goals.join('. ')}`)
  }
  if (profile.communication_style) {
    sections.push(`**Communication style:** ${profile.communication_style}`)
  }
  if (profile.preferences.length > 0) {
    sections.push(`**Preferences:** ${profile.preferences.join('. ')}`)
  }

  return sections.join('\n')
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
