// embed.ts — produce one embedding per tool-call event from observer session.jsonl.
// Embedding input = (prior 3 tool names) + (user-msg excerpt if any) + first-arg text (<=200 chars).
// Uses Ollama nomic-embed-text at localhost:11434. Falls back to a hash-word-bag if Ollama is down.
// Cache: _cache/embeddings.jsonl — re-runs skip already-embedded event ids.
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SESSION_FILE = join(homedir(), '.kbot/observer/session.jsonl')
const HERE = dirname(fileURLToPath(import.meta.url))
const CACHE_DIR = join(HERE, '_cache')
const CACHE_FILE = join(CACHE_DIR, 'embeddings.jsonl')
const META_FILE = join(CACHE_DIR, 'meta.json')
const OLLAMA = 'http://localhost:11434/api/embeddings'
const MODEL = 'nomic-embed-text'
const DIM_FALLBACK = 256

export interface Event { ts: string; tool: string; args: Record<string, unknown>; session: string }
export interface EmbeddedEvent {
  id: string       // session + ':' + index-in-session
  session: string
  idx: number
  tool: string     // ground-truth next tool for this event
  priorTools: string[]
  intentText: string
  vec: number[]
  backend: 'ollama' | 'hash'
}

function loadEvents(): Event[] {
  const out: Event[] = []
  for (const line of readFileSync(SESSION_FILE, 'utf-8').split('\n')) {
    if (!line.trim()) continue
    try { const e = JSON.parse(line); if (e.tool && e.session && !String(e.tool).toLowerCase().startsWith('daemon_')) out.push(e) } catch {}
  }
  return out
}

function firstArgText(e: Event): string {
  const a = (e.args || {}) as Record<string, unknown>
  for (const k of ['description','query','prompt','message','pattern','command']) {
    const v = a[k]; if (typeof v === 'string' && v.length > 0) return v.slice(0, 200)
  }
  for (const k of ['file_path','path','url']) {
    const v = a[k]; if (typeof v === 'string') return v.split('/').slice(-3).join(' ').slice(0, 200)
  }
  return ''
}

function buildIntent(priorEvents: Event[], current: Event): { priorTools: string[]; intent: string } {
  const priorTools = priorEvents.slice(-3).map(e => e.tool)
  // "user-message excerpt" = text from first prior event (proxy, no user turns persisted)
  const userExcerpt = priorEvents.length > 0 ? firstArgText(priorEvents[priorEvents.length - 1]) : ''
  const currentArg = firstArgText(current)
  const intent = [priorTools.join(' '), userExcerpt, currentArg].filter(Boolean).join(' | ')
  return { priorTools, intent }
}

async function ollamaEmbed(text: string): Promise<number[] | null> {
  try {
    const r = await fetch(OLLAMA, { method: 'POST', body: JSON.stringify({ model: MODEL, prompt: text }), headers: { 'content-type': 'application/json' } })
    if (!r.ok) return null
    const j = await r.json() as { embedding?: number[] }
    return j.embedding ?? null
  } catch { return null }
}

function hashEmbed(text: string): number[] {
  const v = new Array(DIM_FALLBACK).fill(0)
  const toks = text.toLowerCase().split(/[^a-z0-9_]+/).filter(Boolean)
  for (const t of toks) {
    let h = 2166136261
    for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) }
    v[Math.abs(h) % DIM_FALLBACK] += 1
  }
  // L2 normalize
  let s = 0; for (const x of v) s += x * x
  const n = Math.sqrt(s) || 1
  return v.map(x => x / n)
}

async function probeOllama(): Promise<boolean> {
  const r = await ollamaEmbed('test'); return r !== null && r.length > 0
}

async function main() {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true })
  const evs = loadEvents()
  console.log(`Loaded ${evs.length} non-daemon events from ${SESSION_FILE}`)

  // Group by session, preserve order
  const bySession: Record<string, Event[]> = {}
  for (const e of evs) (bySession[e.session] ||= []).push(e)

  // Load cache
  const have = new Set<string>()
  if (existsSync(CACHE_FILE)) {
    for (const line of readFileSync(CACHE_FILE, 'utf-8').split('\n')) {
      if (!line.trim()) continue
      try { have.add(JSON.parse(line).id) } catch {}
    }
  }
  console.log(`Cache has ${have.size} embeddings`)

  const useOllama = await probeOllama()
  const backend: 'ollama' | 'hash' = useOllama ? 'ollama' : 'hash'
  console.log(`Backend: ${backend}${useOllama ? '' : ' (Ollama unavailable, using hash fallback)'}`)

  let added = 0, total = 0
  const t0 = Date.now()
  for (const sid of Object.keys(bySession)) {
    const list = bySession[sid]
    for (let i = 0; i < list.length; i++) {
      total++
      const id = `${sid}:${i}`
      if (have.has(id)) continue
      const prior = list.slice(Math.max(0, i - 3), i)
      const { priorTools, intent } = buildIntent(prior, list[i])
      let vec = useOllama ? await ollamaEmbed(intent || list[i].tool) : null
      if (!vec) vec = hashEmbed(intent || list[i].tool)
      const rec: EmbeddedEvent = { id, session: sid, idx: i, tool: list[i].tool, priorTools, intentText: intent, vec, backend: vec.length === DIM_FALLBACK && !useOllama ? 'hash' : 'ollama' }
      appendFileSync(CACHE_FILE, JSON.stringify(rec) + '\n')
      added++
      if (added % 500 === 0) console.log(`  +${added} / ${total} (elapsed ${((Date.now() - t0) / 1000).toFixed(1)}s)`)
    }
  }
  writeFileSync(META_FILE, JSON.stringify({ backend, total, added, dim: backend === 'ollama' ? 768 : DIM_FALLBACK, generatedAt: new Date().toISOString() }, null, 2))
  console.log(`Done. total=${total} added=${added} elapsed=${((Date.now() - t0) / 1000).toFixed(1)}s backend=${backend}`)
}

main().catch(e => { console.error(e); process.exit(1) })
