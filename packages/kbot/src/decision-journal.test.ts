import { describe, it, expect } from 'vitest'
import { narrateLoop, type Decision } from './decision-journal.js'

function loopDecision(over: Partial<Decision> & { iteration: number; phase: string }): Decision {
  return {
    timestamp: '2026-06-30T00:00:00.000Z',
    type: 'engineering-loop',
    decision: over.decision ?? 'do a thing',
    reasoning: over.reasoning ?? ['a reason'],
    alternatives: [],
    confidence: 0.7,
    evidence: { phase: over.phase, iteration: over.iteration },
    userContext: 'goal',
  }
}

describe('narrateLoop', () => {
  it('renders plan/act/decide in iteration order with the first reason', () => {
    const out = narrateLoop([
      loopDecision({ iteration: 1, phase: 'plan', decision: 'fix typo in a.ts', reasoning: ['tsc was red'] }),
      loopDecision({ iteration: 1, phase: 'act', decision: 'applied edit' }),
      loopDecision({ iteration: 1, phase: 'decide', decision: 'continue' }),
    ])
    expect(out).toContain('#1 plan → fix typo in a.ts (because tsc was red)')
    expect(out).toContain('#1 act → applied edit')
    expect(out).toContain('#1 decide → continue')
  })

  it('ignores non-loop decisions and tolerates an empty list', () => {
    expect(narrateLoop([])).toBe('(no engineering-loop decisions)')
    const other: Decision = { ...loopDecision({ iteration: 1, phase: 'plan' }), type: 'tool-choice' }
    expect(narrateLoop([other])).toBe('(no engineering-loop decisions)')
  })
})
