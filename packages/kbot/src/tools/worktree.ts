// kbot Worktree — Git worktree isolation for safe experimentation
//
// Like Claude Code's EnterWorktree. Creates an isolated copy of the repo
// so the agent can experiment without affecting the main working tree.
//
// Flow:
//   worktree_create  — create a new worktree with a fresh branch
//   worktree_switch  — switch the session into a worktree
//   worktree_merge   — merge worktree changes back to main
//   worktree_remove  — clean up a worktree
//   worktree_list    — list active worktrees

import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, basename } from 'node:path'
import { registerTool } from './index.js'

interface Worktree {
  id: string
  branch: string
  path: string
  baseBranch: string
  createdAt: string
}

const worktrees = new Map<string, Worktree>()
let nextWorktreeId = 1

/** Get the git repo root */
function getRepoRoot(): string | null {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf-8', timeout: 5000 }).trim()
  } catch {
    return null
  }
}

/** Get current branch name */
function getCurrentBranch(): string {
  try {
    return execSync('git branch --show-current', { encoding: 'utf-8', timeout: 5000 }).trim()
  } catch {
    return 'main'
  }
}

export function registerWorktreeTools(): void {
  registerTool({
    name: 'worktree_create',
    description: 'Create an isolated git worktree for safe experimentation. Changes in the worktree do not affect the main working tree until merged.',
    parameters: {
      name: { type: 'string', description: 'Name for the worktree/branch (auto-generated if omitted)' },
      base: { type: 'string', description: 'Base branch to create from (defaults to current branch)' },
    },
    tier: 'free',
    async execute(args) {
      const repoRoot = getRepoRoot()
      if (!repoRoot) return 'Error: Not in a git repository.'

      const id = String(nextWorktreeId++)
      const name = args.name
        ? String(args.name)
        : `kbot-wt-${Date.now().toString(36)}`
      const baseBranch = args.base ? String(args.base) : getCurrentBranch()
      const branchName = `kbot/${name}`
      const worktreePath = join(repoRoot, '.kbot', 'worktrees', name)

      try {
        // Create the worktree with a new branch
        execSync(
          `git worktree add -b "${branchName}" "${worktreePath}" "${baseBranch}"`,
          { encoding: 'utf-8', cwd: repoRoot, timeout: 30000 },
        )

        const wt: Worktree = {
          id,
          branch: branchName,
          path: worktreePath,
          baseBranch,
          createdAt: new Date().toISOString(),
        }
        worktrees.set(id, wt)

        return [
          `Worktree #${id} created`,
          `  Branch: ${branchName} (from ${baseBranch})`,
          `  Path:   ${worktreePath}`,
          '',
          `Use \`worktree_switch\` with id="${id}" to work in this isolated copy.`,
          'Changes here won\'t affect your main working tree.',
        ].join('\n')
      } catch (err: unknown) {
        const e = err as { stderr?: string; message?: string }
        return `Error creating worktree: ${e.stderr?.trim() || e.message}`
      }
    },
  })

  registerTool({
    name: 'worktree_switch',
    description: 'Switch the current session into a worktree directory. All subsequent file operations happen in the isolated copy.',
    parameters: {
      id: { type: 'string', description: 'Worktree ID', required: true },
    },
    tier: 'free',
    async execute(args) {
      const id = String(args.id)
      const wt = worktrees.get(id)
      if (!wt) return `Error: Worktree #${id} not found. Use \`worktree_list\` to see available worktrees.`

      if (!existsSync(wt.path)) {
        return `Error: Worktree path no longer exists: ${wt.path}`
      }

      try {
        process.chdir(wt.path)
        return `Switched to worktree #${id}\n  Branch: ${wt.branch}\n  Path: ${wt.path}\n\nAll file operations now happen in this isolated copy.`
      } catch (err) {
        return `Error switching to worktree: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  registerTool({
    name: 'worktree_merge',
    description: 'Merge worktree changes back into the base branch. Switches back to the main working tree after merging.',
    parameters: {
      id: { type: 'string', description: 'Worktree ID', required: true },
      message: { type: 'string', description: 'Merge commit message (auto-generated if omitted)' },
    },
    tier: 'free',
    async execute(args) {
      const id = String(args.id)
      const wt = worktrees.get(id)
      if (!wt) return `Error: Worktree #${id} not found.`

      const repoRoot = getRepoRoot() || wt.path.replace(/\/.kbot\/worktrees\/.*$/, '')

      try {
        // Commit any uncommitted changes in the worktree
        try {
          execSync('git add -A && git diff --staged --quiet || git commit -m "kbot: worktree changes"', {
            encoding: 'utf-8', cwd: wt.path, timeout: 15000,
            stdio: ['pipe', 'pipe', 'pipe'],
          })
        } catch { /* no changes to commit */ }

        // Switch to main repo and merge
        const commitMsg = args.message
          ? String(args.message)
          : `Merge kbot worktree: ${wt.branch}`

        execSync(`git merge "${wt.branch}" -m "${commitMsg}"`, {
          encoding: 'utf-8', cwd: repoRoot, timeout: 30000,
        })

        // Switch back to main repo
        process.chdir(repoRoot)

        return [
          `Worktree #${id} merged into ${wt.baseBranch}`,
          `  Message: ${commitMsg}`,
          `  Switched back to: ${repoRoot}`,
          '',
          `Use \`worktree_remove\` to clean up, or keep it for future work.`,
        ].join('\n')
      } catch (err: unknown) {
        const e = err as { stderr?: string; message?: string }
        return `Error merging worktree: ${e.stderr?.trim() || e.message}\n\nYou may need to resolve merge conflicts manually.`
      }
    },
  })

  registerTool({
    name: 'worktree_remove',
    description: 'Remove a worktree and its branch. Cleans up the isolated copy.',
    parameters: {
      id: { type: 'string', description: 'Worktree ID', required: true },
      force: { type: 'boolean', description: 'Force removal even with uncommitted changes' },
    },
    tier: 'free',
    async execute(args) {
      const id = String(args.id)
      const wt = worktrees.get(id)
      if (!wt) return `Error: Worktree #${id} not found.`

      const repoRoot = getRepoRoot() || wt.path.replace(/\/.kbot\/worktrees\/.*$/, '')
      const force = args.force === true ? ' --force' : ''

      // If we're currently in the worktree, switch back
      if (process.cwd().startsWith(wt.path)) {
        process.chdir(repoRoot)
      }

      try {
        execSync(`git worktree remove "${wt.path}"${force}`, {
          encoding: 'utf-8', cwd: repoRoot, timeout: 15000,
        })

        // Delete the branch too
        try {
          execSync(`git branch -d "${wt.branch}"`, {
            encoding: 'utf-8', cwd: repoRoot, timeout: 5000,
            stdio: ['pipe', 'pipe', 'pipe'],
          })
        } catch { /* branch may already be gone */ }

        worktrees.delete(id)
        return `Worktree #${id} removed (branch: ${wt.branch})`
      } catch (err: unknown) {
        const e = err as { stderr?: string; message?: string }
        return `Error removing worktree: ${e.stderr?.trim() || e.message}\nTry with force=true to override.`
      }
    },
  })

  registerTool({
    name: 'worktree_list',
    description: 'List all kbot worktrees and git worktrees.',
    parameters: {},
    tier: 'free',
    async execute() {
      const lines: string[] = []

      // kbot managed worktrees
      if (worktrees.size > 0) {
        lines.push('kbot worktrees:')
        for (const [id, wt] of worktrees) {
          const exists = existsSync(wt.path) ? '✓' : '✗'
          lines.push(`  ${exists} #${id}  ${wt.branch.padEnd(30)} ${wt.path}`)
        }
        lines.push('')
      }

      // All git worktrees
      try {
        const gitWorktrees = execSync('git worktree list', {
          encoding: 'utf-8', timeout: 5000,
        }).trim()
        lines.push('Git worktrees:')
        lines.push(gitWorktrees.split('\n').map(l => `  ${l}`).join('\n'))
      } catch {
        lines.push('Not in a git repository.')
      }

      return lines.join('\n') || 'No worktrees.'
    },
  })
}
