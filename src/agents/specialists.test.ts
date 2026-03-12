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

  it('includes the physicist specialist', () => {
    expect(Object.keys(SPECIALISTS)).toContain('physicist')
    const p = SPECIALISTS.physicist
    expect(p.id).toBe('physicist')
    expect(p.name).toBe('Physicist')
    expect(p.color).toMatch(/^#[0-9A-Fa-f]{6}$/)
    expect(p.systemPrompt).toContain('Quantum Mechanics')
    expect(p.systemPrompt).toContain('Relativity')
    expect(p.systemPrompt).toContain('Classical Mechanics')
    expect(p.systemPrompt).toContain(':filename.ext')
  })

  it('includes the session specialist', () => {
    const s = SPECIALISTS.session
    expect(s.id).toBe('session')
    expect(s.name).toBe('Session')
    expect(s.systemPrompt).toContain('Session Management')
    expect(s.systemPrompt).toContain('Context Continuity')
    expect(s.systemPrompt).toContain(':filename.ext')
  })

  it('includes the scholar specialist', () => {
    const s = SPECIALISTS.scholar
    expect(s.id).toBe('scholar')
    expect(s.name).toBe('Scholar')
    expect(s.systemPrompt).toContain('Literature Review')
    expect(s.systemPrompt).toContain('Academic Research')
    expect(s.systemPrompt).toContain(':filename.ext')
  })

  it('includes the auditor specialist', () => {
    const s = SPECIALISTS.auditor
    expect(s.id).toBe('auditor')
    expect(s.name).toBe('Auditor')
    expect(s.systemPrompt).toContain('Code Review')
    expect(s.systemPrompt).toContain('Architecture Analysis')
    expect(s.systemPrompt).toContain(':filename.ext')
  })

  it('includes the benchmarker specialist', () => {
    const s = SPECIALISTS.benchmarker
    expect(s.id).toBe('benchmarker')
    expect(s.name).toBe('Benchmarker')
    expect(s.systemPrompt).toContain('Benchmarking')
    expect(s.systemPrompt).toContain('Competitive Intelligence')
    expect(s.systemPrompt).toContain(':filename.ext')
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

  it('returns physicist by ID', () => {
    const physicist = getSpecialist('physicist')
    expect(physicist.name).toBe('Physicist')
  })

  it('returns session agent by ID', () => {
    expect(getSpecialist('session').name).toBe('Session')
  })

  it('returns scholar agent by ID', () => {
    expect(getSpecialist('scholar').name).toBe('Scholar')
  })

  it('returns auditor agent by ID', () => {
    expect(getSpecialist('auditor').name).toBe('Auditor')
  })

  it('returns benchmarker agent by ID', () => {
    expect(getSpecialist('benchmarker').name).toBe('Benchmarker')
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
