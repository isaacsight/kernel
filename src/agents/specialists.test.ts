import { describe, it, expect } from 'vitest'
import { getSpecialist, getAllSpecialists, SPECIALISTS } from './specialists'

describe('SPECIALISTS', () => {
  it('has at least the 5 core specialists', () => {
    const ids = Object.keys(SPECIALISTS)
    expect(ids.length).toBeGreaterThanOrEqual(5)
    expect(ids).toContain('kernel')
    expect(ids).toContain('researcher')
    expect(ids).toContain('coder')
    expect(ids).toContain('writer')
    expect(ids).toContain('analyst')
  })

  it('each specialist has required fields', () => {
    for (const s of Object.values(SPECIALISTS)) {
      expect(s.id).toBeTruthy()
      expect(s.name).toBeTruthy()
      expect(s.color).toMatch(/^#[0-9A-Fa-f]{6}$/)
      expect(s.systemPrompt.length).toBeGreaterThan(50)
      // avatar is optional for extended specialists
      if (s.avatar) expect(typeof s.avatar).toBe('string')
    }
  })

  it('each specialist has artifact rules in prompt', () => {
    for (const s of Object.values(SPECIALISTS)) {
      expect(s.systemPrompt).toContain(':filename.ext')
    }
  })
})

describe('getSpecialist', () => {
  it('returns specialist by ID', () => {
    const coder = getSpecialist('coder')
    expect(coder.name).toBe('Coder')
  })

  it('falls back to kernel for unknown ID', () => {
    const fallback = getSpecialist('nonexistent')
    expect(fallback.id).toBe('kernel')
  })
})

describe('getAllSpecialists', () => {
  it('returns all specialists', () => {
    const all = getAllSpecialists()
    expect(all.length).toBeGreaterThanOrEqual(5)
  })
})
