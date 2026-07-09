import { describe, it, expect, afterEach } from 'vitest'
import {
  detectProvider,
  isLocalProvider,
  isKeylessProvider,
  estimateCost,
  getProviderModel,
  selectOllamaModel,
  classifyComplexity,
  routeModelForTask,
  usesAdaptiveThinking,
  anthropicThinkingConfig,
  anthropicInputCostPerMTok,
  anthropicOutputCostPerMTok,
  anthropicRefusalFallback,
  modelRequiresDataRetention,
  dataRetentionNotice,
  isProviderConfigured,
  isProviderReachable,
  getProviderKey,
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

describe('Anthropic model capabilities', () => {
  describe('usesAdaptiveThinking', () => {
    // Adaptive-only models: the legacy budget_tokens form 400s on these.
    it.each([
      'claude-fable-5',
      'claude-mythos-5',
      'claude-opus-4-7',
      'claude-opus-4-8',
      'claude-sonnet-5',
    ])('requires adaptive thinking for %s', (model) => {
      expect(usesAdaptiveThinking(model)).toBe(true)
    })

    // Legacy-thinking models. Opus 4.6 stays here deliberately: adaptive is
    // recommended on it, but our adaptive config sends `display` (4.7+ param).
    it.each([
      'claude-opus-4-6',
      'claude-sonnet-4-6',
      'claude-haiku-4-5-20251001',
      'some-unknown-model',
    ])('uses legacy thinking for %s', (model) => {
      expect(usesAdaptiveThinking(model)).toBe(false)
    })

    it('resolves date-suffixed IDs by substring', () => {
      expect(usesAdaptiveThinking('claude-fable-5-20260101')).toBe(true)
    })
  })

  describe('anthropicThinkingConfig', () => {
    it('emits adaptive+summarized for adaptive-only models', () => {
      expect(anthropicThinkingConfig('claude-fable-5')).toEqual({ type: 'adaptive', display: 'summarized' })
    })

    it('emits the legacy budgeted form for older models', () => {
      expect(anthropicThinkingConfig('claude-sonnet-4-6', 12000)).toEqual({ type: 'enabled', budget_tokens: 12000 })
    })
  })

  describe('anthropicInputCostPerMTok', () => {
    // Pricing per platform.claude.com (2026-06): Fable/Mythos $10, Opus 4.6+
    // $5, Sonnet $3, Haiku 4.5 $1. Legacy Opus (pre-4.6) keeps $15.
    it.each([
      ['claude-fable-5', 10],
      ['claude-mythos-5', 10],
      ['claude-opus-4-8', 5],
      ['claude-opus-4-6', 5],
      ['claude-opus-4-1', 15],
      ['claude-haiku-4-5-20251001', 1],
      ['claude-sonnet-4-6', 3],
    ])('prices %s at $%d/MTok input', (model, cost) => {
      expect(anthropicInputCostPerMTok(model)).toBe(cost)
    })

    it('falls back to Sonnet-class pricing for unknown models', () => {
      expect(anthropicInputCostPerMTok('totally-unknown')).toBe(3)
    })
  })

  describe('estimateCost per-model resolution', () => {
    it('costs Fable 5 at $10/$50 instead of the provider-level Sonnet rate', () => {
      // 1M in + 1M out: $60 on Fable 5, $18 at the provider default.
      expect(estimateCost('anthropic', 1_000_000, 1_000_000, 'claude-fable-5')).toBe(60)
      expect(estimateCost('anthropic', 1_000_000, 1_000_000)).toBe(18)
    })
  })

  describe('anthropicOutputCostPerMTok', () => {
    it.each([
      ['claude-fable-5', 50],
      ['claude-mythos-5', 50],
      ['claude-opus-4-8', 25],
      ['claude-sonnet-4-6', 15],
      ['claude-haiku-4-5-20251001', 5],
      ['totally-unknown', 15],
    ])('prices %s at $%d/MTok output', (model, cost) => {
      expect(anthropicOutputCostPerMTok(model)).toBe(cost)
    })
  })

  describe('anthropicRefusalFallback', () => {
    afterEach(() => { delete process.env.KBOT_REFUSAL_FALLBACK })

    it('opts Fable 5 into the server-side Opus 4.8 fallback by default', () => {
      expect(anthropicRefusalFallback('claude-fable-5')).toEqual({
        beta: 'server-side-fallback-2026-06-01',
        fallbacks: [{ model: 'claude-opus-4-8' }],
      })
      expect(anthropicRefusalFallback('claude-mythos-5')).not.toBeNull()
    })

    it('returns null for models without a refusal classifier', () => {
      expect(anthropicRefusalFallback('claude-opus-4-8')).toBeNull()
      expect(anthropicRefusalFallback('claude-sonnet-4-6')).toBeNull()
      expect(anthropicRefusalFallback('totally-unknown')).toBeNull()
    })

    it('honours the KBOT_REFUSAL_FALLBACK=off escape hatch', () => {
      process.env.KBOT_REFUSAL_FALLBACK = 'off'
      expect(anthropicRefusalFallback('claude-fable-5')).toBeNull()
    })
  })

  describe('data retention (Fable 5 / Mythos 5 require 30-day retention)', () => {
    it('flags only retention-requiring models', () => {
      expect(modelRequiresDataRetention('claude-fable-5')).toBe(true)
      expect(modelRequiresDataRetention('claude-mythos-5')).toBe(true)
      expect(modelRequiresDataRetention('claude-opus-4-8')).toBe(false)
      expect(modelRequiresDataRetention('claude-sonnet-4-6')).toBe(false)
    })

    it('emits the retention notice once per process per model', () => {
      const first = dataRetentionNotice('claude-fable-5')
      expect(first).toContain('30-day data retention')
      expect(dataRetentionNotice('claude-fable-5')).toBeNull()
      expect(dataRetentionNotice('claude-opus-4-8')).toBeNull()
    })
  })

  describe('Anthropic catalog', () => {
    it('carries current-generation IDs and no invented ones', () => {
      const models = PROVIDERS.anthropic.models ?? []
      expect(models).toContain('claude-fable-5')
      expect(models).toContain('claude-mythos-5')
      expect(models).toContain('claude-opus-4-8')
      expect(models).not.toContain('claude-mythos-1')
    })
  })

  describe('Provider Configuration and Reachability', () => {
    it('detects keyless providers as configured', () => {
      expect(isProviderConfigured('ollama')).toBe(true)
      expect(isProviderConfigured('hermes')).toBe(true)
    })

    it('returns local API keys correctly', () => {
      expect(getProviderKey('ollama')).toBe('local')
      expect(getProviderKey('hermes')).toBe('local')
    })

    it('identifies non-local cloud providers as reachable by default', async () => {
      const reachable = await isProviderReachable('openai')
      expect(reachable).toBe(true)
    })
  })
})
