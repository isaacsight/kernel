// K:BOT Memory Tools — Active memory management (Letta/MemGPT-inspired)
//
// Gives agents the ability to self-edit their persistent memory:
//   - Save facts, preferences, patterns, and solutions
//   - Search memories by keyword
//   - Update existing memories (preserving creation time)
//   - Forget specific memories
//
// Memory is stored as individual JSON files under ~/.kbot/memory/{category}/

import { registerTool } from './index.js'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, readdirSync } from 'node:fs'

// ── Types ──

interface MemoryEntry {
  key: string
  content: string
  category: MemoryCategory
  created_at: string
  modified_at: string
  access_count: number
}

type MemoryCategory = 'fact' | 'preference' | 'pattern' | 'solution'

const VALID_CATEGORIES: MemoryCategory[] = ['fact', 'preference', 'pattern', 'solution']

// ── Helpers ──

const MEMORY_BASE = join(homedir(), '.kbot', 'memory')

function ensureCategoryDir(category: MemoryCategory): string {
  const dir = join(MEMORY_BASE, category)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}

/** Sanitize key for safe filesystem usage */
function sanitizeKey(key: string): string {
  return key
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 128)
}

function getMemoryPath(category: MemoryCategory, key: string): string {
  return join(ensureCategoryDir(category), `${sanitizeKey(key)}.json`)
}

function readMemoryFile(filePath: string): MemoryEntry | null {
  try {
    if (!existsSync(filePath)) return null
    return JSON.parse(readFileSync(filePath, 'utf-8')) as MemoryEntry
  } catch {
    return null
  }
}

function writeMemoryFile(filePath: string, entry: MemoryEntry): void {
  writeFileSync(filePath, JSON.stringify(entry, null, 2), 'utf-8')
}

/** Search all memories in a specific category directory */
function searchInCategory(category: MemoryCategory, query: string): MemoryEntry[] {
  const dir = join(MEMORY_BASE, category)
  if (!existsSync(dir)) return []

  const matches: MemoryEntry[] = []
  const lowerQuery = query.toLowerCase()

  try {
    const files = readdirSync(dir).filter(f => f.endsWith('.json'))
    for (const file of files) {
      const entry = readMemoryFile(join(dir, file))
      if (!entry) continue

      const keyMatch = entry.key.toLowerCase().includes(lowerQuery)
      const contentMatch = entry.content.toLowerCase().includes(lowerQuery)
      if (keyMatch || contentMatch) {
        matches.push(entry)
      }
    }
  } catch { /* dir read failed */ }

  return matches
}

/** Find a memory by key across all categories. Returns [entry, filePath, category] or null. */
function findMemoryByKey(key: string, category?: string): [MemoryEntry, string, MemoryCategory] | null {
  const sanitized = sanitizeKey(key)
  const categoriesToSearch = category && VALID_CATEGORIES.includes(category as MemoryCategory)
    ? [category as MemoryCategory]
    : VALID_CATEGORIES

  for (const cat of categoriesToSearch) {
    const filePath = join(MEMORY_BASE, cat, `${sanitized}.json`)
    const entry = readMemoryFile(filePath)
    if (entry) return [entry, filePath, cat]
  }
  return null
}

// ── Tools ──

export function registerMemoryTools(): void {

  // ── memory_save ──

  registerTool({
    name: 'memory_save',
    description: 'Save a fact, preference, learned pattern, or solution to persistent memory. Use this proactively when you learn something important about the user, their project, or discover a reusable solution.',
    parameters: {
      key: { type: 'string', description: 'Short descriptive key for this memory (e.g. "isaac-prefers-vanilla-css")', required: true },
      content: { type: 'string', description: 'The memory content to save — be specific and actionable', required: true },
      category: { type: 'string', description: 'Category: "fact", "preference", "pattern", or "solution" (default: "fact")' },
    },
    tier: 'free',
    timeout: 10_000,
    async execute(args) {
      const key = String(args.key || '').trim()
      const content = String(args.content || '').trim()
      const category = (VALID_CATEGORIES.includes(args.category as MemoryCategory) ? args.category : 'fact') as MemoryCategory

      if (!key) return 'Error: key is required.'
      if (!content) return 'Error: content is required.'

      const filePath = getMemoryPath(category, key)
      const existing = readMemoryFile(filePath)
      const now = new Date().toISOString()

      const entry: MemoryEntry = {
        key: sanitizeKey(key),
        content,
        category,
        created_at: existing?.created_at || now,
        modified_at: now,
        access_count: existing ? existing.access_count + 1 : 0,
      }

      writeMemoryFile(filePath, entry)

      return `Saved memory [${category}/${sanitizeKey(key)}]: ${content.slice(0, 120)}${content.length > 120 ? '...' : ''}`
    },
  })

  // ── memory_search ──

  registerTool({
    name: 'memory_search',
    description: 'Search persistent memories by keyword. Use this to recall user preferences, previously learned patterns, known facts, or saved solutions before starting a task.',
    parameters: {
      query: { type: 'string', description: 'Keyword or phrase to search for in memory keys and content', required: true },
      category: { type: 'string', description: 'Limit search to a specific category: "fact", "preference", "pattern", or "solution" (default: search all)' },
    },
    tier: 'free',
    timeout: 10_000,
    async execute(args) {
      const query = String(args.query || '').trim()
      if (!query) return 'Error: query is required.'

      const categoriesToSearch = args.category && VALID_CATEGORIES.includes(args.category as MemoryCategory)
        ? [args.category as MemoryCategory]
        : VALID_CATEGORIES

      let allMatches: MemoryEntry[] = []

      for (const cat of categoriesToSearch) {
        allMatches = allMatches.concat(searchInCategory(cat, query))
      }

      if (allMatches.length === 0) {
        return `No memories found matching "${query}".`
      }

      // Sort by modified_at descending (most recent first)
      allMatches.sort((a, b) => b.modified_at.localeCompare(a.modified_at))

      // Take top 10
      const top = allMatches.slice(0, 10)

      // Increment access_count for each accessed memory
      for (const entry of top) {
        const filePath = getMemoryPath(entry.category, entry.key)
        entry.access_count++
        writeMemoryFile(filePath, entry)
      }

      const results = top.map((entry, i) => {
        const age = entry.modified_at.split('T')[0]
        return `${i + 1}. [${entry.category}/${entry.key}] (${age}, accessed ${entry.access_count}x)\n   ${entry.content.slice(0, 200)}${entry.content.length > 200 ? '...' : ''}`
      }).join('\n')

      return `Found ${allMatches.length} memor${allMatches.length === 1 ? 'y' : 'ies'} matching "${query}"${allMatches.length > 10 ? ` (showing top 10)` : ''}:\n\n${results}`
    },
  })

  // ── memory_forget ──

  registerTool({
    name: 'memory_forget',
    description: 'Remove a specific memory by key. Use this when information is outdated, incorrect, or no longer relevant.',
    parameters: {
      key: { type: 'string', description: 'The key of the memory to remove', required: true },
      category: { type: 'string', description: 'Category to search in (default: search all categories)' },
    },
    tier: 'free',
    timeout: 10_000,
    async execute(args) {
      const key = String(args.key || '').trim()
      if (!key) return 'Error: key is required.'

      const found = findMemoryByKey(key, args.category as string | undefined)

      if (!found) {
        return `No memory found with key "${sanitizeKey(key)}"${args.category ? ` in category "${args.category}"` : ''}.`
      }

      const [entry, filePath, category] = found

      try {
        unlinkSync(filePath)
        return `Removed memory [${category}/${entry.key}]: ${entry.content.slice(0, 80)}${entry.content.length > 80 ? '...' : ''}`
      } catch (err) {
        return `Error removing memory: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // ── memory_update ──

  registerTool({
    name: 'memory_update',
    description: 'Update the content of an existing memory while preserving its creation timestamp. Use this when a fact, preference, or pattern has changed but the memory entry should be kept.',
    parameters: {
      key: { type: 'string', description: 'The key of the memory to update', required: true },
      content: { type: 'string', description: 'The new content to replace the existing content', required: true },
      category: { type: 'string', description: 'Category to search in (default: search all categories)' },
    },
    tier: 'free',
    timeout: 10_000,
    async execute(args) {
      const key = String(args.key || '').trim()
      const content = String(args.content || '').trim()

      if (!key) return 'Error: key is required.'
      if (!content) return 'Error: content is required.'

      const found = findMemoryByKey(key, args.category as string | undefined)

      if (!found) {
        return `No memory found with key "${sanitizeKey(key)}"${args.category ? ` in category "${args.category}"` : ''}. Use memory_save to create a new memory.`
      }

      const [entry, filePath, category] = found
      const now = new Date().toISOString()

      const updated: MemoryEntry = {
        key: entry.key,
        content,
        category,
        created_at: entry.created_at,
        modified_at: now,
        access_count: entry.access_count + 1,
      }

      writeMemoryFile(filePath, updated)

      return `Updated memory [${category}/${entry.key}]:\n  Old: ${entry.content.slice(0, 100)}${entry.content.length > 100 ? '...' : ''}\n  New: ${content.slice(0, 100)}${content.length > 100 ? '...' : ''}`
    },
  })
}
