// K:BOT Background Tasks — Run long commands asynchronously
//
// Mirrors Claude Code's run_in_background + TaskOutput pattern.
// Start a command, continue working, check output later.
//
// Flow:
//   1. background_run — spawn a command in background, get task ID
//   2. background_check — check output of a running/completed background task
//   3. background_stop — kill a background task
//   4. background_list — list all background tasks

import { spawn, type ChildProcess } from 'node:child_process'
import { registerTool } from './index.js'

interface BackgroundTask {
  id: string
  command: string
  process: ChildProcess
  stdout: string
  stderr: string
  status: 'running' | 'completed' | 'failed' | 'stopped'
  exitCode: number | null
  startedAt: string
  completedAt?: string
  pid: number
}

const backgroundTasks = new Map<string, BackgroundTask>()
let nextTaskId = 1

export function registerBackgroundTools(): void {
  registerTool({
    name: 'background_run',
    description: 'Run a shell command in the background. Returns a task ID to check output later. Useful for long-running builds, tests, or servers.',
    parameters: {
      command: { type: 'string', description: 'Shell command to run', required: true },
      label: { type: 'string', description: 'Optional human-readable label for the task' },
    },
    tier: 'free',
    async execute(args) {
      const command = String(args.command)
      const label = args.label ? String(args.label) : command.slice(0, 60)
      const id = String(nextTaskId++)

      const proc = spawn('sh', ['-c', command], {
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: process.cwd(),
        detached: false,
      })

      const task: BackgroundTask = {
        id,
        command,
        process: proc,
        stdout: '',
        stderr: '',
        status: 'running',
        exitCode: null,
        startedAt: new Date().toISOString(),
        pid: proc.pid || 0,
      }

      proc.stdout?.on('data', (chunk: Buffer) => {
        task.stdout += chunk.toString()
        // Cap at 5MB to prevent memory issues
        if (task.stdout.length > 5 * 1024 * 1024) {
          task.stdout = task.stdout.slice(-2 * 1024 * 1024)
        }
      })

      proc.stderr?.on('data', (chunk: Buffer) => {
        task.stderr += chunk.toString()
        if (task.stderr.length > 5 * 1024 * 1024) {
          task.stderr = task.stderr.slice(-2 * 1024 * 1024)
        }
      })

      proc.on('close', (code) => {
        task.exitCode = code
        task.status = code === 0 ? 'completed' : 'failed'
        task.completedAt = new Date().toISOString()
      })

      proc.on('error', (err) => {
        task.status = 'failed'
        task.stderr += `\nProcess error: ${err.message}`
        task.completedAt = new Date().toISOString()
      })

      backgroundTasks.set(id, task)
      return `Background task #${id} started (PID ${task.pid}): ${label}`
    },
  })

  registerTool({
    name: 'background_check',
    description: 'Check the output and status of a background task. Returns stdout, stderr, and status.',
    parameters: {
      id: { type: 'string', description: 'Background task ID', required: true },
      tail: { type: 'number', description: 'Number of lines to return from the end (default: all)' },
    },
    tier: 'free',
    async execute(args) {
      const id = String(args.id)
      const task = backgroundTasks.get(id)
      if (!task) return `Error: Background task #${id} not found`

      const tailLines = typeof args.tail === 'number' ? args.tail : 0

      let stdout = task.stdout
      let stderr = task.stderr

      if (tailLines > 0) {
        stdout = stdout.split('\n').slice(-tailLines).join('\n')
        stderr = stderr.split('\n').slice(-tailLines).join('\n')
      }

      const lines: string[] = [
        `Task #${id}: ${task.status}${task.exitCode !== null ? ` (exit ${task.exitCode})` : ''}`,
        `Command: ${task.command}`,
        `Started: ${task.startedAt}`,
      ]

      if (task.completedAt) lines.push(`Completed: ${task.completedAt}`)

      if (stdout) {
        lines.push('', '── stdout ──', stdout)
      }
      if (stderr) {
        lines.push('', '── stderr ──', stderr)
      }
      if (!stdout && !stderr) {
        lines.push('', '(no output yet)')
      }

      return lines.join('\n')
    },
  })

  registerTool({
    name: 'background_stop',
    description: 'Stop a running background task.',
    parameters: {
      id: { type: 'string', description: 'Background task ID', required: true },
    },
    tier: 'free',
    async execute(args) {
      const id = String(args.id)
      const task = backgroundTasks.get(id)
      if (!task) return `Error: Background task #${id} not found`

      if (task.status !== 'running') {
        return `Task #${id} already ${task.status}`
      }

      task.process.kill('SIGTERM')
      // Force kill after 5 seconds
      setTimeout(() => {
        try { task.process.kill('SIGKILL') } catch { /* already dead */ }
      }, 5000)

      task.status = 'stopped'
      task.completedAt = new Date().toISOString()
      return `Background task #${id} stopped`
    },
  })

  registerTool({
    name: 'background_list',
    description: 'List all background tasks and their status.',
    parameters: {},
    tier: 'free',
    async execute() {
      if (backgroundTasks.size === 0) return 'No background tasks.'

      const lines: string[] = []
      for (const [id, task] of backgroundTasks) {
        const elapsed = task.completedAt
          ? `${Math.round((new Date(task.completedAt).getTime() - new Date(task.startedAt).getTime()) / 1000)}s`
          : `${Math.round((Date.now() - new Date(task.startedAt).getTime()) / 1000)}s`

        const statusIcon = {
          running: '●',
          completed: '✓',
          failed: '✗',
          stopped: '■',
        }[task.status]

        lines.push(`${statusIcon} #${id} [${task.status}] ${task.command.slice(0, 60)} (${elapsed})`)
      }
      return lines.join('\n')
    },
  })
}
