// Tests for kbot Prompt Cache
import { describe, it, expect, beforeEach } from 'vitest'
import {
  buildCacheablePrompt,
  createPromptSections,
  getPromptCacheStats,
  resetPromptCacheStats,
  type PromptSection,
} from './prompt-cache.js'

beforeEach(() => {
  resetPromptCacheStats()
})

describe('buildCacheablePrompt', () => {
  it('concatenates all sections into text', () => {
    const sections: PromptSection[] = [
      { id: 'persona', text: 'You are kbot.', stable: true },
      { id: 'context', text: 'Working on auth.ts', stable: false },
    ]
    const result = buildCacheablePrompt(sections)
    expect(result.text).toContain('You are kbot.')
    expect(result.text).toContain('Working on auth.ts')
  })

  it('returns cacheBlocks for Anthropic with stable + dynamic', () => {
    const sections: PromptSection[] = [
      { id: 'persona', text: 'Stable persona text', stable: true },
      { id: 'context', text: 'Dynamic context', stable: false },
    ]
    const result = buildCacheablePrompt(sections, 'anthropic')
    expect(result.cacheBlocks).toBeDefined()
    expect(result.cacheBlocks).toHaveLength(2)
    expect(result.cacheBlocks![0].cache_control).toEqual({ type: 'ephemeral' })
    expect(result.cacheBlocks![1].cache_control).toBeUndefined()
  })

  it('returns no cacheBlocks for non-Anthropic providers', () => {
    const sections: PromptSection[] = [
      { id: 'persona', text: 'Stable', stable: true },
      { id: 'context', text: 'Dynamic', stable: false },
    ]
    const result = buildCacheablePrompt(sections, 'openai')
    expect(result.cacheBlocks).toBeUndefined()
  })

  it('skips empty sections', () => {
    const sections: PromptSection[] = [
      { id: 'persona', text: 'Stable', stable: true },
      { id: 'empty', text: '', stable: true },
      { id: 'context', text: 'Dynamic', stable: false },
    ]
    const result = buildCacheablePrompt(sections)
    expect(result.text).not.toContain('\n\n\n')
  })

  it('tracks cache hits for repeated stable content', () => {
    const sections: PromptSection[] = [
      { id: 'persona', text: 'Same stable content', stable: true },
      { id: 'context', text: 'Dynamic 1', stable: false },
    ]
    buildCacheablePrompt(sections)
    const stats1 = getPromptCacheStats()
    expect(stats1.misses).toBe(1)
    expect(stats1.hits).toBe(0)

    // Same stable content, different dynamic
    sections[1].text = 'Dynamic 2'
    buildCacheablePrompt(sections)
    const stats2 = getPromptCacheStats()
    expect(stats2.hits).toBe(1)
    expect(stats2.misses).toBe(1)
  })

  it('tracks cache misses when stable content changes', () => {
    const sections: PromptSection[] = [
      { id: 'persona', text: 'Version A', stable: true },
      { id: 'context', text: 'Dynamic', stable: false },
    ]
    buildCacheablePrompt(sections)
    sections[0].text = 'Version B'
    buildCacheablePrompt(sections)
    const stats = getPromptCacheStats()
    expect(stats.misses).toBe(2)
    expect(stats.hits).toBe(0)
  })
})

describe('createPromptSections', () => {
  it('creates stable sections for persona, rules, matrix, tools', () => {
    const sections = createPromptSections({
      persona: 'You are kbot',
      conversationRules: 'Be helpful',
      matrixPrompt: 'Hacker agent',
      toolInstructions: 'Available tools: ...',
    })
    const stableSections = sections.filter(s => s.stable)
    expect(stableSections).toHaveLength(4)
    expect(stableSections.map(s => s.id)).toContain('persona')
    expect(stableSections.map(s => s.id)).toContain('rules')
    expect(stableSections.map(s => s.id)).toContain('matrix')
    expect(stableSections.map(s => s.id)).toContain('tools')
  })

  it('creates dynamic sections for context, memory, learning', () => {
    const sections = createPromptSections({
      contextSnippet: 'project context',
      memorySnippet: 'memory data',
      learningContext: 'learned patterns',
    })
    const dynamicSections = sections.filter(s => !s.stable)
    expect(dynamicSections).toHaveLength(3)
    expect(dynamicSections.map(s => s.id)).toContain('context')
    expect(dynamicSections.map(s => s.id)).toContain('memory')
    expect(dynamicSections.map(s => s.id)).toContain('learning')
  })

  it('omits sections with undefined values', () => {
    const sections = createPromptSections({ persona: 'kbot' })
    expect(sections).toHaveLength(1)
    expect(sections[0].id).toBe('persona')
  })

  it('returns empty array for no opts', () => {
    expect(createPromptSections({})).toHaveLength(0)
  })

  it('wraps matrixPrompt with Agent Persona header', () => {
    const sections = createPromptSections({ matrixPrompt: 'Hacker persona' })
    expect(sections[0].text).toContain('[Agent Persona]')
    expect(sections[0].text).toContain('Hacker persona')
  })
})

describe('getPromptCacheStats / resetPromptCacheStats', () => {
  it('returns zeroed stats after reset', () => {
    const stats = getPromptCacheStats()
    expect(stats.hits).toBe(0)
    expect(stats.misses).toBe(0)
    expect(stats.lastHash).toBe('')
    expect(stats.estimatedSavings).toBe(0)
  })

  it('returns a copy, not a reference', () => {
    const stats = getPromptCacheStats()
    stats.hits = 999
    expect(getPromptCacheStats().hits).toBe(0)
  })
})
