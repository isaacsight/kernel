// kbot Auth Tests
import { describe, it, expect } from 'vitest'
import {
  detectProvider,
  isLocalProvider,
  isKeylessProvider,
  estimateCost,
  getProviderModel,
  selectOllamaModel,
  classifyComplexity,
  routeModelForTask,
  PROVIDERS,
} from './auth.js'

describe('Provider Detection', () => {
  it('detects Anthropic keys', () => {
    expect(detectProvider('sk-ant-abc123456789')).toBe('anthropic')
  })

  it('detects OpenAI project keys', () => {
    expect(detectProvider('sk-proj-abc123456789')).toBe('openai')
  })

  it('detects Google keys', () => {
    expect(detectProvider('AIzaSyA-test-key-12345')).toBe('google')
  })

  it('detects Groq keys', () => {
    expect(detectProvider('gsk_abcdefghijklmnop')).toBe('groq')
  })

  it('detects xAI keys', () => {
    expect(detectProvider('xai-abcdefghijklmnop')).toBe('xai')
  })

  it('falls back to openai for generic sk- keys', () => {
    expect(detectProvider('sk-generic-key-12345')).toBe('openai')
  })

  it('returns null for unrecognized keys', () => {
    expect(detectProvider('totally-unknown-format')).toBeNull()
  })
})

describe('Provider Properties', () => {
  it('identifies local providers', () => {
    expect(isLocalProvider('ollama')).toBe(true)
    expect(isLocalProvider('kbot-local')).toBe(true)
    expect(isLocalProvider('anthropic')).toBe(false)
    expect(isLocalProvider('openai')).toBe(false)
  })

  it('identifies keyless providers', () => {
    expect(isKeylessProvider('ollama')).toBe(true)
    expect(isKeylessProvider('kbot-local')).toBe(false)
    expect(isKeylessProvider('anthropic')).toBe(false)
  })

  it('all providers have required fields', () => {
    for (const [name, p] of Object.entries(PROVIDERS)) {
      expect(p.name, `${name} missing name`).toBeTruthy()
      expect(p.apiUrl, `${name} missing apiUrl`).toBeTruthy()
      expect(p.apiStyle, `${name} missing apiStyle`).toBeTruthy()
      expect(p.defaultModel, `${name} missing defaultModel`).toBeTruthy()
      expect(p.fastModel, `${name} missing fastModel`).toBeTruthy()
      expect(typeof p.inputCost).toBe('number')
      expect(typeof p.outputCost).toBe('number')
    }
  })

  it('local providers have zero cost', () => {
    expect(PROVIDERS.ollama.inputCost).toBe(0)
    expect(PROVIDERS.ollama.outputCost).toBe(0)
    expect(PROVIDERS['kbot-local'].inputCost).toBe(0)
    expect(PROVIDERS['kbot-local'].outputCost).toBe(0)
  })
})

describe('Cost Estimation', () => {
  it('calculates cost correctly', () => {
    const cost = estimateCost('anthropic', 1000, 500)
    expect(cost).toBeGreaterThan(0)
    expect(cost).toBeLessThan(1)
  })

  it('returns zero for local providers', () => {
    expect(estimateCost('ollama', 10000, 5000)).toBe(0)
    expect(estimateCost('kbot-local', 10000, 5000)).toBe(0)
  })

  it('scales linearly with token count', () => {
    const cost1 = estimateCost('anthropic', 1000, 1000)
    const cost2 = estimateCost('anthropic', 2000, 2000)
    expect(cost2).toBeCloseTo(cost1 * 2, 5)
  })
})

describe('Model Selection', () => {
  it('returns fast model for fast speed', () => {
    const model = getProviderModel('anthropic', 'fast')
    expect(model).toBe(PROVIDERS.anthropic.fastModel)
  })

  it('returns default model for default speed', () => {
    const model = getProviderModel('anthropic', 'default')
    expect(model).toBe(PROVIDERS.anthropic.defaultModel)
  })

  it('routes Ollama code tasks to code models', () => {
    const model = selectOllamaModel('write a typescript function', ['qwen2.5-coder:7b', 'llama3.1:8b'])
    // Should pick a code-oriented model (qwen2.5-coder family)
    expect(model).toContain('qwen2.5-coder')
  })

  it('routes Ollama general tasks to general models', () => {
    const model = selectOllamaModel('what is the weather today', ['gemma3:12b', 'llama3.1:8b'])
    expect(model).toBeTruthy()
  })
})

describe('classifyComplexity', () => {
  it('classifies greetings as trivial', () => {
    expect(classifyComplexity('hi')).toBe('trivial')
    expect(classifyComplexity('hello')).toBe('trivial')
    expect(classifyComplexity('thanks')).toBe('trivial')
    expect(classifyComplexity('bye')).toBe('trivial')
  })

  it('does not classify long messages as trivial', () => {
    expect(classifyComplexity('hello world what is this long sentence about')).not.toBe('trivial')
  })

  it('classifies reasoning requests', () => {
    expect(classifyComplexity('explain why this architecture is better')).toBe('reasoning')
    expect(classifyComplexity('compare React and Vue')).toBe('reasoning')
    expect(classifyComplexity('what are the pros and cons of microservices')).toBe('reasoning')
    expect(classifyComplexity('design a system for handling payments')).toBe('reasoning')
  })

  it('classifies complex multi-file tasks', () => {
    expect(classifyComplexity('refactor the authentication module')).toBe('complex')
    expect(classifyComplexity('migrate the database to PostgreSQL')).toBe('complex')
    expect(classifyComplexity('rewrite the entire caching layer')).toBe('complex')
  })

  it('classifies very long messages as complex', () => {
    const longMessage = Array(101).fill('word').join(' ')
    expect(classifyComplexity(longMessage)).toBe('complex')
  })

  it('classifies code generation as moderate', () => {
    expect(classifyComplexity('create a function to validate emails')).toBe('moderate')
    expect(classifyComplexity('fix the login bug')).toBe('moderate')
    expect(classifyComplexity('add a new test for the auth module')).toBe('moderate')
  })

  it('classifies simple questions as simple', () => {
    expect(classifyComplexity('what time is it in Tokyo')).toBe('simple')
    expect(classifyComplexity('how many users do we have')).toBe('simple')
  })
})

describe('routeModelForTask', () => {
  it('routes trivial tasks to fast model', () => {
    const result = routeModelForTask('anthropic', 'hi')
    expect(result.model).toBe(PROVIDERS.anthropic.fastModel)
    expect(result.reason).toContain('trivial')
  })

  it('routes complex tasks to default model', () => {
    const result = routeModelForTask('anthropic', 'refactor the entire authentication system')
    expect(result.model).toBe(PROVIDERS.anthropic.defaultModel)
    expect(result.reason).toContain('complex')
  })

  it('routes reasoning tasks to default model', () => {
    const result = routeModelForTask('anthropic', 'explain why this design is better')
    expect(result.model).toBe(PROVIDERS.anthropic.defaultModel)
    expect(result.reason).toContain('reasoning')
  })

  it('works across providers', () => {
    for (const provider of ['anthropic', 'openai', 'google', 'groq'] as const) {
      const result = routeModelForTask(provider, 'hello')
      expect(result.model).toBe(PROVIDERS[provider].fastModel)
    }
  })
})
