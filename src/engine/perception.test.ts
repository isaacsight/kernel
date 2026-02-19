import { describe, it, expect } from 'vitest'
import { perceiveInput, classifyIntent, inferNeed } from './perception'

describe('classifyIntent', () => {
  it('classifies evaluate triggers via keyword fallback', () => {
    const intent = classifyIntent('Should I invest in crypto?', 'should i invest in crypto?')
    expect(intent.type).toBe('evaluate')
  })

  it('classifies build triggers', () => {
    const intent = classifyIntent('Build me a landing page', 'build me a landing page')
    expect(intent.type).toBe('build')
  })

  it('classifies analyze as evaluate in fallback', () => {
    const intent = classifyIntent('Analyze this code architecture', 'analyze this code architecture')
    expect(intent.type).toBe('evaluate')
  })

  it('classifies discussion triggers', () => {
    const intent = classifyIntent("Let's debate AI regulation", "let's debate ai regulation")
    expect(intent.type).toBe('discuss')
  })

  it('defaults to converse for ambiguous input', () => {
    const intent = classifyIntent('Hello, how are you?', 'hello, how are you?')
    expect(intent.type).toBe('converse')
  })

  it('uses AgentRouter result when available', () => {
    const routerResult = { agentId: 'researcher' as const, confidence: 0.9, needsResearch: false, isMultiStep: false, needsSwarm: false }
    const intent = classifyIntent('Tell me about quantum computing', 'tell me about quantum computing', routerResult)
    expect(intent.type).toBe('discuss')
  })

  it('falls back to keywords when AgentRouter confidence is low', () => {
    const routerResult = { agentId: 'kernel' as const, confidence: 0.2, needsResearch: false, isMultiStep: false, needsSwarm: false }
    const intent = classifyIntent('Build me a website', 'build me a website', routerResult)
    expect(intent.type).toBe('build')
  })
})

describe('perceiveInput', () => {
  it('returns correct Perception shape', () => {
    const perception = perceiveInput('Hello world', [])
    expect(perception).toHaveProperty('intent')
    expect(perception).toHaveProperty('urgency')
    expect(perception).toHaveProperty('complexity')
    expect(perception).toHaveProperty('sentiment')
    expect(perception).toHaveProperty('impliedNeed')
    expect(perception).toHaveProperty('keyEntities')
    expect(perception).toHaveProperty('isQuestion')
    expect(perception).toHaveProperty('isFollowUp')
  })

  it('detects urgency', () => {
    const perception = perceiveInput('This is urgent and critical!', [])
    expect(perception.urgency).toBeGreaterThan(0.3)
  })

  it('detects complexity', () => {
    const perception = perceiveInput('Design a distributed system with an optimization framework for scale', [])
    expect(perception.complexity).toBeGreaterThan(0.3)
  })

  it('detects negative sentiment', () => {
    const perception = perceiveInput("This is broken and I'm frustrated", [])
    expect(perception.sentiment).toBeLessThan(0)
  })

  it('detects positive sentiment', () => {
    const perception = perceiveInput('This is great and beautiful!', [])
    expect(perception.sentiment).toBeGreaterThan(0)
  })

  it('detects questions', () => {
    const perception = perceiveInput('What is machine learning?', [])
    expect(perception.isQuestion).toBe(true)
  })

  it('detects follow-ups', () => {
    const perception = perceiveInput('And what about performance?', [{ content: 'previous message' }])
    expect(perception.isFollowUp).toBe(true)
  })

  it('marks first message as not follow-up when starting with non-connector', () => {
    const perception = perceiveInput('Hello there', [])
    expect(perception.isFollowUp).toBe(false)
  })
})

describe('inferNeed', () => {
  it('returns reassurance for negative sentiment', () => {
    const need = inferNeed({ type: 'converse', message: 'test' }, 0, 0, -0.5)
    expect(need).toContain('Reassurance')
  })

  it('returns fast answer for high urgency', () => {
    const need = inferNeed({ type: 'converse', message: 'test' }, 0.8, 0, 0)
    expect(need).toContain('fast')
  })

  it('returns deep analysis for high complexity', () => {
    const need = inferNeed({ type: 'converse', message: 'test' }, 0, 0.8, 0)
    expect(need).toContain('Deep analysis')
  })

  it('returns correct need for each intent type', () => {
    expect(inferNeed({ type: 'discuss', topic: 'test' }, 0, 0, 0)).toContain('perspectives')
    expect(inferNeed({ type: 'reason', question: 'test', domain: 'general' }, 0, 0, 0)).toContain('Rigorous')
    expect(inferNeed({ type: 'build', description: 'test' }, 0, 0, 0)).toContain('concrete')
    expect(inferNeed({ type: 'evaluate', opportunity: 'test' }, 0, 0, 0)).toContain('honest')
    expect(inferNeed({ type: 'converse', message: 'test' }, 0, 0, 0)).toContain('thoughtful')
  })
})
