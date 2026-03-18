// kbot Doctor — Comprehensive diagnostic tool
// Checks the user's kbot setup: Node.js, npm, API keys, providers,
// local runtimes, git, disk usage, learning data, shell.
//
// Never displays API keys or secrets.
// All checks are non-blocking — errors are caught and reported.

import { homedir } from 'node:os'
import { join } from 'node:path'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { execSync } from 'node:child_process'
import chalk from 'chalk'
import {
  loadConfig,
  isByokEnabled,
  getByokProvider,
  isLocalProvider,
  PROVIDERS,
  isOllamaRunning,
  KBOT_DIR,
  type ByokProvider,
} from './auth.js'
import { getExtendedStats } from './learning.js'
import { createRequire } from 'node:module'

// ── Types ──

export type CheckStatus = 'pass' | 'warn' | 'fail'

export interface CheckResult {
  name: string
  status: CheckStatus
  message: string
}

export interface DoctorReport {
  checks: CheckResult[]
  timestamp: string
  /** Overall: fail if any check fails, warn if any warns, pass otherwise */
  overall: CheckStatus
}

// ── Version (read dynamically from package.json) ──

const __require = createRequire(import.meta.url)
const INSTALLED_VERSION = (__require('../package.json') as { version: string }).version

// ── Helpers ──

/** Run a shell command and return stdout, or null on failure */
function execQuiet(cmd: string, timeoutMs = 5000): string | null {
  try {
    return execSync(cmd, { encoding: 'utf-8', timeout: timeoutMs, stdio: 'pipe' }).trim()
  } catch {
    return null
  }
}

/** Calculate total size of a directory in bytes (non-recursive if too deep) */
function dirSize(dirPath: string): number {
  let total = 0
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      const full = join(dirPath, entry.name)
      try {
        if (entry.isFile()) {
          total += statSync(full).size
        } else if (entry.isDirectory()) {
          total += dirSize(full)
        }
      } catch {
        // Skip inaccessible entries
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }
  return total
}

/** Format bytes into a human-readable string */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Parse a semver-like string into comparable parts */
function parseSemver(v: string): [number, number, number] {
  const clean = v.replace(/^v/, '')
  const parts = clean.split('.').map(Number)
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0]
}

/** Compare two semver strings: -1 = a < b, 0 = equal, 1 = a > b */
function compareSemver(a: string, b: string): number {
  const [a0, a1, a2] = parseSemver(a)
  const [b0, b1, b2] = parseSemver(b)
  if (a0 !== b0) return a0 < b0 ? -1 : 1
  if (a1 !== b1) return a1 < b1 ? -1 : 1
  if (a2 !== b2) return a2 < b2 ? -1 : 1
  return 0
}

// ── Individual checks ──

function checkNodeVersion(): CheckResult {
  const version = process.version // e.g. "v20.11.0"
  const [major] = parseSemver(version)
  if (major >= 20) {
    return { name: 'Node.js', status: 'pass', message: `${version}` }
  }
  return { name: 'Node.js', status: 'fail', message: `${version} — requires >= 20. Upgrade at nodejs.org` }
}

function checkNpmVersion(): CheckResult {
  const version = execQuiet('npm --version')
  if (version) {
    return { name: 'npm', status: 'pass', message: `v${version}` }
  }
  return { name: 'npm', status: 'warn', message: 'not found' }
}

function checkKbotVersion(): CheckResult {
  const installed = INSTALLED_VERSION
  const latest = execQuiet('npm view @kernel.chat/kbot version', 8000)
  if (!latest) {
    return { name: 'kbot version', status: 'pass', message: `v${installed} (could not check latest)` }
  }
  const cmp = compareSemver(installed, latest)
  if (cmp >= 0) {
    return { name: 'kbot version', status: 'pass', message: `v${installed} (latest)` }
  }
  return {
    name: 'kbot version',
    status: 'warn',
    message: `v${installed} — update available: v${latest} (run: kbot update)`,
  }
}

function checkApiKey(): CheckResult {
  const config = loadConfig()
  if (!config) {
    return { name: 'API key', status: 'fail', message: 'no config found — run: kbot auth' }
  }

  if (!config.byok_enabled) {
    // Check if any env var provides a key
    if (isByokEnabled()) {
      const provider = getByokProvider()
      const providerName = PROVIDERS[provider]?.name || provider
      return { name: 'API key', status: 'pass', message: `configured via environment variable (${providerName})` }
    }
    return { name: 'API key', status: 'fail', message: 'not configured — run: kbot auth' }
  }

  const provider = config.byok_provider || 'anthropic'
  const providerName = PROVIDERS[provider]?.name || provider
  const hasKey = !!config.byok_key

  if (isLocalProvider(provider)) {
    return { name: 'API key', status: 'pass', message: `${providerName} (local — no key required)` }
  }

  if (hasKey) {
    return { name: 'API key', status: 'pass', message: `configured (${providerName})` }
  }

  return { name: 'API key', status: 'fail', message: `provider set to ${providerName} but no key found — run: kbot auth` }
}

async function checkProviderReachable(): Promise<CheckResult> {
  const config = loadConfig()
  const byokActive = isByokEnabled()
  if (!byokActive && !config?.byok_enabled) {
    return { name: 'Provider reachable', status: 'warn', message: 'no provider configured — skipped' }
  }

  const provider: ByokProvider = config?.byok_provider || getByokProvider()
  const providerConfig = PROVIDERS[provider]
  if (!providerConfig) {
    return { name: 'Provider reachable', status: 'fail', message: `unknown provider: ${provider}` }
  }

  // For local providers, check their health endpoints
  if (isLocalProvider(provider)) {
    try {
      const url = provider === 'kbot-local'
        ? providerConfig.apiUrl.replace('/v1/chat/completions', '/health')
        : providerConfig.apiUrl.replace('/v1/chat/completions', '/v1/models')

      // Ollama uses a different base path
      const checkUrl = provider === 'ollama'
        ? providerConfig.apiUrl.replace('/v1/chat/completions', '/api/tags')
        : url

      const res = await fetch(checkUrl, { signal: AbortSignal.timeout(3000) })
      if (res.ok) {
        return { name: 'Provider reachable', status: 'pass', message: `${providerConfig.name} is responding` }
      }
      return { name: 'Provider reachable', status: 'fail', message: `${providerConfig.name} returned ${res.status}` }
    } catch {
      return { name: 'Provider reachable', status: 'fail', message: `${providerConfig.name} not responding` }
    }
  }

  // For cloud providers, do a lightweight HEAD/GET to the API base
  try {
    // Strip the specific endpoint to get the base domain
    const url = new URL(providerConfig.apiUrl)
    const baseUrl = `${url.protocol}//${url.host}`
    const res = await fetch(baseUrl, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
    })
    // Any response (even 401/404) means the host is reachable
    return { name: 'Provider reachable', status: 'pass', message: `${providerConfig.name} host is reachable` }
  } catch {
    return { name: 'Provider reachable', status: 'warn', message: `${providerConfig.name} host unreachable — check your network` }
  }
}

async function checkLocalRuntimes(): Promise<CheckResult> {
  const runtimes: string[] = []

  // Ollama (default port 11434)
  const ollamaUp = await isOllamaRunning()
  if (ollamaUp) runtimes.push('Ollama')

  // LM Studio (default port 1234)
  try {
    const lmHost = process.env.LMSTUDIO_HOST || 'http://localhost:1234'
    const res = await fetch(`${lmHost}/v1/models`, { signal: AbortSignal.timeout(2000) })
    if (res.ok) runtimes.push('LM Studio')
  } catch { /* not running */ }

  // Jan (default port 1337)
  try {
    const janHost = process.env.JAN_HOST || 'http://localhost:1337'
    const res = await fetch(`${janHost}/v1/models`, { signal: AbortSignal.timeout(2000) })
    if (res.ok) runtimes.push('Jan')
  } catch { /* not running */ }

  // kbot local (default port 18789)
  try {
    const kbotLocalHost = process.env.KBOT_LOCAL_HOST || 'http://127.0.0.1:18789'
    const res = await fetch(`${kbotLocalHost}/health`, { signal: AbortSignal.timeout(2000) })
    if (res.ok) runtimes.push('kbot local')
  } catch { /* not running */ }

  if (runtimes.length > 0) {
    return { name: 'Local runtimes', status: 'pass', message: runtimes.join(', ') }
  }
  return { name: 'Local runtimes', status: 'warn', message: 'none detected (Ollama, LM Studio, Jan, kbot local)' }
}

function checkGit(): CheckResult {
  const version = execQuiet('git --version')
  if (version) {
    return { name: 'Git', status: 'pass', message: version }
  }
  return { name: 'Git', status: 'fail', message: 'not found — install git for version control tools' }
}

function checkDiskUsage(): CheckResult {
  if (!existsSync(KBOT_DIR)) {
    return { name: 'Disk usage', status: 'pass', message: '~/.kbot/ does not exist yet' }
  }
  const size = dirSize(KBOT_DIR)
  const formatted = formatBytes(size)
  if (size > 100 * 1024 * 1024) {
    return { name: 'Disk usage', status: 'warn', message: `~/.kbot/ is ${formatted} — consider running: kbot compact` }
  }
  return { name: 'Disk usage', status: 'pass', message: `~/.kbot/ is ${formatted}` }
}

function checkLearningData(): CheckResult {
  try {
    const stats = getExtendedStats()
    const parts: string[] = []
    if (stats.patternsCount > 0) parts.push(`${stats.patternsCount} patterns`)
    if (stats.solutionsCount > 0) parts.push(`${stats.solutionsCount} solutions`)
    if (stats.knowledgeCount > 0) parts.push(`${stats.knowledgeCount} knowledge entries`)
    if (stats.correctionsCount > 0) parts.push(`${stats.correctionsCount} corrections`)
    if (stats.projectsCount > 0) parts.push(`${stats.projectsCount} projects`)

    if (parts.length === 0) {
      return { name: 'Learning data', status: 'warn', message: 'no data yet — kbot learns as you use it' }
    }
    return { name: 'Learning data', status: 'pass', message: parts.join(', ') }
  } catch {
    return { name: 'Learning data', status: 'warn', message: 'could not read learning data' }
  }
}

function checkShell(): CheckResult {
  const shell = process.env.SHELL || ''
  const shellName = shell.split('/').pop() || 'unknown'

  if (!shell) {
    return { name: 'Shell', status: 'warn', message: 'SHELL env var not set' }
  }

  // Check if kbot completions are installed
  let completionsInstalled = false
  const home = homedir()

  try {
    if (shellName === 'zsh') {
      // Check common zsh completion paths
      const zshCompPaths = [
        join(home, '.zsh/completions/_kbot'),
        join(home, '.zfunc/_kbot'),
        '/usr/local/share/zsh/site-functions/_kbot',
        '/opt/homebrew/share/zsh/site-functions/_kbot',
      ]
      completionsInstalled = zshCompPaths.some(p => existsSync(p))
    } else if (shellName === 'bash') {
      const bashCompPaths = [
        join(home, '.bash_completion.d/kbot'),
        '/etc/bash_completion.d/kbot',
        '/usr/local/etc/bash_completion.d/kbot',
      ]
      completionsInstalled = bashCompPaths.some(p => existsSync(p))
    } else if (shellName === 'fish') {
      const fishCompPaths = [
        join(home, '.config/fish/completions/kbot.fish'),
        '/usr/share/fish/vendor_completions.d/kbot.fish',
      ]
      completionsInstalled = fishCompPaths.some(p => existsSync(p))
    }
  } catch {
    // Ignore filesystem errors
  }

  const completionStatus = completionsInstalled ? ', completions installed' : ''
  return { name: 'Shell', status: 'pass', message: `${shellName}${completionStatus}` }
}

// ── Main runner ──

export async function runDoctor(): Promise<DoctorReport> {
  const checks: CheckResult[] = []

  // Synchronous checks
  checks.push(checkNodeVersion())
  checks.push(checkNpmVersion())
  checks.push(checkKbotVersion())
  checks.push(checkApiKey())

  // Async checks — run in parallel for speed
  const [providerResult, runtimesResult] = await Promise.all([
    checkProviderReachable().catch((): CheckResult => ({
      name: 'Provider reachable', status: 'warn', message: 'check failed unexpectedly',
    })),
    checkLocalRuntimes().catch((): CheckResult => ({
      name: 'Local runtimes', status: 'warn', message: 'check failed unexpectedly',
    })),
  ])

  checks.push(providerResult)
  checks.push(runtimesResult)

  // More synchronous checks
  checks.push(checkGit())
  checks.push(checkDiskUsage())
  checks.push(checkLearningData())
  checks.push(checkShell())

  // Determine overall status
  let overall: CheckStatus = 'pass'
  for (const check of checks) {
    if (check.status === 'fail') {
      overall = 'fail'
      break
    }
    if (check.status === 'warn') {
      overall = 'warn'
    }
  }

  return {
    checks,
    timestamp: new Date().toISOString(),
    overall,
  }
}

// ── Formatter ──

// Color palette matching ui.ts
const useColor = !process.env.NO_COLOR && process.stdout.isTTY !== false
const GREEN = useColor ? chalk.hex('#4ADE80') : chalk
const RED = useColor ? chalk.hex('#F87171') : chalk
const YELLOW = useColor ? chalk.hex('#FBBF24') : chalk
const DIM = useColor ? chalk.dim : ((s: string) => s)
const ACCENT = useColor ? chalk.hex('#A78BFA') : chalk

const STATUS_ICON: Record<CheckStatus, string> = {
  pass: GREEN('✓'),
  warn: YELLOW('!'),
  fail: RED('✗'),
}

export function formatDoctorReport(report: DoctorReport): string {
  const lines: string[] = []

  lines.push('')
  lines.push(`  ${ACCENT('kbot Doctor')}`)
  lines.push(`  ${DIM('─'.repeat(50))}`)
  lines.push('')

  for (const check of report.checks) {
    const icon = STATUS_ICON[check.status]
    const nameCol = check.name.padEnd(20)
    lines.push(`  ${icon} ${nameCol}${check.message}`)
  }

  lines.push('')
  lines.push(`  ${DIM('─'.repeat(50))}`)

  // Summary
  if (report.overall === 'pass') {
    lines.push(`  ${GREEN('All checks passed.')} Ready to go!`)
  } else if (report.overall === 'warn') {
    const warnCount = report.checks.filter(c => c.status === 'warn').length
    lines.push(`  ${YELLOW(`${warnCount} warning${warnCount > 1 ? 's' : ''}.`)} kbot will work, but check the items above.`)
  } else {
    const failCount = report.checks.filter(c => c.status === 'fail').length
    lines.push(`  ${RED(`${failCount} issue${failCount > 1 ? 's' : ''} found.`)} Fix the items marked ${RED('✗')} above.`)
  }

  lines.push('')

  return lines.join('\n')
}
