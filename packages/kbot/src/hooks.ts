// kbot Hooks — Pre/post tool execution hooks
//
// Users can define hooks in .kbot/hooks/ that run before or after tools.
// Like Claude Code's hooks system.
//
// Hook files:
//   .kbot/hooks/pre-tool.sh      — runs before every tool call
//   .kbot/hooks/post-tool.sh     — runs after every tool call
//   .kbot/hooks/pre-commit.sh    — runs before git_commit
//   .kbot/hooks/post-commit.sh   — runs after git_commit
//   .kbot/hooks/pre-push.sh      — runs before git_push
//   .kbot/hooks/session-start.sh — runs when REPL starts
//   .kbot/hooks/session-end.sh   — runs when REPL ends
//
// Hooks receive context via environment variables:
//   KBOT_TOOL_NAME    — tool being called
//   KBOT_TOOL_ARGS    — JSON-encoded arguments
//   KBOT_TOOL_RESULT  — result (post hooks only)
//   KBOT_CWD          — current working directory
//   KBOT_AGENT        — active agent

import { execSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const HOOKS_DIR = '.kbot/hooks'

interface HookResult {
  ran: boolean
  output?: string
  blocked?: boolean
  blockReason?: string
}

/** Check if a hook file exists */
function getHookPath(hookName: string): string | null {
  const extensions = ['.sh', '.js', '.ts', '']
  for (const ext of extensions) {
    const path = join(process.cwd(), HOOKS_DIR, hookName + ext)
    if (existsSync(path)) return path
  }
  return null
}

/** Run a hook script */
function runHook(
  hookPath: string,
  env: Record<string, string>,
): HookResult {
  try {
    const output = execSync(`sh "${hookPath}"`, {
      encoding: 'utf-8',
      timeout: 10000,
      cwd: process.cwd(),
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()

    // If the hook outputs "BLOCK: reason", it blocks the tool call
    if (output.startsWith('BLOCK:')) {
      return {
        ran: true,
        output,
        blocked: true,
        blockReason: output.slice(6).trim(),
      }
    }

    return { ran: true, output }
  } catch (err: unknown) {
    const e = err as { status?: number; stderr?: string; message?: string }
    // Non-zero exit code = hook failure (blocks the operation)
    if (e.status && e.status !== 0) {
      return {
        ran: true,
        output: e.stderr?.trim() || e.message,
        blocked: true,
        blockReason: e.stderr?.trim() || `Hook exited with code ${e.status}`,
      }
    }
    return { ran: true, output: e.message }
  }
}

/**
 * Run a pre-tool hook. Returns whether the tool should proceed.
 */
export function runPreToolHook(
  toolName: string,
  args: Record<string, unknown>,
  agent: string,
): HookResult {
  // Check for tool-specific hook first
  const specificHook = getHookPath(`pre-${toolName.replace(/_/g, '-')}`)
  const genericHook = getHookPath('pre-tool')

  const env: Record<string, string> = {
    KBOT_TOOL_NAME: toolName,
    KBOT_TOOL_ARGS: JSON.stringify(args),
    KBOT_CWD: process.cwd(),
    KBOT_AGENT: agent,
  }

  // Run specific hook first (e.g., pre-git-push.sh)
  if (specificHook) {
    const result = runHook(specificHook, env)
    if (result.blocked) return result
  }

  // Then run generic hook
  if (genericHook) {
    return runHook(genericHook, env)
  }

  return { ran: false }
}

/**
 * Run a post-tool hook.
 */
export function runPostToolHook(
  toolName: string,
  args: Record<string, unknown>,
  result: string,
  agent: string,
): HookResult {
  const specificHook = getHookPath(`post-${toolName.replace(/_/g, '-')}`)
  const genericHook = getHookPath('post-tool')

  const env: Record<string, string> = {
    KBOT_TOOL_NAME: toolName,
    KBOT_TOOL_ARGS: JSON.stringify(args),
    KBOT_TOOL_RESULT: result.slice(0, 10000), // Cap to prevent env var overflow
    KBOT_CWD: process.cwd(),
    KBOT_AGENT: agent,
  }

  if (specificHook) runHook(specificHook, env)
  if (genericHook) return runHook(genericHook, env)
  return { ran: false }
}

/**
 * Run a lifecycle hook (session-start, session-end).
 */
export function runLifecycleHook(
  hookName: 'session-start' | 'session-end',
  agent: string,
): HookResult {
  const hookPath = getHookPath(hookName)
  if (!hookPath) return { ran: false }

  return runHook(hookPath, {
    KBOT_CWD: process.cwd(),
    KBOT_AGENT: agent,
  })
}

/**
 * List all installed hooks.
 */
export function listHooks(): Array<{ name: string; path: string }> {
  const hooksDir = join(process.cwd(), HOOKS_DIR)
  if (!existsSync(hooksDir)) return []

  try {
    return readdirSync(hooksDir)
      .filter(f => !f.startsWith('.'))
      .map(f => ({
        name: f.replace(/\.(sh|js|ts)$/, ''),
        path: join(hooksDir, f),
      }))
  } catch {
    return []
  }
}
