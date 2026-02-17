import { describe, it, expect } from 'vitest'
import { countSignals, extractKeyEntities, URGENCY_SIGNALS, COMPLEXITY_SIGNALS, NEGATIVE_SIGNALS, POSITIVE_SIGNALS } from './textAnalysis'

describe('countSignals', () => {
  it('counts matching signals in text', () => {
    expect(countSignals('this is urgent and critical', URGENCY_SIGNALS)).toBe(2)
  })

  it('returns 0 for no matches', () => {
    expect(countSignals('hello world', URGENCY_SIGNALS)).toBe(0)
  })

  it('is case insensitive', () => {
    expect(countSignals('This is URGENT', URGENCY_SIGNALS)).toBe(1)
  })

  it('detects complexity signals', () => {
    // design, distributed, system, architecture = 4
    expect(countSignals('design a distributed system architecture', COMPLEXITY_SIGNALS)).toBe(4)
  })

  it('detects negative sentiment', () => {
    // 'broken' matches, 'frustrating' does not (signal list has 'frustrated' not 'frustrating')
    expect(countSignals('this is broken and frustrating', NEGATIVE_SIGNALS)).toBe(1)
  })

  it('detects positive sentiment', () => {
    expect(countSignals('this is great and beautiful', POSITIVE_SIGNALS)).toBe(2)
  })
})

describe('extractKeyEntities', () => {
  it('extracts capitalized words (3+ letters after capital)', () => {
    // Regex: /\b[A-Z][a-z]{2,}\b/ — needs capital + 2+ lowercase
    // 'Check' matches, 'React' matches, 'TypeScript' has a mid-capital so doesn't match the simple pattern
    const entities = extractKeyEntities('Check out React and Vue')
    expect(entities).toContain('React')
    expect(entities).toContain('Check')
    expect(entities).toContain('Vue')
  })

  it('extracts quoted phrases', () => {
    const entities = extractKeyEntities('What is "machine learning"?')
    expect(entities).toContain('machine learning')
  })

  it('limits to 5 entities', () => {
    const entities = extractKeyEntities('Alpha Beta Gamma Delta Epsilon Zeta Eta Theta')
    expect(entities.length).toBeLessThanOrEqual(5)
  })

  it('returns empty array for no entities', () => {
    const entities = extractKeyEntities('hello world')
    expect(entities).toEqual([])
  })

  it('deduplicates entities', () => {
    const entities = extractKeyEntities('React is great. React is amazing.')
    const reactCount = entities.filter(e => e === 'React').length
    expect(reactCount).toBe(1)
  })
})
