// Action-token tokenizer for kbot session.jsonl.
// Every tool call -> one vocab id. Token string layout before hashing:
//   tool_name | args_bucket | outcome_class | duration_bucket
// Raw args never enter the vocab; they are bucketed locally.

import { createHash } from 'node:crypto'

// --- types ---

export interface SessionEvent {
  ts: string
  tool: string
  args?: Record<string, unknown>
  session?: string
  error?: string
  result_length?: number
  // Missing today; populated after data_collection.md push:
  duration_ms?: number
  outcome?: 'ok' | 'error' | 'partial' | 'unknown'
  intent?: string
  agent?: string
  user_message?: string
}

export interface SessionRecord {
  sessionId: string
  events: SessionEvent[]
}

export type TokenId = number

export interface Vocab {
  version: number
  size: number
  tokenToId: Record<string, TokenId>
  idToToken: string[]
  specials: Record<string, TokenId>
}

// --- special tokens ---

const SPECIALS = [
  '<pad>', '<bos>', '<eos>', '<turn>', '<unk>',
  '<user:code>', '<user:music>', '<user:research>', '<user:ops>', '<user:other>',
  '<agent:coder>', '<agent:researcher>', '<agent:aesthete>',
  '<agent:guardian>', '<agent:curator>', '<agent:kernel>', '<agent:other>',
] as const

// --- bucketing helpers ---

const OUTCOME_CLASSES = ['ok', 'err', 'part', 'unk'] as const

function outcomeBucket(e: SessionEvent): (typeof OUTCOME_CLASSES)[number] {
  if (e.outcome === 'ok') return 'ok'
  if (e.outcome === 'error') return 'err'
  if (e.outcome === 'partial') return 'part'
  if (e.error) return 'err'
  if (e.result_length && e.result_length > 0) return 'ok'
  return 'unk'
}

function durationBucket(e: SessionEvent): string {
  const d = e.duration_ms
  if (d === undefined) return 'd?'
  if (d < 50) return 'd0' // instant
  if (d < 500) return 'd1' // fast
  if (d < 5_000) return 'd2' // mid
  if (d < 60_000) return 'd3' // slow
  return 'd4' // very_slow
}

const BASH_DESTRUCTIVE = /\b(rm|mv|chmod|chown|kill|shutdown|reboot|dd|mkfs|>\s*\/)/
const BASH_NETWORK = /\b(curl|wget|ssh|scp|rsync|nc|ping|fetch)\b/
const BASH_GIT = /^\s*git\b/
const BASH_BUILD = /\b(npm|yarn|pnpm|cargo|make|tsc|vite|webpack|go\s+build)\b/
const BASH_TEST = /\b(test|vitest|jest|pytest|cargo\s+test|go\s+test)\b/
const BASH_READ_ONLY = /^\s*(ls|pwd|cat|head|tail|which|whoami|date|echo|env)\b/

function bashBucket(args: Record<string, unknown> | undefined): string {
  const cmd = typeof args?.command === 'string' ? args.command : ''
  if (!cmd) return 'b?'
  if (BASH_DESTRUCTIVE.test(cmd)) return 'bDEL'
  if (BASH_TEST.test(cmd)) return 'bTST'
  if (BASH_BUILD.test(cmd)) return 'bBLD'
  if (BASH_GIT.test(cmd)) return 'bGIT'
  if (BASH_NETWORK.test(cmd)) return 'bNET'
  if (BASH_READ_ONLY.test(cmd)) return 'bRO'
  return 'bOTH'
}

const PATH_PREFIXES: [RegExp, string][] = [
  [/^\/?packages\/kbot\//, 'pKBOT'], [/^\/?packages\//, 'pPKG'],
  [/^\/?src\//, 'pSRC'], [/^\/?supabase\//, 'pSUP'],
  [/^\/?tools\//, 'pTOOLS'], [/^\/?\.claude\//, 'pCLAUDE'],
  [/^\/?tests?\//, 'pTEST'], [/^\/?docs?\//, 'pDOC'],
]

function pathBucket(args: Record<string, unknown> | undefined): string {
  const p = typeof args?.file_path === 'string' ? args.file_path
    : typeof args?.path === 'string' ? args.path : ''
  if (!p) return 'p?'
  const rel = p.replace(/^.*?(packages|src|supabase|tools|\.claude|tests?|docs?)/, '$1')
  for (const [rx, label] of PATH_PREFIXES) if (rx.test(rel)) return label
  return 'pOTH'
}

function grepBucket(args: Record<string, unknown> | undefined): string {
  const pat = typeof args?.pattern === 'string' ? args.pattern : ''
  const len = pat.length
  if (!len) return 'g?'
  if (len < 12) return 'gS'
  if (len < 40) return 'gM'
  return 'gL'
}

const FILE_TOOLS = new Set(['read', 'edit', 'write', 'read_file', 'edit_file', 'write_file'])
function argsBucket(e: SessionEvent): string {
  const t = e.tool.toLowerCase()
  if (t === 'bash') return bashBucket(e.args)
  if (FILE_TOOLS.has(t)) return pathBucket(e.args)
  if (t === 'grep' || t === 'glob') return grepBucket(e.args)
  return 'a0' // MCP tools carry intent in the name
}

// --- token string ---

export function tokenString(e: SessionEvent): string {
  const tool = e.tool.replace(/\s+/g, '_')
  const a = argsBucket(e)
  const o = outcomeBucket(e)
  const d = durationBucket(e)
  return `${tool}|${a}|${o}|${d}`
}

// --- vocab ---

export function buildVocabulary(
  sessions: SessionRecord[],
  opts: { maxSize?: number; minFreq?: number } = {},
): Vocab {
  const maxSize = opts.maxSize ?? 8192
  const minFreq = opts.minFreq ?? 2
  const counts = new Map<string, number>()
  for (const s of sessions) for (const e of s.events) {
    const t = tokenString(e); counts.set(t, (counts.get(t) ?? 0) + 1)
  }
  const specials: Record<string, TokenId> = {}
  const idToToken: string[] = []
  for (const sp of SPECIALS) { specials[sp] = idToToken.length; idToToken.push(sp) }
  const ranked = [...counts.entries()]
    .filter(([, c]) => c >= minFreq).sort((a, b) => b[1] - a[1])
    .slice(0, maxSize - idToToken.length)
  for (const [t] of ranked) idToToken.push(t)
  const tokenToId: Record<string, TokenId> = {}
  for (let i = 0; i < idToToken.length; i++) tokenToId[idToToken[i]] = i
  return { version: 1, size: idToToken.length, tokenToId, idToToken, specials }
}

export function encodeToken(vocab: Vocab, t: string): TokenId {
  return vocab.tokenToId[t] ?? vocab.specials['<unk>']
}

// --- session -> tokens ---

export function sessionToTokens(session: SessionRecord, vocab: Vocab): TokenId[] {
  const out: TokenId[] = [vocab.specials['<bos>']]
  const intent = session.events[0]?.intent
  if (intent) out.push(vocab.specials[`<user:${intent}>`] ?? vocab.specials['<user:other>'])
  const agent = session.events[0]?.agent
  if (agent) out.push(vocab.specials[`<agent:${agent}>`] ?? vocab.specials['<agent:other>'])
  for (const e of session.events) out.push(encodeToken(vocab, tokenString(e)))
  out.push(vocab.specials['<eos>'])
  return out
}

// --- jsonl loader ---

export function parseSessionJsonl(jsonl: string): SessionRecord[] {
  const bySession = new Map<string, SessionEvent[]>()
  for (const line of jsonl.split('\n')) {
    if (!line.trim()) continue
    let ev: SessionEvent
    try { ev = JSON.parse(line) } catch { continue }
    const sid = ev.session ?? 'unknown'
    if (!bySession.has(sid)) bySession.set(sid, [])
    bySession.get(sid)!.push(ev)
  }
  return [...bySession.entries()].map(([sessionId, events]) => ({ sessionId, events }))
}

// Stable hash (reserved for collision-resistant args bucketing in v2).
export function stableHash(s: string, mod: number): number {
  const h = createHash('sha1').update(s).digest()
  const n = ((h[0] << 24) | (h[1] << 16) | (h[2] << 8) | h[3]) >>> 0
  return n % mod
}
