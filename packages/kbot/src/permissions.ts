// K:BOT Permission System — Confirmation before destructive operations
//
// Like Claude Code's permission modes. K:BOT asks before:
//   - git push, git reset --hard, git checkout -- files
//   - rm -rf (non-trivial deletes)
//   - Docker operations that affect running containers
//   - Network requests to unknown endpoints
//   - Any tool call that could lose data
//
// Modes:
//   'permissive'  — auto-approve everything (for scripts/CI)
//   'normal'      — confirm destructive ops (default)
//   'strict'      — confirm all file writes and tool calls

import { createInterface } from 'node:readline'
import chalk from 'chalk'

export type PermissionMode = 'permissive' | 'normal' | 'strict'

let currentMode: PermissionMode = 'normal'

/** Patterns that always require confirmation in normal mode */
const DESTRUCTIVE_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /^git\s+push/i, reason: 'Pushes code to remote — visible to others' },
  { pattern: /^git\s+reset\s+--hard/i, reason: 'Discards all uncommitted changes' },
  { pattern: /^git\s+checkout\s+--\s/i, reason: 'Discards file changes' },
  { pattern: /^git\s+branch\s+-[dD]\s/i, reason: 'Deletes a git branch' },
  { pattern: /^git\s+push\s+.*--force/i, reason: 'Force push — can overwrite remote history' },
  { pattern: /^rm\s+-rf?\s+[^.]/i, reason: 'Recursive delete' },
  { pattern: /^docker\s+rm\s+-f/i, reason: 'Force removes Docker containers' },
  { pattern: /^docker\s+system\s+prune/i, reason: 'Removes unused Docker data' },
  { pattern: /^kubectl\s+delete/i, reason: 'Deletes Kubernetes resources' },
  { pattern: /^npm\s+publish/i, reason: 'Publishes package to npm' },
  { pattern: /^npx\s+supabase\s+functions\s+deploy/i, reason: 'Deploys edge function to production' },
  { pattern: /^npx\s+supabase\s+db\s+push/i, reason: 'Pushes database migrations to production' },
  { pattern: /DROP\s+TABLE/i, reason: 'Drops a database table' },
  { pattern: /TRUNCATE/i, reason: 'Truncates a database table' },
  { pattern: /DELETE\s+FROM/i, reason: 'Deletes database rows' },
  // Catch piped/chained destructive commands (|, ;, &&)
  { pattern: /[|;&]\s*rm\s+-rf/i, reason: 'Chained recursive delete' },
  { pattern: /[|;&]\s*git\s+push/i, reason: 'Chained git push' },
  { pattern: /[|;&]\s*git\s+reset\s+--hard/i, reason: 'Chained hard reset' },
  { pattern: /[|;&]\s*docker\s+rm\s+-f/i, reason: 'Chained Docker container removal' },
]

/** Set the permission mode */
export function setPermissionMode(mode: PermissionMode): void {
  currentMode = mode
}

/** Get the current permission mode */
export function getPermissionMode(): PermissionMode {
  return currentMode
}

/**
 * Check if a tool call requires user confirmation.
 * Returns the reason if confirmation is needed, null otherwise.
 */
export function needsConfirmation(
  toolName: string,
  args: Record<string, unknown>,
): string | null {
  if (currentMode === 'permissive') return null

  // Strict mode: confirm everything except reads
  if (currentMode === 'strict') {
    const readOnlyTools = ['read_file', 'glob', 'grep', 'list_directory', 'git_status', 'git_diff', 'git_log',
      'web_search', 'task_list', 'task_get', 'build_detect', 'build_targets', 'build_check',
      'mcp_list_tools', 'mcp_list_resources', 'mcp_servers', 'agent_list', 'agent_result',
      'background_list', 'sandbox_list', 'notebook_read']
    if (!readOnlyTools.includes(toolName)) {
      return `${toolName} modifies state (strict mode)`
    }
    return null
  }

  // Normal mode: only confirm destructive operations
  if (toolName === 'bash') {
    const command = String(args.command || '')
    for (const { pattern, reason } of DESTRUCTIVE_PATTERNS) {
      if (pattern.test(command.trim())) {
        return reason
      }
    }
  }

  // git_push always needs confirmation
  if (toolName === 'git_push') {
    return 'Pushes code to remote repository'
  }

  return null
}

/**
 * Ask the user to confirm a tool call.
 * Returns true if approved, false if denied.
 */
export async function confirmToolCall(
  toolName: string,
  args: Record<string, unknown>,
  reason: string,
): Promise<boolean> {
  const AMETHYST = chalk.hex('#6B5B95')

  console.log()
  console.log(`  ${chalk.yellow('⚠')} ${chalk.bold('Confirmation required')}`)
  console.log(`  ${chalk.dim(reason)}`)
  console.log()
  console.log(`  ${AMETHYST('Tool:')} ${toolName}`)

  // Show relevant args
  for (const [key, value] of Object.entries(args)) {
    const display = typeof value === 'string' && value.length > 80
      ? value.slice(0, 80) + '...'
      : String(value)
    console.log(`  ${chalk.dim(key + ':')} ${display}`)
  }
  console.log()

  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await new Promise<string>((resolve) => {
    rl.question(`  ${chalk.bold('Approve?')} ${chalk.dim('[y/N]')} `, (a) => {
      resolve(a.trim().toLowerCase())
      rl.close()
    })
  })

  const approved = answer === 'y' || answer === 'yes'
  if (approved) {
    console.log(`  ${chalk.green('✓')} Approved`)
  } else {
    console.log(`  ${chalk.red('✗')} Denied`)
  }
  console.log()

  return approved
}

/**
 * Check and confirm a tool call. Returns true to proceed, false to skip.
 * Used as middleware in the tool execution pipeline.
 */
export async function checkPermission(
  toolName: string,
  args: Record<string, unknown>,
): Promise<boolean> {
  const reason = needsConfirmation(toolName, args)
  if (!reason) return true
  return confirmToolCall(toolName, args, reason)
}
