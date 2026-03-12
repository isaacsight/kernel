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

  it('includes the mathematician specialist', () => {
    const s = SPECIALISTS.mathematician
    expect(s.id).toBe('mathematician')
    expect(s.name).toBe('Mathematician')
    expect(s.systemPrompt).toContain('Algebra')
    expect(s.systemPrompt).toContain('Topology')
    expect(s.systemPrompt).toContain('Number Theory')
    expect(s.systemPrompt).toContain(':filename.ext')
  })

  it('includes the biologist specialist', () => {
    const s = SPECIALISTS.biologist
    expect(s.id).toBe('biologist')
    expect(s.name).toBe('Biologist')
    expect(s.systemPrompt).toContain('Molecular Biology')
    expect(s.systemPrompt).toContain('Evolution')
    expect(s.systemPrompt).toContain(':filename.ext')
  })

  it('includes the economist specialist', () => {
    const s = SPECIALISTS.economist
    expect(s.id).toBe('economist')
    expect(s.name).toBe('Economist')
    expect(s.systemPrompt).toContain('Game Theory')
    expect(s.systemPrompt).toContain('Behavioral Economics')
    expect(s.systemPrompt).toContain(':filename.ext')
  })

  it('includes the psychologist specialist', () => {
    const s = SPECIALISTS.psychologist
    expect(s.id).toBe('psychologist')
    expect(s.name).toBe('Psychologist')
    expect(s.systemPrompt).toContain('Cognitive Psychology')
    expect(s.systemPrompt).toContain(':filename.ext')
  })

  it('includes the engineer specialist', () => {
    const s = SPECIALISTS.engineer
    expect(s.id).toBe('engineer')
    expect(s.name).toBe('Engineer')
    expect(s.systemPrompt).toContain('Systems Engineering')
    expect(s.systemPrompt).toContain('Robotics')
    expect(s.systemPrompt).toContain(':filename.ext')
  })

  it('includes the medic specialist', () => {
    const s = SPECIALISTS.medic
    expect(s.id).toBe('medic')
    expect(s.name).toBe('Medic')
    expect(s.systemPrompt).toContain('NOT a doctor')
    expect(s.systemPrompt).toContain('Evidence')
    expect(s.systemPrompt).toContain(':filename.ext')
  })

  it('includes the linguist specialist', () => {
    const s = SPECIALISTS.linguist
    expect(s.id).toBe('linguist')
    expect(s.name).toBe('Linguist')
    expect(s.systemPrompt).toContain('Phonetics')
    expect(s.systemPrompt).toContain('Syntax')
    expect(s.systemPrompt).toContain(':filename.ext')
  })

  it('includes the ethicist specialist', () => {
    const s = SPECIALISTS.ethicist
    expect(s.id).toBe('ethicist')
    expect(s.name).toBe('Ethicist')
    expect(s.systemPrompt).toContain('Moral Philosophy')
    expect(s.systemPrompt).toContain('AI Ethics')
    expect(s.systemPrompt).toContain(':filename.ext')
  })

  it('includes the educator specialist', () => {
    const s = SPECIALISTS.educator
    expect(s.id).toBe('educator')
    expect(s.name).toBe('Educator')
    expect(s.systemPrompt).toContain('Learning Science')
    expect(s.systemPrompt).toContain('Pedagogical')
    expect(s.systemPrompt).toContain(':filename.ext')
  })

  it('includes the diplomat specialist', () => {
    const s = SPECIALISTS.diplomat
    expect(s.id).toBe('diplomat')
    expect(s.name).toBe('Diplomat')
    expect(s.systemPrompt).toContain('Negotiation')
    expect(s.systemPrompt).toContain('Conflict Resolution')
    expect(s.systemPrompt).toContain(':filename.ext')
  })

  it('includes the synthesizer specialist', () => {
    const s = SPECIALISTS.synthesizer
    expect(s.id).toBe('synthesizer')
    expect(s.name).toBe('Synthesizer')
    expect(s.systemPrompt).toContain('Cross-Domain')
    expect(s.systemPrompt).toContain('Emergent Insight')
    expect(s.systemPrompt).toContain(':filename.ext')
  })

  it('includes the debugger specialist', () => {
    const s = SPECIALISTS.debugger
    expect(s.id).toBe('debugger')
    expect(s.name).toBe('Debugger')
    expect(s.systemPrompt).toContain('Root Cause')
    expect(s.systemPrompt).toContain('Troubleshooting')
    expect(s.systemPrompt).toContain(':filename.ext')
  })

  it('has 37 total specialists', () => {
    expect(Object.keys(SPECIALISTS).length).toBe(37)
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

  it('returns all 12 new expansion agents by ID', () => {
    expect(getSpecialist('mathematician').name).toBe('Mathematician')
    expect(getSpecialist('biologist').name).toBe('Biologist')
    expect(getSpecialist('economist').name).toBe('Economist')
    expect(getSpecialist('psychologist').name).toBe('Psychologist')
    expect(getSpecialist('engineer').name).toBe('Engineer')
    expect(getSpecialist('medic').name).toBe('Medic')
    expect(getSpecialist('linguist').name).toBe('Linguist')
    expect(getSpecialist('ethicist').name).toBe('Ethicist')
    expect(getSpecialist('educator').name).toBe('Educator')
    expect(getSpecialist('diplomat').name).toBe('Diplomat')
    expect(getSpecialist('synthesizer').name).toBe('Synthesizer')
    expect(getSpecialist('debugger').name).toBe('Debugger')
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
