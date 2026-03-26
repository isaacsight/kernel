// kbot Living Knowledge Base — Self-Writing from Real Interactions
//
// A knowledge graph that grows from every source: conversations, forged tools,
// patterns, web searches, user questions. Stores per-topic JSON files with
// an index for fast lookup.
//
// Storage: ~/.kbot/knowledge/ directory
//   - index.json — master index of all entries
//   - <topic-slug>.json — entries for each topic
//
// Node built-ins only. No external dependencies.

import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'

// ── Paths ──

const KBOT_DIR = join(homedir(), '.kbot')
const KNOWLEDGE_DIR = join(KBOT_DIR, 'knowledge')
const INDEX_FILE = join(KNOWLEDGE_DIR, 'index.json')

// ── Types ──

export type KnowledgeSource =
  | 'conversation'
  | 'forge'
  | 'pattern'
  | 'web_search'
  | 'user_question'
  | 'email'
  | 'manual'

export interface KnowledgeEntry {
  /** Unique ID (SHA-256 hash of content + source) */
  id: string
  /** Primary topic this entry belongs to */
  topic: string
  /** The actual knowledge content */
  content: string
  /** Where this knowledge came from */
  source: KnowledgeSource
  /** Source detail (e.g., tool name, email subject, URL) */
  sourceDetail: string
  /** Confidence in this knowledge (0-1) */
  confidence: number
  /** Tags for cross-referencing */
  tags: string[]
  /** When this entry was created */
  createdAt: string
  /** When this entry was last verified/updated */
  updatedAt: string
}

export interface KnowledgeIndex {
  /** Total number of entries across all topics */
  totalEntries: number
  /** Map of topic slug -> entry count */
  topics: Record<string, number>
  /** Map of source type -> entry count */
  sources: Record<string, number>
  /** Last time the index was updated */
  lastUpdated: string
}

export interface KnowledgeQueryResult {
  /** The matching entry */
  entry: KnowledgeEntry
  /** Relevance score (higher = more relevant) */
  relevance: number
}

export interface KnowledgeStats {
  total_entries: number
  topics: string[]
  sources: Record<string, number>
  last_updated: string
}

// ── Helpers ──

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function loadJSON<T>(path: string, fallback: T): T {
  try {
    if (existsSync(path)) {
      return JSON.parse(readFileSync(path, 'utf-8'))
    }
  } catch {
    // Corrupt file — return fallback
  }
  return fallback
}

function saveJSON(path: string, data: unknown): void {
  ensureDir(dirname(path))
  writeFileSync(path, JSON.stringify(data, null, 2))
}

/** Convert a topic string to a filesystem-safe slug */
function slugify(topic: string): string {
  return topic
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'general'
}

/** Generate a deterministic ID for deduplication */
function entryId(content: string, source: string): string {
  return createHash('sha256')
    .update(`${content}:${source}`)
    .digest('hex')
    .slice(0, 16)
}

/** Get the file path for a topic's entries */
function topicFilePath(topicSlug: string): string {
  return join(KNOWLEDGE_DIR, `${topicSlug}.json`)
}

/** Load entries for a specific topic */
function loadTopicEntries(topicSlug: string): KnowledgeEntry[] {
  return loadJSON<KnowledgeEntry[]>(topicFilePath(topicSlug), [])
}

/** Save entries for a specific topic */
function saveTopicEntries(topicSlug: string, entries: KnowledgeEntry[]): void {
  saveJSON(topicFilePath(topicSlug), entries)
}

// ── TF-IDF Scoring ──

/** Tokenize text into lowercase words, removing stop words */
function tokenize(text: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'shall', 'can', 'to', 'of', 'in', 'for',
    'on', 'with', 'at', 'by', 'from', 'it', 'this', 'that', 'these',
    'those', 'i', 'me', 'my', 'we', 'you', 'your', 'he', 'she', 'they',
    'them', 'and', 'or', 'but', 'not', 'so', 'if', 'then', 'as', 'its',
    'what', 'which', 'who', 'whom', 'how', 'when', 'where', 'why',
  ])

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !stopWords.has(w))
}

/** Compute term frequency vector for a token list */
function termFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>()
  for (const token of tokens) {
    tf.set(token, (tf.get(token) || 0) + 1)
  }
  // Normalize by document length
  const len = tokens.length || 1
  for (const [term, count] of tf) {
    tf.set(term, count / len)
  }
  return tf
}

/** Compute cosine similarity between two TF vectors */
function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (const [term, weightA] of a) {
    normA += weightA * weightA
    const weightB = b.get(term) || 0
    dotProduct += weightA * weightB
  }

  for (const [, weightB] of b) {
    normB += weightB * weightB
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom > 0 ? dotProduct / denom : 0
}

// ── Knowledge Extraction ──

/** Extract facts, decisions, and recommendations from message text */
function extractKnowledge(text: string): string[] {
  const facts: string[] = []
  const sentences = text
    .split(/[.!?\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 15 && s.length < 500)

  // Fact indicators
  const factIndicators = [
    /\b(?:is|are|was|were|has|have)\b/i,
    /\b(?:uses?|requires?|needs?|supports?|provides?)\b/i,
    /\b(?:built with|powered by|based on|runs on)\b/i,
    /\b(?:costs?|prices?|takes?\s+\d)/i,
    /\b(?:found that|discovered|learned|noticed)\b/i,
  ]

  // Decision indicators
  const decisionIndicators = [
    /\b(?:decided|chose|selected|went with|opted for)\b/i,
    /\b(?:switched to|migrated to|moved to)\b/i,
    /\b(?:recommend|suggest|advise|prefer)\b/i,
    /\b(?:best practice|should|must|always|never)\b/i,
  ]

  for (const sentence of sentences) {
    const isFactLike = factIndicators.some(r => r.test(sentence))
    const isDecisionLike = decisionIndicators.some(r => r.test(sentence))

    if (isFactLike || isDecisionLike) {
      facts.push(sentence)
    }
  }

  return facts
}

/** Infer a topic from text content */
function inferTopic(text: string): string {
  const tokens = tokenize(text)

  // Count tech-relevant term frequencies
  const techTerms = new Set([
    'react', 'typescript', 'javascript', 'python', 'rust', 'go', 'docker',
    'api', 'database', 'test', 'deploy', 'build', 'component', 'server',
    'client', 'auth', 'security', 'performance', 'design', 'architecture',
    'mobile', 'web', 'cloud', 'devops', 'machine', 'learning', 'data',
    'analytics', 'payment', 'email', 'notification', 'search', 'cache',
    'queue', 'worker', 'microservice', 'monolith', 'frontend', 'backend',
    'fullstack', 'infrastructure', 'monitoring', 'logging', 'debugging',
    'refactoring', 'migration', 'integration', 'automation', 'workflow',
  ])

  const termCounts = new Map<string, number>()
  for (const token of tokens) {
    if (techTerms.has(token)) {
      termCounts.set(token, (termCounts.get(token) || 0) + 1)
    }
  }

  if (termCounts.size === 0) return 'general'

  // Return the most frequent tech term as topic
  const sorted = Array.from(termCounts.entries())
    .sort((a, b) => b[1] - a[1])
  return sorted[0][0]
}

/** Extract tags from text content */
function extractTags(text: string): string[] {
  const techTerms = new Set([
    'react', 'typescript', 'javascript', 'python', 'rust', 'go', 'docker',
    'api', 'database', 'test', 'deploy', 'build', 'component', 'server',
    'node', 'express', 'nextjs', 'vue', 'angular', 'svelte', 'django',
    'flask', 'rails', 'spring', 'prisma', 'supabase', 'stripe', 'vite',
    'webpack', 'postgres', 'mysql', 'redis', 'mongodb', 'graphql', 'rest',
    'websocket', 'terraform', 'kubernetes', 'aws', 'gcp', 'azure',
    'security', 'performance', 'auth', 'css', 'html', 'json', 'sql', 'git',
  ])

  const tokens = tokenize(text)
  const found = new Set<string>()
  for (const token of tokens) {
    if (techTerms.has(token)) {
      found.add(token)
    }
  }
  return Array.from(found).slice(0, 10)
}

// ── KnowledgeBase Class ──

export class KnowledgeBase {
  private indexCache: KnowledgeIndex | null = null

  constructor() {
    ensureDir(KNOWLEDGE_DIR)
  }

  /**
   * Add knowledge from any source.
   * Deduplicates by content hash.
   * Tags with source, confidence, timestamp.
   */
  ingest(
    source: KnowledgeSource,
    content: string,
    metadata?: {
      topic?: string
      sourceDetail?: string
      confidence?: number
      tags?: string[]
    },
  ): KnowledgeEntry {
    const topic = metadata?.topic || inferTopic(content)
    const topicSlug = slugify(topic)
    const id = entryId(content, source)
    const now = new Date().toISOString()

    // Check for duplicate
    const existing = loadTopicEntries(topicSlug)
    const duplicate = existing.find(e => e.id === id)
    if (duplicate) {
      // Update timestamp and confidence if new info
      duplicate.updatedAt = now
      if (metadata?.confidence !== undefined && metadata.confidence > duplicate.confidence) {
        duplicate.confidence = metadata.confidence
      }
      saveTopicEntries(topicSlug, existing)
      this.rebuildIndex()
      return duplicate
    }

    const entry: KnowledgeEntry = {
      id,
      topic,
      content,
      source,
      sourceDetail: metadata?.sourceDetail || '',
      confidence: metadata?.confidence ?? 0.7,
      tags: metadata?.tags || extractTags(content),
      createdAt: now,
      updatedAt: now,
    }

    existing.push(entry)

    // Cap entries per topic at 200 — keep highest confidence
    if (existing.length > 200) {
      existing.sort((a, b) => b.confidence - a.confidence)
      existing.length = 200
    }

    saveTopicEntries(topicSlug, existing)
    this.rebuildIndex()

    return entry
  }

  /**
   * Search the knowledge base for relevant entries.
   * Uses keyword matching + cosine similarity on TF-IDF vectors.
   * Returns ranked results with sources.
   */
  query(question: string): KnowledgeQueryResult[] {
    if (!question || typeof question !== 'string') return []

    const queryTokens = tokenize(question)
    if (queryTokens.length === 0) return []

    const queryTf = termFrequency(queryTokens)
    const results: KnowledgeQueryResult[] = []

    // Load all topic files
    const index = this.loadIndex()
    const topicSlugs = Object.keys(index.topics)

    for (const slug of topicSlugs) {
      const entries = loadTopicEntries(slug)
      for (const entry of entries) {
        // Compute relevance: TF-IDF cosine similarity + keyword overlap
        const entryTokens = tokenize(`${entry.topic} ${entry.content} ${entry.tags.join(' ')}`)
        const entryTf = termFrequency(entryTokens)

        const similarity = cosineSimilarity(queryTf, entryTf)

        // Keyword overlap bonus
        let keywordBonus = 0
        for (const qt of queryTokens) {
          if (entry.tags.some(t => t.includes(qt) || qt.includes(t))) {
            keywordBonus += 0.1
          }
          if (entry.topic.toLowerCase().includes(qt)) {
            keywordBonus += 0.15
          }
        }

        const relevance = similarity + keywordBonus

        if (relevance > 0.05) {
          results.push({
            entry,
            relevance: Math.min(relevance * entry.confidence, 1),
          })
        }
      }
    }

    // Sort by relevance descending
    results.sort((a, b) => b.relevance - a.relevance)

    return results.slice(0, 20)
  }

  /**
   * Get everything kbot knows about a topic, synthesized into a readable summary.
   * Pulls from all sources and organizes by type.
   */
  getTopicSummary(topic: string): string {
    const topicSlug = slugify(topic)

    // Try exact topic match first
    let entries = loadTopicEntries(topicSlug)

    // Also search across all topics for related entries
    const index = this.loadIndex()
    const topicSlugs = Object.keys(index.topics)
    const normalizedTopic = topic.toLowerCase()

    for (const slug of topicSlugs) {
      if (slug === topicSlug) continue
      // Check if the slug contains or is contained by the topic
      if (slug.includes(normalizedTopic) || normalizedTopic.includes(slug)) {
        entries = entries.concat(loadTopicEntries(slug))
      }
    }

    // Also check entries from other topics that have matching tags
    for (const slug of topicSlugs) {
      if (slug === topicSlug || slug.includes(normalizedTopic) || normalizedTopic.includes(slug)) continue
      const otherEntries = loadTopicEntries(slug)
      const matching = otherEntries.filter(
        e => e.tags.some(t => t.includes(normalizedTopic) || normalizedTopic.includes(t))
      )
      entries = entries.concat(matching)
    }

    if (entries.length === 0) {
      return `No knowledge found for topic: "${topic}".`
    }

    // Deduplicate by ID
    const seen = new Set<string>()
    entries = entries.filter(e => {
      if (seen.has(e.id)) return false
      seen.add(e.id)
      return true
    })

    // Sort by confidence descending
    entries.sort((a, b) => b.confidence - a.confidence)

    // Group by source type
    const bySource = new Map<KnowledgeSource, KnowledgeEntry[]>()
    for (const entry of entries) {
      const group = bySource.get(entry.source) || []
      group.push(entry)
      bySource.set(entry.source, group)
    }

    // Build summary
    const sections: string[] = []
    sections.push(`Knowledge Summary: ${topic}`)
    sections.push(`${'='.repeat(40)}`)
    sections.push(`${entries.length} entries from ${bySource.size} source type(s)\n`)

    const sourceLabels: Record<KnowledgeSource, string> = {
      conversation: 'From Conversations',
      forge: 'From Forged Tools',
      pattern: 'From Learned Patterns',
      web_search: 'From Web Searches',
      user_question: 'From User Questions',
      email: 'From Email Threads',
      manual: 'Manually Added',
    }

    for (const [source, group] of bySource) {
      sections.push(`--- ${sourceLabels[source] || source} (${group.length}) ---`)
      for (const entry of group.slice(0, 10)) {
        const confPct = Math.round(entry.confidence * 100)
        sections.push(`  [${confPct}%] ${entry.content}`)
        if (entry.sourceDetail) {
          sections.push(`        source: ${entry.sourceDetail}`)
        }
      }
      if (group.length > 10) {
        sections.push(`  ... and ${group.length - 10} more`)
      }
      sections.push('')
    }

    return sections.join('\n')
  }

  /**
   * Extract knowledge from an email/conversation thread.
   * Pulls out facts, decisions, recommendations.
   */
  addFromConversation(
    userEmail: string,
    messages: Array<{ role: string; content: string }>,
  ): KnowledgeEntry[] {
    const added: KnowledgeEntry[] = []

    // Combine all message content for topic inference
    const fullText = messages.map(m => m.content).join('\n')
    const overallTopic = inferTopic(fullText)

    for (const message of messages) {
      const facts = extractKnowledge(message.content)
      for (const fact of facts) {
        const entry = this.ingest('email', fact, {
          topic: overallTopic,
          sourceDetail: `conversation with ${userEmail}`,
          confidence: message.role === 'assistant' ? 0.8 : 0.6,
          tags: extractTags(fact),
        })
        added.push(entry)
      }
    }

    return added
  }

  /**
   * When a tool is forged, extract what problem it solves and add to KB.
   */
  addFromForge(tool: {
    name: string
    description: string
    tags?: string[]
    code?: string
  }): KnowledgeEntry {
    const content = `Forged tool "${tool.name}": ${tool.description}`
    const tags = [
      ...(tool.tags || []),
      'forge',
      'tool',
    ]

    return this.ingest('forge', content, {
      topic: inferTopic(tool.description),
      sourceDetail: `forged tool: ${tool.name}`,
      confidence: 0.9,
      tags,
    })
  }

  /**
   * Get knowledge base statistics.
   */
  getStats(): KnowledgeStats {
    const index = this.loadIndex()

    return {
      total_entries: index.totalEntries,
      topics: Object.keys(index.topics),
      sources: index.sources,
      last_updated: index.lastUpdated,
    }
  }

  // ── Private Helpers ──

  /** Load or rebuild the index */
  private loadIndex(): KnowledgeIndex {
    if (this.indexCache) return this.indexCache
    this.indexCache = loadJSON<KnowledgeIndex>(INDEX_FILE, {
      totalEntries: 0,
      topics: {},
      sources: {},
      lastUpdated: new Date().toISOString(),
    })
    return this.indexCache
  }

  /** Rebuild the index from all topic files */
  private rebuildIndex(): void {
    ensureDir(KNOWLEDGE_DIR)

    let totalEntries = 0
    const topics: Record<string, number> = {}
    const sources: Record<string, number> = {}

    let files: string[]
    try {
      files = readdirSync(KNOWLEDGE_DIR).filter(
        f => f.endsWith('.json') && f !== 'index.json'
      )
    } catch {
      files = []
    }

    for (const file of files) {
      const slug = file.replace(/\.json$/, '')
      const entries = loadTopicEntries(slug)
      if (entries.length === 0) continue

      topics[slug] = entries.length
      totalEntries += entries.length

      for (const entry of entries) {
        sources[entry.source] = (sources[entry.source] || 0) + 1
      }
    }

    const index: KnowledgeIndex = {
      totalEntries,
      topics,
      sources,
      lastUpdated: new Date().toISOString(),
    }

    this.indexCache = index
    saveJSON(INDEX_FILE, index)
  }
}
