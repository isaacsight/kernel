// kbot Automations — Event-driven automation system
//
// Always-on agents triggered by file changes, schedules, git hooks, or webhooks.
// Inspired by Cursor's "Automations" — but running in the terminal.
//
// Usage:
//   kbot automate list                           # List all automations
//   kbot automate add --trigger "file:..." ...   # Create automation
//   kbot automate remove <id>                    # Remove by ID
//   kbot automate run <id>                       # Manual trigger
//   kbot automate start                          # Start daemon

import { existsSync, readFileSync, writeFileSync, mkdirSync, watch, type FSWatcher } from 'node:fs'
import { join, resolve } from 'node:path'
import { homedir } from 'node:os'
import { execSync, spawn } from 'node:child_process'
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'

// ── Types ──

export interface FileTrigger {
  type: 'file'
  patterns: string[]
  events: ('change' | 'create' | 'delete')[]
}

export interface ScheduleTrigger {
  type: 'schedule'
  cron: string // "every 5m", "every 1h", "daily 09:00"
}

export interface GitTrigger {
  type: 'git'
  events: ('pre-commit' | 'post-commit' | 'pre-push')[]
}

export interface WebhookTrigger {
  type: 'webhook'
  path: string
  secret?: string
}

export type AutomationTrigger = FileTrigger | ScheduleTrigger | GitTrigger | WebhookTrigger

export interface AutomationAction {
  agent: string
  prompt: string
  tools?: string[]
}

export interface Automation {
  id: string
  name: string
  trigger: AutomationTrigger
  action: AutomationAction
  enabled: boolean
  lastRun?: string
  runCount: number
}

export interface AutomationRunResult {
  automationId: string
  startedAt: string
  finishedAt: string
  success: boolean
  output?: string
  error?: string
}

// ── Paths ──

const KBOT_DIR = join(homedir(), '.kbot')
const AUTOMATIONS_FILE = join(KBOT_DIR, 'automations.json')
const AUTOMATIONS_LOG = join(KBOT_DIR, 'automations.log')

// ── Persistence ──

function ensureDir(): void {
  if (!existsSync(KBOT_DIR)) {
    mkdirSync(KBOT_DIR, { recursive: true })
  }
}

function loadAutomations(): Automation[] {
  ensureDir()
  if (!existsSync(AUTOMATIONS_FILE)) return []
  try {
    const raw = readFileSync(AUTOMATIONS_FILE, 'utf-8')
    return JSON.parse(raw) as Automation[]
  } catch {
    return []
  }
}

function saveAutomations(automations: Automation[]): void {
  ensureDir()
  writeFileSync(AUTOMATIONS_FILE, JSON.stringify(automations, null, 2), 'utf-8')
}

function appendLog(entry: AutomationRunResult): void {
  ensureDir()
  const line = JSON.stringify(entry) + '\n'
  try {
    const { appendFileSync } = require('node:fs') as typeof import('node:fs')
    appendFileSync(AUTOMATIONS_LOG, line, 'utf-8')
  } catch {
    // Non-critical — logging failure shouldn't block execution
  }
}

// ── CRUD ──

export function createAutomation(config: {
  name: string
  trigger: AutomationTrigger
  action: AutomationAction
  enabled?: boolean
}): Automation {
  const automations = loadAutomations()

  const automation: Automation = {
    id: randomUUID().slice(0, 8),
    name: config.name,
    trigger: config.trigger,
    action: config.action,
    enabled: config.enabled ?? true,
    runCount: 0,
  }

  automations.push(automation)
  saveAutomations(automations)

  // If it's a git trigger, install hooks immediately
  if (automation.trigger.type === 'git') {
    installGitHooks(automation)
  }

  return automation
}

export function listAutomations(): Automation[] {
  return loadAutomations()
}

export function getAutomation(id: string): Automation | undefined {
  return loadAutomations().find((a) => a.id === id)
}

export function removeAutomation(id: string): boolean {
  const automations = loadAutomations()
  const idx = automations.findIndex((a) => a.id === id)
  if (idx === -1) return false

  const [removed] = automations.splice(idx, 1)
  saveAutomations(automations)

  // Clean up git hooks if needed
  if (removed.trigger.type === 'git') {
    uninstallGitHooks(removed)
  }

  return true
}

export function toggleAutomation(id: string, enabled: boolean): boolean {
  const automations = loadAutomations()
  const automation = automations.find((a) => a.id === id)
  if (!automation) return false

  automation.enabled = enabled
  saveAutomations(automations)
  return true
}

// ── Execution ──

export async function runAutomation(
  id: string,
  context?: { filePath?: string; gitEvent?: string; webhookBody?: unknown },
): Promise<AutomationRunResult> {
  const automations = loadAutomations()
  const automation = automations.find((a) => a.id === id)

  if (!automation) {
    return {
      automationId: id,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      success: false,
      error: `Automation "${id}" not found`,
    }
  }

  const startedAt = new Date().toISOString()

  // Build the prompt with context
  let enrichedPrompt = automation.action.prompt
  if (context?.filePath) {
    enrichedPrompt += `\n\nTriggered by file: ${context.filePath}`
  }
  if (context?.gitEvent) {
    enrichedPrompt += `\n\nTriggered by git event: ${context.gitEvent}`
  }
  if (context?.webhookBody) {
    enrichedPrompt += `\n\nWebhook payload:\n${JSON.stringify(context.webhookBody, null, 2)}`
  }

  try {
    // Dynamic import to avoid circular deps — agent.ts is heavy
    const { runAgent } = await import('./agent.js')
    const result = await runAgent(enrichedPrompt, {
      agent: automation.action.agent,
    })

    // Update run stats
    automation.lastRun = new Date().toISOString()
    automation.runCount += 1
    saveAutomations(automations)

    const runResult: AutomationRunResult = {
      automationId: id,
      startedAt,
      finishedAt: new Date().toISOString(),
      success: true,
      output: typeof result.content === 'string' ? result.content.slice(0, 2000) : undefined,
    }

    appendLog(runResult)
    return runResult
  } catch (err) {
    const runResult: AutomationRunResult = {
      automationId: id,
      startedAt,
      finishedAt: new Date().toISOString(),
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }

    appendLog(runResult)
    return runResult
  }
}

// ── Schedule Parsing ──

/**
 * Parse simple schedule strings into millisecond intervals.
 *
 * Supported formats:
 *   "every 5m"       → 300_000
 *   "every 1h"       → 3_600_000
 *   "every 30s"      → 30_000
 *   "daily 09:00"    → fires once a day at 09:00 local time
 */
export function parseSchedule(cron: string): { intervalMs?: number; dailyAt?: { hour: number; minute: number } } {
  const trimmed = cron.trim().toLowerCase()

  // "every Xs", "every Xm", "every Xh"
  const everyMatch = trimmed.match(/^every\s+(\d+)\s*(s|sec|seconds?|m|min|minutes?|h|hr|hours?)$/)
  if (everyMatch) {
    const value = parseInt(everyMatch[1], 10)
    const unit = everyMatch[2]

    if (unit.startsWith('s')) return { intervalMs: value * 1_000 }
    if (unit.startsWith('m')) return { intervalMs: value * 60_000 }
    if (unit.startsWith('h')) return { intervalMs: value * 3_600_000 }
  }

  // "daily HH:MM"
  const dailyMatch = trimmed.match(/^daily\s+(\d{1,2}):(\d{2})$/)
  if (dailyMatch) {
    const hour = parseInt(dailyMatch[1], 10)
    const minute = parseInt(dailyMatch[2], 10)
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return { dailyAt: { hour, minute } }
    }
  }

  throw new Error(`Invalid schedule: "${cron}". Use: "every 5m", "every 1h", "every 30s", or "daily 09:00"`)
}

// ── Trigger Parsing (CLI shorthand) ──

/**
 * Parse CLI trigger shorthand into a typed trigger:
 *   "file:src/**\/*.ts:change"         → FileTrigger
 *   "file:src/**\/*.ts:change,create"  → FileTrigger
 *   "schedule:every 5m"               → ScheduleTrigger
 *   "git:pre-commit"                  → GitTrigger
 *   "git:pre-commit,post-commit"      → GitTrigger
 *   "webhook:/my-hook"                → WebhookTrigger
 *   "webhook:/my-hook:mysecret"       → WebhookTrigger
 */
export function parseTriggerString(input: string): AutomationTrigger {
  const colonIdx = input.indexOf(':')
  if (colonIdx === -1) {
    throw new Error(`Invalid trigger: "${input}". Format: type:config (e.g., "file:src/**/*.ts:change")`)
  }

  const triggerType = input.slice(0, colonIdx).toLowerCase()
  const rest = input.slice(colonIdx + 1)

  switch (triggerType) {
    case 'file': {
      // file:pattern:events  OR  file:pattern (defaults to change)
      const parts = rest.split(':')
      const pattern = parts[0]
      const events = parts[1]
        ? (parts[1].split(',').map((e) => e.trim()) as FileTrigger['events'])
        : ['change' as const]

      // Validate events
      const validEvents = new Set(['change', 'create', 'delete'])
      for (const e of events) {
        if (!validEvents.has(e)) {
          throw new Error(`Invalid file event: "${e}". Use: change, create, delete`)
        }
      }

      return { type: 'file', patterns: [pattern], events }
    }

    case 'schedule': {
      // Validate it parses
      parseSchedule(rest)
      return { type: 'schedule', cron: rest }
    }

    case 'git': {
      const events = rest.split(',').map((e) => e.trim()) as GitTrigger['events']
      const validGitEvents = new Set(['pre-commit', 'post-commit', 'pre-push'])
      for (const e of events) {
        if (!validGitEvents.has(e)) {
          throw new Error(`Invalid git event: "${e}". Use: pre-commit, post-commit, pre-push`)
        }
      }
      return { type: 'git', events }
    }

    case 'webhook': {
      const parts = rest.split(':')
      const path = parts[0].startsWith('/') ? parts[0] : '/' + parts[0]
      const secret = parts[1] || undefined
      return { type: 'webhook', path, secret }
    }

    default:
      throw new Error(`Unknown trigger type: "${triggerType}". Use: file, schedule, git, webhook`)
  }
}

// ── File Watching ──

const activeWatchers: Map<string, FSWatcher[]> = new Map()

function matchGlob(pattern: string, filepath: string): boolean {
  // Simple glob matching: supports * and **
  const regexStr = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '{{DOUBLESTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\{\{DOUBLESTAR\}\}/g, '.*')
  const regex = new RegExp('^' + regexStr + '$')
  return regex.test(filepath)
}

function startFileWatcher(automation: Automation, log: (msg: string) => void): FSWatcher[] {
  const trigger = automation.trigger as FileTrigger
  const watchers: FSWatcher[] = []

  // Debounce: avoid triggering multiple times for the same save
  let lastTrigger = 0
  const DEBOUNCE_MS = 2_000

  for (const pattern of trigger.patterns) {
    // Determine the watch root — walk up from the pattern to find a concrete dir
    const watchRoot = getWatchRoot(pattern)

    if (!existsSync(watchRoot)) {
      log(`[automations] Warning: watch root "${watchRoot}" does not exist for pattern "${pattern}"`)
      continue
    }

    try {
      const watcher = watch(watchRoot, { recursive: true }, (eventType, filename) => {
        if (!filename || !automation.enabled) return

        const fullPath = join(watchRoot, filename)
        const now = Date.now()

        // Check debounce
        if (now - lastTrigger < DEBOUNCE_MS) return

        // Check if the file matches the glob pattern
        if (!matchGlob(pattern, fullPath) && !matchGlob(pattern, filename)) return

        // Map fs.watch eventType to our event types
        const eventMap: Record<string, string> = { rename: 'create', change: 'change' }
        const mappedEvent = eventMap[eventType] || 'change'

        if (!trigger.events.includes(mappedEvent as 'change' | 'create' | 'delete')) return

        lastTrigger = now
        log(`[automations] File trigger fired: ${automation.name} (${filename})`)

        // Fire and forget — don't block the watcher
        runAutomation(automation.id, { filePath: fullPath }).catch((err) => {
          log(`[automations] Error running "${automation.name}": ${err}`)
        })
      })

      watchers.push(watcher)
      log(`[automations] Watching: ${pattern} (root: ${watchRoot})`)
    } catch (err) {
      log(`[automations] Failed to watch "${pattern}": ${err}`)
    }
  }

  return watchers
}

function getWatchRoot(pattern: string): string {
  // Find the first directory component without a glob character
  const parts = pattern.split('/')
  const concreteParts: string[] = []

  for (const part of parts) {
    if (part.includes('*') || part.includes('?') || part.includes('{')) break
    concreteParts.push(part)
  }

  return concreteParts.length > 0 ? resolve(concreteParts.join('/')) : resolve('.')
}

// ── Schedule Timers ──

const activeTimers: Map<string, ReturnType<typeof setInterval> | ReturnType<typeof setTimeout>> = new Map()

function startScheduleTimer(automation: Automation, log: (msg: string) => void): void {
  const trigger = automation.trigger as ScheduleTrigger
  const parsed = parseSchedule(trigger.cron)

  if (parsed.intervalMs) {
    log(`[automations] Schedule: "${automation.name}" every ${parsed.intervalMs / 1000}s`)
    const timer = setInterval(() => {
      if (!automation.enabled) return
      log(`[automations] Schedule trigger fired: ${automation.name}`)
      runAutomation(automation.id).catch((err) => {
        log(`[automations] Error running "${automation.name}": ${err}`)
      })
    }, parsed.intervalMs)

    activeTimers.set(automation.id, timer)
  } else if (parsed.dailyAt) {
    const { hour, minute } = parsed.dailyAt
    log(`[automations] Schedule: "${automation.name}" daily at ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`)

    // Calculate ms until next occurrence, then setInterval for 24h
    const scheduleNext = (): void => {
      const now = new Date()
      const target = new Date(now)
      target.setHours(hour, minute, 0, 0)

      // If target time already passed today, schedule for tomorrow
      if (target.getTime() <= now.getTime()) {
        target.setDate(target.getDate() + 1)
      }

      const msUntil = target.getTime() - now.getTime()
      const timer = setTimeout(() => {
        if (automation.enabled) {
          log(`[automations] Daily trigger fired: ${automation.name}`)
          runAutomation(automation.id).catch((err) => {
            log(`[automations] Error running "${automation.name}": ${err}`)
          })
        }
        // Schedule next day
        scheduleNext()
      }, msUntil)

      activeTimers.set(automation.id, timer)
    }

    scheduleNext()
  }
}

// ── Git Hooks ──

function findGitDir(): string | null {
  try {
    const gitDir = execSync('git rev-parse --git-dir', { encoding: 'utf-8' }).trim()
    return resolve(gitDir)
  } catch {
    return null
  }
}

function installGitHooks(automation: Automation): void {
  const trigger = automation.trigger as GitTrigger
  const gitDir = findGitDir()
  if (!gitDir) return

  const hooksDir = join(gitDir, 'hooks')
  if (!existsSync(hooksDir)) {
    mkdirSync(hooksDir, { recursive: true })
  }

  for (const event of trigger.events) {
    const hookPath = join(hooksDir, event)
    const marker = `# kbot-automation:${automation.id}`

    // Read existing hook content (preserve other hooks)
    let existing = ''
    if (existsSync(hookPath)) {
      existing = readFileSync(hookPath, 'utf-8')

      // Don't double-install
      if (existing.includes(marker)) continue
    }

    // Build the hook script snippet
    const hookSnippet = [
      '',
      marker,
      `# Automation: ${automation.name}`,
      `if command -v kbot >/dev/null 2>&1; then`,
      `  kbot automate run ${automation.id} &`,
      `fi`,
      `# end kbot-automation:${automation.id}`,
      '',
    ].join('\n')

    if (!existing) {
      // New hook file
      writeFileSync(hookPath, `#!/bin/sh\n${hookSnippet}`, { mode: 0o755 })
    } else {
      // Append to existing
      writeFileSync(hookPath, existing + hookSnippet, { mode: 0o755 })
    }
  }
}

function uninstallGitHooks(automation: Automation): void {
  const trigger = automation.trigger as GitTrigger
  const gitDir = findGitDir()
  if (!gitDir) return

  const hooksDir = join(gitDir, 'hooks')

  for (const event of trigger.events) {
    const hookPath = join(hooksDir, event)
    if (!existsSync(hookPath)) continue

    const content = readFileSync(hookPath, 'utf-8')
    const startMarker = `# kbot-automation:${automation.id}`
    const endMarker = `# end kbot-automation:${automation.id}`

    const startIdx = content.indexOf(startMarker)
    const endIdx = content.indexOf(endMarker)

    if (startIdx === -1 || endIdx === -1) continue

    const cleaned = content.slice(0, startIdx) + content.slice(endIdx + endMarker.length)

    // If only the shebang remains, remove the file
    if (cleaned.trim() === '#!/bin/sh') {
      const { unlinkSync } = require('node:fs') as typeof import('node:fs')
      unlinkSync(hookPath)
    } else {
      writeFileSync(hookPath, cleaned, { mode: 0o755 })
    }
  }
}

// ── Webhook Handler (called by kbot serve) ──

export async function handleWebhookTrigger(
  path: string,
  body: unknown,
  providedSecret?: string,
): Promise<{ triggered: boolean; automationId?: string; error?: string }> {
  const automations = loadAutomations()
  const matching = automations.filter(
    (a) => a.enabled && a.trigger.type === 'webhook' && (a.trigger as WebhookTrigger).path === path,
  )

  if (matching.length === 0) {
    return { triggered: false, error: `No automation found for webhook path: ${path}` }
  }

  const results: { triggered: boolean; automationId?: string; error?: string }[] = []

  for (const automation of matching) {
    const trigger = automation.trigger as WebhookTrigger

    // Validate secret if configured
    if (trigger.secret) {
      if (!providedSecret) {
        results.push({ triggered: false, automationId: automation.id, error: 'Missing webhook secret' })
        continue
      }

      // Constant-time comparison
      const expected = Buffer.from(trigger.secret, 'utf-8')
      const provided = Buffer.from(providedSecret, 'utf-8')
      if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
        results.push({ triggered: false, automationId: automation.id, error: 'Invalid webhook secret' })
        continue
      }
    }

    // Fire the automation
    runAutomation(automation.id, { webhookBody: body }).catch(() => {
      // Logged inside runAutomation
    })

    results.push({ triggered: true, automationId: automation.id })
  }

  // Return the first match result
  return results[0] || { triggered: false, error: 'No matching automation' }
}

// ── Daemon ──

let daemonRunning = false

export function startAutomationDaemon(options?: { log?: (msg: string) => void }): {
  stop: () => void
  running: boolean
} {
  if (daemonRunning) {
    return { stop: () => {}, running: true }
  }

  const log = options?.log ?? ((msg: string) => process.stderr.write(msg + '\n'))
  const automations = loadAutomations().filter((a) => a.enabled)

  if (automations.length === 0) {
    log('[automations] No enabled automations found.')
    return { stop: () => {}, running: false }
  }

  daemonRunning = true
  log(`[automations] Starting daemon with ${automations.length} automation(s)...`)

  // Start file watchers
  for (const a of automations) {
    if (a.trigger.type === 'file') {
      const watchers = startFileWatcher(a, log)
      if (watchers.length > 0) {
        activeWatchers.set(a.id, watchers)
      }
    }
  }

  // Start schedule timers
  for (const a of automations) {
    if (a.trigger.type === 'schedule') {
      startScheduleTimer(a, log)
    }
  }

  // Git hooks are installed at creation time, not by the daemon
  const gitAutomations = automations.filter((a) => a.trigger.type === 'git')
  if (gitAutomations.length > 0) {
    log(`[automations] ${gitAutomations.length} git hook automation(s) active (hooks installed in .git/hooks/)`)
  }

  // Webhook automations are handled by kbot serve
  const webhookAutomations = automations.filter((a) => a.trigger.type === 'webhook')
  if (webhookAutomations.length > 0) {
    log(`[automations] ${webhookAutomations.length} webhook automation(s) active (use "kbot serve" to accept requests)`)
  }

  const stop = (): void => {
    daemonRunning = false

    // Stop file watchers
    for (const [id, watchers] of activeWatchers) {
      for (const w of watchers) {
        try { w.close() } catch { /* already closed */ }
      }
    }
    activeWatchers.clear()

    // Stop timers
    for (const [id, timer] of activeTimers) {
      clearTimeout(timer as ReturnType<typeof setTimeout>)
      clearInterval(timer as ReturnType<typeof setInterval>)
    }
    activeTimers.clear()

    log('[automations] Daemon stopped.')
  }

  // Graceful shutdown
  const onSignal = (): void => {
    stop()
    process.exit(0)
  }
  process.on('SIGINT', onSignal)
  process.on('SIGTERM', onSignal)

  return { stop, running: true }
}

// ── Formatting (for CLI output) ──

export function formatAutomationList(automations: Automation[]): string {
  if (automations.length === 0) {
    return 'No automations configured. Use `kbot automate add` to create one.'
  }

  const lines: string[] = []
  lines.push('')

  for (const a of automations) {
    const status = a.enabled ? '\x1b[32m ON\x1b[0m' : '\x1b[31mOFF\x1b[0m'
    const triggerDesc = formatTriggerShort(a.trigger)
    lines.push(`  [${status}] \x1b[1m${a.name}\x1b[0m  (${a.id})`)
    lines.push(`       Trigger: ${triggerDesc}`)
    lines.push(`       Agent: ${a.action.agent} | Runs: ${a.runCount}${a.lastRun ? ` | Last: ${a.lastRun}` : ''}`)
    lines.push('')
  }

  return lines.join('\n')
}

function formatTriggerShort(trigger: AutomationTrigger): string {
  switch (trigger.type) {
    case 'file':
      return `file:${trigger.patterns.join(',')} [${trigger.events.join(',')}]`
    case 'schedule':
      return `schedule:${trigger.cron}`
    case 'git':
      return `git:${trigger.events.join(',')}`
    case 'webhook':
      return `webhook:${trigger.path}${trigger.secret ? ' (secret)' : ''}`
  }
}
