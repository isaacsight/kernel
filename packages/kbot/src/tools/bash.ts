// kbot Bash Tool — Execute shell commands with safety checks
// All execution is local — zero API calls.

import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { registerTool } from './index.js'

/** Persistent working directory across bash calls within the session */
let sessionCwd = process.cwd()

/** Dangerous command patterns that are blocked by default */
const BLOCKED_PATTERNS = [
  /rm\s+(-[a-z]*f[a-z]*\s+)?(-[a-z]*r[a-z]*\s+)?\//i,  // rm -rf / (any flag order)
  /rm\s+(-[a-z]*f[a-z]*\s+)?(-[a-z]*r[a-z]*\s+)?~/i,   // rm -rf ~ (any flag order)
  /rm\s+--recursive\s+--force/i,   // rm --recursive --force
  /rm\s+--force\s+--recursive/i,   // rm --force --recursive
  /sudo\s+rm/,                // sudo rm
  /^mkfs/,                     // format filesystem
  /dd\s+if=/,                  // raw disk write
  /:\(\)\{.*:\|:.*\};/,        // fork bomb (escaped metacharacters)
  />\s*\/dev\/sd[a-z]/,        // write to raw disk
  /^shutdown/,                 // shutdown
  /^reboot/,                   // reboot
  /^halt/,                     // halt
]

/** Check for command substitution that could hide dangerous commands */
const SUBSTITUTION_PATTERNS = [
  /\$\(.*(?:rm|mkfs|dd|shutdown|reboot|halt)\s/i,  // $(rm ...)
  /`.*(?:rm|mkfs|dd|shutdown|reboot|halt)\s/i,     // `rm ...`
]

// ─── Windows POSIX polyfill ─────────────────────────────────────────
// On Windows the system shell is cmd.exe, but models habitually emit
// POSIX commands (ls, cat, pwd, rm -rf …) that cmd.exe rejects. Simple
// commands — one command, no shell operators — are translated to
// PowerShell and executed there. Anything with pipes, redirects,
// chaining, env vars, or flags we can't map faithfully passes through
// to the system shell untouched, so native Windows commands keep
// working. Mistranslation is worse than no translation: when in doubt,
// return null.

/** Operators that make a command non-simple — translation is skipped */
const SHELL_OPERATORS = /[|&;<>`$(){}\n]|\d?>>/

/** Quote a string for PowerShell (single quotes, '' escapes ') */
function psQuote(s: string): string {
  return `'${s.replace(/'/g, "''")}'`
}

/** Split a simple command into tokens, respecting single/double quotes */
function tokenize(command: string): string[] | null {
  const tokens: string[] = []
  let current = ''
  let inToken = false
  let quote: '"' | "'" | null = null
  for (const ch of command) {
    if (quote) {
      if (ch === quote) quote = null
      else current += ch
    } else if (ch === '"' || ch === "'") {
      quote = ch
      inToken = true
    } else if (/\s/.test(ch)) {
      if (inToken) {
        tokens.push(current)
        current = ''
        inToken = false
      }
    } else {
      current += ch
      inToken = true
    }
  }
  if (quote) return null // unbalanced quote — let the real shell complain
  if (inToken) tokens.push(current)
  return tokens
}

/** Expand grouped short flags (-rf → r,f); returns null on long flags */
function shortFlagChars(flags: string[]): string[] | null {
  const chars: string[] = []
  for (const flag of flags) {
    if (flag.startsWith('--')) return null
    chars.push(...flag.slice(1))
  }
  return chars
}

/**
 * Translate a simple POSIX command to its PowerShell equivalent.
 * Returns null when no faithful translation exists (the command then
 * passes through to the system shell unchanged). Exported for tests —
 * pure function, runs on every platform.
 */
export function translatePosixForWindows(command: string): string | null {
  const trimmed = command.trim()
  if (!trimmed || SHELL_OPERATORS.test(trimmed)) return null

  const tokens = tokenize(trimmed)
  if (!tokens || tokens.length === 0) return null

  const [cmd, ...rest] = tokens
  const flags = rest.filter(t => t.startsWith('-') && t !== '-' && !/^-\d+$/.test(t))
  const args = rest.filter(t => !flags.includes(t))
  const quoted = args.map(psQuote)

  switch (cmd) {
    case 'pwd': {
      if (rest.length > 0) return null
      return '(Get-Location).Path'
    }

    case 'ls': {
      const chars = shortFlagChars(flags)
      if (chars === null) return null
      let force = false
      for (const c of chars) {
        if (c === 'a' || c === 'A') force = true
        else if (!'lh1go'.includes(c)) return null // -t/-r etc. change semantics
      }
      const parts = ['Get-ChildItem']
      if (force) parts.push('-Force')
      if (quoted.length > 0) parts.push(quoted.join(','))
      return parts.join(' ')
    }

    case 'cat': {
      if (flags.length > 0 || args.length === 0) return null
      return `Get-Content ${quoted.join(',')}`
    }

    case 'head':
    case 'tail': {
      let count = 10
      const paths: string[] = []
      for (let i = 0; i < rest.length; i++) {
        const t = rest[i]
        let m: RegExpMatchArray | null
        if (t === '-n' && i + 1 < rest.length && /^\d+$/.test(rest[i + 1])) {
          count = Number(rest[++i])
        } else if ((m = t.match(/^-n?(\d+)$/))) {
          count = Number(m[1])
        } else if (t.startsWith('-')) {
          return null // -f, -c etc.
        } else {
          paths.push(t)
        }
      }
      if (paths.length !== 1) return null
      const mode = cmd === 'head' ? '-TotalCount' : '-Tail'
      return `Get-Content ${psQuote(paths[0])} ${mode} ${count}`
    }

    case 'rm': {
      const chars = shortFlagChars(flags)
      if (chars === null || args.length === 0) return null
      let recurse = false
      let force = false
      for (const c of chars) {
        if (c === 'r' || c === 'R') recurse = true
        else if (c === 'f') force = true
        else return null
      }
      const parts = ['Remove-Item']
      if (recurse) parts.push('-Recurse')
      if (force) parts.push('-Force')
      parts.push(quoted.join(','))
      return parts.join(' ')
    }

    case 'cp': {
      const chars = shortFlagChars(flags)
      if (chars === null || args.length !== 2) return null
      let recurse = false
      for (const c of chars) {
        if (c === 'r' || c === 'R') recurse = true
        else return null
      }
      const parts = ['Copy-Item']
      if (recurse) parts.push('-Recurse')
      parts.push(quoted[0], '-Destination', quoted[1])
      return parts.join(' ')
    }

    case 'mv': {
      const chars = shortFlagChars(flags)
      if (chars === null || args.length !== 2) return null
      let force = false
      for (const c of chars) {
        if (c === 'f') force = true
        else return null
      }
      const parts = ['Move-Item', quoted[0], '-Destination', quoted[1]]
      if (force) parts.push('-Force')
      return parts.join(' ')
    }

    case 'mkdir': {
      const chars = shortFlagChars(flags)
      if (chars === null || args.length === 0) return null
      let force = false
      for (const c of chars) {
        if (c === 'p') force = true
        else return null
      }
      const parts = ['New-Item -ItemType Directory']
      if (force) parts.push('-Force')
      parts.push('-Path', quoted.join(','), '| Out-Null')
      return parts.join(' ')
    }

    case 'touch': {
      if (flags.length > 0 || args.length === 0) return null
      // POSIX touch must NOT truncate existing files (New-Item -Force would)
      return args
        .map(f => {
          const q = psQuote(f)
          return `if (Test-Path ${q}) { (Get-Item ${q}).LastWriteTime = Get-Date } else { $null = New-Item -ItemType File -Path ${q} }`
        })
        .join('; ')
    }

    case 'which': {
      if (flags.length > 0 || args.length !== 1) return null
      return `(Get-Command ${quoted[0]}).Source`
    }

    case 'grep': {
      const chars = shortFlagChars(flags)
      if (chars === null || args.length < 2) return null
      let insensitive = false
      for (const c of chars) {
        if (c === 'i') insensitive = true
        else return null // -r, -v, -n … not mapped yet
      }
      const [pattern, ...files] = args
      const parts = ['Select-String']
      if (!insensitive) parts.push('-CaseSensitive') // grep default
      parts.push('-Pattern', psQuote(pattern), '-Path', files.map(psQuote).join(','))
      parts.push('| ForEach-Object { $_.Line }')
      return parts.join(' ')
    }

    default:
      return null
  }
}

function isCommandSafe(command: string): { safe: boolean; reason?: string } {
  const trimmed = command.trim()

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { safe: false, reason: `Blocked: matches dangerous pattern` }
    }
  }

  for (const pattern of SUBSTITUTION_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { safe: false, reason: `Blocked: command substitution contains dangerous command` }
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
    tier: 'free',
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

      // Detect cd commands and update sessionCwd
      const cdMatch = command.match(/^\s*cd\s+(.+?)(?:\s*&&|$)/)
      if (cdMatch) {
        const target = cdMatch[1].replace(/^['"]|['"]$/g, '').replace(/^~/, process.env.HOME || '')
        const resolved = resolve(sessionCwd, target)
        if (existsSync(resolved)) {
          sessionCwd = resolved
        }
      }

      // On Windows, translate habitual POSIX commands to PowerShell.
      // Safety check above runs on the ORIGINAL command, before this.
      let toRun = command
      let shell: string | undefined
      if (process.platform === 'win32') {
        const translated = translatePosixForWindows(command)
        if (translated) {
          toRun = translated
          shell = 'powershell.exe'
        }
      }

      try {
        const result = execSync(toRun, {
          encoding: 'utf-8',
          timeout,
          cwd: sessionCwd,
          maxBuffer: 10 * 1024 * 1024, // 10MB
          stdio: ['pipe', 'pipe', 'pipe'],
          ...(shell ? { shell } : {}),
        })

        // Note: cwd is updated preemptively above via path.resolve() when the
        // command starts with `cd`. The previous belt-and-suspenders shell-out
        // (`cd … && pwd`) was Unix-only — pwd doesn't exist in cmd.exe — and
        // redundant with the preemptive check, so it's been removed.

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
