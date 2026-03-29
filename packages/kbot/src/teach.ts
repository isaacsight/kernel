// kbot Teach — Explicit pattern teaching system
//
// Lets users teach kbot patterns, rules, preferences, aliases, and workflows.
// Teachings are user-explicit (priority > auto-extracted patterns from learning.ts).
// Stored in ~/.kbot/teachings.json as a flat JSON array.
//
// Usage:
//   kbot teach                    # Interactive teach mode
//   kbot teach "when I say deploy, run ship pipeline"  # Quick teach
//   kbot teach list               # List all teachings
//   kbot teach remove <id>        # Remove a teaching
//   kbot teach stats              # Usage statistics

import { homedir } from 'node:os'
import { join } from 'node:path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { randomUUID } from 'node:crypto'
import chalk from 'chalk'

// ═══ Types ═══════════════════════════════════════════════════════

export type TeachingType = 'pattern' | 'rule' | 'preference' | 'alias' | 'workflow'

export interface Teaching {
  /** Unique identifier (8-char UUID prefix) */
  id: string
  /** What kind of teaching this is */
  type: TeachingType
  /** What triggers this teaching — keyword, phrase, or regex pattern */
  trigger: string
  /** What kbot should do when triggered */
  action: string
  /** Optional context constraint — project name, language, directory, etc. */
  context?: string
  /** Priority: higher = checked first. User-taught always >= 50 (auto-extracted < 50) */
  priority: number
  /** Example inputs that should trigger this teaching */
  examples?: string[]
  /** ISO timestamp of creation */
  createdAt: string
  /** Number of times this teaching has been applied */
  usedCount: number
  /** ISO timestamp of last use */
  lastUsedAt?: string
}

// ═══ Storage ═════════════════════════════════════════════════════

const KBOT_DIR = join(homedir(), '.kbot')
const TEACHINGS_FILE = join(KBOT_DIR, 'teachings.json')

function ensureDir(): void {
  if (!existsSync(KBOT_DIR)) mkdirSync(KBOT_DIR, { recursive: true })
}

function loadTeachings(): Teaching[] {
  ensureDir()
  if (!existsSync(TEACHINGS_FILE)) return []
  try {
    return JSON.parse(readFileSync(TEACHINGS_FILE, 'utf-8'))
  } catch {
    return []
  }
}

function saveTeachings(teachings: Teaching[]): void {
  ensureDir()
  writeFileSync(TEACHINGS_FILE, JSON.stringify(teachings, null, 2))
}

/** In-memory cache — loaded once, saved on mutation */
let teachings: Teaching[] = loadTeachings()

function persist(): void {
  saveTeachings(teachings)
}

// ═══ ID generation ═══════════════════════════════════════════════

function newId(): string {
  return randomUUID().slice(0, 8)
}

// ═══ Natural Language Parsing ════════════════════════════════════

/** Type detection keywords — used to classify natural language input */
const TYPE_SIGNALS: Record<TeachingType, RegExp[]> = {
  pattern: [
    /when (?:i|we) (?:say|type|write|ask)\b/i,
    /if (?:i|we|the user) (?:say|type|write|ask|mention)\b/i,
    /whenever\b/i,
  ],
  rule: [
    /always\b/i,
    /never\b/i,
    /must\b/i,
    /don'?t ever\b/i,
    /every time\b/i,
  ],
  preference: [
    /(?:i|we) prefer\b/i,
    /use .+ (?:instead of|over|rather than)\b/i,
    /(?:i|we) like\b/i,
    /default (?:to|should be)\b/i,
    /favor\b/i,
  ],
  alias: [
    /\b(?:means?|is short for|stands for|is an alias for)\b/i,
    /^[a-z0-9_-]+\s*=\s*/i,
  ],
  workflow: [
    /(?:to|when you) .+,?\s*first\b/i,
    /step\s*1\b/i,
    /then .+,?\s*then\b/i,
    /the process (?:is|for)\b/i,
    /workflow\b/i,
    /pipeline\b/i,
  ],
}

/**
 * Detect teaching type from natural language input.
 * Returns the best match or null if ambiguous.
 */
function detectType(input: string): TeachingType | null {
  const scores: Record<TeachingType, number> = {
    pattern: 0, rule: 0, preference: 0, alias: 0, workflow: 0,
  }
  for (const [type, patterns] of Object.entries(TYPE_SIGNALS)) {
    for (const re of patterns) {
      if (re.test(input)) scores[type as TeachingType]++
    }
  }
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1])
  if (sorted[0][1] > 0 && sorted[0][1] > (sorted[1]?.[1] ?? 0)) {
    return sorted[0][0] as TeachingType
  }
  return null
}

/**
 * Extract trigger and action from natural language.
 * Handles common patterns like:
 *   "when I say 'deploy', run the ship pipeline"
 *   "always use TypeScript strict mode"
 *   "I prefer tabs over spaces"
 *   "d = deploy to production"
 *   "to release, first run tests, then build, then deploy"
 */
function parseTriggerAction(input: string, type: TeachingType): { trigger: string; action: string } {
  // Pattern: "when I say X, do Y"
  const whenMatch = input.match(
    /when (?:i|we|the user) (?:say|type|write|ask)\s+['"]?(.+?)['"]?\s*,\s*(.+)/i
  )
  if (whenMatch) return { trigger: whenMatch[1].trim(), action: whenMatch[2].trim() }

  // Pattern: "if X, then Y" / "if X, Y"
  const ifMatch = input.match(/if\s+(?:i|we|the user)\s+(?:say|type|write|ask|mention)\s+['"]?(.+?)['"]?\s*,\s*(?:then\s+)?(.+)/i)
  if (ifMatch) return { trigger: ifMatch[1].trim(), action: ifMatch[2].trim() }

  // Rule: "always X" / "never X"
  const alwaysMatch = input.match(/^(always|never|must)\s+(.+)/i)
  if (alwaysMatch) {
    return {
      trigger: `[${alwaysMatch[1].toLowerCase()}]`,
      action: alwaysMatch[2].trim(),
    }
  }

  // Preference: "I prefer X over Y" / "use X instead of Y"
  const preferMatch = input.match(/(?:i|we) prefer\s+(.+?)\s+(?:over|instead of|rather than)\s+(.+)/i)
  if (preferMatch) {
    return {
      trigger: preferMatch[2].trim(),
      action: `Use ${preferMatch[1].trim()} instead`,
    }
  }

  const useInsteadMatch = input.match(/use\s+(.+?)\s+(?:instead of|over|rather than)\s+(.+)/i)
  if (useInsteadMatch) {
    return {
      trigger: useInsteadMatch[2].trim(),
      action: `Use ${useInsteadMatch[1].trim()} instead`,
    }
  }

  const defaultMatch = input.match(/default\s+(?:to|should be)\s+(.+)/i)
  if (defaultMatch) {
    return {
      trigger: '[default]',
      action: defaultMatch[1].trim(),
    }
  }

  // Alias: "X means Y" / "X = Y" / "X is short for Y"
  const aliasMatch = input.match(/^['"]?(.+?)['"]?\s*(?:means?|is short for|stands for|is an alias for|=)\s*['"]?(.+?)['"]?$/i)
  if (aliasMatch) {
    return { trigger: aliasMatch[1].trim(), action: aliasMatch[2].trim() }
  }

  // Workflow: "to X, first A, then B, then C"
  const workflowMatch = input.match(/(?:to|when you)\s+(.+?)\s*,\s*(?:first\s+)?(.+)/i)
  if (workflowMatch && type === 'workflow') {
    return { trigger: workflowMatch[1].trim(), action: workflowMatch[2].trim() }
  }

  // Fallback: split on first comma or "do"/"run"/"execute"
  const fallbackMatch = input.match(/^(.+?)\s*(?:,\s*(?:then\s+)?|:\s*)(do|run|execute|use|apply|call)?\s*(.+)$/i)
  if (fallbackMatch) {
    return {
      trigger: fallbackMatch[1].trim(),
      action: (fallbackMatch[2] ? fallbackMatch[2] + ' ' : '') + fallbackMatch[3].trim(),
    }
  }

  // Last resort: the whole input is the action, trigger is unset
  return { trigger: '', action: input.trim() }
}

// ═══ Core Operations ═════════════════════════════════════════════

/**
 * Create a new teaching from parsed components.
 */
export function createTeaching(opts: {
  type: TeachingType
  trigger: string
  action: string
  context?: string
  priority?: number
  examples?: string[]
}): Teaching {
  const teaching: Teaching = {
    id: newId(),
    type: opts.type,
    trigger: opts.trigger,
    action: opts.action,
    context: opts.context,
    priority: opts.priority ?? 50, // user-taught default: 50 (always > auto-extracted)
    examples: opts.examples,
    createdAt: new Date().toISOString(),
    usedCount: 0,
  }
  teachings.push(teaching)
  persist()
  return teaching
}

/**
 * Quick teach — parse natural language into a teaching in one shot.
 *
 * Examples:
 *   quickTeach("when I say 'deploy', run the ship pipeline")
 *   quickTeach("always use strict TypeScript")
 *   quickTeach("d = deploy to production")
 */
export async function quickTeach(input: string): Promise<Teaching> {
  const type = detectType(input) ?? 'pattern'
  const { trigger, action } = parseTriggerAction(input, type)

  if (!trigger && !action) {
    throw new Error('Could not parse teaching. Try: "when I say X, do Y" or "always do X"')
  }

  return createTeaching({
    type,
    trigger: trigger || action,
    action: action || trigger,
  })
}

// ═══ Matching ════════════════════════════════════════════════════

/**
 * Find teachings that match a user message.
 * Returns matches sorted by priority (highest first).
 *
 * Matching strategy:
 * - Rules with trigger [always]/[never] always match (they are global)
 * - Patterns: keyword or regex match against message
 * - Aliases: exact or substring match against message
 * - Preferences: keyword match
 * - Workflows: keyword match
 * - Context: if teaching has a context, current context must match
 */
export function findMatchingTeachings(message: string, context?: string): Teaching[] {
  const lowerMessage = message.toLowerCase()
  const matches: Teaching[] = []

  for (const t of teachings) {
    // Context filter: if teaching specifies a context, check it
    if (t.context && context) {
      const lowerContext = context.toLowerCase()
      const teachContext = t.context.toLowerCase()
      if (!lowerContext.includes(teachContext) && !teachContext.includes(lowerContext)) {
        continue
      }
    } else if (t.context && !context) {
      // Teaching requires context but none provided — skip
      continue
    }

    let matched = false

    switch (t.type) {
      case 'rule': {
        // Rules with special triggers always apply
        if (t.trigger.startsWith('[') && t.trigger.endsWith(']')) {
          matched = true
        } else {
          matched = lowerMessage.includes(t.trigger.toLowerCase())
        }
        break
      }

      case 'pattern': {
        // Try regex match first
        try {
          const re = new RegExp(t.trigger, 'i')
          matched = re.test(message)
        } catch {
          // Not a valid regex — fall back to keyword match
          matched = lowerMessage.includes(t.trigger.toLowerCase())
        }
        break
      }

      case 'alias': {
        // Exact match or word-boundary match for aliases
        const lowerTrigger = t.trigger.toLowerCase()
        const re = new RegExp(`\\b${escapeRegex(lowerTrigger)}\\b`, 'i')
        matched = re.test(message)
        break
      }

      case 'preference': {
        // Keyword match
        const keywords = t.trigger.toLowerCase().split(/\s+/)
        matched = keywords.some(kw => kw.length > 2 && lowerMessage.includes(kw))
        break
      }

      case 'workflow': {
        // Keyword match on trigger
        const keywords = t.trigger.toLowerCase().split(/\s+/)
        const significantKeywords = keywords.filter(kw => kw.length > 2)
        // Require at least half the significant keywords to match
        const matchCount = significantKeywords.filter(kw => lowerMessage.includes(kw)).length
        matched = significantKeywords.length > 0 && matchCount >= Math.ceil(significantKeywords.length / 2)
        break
      }
    }

    // Also check examples if trigger didn't match
    if (!matched && t.examples) {
      matched = t.examples.some(ex => lowerMessage.includes(ex.toLowerCase()))
    }

    if (matched) {
      matches.push(t)
    }
  }

  // Sort by priority descending, then by usedCount descending (most used = more trusted)
  matches.sort((a, b) => b.priority - a.priority || b.usedCount - a.usedCount)
  return matches
}

/** Escape special regex characters */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Record that a teaching was used (updates usedCount and lastUsedAt).
 */
export function recordTeachingUsed(id: string): void {
  const t = teachings.find(t => t.id === id)
  if (t) {
    t.usedCount++
    t.lastUsedAt = new Date().toISOString()
    persist()
  }
}

// ═══ Management ══════════════════════════════════════════════════

/**
 * List all teachings, optionally filtered by type and/or context.
 */
export function listTeachings(filter?: { type?: string; context?: string }): Teaching[] {
  let result = [...teachings]
  if (filter?.type) {
    result = result.filter(t => t.type === filter.type)
  }
  if (filter?.context) {
    const lc = filter.context.toLowerCase()
    result = result.filter(t => t.context?.toLowerCase().includes(lc))
  }
  return result.sort((a, b) => b.priority - a.priority)
}

/**
 * Remove a teaching by ID.
 * Returns true if found and removed, false if not found.
 */
export function removeTeaching(id: string): boolean {
  const idx = teachings.findIndex(t => t.id === id)
  if (idx === -1) return false
  teachings.splice(idx, 1)
  persist()
  return true
}

/**
 * Edit a teaching by ID.
 * Returns the updated teaching or null if not found.
 */
export function editTeaching(id: string, updates: Partial<Omit<Teaching, 'id' | 'createdAt'>>): Teaching | null {
  const t = teachings.find(t => t.id === id)
  if (!t) return null

  if (updates.type !== undefined) t.type = updates.type
  if (updates.trigger !== undefined) t.trigger = updates.trigger
  if (updates.action !== undefined) t.action = updates.action
  if (updates.context !== undefined) t.context = updates.context
  if (updates.priority !== undefined) t.priority = updates.priority
  if (updates.examples !== undefined) t.examples = updates.examples

  persist()
  return t
}

/**
 * Get a teaching by ID.
 */
export function getTeaching(id: string): Teaching | null {
  return teachings.find(t => t.id === id) ?? null
}

/**
 * Get aggregate statistics about teachings.
 */
export function getTeachingStats(): {
  total: number
  byType: Record<string, number>
  mostUsed: Teaching[]
  recentlyAdded: Teaching[]
  neverUsed: Teaching[]
} {
  const byType: Record<string, number> = {}
  for (const t of teachings) {
    byType[t.type] = (byType[t.type] ?? 0) + 1
  }

  const mostUsed = [...teachings]
    .filter(t => t.usedCount > 0)
    .sort((a, b) => b.usedCount - a.usedCount)
    .slice(0, 10)

  const recentlyAdded = [...teachings]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5)

  const neverUsed = teachings.filter(t => t.usedCount === 0)

  return { total: teachings.length, byType, mostUsed, recentlyAdded, neverUsed }
}

// ═══ Prompt Integration ══════════════════════════════════════════

/**
 * Build a system prompt fragment from active rules and preferences.
 * This is injected into the agent's system prompt so rules/preferences
 * are always active without needing a trigger match.
 */
export function getTeachingPromptRules(): string {
  const rules = teachings.filter(t => t.type === 'rule')
  const prefs = teachings.filter(t => t.type === 'preference')

  if (rules.length === 0 && prefs.length === 0) return ''

  const lines: string[] = ['\n[User-Taught Rules & Preferences]']

  if (rules.length > 0) {
    lines.push('Rules:')
    for (const r of rules.sort((a, b) => b.priority - a.priority)) {
      const prefix = r.trigger === '[always]' ? 'ALWAYS' :
                     r.trigger === '[never]' ? 'NEVER' :
                     r.trigger.replace(/^\[|\]$/g, '').toUpperCase()
      lines.push(`- ${prefix}: ${r.action}`)
    }
  }

  if (prefs.length > 0) {
    lines.push('Preferences:')
    for (const p of prefs.sort((a, b) => b.priority - a.priority)) {
      lines.push(`- ${p.action}${p.context ? ` (when: ${p.context})` : ''}`)
    }
  }

  lines.push('')
  return lines.join('\n')
}

/**
 * Build a context-aware hint for the agent when teachings match.
 * Returns a string to prepend to the user message context, or empty string.
 */
export function getTeachingHints(message: string, context?: string): string {
  const matches = findMatchingTeachings(message, context)
  // Exclude rules/prefs (already in system prompt via getTeachingPromptRules)
  const actionable = matches.filter(t => t.type !== 'rule' && t.type !== 'preference')

  if (actionable.length === 0) return ''

  const lines: string[] = ['[Matched teachings — follow these instructions]']
  for (const t of actionable) {
    switch (t.type) {
      case 'pattern':
        lines.push(`Pattern match: "${t.trigger}" → ${t.action}`)
        break
      case 'alias':
        lines.push(`Alias: "${t.trigger}" means "${t.action}"`)
        break
      case 'workflow':
        lines.push(`Workflow for "${t.trigger}": ${t.action}`)
        break
    }
    // Record usage
    recordTeachingUsed(t.id)
  }

  return lines.join('\n') + '\n'
}

// ═══ Interactive Teach Mode ══════════════════════════════════════

const TYPE_LABELS: Record<TeachingType, string> = {
  pattern: 'Pattern',
  rule: 'Rule',
  preference: 'Preference',
  alias: 'Alias',
  workflow: 'Workflow',
}

const TYPE_DESCRIPTIONS: Record<TeachingType, string> = {
  pattern: '"When I say X, do Y" — triggers on keywords or regex',
  rule: '"Always/Never do X" — permanent behavioral rule',
  preference: '"I prefer X over Y" — style and output preferences',
  alias: '"X means Y" — short aliases for complex commands',
  workflow: '"To do X, first A, then B, then C" — multi-step procedures',
}

const TYPE_COLORS: Record<TeachingType, (text: string) => string> = {
  pattern: chalk.hex('#60A5FA'),
  rule: chalk.hex('#F87171'),
  preference: chalk.hex('#A78BFA'),
  alias: chalk.hex('#4ADE80'),
  workflow: chalk.hex('#FBBF24'),
}

/**
 * Interactive teach mode — guided flow for creating a teaching.
 */
export async function startTeachMode(): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stderr })
  const ask = (q: string): Promise<string> => new Promise(r => rl.question(q, (a) => r(a.trim())))

  console.error('')
  console.error(chalk.hex('#A78BFA').bold('  Teach kbot'))
  console.error(chalk.dim('  Teach kbot something new — a pattern, rule, preference, alias, or workflow.'))
  console.error('')

  try {
    // Step 1: Get the teaching input
    console.error(chalk.dim('  Describe what you want to teach kbot:'))
    console.error(chalk.dim('  Examples:'))
    console.error(chalk.dim('    "when I say deploy, run the ship pipeline"'))
    console.error(chalk.dim('    "always use TypeScript strict mode"'))
    console.error(chalk.dim('    "I prefer tabs over spaces"'))
    console.error(chalk.dim('    "d = deploy to production"'))
    console.error(chalk.dim('    "to release: first run tests, then build, then deploy"'))
    console.error('')

    const input = await ask(chalk.hex('#A78BFA')('  > '))
    if (!input) {
      console.error(chalk.dim('  Nothing to teach. Exiting.'))
      rl.close()
      return
    }

    // Step 2: Detect type
    let type = detectType(input)

    if (!type) {
      console.error('')
      console.error(chalk.dim('  What type of teaching is this?'))
      const types: TeachingType[] = ['pattern', 'rule', 'preference', 'alias', 'workflow']
      for (let i = 0; i < types.length; i++) {
        const t = types[i]
        console.error(`  ${chalk.bold(`${i + 1}`)} ${TYPE_COLORS[t](TYPE_LABELS[t])} — ${chalk.dim(TYPE_DESCRIPTIONS[t])}`)
      }
      console.error('')
      const choice = await ask(chalk.hex('#A78BFA')('  Pick 1-5: '))
      const idx = parseInt(choice, 10) - 1
      if (idx >= 0 && idx < types.length) {
        type = types[idx]
      } else {
        type = 'pattern' // default
      }
    }

    // Step 3: Extract trigger and action
    let { trigger, action } = parseTriggerAction(input, type)

    // Step 4: Confirm understanding
    console.error('')
    console.error(chalk.hex('#A78BFA').bold('  I understood:'))
    console.error(`  Type:    ${TYPE_COLORS[type](TYPE_LABELS[type])}`)
    console.error(`  Trigger: ${chalk.bold(trigger || '(global)')}`)
    console.error(`  Action:  ${chalk.bold(action)}`)
    console.error('')

    const confirm = await ask(chalk.dim('  Correct? [Y/n/edit] '))
    if (confirm.toLowerCase() === 'n') {
      console.error(chalk.dim('  Cancelled.'))
      rl.close()
      return
    }

    if (confirm.toLowerCase() === 'edit' || confirm.toLowerCase() === 'e') {
      const newTrigger = await ask(`  Trigger ${chalk.dim(`[${trigger}]`)}: `)
      if (newTrigger) trigger = newTrigger
      const newAction = await ask(`  Action ${chalk.dim(`[${action}]`)}: `)
      if (newAction) action = newAction
    }

    // Step 5: Optional context
    const ctxInput = await ask(chalk.dim('  Context (project/language, or enter to skip): '))
    const context = ctxInput || undefined

    // Step 6: Optional examples
    console.error(chalk.dim('  Example phrases that should trigger this (one per line, empty line to finish):'))
    const examples: string[] = []
    let ex = await ask(chalk.dim('  ex: '))
    while (ex) {
      examples.push(ex)
      ex = await ask(chalk.dim('  ex: '))
    }

    // Step 7: Create the teaching
    const teaching = createTeaching({
      type,
      trigger,
      action,
      context,
      examples: examples.length > 0 ? examples : undefined,
    })

    console.error('')
    console.error(chalk.hex('#4ADE80').bold('  Taught!'))
    printTeachingCompact(teaching)

    // Step 8: Test it
    console.error('')
    const testInput = await ask(chalk.dim('  Test it? Enter a message (or skip): '))
    if (testInput) {
      const matches = findMatchingTeachings(testInput, context)
      if (matches.some(m => m.id === teaching.id)) {
        console.error(chalk.hex('#4ADE80')('  Match! This teaching would apply.'))
      } else {
        console.error(chalk.hex('#FBBF24')('  No match. Try adjusting the trigger or adding examples.'))
      }
    }

    console.error('')
  } finally {
    rl.close()
  }
}

// ═══ CLI Display ═════════════════════════════════════════════════

/** Truncate string to max length with ellipsis */
function truncate(str: string, max: number): string {
  if (str.length <= max) return str
  return str.slice(0, max - 1) + '\u2026'
}

/** Right-pad string to width */
function pad(str: string, width: number): string {
  // Account for ANSI escape codes — measure visible length
  const visible = str.replace(/\x1b\[[0-9;]*m/g, '')
  if (visible.length >= width) return str
  return str + ' '.repeat(width - visible.length)
}

/**
 * Print a single teaching in compact format.
 */
function printTeachingCompact(t: Teaching): void {
  const typeLabel = TYPE_COLORS[t.type](`[${TYPE_LABELS[t.type]}]`)
  const id = chalk.dim(`#${t.id}`)
  console.error(`  ${id} ${typeLabel} ${chalk.bold(truncate(t.trigger, 30))} ${chalk.dim('\u2192')} ${truncate(t.action, 50)}`)
}

/**
 * Print formatted table of teachings for CLI display.
 */
export function printTeachingsTable(filter?: { type?: string; context?: string }): void {
  const items = listTeachings(filter)

  if (items.length === 0) {
    console.error(chalk.dim('  No teachings found.'))
    console.error(chalk.dim('  Run `kbot teach` to teach kbot something new.'))
    return
  }

  // Header
  console.error('')
  console.error(chalk.hex('#A78BFA').bold(`  Teachings (${items.length})`))
  console.error(chalk.dim('  ' + '\u2500'.repeat(72)))

  // Column header
  console.error(
    `  ${pad(chalk.dim('ID'), 12)}` +
    `${pad(chalk.dim('Type'), 16)}` +
    `${pad(chalk.dim('Trigger'), 24)}` +
    `${pad(chalk.dim('Action'), 30)}` +
    `${chalk.dim('Used')}`
  )
  console.error(chalk.dim('  ' + '\u2500'.repeat(72)))

  for (const t of items) {
    const id = chalk.dim(`#${t.id}`)
    const typeLabel = TYPE_COLORS[t.type](TYPE_LABELS[t.type])
    const trigger = truncate(t.trigger, 20)
    const action = chalk.dim(truncate(t.action, 26))
    const used = t.usedCount > 0 ? chalk.hex('#4ADE80')(`${t.usedCount}x`) : chalk.dim('0')

    console.error(
      `  ${pad(id, 12)}` +
      `${pad(typeLabel, 16)}` +
      `${pad(trigger, 24)}` +
      `${pad(action, 30)}` +
      `${used}`
    )
  }

  console.error(chalk.dim('  ' + '\u2500'.repeat(72)))
  console.error('')
}

/**
 * Print detailed view of a single teaching.
 */
export function printTeachingDetail(id: string): void {
  const t = getTeaching(id)
  if (!t) {
    console.error(chalk.hex('#F87171')(`  Teaching #${id} not found.`))
    return
  }

  console.error('')
  console.error(chalk.hex('#A78BFA').bold(`  Teaching #${t.id}`))
  console.error(chalk.dim('  ' + '\u2500'.repeat(40)))
  console.error(`  Type:      ${TYPE_COLORS[t.type](TYPE_LABELS[t.type])}`)
  console.error(`  Trigger:   ${chalk.bold(t.trigger)}`)
  console.error(`  Action:    ${t.action}`)
  if (t.context) console.error(`  Context:   ${t.context}`)
  console.error(`  Priority:  ${t.priority}`)
  console.error(`  Used:      ${t.usedCount} time${t.usedCount === 1 ? '' : 's'}`)
  if (t.lastUsedAt) console.error(`  Last used: ${t.lastUsedAt.split('T')[0]}`)
  console.error(`  Created:   ${t.createdAt.split('T')[0]}`)
  if (t.examples && t.examples.length > 0) {
    console.error(`  Examples:`)
    for (const ex of t.examples) {
      console.error(`    - "${ex}"`)
    }
  }
  console.error('')
}

/**
 * Print teaching statistics.
 */
export function printTeachingStats(): void {
  const stats = getTeachingStats()

  console.error('')
  console.error(chalk.hex('#A78BFA').bold('  Teaching Statistics'))
  console.error(chalk.dim('  ' + '\u2500'.repeat(40)))
  console.error(`  Total teachings: ${chalk.bold(String(stats.total))}`)
  console.error('')

  // By type
  if (Object.keys(stats.byType).length > 0) {
    console.error(chalk.dim('  By type:'))
    for (const [type, count] of Object.entries(stats.byType)) {
      const label = TYPE_COLORS[type as TeachingType]?.(TYPE_LABELS[type as TeachingType]) ?? type
      console.error(`    ${label}: ${count}`)
    }
    console.error('')
  }

  // Most used
  if (stats.mostUsed.length > 0) {
    console.error(chalk.dim('  Most used:'))
    for (const t of stats.mostUsed.slice(0, 5)) {
      const typeLabel = TYPE_COLORS[t.type](`[${TYPE_LABELS[t.type]}]`)
      console.error(`    ${chalk.hex('#4ADE80')(`${t.usedCount}x`)} ${typeLabel} ${truncate(t.trigger, 30)} ${chalk.dim('\u2192')} ${truncate(t.action, 30)}`)
    }
    console.error('')
  }

  // Never used
  if (stats.neverUsed.length > 0) {
    console.error(chalk.dim(`  Never used: ${stats.neverUsed.length} teaching${stats.neverUsed.length === 1 ? '' : 's'}`))
    for (const t of stats.neverUsed.slice(0, 3)) {
      console.error(`    ${chalk.dim(`#${t.id}`)} ${truncate(t.trigger, 30)}`)
    }
    if (stats.neverUsed.length > 3) {
      console.error(chalk.dim(`    ... and ${stats.neverUsed.length - 3} more`))
    }
    console.error('')
  }

  // Recently added
  if (stats.recentlyAdded.length > 0) {
    console.error(chalk.dim('  Recently added:'))
    for (const t of stats.recentlyAdded) {
      const date = t.createdAt.split('T')[0]
      console.error(`    ${chalk.dim(date)} ${truncate(t.trigger, 30)} ${chalk.dim('\u2192')} ${truncate(t.action, 30)}`)
    }
    console.error('')
  }
}

// ═══ Export / Import ═════════════════════════════════════════════

/**
 * Export all teachings as JSON string (for backup or sharing).
 */
export function exportTeachings(): string {
  return JSON.stringify(teachings, null, 2)
}

/**
 * Import teachings from JSON string. Merges with existing (skips duplicates by trigger+action).
 * Returns count of new teachings imported.
 */
export function importTeachings(json: string): number {
  let incoming: Teaching[]
  try {
    incoming = JSON.parse(json)
  } catch {
    throw new Error('Invalid JSON — expected an array of teachings')
  }

  if (!Array.isArray(incoming)) {
    throw new Error('Invalid format — expected an array of teachings')
  }

  let imported = 0
  for (const t of incoming) {
    // Validate required fields
    if (!t.type || !t.trigger || !t.action) continue

    // Check for duplicates (same trigger + action = duplicate)
    const exists = teachings.some(
      existing => existing.trigger === t.trigger && existing.action === t.action
    )
    if (exists) continue

    teachings.push({
      id: newId(),
      type: t.type,
      trigger: t.trigger,
      action: t.action,
      context: t.context,
      priority: t.priority ?? 50,
      examples: t.examples,
      createdAt: t.createdAt ?? new Date().toISOString(),
      usedCount: 0,
      lastUsedAt: undefined,
    })
    imported++
  }

  if (imported > 0) persist()
  return imported
}

// ═══ CLI Command Handler ═════════════════════════════════════════

/**
 * Main CLI entry point for `kbot teach [subcommand] [args]`.
 * Called from cli.ts when the teach command is invoked.
 */
export async function handleTeachCommand(args: string[]): Promise<void> {
  const sub = args[0]?.toLowerCase()

  // kbot teach (no args) → interactive mode
  if (!sub) {
    await startTeachMode()
    return
  }

  // kbot teach list [--type X] [--context X]
  if (sub === 'list' || sub === 'ls') {
    const typeIdx = args.indexOf('--type')
    const ctxIdx = args.indexOf('--context')
    printTeachingsTable({
      type: typeIdx >= 0 ? args[typeIdx + 1] : undefined,
      context: ctxIdx >= 0 ? args[ctxIdx + 1] : undefined,
    })
    return
  }

  // kbot teach show <id>
  if (sub === 'show' || sub === 'info') {
    const id = args[1]
    if (!id) {
      console.error(chalk.hex('#F87171')('  Usage: kbot teach show <id>'))
      return
    }
    printTeachingDetail(id)
    return
  }

  // kbot teach remove <id>
  if (sub === 'remove' || sub === 'rm' || sub === 'delete') {
    const id = args[1]
    if (!id) {
      console.error(chalk.hex('#F87171')('  Usage: kbot teach remove <id>'))
      return
    }
    if (removeTeaching(id)) {
      console.error(chalk.hex('#4ADE80')(`  Removed teaching #${id}`))
    } else {
      console.error(chalk.hex('#F87171')(`  Teaching #${id} not found.`))
    }
    return
  }

  // kbot teach edit <id> [--trigger X] [--action X] [--priority N] [--context X]
  if (sub === 'edit') {
    const id = args[1]
    if (!id) {
      console.error(chalk.hex('#F87171')('  Usage: kbot teach edit <id> [--trigger X] [--action X] [--priority N]'))
      return
    }
    const updates: Partial<Teaching> = {}
    for (let i = 2; i < args.length; i += 2) {
      const flag = args[i]
      const val = args[i + 1]
      if (!val) break
      if (flag === '--trigger') updates.trigger = val
      else if (flag === '--action') updates.action = val
      else if (flag === '--priority') updates.priority = parseInt(val, 10)
      else if (flag === '--context') updates.context = val
    }
    const result = editTeaching(id, updates)
    if (result) {
      console.error(chalk.hex('#4ADE80')(`  Updated teaching #${id}`))
      printTeachingDetail(id)
    } else {
      console.error(chalk.hex('#F87171')(`  Teaching #${id} not found.`))
    }
    return
  }

  // kbot teach stats
  if (sub === 'stats') {
    printTeachingStats()
    return
  }

  // kbot teach export
  if (sub === 'export') {
    console.log(exportTeachings())
    return
  }

  // kbot teach import <file>
  if (sub === 'import') {
    const file = args[1]
    if (!file) {
      console.error(chalk.hex('#F87171')('  Usage: kbot teach import <file.json>'))
      return
    }
    try {
      const content = readFileSync(file, 'utf-8')
      const count = importTeachings(content)
      console.error(chalk.hex('#4ADE80')(`  Imported ${count} new teaching${count === 1 ? '' : 's'}`))
    } catch (err) {
      console.error(chalk.hex('#F87171')(`  Error: ${err instanceof Error ? err.message : String(err)}`))
    }
    return
  }

  // kbot teach test <message>
  if (sub === 'test') {
    const message = args.slice(1).join(' ')
    if (!message) {
      console.error(chalk.hex('#F87171')('  Usage: kbot teach test <message>'))
      return
    }
    const matches = findMatchingTeachings(message)
    if (matches.length === 0) {
      console.error(chalk.dim('  No teachings matched.'))
    } else {
      console.error(chalk.hex('#A78BFA').bold(`  ${matches.length} teaching${matches.length === 1 ? '' : 's'} matched:`))
      console.error('')
      for (const t of matches) {
        printTeachingCompact(t)
      }
    }
    console.error('')
    return
  }

  // kbot teach clear
  if (sub === 'clear') {
    const count = teachings.length
    teachings.length = 0
    persist()
    console.error(chalk.hex('#FBBF24')(`  Cleared ${count} teaching${count === 1 ? '' : 's'}.`))
    return
  }

  // Anything else → treat as quick teach
  const input = args.join(' ')
  try {
    const teaching = await quickTeach(input)
    console.error('')
    console.error(chalk.hex('#4ADE80').bold('  Taught!'))
    printTeachingCompact(teaching)
    console.error('')
  } catch (err) {
    console.error(chalk.hex('#F87171')(`  Error: ${err instanceof Error ? err.message : String(err)}`))
  }
}
