/**
 * Identity guard — injects ground-truth self-facts into the user message
 * when the message is a self-query.
 *
 * Reality probes (2026-04-20) showed that with a small local model
 * (gemma4:latest, 4B-class), "what version are you?" returns a different
 * fabricated version number on each invocation — v3.99.14, v3.99.12, etc.
 * The self-awareness system-context block exists and is injected, but
 * small models ignore system context for identity queries.
 *
 * This module mirrors math-guard: detect the query in the USER message and
 * prepend a ground-truth block to the context snippet. Local models respect
 * user-message content more than system prompts, so the answer shows up
 * directly in the input the model conditions on.
 *
 * Scope: version, product name, provider, model. Not capabilities — those
 * belong to self-awareness.ts and its 200-token budget.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { getByokProvider, getProvider, getProviderModel } from './auth.js'

export type IdentityQueryKind = 'version' | 'product' | 'provider' | 'model'

const QUERY_PATTERNS: Array<{ re: RegExp; kinds: IdentityQueryKind[] }> = [
  { re: /\bwhat\s+version\b/i, kinds: ['version', 'product'] },
  { re: /\bwhich\s+version\b/i, kinds: ['version', 'product'] },
  { re: /\byour\s+version\b/i, kinds: ['version'] },
  { re: /\bversion\s+(are|is)\s+you\b/i, kinds: ['version'] },
  { re: /\bwho\s+are\s+you\b/i, kinds: ['product', 'version'] },
  { re: /\bwhat\s+are\s+you\b/i, kinds: ['product', 'provider', 'model'] },
  { re: /\bwhat\s+(model|LLM)\b/i, kinds: ['model', 'provider'] },
  { re: /\bwhich\s+(model|LLM)\b/i, kinds: ['model', 'provider'] },
  { re: /\bwhat\s+provider\b/i, kinds: ['provider', 'model'] },
]

export function detectIdentityQuery(message: string): Set<IdentityQueryKind> {
  const kinds = new Set<IdentityQueryKind>()
  if (!message) return kinds
  for (const p of QUERY_PATTERNS) {
    if (p.re.test(message)) {
      for (const k of p.kinds) kinds.add(k)
    }
  }
  return kinds
}

function readPackageVersion(): string | null {
  try {
    const here = dirname(fileURLToPath(import.meta.url))
    const pkgPath = join(here, '..', 'package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version?: string }
    return pkg.version ?? null
  } catch {
    return null
  }
}

interface IdentityFacts {
  version: string | null
  product: string
  provider: string | null
  model: string | null
}

function collectFacts(): IdentityFacts {
  const facts: IdentityFacts = {
    version: readPackageVersion(),
    product: '@kernel.chat/kbot',
    provider: null,
    model: null,
  }
  try {
    const provId = getByokProvider()
    facts.provider = getProvider(provId).name
    facts.model = getProviderModel(provId, 'default')
  } catch {
    // Provider config unreadable — leave null; caller formats gracefully.
  }
  return facts
}

/**
 * Build the ground-truth preamble for a user message. Returns empty string
 * when the message is not a self-query, so callers can concatenate
 * unconditionally.
 */
export function buildIdentityGuardBlock(message: string): string {
  const kinds = detectIdentityQuery(message)
  if (kinds.size === 0) return ''

  const facts = collectFacts()
  const lines: string[] = [
    '[IDENTITY GUARD — the user is asking about your identity. Use these values VERBATIM. Do not invent version numbers, providers, or model names.]',
  ]
  if (kinds.has('product') || kinds.has('version')) {
    if (facts.version) {
      lines.push(`  product: ${facts.product} v${facts.version}`)
    } else {
      lines.push(`  product: ${facts.product}`)
    }
  }
  if (kinds.has('version') && facts.version) {
    lines.push(`  version: v${facts.version} (exact string — no other number is correct)`)
  }
  if (kinds.has('provider') && facts.provider) {
    lines.push(`  provider: ${facts.provider}`)
  }
  if (kinds.has('model') && facts.model) {
    lines.push(`  model: ${facts.model}`)
  }
  return lines.join('\n') + '\n'
}
