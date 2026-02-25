/**
 * Markdown content system with frontmatter parsing.
 * Posts are stored as static imports to work with Vite's bundler.
 */

export interface PostMeta {
  slug: string
  title: string
  date: string
  tags: string[]
  summary: string
}

export interface Post extends PostMeta {
  content: string
}

/**
 * Parse frontmatter from a raw markdown string.
 * Format:
 * ---
 * title: My Post
 * date: 2026-01-15
 * tags: ai, systems
 * summary: A brief description
 * ---
 * Markdown body here...
 */
function parseFrontmatter(raw: string): { meta: Record<string, string>; content: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) return { meta: {}, content: raw }

  const meta: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim()
    meta[key] = value
  }

  return { meta, content: match[2].trim() }
}

function parsePost(slug: string, raw: string): Post {
  const { meta, content } = parseFrontmatter(raw)
  return {
    slug,
    title: meta.title || slug,
    date: meta.date || '',
    tags: (meta.tags || '').split(',').map(t => t.trim()).filter(Boolean),
    summary: meta.summary || '',
    content,
  }
}

// ── Static post registry ──────────────────────────────────────────
// Vite imports raw markdown via ?raw suffix

import sovereignSwarmRaw from '../content/posts/sovereign-swarm.md?raw'
import frontierNotesRaw from '../content/posts/frontier-notes.md?raw'
import wayOfCodeRaw from '../content/posts/way-of-code.md?raw'

const RAW_POSTS: Record<string, string> = {
  'sovereign-swarm': sovereignSwarmRaw,
  'frontier-notes': frontierNotesRaw,
  'way-of-code': wayOfCodeRaw,
}

let _cache: Post[] | null = null

export function getAllPosts(): Post[] {
  if (_cache) return _cache
  _cache = Object.entries(RAW_POSTS)
    .map(([slug, raw]) => parsePost(slug, raw))
    .sort((a, b) => (b.date > a.date ? 1 : -1))
  return _cache
}

export function getPostBySlug(slug: string): Post | undefined {
  return getAllPosts().find(p => p.slug === slug)
}

export function getPostsByTag(tag: string): Post[] {
  return getAllPosts().filter(p => p.tags.includes(tag))
}

export function getAllTags(): string[] {
  const tags = new Set<string>()
  for (const post of getAllPosts()) {
    for (const tag of post.tags) tags.add(tag)
  }
  return Array.from(tags).sort()
}
