import { describe, it, expect, vi } from 'vitest'
import { formatMemoryForPrompt, emptyProfile, mergeMemory } from './MemoryAgent'
import type { UserMemoryProfile } from './MemoryAgent'

const mockJson = vi.fn()
vi.mock('./providers/registry', () => ({
  getProvider: () => ({
    name: 'mock',
    json: mockJson,
    text: vi.fn(),
    stream: vi.fn(),
    streamChat: vi.fn(),
  }),
}))

describe('emptyProfile', () => {
  it('returns profile with all empty fields', () => {
    const p = emptyProfile()
    expect(p.interests).toEqual([])
    expect(p.communication_style).toBe('')
    expect(p.goals).toEqual([])
    expect(p.facts).toEqual([])
    expect(p.preferences).toEqual([])
  })
})

describe('formatMemoryForPrompt', () => {
  it('returns empty string for empty profile', () => {
    expect(formatMemoryForPrompt(emptyProfile())).toBe('')
  })

  it('formats facts section', () => {
    const profile: UserMemoryProfile = {
      ...emptyProfile(),
      facts: ['Works at Acme Corp', 'Lives in Austin'],
    }
    const result = formatMemoryForPrompt(profile)
    expect(result).toContain('**About them:**')
    expect(result).toContain('Works at Acme Corp')
    expect(result).toContain('Lives in Austin')
  })

  it('formats interests section', () => {
    const profile: UserMemoryProfile = {
      ...emptyProfile(),
      interests: ['AI', 'music', 'cooking'],
    }
    const result = formatMemoryForPrompt(profile)
    expect(result).toContain('**Interests:**')
    expect(result).toContain('AI, music, cooking')
  })

  it('formats goals section', () => {
    const profile: UserMemoryProfile = {
      ...emptyProfile(),
      goals: ['Launch a startup', 'Learn Rust'],
    }
    const result = formatMemoryForPrompt(profile)
    expect(result).toContain('**Working toward:**')
    expect(result).toContain('Launch a startup')
  })

  it('formats communication style', () => {
    const profile: UserMemoryProfile = {
      ...emptyProfile(),
      communication_style: 'casual and direct',
    }
    const result = formatMemoryForPrompt(profile)
    expect(result).toContain('**Communication style:**')
    expect(result).toContain('casual and direct')
  })

  it('formats preferences section', () => {
    const profile: UserMemoryProfile = {
      ...emptyProfile(),
      preferences: ['Prefers bullet points', 'Likes code examples'],
    }
    const result = formatMemoryForPrompt(profile)
    expect(result).toContain('**Preferences:**')
    expect(result).toContain('Prefers bullet points')
  })

  it('combines multiple sections with newlines', () => {
    const profile: UserMemoryProfile = {
      interests: ['AI'],
      communication_style: 'terse',
      goals: ['Ship product'],
      facts: ['Engineer'],
      preferences: ['No fluff'],
    }
    const result = formatMemoryForPrompt(profile)
    const lines = result.split('\n')
    expect(lines.length).toBe(5)
  })

  it('omits empty sections', () => {
    const profile: UserMemoryProfile = {
      ...emptyProfile(),
      interests: ['chess'],
    }
    const result = formatMemoryForPrompt(profile)
    expect(result).not.toContain('**About them:**')
    expect(result).not.toContain('**Working toward:**')
    expect(result).toContain('**Interests:**')
  })
})

describe('mergeMemory', () => {
  it('returns new extraction when existing is empty', async () => {
    const newProfile: UserMemoryProfile = {
      interests: ['AI'],
      communication_style: 'casual',
      goals: ['Learn ML'],
      facts: ['Engineer'],
      preferences: ['Code examples'],
    }
    const result = await mergeMemory(emptyProfile(), newProfile)
    expect(result).toEqual(newProfile)
  })

  it('returns existing when new extraction is empty', async () => {
    const existing: UserMemoryProfile = {
      interests: ['music'],
      communication_style: 'formal',
      goals: ['Write a book'],
      facts: ['Teacher'],
      preferences: ['Detailed explanations'],
    }
    const result = await mergeMemory(existing, emptyProfile())
    expect(result).toEqual(existing)
  })

  it('falls back to manual merge on provider failure', async () => {
    mockJson.mockRejectedValue(new Error('API error'))

    const existing: UserMemoryProfile = {
      interests: ['AI'],
      communication_style: 'casual',
      goals: ['Ship product'],
      facts: ['Engineer'],
      preferences: ['Terse'],
    }
    const newData: UserMemoryProfile = {
      interests: ['music'],
      communication_style: 'direct',
      goals: ['Learn Rust'],
      facts: ['Lives in Austin'],
      preferences: ['Code examples'],
    }

    const result = await mergeMemory(existing, newData)

    // Should combine both
    expect(result.interests).toContain('AI')
    expect(result.interests).toContain('music')
    expect(result.goals).toContain('Ship product')
    expect(result.goals).toContain('Learn Rust')
    // New communication style should win
    expect(result.communication_style).toBe('direct')
  })

  it('deduplicates items in manual merge fallback', async () => {
    mockJson.mockRejectedValue(new Error('API error'))

    const existing: UserMemoryProfile = {
      interests: ['AI', 'music'],
      communication_style: 'casual',
      goals: ['Ship product'],
      facts: ['Engineer'],
      preferences: [],
    }
    const newData: UserMemoryProfile = {
      interests: ['AI', 'cooking'],
      communication_style: '',
      goals: [],
      facts: ['Engineer'],
      preferences: [],
    }

    const result = await mergeMemory(existing, newData)

    // 'AI' should not be duplicated
    const aiCount = result.interests.filter(i => i === 'AI').length
    expect(aiCount).toBe(1)
    expect(result.interests).toContain('cooking')
    // Empty new comm style → keep existing
    expect(result.communication_style).toBe('casual')
  })

  it('caps each category at 8 items in manual merge', async () => {
    mockJson.mockRejectedValue(new Error('API error'))

    const existing: UserMemoryProfile = {
      interests: ['a', 'b', 'c', 'd', 'e'],
      communication_style: '',
      goals: [],
      facts: [],
      preferences: [],
    }
    const newData: UserMemoryProfile = {
      interests: ['f', 'g', 'h', 'i', 'j'],
      communication_style: '',
      goals: [],
      facts: [],
      preferences: [],
    }

    const result = await mergeMemory(existing, newData)
    expect(result.interests.length).toBeLessThanOrEqual(8)
  })
})
