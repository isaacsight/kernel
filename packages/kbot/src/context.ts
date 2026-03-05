// K:BOT Context — Codebase awareness for smarter responses
// Gathers local project context to send with API requests.
// This reduces token waste: the agent knows your project structure upfront.

import { execSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, basename } from 'node:path'

export interface ProjectContext {
  isGitRepo: boolean
  repoRoot?: string
  branch?: string
  language?: string
  framework?: string
  packageManager?: string
  fileTree: string
  recentChanges?: string
}

/** Detect if we're in a git repository */
function getGitInfo(): { isGitRepo: boolean; root?: string; branch?: string } {
  try {
    const root = execSync('git rev-parse --show-toplevel', { encoding: 'utf-8', timeout: 5000 }).trim()
    const branch = execSync('git branch --show-current', { encoding: 'utf-8', timeout: 5000 }).trim()
    return { isGitRepo: true, root, branch }
  } catch {
    return { isGitRepo: false }
  }
}

/** Get a compact file tree (max depth 3) */
function getFileTree(root: string): string {
  try {
    return execSync(
      `find "${root}" -maxdepth 3 -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' -not -path '*/.next/*' -not -path '*/build/*' -type f | head -100`,
      { encoding: 'utf-8', timeout: 10000 }
    ).trim()
  } catch {
    return ''
  }
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

/** Get recent git changes for context */
function getRecentChanges(): string {
  try {
    return execSync('git diff --stat HEAD~3 2>/dev/null || echo "No recent changes"', {
      encoding: 'utf-8', timeout: 5000,
    }).trim()
  } catch {
    return ''
  }
}

/** Gather full project context. Called once at startup and cached. */
export function gatherContext(): ProjectContext {
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

  return parts.join('\n')
}
