// kbot Hooks Integration — Wire kbot into Claude Code's hook system
//
// Claude Code hooks fire at key lifecycle moments. This module generates
// the hooks configuration for settings.json and dispatches hook events
// to the right kbot subsystem:
//
//   FileChanged    → kbot pair mode analysis
//   TaskCompleted  → meta-agent observation recording
//   SessionStart   → load kbot learning context
//   SessionEnd     → run dream mode consolidation
//   StopFailure    → log to self-defense incident system
//
// Usage:
//   import { generateHooksConfig, handleHookEvent } from './hooks-integration.js'
//   const config = generateHooksConfig()       // → JSON for settings.json
//   await handleHookEvent('FileChanged', { file: 'src/app.ts' })

import { existsSync, readFileSync } from 'node:fs'
import { join, extname } from 'node:path'
import { homedir } from 'node:os'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Claude Code hook event types */
export type HookEventType =
  | 'FileChanged'
  | 'TaskCompleted'
  | 'SessionStart'
  | 'SessionEnd'
  | 'StopFailure'

/** Data payload for each hook event */
export interface FileChangedData {
  file: string
  changeType?: 'create' | 'edit' | 'delete' | 'rename'
  diff?: string
}

export interface TaskCompletedData {
  task: string
  agent: string
  success: boolean
  duration_ms: number
  tokens_in?: number
  tokens_out?: number
  cost?: number
  tools_used?: string[]
  error?: string
}

export interface SessionStartData {
  cwd: string
  agent?: string
  resumeFrom?: string
}

export interface SessionEndData {
  cwd: string
  agent?: string
  turnCount?: number
  duration_ms?: number
}

export interface StopFailureData {
  reason: string
  command?: string
  exitCode?: number
  stderr?: string
}

export type HookEventData =
  | FileChangedData
  | TaskCompletedData
  | SessionStartData
  | SessionEndData
  | StopFailureData

/** Result from handling a hook event */
export interface HookHandlerResult {
  event: HookEventType
  handled: boolean
  subsystem: string
  output?: string
  error?: string
  duration_ms: number
}

/** Claude Code settings.json hook configuration shape */
export interface ClaudeHookConfig {
  event: string
  command: string
  timeout?: number
  matcher?: string
}

export interface ClaudeHooksSection {
  hooks: ClaudeHookConfig[]
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const KBOT_DIR = join(homedir(), '.kbot')

/** File extensions that trigger pair mode analysis */
const ANALYZABLE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.rs', '.go', '.java', '.kt', '.swift',
  '.c', '.cpp', '.h', '.hpp', '.cs',
  '.rb', '.php', '.vue', '.svelte',
  '.css', '.scss', '.less',
  '.json', '.yaml', '.yml', '.toml',
  '.sql', '.graphql', '.gql',
  '.sh', '.bash', '.zsh',
  '.md', '.mdx',
])

/** Paths to ignore for file change analysis */
const IGNORE_PATTERNS = [
  'node_modules',
  'dist',
  'build',
  '.git',
  'coverage',
  '.next',
  '.nuxt',
  '__pycache__',
  '.cache',
  'target',
  'vendor',
]

// ---------------------------------------------------------------------------
// 1. generateHooksConfig
// ---------------------------------------------------------------------------

/**
 * Generate the hooks configuration JSON for Claude Code's settings.json.
 *
 * This produces the `hooks` array that should be merged into
 * `.claude/settings.json` or `~/.claude/settings.json`.
 *
 * Each hook calls `kbot hook-dispatch <event>` with context passed via
 * environment variables.
 *
 * @param options.kbotPath - Path to kbot binary (default: 'kbot')
 * @param options.timeout  - Default timeout in ms (default: 30000)
 * @returns The hooks section for settings.json
 */
export function generateHooksConfig(options?: {
  kbotPath?: string
  timeout?: number
}): ClaudeHooksSection {
  const kbot = options?.kbotPath ?? 'kbot'
  const defaultTimeout = options?.timeout ?? 30000

  const hooks: ClaudeHookConfig[] = [
    {
      event: 'FileChanged',
      command: `${kbot} hook-dispatch FileChanged`,
      timeout: defaultTimeout,
      matcher: '**/*.{ts,tsx,js,jsx,py,rs,go,java,rb,swift,c,cpp,css,json,yaml,sh}',
    },
    {
      event: 'TaskCompleted',
      command: `${kbot} hook-dispatch TaskCompleted`,
      timeout: 15000,
    },
    {
      event: 'SessionStart',
      command: `${kbot} hook-dispatch SessionStart`,
      timeout: 10000,
    },
    {
      event: 'SessionEnd',
      command: `${kbot} hook-dispatch SessionEnd`,
      timeout: 60000, // Dream mode can take a while
    },
    {
      event: 'StopFailure',
      command: `${kbot} hook-dispatch StopFailure`,
      timeout: 5000,
    },
  ]

  return { hooks }
}

// ---------------------------------------------------------------------------
// 2. handleHookEvent — dispatcher
// ---------------------------------------------------------------------------

/**
 * Dispatch a Claude Code hook event to the appropriate kbot subsystem.
 *
 * @param event - The hook event type
 * @param data  - Event-specific payload
 * @returns Result of handling the event
 */
export async function handleHookEvent(
  event: HookEventType,
  data: HookEventData,
): Promise<HookHandlerResult> {
  const start = Date.now()

  try {
    switch (event) {
      case 'FileChanged':
        return await handleFileChanged(data as FileChangedData, start)

      case 'TaskCompleted':
        return await handleTaskCompleted(data as TaskCompletedData, start)

      case 'SessionStart':
        return await handleSessionStart(data as SessionStartData, start)

      case 'SessionEnd':
        return await handleSessionEnd(data as SessionEndData, start)

      case 'StopFailure':
        return await handleStopFailure(data as StopFailureData, start)

      default: {
        // Exhaustiveness check
        const _exhaustive: never = event
        return {
          event: _exhaustive,
          handled: false,
          subsystem: 'unknown',
          error: `Unknown hook event: ${String(event)}`,
          duration_ms: Date.now() - start,
        }
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      event,
      handled: false,
      subsystem: 'error',
      error: message,
      duration_ms: Date.now() - start,
    }
  }
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

/**
 * FileChanged → Trigger kbot pair mode analysis.
 *
 * Analyzes the changed file for bugs, type errors, security issues,
 * and refactoring opportunities using the pair programming module.
 */
async function handleFileChanged(
  data: FileChangedData,
  startTime: number,
): Promise<HookHandlerResult> {
  const { file, changeType } = data

  // Skip non-analyzable files
  const ext = extname(file).toLowerCase()
  if (!ANALYZABLE_EXTENSIONS.has(ext)) {
    return {
      event: 'FileChanged',
      handled: false,
      subsystem: 'pair',
      output: `Skipped: ${ext} not in analyzable extensions`,
      duration_ms: Date.now() - startTime,
    }
  }

  // Skip ignored paths
  if (IGNORE_PATTERNS.some(p => file.includes(p))) {
    return {
      event: 'FileChanged',
      handled: false,
      subsystem: 'pair',
      output: `Skipped: file in ignored path`,
      duration_ms: Date.now() - startTime,
    }
  }

  // Skip deletions — nothing to analyze
  if (changeType === 'delete') {
    return {
      event: 'FileChanged',
      handled: false,
      subsystem: 'pair',
      output: 'Skipped: file deleted',
      duration_ms: Date.now() - startTime,
    }
  }

  // Verify file exists
  if (!existsSync(file)) {
    return {
      event: 'FileChanged',
      handled: false,
      subsystem: 'pair',
      output: `Skipped: file does not exist`,
      duration_ms: Date.now() - startTime,
    }
  }

  // Dynamic import to avoid loading the entire pair module at startup
  try {
    const { analyzeWithAgent } = await import('./pair.js')
    const analysis = await analyzeWithAgent(file, { agent: 'coder' })

    return {
      event: 'FileChanged',
      handled: true,
      subsystem: 'pair',
      output: analysis,
      duration_ms: Date.now() - startTime,
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      event: 'FileChanged',
      handled: false,
      subsystem: 'pair',
      error: `Pair analysis failed: ${message}`,
      duration_ms: Date.now() - startTime,
    }
  }
}

/**
 * TaskCompleted → Record observation for meta-agent.
 *
 * Every completed task feeds into the meta-agent's observation log,
 * enabling self-improvement through performance analysis.
 */
async function handleTaskCompleted(
  data: TaskCompletedData,
  startTime: number,
): Promise<HookHandlerResult> {
  try {
    const { recordObservation } = await import('./meta-agent.js')

    recordObservation({
      timestamp: new Date().toISOString(),
      agent: data.agent || 'unknown',
      task: data.task || 'unspecified',
      tools_used: data.tools_used ?? [],
      success: data.success,
      duration_ms: data.duration_ms,
      tokens_in: data.tokens_in ?? 0,
      tokens_out: data.tokens_out ?? 0,
      cost: data.cost ?? 0,
      user_satisfaction: data.success ? 'positive' : 'negative',
      error: data.error,
    })

    return {
      event: 'TaskCompleted',
      handled: true,
      subsystem: 'meta-agent',
      output: `Recorded observation: ${data.agent}/${data.task} (${data.success ? 'success' : 'failure'})`,
      duration_ms: Date.now() - startTime,
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      event: 'TaskCompleted',
      handled: false,
      subsystem: 'meta-agent',
      error: `Failed to record observation: ${message}`,
      duration_ms: Date.now() - startTime,
    }
  }
}

/**
 * SessionStart → Load kbot learning context.
 *
 * Hydrates the learning engine with patterns, solutions, user profile,
 * and project memory so the session starts with full context.
 */
async function handleSessionStart(
  data: SessionStartData,
  startTime: number,
): Promise<HookHandlerResult> {
  try {
    const { buildFullLearningContext } = await import('./learning.js')

    // Build learning context for the session's working directory
    const context = buildFullLearningContext(
      'session-start', // seed message for context retrieval
      data.cwd,
    )

    // Also run the kbot session-start lifecycle hook if it exists
    try {
      const { runLifecycleHook } = await import('./hooks.js')
      runLifecycleHook('session-start', data.agent ?? 'auto')
    } catch {
      // Non-critical: kbot hooks may not be set up
    }

    const contextSize = context.length
    const summary = contextSize > 0
      ? `Loaded learning context (${contextSize} chars)`
      : 'No learning context available (new project?)'

    return {
      event: 'SessionStart',
      handled: true,
      subsystem: 'learning',
      output: summary,
      duration_ms: Date.now() - startTime,
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      event: 'SessionStart',
      handled: false,
      subsystem: 'learning',
      error: `Failed to load learning context: ${message}`,
      duration_ms: Date.now() - startTime,
    }
  }
}

/**
 * SessionEnd → Run dream mode consolidation.
 *
 * Triggers kbot's dream mode which:
 *   - Consolidates short-term memory into long-term patterns
 *   - Runs meta-agent cycle (analyze performance, propose improvements)
 *   - Speculatively pre-builds tools for tomorrow's tasks
 *   - Self-benchmarks against yesterday's performance
 */
async function handleSessionEnd(
  data: SessionEndData,
  startTime: number,
): Promise<HookHandlerResult> {
  try {
    const { runDreamMode } = await import('./dream-mode.js')

    // Run dream mode with verbose=false (we're in a hook, not interactive)
    const report = await runDreamMode(false)

    // Also run the kbot session-end lifecycle hook
    try {
      const { runLifecycleHook } = await import('./hooks.js')
      runLifecycleHook('session-end', data.agent ?? 'auto')
    } catch {
      // Non-critical
    }

    // Also flush any pending learning writes
    try {
      const { flushPendingWrites } = await import('./learning.js')
      flushPendingWrites()
    } catch {
      // Non-critical
    }

    const summary = [
      `Dream mode completed in ${report.duration_ms}ms`,
      `Phases: ${report.phases_completed}`,
      `Findings: ${report.total_findings}`,
      `Actions: ${report.total_actions}`,
      `Improvements: ${report.total_improvements}`,
    ].join(', ')

    return {
      event: 'SessionEnd',
      handled: true,
      subsystem: 'dream-mode',
      output: summary,
      duration_ms: Date.now() - startTime,
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      event: 'SessionEnd',
      handled: false,
      subsystem: 'dream-mode',
      error: `Dream mode failed: ${message}`,
      duration_ms: Date.now() - startTime,
    }
  }
}

/**
 * StopFailure → Log to self-defense incident system.
 *
 * When Claude Code encounters a stop failure (tool rejection, permission
 * denial, safety filter), kbot logs it as a security incident for
 * anomaly detection and pattern analysis.
 */
async function handleStopFailure(
  data: StopFailureData,
  startTime: number,
): Promise<HookHandlerResult> {
  try {
    const { logIncident } = await import('./self-defense.js')

    // Determine severity based on context
    const severity = determineSeverity(data)

    logIncident(
      'stop_failure',
      severity,
      buildIncidentDescription(data),
      'logged',
    )

    return {
      event: 'StopFailure',
      handled: true,
      subsystem: 'self-defense',
      output: `Incident logged: ${severity} — ${data.reason.slice(0, 100)}`,
      duration_ms: Date.now() - startTime,
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      event: 'StopFailure',
      handled: false,
      subsystem: 'self-defense',
      error: `Failed to log incident: ${message}`,
      duration_ms: Date.now() - startTime,
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Determine incident severity from stop failure data */
function determineSeverity(data: StopFailureData): string {
  const reason = data.reason.toLowerCase()

  // High severity: potential security issues
  if (reason.includes('injection') || reason.includes('malicious') || reason.includes('exploit')) {
    return 'high'
  }

  // Medium severity: permission or safety issues
  if (reason.includes('permission') || reason.includes('denied') || reason.includes('blocked')) {
    return 'medium'
  }

  // Medium severity: command failures that might indicate attacks
  if (data.exitCode && data.exitCode > 128) {
    return 'medium'
  }

  // Low severity: general failures
  return 'low'
}

/** Build a descriptive string for the incident log */
function buildIncidentDescription(data: StopFailureData): string {
  const parts: string[] = [
    `Stop failure: ${data.reason}`,
  ]

  if (data.command) {
    parts.push(`Command: ${data.command.slice(0, 200)}`)
  }

  if (data.exitCode !== undefined) {
    parts.push(`Exit code: ${data.exitCode}`)
  }

  if (data.stderr) {
    parts.push(`Stderr: ${data.stderr.slice(0, 300)}`)
  }

  return parts.join(' | ')
}

// ---------------------------------------------------------------------------
// Convenience: merge into existing settings.json
// ---------------------------------------------------------------------------

/**
 * Read existing Claude Code settings.json and merge kbot hooks into it.
 * Returns the merged JSON object. Does not write to disk.
 *
 * @param settingsPath - Path to settings.json (default: .claude/settings.json)
 */
export function mergeHooksIntoSettings(
  settingsPath?: string,
  kbotPath?: string,
): Record<string, unknown> {
  const defaultPath = join(process.cwd(), '.claude', 'settings.json')
  const filePath = settingsPath ?? defaultPath

  let existing: Record<string, unknown> = {}

  if (existsSync(filePath)) {
    try {
      existing = JSON.parse(readFileSync(filePath, 'utf-8')) as Record<string, unknown>
    } catch {
      // Start fresh if parse fails
    }
  }

  const hooksConfig = generateHooksConfig({ kbotPath })

  // Merge: replace any existing hooks array
  existing['hooks'] = hooksConfig.hooks

  return existing
}
