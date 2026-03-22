// Tests for kbot Memory Synthesis
import { describe, it, expect } from 'vitest'
import { shouldSynthesize, synthesizeMemory, getInsights, getSynthesisContext, getSynthesisStats, formatInsightsForPrompt } from './memory-synthesis.js'

describe('Memory Synthesis', () => {
  it('synthesizeMemory returns valid structure', () => {
    const result = synthesizeMemory()
    expect(result).toHaveProperty('insights')
    expect(result).toHaveProperty('synthesizedAt')
    expect(result).toHaveProperty('observationCount')
    expect(Array.isArray(result.insights)).toBe(true)
    expect(typeof result.synthesizedAt).toBe('string')
    expect(typeof result.observationCount).toBe('number')
  })

  it('insights have correct shape', () => {
    const result = synthesizeMemory()
    for (const insight of result.insights) {
      expect(insight).toHaveProperty('text')
      expect(insight).toHaveProperty('category')
      expect(insight).toHaveProperty('confidence')
      expect(insight).toHaveProperty('supportingCount')
      expect(insight).toHaveProperty('created')
      expect(typeof insight.text).toBe('string')
      expect(typeof insight.confidence).toBe('number')
      expect(insight.confidence).toBeGreaterThanOrEqual(0)
      expect(insight.confidence).toBeLessThanOrEqual(1)
    }
  })

  it('insights are sorted by confidence descending', () => {
    const result = synthesizeMemory()
    for (let i = 1; i < result.insights.length; i++) {
      expect(result.insights[i].confidence).toBeLessThanOrEqual(result.insights[i - 1].confidence)
    }
  })

  it('insights are capped at 50', () => {
    const result = synthesizeMemory()
    expect(result.insights.length).toBeLessThanOrEqual(50)
  })

  it('getInsights respects max parameter', () => {
    const insights = getInsights(undefined, 3)
    expect(insights.length).toBeLessThanOrEqual(3)
  })

  it('getInsights filters by category', () => {
    const insights = getInsights('tool_preference')
    for (const i of insights) {
      expect(i.category).toBe('tool_preference')
    }
  })

  it('getSynthesisContext returns string', () => {
    const ctx = getSynthesisContext()
    expect(typeof ctx).toBe('string')
  })

  it('getSynthesisStats returns valid stats', () => {
    const stats = getSynthesisStats()
    expect(stats).toHaveProperty('insightCount')
    expect(stats).toHaveProperty('lastSynthesized')
    expect(stats).toHaveProperty('observationCount')
    expect(stats).toHaveProperty('topInsights')
    expect(typeof stats.insightCount).toBe('number')
    expect(Array.isArray(stats.topInsights)).toBe(true)
  })

  it('formatInsightsForPrompt handles empty array', () => {
    expect(formatInsightsForPrompt([])).toBe('')
  })

  it('formatInsightsForPrompt formats insights correctly', () => {
    const result = formatInsightsForPrompt([{
      text: 'Test insight',
      category: 'workflow',
      confidence: 0.85,
      supportingCount: 10,
      created: new Date().toISOString(),
    }])
    expect(result).toContain('Test insight')
    expect(result).toContain('85%')
    expect(result).toContain('[Synthesized User Insights]')
  })
})

describe('shouldSynthesize', () => {
  it('returns a boolean', () => {
    const result = shouldSynthesize()
    expect(typeof result).toBe('boolean')
  })
})
