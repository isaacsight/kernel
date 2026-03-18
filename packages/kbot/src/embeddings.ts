// kbot Embeddings — Semantic Similarity via Ollama
//
// Based on research showing embeddings-based matching outperforms
// keyword Jaccard similarity for solution retrieval and pattern matching.
//
// Uses Ollama's nomic-embed-text model (or falls back to Jaccard).
// Maintains a local cache (~1000 entries) to avoid redundant embedding calls.

import { homedir } from 'node:os'
import { join } from 'node:path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const CACHE_DIR = join(homedir(), '.kbot', 'memory')
const CACHE_FILE = join(CACHE_DIR, 'embedding-cache.json')
const MAX_CACHE_SIZE = 1000
const OLLAMA_URL = 'http://127.0.0.1:11434'
const EMBED_MODEL = 'nomic-embed-text'

/** Cached embedding entry */
interface EmbeddingEntry {
  text: string
  vector: number[]
  created: number
}

let cache: Map<string, EmbeddingEntry> = new Map()
let ollamaAvailable: boolean | null = null
let cacheLoaded = false

function ensureDir(): void {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true })
}

function loadCache(): void {
  if (cacheLoaded) return
  cacheLoaded = true
  try {
    if (existsSync(CACHE_FILE)) {
      const data = JSON.parse(readFileSync(CACHE_FILE, 'utf-8'))
      if (Array.isArray(data)) {
        for (const entry of data) {
          if (entry.text && entry.vector) {
            cache.set(entry.text, entry)
          }
        }
      }
    }
  } catch { /* start fresh */ }
}

/** Save cache to disk (debounced externally) */
export function saveEmbeddingCache(): void {
  ensureDir()
  const entries = Array.from(cache.values())
    .sort((a, b) => b.created - a.created)
    .slice(0, MAX_CACHE_SIZE)
  try {
    writeFileSync(CACHE_FILE, JSON.stringify(entries))
  } catch { /* non-critical */ }
}

/** Check if Ollama is running and has the embedding model */
async function checkOllama(): Promise<boolean> {
  if (ollamaAvailable !== null) return ollamaAvailable
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, {
      signal: AbortSignal.timeout(2000),
    })
    if (!res.ok) { ollamaAvailable = false; return false }
    const data = await res.json() as { models?: Array<{ name: string }> }
    ollamaAvailable = data.models?.some(m => m.name.includes('nomic-embed')) ?? false
    return ollamaAvailable
  } catch {
    ollamaAvailable = false
    return false
  }
}

/** Get embedding vector from Ollama */
async function getEmbedding(text: string): Promise<number[] | null> {
  loadCache()

  // Check cache first
  const normalized = text.toLowerCase().trim().slice(0, 500)
  const cached = cache.get(normalized)
  if (cached) return cached.vector

  // Check Ollama availability
  if (!(await checkOllama())) return null

  try {
    const res = await fetch(`${OLLAMA_URL}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: EMBED_MODEL, input: normalized }),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const data = await res.json() as { embeddings?: number[][] }
    const vector = data.embeddings?.[0]
    if (!vector || vector.length === 0) return null

    // Cache it
    cache.set(normalized, { text: normalized, vector, created: Date.now() })

    // Evict oldest if over limit
    if (cache.size > MAX_CACHE_SIZE) {
      const entries = Array.from(cache.entries())
        .sort((a, b) => a[1].created - b[1].created)
      const toDelete = entries.slice(0, entries.length - MAX_CACHE_SIZE)
      for (const [key] of toDelete) cache.delete(key)
    }

    return vector
  } catch {
    return null
  }
}

/** Cosine similarity between two vectors */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dotProduct = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dotProduct / denom
}

/** Jaccard similarity fallback (keyword-based) */
function jaccardSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2))
  const wordsB = new Set(b.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2))
  if (wordsA.size === 0 || wordsB.size === 0) return 0
  const intersection = [...wordsA].filter(w => wordsB.has(w)).length
  const union = new Set([...wordsA, ...wordsB]).size
  return union > 0 ? intersection / union : 0
}

/**
 * Compute semantic similarity between two texts.
 * Uses embeddings if Ollama is available, falls back to Jaccard.
 */
export async function semanticSimilarity(a: string, b: string): Promise<number> {
  const vecA = await getEmbedding(a)
  const vecB = await getEmbedding(b)

  if (vecA && vecB) {
    return cosineSimilarity(vecA, vecB)
  }

  // Fallback to Jaccard
  return jaccardSimilarity(a, b)
}

/**
 * Find the best match from a list of candidates.
 * Returns the candidate with highest similarity above the threshold.
 */
export async function findBestMatch(
  query: string,
  candidates: Array<{ text: string; id: string }>,
  threshold: number = 0.5,
): Promise<{ id: string; score: number } | null> {
  let bestId: string | null = null
  let bestScore = 0

  // Try embeddings first
  const queryVec = await getEmbedding(query)

  for (const candidate of candidates) {
    let score: number

    if (queryVec) {
      const candidateVec = await getEmbedding(candidate.text)
      score = candidateVec
        ? cosineSimilarity(queryVec, candidateVec)
        : jaccardSimilarity(query, candidate.text)
    } else {
      score = jaccardSimilarity(query, candidate.text)
    }

    if (score > bestScore && score >= threshold) {
      bestScore = score
      bestId = candidate.id
    }
  }

  return bestId ? { id: bestId, score: bestScore } : null
}

/**
 * Rank candidates by semantic similarity to query.
 * Returns sorted array with scores.
 */
export async function rankBySimilarity(
  query: string,
  candidates: Array<{ text: string; id: string }>,
  topK: number = 5,
): Promise<Array<{ id: string; score: number }>> {
  const queryVec = await getEmbedding(query)
  const scored: Array<{ id: string; score: number }> = []

  for (const candidate of candidates) {
    let score: number
    if (queryVec) {
      const candidateVec = await getEmbedding(candidate.text)
      score = candidateVec
        ? cosineSimilarity(queryVec, candidateVec)
        : jaccardSimilarity(query, candidate.text)
    } else {
      score = jaccardSimilarity(query, candidate.text)
    }
    scored.push({ id: candidate.id, score })
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
}

/** Warm the embedding cache with common queries (call on startup) */
export async function warmCache(texts: string[]): Promise<void> {
  loadCache()
  if (!(await checkOllama())) return

  const uncached = texts.filter(t => !cache.has(t.toLowerCase().trim().slice(0, 500)))
  // Warm up to 20 at a time to avoid hammering Ollama
  for (const text of uncached.slice(0, 20)) {
    await getEmbedding(text)
  }
  if (uncached.length > 0) saveEmbeddingCache()
}

/** Check if embeddings are available (Ollama + nomic-embed-text) */
export async function isEmbeddingsAvailable(): Promise<boolean> {
  return checkOllama()
}

/** Get cache stats */
export function getCacheStats(): { size: number; maxSize: number; available: boolean | null } {
  loadCache()
  return { size: cache.size, maxSize: MAX_CACHE_SIZE, available: ollamaAvailable }
}
