// kbot Skill Library — Voyager-style auto-distilled, composable tool-chain skills
//
// Every successful multi-tool agent execution auto-distills into a named, reusable
// skill indexed by embedding for fast retrieval. Skills compound over time — the more
// kbot is used, the better it gets at recurring task patterns.
//
// Design:
//   - A "skill" is a named, reusable tool chain with an embedding vector for retrieval
//   - After every successful agent response with 2+ tool calls, distillSkill() extracts a skill
//   - Skills stored in ~/.kbot/memory/skills.json (max 500, ranked by successCount)
//   - Retrieval: given a new task, compute embedding similarity, return top-3 matches
//   - Skills inject into system prompt as "Proven tool sequences for similar tasks"
//   - Skills can compose: a complex skill can reference simpler sub-skills

import { homedir } from 'node:os'
import { join } from 'node:path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { rankBySimilarity, semanticSimilarity } from './embeddings.js'

// ── Types ──

export interface SkillStep {
  tool: string
  argsTemplate: Record<string, unknown>
}

export interface Skill {
  id: string
  name: string
  description: string
  steps: SkillStep[]
  /** Bag-of-words embedding for fast local matching (no API needed) */
  embedding: number[]
  successCount: number
  failureCount: number
  lastUsed: number
  created: number
  /** IDs of sub-skills this skill composes */
  composedOf?: string[]
  /** Original messages that produced this skill */
  sourceMessages: string[]
  /** Tags extracted from messages for keyword matching */
  tags: string[]
}

export interface SkillLibrary {
  version: number
  skills: Skill[]
  vocabulary: string[]  // global vocabulary for bag-of-words embedding
}

// ── Constants ──

const MEMORY_DIR = join(homedir(), '.kbot', 'memory')
const SKILLS_FILE = join(MEMORY_DIR, 'skills.json')
const MAX_SKILLS = 500
const MIN_TOOLS_FOR_SKILL = 2
const SIMILARITY_MERGE_THRESHOLD = 0.85
const MAX_SOURCE_MESSAGES = 5

// ── State ──

let library: SkillLibrary | null = null
let dirty = false
let saveTimer: ReturnType<typeof setTimeout> | null = null

// ── Persistence ──

function ensureDir(): void {
  if (!existsSync(MEMORY_DIR)) mkdirSync(MEMORY_DIR, { recursive: true })
}

function loadLibrary(): SkillLibrary {
  if (library) return library
  ensureDir()
  if (existsSync(SKILLS_FILE)) {
    try {
      const data = JSON.parse(readFileSync(SKILLS_FILE, 'utf-8'))
      if (data && Array.isArray(data.skills)) {
        library = data as SkillLibrary
        // Ensure vocabulary exists (migration)
        if (!library!.vocabulary) library!.vocabulary = []
        return library!
      }
    } catch { /* corrupted — start fresh */ }
  }
  library = { version: 1, skills: [], vocabulary: [] }
  return library
}

function scheduleSave(): void {
  dirty = true
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    if (dirty && library) {
      ensureDir()
      try {
        writeFileSync(SKILLS_FILE, JSON.stringify(library, null, 2))
      } catch { /* non-critical */ }
      dirty = false
    }
  }, 1000)
}

/** Force-save immediately (call on exit) */
export function flushSkillLibrary(): void {
  if (saveTimer) clearTimeout(saveTimer)
  if (dirty && library) {
    ensureDir()
    try {
      writeFileSync(SKILLS_FILE, JSON.stringify(library, null, 2))
    } catch { /* non-critical */ }
    dirty = false
  }
}

// ── Bag-of-Words Embedding (local, no API) ──

/** Stopwords to exclude from embeddings */
const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
  'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
  'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then',
  'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each',
  'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
  'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
  'just', 'because', 'but', 'and', 'or', 'if', 'while', 'although',
  'this', 'that', 'these', 'those', 'i', 'me', 'my', 'we', 'our', 'you',
  'your', 'he', 'him', 'his', 'she', 'her', 'it', 'its', 'they', 'them',
  'what', 'which', 'who', 'whom', 'this', 'that', 'am', 'about', 'up',
])

/** Tokenize text into meaningful words */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_\-./]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOPWORDS.has(w))
}

/** Build/update vocabulary and return bag-of-words vector for text */
function computeEmbedding(text: string, toolNames: string[]): number[] {
  const lib = loadLibrary()
  const tokens = tokenize(text)
  // Include tool names as high-signal tokens
  const allTokens = [...tokens, ...toolNames.map(t => t.toLowerCase())]

  // Expand vocabulary with new tokens
  const vocabSet = new Set(lib.vocabulary)
  for (const token of allTokens) {
    if (!vocabSet.has(token)) {
      vocabSet.add(token)
      lib.vocabulary.push(token)
    }
  }

  // Build vector (TF — term frequency normalized)
  const vector = new Array(lib.vocabulary.length).fill(0)
  const tokenFreq = new Map<string, number>()
  for (const t of allTokens) {
    tokenFreq.set(t, (tokenFreq.get(t) || 0) + 1)
  }
  for (const [token, freq] of tokenFreq) {
    const idx = lib.vocabulary.indexOf(token)
    if (idx >= 0) {
      vector[idx] = freq / allTokens.length
    }
  }

  return vector
}

/** Cosine similarity between two vectors (handles different lengths by zero-padding) */
function cosineSim(a: number[], b: number[]): number {
  const len = Math.max(a.length, b.length)
  if (len === 0) return 0
  let dotProduct = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < len; i++) {
    const va = i < a.length ? a[i] : 0
    const vb = i < b.length ? b[i] : 0
    dotProduct += va * vb
    normA += va * va
    normB += vb * vb
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dotProduct / denom
}

// ── Skill Name Generation ──

/** Generate a readable skill name from message + tools */
function generateSkillName(message: string, toolNames: string[]): string {
  // Extract key action words from the message
  const actionWords = tokenize(message)
    .filter(w => w.length > 2)
    .slice(0, 3)

  // Combine with main tool names
  const mainTools = toolNames.slice(0, 2).map(t => t.replace(/_/g, '-'))
  const parts = [...actionWords, ...mainTools].slice(0, 4)

  return parts.join('-') || `skill-${Date.now().toString(36)}`
}

/** Generate a description from message + tool sequence */
function generateDescription(message: string, toolNames: string[]): string {
  const truncMsg = message.length > 120 ? message.slice(0, 120) + '...' : message
  return `${truncMsg} [tools: ${toolNames.join(' → ')}]`
}

// ── Core API ──

/**
 * Distill a skill from a successful tool execution.
 * Called after every successful agent response with 2+ tool calls.
 */
export function distillSkill(
  message: string,
  toolSequence: Array<{ name: string; args: Record<string, unknown> }>,
  success: boolean,
): Skill | null {
  if (!success) return null
  if (toolSequence.length < MIN_TOOLS_FOR_SKILL) return null

  const lib = loadLibrary()
  const toolNames = toolSequence.map(t => t.name)
  const embedding = computeEmbedding(message, toolNames)

  // Check if a similar skill already exists (merge instead of duplicate)
  const existing = findSimilarSkill(embedding, toolNames)
  if (existing) {
    // Merge: increment success count, update timestamp, add source message
    existing.successCount++
    existing.lastUsed = Date.now()
    if (existing.sourceMessages.length < MAX_SOURCE_MESSAGES) {
      const truncMsg = message.slice(0, 200)
      if (!existing.sourceMessages.includes(truncMsg)) {
        existing.sourceMessages.push(truncMsg)
      }
    }
    // Merge any new tags
    const newTags = tokenize(message).filter(t => !existing.tags.includes(t)).slice(0, 10)
    existing.tags.push(...newTags)
    existing.tags = existing.tags.slice(0, 30)
    // Update embedding (moving average to incorporate new context)
    existing.embedding = blendEmbeddings(existing.embedding, embedding, 0.8)
    scheduleSave()
    return existing
  }

  // Create new skill
  const steps: SkillStep[] = toolSequence.map(t => ({
    tool: t.name,
    argsTemplate: sanitizeArgs(t.args),
  }))

  const skill: Skill = {
    id: `sk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name: generateSkillName(message, toolNames),
    description: generateDescription(message, toolNames),
    steps,
    embedding,
    successCount: 1,
    failureCount: 0,
    lastUsed: Date.now(),
    created: Date.now(),
    sourceMessages: [message.slice(0, 200)],
    tags: tokenize(message).slice(0, 20),
  }

  // Check if this skill composes existing simpler skills
  const subSkills = findComposableSubSkills(toolNames)
  if (subSkills.length > 0) {
    skill.composedOf = subSkills.map(s => s.id)
  }

  lib.skills.push(skill)

  // Enforce max size
  if (lib.skills.length > MAX_SKILLS) {
    pruneSkillLibrary()
  }

  scheduleSave()
  return skill
}

/**
 * Retrieve relevant skills for a given task message.
 * Uses embedding similarity (Ollama if available, else bag-of-words).
 */
export async function retrieveSkills(
  message: string,
  maxResults: number = 3,
): Promise<Skill[]> {
  const lib = loadLibrary()
  if (lib.skills.length === 0) return []

  // Strategy 1: Try Ollama embeddings via the existing embeddings.ts infrastructure
  const candidates = lib.skills.map(s => ({
    text: s.description,
    id: s.id,
  }))

  const ranked = await rankBySimilarity(message, candidates, maxResults * 2)

  if (ranked.length > 0 && ranked[0].score > 0.3) {
    return ranked
      .filter(r => r.score > 0.3)
      .slice(0, maxResults)
      .map(r => lib.skills.find(s => s.id === r.id)!)
      .filter(Boolean)
  }

  // Strategy 2: Fall back to local bag-of-words embedding
  const toolNames = extractToolHints(message)
  const queryEmbedding = computeEmbedding(message, toolNames)

  const scored = lib.skills.map(skill => ({
    skill,
    score: cosineSim(queryEmbedding, skill.embedding),
  }))

  // Boost by success count (more proven = better)
  for (const item of scored) {
    const successBoost = Math.min(item.skill.successCount * 0.02, 0.2)
    // Recency boost — skills used recently are more relevant
    const daysSinceUse = (Date.now() - item.skill.lastUsed) / (1000 * 60 * 60 * 24)
    const recencyBoost = daysSinceUse < 7 ? 0.05 : 0
    item.score += successBoost + recencyBoost
  }

  return scored
    .filter(s => s.score > 0.15)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(s => s.skill)
}

/**
 * Format retrieved skills for injection into the system prompt.
 */
export function formatSkillsForPrompt(skills: Skill[]): string {
  if (skills.length === 0) return ''

  const formatted = skills.map((skill, i) => {
    const steps = skill.steps
      .map((s, j) => `  ${j + 1}. ${s.tool}(${summarizeArgs(s.argsTemplate)})`)
      .join('\n')
    const reliability = skill.successCount > 0
      ? `${skill.successCount}x proven`
      : 'new'
    const composed = skill.composedOf && skill.composedOf.length > 0
      ? ` (composes ${skill.composedOf.length} sub-skills)`
      : ''
    return `${i + 1}. **${skill.name}** — ${reliability}${composed}\n${steps}`
  }).join('\n\n')

  return `\n\n[Proven Skill Library — tool sequences that worked for similar tasks]\n${formatted}\n\nUse these proven sequences as starting points. Adapt arguments to the current task.`
}

/**
 * Return the full skill library.
 */
export function getSkillLibrary(): SkillLibrary {
  return loadLibrary()
}

/**
 * Prune the skill library: remove low-success skills, keep top 500.
 * Sorting priority: successCount desc, then lastUsed desc.
 */
export function pruneSkillLibrary(): void {
  const lib = loadLibrary()

  // Remove skills that have never succeeded and are old
  const now = Date.now()
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000
  lib.skills = lib.skills.filter(s => {
    // Keep skills that have at least 1 success
    if (s.successCount > 0) return true
    // Keep recent skills (less than a week old) even if untested
    if (now - s.created < oneWeekMs) return true
    return false
  })

  // Sort: success count * recency weight
  lib.skills.sort((a, b) => {
    const scoreA = a.successCount * (1 + 1 / (1 + (now - a.lastUsed) / oneWeekMs))
    const scoreB = b.successCount * (1 + 1 / (1 + (now - b.lastUsed) / oneWeekMs))
    return scoreB - scoreA
  })

  // Trim to MAX_SKILLS
  if (lib.skills.length > MAX_SKILLS) {
    lib.skills = lib.skills.slice(0, MAX_SKILLS)
  }

  // Compact vocabulary — remove words not referenced by any skill
  compactVocabulary()

  scheduleSave()
}

/**
 * Record a failure for a skill (called when a retrieved skill's tool chain fails).
 */
export function recordSkillFailure(skillId: string): void {
  const lib = loadLibrary()
  const skill = lib.skills.find(s => s.id === skillId)
  if (skill) {
    skill.failureCount++
    scheduleSave()
  }
}

// ── Internal Helpers ──

/** Find an existing skill similar enough to merge with */
function findSimilarSkill(embedding: number[], toolNames: string[]): Skill | null {
  const lib = loadLibrary()
  for (const skill of lib.skills) {
    // First check: same tool sequence (fast path)
    const existingTools = skill.steps.map(s => s.tool)
    if (existingTools.length === toolNames.length &&
        existingTools.every((t, i) => t === toolNames[i])) {
      return skill
    }
    // Second check: embedding similarity
    const sim = cosineSim(embedding, skill.embedding)
    if (sim >= SIMILARITY_MERGE_THRESHOLD) {
      return skill
    }
  }
  return null
}

/** Find sub-skills whose tool sequence is a subsequence of the given tools */
function findComposableSubSkills(toolNames: string[]): Skill[] {
  const lib = loadLibrary()
  const subSkills: Skill[] = []

  for (const skill of lib.skills) {
    const skillTools = skill.steps.map(s => s.tool)
    if (skillTools.length >= toolNames.length) continue
    if (skillTools.length < 2) continue

    // Check if skillTools is a contiguous subsequence of toolNames
    const joined = toolNames.join(',')
    const subJoined = skillTools.join(',')
    if (joined.includes(subJoined)) {
      subSkills.push(skill)
    }
  }

  return subSkills
}

/** Blend two embeddings with a weight towards the existing one */
function blendEmbeddings(existing: number[], newVec: number[], existingWeight: number): number[] {
  const len = Math.max(existing.length, newVec.length)
  const blended = new Array(len).fill(0)
  const newWeight = 1 - existingWeight
  for (let i = 0; i < len; i++) {
    const e = i < existing.length ? existing[i] : 0
    const n = i < newVec.length ? newVec[i] : 0
    blended[i] = e * existingWeight + n * newWeight
  }
  return blended
}

/** Sanitize tool args for template storage — remove large values, keep structure */
function sanitizeArgs(args: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(args)) {
    if (typeof value === 'string' && value.length > 200) {
      clean[key] = '<content>'
    } else if (typeof value === 'object' && value !== null) {
      clean[key] = '<object>'
    } else {
      clean[key] = value
    }
  }
  return clean
}

/** Summarize args for display */
function summarizeArgs(args: Record<string, unknown>): string {
  const parts = Object.entries(args)
    .map(([k, v]) => {
      const val = typeof v === 'string' && v.length > 30 ? v.slice(0, 30) + '...' : String(v)
      return `${k}: ${val}`
    })
    .slice(0, 3)
  return parts.join(', ')
}

/** Extract tool name hints from a message (for better embedding) */
function extractToolHints(message: string): string[] {
  const lower = message.toLowerCase()
  const hints: string[] = []
  const toolKeywords: Record<string, string> = {
    'read': 'read_file', 'write': 'write_file', 'create file': 'write_file',
    'search': 'grep', 'find': 'grep', 'grep': 'grep',
    'git': 'git_status', 'commit': 'git_commit', 'diff': 'git_diff',
    'run': 'bash', 'execute': 'bash', 'command': 'bash', 'shell': 'bash',
    'build': 'bash', 'test': 'bash', 'install': 'bash',
    'web': 'web_search', 'fetch': 'url_fetch', 'download': 'url_fetch',
    'list': 'list_directory', 'ls': 'list_directory', 'dir': 'list_directory',
  }
  for (const [keyword, tool] of Object.entries(toolKeywords)) {
    if (lower.includes(keyword)) hints.push(tool)
  }
  return [...new Set(hints)]
}

/** Compact vocabulary by removing words not used by any skill */
function compactVocabulary(): void {
  const lib = loadLibrary()
  if (lib.vocabulary.length < 1000) return  // only compact when it's large

  // Find all vocabulary indices actually used
  const usedIndices = new Set<number>()
  for (const skill of lib.skills) {
    for (let i = 0; i < skill.embedding.length; i++) {
      if (skill.embedding[i] > 0) usedIndices.add(i)
    }
  }

  // Build new compact vocabulary + remap embeddings
  const oldToNew = new Map<number, number>()
  const newVocab: string[] = []
  for (const oldIdx of [...usedIndices].sort((a, b) => a - b)) {
    if (oldIdx < lib.vocabulary.length) {
      oldToNew.set(oldIdx, newVocab.length)
      newVocab.push(lib.vocabulary[oldIdx])
    }
  }

  // Remap all skill embeddings
  for (const skill of lib.skills) {
    const newEmb = new Array(newVocab.length).fill(0)
    for (let i = 0; i < skill.embedding.length; i++) {
      if (skill.embedding[i] > 0 && oldToNew.has(i)) {
        newEmb[oldToNew.get(i)!] = skill.embedding[i]
      }
    }
    skill.embedding = newEmb
  }

  lib.vocabulary = newVocab
}
