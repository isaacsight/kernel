// kbot Agent Definition Tests — Creative & Developer
import { describe, it, expect } from 'vitest'

import {
  CREATIVE_PRESET, CREATIVE_BUILTIN, CREATIVE_KEYWORDS,
  CREATIVE_PATTERNS, CREATIVE_AGENT_ENTRY,
} from './creative.js'

import {
  DEVELOPER_PRESET, DEVELOPER_BUILTIN, DEVELOPER_KEYWORDS,
  DEVELOPER_PATTERNS, DEVELOPER_AGENT_ENTRY,
} from './developer.js'

describe('Creative Agent', () => {
  it('has valid preset structure', () => {
    expect(CREATIVE_PRESET.name).toBe('Creative')
    expect(CREATIVE_PRESET.prompt).toContain('creative intelligence specialist')
    expect(CREATIVE_PRESET.prompt.length).toBeGreaterThan(500)
  })

  it('has valid builtin structure', () => {
    expect(CREATIVE_BUILTIN.name).toBe('Creative')
    expect(CREATIVE_BUILTIN.icon).toBe('✧')
    expect(CREATIVE_BUILTIN.color).toBe('#E879F9')
    expect(CREATIVE_BUILTIN.prompt).toBe(CREATIVE_PRESET.prompt)
  })

  it('has keywords for routing', () => {
    expect(CREATIVE_KEYWORDS.length).toBeGreaterThan(20)
    expect(CREATIVE_KEYWORDS).toContain('generative')
    expect(CREATIVE_KEYWORDS).toContain('shader')
    expect(CREATIVE_KEYWORDS).toContain('music')
    expect(CREATIVE_KEYWORDS).toContain('fractal')
  })

  it('has routing patterns that match creative intents', () => {
    expect(CREATIVE_PATTERNS.length).toBeGreaterThan(5)

    // Test pattern matching
    const testCases = [
      { input: 'create a generative art sketch', shouldMatch: true },
      { input: 'write a GLSL shader for water', shouldMatch: true },
      { input: 'build a p5.js animation', shouldMatch: true },
      { input: 'generate sonic pi music', shouldMatch: true },
      { input: 'create a particle system with flocking', shouldMatch: true },
      { input: 'fix the database migration', shouldMatch: false },
    ]

    for (const tc of testCases) {
      const matched = CREATIVE_PATTERNS.some(p => p.pattern.test(tc.input))
      expect(matched).toBe(tc.shouldMatch)
    }
  })

  it('all patterns target creative agent', () => {
    for (const p of CREATIVE_PATTERNS) {
      expect(p.agent).toBe('creative')
      expect(p.confidence).toBeGreaterThanOrEqual(0.7)
      expect(p.confidence).toBeLessThanOrEqual(1.0)
    }
  })

  it('has valid agent entry for bridge', () => {
    expect(CREATIVE_AGENT_ENTRY.id).toBe('creative')
    expect(CREATIVE_AGENT_ENTRY.name).toBe('Creative')
    expect(CREATIVE_AGENT_ENTRY.description).toBeTruthy()
  })
})

describe('Developer Agent', () => {
  it('has valid preset structure', () => {
    expect(DEVELOPER_PRESET.name).toBe('Developer')
    expect(DEVELOPER_PRESET.prompt).toContain('kbot Developer agent')
    expect(DEVELOPER_PRESET.prompt.length).toBeGreaterThan(500)
  })

  it('contains architecture documentation in prompt', () => {
    const prompt = DEVELOPER_PRESET.prompt
    expect(prompt).toContain('cli.ts')
    expect(prompt).toContain('agent.ts')
    expect(prompt).toContain('matrix.ts')
    expect(prompt).toContain('registerTool')
    expect(prompt).toContain('flat parameter schema')
    expect(prompt).toContain('7 files')
  })

  it('has valid builtin structure', () => {
    expect(DEVELOPER_BUILTIN.name).toBe('Developer')
    expect(DEVELOPER_BUILTIN.icon).toBe('⚙')
    expect(DEVELOPER_BUILTIN.color).toBe('#38BDF8')
    expect(DEVELOPER_BUILTIN.prompt).toBe(DEVELOPER_PRESET.prompt)
  })

  it('has keywords for routing', () => {
    expect(DEVELOPER_KEYWORDS.length).toBeGreaterThan(20)
    expect(DEVELOPER_KEYWORDS).toContain('kbot')
    expect(DEVELOPER_KEYWORDS).toContain('register')
    expect(DEVELOPER_KEYWORDS).toContain('specialist')
    expect(DEVELOPER_KEYWORDS).toContain('mcp')
  })

  it('has routing patterns that match developer intents', () => {
    expect(DEVELOPER_PATTERNS.length).toBeGreaterThan(5)

    const testCases = [
      { input: 'kbot add a new tool', shouldMatch: true },
      { input: 'fix the tool registry', shouldMatch: true },
      { input: 'npm publish kbot', shouldMatch: true },
      { input: 'update bridge.ts for IDE integration', shouldMatch: true },
      { input: 'kbot self-improvement loop', shouldMatch: true },
      { input: 'write a blog post about cooking', shouldMatch: false },
    ]

    for (const tc of testCases) {
      const matched = DEVELOPER_PATTERNS.some(p => p.pattern.test(tc.input))
      expect(matched).toBe(tc.shouldMatch)
    }
  })

  it('all patterns target developer agent', () => {
    for (const p of DEVELOPER_PATTERNS) {
      expect(p.agent).toBe('developer')
      expect(p.confidence).toBeGreaterThanOrEqual(0.7)
      expect(p.confidence).toBeLessThanOrEqual(1.0)
    }
  })

  it('has valid agent entry for bridge', () => {
    expect(DEVELOPER_AGENT_ENTRY.id).toBe('developer')
    expect(DEVELOPER_AGENT_ENTRY.name).toBe('Developer')
    expect(DEVELOPER_AGENT_ENTRY.description).toBeTruthy()
  })
})

describe('Agent Uniqueness', () => {
  it('creative and developer have different IDs', () => {
    expect(CREATIVE_AGENT_ENTRY.id).not.toBe(DEVELOPER_AGENT_ENTRY.id)
  })

  it('creative and developer have different colors', () => {
    expect(CREATIVE_BUILTIN.color).not.toBe(DEVELOPER_BUILTIN.color)
  })

  it('creative and developer have different icons', () => {
    expect(CREATIVE_BUILTIN.icon).not.toBe(DEVELOPER_BUILTIN.icon)
  })

  it('keyword lists do not significantly overlap', () => {
    const creativeSet = new Set(CREATIVE_KEYWORDS)
    const overlap = DEVELOPER_KEYWORDS.filter(k => creativeSet.has(k))
    // Some overlap is expected (e.g., 'agent'), but should be <30%
    const overlapRatio = overlap.length / Math.min(CREATIVE_KEYWORDS.length, DEVELOPER_KEYWORDS.length)
    expect(overlapRatio).toBeLessThan(0.3)
  })
})
