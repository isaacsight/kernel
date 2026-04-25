/**
 * Critic Gate — adversarial discriminator on tool outputs.
 * Generator/discriminator pattern: critic reviews each tool result before the
 * main LLM sees it. Fast path auto-accepts trivial results. Config via
 * ~/.kbot/config.json: critic_enabled (bool), critic_strictness (0..1).
 * Hard disable: env KBOT_NO_CRITIC=1.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { loadConfig } from './auth.js'
import { classifyToolResult, type RFClass } from './critic-taxonomy.js'

const VERDICT_LOG_PATH = join(homedir(), '.kbot', 'critic-verdicts.jsonl')

export interface CriticVerdict {
  accept: boolean
  reason?: string
  retry_hint?: string
  confidence: number // 0..1
  /** RF taxonomy class when a rule-based classifier fired (arXiv:2601.22208). */
  failure_class?: RFClass
}

export interface GateOpts {
  strictness?: number
  provider?: string
  /** Optional LLM client override — takes user prompt, returns raw text. For testing. */
  llmClient?: (userPrompt: string) => Promise<string>
}

const TRUSTED_TOOLS = new Set<string>([
  'read', 'read_file', 'kbot_read', 'kbot_read_file',
  'glob', 'kbot_glob', 'grep', 'kbot_grep', 'list_directory', 'ls',
  'git_status', 'git_log', 'git_diff', 'git_branch',
  'terminal_cwd', 'env_check', 'memory_recall', 'memory_search',
])
const ERROR_KEYWORDS = [
  'tool error:', 'error:', 'enoent', 'permission denied', 'eacces',
  'not found', 'failed to', 'traceback', 'stack trace',
  'undefined is not', 'cannot read prop', 'refused',
]

const MAX_ARGS_CHARS = 500
const MAX_RESULT_CHARS = 2000
const TRIVIAL_MAX_BYTES = 10 * 1024

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max) + `\n…[truncated, original ${s.length} chars]`
}

function toText(x: unknown): string {
  if (x == null) return ''
  if (typeof x === 'string') return x
  try { return JSON.stringify(x) } catch { return String(x) }
}

function hasErrorKeyword(text: string): boolean {
  const lower = text.toLowerCase()
  return ERROR_KEYWORDS.some(k => lower.includes(k))
}

/** True if the result is plausibly fine without calling a critic LLM. */
function isTriviallyValid(tool: string, resultText: string): boolean {
  if (!resultText || resultText.trim().length === 0) return false
  if (resultText.length > TRIVIAL_MAX_BYTES) return false
  if (hasErrorKeyword(resultText)) return false
  if (TRUSTED_TOOLS.has(tool)) return true
  return false
}

interface ResolvedProvider {
  provider: string
  model: string
  apiKey: string
  apiUrl: string
}

function resolveCriticProvider(override?: string): ResolvedProvider | null {
  const cfg = loadConfig()
  const provider = (override || cfg?.byok_provider || 'anthropic').toLowerCase()
  const localModel = cfg?.default_model && cfg.default_model !== 'auto' ? cfg.default_model : 'llama3.2:3b'
  if (provider === 'ollama' || provider === 'kbot-local') {
    return { provider, model: localModel, apiKey: 'local', apiUrl: 'http://localhost:11434/v1/chat/completions' }
  }
  if (provider === 'openai') {
    if (!cfg?.byok_key) return null
    return { provider: 'openai', model: 'gpt-4o-mini', apiKey: cfg.byok_key, apiUrl: 'https://api.openai.com/v1/chat/completions' }
  }
  if (!cfg?.byok_key) return null
  return { provider: 'anthropic', model: 'claude-haiku-4-5', apiKey: cfg.byok_key, apiUrl: 'https://api.anthropic.com/v1/messages' }
}

const CRITIC_SYSTEM =
  'You are a strict senior engineer reviewing a tool output. ' +
  'Did this tool call produce a useful, correct, non-hallucinated result ' +
  'for the stated intent? Return ONLY JSON with keys: ' +
  '{"accept": bool, "reason": string, "retry_hint": string, "confidence": number between 0 and 1}. ' +
  'No prose, no code fences — JSON only.'

function buildUserPrompt(tool: string, args: Record<string, unknown>, result: unknown): string {
  const argsText = truncate(toText(args), MAX_ARGS_CHARS)
  const resultText = truncate(toText(result), MAX_RESULT_CHARS)
  return `TOOL: ${tool}\n\nARGS:\n${argsText}\n\nRESULT:\n${resultText}`
}

function parseVerdict(text: string): CriticVerdict | null {
  if (!text) return null
  // Strip fences/prose; grab first {...} object.
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    const raw = JSON.parse(match[0]) as Partial<CriticVerdict>
    const confidence = typeof raw.confidence === 'number'
      ? Math.max(0, Math.min(1, raw.confidence))
      : 0.5
    return {
      accept: !!raw.accept,
      reason: typeof raw.reason === 'string' ? raw.reason : undefined,
      retry_hint: typeof raw.retry_hint === 'string' ? raw.retry_hint : undefined,
      confidence,
    }
  } catch { return null }
}

async function callAnthropic(p: ResolvedProvider, userPrompt: string): Promise<string> {
  const res = await fetch(p.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': p.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: p.model,
      max_tokens: 256,
      system: CRITIC_SYSTEM,
      messages: [{ role: 'user', content: userPrompt }],
    }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`critic HTTP ${res.status}`)
  const data = await res.json() as { content?: Array<{ type: string; text?: string }> }
  return (data.content || []).filter(b => b.type === 'text').map(b => b.text || '').join('')
}

async function callOpenAICompat(p: ResolvedProvider, userPrompt: string): Promise<string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (p.apiKey && p.apiKey !== 'local') headers['Authorization'] = `Bearer ${p.apiKey}`
  const res = await fetch(p.apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: p.model,
      max_tokens: 256,
      messages: [
        { role: 'system', content: CRITIC_SYSTEM },
        { role: 'user', content: userPrompt },
      ],
    }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`critic HTTP ${res.status}`)
  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
  return data.choices?.[0]?.message?.content || ''
}

interface VerdictLogEntry {
  ts: string
  tool: string
  path: 'fast' | 'taxonomy' | 'llm' | 'no-provider' | 'unparseable' | 'failed'
  accept: boolean
  confidence: number
  reason?: string
  failure_class?: RFClass
  result_bytes: number
}

function logVerdict(entry: VerdictLogEntry): void {
  try {
    const dir = dirname(VERDICT_LOG_PATH)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    appendFileSync(VERDICT_LOG_PATH, JSON.stringify(entry) + '\n')
  } catch { /* logging is non-critical */ }
}

export interface CriticStats {
  total: number
  accepted: number
  rejected: number
  acceptRate: number
  byPath: Record<VerdictLogEntry['path'], number>
  topRejectReasons: Array<{ reason: string; count: number }>
  byFailureClass: Record<string, number>
  logPath: string
}

/**
 * Read the verdict log and compute summary stats. Used by `kbot critic stats`
 * to decide when default-on critic is safe (measure FP rate first).
 */
export function getCriticStats(limit = 5000): CriticStats {
  const empty: CriticStats = {
    total: 0, accepted: 0, rejected: 0, acceptRate: 0,
    byPath: { fast: 0, taxonomy: 0, llm: 0, 'no-provider': 0, unparseable: 0, failed: 0 },
    topRejectReasons: [], byFailureClass: {}, logPath: VERDICT_LOG_PATH,
  }
  if (!existsSync(VERDICT_LOG_PATH)) return empty
  let raw: string
  try { raw = readFileSync(VERDICT_LOG_PATH, 'utf8') } catch { return empty }
  const lines = raw.trim().split('\n').filter(Boolean).slice(-limit)
  const reasons = new Map<string, number>()
  for (const line of lines) {
    let e: VerdictLogEntry
    try { e = JSON.parse(line) } catch { continue }
    empty.total++
    if (e.accept) empty.accepted++
    else {
      empty.rejected++
      if (e.reason) reasons.set(e.reason, (reasons.get(e.reason) || 0) + 1)
    }
    if (e.path && empty.byPath[e.path] !== undefined) empty.byPath[e.path]++
    if (e.failure_class) empty.byFailureClass[e.failure_class] = (empty.byFailureClass[e.failure_class] || 0) + 1
  }
  empty.acceptRate = empty.total === 0 ? 0 : empty.accepted / empty.total
  empty.topRejectReasons = [...reasons.entries()]
    .sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([reason, count]) => ({ reason, count }))
  return empty
}

/**
 * Gate a tool result through the adversarial critic.
 * Never throws — on any failure, returns accept=true with low confidence so
 * the agent loop is never blocked by the critic itself.
 */
export async function gateToolResult(
  tool: string,
  args: Record<string, unknown>,
  result: unknown,
  opts: GateOpts = {},
): Promise<CriticVerdict> {
  if (process.env.KBOT_NO_CRITIC === '1') {
    return { accept: true, confidence: 1, reason: 'critic disabled via env' }
  }

  const cfg = loadConfig()
  if (cfg && cfg.critic_enabled === false) {
    return { accept: true, confidence: 1, reason: 'critic disabled in config' }
  }

  const strictness = typeof opts.strictness === 'number'
    ? opts.strictness
    : (typeof cfg?.critic_strictness === 'number' ? cfg.critic_strictness : 0.5)

  const resultText = toText(result)
  const logEnabled = !cfg || cfg.critic_log_enabled !== false
  const recordVerdict = (path: VerdictLogEntry['path'], v: CriticVerdict): CriticVerdict => {
    if (logEnabled) logVerdict({
      ts: new Date().toISOString(),
      tool, path,
      accept: v.accept,
      confidence: v.confidence,
      reason: v.reason,
      failure_class: v.failure_class,
      result_bytes: resultText.length,
    })
    return v
  }

  // Fast path. Trivial fast-path verdicts are not logged — they would dominate
  // the dataset and aren't useful for FP measurement.
  if (isTriviallyValid(tool, resultText)) {
    return { accept: true, confidence: 0.9, reason: 'trivial-valid fast path' }
  }

  // Rule-based RF classifier — cheap, no LLM. High-confidence hits short-circuit.
  const rf = classifyToolResult(resultText)
  if (rf && rf.confidence >= 0.8) {
    return recordVerdict('taxonomy', {
      accept: false,
      confidence: rf.confidence,
      reason: `${rf.class}: ${rf.evidence}`,
      retry_hint: 'Taxonomy match — try different arguments or a different tool.',
      failure_class: rf.class,
    })
  }

  const userPrompt = buildUserPrompt(tool, args, resultText)

  let callLLM: (p: string) => Promise<string>
  if (opts.llmClient) {
    callLLM = opts.llmClient
  } else {
    const provider = resolveCriticProvider(opts.provider)
    if (!provider) {
      // No usable provider — degrade gracefully.
      return recordVerdict('no-provider', { accept: true, confidence: 0.3, reason: 'no critic provider available' })
    }
    callLLM = provider.provider === 'anthropic'
      ? (pr) => callAnthropic(provider, pr)
      : (pr) => callOpenAICompat(provider, pr)
  }

  try {
    const text = await callLLM(userPrompt)
    const verdict = parseVerdict(text)
    if (!verdict) {
      return recordVerdict('unparseable', { accept: true, confidence: 0.3, reason: 'critic returned unparseable output' })
    }
    // Strictness gate: require verdict.confidence >= strictness when rejecting,
    // and if accepting with very low confidence and strictness is high, flip to reject.
    if (!verdict.accept && verdict.confidence < Math.max(0.1, 1 - strictness)) {
      // The critic rejected but wasn't very sure — let it pass with warning.
      return recordVerdict('llm', { ...verdict, accept: true, reason: `soft-accept: ${verdict.reason || 'low-confidence reject'}` })
    }
    if (verdict.accept && strictness > 0.8 && verdict.confidence < 0.3) {
      return recordVerdict('llm', {
        accept: false,
        confidence: verdict.confidence,
        reason: 'strict mode: accepted with very low confidence',
        retry_hint: verdict.retry_hint || 'Verify output shape and re-run with stricter arguments.',
      })
    }
    return recordVerdict('llm', verdict)
  } catch {
    // Critic call failed — never block the agent loop.
    return recordVerdict('failed', { accept: true, confidence: 0.2, reason: 'critic call failed' })
  }
}
