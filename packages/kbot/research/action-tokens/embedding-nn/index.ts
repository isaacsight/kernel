// index.ts — brute-force cosine NN over N vectors. Fine at N≈20K.
import { readFileSync, writeFileSync } from 'node:fs'
import type { EmbeddedEvent } from './embed.ts'

export interface IndexEntry { id: string; tool: string; session: string; vec: Float32Array }

export class VectorIndex {
  entries: IndexEntry[] = []

  add(e: Pick<EmbeddedEvent, 'id' | 'tool' | 'session' | 'vec'>) {
    const v = new Float32Array(e.vec)
    // L2 normalize once at insertion
    let s = 0; for (let i = 0; i < v.length; i++) s += v[i] * v[i]
    const n = Math.sqrt(s) || 1
    for (let i = 0; i < v.length; i++) v[i] /= n
    this.entries.push({ id: e.id, tool: e.tool, session: e.session, vec: v })
  }

  query(q: number[] | Float32Array, k: number, excludeSession?: string): { id: string; tool: string; session: string; score: number }[] {
    const qv = q instanceof Float32Array ? q : new Float32Array(q)
    let qs = 0; for (let i = 0; i < qv.length; i++) qs += qv[i] * qv[i]
    const qn = Math.sqrt(qs) || 1
    // top-k via simple scan + partial sort
    const scored: { id: string; tool: string; session: string; score: number }[] = []
    for (const e of this.entries) {
      if (excludeSession && e.session === excludeSession) continue
      let dot = 0
      const v = e.vec
      const L = Math.min(v.length, qv.length)
      for (let i = 0; i < L; i++) dot += v[i] * qv[i]
      scored.push({ id: e.id, tool: e.tool, session: e.session, score: dot / qn })
    }
    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, k)
  }

  size() { return this.entries.length }

  save(path: string) {
    // compact JSON: { dim, items: [[id, tool, session, [v0,v1,...]], ...] }
    const dim = this.entries[0]?.vec.length ?? 0
    const items = this.entries.map(e => [e.id, e.tool, e.session, Array.from(e.vec)])
    writeFileSync(path, JSON.stringify({ dim, items }))
  }

  static load(path: string): VectorIndex {
    const raw = JSON.parse(readFileSync(path, 'utf-8')) as { dim: number; items: [string, string, string, number[]][] }
    const idx = new VectorIndex()
    for (const [id, tool, session, vec] of raw.items) idx.entries.push({ id, tool, session, vec: new Float32Array(vec) })
    return idx
  }
}

export function loadEmbeddingsCache(path: string): EmbeddedEvent[] {
  const out: EmbeddedEvent[] = []
  for (const line of readFileSync(path, 'utf-8').split('\n')) {
    if (!line.trim()) continue
    try { out.push(JSON.parse(line)) } catch {}
  }
  return out
}
