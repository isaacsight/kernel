// kbot Auth — API key management and configuration
// Stores config in ~/.kbot/config.json
//
// BYOK (Bring Your Own Key) — open-source, local-first.
// 20 providers: Anthropic, OpenAI, Google, Mistral, xAI, DeepSeek,
//   Groq, Together AI, Fireworks, Perplexity, Cohere, NVIDIA NIM,
//   SambaNova, Cerebras, OpenRouter,
//   Ollama (local), LM Studio (local), Jan (local), kbot local (local),
//   Embedded llama.cpp (local)

import { homedir } from 'node:os'
import { join } from 'node:path'
import { mkdirSync, readFileSync, writeFileSync, existsSync, chmodSync } from 'node:fs'
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto'

const KBOT_DIR = join(homedir(), '.kbot')
const CONFIG_PATH = join(KBOT_DIR, 'config.json')

// ── Local runtime host defaults (configurable via env vars) ──

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434'
const LMSTUDIO_HOST = process.env.LMSTUDIO_HOST || 'http://localhost:1234'
const JAN_HOST = process.env.JAN_HOST || 'http://localhost:1337'
const KBOT_LOCAL_HOST = process.env.KBOT_LOCAL_HOST || 'http://127.0.0.1:18789'

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
  | 'sambanova'    // SambaNova Cloud (ultra-fast inference)
  | 'cerebras'     // Cerebras (wafer-scale inference)
  | 'openrouter'   // OpenRouter (any model, any provider)
  | 'lmstudio'     // LM Studio (local GUI + server)
  | 'jan'          // Jan (local, open-source AI)
  | 'ollama'       // Ollama (local open-weight models)
  | 'kbot-local'   // kbot local gateway (local AI assistant)
  | 'embedded'     // Embedded llama.cpp (no external service needed)

export interface ProviderConfig {
  name: string             // Display name
  apiUrl: string           // Base URL for chat completions
  apiStyle: 'anthropic' | 'openai' | 'google' | 'cohere'  // API format
  defaultModel: string     // Best model
  fastModel: string        // Fast/cheap model
  inputCost: number        // USD per million input tokens
  outputCost: number       // USD per million output tokens
  authHeader: 'x-api-key' | 'bearer'  // How auth is sent
  models?: string[]        // Available models (for listing/selection)
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
    models: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
  },
  openai: {
    name: 'OpenAI',
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    apiStyle: 'openai',
    defaultModel: 'gpt-4.1',
    fastModel: 'gpt-4.1-mini',
    inputCost: 2.0,
    outputCost: 8.0,
    authHeader: 'bearer',
    models: ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'o3', 'o4-mini', 'gpt-4o', 'gpt-4o-mini'],
  },
  google: {
    name: 'Google (Gemini)',
    apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
    apiStyle: 'google',
    defaultModel: 'gemini-2.5-pro',
    fastModel: 'gemini-2.5-flash',
    inputCost: 1.25,
    outputCost: 10.0,
    authHeader: 'bearer', // uses ?key= param instead
    models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
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
    models: ['mistral-large-latest', 'mistral-small-latest', 'codestral-latest', 'mistral-saba-latest', 'pixtral-large-latest'],
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
    models: ['grok-3', 'grok-3-mini', 'grok-3-fast'],
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
    models: ['deepseek-chat', 'deepseek-reasoner'],
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
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'deepseek-r1-distill-llama-70b', 'gemma2-9b-it', 'mistral-saba-24b', 'qwen-qwq-32b'],
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
    models: ['meta-llama/Llama-3.3-70B-Instruct-Turbo', 'meta-llama/Llama-3.1-8B-Instruct-Turbo', 'deepseek-ai/DeepSeek-R1', 'Qwen/Qwen2.5-72B-Instruct-Turbo', 'mistralai/Mixtral-8x22B-Instruct-v0.1'],
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
    models: ['accounts/fireworks/models/llama-v3p3-70b-instruct', 'accounts/fireworks/models/llama-v3p1-8b-instruct', 'accounts/fireworks/models/deepseek-r1'],
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
    models: ['sonar-pro', 'sonar', 'sonar-reasoning-pro', 'sonar-reasoning'],
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
    models: ['command-r-plus', 'command-r', 'command-a'],
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
    models: ['nvidia/llama-3.3-nemotron-super-49b-v1', 'nvidia/llama-3.1-nemotron-nano-8b-v1', 'nvidia/llama-3.1-nemotron-70b-instruct'],
  },
  sambanova: {
    name: 'SambaNova Cloud',
    apiUrl: 'https://api.sambanova.ai/v1/chat/completions',
    apiStyle: 'openai',
    defaultModel: 'Meta-Llama-3.3-70B-Instruct',
    fastModel: 'Meta-Llama-3.1-8B-Instruct',
    inputCost: 0.50,
    outputCost: 1.00,
    authHeader: 'bearer',
    models: ['Meta-Llama-3.3-70B-Instruct', 'Meta-Llama-3.1-8B-Instruct', 'Meta-Llama-3.1-405B-Instruct', 'DeepSeek-R1', 'Qwen2.5-72B-Instruct', 'Qwen2.5-Coder-32B-Instruct'],
  },
  cerebras: {
    name: 'Cerebras',
    apiUrl: 'https://api.cerebras.ai/v1/chat/completions',
    apiStyle: 'openai',
    defaultModel: 'llama-3.3-70b',
    fastModel: 'llama-3.1-8b',
    inputCost: 0.60,
    outputCost: 0.60,
    authHeader: 'bearer',
    models: ['llama-3.3-70b', 'llama-3.1-8b', 'deepseek-r1-distill-llama-70b'],
  },
  openrouter: {
    name: 'OpenRouter',
    apiUrl: 'https://openrouter.ai/api/v1/chat/completions',
    apiStyle: 'openai',
    defaultModel: 'anthropic/claude-sonnet-4-6',
    fastModel: 'anthropic/claude-haiku-4-5-20251001',
    inputCost: 3.0,   // varies by model — this is Claude Sonnet pricing
    outputCost: 15.0,
    authHeader: 'bearer',
    models: ['anthropic/claude-sonnet-4-6', 'anthropic/claude-haiku-4-5-20251001', 'openai/gpt-4.1', 'openai/gpt-4.1-mini', 'google/gemini-2.5-pro', 'meta-llama/llama-3.3-70b-instruct', 'deepseek/deepseek-r1'],
  },
  lmstudio: {
    name: 'LM Studio (Local)',
    apiUrl: `${LMSTUDIO_HOST}/v1/chat/completions`,
    apiStyle: 'openai',
    defaultModel: 'loaded-model',  // LM Studio serves whatever model is loaded
    fastModel: 'loaded-model',
    inputCost: 0,
    outputCost: 0,
    authHeader: 'bearer',
  },
  jan: {
    name: 'Jan (Local)',
    apiUrl: `${JAN_HOST}/v1/chat/completions`,
    apiStyle: 'openai',
    defaultModel: 'loaded-model',  // Jan serves whatever model is active
    fastModel: 'loaded-model',
    inputCost: 0,
    outputCost: 0,
    authHeader: 'bearer',
  },
  ollama: {
    name: 'Ollama (Local)',
    apiUrl: `${OLLAMA_HOST}/v1/chat/completions`,
    apiStyle: 'openai',
    defaultModel: 'gemma3:12b',
    fastModel: 'qwen2.5-coder:7b',
    inputCost: 0,
    outputCost: 0,
    authHeader: 'bearer',  // Ollama ignores auth but needs valid header
    // Ollama models are auto-detected from local install — this is just a starter list
    models: [
      // Code-specialized
      'qwen2.5-coder:7b', 'qwen2.5-coder:14b', 'qwen2.5-coder:32b',
      'deepseek-coder-v2:16b', 'codellama:13b', 'codegemma:7b', 'starcoder2:7b',
      // Reasoning / general
      'llama3.1:8b', 'llama3.1:70b', 'llama3.3:70b',
      'gemma3:12b', 'gemma3:27b',
      'phi4:14b', 'mistral:7b', 'mixtral:8x7b',
      'qwen2.5:7b', 'qwen2.5:14b', 'qwen2.5:32b', 'qwen2.5:72b',
      'deepseek-r1:7b', 'deepseek-r1:14b', 'deepseek-r1:32b', 'deepseek-r1:70b',
      'command-r:35b',
      // Vision
      'llava:13b', 'llava:34b', 'bakllava:7b',
      // Small / edge
      'tinyllama:1.1b', 'phi3:mini', 'gemma:2b',
    ],
  },
  'kbot-local': {
    name: 'kbot local',
    apiUrl: `${KBOT_LOCAL_HOST}/v1/chat/completions`,
    apiStyle: 'openai',
    defaultModel: 'kbot-local:main',
    fastModel: 'kbot-local:main',
    inputCost: 0,
    outputCost: 0,
    authHeader: 'bearer',
  },
  embedded: {
    name: 'Embedded (llama.cpp)',
    apiUrl: 'embedded://local',  // Not a real URL — inference runs in-process
    apiStyle: 'openai',          // Compatibility marker — actually uses direct API
    defaultModel: 'auto',        // Auto-selects best available GGUF model
    fastModel: 'auto',
    inputCost: 0,
    outputCost: 0,
    authHeader: 'bearer',
  },
}

export interface KbotConfig {
  default_model: 'auto' | string
  default_agent: 'auto' | string
  // BYOK fields
  byok_key?: string
  byok_enabled?: boolean
  byok_provider?: ByokProvider
  // Cloud sync — kernel.chat account token (JWT or kn_live_* API key)
  kernel_token?: string
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
    const config = JSON.parse(raw) as KbotConfig
    // Decrypt API key if encrypted
    if (config.byok_key && config.byok_key.startsWith('enc:')) {
      try { config.byok_key = decryptValue(config.byok_key) } catch { /* leave as-is */ }
    }
    return config
  } catch {
    return null
  }
}

/** Derive encryption key from machine-specific data */
function deriveEncryptionKey(): Buffer {
  const machineId = `${homedir()}:${process.env.USER || 'kbot'}:${process.arch}`
  return createHash('sha256').update(machineId).digest()
}

/** Encrypt a string value */
function encryptValue(plaintext: string): string {
  const key = deriveEncryptionKey()
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-cbc', key, iv)
  let encrypted = cipher.update(plaintext, 'utf-8', 'base64')
  encrypted += cipher.final('base64')
  return `enc:${iv.toString('base64')}:${encrypted}`
}

/** Decrypt a string value */
function decryptValue(encrypted: string): string {
  if (!encrypted.startsWith('enc:')) return encrypted // Plaintext fallback for migration
  const parts = encrypted.split(':')
  if (parts.length !== 3) return encrypted
  const key = deriveEncryptionKey()
  const iv = Buffer.from(parts[1], 'base64')
  const decipher = createDecipheriv('aes-256-cbc', key, iv)
  let decrypted = decipher.update(parts[2], 'base64', 'utf-8')
  decrypted += decipher.final('utf-8')
  return decrypted
}

export function saveConfig(config: KbotConfig): void {
  ensureDir()
  // Encrypt API key before saving
  const toSave = { ...config }
  if (toSave.byok_key && !toSave.byok_key.startsWith('enc:') && toSave.byok_key !== 'local') {
    toSave.byok_key = encryptValue(toSave.byok_key)
  }
  writeFileSync(CONFIG_PATH, JSON.stringify(toSave, null, 2))
  // Restrict file permissions (owner read/write only)
  try { chmodSync(CONFIG_PATH, 0o600) } catch { /* Windows doesn't support chmod */ }
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
  { prefix: 'sk-or-v1-', provider: 'openrouter' }, // OpenRouter keys
  { prefix: 'sk-or-',   provider: 'openrouter' }, // OpenRouter keys (alt format)
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
  { env: 'SAMBANOVA_API_KEY',   provider: 'sambanova' },
  { env: 'CEREBRAS_API_KEY',    provider: 'cerebras' },
  { env: 'OPENROUTER_API_KEY',  provider: 'openrouter' },
  { env: 'OLLAMA_API_KEY',      provider: 'ollama' },
  { env: 'KBOT_LOCAL_API_KEY',   provider: 'kbot-local' },
]

/** Check if a provider is local (runs on this machine, may still need a token) */
export function isLocalProvider(provider: ByokProvider): boolean {
  return provider === 'ollama' || provider === 'kbot-local' || provider === 'lmstudio' || provider === 'jan' || provider === 'embedded'
}

/** Check if a provider needs no API key at all */
export function isKeylessProvider(provider: ByokProvider): boolean {
  return provider === 'ollama' || provider === 'lmstudio' || provider === 'jan' || provider === 'embedded'
}

/** Check if BYOK mode is enabled (via env var or config) */
export function isByokEnabled(): boolean {
  // Local providers always work without keys
  const config = loadConfig()
  if (config?.byok_provider && isLocalProvider(config.byok_provider) && config?.byok_enabled) return true

  for (const { env } of ENV_KEYS) {
    if (process.env[env]) return true
  }
  return config?.byok_enabled === true && !!config?.byok_key
}

/** Get the active BYOK provider */
export function getByokProvider(): ByokProvider {
  // If config explicitly sets a provider (via kbot auth), always respect it
  const config = loadConfig()
  if (config?.byok_provider && config?.byok_enabled) {
    return config.byok_provider
  }

  // Fall back to env var detection
  for (const { env, provider } of ENV_KEYS) {
    if (process.env[env]) return provider
  }
  return config?.byok_provider || 'anthropic'
}

/** Get the BYOK API key */
export function getByokKey(): string | null {
  const config = loadConfig()
  // Keyless providers (Ollama) don't need real API keys
  if (config?.byok_provider && isKeylessProvider(config.byok_provider)) return 'local'

  // If config has an explicit provider + key (set via kbot auth), use the config key
  if (config?.byok_provider && config?.byok_enabled && config?.byok_key) {
    return config.byok_key
  }

  // Fall back to env var detection
  for (const { env } of ENV_KEYS) {
    const val = process.env[env]
    if (val) return val
  }
  return config?.byok_key || null
}

/** Get provider config */
export function getProvider(provider: ByokProvider): ProviderConfig {
  return PROVIDERS[provider]
}

/** Ollama model routing — pick the best local model for the task */
const OLLAMA_MODEL_ROUTES: Array<{ keywords: RegExp; models: string[]; fallbackCategory: 'code' | 'reasoning' | 'general' }> = [
  { keywords: /\b(code|function|class|refactor|debug|typescript|javascript|python|rust|go|java|html|css|react|vue|angular|api|endpoint|sql|query|database|schema|migration|test|spec|lint|build|compile|import|export|module|package|dependency|npm|pip|cargo)\b/i, models: ['qwen2.5-coder:32b', 'qwen2.5-coder:14b', 'qwen2.5-coder:7b', 'deepseek-coder-v2:16b', 'codellama:13b', 'codegemma:7b', 'starcoder2:7b'], fallbackCategory: 'code' },
  { keywords: /\b(reason|think|why|explain|analyze|compare|evaluate|proof|logic|math|calculate|solve|deduc|infer|hypothesis|trade.?off|pros?\s+and\s+cons?|decision)\b/i, models: ['deepseek-r1:32b', 'deepseek-r1:14b', 'deepseek-r1:7b', 'phi4:14b', 'gemma3:27b', 'gemma3:12b', 'qwen2.5:32b', 'mistral:7b'], fallbackCategory: 'reasoning' },
  { keywords: /\b(research|search|find|look\s+up|summarize|article|paper|report|review|document|write|blog|essay|draft|outline|rewrite|edit|proofread)\b/i, models: ['llama3.3:70b', 'qwen2.5:72b', 'gemma3:27b', 'gemma3:12b', 'llama3.1:8b', 'mistral:7b'], fallbackCategory: 'general' },
]

/** Cache of available Ollama models (refreshed periodically) */
let cachedOllamaModels: string[] = []
let ollamaModelsCacheTime = 0

async function getAvailableOllamaModels(): Promise<string[]> {
  // Refresh cache every 60 seconds
  if (Date.now() - ollamaModelsCacheTime < 60_000 && cachedOllamaModels.length > 0) {
    return cachedOllamaModels
  }
  cachedOllamaModels = await listOllamaModels()
  ollamaModelsCacheTime = Date.now()
  return cachedOllamaModels
}

/** Check if a model name matches any available model (handles tag variants) */
function isModelAvailable(model: string, available: string[]): boolean {
  return available.some(m => m === model || m === model.split(':')[0] + ':latest')
}

/** Select the best Ollama model for a given message, only from available models */
export function selectOllamaModel(message: string, availableModels?: string[]): string {
  const available = availableModels || cachedOllamaModels
  if (available.length === 0) return PROVIDERS.ollama.defaultModel

  for (const route of OLLAMA_MODEL_ROUTES) {
    if (route.keywords.test(message)) {
      // Try each model in preference order, use the first one that's available
      for (const model of route.models) {
        if (isModelAvailable(model, available)) return model
      }
    }
  }
  // No keyword match — prefer the largest available model
  const preferredFallbacks = ['gemma3:27b', 'phi4:14b', 'gemma3:12b', 'deepseek-r1:14b', 'qwen2.5-coder:14b', 'mistral:7b', 'llama3.1:8b']
  for (const model of preferredFallbacks) {
    if (isModelAvailable(model, available)) return model
  }
  return PROVIDERS.ollama.defaultModel
}

/** Pre-warm the Ollama model cache (call at startup) */
export async function warmOllamaModelCache(): Promise<string[]> {
  return getAvailableOllamaModels()
}

/** Get model name for provider */
export function getProviderModel(provider: ByokProvider, speed: 'default' | 'fast', taskHint?: string): string {
  const p = PROVIDERS[provider]
  // Smart routing for Ollama — pick best model per task
  if (provider === 'ollama' && speed === 'default' && taskHint) {
    return selectOllamaModel(taskHint)
  }
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

/** Quick format validation — avoid API calls for obviously invalid keys */
function isValidKeyFormat(key: string, provider: ByokProvider): boolean {
  if (!key || key.length < 8) return false
  // Provider-specific format checks
  switch (provider) {
    case 'anthropic': return key.startsWith('sk-ant-') && key.length > 20
    case 'openai': return (key.startsWith('sk-') || key.startsWith('sk-proj-')) && key.length > 20
    case 'google': return key.startsWith('AIza') && key.length > 20
    case 'groq': return key.startsWith('gsk_') && key.length > 20
    case 'xai': return key.startsWith('xai-') && key.length > 20
    default: return key.length >= 10 // Generic minimum length check
  }
}

/** Verify a BYOK key — format check first, API call only if format passes */
async function verifyByokKey(key: string, provider: ByokProvider): Promise<boolean> {
  // Quick format validation (no API cost)
  if (!isValidKeyFormat(key, provider)) return false

  const p = PROVIDERS[provider]
  try {
    // Use minimal max_tokens=1 to minimize cost of verification
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
          max_tokens: 1,
          messages: [{ role: 'user', content: 'hi' }],
        }),
        signal: AbortSignal.timeout(10_000),
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
            generationConfig: { maxOutputTokens: 1 },
          }),
          signal: AbortSignal.timeout(10_000),
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
          max_tokens: 1,
        }),
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) return false
      await res.json()
      return true
    }

    // OpenAI-compatible
    const res = await fetch(p.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: p.fastModel,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      }),
      signal: AbortSignal.timeout(10_000),
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
    default_model: 'auto' as const,
    default_agent: 'auto' as const,
  }

  config.byok_key = key
  config.byok_enabled = true
  config.byok_provider = detectedProvider
  saveConfig(config)
  return true
}

/** Set up embedded provider directly (no key verification needed) */
export function setupEmbedded(): void {
  const config = loadConfig() || { default_model: 'auto' as const, default_agent: 'auto' as const }
  config.byok_key = 'local'
  config.byok_enabled = true
  config.byok_provider = 'embedded'
  saveConfig(config)
}

/** Disable BYOK mode */
export function disableByok(): void {
  const config = loadConfig()
  if (config) {
    config.byok_enabled = false
    saveConfig(config)
  }
}


/** Check if Ollama is running locally */
export async function isOllamaRunning(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/tags`, { signal: AbortSignal.timeout(2000) })
    return res.ok
  } catch {
    return false
  }
}

/** List available Ollama models */
export async function listOllamaModels(): Promise<string[]> {
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/tags`, { signal: AbortSignal.timeout(3000) })
    if (!res.ok) return []
    const data = await res.json()
    return (data.models || []).map((m: any) => m.name)
  } catch {
    return []
  }
}

/** Set up Ollama as the active provider */
export async function setupOllama(model?: string): Promise<boolean> {
  const running = await isOllamaRunning()
  if (!running) return false

  const models = await listOllamaModels()
  if (models.length === 0) return false

  const config = loadConfig() || {
    default_model: 'auto' as const,
    default_agent: 'auto' as const,
  }

  config.byok_enabled = true
  config.byok_provider = 'ollama'
  config.byok_key = 'local'
  if (model) {
    config.default_model = model
  }
  saveConfig(config)
  return true
}

/** Check if LM Studio is running locally (default port 1234) */
export async function isLmStudioRunning(): Promise<boolean> {
  try {
    const res = await fetch(`${LMSTUDIO_HOST}/v1/models`, { signal: AbortSignal.timeout(2000) })
    return res.ok
  } catch {
    return false
  }
}

/** Check if Jan is running locally (default port 1337) */
export async function isJanRunning(): Promise<boolean> {
  try {
    const res = await fetch(`${JAN_HOST}/v1/models`, { signal: AbortSignal.timeout(2000) })
    return res.ok
  } catch {
    return false
  }
}

/** Set up LM Studio as the active provider */
export async function setupLmStudio(): Promise<boolean> {
  const running = await isLmStudioRunning()
  if (!running) return false

  // Try to get the loaded model name
  try {
    const res = await fetch(`${LMSTUDIO_HOST}/v1/models`, { signal: AbortSignal.timeout(3000) })
    if (res.ok) {
      const data = await res.json()
      const models = (data.data || []).map((m: any) => m.id)
      if (models.length > 0) {
        PROVIDERS.lmstudio.defaultModel = models[0]
        PROVIDERS.lmstudio.fastModel = models[0]
        PROVIDERS.lmstudio.models = models
      }
    }
  } catch { /* use defaults */ }

  const config = loadConfig() || {
    default_model: 'auto' as const,
    default_agent: 'auto' as const,
  }

  config.byok_enabled = true
  config.byok_provider = 'lmstudio'
  config.byok_key = 'local'
  saveConfig(config)
  return true
}

/** Set up Jan as the active provider */
export async function setupJan(): Promise<boolean> {
  const running = await isJanRunning()
  if (!running) return false

  // Try to get the active model name
  try {
    const res = await fetch(`${JAN_HOST}/v1/models`, { signal: AbortSignal.timeout(3000) })
    if (res.ok) {
      const data = await res.json()
      const models = (data.data || []).map((m: any) => m.id)
      if (models.length > 0) {
        PROVIDERS.jan.defaultModel = models[0]
        PROVIDERS.jan.fastModel = models[0]
        PROVIDERS.jan.models = models
      }
    }
  } catch { /* use defaults */ }

  const config = loadConfig() || {
    default_model: 'auto' as const,
    default_agent: 'auto' as const,
  }

  config.byok_enabled = true
  config.byok_provider = 'jan'
  config.byok_key = 'local'
  saveConfig(config)
  return true
}

/** Detect any running local AI runtime (Ollama, LM Studio, Jan, kbot local) */
export async function detectLocalRuntime(): Promise<ByokProvider | null> {
  const checks = await Promise.allSettled([
    isOllamaRunning().then(ok => ok ? 'ollama' as const : null),
    isLmStudioRunning().then(ok => ok ? 'lmstudio' as const : null),
    isJanRunning().then(ok => ok ? 'jan' as const : null),
    fetch(`${KBOT_LOCAL_HOST}/health`, { signal: AbortSignal.timeout(2000) })
      .then(r => r.ok ? 'kbot-local' as const : null)
      .catch(() => null),
  ])

  for (const result of checks) {
    if (result.status === 'fulfilled' && result.value) return result.value
  }
  return null
}

/** Set up kbot local as the active provider */
export async function setupKbotLocal(token?: string): Promise<boolean> {
  try {
    const res = await fetch(`${KBOT_LOCAL_HOST}/health`, { signal: AbortSignal.timeout(3000) })
    if (!res.ok) return false
  } catch {
    return false
  }

  const config = loadConfig() || {
    default_model: 'auto' as const,
    default_agent: 'auto' as const,
  }

  config.byok_enabled = true
  config.byok_provider = 'kbot-local'
  config.byok_key = token || 'local'
  saveConfig(config)
  return true
}

// ── Cost-Aware Model Routing ──

export type TaskComplexity = 'trivial' | 'simple' | 'moderate' | 'complex' | 'reasoning'

/** Classify message complexity for cost-aware model routing */
export function classifyComplexity(message: string): TaskComplexity {
  const lower = message.toLowerCase()
  const wordCount = message.split(/\s+/).length

  // Trivial: greetings, single-word commands, yes/no (must be short AND a greeting)
  if (wordCount <= 3 && /^(hi|hey|hello|thanks|ok|yes|no|sure|bye|quit|exit)\b/i.test(lower)) {
    return 'trivial'
  }

  // Reasoning: explicit reasoning, multi-step analysis, complex comparison
  if (/\b(reason|prove|why does|explain why|trade.?off|pros?\s+and\s+cons?|compare\s+\w+\s+(?:and|vs|versus)|architect|design\s+(?:a|the)\s+system|security\s+(?:audit|review))\b/i.test(lower)) {
    return 'reasoning'
  }

  // Complex: multi-file edits, refactoring, debugging, building entire features
  if (/\b(refactor|migrate|rewrite|overhaul|redesign|implement\s+(?:a|the)\s+\w+\s+system|build\s+(?:a|the|an)\s+\w+\s+(?:app|service|api|system)|debug\s+(?:the|this|a)\s+\w+\s+(?:issue|error|bug|problem))\b/i.test(lower) || wordCount > 100) {
    return 'complex'
  }

  // Moderate: code generation, file modifications, research
  if (/\b(create|write|add|implement|update|modify|change|fix|search|research|find|analyze|generate|test)\b/i.test(lower)) {
    return 'moderate'
  }

  // Simple: questions, lookups, short tasks
  return 'simple'
}

/** Route to the optimal model based on task complexity */
export function routeModelForTask(
  provider: ByokProvider,
  message: string,
): { model: string; reason: string } {
  const complexity = classifyComplexity(message)
  const p = PROVIDERS[provider]

  switch (complexity) {
    case 'trivial':
    case 'simple':
      return { model: p.fastModel, reason: `${complexity} task → fast model (saves cost)` }
    case 'moderate':
    case 'complex':
    case 'reasoning':
      return { model: p.defaultModel, reason: `${complexity} task → default model` }
  }
}

export { KBOT_DIR, CONFIG_PATH }
