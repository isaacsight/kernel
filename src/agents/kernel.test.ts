import { describe, it, expect } from 'vitest'
import { KERNEL_AGENT, KERNEL_TOPICS } from './kernel'

describe('KERNEL_AGENT', () => {
  it('has required fields', () => {
    expect(KERNEL_AGENT.id).toBe('kernel')
    expect(KERNEL_AGENT.name).toBe('Kernel')
    expect(KERNEL_AGENT.avatar).toBe('K')
    expect(KERNEL_AGENT.color).toBe('#6B5B95')
  })

  it('has a non-empty system prompt', () => {
    expect(KERNEL_AGENT.systemPrompt.length).toBeGreaterThan(100)
  })

  it('system prompt includes artifact rules', () => {
    expect(KERNEL_AGENT.systemPrompt).toContain(':filename.ext')
  })

  it('system prompt instructs against corporate language', () => {
    expect(KERNEL_AGENT.systemPrompt).toContain('Never "As an AI..."')
  })

  it('system prompt includes crisis protocol', () => {
    expect(KERNEL_AGENT.systemPrompt).toContain('988')
  })
})

describe('KERNEL_TOPICS', () => {
  it('has 4 starter topics', () => {
    expect(KERNEL_TOPICS).toHaveLength(4)
  })

  it('each topic has label and prompt', () => {
    for (const topic of KERNEL_TOPICS) {
      expect(topic.label).toBeTruthy()
      expect(topic.prompt).toBeTruthy()
      expect(topic.prompt.length).toBeGreaterThan(topic.label.length)
    }
  })
})
