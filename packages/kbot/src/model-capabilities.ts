// Model Capability Detection
//
// kbot's agent loop depends on tool calling. When the configured model
// doesn't support tools, users see weird bugs: answers hallucinated instead
// of reading files, capabilities denied instead of exercised, tool-call
// syntax printed as markdown instead of invoked.
//
// This module answers one question reliably: does the configured model
// support tool calls?
//
// For Ollama, we query `/api/show` which returns `capabilities: ['tools', ...]`
// for tool-capable models. For cloud providers, tool support is assumed
// (Anthropic, OpenAI, Google, Groq, Mistral, DeepSeek all support it).

import type { ByokProvider } from './auth.js'

/** Cloud providers with reliable tool-calling support */
const CLOUD_TOOL_CAPABLE = new Set<ByokProvider>([
  'anthropic', 'openai', 'google', 'groq', 'mistral',
  'deepseek', 'cohere', 'xai', 'openrouter', 'together',
])

/**
 * Check whether a specific model can invoke tools.
 * For Ollama/local: queries the model's capabilities endpoint.
 * For cloud providers: returns true for the known-capable list.
 * Returns `null` if the answer can't be determined (non-fatal — caller decides).
 */
export async function supportsToolCalls(
  provider: ByokProvider,
  model: string,
): Promise<boolean | null> {
  // Cloud providers — trust the allowlist
  if (CLOUD_TOOL_CAPABLE.has(provider)) return true

  // Ollama — ask the server directly
  if (provider === 'ollama') {
    try {
      const res = await fetch('http://localhost:11434/api/show', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: model }),
        signal: AbortSignal.timeout(3000),
      })
      if (!res.ok) return null
      const data = await res.json() as { capabilities?: string[] }
      if (!Array.isArray(data.capabilities)) return null
      return data.capabilities.includes('tools')
    } catch {
      return null
    }
  }

  // Unknown — don't speculate
  return null
}

/**
 * Human-readable recommendation when a model lacks tool support.
 * Returns null if the model is fine OR if we can't tell.
 */
export async function getWeakModelWarning(
  provider: ByokProvider,
  model: string,
): Promise<string | null> {
  const ok = await supportsToolCalls(provider, model)
  if (ok !== false) return null // true or null → no warning

  const recs: Record<string, string[]> = {
    ollama: ['qwen2.5-coder:14b', 'qwen2.5-coder:7b', 'mistral:7b', 'llama3.1:8b', 'kernel-coder:latest'],
  }
  const suggestions = recs[provider]?.filter(s => s !== model).slice(0, 3) ?? []
  const suggestionStr = suggestions.length > 0
    ? ` Suggested tool-capable alternatives: ${suggestions.join(', ')}.`
    : ''

  return `Model "${model}" does not support tool calls. ` +
    `kbot's file reads, shell commands, and git operations will silently fail or be hallucinated.${suggestionStr} ` +
    `Switch with: \`kbot auth\` or set a tool-capable model in ~/.kbot/config.json.`
}
