// K:BOT Changelog Generator — Auto-generate release notes from git history
//
// Usage:
//   import { generateChangelog, formatChangelogTerminal } from './changelog.js'
//   const md = generateChangelog({ since: 'v2.11.0', format: 'markdown' })
//   const colored = formatChangelogTerminal(md)
//
// CLI:
//   $ kbot changelog              # Markdown to stdout (pipeable)
//   $ kbot changelog --since v2.11.0
//   REPL: /changelog              # Colored terminal output

import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import chalk from 'chalk'

// ── Conventional commit categories ──

interface CommitEntry {
  hash: string
  subject: string
  category: string
}

const CATEGORY_MAP: Record<string, string> = {
  'feat': 'Features',
  'fix': 'Bug Fixes',
  'perf': 'Performance',
  'refactor': 'Refactoring',
  'test': 'Tests',
  'docs': 'Documentation',
  'chore': 'Maintenance',
}

const CATEGORY_ORDER = [
  'Features',
  'Bug Fixes',
  'Performance',
  'Refactoring',
  'Tests',
  'Documentation',
  'Maintenance',
  'Other Changes',
]

// ── Git helpers ──

function getLastTag(): string | null {
  try {
    return execSync('git describe --tags --abbrev=0', {
      cwd: process.cwd(),
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()
  } catch {
    return null
  }
}

function getCommits(since?: string): CommitEntry[] {
  const range = since ? `${since}..HEAD` : ''
  const limit = since ? '' : '-20'
  const format = '%h %s' // short hash + subject

  const cmd = `git log ${range} ${limit} --format="${format}"`.replace(/\s+/g, ' ').trim()

  let output: string
  try {
    output = execSync(cmd, {
      cwd: process.cwd(),
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()
  } catch {
    return []
  }

  if (!output) return []

  return output.split('\n').map(line => {
    const spaceIdx = line.indexOf(' ')
    const hash = line.slice(0, spaceIdx)
    const subject = line.slice(spaceIdx + 1)
    const category = categorize(subject)
    return { hash, subject, category }
  })
}

function categorize(subject: string): string {
  const match = subject.match(/^(\w+)(?:\(.+?\))?:\s/)
  if (match) {
    const prefix = match[1].toLowerCase()
    return CATEGORY_MAP[prefix] || 'Other Changes'
  }
  return 'Other Changes'
}

function getVersion(): string {
  try {
    const pkgPath = join(process.cwd(), 'package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
    return pkg.version || 'unreleased'
  } catch {
    return 'unreleased'
  }
}

// ── Public API ──

export interface ChangelogOptions {
  /** Git ref to start from (default: last tag or last 20 commits) */
  since?: string
  /** Output format — 'markdown' for release notes, 'terminal' for CLI display */
  format?: 'markdown' | 'terminal'
}

/**
 * Generate a changelog from git history.
 *
 * Groups commits by conventional commit prefix and formats them
 * as either markdown (for release notes / piping) or terminal
 * (colored output for the REPL).
 */
export function generateChangelog(options?: ChangelogOptions): string {
  const format = options?.format || 'markdown'
  const since = options?.since || getLastTag() || undefined
  const commits = getCommits(since)

  if (commits.length === 0) {
    return format === 'terminal'
      ? 'No commits found.'
      : '> No commits found.\n'
  }

  // Group by category
  const groups: Record<string, CommitEntry[]> = {}
  for (const commit of commits) {
    if (!groups[commit.category]) groups[commit.category] = []
    groups[commit.category].push(commit)
  }

  const version = getVersion()
  const date = new Date().toISOString().slice(0, 10)
  const sinceLabel = since ? ` (since ${since})` : ''

  if (format === 'terminal') {
    return buildTerminalChangelog(version, date, sinceLabel, groups)
  }

  return buildMarkdownChangelog(version, date, sinceLabel, groups)
}

// ── Markdown output (pipeable) ──

function buildMarkdownChangelog(
  version: string,
  date: string,
  sinceLabel: string,
  groups: Record<string, CommitEntry[]>,
): string {
  const lines: string[] = []

  lines.push(`# ${version}${sinceLabel}`)
  lines.push('')
  lines.push(`_${date}_`)
  lines.push('')

  for (const category of CATEGORY_ORDER) {
    const entries = groups[category]
    if (!entries || entries.length === 0) continue

    lines.push(`## ${category}`)
    lines.push('')
    for (const entry of entries) {
      // Strip the prefix from the subject for cleaner display
      const clean = stripPrefix(entry.subject)
      lines.push(`- ${clean} (\`${entry.hash}\`)`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

// ── Terminal output (colored) ──

function buildTerminalChangelog(
  version: string,
  date: string,
  sinceLabel: string,
  groups: Record<string, CommitEntry[]>,
): string {
  const useColor = !process.env.NO_COLOR && process.stdout.isTTY !== false
  const ACCENT = useColor ? chalk.hex('#A78BFA') : (s: string) => s
  const DIM = useColor ? chalk.dim : (s: string) => s
  const GREEN = useColor ? chalk.hex('#4ADE80') : (s: string) => s
  const CYAN = useColor ? chalk.hex('#67E8F9') : (s: string) => s

  const lines: string[] = []

  lines.push('')
  lines.push(`  ${chalk.bold(ACCENT(`v${version}`))} ${DIM(date)}${DIM(sinceLabel)}`)
  lines.push(`  ${DIM('─'.repeat(50))}`)

  for (const category of CATEGORY_ORDER) {
    const entries = groups[category]
    if (!entries || entries.length === 0) continue

    lines.push('')
    lines.push(`  ${chalk.bold(category)}`)
    for (const entry of entries) {
      const clean = stripPrefix(entry.subject)
      lines.push(`  ${DIM('•')} ${clean} ${CYAN(entry.hash)}`)
    }
  }

  const total = Object.values(groups).reduce((sum, g) => sum + g.length, 0)
  lines.push('')
  lines.push(`  ${GREEN(`${total} commits`)}${DIM(sinceLabel || ' (last 20)')}`)
  lines.push('')

  return lines.join('\n')
}

// ── Formatting helpers ──

/**
 * Format a markdown changelog string for colored terminal output.
 * Use this to colorize changelog text that was already generated
 * in markdown format.
 */
export function formatChangelogTerminal(changelog: string): string {
  const useColor = !process.env.NO_COLOR && process.stdout.isTTY !== false
  if (!useColor) return changelog

  const ACCENT = chalk.hex('#A78BFA')
  const DIM = chalk.dim
  const CYAN = chalk.hex('#67E8F9')

  return changelog
    // H1 headers — version line
    .replace(/^# (.+)$/gm, (_m, h) => `  ${chalk.bold(ACCENT(h))}`)
    // H2 headers — category
    .replace(/^## (.+)$/gm, (_m, h) => `\n  ${chalk.bold(h)}`)
    // Date line (italic in markdown)
    .replace(/^_(.+)_$/gm, (_m, d) => `  ${DIM(d)}`)
    // Bullet points with inline code (commit hash)
    .replace(/^- (.+?) \(`([^`]+)`\)$/gm, (_m, text, hash) => `  ${DIM('•')} ${text} ${CYAN(hash)}`)
    // Remaining bullet points
    .replace(/^- (.+)$/gm, (_m, t) => `  ${DIM('•')} ${t}`)
    // Inline code
    .replace(/`([^`]+)`/g, (_m, c) => CYAN(c))
}

function stripPrefix(subject: string): string {
  // Remove "feat(scope): " or "fix: " prefixes for cleaner display
  return subject.replace(/^\w+(?:\(.+?\))?:\s*/, '')
}
