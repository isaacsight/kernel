// K:BOT Git Tools — Git operations executed locally
// Zero API calls. All operations happen on the local repo.

import { execSync } from 'node:child_process'
import { registerTool } from './index.js'

function git(command: string, timeout = 30_000): string {
  try {
    return execSync(`git ${command}`, {
      encoding: 'utf-8',
      timeout,
      maxBuffer: 5 * 1024 * 1024,
    }).trim()
  } catch (err: unknown) {
    const e = err as { stderr?: string; message?: string }
    throw new Error(e.stderr?.trim() || e.message || 'Git command failed')
  }
}

export function registerGitTools(): void {
  registerTool({
    name: 'git_status',
    description: 'Show the working tree status — modified, staged, and untracked files.',
    parameters: {},
    tier: 'free',
    async execute() {
      return git('status --short')
    },
  })

  registerTool({
    name: 'git_diff',
    description: 'Show changes in the working directory (unstaged and staged).',
    parameters: {
      staged: { type: 'boolean', description: 'Show only staged changes' },
      path: { type: 'string', description: 'Limit diff to a specific file path' },
    },
    tier: 'free',
    async execute(args) {
      const staged = args.staged ? '--cached' : ''
      const path = args.path ? `-- ${args.path}` : ''
      return git(`diff ${staged} ${path}`.trim()) || 'No changes'
    },
  })

  registerTool({
    name: 'git_log',
    description: 'Show recent commit history.',
    parameters: {
      count: { type: 'number', description: 'Number of commits to show (default: 10)' },
      oneline: { type: 'boolean', description: 'One-line format (default: true)' },
    },
    tier: 'free',
    async execute(args) {
      const count = typeof args.count === 'number' ? args.count : 10
      const format = args.oneline !== false ? '--oneline' : ''
      return git(`log -${count} ${format}`.trim())
    },
  })

  registerTool({
    name: 'git_commit',
    description: 'Create a git commit with the specified message. Stages specified files first.',
    parameters: {
      message: { type: 'string', description: 'Commit message', required: true },
      files: { type: 'array', description: 'Files to stage before committing. If empty, commits already-staged files.' },
    },
    tier: 'free',
    async execute(args) {
      const message = String(args.message)
      const files = Array.isArray(args.files) ? args.files.map(String) : []

      if (files.length > 0) {
        // Quote each filename to prevent shell injection
        const quoted = files.map(f => `'${String(f).replace(/'/g, "'\\''")}'`).join(' ')
        git(`add -- ${quoted}`)
      }

      // Use -- to prevent message from being interpreted as flags
      const safeMsg = message.replace(/'/g, "'\\''")
      return git(`commit -m '${safeMsg}'`)
    },
  })

  registerTool({
    name: 'git_branch',
    description: 'Create or switch branches.',
    parameters: {
      name: { type: 'string', description: 'Branch name', required: true },
      create: { type: 'boolean', description: 'Create a new branch (default: false)' },
    },
    tier: 'free',
    async execute(args) {
      const name = String(args.name)
      const create = args.create ? '-b' : ''
      return git(`checkout ${create} ${name}`.trim())
    },
  })

  registerTool({
    name: 'git_push',
    description: 'Push commits to the remote repository. Use with caution.',
    parameters: {
      remote: { type: 'string', description: 'Remote name (default: origin)' },
      branch: { type: 'string', description: 'Branch name (default: current branch)' },
    },
    tier: 'free',
    async execute(args) {
      const remote = args.remote ? String(args.remote) : 'origin'
      const branch = args.branch ? String(args.branch) : ''
      return git(`push ${remote} ${branch}`.trim(), 60_000)
    },
  })
}
