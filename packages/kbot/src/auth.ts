// K:BOT Auth — API key management and configuration
// Stores config in ~/.kbot/config.json
//
// Supports two modes:
// 1. Kernel API key (kn_live_...) — uses Kernel's routing + agents, message-based billing
// 2. BYOK (Bring Your Own Key) — user's own LLM key, still gets Kernel routing for free
//    Supported: Anthropic, OpenAI, Google, Mistral, xAI (Grok), DeepSeek,
//              Groq, Together AI, Fireworks, Perplexity, Cohere, NVIDIA NIM

import { homedir } from 'node:os'
import { join } from 'node:path'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'

const KBOT_DIR = join(homedir(), '.kbot')
const CONFIG_PATH = join(KBOT_DIR, 'config.json')
const API_BASE = 'https://eoxxpyixdieprsxlpwcs.supabase.co/functions/v1/kernel-api'

// ── All supported providers ──

export type ByokProvider =
  | 'anthropic'    // Claude
  | 'openai'       // GPT
  | 'google'       // Gemini
  | 'mistral'      // Mistral / Codestral
  | 'xai'          // Grok
  | 'deepseek'     // DeepSeek
  | 'groq'         // Groq (fast inference)
  | 'together'     // Together AI (open-source models)
  | 'fireworks'    // Fireworks AI
  | 'perplexity'   // Perplexity (search-augmented)
  | 'cohere'       // Cohere (Command R)
  | 'nvidia'       // NVIDIA NIM (Llama, Nemotron)

export interface ProviderConfig {
  name: string             // Display name
  apiUrl: string           // Base URL for chat completions
  apiStyle: 'anthropic' | 'openai' | 'google' | 'cohere'  // API format
  defaultModel: string     // Best model
  fastModel: string        // Fast/cheap model
  inputCost: number        // USD per million input tokens
  outputCost: number       // USD per million output tokens
  authHeader: 'x-api-key' | 'bearer'  // How auth is sent
}

export const PROVIDERS: Record<ByokProvider, ProviderConfig> = {
  anthropic: {
    name: 'Anthropic (Claude)',
    apiUrl: 'https://api.anthropic.com/v1/messages',
    apiStyle: 'anthropic',
    defaultModel: 'claude-sonnet-4-6',
    fastModel: 'claude-haiku-4-5-20251001',
    inputCost: 3.0,
    outputCost: 15.0,
    authHeader: 'x-api-key',
  },
  openai: {
    name: 'OpenAI (GPT)',
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    apiStyle: 'openai',
    defaultModel: 'gpt-4o',
    fastModel: 'gpt-4o-mini',
    inputCost: 2.5,
    outputCost: 10.0,
    authHeader: 'bearer',
  },
  google: {
    name: 'Google (Gemini)',
    apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
    apiStyle: 'google',
    defaultModel: 'gemini-2.5-flash',
    fastModel: 'gemini-2.0-flash',
    inputCost: 0.15,
    outputCost: 0.60,
    authHeader: 'bearer', // uses ?key= param instead
  },
  mistral: {
    name: 'Mistral AI',
    apiUrl: 'https://api.mistral.ai/v1/chat/completions',
    apiStyle: 'openai',
    defaultModel: 'mistral-large-latest',
    fastModel: 'mistral-small-latest',
    inputCost: 2.0,
    outputCost: 6.0,
    authHeader: 'bearer',
  },
  xai: {
    name: 'xAI (Grok)',
    apiUrl: 'https://api.x.ai/v1/chat/completions',
    apiStyle: 'openai',
    defaultModel: 'grok-3',
    fastModel: 'grok-3-mini',
    inputCost: 3.0,
    outputCost: 15.0,
    authHeader: 'bearer',
  },
  deepseek: {
    name: 'DeepSeek',
    apiUrl: 'https://api.deepseek.com/chat/completions',
    apiStyle: 'openai',
    defaultModel: 'deepseek-chat',
    fastModel: 'deepseek-chat',
    inputCost: 0.27,
    outputCost: 1.10,
    authHeader: 'bearer',
  },
  groq: {
    name: 'Groq',
    apiUrl: 'https://api.groq.com/openai/v1/chat/completions',
    apiStyle: 'openai',
    defaultModel: 'llama-3.3-70b-versatile',
    fastModel: 'llama-3.1-8b-instant',
    inputCost: 0.59,
    outputCost: 0.79,
    authHeader: 'bearer',
  },
  together: {
    name: 'Together AI',
    apiUrl: 'https://api.together.xyz/v1/chat/completions',
    apiStyle: 'openai',
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    fastModel: 'meta-llama/Llama-3.1-8B-Instruct-Turbo',
    inputCost: 0.88,
    outputCost: 0.88,
    authHeader: 'bearer',
  },
  fireworks: {
    name: 'Fireworks AI',
    apiUrl: 'https://api.fireworks.ai/inference/v1/chat/completions',
    apiStyle: 'openai',
    defaultModel: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
    fastModel: 'accounts/fireworks/models/llama-v3p1-8b-instruct',
    inputCost: 0.90,
    outputCost: 0.90,
    authHeader: 'bearer',
  },
  perplexity: {
    name: 'Perplexity',
    apiUrl: 'https://api.perplexity.ai/chat/completions',
    apiStyle: 'openai',
    defaultModel: 'sonar-pro',
    fastModel: 'sonar',
    inputCost: 3.0,
    outputCost: 15.0,
    authHeader: 'bearer',
  },
  cohere: {
    name: 'Cohere',
    apiUrl: 'https://api.cohere.com/v2/chat',
    apiStyle: 'cohere',
    defaultModel: 'command-r-plus',
    fastModel: 'command-r',
    inputCost: 2.5,
    outputCost: 10.0,
    authHeader: 'bearer',
  },
  nvidia: {
    name: 'NVIDIA NIM',
    apiUrl: 'https://integrate.api.nvidia.com/v1/chat/completions',
    apiStyle: 'openai',
    defaultModel: 'nvidia/llama-3.3-nemotron-super-49b-v1',
    fastModel: 'nvidia/llama-3.1-nemotron-nano-8b-v1',
    inputCost: 0.80,
    outputCost: 1.20,
    authHeader: 'bearer',
  },
}

export interface KbotConfig {
  api_key: string
  default_model: 'auto' | 'sonnet' | 'haiku'
  default_agent: 'auto' | string
  api_base: string
  tier?: string
  monthly_limit?: number
  // BYOK fields
  byok_key?: string
  byok_enabled?: boolean
  byok_provider?: ByokProvider
}

function ensureDir(): void {
  if (!existsSync(KBOT_DIR)) {
    mkdirSync(KBOT_DIR, { recursive: true })
  }
  const memDir = join(KBOT_DIR, 'memory')
  const histDir = join(KBOT_DIR, 'history')
  if (!existsSync(memDir)) mkdirSync(memDir, { recursive: true })
  if (!existsSync(histDir)) mkdirSync(histDir, { recursive: true })
}

export function loadConfig(): KbotConfig | null {
  try {
    if (!existsSync(CONFIG_PATH)) return null
    const raw = readFileSync(CONFIG_PATH, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function saveConfig(config: KbotConfig): void {
  ensureDir()
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2))
}

export function getApiKey(): string | null {
  const envKey = process.env.KBOT_API_KEY
  if (envKey) return envKey
  const config = loadConfig()
  return config?.api_key || null
}

export function getApiBase(): string {
  const config = loadConfig()
  return config?.api_base || API_BASE
}

export function getDefaultModel(): string {
  const config = loadConfig()
  return config?.default_model || 'auto'
}

export function getDefaultAgent(): string {
  const config = loadConfig()
  return config?.default_agent || 'auto'
}

// ── Key prefix → provider detection ──

const KEY_PREFIXES: Array<{ prefix: string; provider: ByokProvider }> = [
  { prefix: 'sk-ant-',  provider: 'anthropic' },
  { prefix: 'sk-proj-', provider: 'openai' },    // OpenAI project keys
  { prefix: 'sk-or-',   provider: 'openai' },    // OpenAI org keys
  { prefix: 'AIza',     provider: 'google' },
  { prefix: 'gsk_',     provider: 'groq' },
  { prefix: 'pplx-',    provider: 'perplexity' },
  { prefix: 'xai-',     provider: 'xai' },
  { prefix: 'dsk-',     provider: 'deepseek' },   // Some DeepSeek keys
  { prefix: 'fw_',      provider: 'fireworks' },
  { prefix: 'nvapi-',   provider: 'nvidia' },
  // sk- is last because it's the most generic (OpenAI, Mistral, Together, etc.)
  // These providers all use sk- so we can't distinguish them by prefix alone
]

/** Detect provider from API key prefix. Returns null if ambiguous. */
export function detectProvider(key: string): ByokProvider | null {
  for (const { prefix, provider } of KEY_PREFIXES) {
    if (key.startsWith(prefix)) return provider
  }
  // Generic sk- keys could be OpenAI, Mistral, Together, or others
  if (key.startsWith('sk-')) return 'openai'
  return null
}

// ── ENV var → provider mapping ──

const ENV_KEYS: Array<{ env: string; provider: ByokProvider }> = [
  { env: 'ANTHROPIC_API_KEY',   provider: 'anthropic' },
  { env: 'OPENAI_API_KEY',      provider: 'openai' },
  { env: 'GOOGLE_API_KEY',      provider: 'google' },
  { env: 'MISTRAL_API_KEY',     provider: 'mistral' },
  { env: 'XAI_API_KEY',         provider: 'xai' },
  { env: 'DEEPSEEK_API_KEY',    provider: 'deepseek' },
  { env: 'GROQ_API_KEY',        provider: 'groq' },
  { env: 'TOGETHER_API_KEY',    provider: 'together' },
  { env: 'FIREWORKS_API_KEY',   provider: 'fireworks' },
  { env: 'PERPLEXITY_API_KEY',  provider: 'perplexity' },
  { env: 'COHERE_API_KEY',      provider: 'cohere' },
  { env: 'NVIDIA_API_KEY',      provider: 'nvidia' },
]

/** Check if BYOK mode is enabled (via env var or config) */
export function isByokEnabled(): boolean {
  for (const { env } of ENV_KEYS) {
    if (process.env[env]) return true
  }
  const config = loadConfig()
  return config?.byok_enabled === true && !!config?.byok_key
}

/** Get the active BYOK provider */
export function getByokProvider(): ByokProvider {
  for (const { env, provider } of ENV_KEYS) {
    if (process.env[env]) return provider
  }
  const config = loadConfig()
  return config?.byok_provider || 'anthropic'
}

/** Get the BYOK API key */
export function getByokKey(): string | null {
  for (const { env } of ENV_KEYS) {
    const val = process.env[env]
    if (val) return val
  }
  const config = loadConfig()
  return config?.byok_key || null
}

/** Get provider config */
export function getProvider(provider: ByokProvider): ProviderConfig {
  return PROVIDERS[provider]
}

/** Get model name for provider */
export function getProviderModel(provider: ByokProvider, speed: 'default' | 'fast'): string {
  const p = PROVIDERS[provider]
  return speed === 'fast' ? p.fastModel : p.defaultModel
}

/** Get the provider API URL */
export function getProviderUrl(provider: ByokProvider): string {
  return PROVIDERS[provider].apiUrl
}

/** Estimate cost */
export function estimateCost(provider: ByokProvider, inputTokens: number, outputTokens: number): number {
  const p = PROVIDERS[provider]
  return (inputTokens * p.inputCost / 1_000_000) + (outputTokens * p.outputCost / 1_000_000)
}

// Legacy alias
export function getAnthropicUrl(): string {
  return PROVIDERS.anthropic.apiUrl
}

/** Verify a BYOK key by making a minimal test request */
async function verifyByokKey(key: string, provider: ByokProvider): Promise<boolean> {
  const p = PROVIDERS[provider]
  try {
    if (p.apiStyle === 'anthropic') {
      const res = await fetch(p.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: p.fastModel,
          max_tokens: 16,
          messages: [{ role: 'user', content: 'hi' }],
        }),
      })
      if (!res.ok) return false
      await res.json()
      return true
    }

    if (p.apiStyle === 'google') {
      const res = await fetch(
        `${p.apiUrl}/${p.fastModel}:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'hi' }] }],
            generationConfig: { maxOutputTokens: 16 },
          }),
        }
      )
      if (!res.ok) return false
      await res.json()
      return true
    }

    if (p.apiStyle === 'cohere') {
      const res = await fetch(p.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: p.fastModel,
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 16,
        }),
      })
      if (!res.ok) return false
      await res.json()
      return true
    }

    // OpenAI-compatible (openai, mistral, xai, deepseek, groq, together, fireworks, perplexity)
    const res = await fetch(p.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: p.fastModel,
        max_tokens: 16,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    })
    if (!res.ok) return false
    await res.json()
    return true
  } catch {
    return false
  }
}

/** Set up BYOK mode with any supported provider key */
export async function setupByok(key: string, provider?: ByokProvider): Promise<boolean> {
  const detectedProvider = provider || detectProvider(key)
  if (!detectedProvider) return false

  const valid = await verifyByokKey(key, detectedProvider)
  if (!valid) return false

  const config = loadConfig() || {
    api_key: '',
    default_model: 'auto' as const,
    default_agent: 'auto' as const,
    api_base: API_BASE,
  }

  config.byok_key = key
  config.byok_enabled = true
  config.byok_provider = detectedProvider
  saveConfig(config)
  return true
}

/** Disable BYOK mode */
export function disableByok(): void {
  const config = loadConfig()
  if (config) {
    config.byok_enabled = false
    saveConfig(config)
  }
}

/** Verify a Kernel API key */
export async function verifyApiKey(key: string): Promise<{
  valid: boolean
  tier?: string
  agents?: Array<{ id: string; name: string; role: string }>
  error?: string
}> {
  try {
    const res = await fetch(`${API_BASE}/agents`, {
      headers: { Authorization: `Bearer ${key}` },
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: 'Unknown error' }))
      return { valid: false, error: body.error || `HTTP ${res.status}` }
    }
    const data = await res.json()
    return { valid: true, tier: data.tier, agents: data.agents }
  } catch (err) {
    return { valid: false, error: `Connection failed: ${err}` }
  }
}

/** Get usage stats */
export async function getUsageStats(): Promise<{
  tier: string
  monthly_messages: { count: number; limit: number }
  per_agent: Record<string, { messages: number }>
} | null> {
  const key = getApiKey()
  if (!key) return null

  try {
    const res = await fetch(`${getApiBase()}/usage`, {
      headers: { Authorization: `Bearer ${key}` },
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

/** First-run setup flow */
export async function setupAuth(apiKey: string): Promise<boolean> {
  const result = await verifyApiKey(apiKey)
  if (!result.valid) return false

  const config: KbotConfig = {
    api_key: apiKey,
    default_model: 'auto',
    default_agent: 'auto',
    api_base: API_BASE,
    tier: result.tier,
    monthly_limit: undefined,
  }

  saveConfig(config)
  return true
}

export { KBOT_DIR, CONFIG_PATH, API_BASE }
