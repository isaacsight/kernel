// K:BOT Auth Tests
import { describe, it, expect } from 'vitest'
import {
  detectProvider,
  isLocalProvider,
  isKeylessProvider,
  estimateCost,
  getProviderModel,
  selectOllamaModel,
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
    expect(isLocalProvider('openclaw')).toBe(true)
    expect(isLocalProvider('anthropic')).toBe(false)
    expect(isLocalProvider('openai')).toBe(false)
  })

  it('identifies keyless providers', () => {
    expect(isKeylessProvider('ollama')).toBe(true)
    expect(isKeylessProvider('openclaw')).toBe(false)
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
    expect(PROVIDERS.openclaw.inputCost).toBe(0)
    expect(PROVIDERS.openclaw.outputCost).toBe(0)
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
    expect(estimateCost('openclaw', 10000, 5000)).toBe(0)
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
