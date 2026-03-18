// kbot Repo Map — Aider-style codebase indexer
//
// Walks a repo's file tree, extracts exported symbols from TS/JS/Python,
// and produces a compact tree string for LLM context injection.
// Uses only Node.js built-ins — no AST parser, no external deps.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative, basename, extname } from 'node:path'
import { execSync } from 'node:child_process'

const MAX_OUTPUT_CHARS = 8000
const CACHE_TTL_MS = 60_000

// ── .gitignore handling ──

/** Parse .gitignore into simple match patterns */
function loadGitignorePatterns(rootDir: string): string[] {
  const gitignorePath = join(rootDir, '.gitignore')
  if (!existsSync(gitignorePath)) return []
  try {
    return readFileSync(gitignorePath, 'utf-8')
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('#'))
  } catch { return [] }
}

/** Check if a path should be ignored (simple .gitignore matching) */
function isIgnored(relPath: string, patterns: string[], isDir: boolean): boolean {
  const name = basename(relPath)
  // Always skip these
  if (name === '.git' || name === 'node_modules' || name === '.DS_Store') return true

  for (const pat of patterns) {
    // Negation patterns — skip (too complex for simple matching)
    if (pat.startsWith('!')) continue

    const cleanPat = pat.replace(/\/$/, '')

    // Exact directory match: "dist" matches any dir named dist
    if (cleanPat === name && isDir) return true

    // Exact file match: "foo.log" matches any file named foo.log
    if (cleanPat === name && !isDir) return true

    // Glob prefix: "*.log" matches any .log file
    if (cleanPat.startsWith('*.') && !isDir) {
      const ext = cleanPat.slice(1) // ".log"
      if (name.endsWith(ext)) return true
    }

    // Path prefix: "src/engine/AI*.ts" — match relative path
    if (cleanPat.includes('/') && !cleanPat.startsWith('/')) {
      // Simple wildcard: replace * with regex .*
      const regex = new RegExp('^' + cleanPat.replace(/\*/g, '.*').replace(/\//g, '\\/') + '$')
      if (regex.test(relPath)) return true
    }
  }

  return false
}

// ── Symbol extraction ──

/** Extract exported symbol names from TypeScript/JavaScript source */
function extractTsSymbols(source: string): string[] {
  const symbols: string[] = []
  const seen = new Set<string>()

  const patterns = [
    // export function foo / export async function foo
    /export\s+(?:async\s+)?function\s+(\w+)/g,
    // export class Foo
    /export\s+class\s+(\w+)/g,
    // export interface Foo
    /export\s+interface\s+(\w+)/g,
    // export type Foo
    /export\s+type\s+(\w+)/g,
    // export const FOO / export let foo / export var foo
    /export\s+(?:const|let|var)\s+(\w+)/g,
    // export enum Foo
    /export\s+enum\s+(\w+)/g,
    // export { foo, bar } — named re-exports
    /export\s*\{([^}]+)\}/g,
    // export default class/function Foo
    /export\s+default\s+(?:class|function)\s+(\w+)/g,
  ]

  for (const regex of patterns) {
    let match
    while ((match = regex.exec(source)) !== null) {
      const captured = match[1]
      // Handle export { foo, bar as baz }
      if (regex.source.includes('\\{')) {
        const names = captured.split(',').map(n => {
          const parts = n.trim().split(/\s+as\s+/)
          return parts[parts.length - 1].trim()
        }).filter(n => n && /^\w+$/.test(n))
        for (const n of names) {
          if (!seen.has(n)) { seen.add(n); symbols.push(n) }
        }
      } else if (captured && !seen.has(captured)) {
        seen.add(captured)
        symbols.push(captured)
      }
    }
  }

  return symbols
}

/** Extract class/def names from Python source */
function extractPySymbols(source: string): string[] {
  const symbols: string[] = []
  const seen = new Set<string>()

  const patterns = [
    /^class\s+(\w+)/gm,
    /^def\s+(\w+)/gm,
    /^async\s+def\s+(\w+)/gm,
  ]

  for (const regex of patterns) {
    let match
    while ((match = regex.exec(source)) !== null) {
      const name = match[1]
      if (name && !name.startsWith('_') && !seen.has(name)) {
        seen.add(name)
        symbols.push(name)
      }
    }
  }

  return symbols
}

// ── File tree walking ──

interface FileEntry {
  relPath: string
  symbols: string[]
}

/** Recursively collect files from a directory */
function walkDir(
  dir: string,
  rootDir: string,
  patterns: string[],
  maxDepth: number,
  maxFiles: number,
  depth: number = 0,
  entries: FileEntry[] = [],
): FileEntry[] {
  if (depth > maxDepth || entries.length >= maxFiles) return entries

  let items: string[]
  try { items = readdirSync(dir) } catch { return entries }

  // Sort: directories first, then files alphabetically
  const sorted = items.sort((a, b) => {
    try {
      const aDir = statSync(join(dir, a)).isDirectory()
      const bDir = statSync(join(dir, b)).isDirectory()
      if (aDir !== bDir) return aDir ? -1 : 1
    } catch { /* ignore stat errors */ }
    return a.localeCompare(b)
  })

  for (const name of sorted) {
    if (entries.length >= maxFiles) break

    const fullPath = join(dir, name)
    const relPath = relative(rootDir, fullPath)

    let stats
    try { stats = statSync(fullPath) } catch { continue }

    if (stats.isDirectory()) {
      if (isIgnored(relPath, patterns, true)) continue
      walkDir(fullPath, rootDir, patterns, maxDepth, maxFiles, depth + 1, entries)
    } else if (stats.isFile()) {
      if (isIgnored(relPath, patterns, false)) continue

      const ext = extname(name).toLowerCase()
      let symbols: string[] = []

      if (['.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs'].includes(ext)) {
        try {
          const source = readFileSync(fullPath, 'utf-8')
          symbols = extractTsSymbols(source)
        } catch { /* unreadable */ }
      } else if (ext === '.py') {
        try {
          const source = readFileSync(fullPath, 'utf-8')
          symbols = extractPySymbols(source)
        } catch { /* unreadable */ }
      }

      entries.push({ relPath, symbols })
    }
  }

  return entries
}

// ── Tree formatting ──

/** Build a compact tree string from file entries */
function formatTree(entries: FileEntry[], totalFileCount: number): string {
  const lines: string[] = []
  let charCount = 0

  for (let i = 0; i < entries.length; i++) {
    const { relPath, symbols } = entries[i]
    const parts = relPath.split('/')
    const fileName = parts[parts.length - 1]
    const dirParts = parts.slice(0, -1)

    // Emit directory headers when path changes
    // Check if we need to print a new directory line
    if (i === 0 || dirParts.join('/') !== entries[i - 1].relPath.split('/').slice(0, -1).join('/')) {
      // Find which directories are new compared to previous entry
      const prevParts = i > 0 ? entries[i - 1].relPath.split('/').slice(0, -1) : []
      let commonDepth = 0
      while (commonDepth < prevParts.length && commonDepth < dirParts.length && prevParts[commonDepth] === dirParts[commonDepth]) {
        commonDepth++
      }
      // Print each new directory level
      for (let d = commonDepth; d < dirParts.length; d++) {
        const indent = '  '.repeat(d)
        const dirLine = `${indent}${dirParts[d]}/\n`
        charCount += dirLine.length
        if (charCount > MAX_OUTPUT_CHARS) {
          const remaining = totalFileCount - i
          lines.push(`... and ${remaining} more files`)
          return lines.join('')
        }
        lines.push(dirLine)
      }
    }

    // Format the file line
    const indent = '  '.repeat(dirParts.length)
    let line: string
    if (symbols.length > 0) {
      line = `${indent}${fileName}: ${symbols.join(', ')}\n`
    } else {
      line = `${indent}${fileName}\n`
    }

    charCount += line.length
    if (charCount > MAX_OUTPUT_CHARS) {
      const remaining = totalFileCount - i
      lines.push(`... and ${remaining} more files`)
      return lines.join('')
    }
    lines.push(line)
  }

  return lines.join('')
}

// ── Public API ──

export interface RepoMapOptions {
  maxDepth?: number
  maxFiles?: number
}

/** Generate a compact repo map for LLM context */
export async function generateRepoMap(
  rootDir: string,
  options: RepoMapOptions = {},
): Promise<string> {
  const { maxDepth = 8, maxFiles = 500 } = options

  const patterns = loadGitignorePatterns(rootDir)
  const entries = walkDir(rootDir, rootDir, patterns, maxDepth, maxFiles)

  if (entries.length === 0) return '(empty repository)'

  return formatTree(entries, entries.length)
}

// ── Cached convenience wrapper ──

let cachedMap: string | null = null
let cachedAt = 0
let cachedDir: string | null = null

/** Get repo map with 60s cache. Resolves git root from cwd. */
export async function getRepoMapForContext(cwd?: string): Promise<string> {
  const dir = cwd || process.cwd()

  // Resolve git root
  let rootDir = dir
  try {
    rootDir = execSync('git rev-parse --show-toplevel', {
      cwd: dir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()
  } catch {
    // Not a git repo — use cwd as root
  }

  const now = Date.now()
  if (cachedMap && cachedDir === rootDir && (now - cachedAt) < CACHE_TTL_MS) {
    return cachedMap
  }

  cachedMap = await generateRepoMap(rootDir)
  cachedAt = now
  cachedDir = rootDir
  return cachedMap
}
