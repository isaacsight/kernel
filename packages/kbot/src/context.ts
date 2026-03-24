// kbot Context — Codebase awareness for smarter responses
// Gathers local project context to send with API requests.
// This reduces token waste: the agent knows your project structure upfront.
//
// OPTIMIZED: All shell commands run with short timeouts.
// File tree uses `ls` fallback when `find` is slow.
// Stack detection is pure filesystem (no shell needed).

import { execSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, basename } from 'node:path'
import type { MachineProfile } from './machine.js'

export interface ProjectContext {
  isGitRepo: boolean
  repoRoot?: string
  branch?: string
  language?: string
  framework?: string
  packageManager?: string
  fileTree: string
  recentChanges?: string
  /** Contents of .kbot.md or KBOT.md (like CLAUDE.md) */
  projectInstructions?: string
  /** Machine hardware/OS profile (probed once, cached) */
  machine?: MachineProfile
}

/** Run a shell command with a tight timeout — returns empty string on failure */
function quickExec(cmd: string, timeoutMs = 2000): string {
  try {
    return execSync(cmd, { encoding: 'utf-8', timeout: timeoutMs, stdio: ['pipe', 'pipe', 'pipe'] }).trim()
  } catch {
    return ''
  }
}

/** Detect if we're in a git repository */
function getGitInfo(): { isGitRepo: boolean; root?: string; branch?: string } {
  const root = quickExec('git rev-parse --show-toplevel', 1500)
  if (!root) return { isGitRepo: false }
  const branch = quickExec('git branch --show-current', 1000)
  return { isGitRepo: true, root, branch }
}

/** Get a compact file tree — fast approach using readdirSync instead of find */
function getFileTree(root: string): string {
  const skipDirs = new Set(['node_modules', '.git', 'dist', '.next', 'build', '__pycache__', '.venv', 'target', 'vendor'])
  const files: string[] = []
  const maxFiles = 80

  function walk(dir: string, depth: number): void {
    if (depth > 3 || files.length >= maxFiles) return
    try {
      const entries = readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (files.length >= maxFiles) return
        if (entry.name.startsWith('.') && entry.isDirectory()) continue
        if (skipDirs.has(entry.name)) continue

        const fullPath = join(dir, entry.name)
        const relPath = fullPath.replace(root + '/', '')

        if (entry.isDirectory()) {
          walk(fullPath, depth + 1)
        } else {
          files.push(relPath)
        }
      }
    } catch { /* permission denied, etc. */ }
  }

  walk(root, 0)
  return files.join('\n')
}

/** Detect project language and framework from package.json or other config files */
function detectStack(root: string): { language?: string; framework?: string; packageManager?: string } {
  const result: { language?: string; framework?: string; packageManager?: string } = {}

  // Check for Node.js project
  const pkgPath = join(root, 'package.json')
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
      const deps = { ...pkg.dependencies, ...pkg.devDependencies }
      result.language = deps.typescript ? 'TypeScript' : 'JavaScript'

      if (deps.react || deps['react-dom']) result.framework = 'React'
      else if (deps.next) result.framework = 'Next.js'
      else if (deps.vue) result.framework = 'Vue'
      else if (deps.svelte) result.framework = 'Svelte'
      else if (deps.express) result.framework = 'Express'
      else if (deps.fastify) result.framework = 'Fastify'

      // Package manager
      if (existsSync(join(root, 'bun.lockb'))) result.packageManager = 'bun'
      else if (existsSync(join(root, 'pnpm-lock.yaml'))) result.packageManager = 'pnpm'
      else if (existsSync(join(root, 'yarn.lock'))) result.packageManager = 'yarn'
      else result.packageManager = 'npm'
    } catch { /* ignore */ }
  }

  // Python
  if (existsSync(join(root, 'pyproject.toml')) || existsSync(join(root, 'setup.py'))) {
    result.language = result.language || 'Python'
  }

  // Rust
  if (existsSync(join(root, 'Cargo.toml'))) {
    result.language = 'Rust'
  }

  // Go
  if (existsSync(join(root, 'go.mod'))) {
    result.language = 'Go'
  }

  return result
}

/** Load .kbot.md or KBOT.md project instructions (like CLAUDE.md convention) */
function loadProjectInstructions(root: string): string | undefined {
  const candidates = [
    join(root, '.kbot.md'),
    join(root, 'KBOT.md'),
    join(root, '.kbot', 'instructions.md'),
  ]

  for (const path of candidates) {
    if (existsSync(path)) {
      try {
        const content = readFileSync(path, 'utf-8')
        return content.slice(0, 8192) // Cap at 8KB
      } catch { continue }
    }
  }

  return undefined
}

/** Get recent git changes for context — fast with tight timeout */
function getRecentChanges(): string {
  return quickExec('git diff --stat HEAD~3 2>/dev/null', 1500)
}

/** Gather full project context. Called once at startup and cached. */
export function gatherContext(machine?: MachineProfile): ProjectContext {
  const git = getGitInfo()
  const root = git.root || process.cwd()
  const stack = detectStack(root)
  const fileTree = getFileTree(root)

  return {
    isGitRepo: git.isGitRepo,
    repoRoot: git.root,
    branch: git.branch,
    language: stack.language,
    framework: stack.framework,
    packageManager: stack.packageManager,
    fileTree,
    recentChanges: git.isGitRepo ? getRecentChanges() : undefined,
    projectInstructions: loadProjectInstructions(root),
    machine,
  }
}

/** Format context as a system prompt snippet */
export function formatContextForPrompt(ctx: ProjectContext): string {
  const parts: string[] = ['[Project Context]']

  if (ctx.isGitRepo) {
    parts.push(`Repository: ${basename(ctx.repoRoot || process.cwd())}`)
    parts.push(`Branch: ${ctx.branch || 'unknown'}`)
  }
  if (ctx.language) parts.push(`Language: ${ctx.language}`)
  if (ctx.framework) parts.push(`Framework: ${ctx.framework}`)
  if (ctx.packageManager) parts.push(`Package Manager: ${ctx.packageManager}`)

  if (ctx.fileTree) {
    const files = ctx.fileTree.split('\n').slice(0, 30)
    parts.push(`\nKey files:\n${files.join('\n')}`)
    if (ctx.fileTree.split('\n').length > 30) {
      parts.push(`... and ${ctx.fileTree.split('\n').length - 30} more files`)
    }
  }

  if (ctx.recentChanges) {
    parts.push(`\nRecent changes:\n${ctx.recentChanges}`)
  }

  if (ctx.projectInstructions) {
    parts.push(`\n[Project Instructions (.kbot.md)]\n${ctx.projectInstructions}`)
  }

  // Machine context — gives the agent hardware awareness
  if (ctx.machine) {
    parts.push(`\n${formatMachineContext(ctx.machine)}`)
  }

  return parts.join('\n')
}

/** Compact machine context for system prompt injection */
function formatMachineContext(m: MachineProfile): string {
  const lines: string[] = ['[Machine Context]']

  lines.push(`Machine: ${m.model || 'Unknown'}${m.cpu.chip ? ` — ${m.cpu.chip}` : ` — ${m.cpu.model}`}`)
  lines.push(`CPU: ${m.cpu.cores} cores${m.cpu.performanceCores ? ` (${m.cpu.performanceCores}P + ${m.cpu.efficiencyCores}E)` : ''}, ${m.cpu.arch}`)

  const gpuSummary = m.gpu.map(g => `${g.model}${g.cores ? ` (${g.cores} cores)` : ''}`).join(', ')
  lines.push(`GPU: ${gpuSummary}`)

  lines.push(`Memory: ${m.memory.total} (${m.memory.free} free, ${m.memory.pressure} pressure)`)
  lines.push(`Disk: ${m.disk.available} available of ${m.disk.total}`)
  lines.push(`OS: ${m.os} (${m.kernel})`)

  if (m.displays.length > 0) {
    lines.push(`Display: ${m.displays.map(d => `${d.resolution}${d.type ? ` ${d.type}` : ''}`).join(', ')}`)
  }

  if (m.battery.present) {
    lines.push(`Battery: ${m.battery.percent}% ${m.battery.charging ? 'charging' : 'discharging'}`)
  }

  lines.push(`GPU accel: ${m.gpuAcceleration} — local models up to ${m.recommendedModelSize}`)

  const toolNames = m.devTools.map(t => `${t.name} ${t.version}`).join(', ')
  if (toolNames) lines.push(`Tools: ${toolNames}`)

  return lines.join('\n')
}
