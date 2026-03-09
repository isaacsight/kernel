// K:BOT Auth Tests
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  detectProvider,
  isLocalProvider,
  isKeylessProvider,
  estimateCost,
  getProvider,
  getProviderModel,
  selectOllamaModel,
  PROVIDERS,
} from './auth.js'

describe('Provider Detection', () => {
  it('detects Anthropic keys', () => {
    assert.equal(detectProvider('sk-ant-abc123456789'), 'anthropic')
  })

  it('detects OpenAI project keys', () => {
    assert.equal(detectProvider('sk-proj-abc123456789'), 'openai')
  })

  it('detects Google keys', () => {
    assert.equal(detectProvider('AIzaSyA-test-key-12345'), 'google')
  })

  it('detects Groq keys', () => {
    assert.equal(detectProvider('gsk_abcdefghijklmnop'), 'groq')
  })

  it('detects xAI keys', () => {
    assert.equal(detectProvider('xai-abcdefghijklmnop'), 'xai')
  })

  it('falls back to openai for generic sk- keys', () => {
    assert.equal(detectProvider('sk-generic-key-12345'), 'openai')
  })

  it('returns null for unrecognized keys', () => {
    assert.equal(detectProvider('totally-unknown-format'), null)
  })
})

describe('Provider Properties', () => {
  it('identifies local providers', () => {
    assert.equal(isLocalProvider('ollama'), true)
    assert.equal(isLocalProvider('openclaw'), true)
    assert.equal(isLocalProvider('anthropic'), false)
    assert.equal(isLocalProvider('openai'), false)
  })

  it('identifies keyless providers', () => {
    assert.equal(isKeylessProvider('ollama'), true)
    assert.equal(isKeylessProvider('openclaw'), false)
    assert.equal(isKeylessProvider('anthropic'), false)
  })

  it('all providers have required fields', () => {
    for (const [name, p] of Object.entries(PROVIDERS)) {
      assert.ok(p.name, `${name} missing name`)
      assert.ok(p.apiUrl, `${name} missing apiUrl`)
      assert.ok(p.apiStyle, `${name} missing apiStyle`)
      assert.ok(p.defaultModel, `${name} missing defaultModel`)
      assert.ok(p.fastModel, `${name} missing fastModel`)
      assert.ok(typeof p.inputCost === 'number', `${name} missing inputCost`)
      assert.ok(typeof p.outputCost === 'number', `${name} missing outputCost`)
    }
  })

  it('local providers have zero cost', () => {
    assert.equal(PROVIDERS.ollama.inputCost, 0)
    assert.equal(PROVIDERS.ollama.outputCost, 0)
    assert.equal(PROVIDERS.openclaw.inputCost, 0)
    assert.equal(PROVIDERS.openclaw.outputCost, 0)
  })
})

describe('Cost Estimation', () => {
  it('calculates cost correctly', () => {
    // Anthropic: $3/M input, $15/M output
    const cost = estimateCost('anthropic', 1000, 500)
    assert.ok(cost > 0)
    assert.ok(cost < 1) // Should be small for 1500 tokens
  })

  it('returns zero for local providers', () => {
    assert.equal(estimateCost('ollama', 10000, 5000), 0)
    assert.equal(estimateCost('openclaw', 10000, 5000), 0)
  })
})

describe('Model Selection', () => {
  it('returns fast model for fast speed', () => {
    const model = getProviderModel('anthropic', 'fast')
    assert.equal(model, PROVIDERS.anthropic.fastModel)
  })

  it('returns default model for default speed', () => {
    const model = getProviderModel('anthropic', 'default')
    assert.equal(model, PROVIDERS.anthropic.defaultModel)
  })

  it('routes Ollama code tasks to code models', () => {
    const model = selectOllamaModel('write a typescript function', ['qwen2.5-coder:7b', 'llama3.1:8b'])
    assert.equal(model, 'qwen2.5-coder:7b')
  })

  it('routes Ollama general tasks to general models', () => {
    const model = selectOllamaModel('what is the weather today', ['gemma3:12b', 'llama3.1:8b'])
    // Should pick a general-purpose model
    assert.ok(model)
  })
})
