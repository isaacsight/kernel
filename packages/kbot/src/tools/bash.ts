// K:BOT Bash Tool — Execute shell commands with safety checks
// All execution is local — zero API calls.

import { execSync } from 'node:child_process'
import { registerTool } from './index.js'

/** Dangerous command patterns that are blocked by default */
const BLOCKED_PATTERNS = [
  /^rm\s+-rf\s+\/\s*$/,        // rm -rf /
  /^rm\s+-rf\s+~\s*$/,         // rm -rf ~
  /^sudo\s+rm/,                // sudo rm
  /^mkfs/,                     // format filesystem
  /^dd\s+if=/,                 // raw disk write
  /^:(){ :\|:& };:/,           // fork bomb
  />\s*\/dev\/sd[a-z]/,        // write to raw disk
  /^shutdown/,                 // shutdown
  /^reboot/,                   // reboot
  /^halt/,                     // halt
]

function isCommandSafe(command: string): { safe: boolean; reason?: string } {
  const trimmed = command.trim()

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { safe: false, reason: `Blocked: matches dangerous pattern ${pattern}` }
    }
  }

  return { safe: true }
}

export function registerBashTools(): void {
  registerTool({
    name: 'bash',
    description: 'Execute a shell command and return stdout/stderr. Use for system commands, builds, installs, and other terminal operations.',
    parameters: {
      command: { type: 'string', description: 'The shell command to execute', required: true },
      timeout: { type: 'number', description: 'Timeout in milliseconds (default: 120000, max: 600000)' },
    },
    tier: 'starter',
    async execute(args) {
      const command = String(args.command)
      const timeout = Math.min(
        typeof args.timeout === 'number' ? args.timeout : 120_000,
        600_000
      )

      // Safety check
      const check = isCommandSafe(command)
      if (!check.safe) {
        return `Error: Command blocked for safety. ${check.reason}`
      }

      try {
        const result = execSync(command, {
          encoding: 'utf-8',
          timeout,
          maxBuffer: 10 * 1024 * 1024, // 10MB
          stdio: ['pipe', 'pipe', 'pipe'],
        })
        return result.trim() || '(no output)'
      } catch (err: unknown) {
        const e = err as { stderr?: string; stdout?: string; status?: number; message?: string }
        const stderr = e.stderr?.trim() || ''
        const stdout = e.stdout?.trim() || ''
        const output = [stdout, stderr].filter(Boolean).join('\n')
        return `Exit code ${e.status || 1}\n${output || e.message || 'Command failed'}`
      }
    },
  })
}
