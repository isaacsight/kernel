// predict.ts — embed a context, query NN index, return ranked tool predictions.
import { VectorIndex } from './index.ts'

const OLLAMA = 'http://localhost:11434/api/embeddings'
const MODEL = 'nomic-embed-text'
const DIM_FALLBACK = 256
const K_NEIGHBORS = 20

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
  let s = 0; for (const x of v) s += x * x
  const n = Math.sqrt(s) || 1
  return v.map(x => x / n)
}

export interface Prediction { tool: string; confidence: number; votes: number }

export async function predict(
  index: VectorIndex,
  contextText: string,
  opts: { k?: number; excludeSession?: string; backend?: 'ollama' | 'hash' } = {}
): Promise<{ ranked: Prediction[]; latencyMs: number }> {
  const t0 = Date.now()
  const k = opts.k ?? K_NEIGHBORS
  let vec: number[] | null = opts.backend === 'hash' ? null : await ollamaEmbed(contextText)
  if (!vec) vec = hashEmbed(contextText)
  const neighbors = index.query(vec, k, opts.excludeSession)
  // vote by tool name, weight by score
  const votes = new Map<string, { count: number; scoreSum: number }>()
  for (const n of neighbors) {
    const e = votes.get(n.tool) ?? { count: 0, scoreSum: 0 }
    e.count += 1
    e.scoreSum += Math.max(0, n.score)
    votes.set(n.tool, e)
  }
  const total = neighbors.length || 1
  const ranked: Prediction[] = [...votes.entries()]
    .map(([tool, v]) => ({ tool, votes: v.count, confidence: v.count / total }))
    .sort((a, b) => b.votes - a.votes || b.confidence - a.confidence)
  return { ranked, latencyMs: Date.now() - t0 }
}

export function buildContextText(priorTools: string[], userMsg: string, firstArg: string): string {
  return [priorTools.slice(-3).join(' '), userMsg.slice(0, 200), firstArg.slice(0, 200)].filter(Boolean).join(' | ')
}
