// K:BOT Task/TODO Tracking — Structured progress tracking during complex work
//
// Mirrors Claude Code's TaskCreate/TaskUpdate/TaskList/TaskGet pattern.
// Tasks persist in memory during the session. The AI uses these to:
//   1. Break down complex work into trackable steps
//   2. Show the user progress on multi-step tasks
//   3. Track dependencies between tasks
//   4. Remember what's done and what's pending

import { registerTool } from './index.js'

export interface Task {
  id: string
  subject: string
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'blocked'
  /** Present continuous form for progress display (e.g., "Running tests") */
  activeForm?: string
  blockedBy: string[]
  blocks: string[]
  created: string
  updated: string
}

const tasks = new Map<string, Task>()
let nextId = 1

function formatTask(task: Task): string {
  const statusIcon = {
    pending: '○',
    in_progress: '◉',
    completed: '✓',
    blocked: '⊘',
  }[task.status]

  const blocked = task.blockedBy.length > 0 ? ` (blocked by: ${task.blockedBy.join(', ')})` : ''
  return `${statusIcon} #${task.id} [${task.status}] ${task.subject}${blocked}`
}

export function registerTaskTools(): void {
  registerTool({
    name: 'task_create',
    description: 'Create a task for tracking progress on complex work. Returns the task ID.',
    parameters: {
      subject: { type: 'string', description: 'Brief task title in imperative form (e.g., "Fix auth bug")', required: true },
      description: { type: 'string', description: 'Detailed description of what needs to be done' },
      activeForm: { type: 'string', description: 'Present continuous form for spinner display (e.g., "Fixing auth bug")' },
      blockedBy: { type: 'array', description: 'Task IDs that must complete before this one can start', items: { type: 'string' } },
    },
    tier: 'free',
    async execute(args) {
      const id = String(nextId++)
      const now = new Date().toISOString()

      const task: Task = {
        id,
        subject: String(args.subject),
        description: args.description ? String(args.description) : '',
        status: 'pending',
        activeForm: args.activeForm ? String(args.activeForm) : undefined,
        blockedBy: Array.isArray(args.blockedBy) ? args.blockedBy.map(String) : [],
        blocks: [],
        created: now,
        updated: now,
      }

      // Update blocks references on blocker tasks
      for (const blockerId of task.blockedBy) {
        const blocker = tasks.get(blockerId)
        if (blocker && !blocker.blocks.includes(id)) {
          blocker.blocks.push(id)
        }
      }

      tasks.set(id, task)
      return `Task #${id} created: ${task.subject}`
    },
  })

  registerTool({
    name: 'task_update',
    description: 'Update a task status, subject, or dependencies.',
    parameters: {
      id: { type: 'string', description: 'Task ID to update', required: true },
      status: { type: 'string', description: 'New status: pending, in_progress, completed, blocked' },
      subject: { type: 'string', description: 'Updated subject' },
      description: { type: 'string', description: 'Updated description' },
      addBlockedBy: { type: 'array', description: 'Task IDs to add as blockers', items: { type: 'string' } },
    },
    tier: 'free',
    async execute(args) {
      const id = String(args.id)
      const task = tasks.get(id)
      if (!task) return `Error: Task #${id} not found`

      if (args.status) {
        const status = String(args.status) as Task['status']
        if (!['pending', 'in_progress', 'completed', 'blocked'].includes(status)) {
          return `Error: Invalid status "${status}". Use: pending, in_progress, completed, blocked`
        }
        task.status = status

        // If completing, auto-unblock dependent tasks
        if (status === 'completed') {
          for (const blockedId of task.blocks) {
            const blocked = tasks.get(blockedId)
            if (blocked) {
              blocked.blockedBy = blocked.blockedBy.filter(b => b !== id)
              if (blocked.blockedBy.length === 0 && blocked.status === 'blocked') {
                blocked.status = 'pending'
              }
            }
          }
        }
      }

      if (args.subject) task.subject = String(args.subject)
      if (args.description) task.description = String(args.description)

      if (Array.isArray(args.addBlockedBy)) {
        for (const blockerId of args.addBlockedBy) {
          const bid = String(blockerId)
          if (!task.blockedBy.includes(bid)) {
            task.blockedBy.push(bid)
            const blocker = tasks.get(bid)
            if (blocker && !blocker.blocks.includes(id)) {
              blocker.blocks.push(id)
            }
          }
        }
      }

      task.updated = new Date().toISOString()
      return formatTask(task)
    },
  })

  registerTool({
    name: 'task_list',
    description: 'List all tasks with their status. Shows pending, in-progress, completed, and blocked tasks.',
    parameters: {
      status: { type: 'string', description: 'Filter by status (pending, in_progress, completed, blocked). Omit to show all.' },
    },
    tier: 'free',
    async execute(args) {
      if (tasks.size === 0) return 'No tasks.'

      let filtered = Array.from(tasks.values())
      if (args.status) {
        filtered = filtered.filter(t => t.status === String(args.status))
      }

      if (filtered.length === 0) return `No ${args.status || ''} tasks.`

      // Group by status
      const groups: Record<string, Task[]> = {}
      for (const t of filtered) {
        if (!groups[t.status]) groups[t.status] = []
        groups[t.status].push(t)
      }

      const lines: string[] = []
      const order = ['in_progress', 'pending', 'blocked', 'completed']
      for (const status of order) {
        if (groups[status]) {
          for (const task of groups[status]) {
            lines.push(formatTask(task))
          }
        }
      }

      const completed = filtered.filter(t => t.status === 'completed').length
      const total = filtered.length
      lines.push('')
      lines.push(`${completed}/${total} completed`)

      return lines.join('\n')
    },
  })

  registerTool({
    name: 'task_get',
    description: 'Get full details of a specific task including description and dependencies.',
    parameters: {
      id: { type: 'string', description: 'Task ID', required: true },
    },
    tier: 'free',
    async execute(args) {
      const id = String(args.id)
      const task = tasks.get(id)
      if (!task) return `Error: Task #${id} not found`

      const lines = [
        `Task #${task.id}: ${task.subject}`,
        `Status: ${task.status}`,
        `Description: ${task.description || '(none)'}`,
      ]
      if (task.activeForm) lines.push(`Active form: ${task.activeForm}`)
      if (task.blockedBy.length > 0) lines.push(`Blocked by: ${task.blockedBy.join(', ')}`)
      if (task.blocks.length > 0) lines.push(`Blocks: ${task.blocks.join(', ')}`)
      lines.push(`Created: ${task.created}`)
      lines.push(`Updated: ${task.updated}`)

      return lines.join('\n')
    },
  })

  registerTool({
    name: 'task_delete',
    description: 'Delete a task by ID.',
    parameters: {
      id: { type: 'string', description: 'Task ID to delete', required: true },
    },
    tier: 'free',
    async execute(args) {
      const id = String(args.id)
      const task = tasks.get(id)
      if (!task) return `Error: Task #${id} not found`

      // Clean up dependency references
      for (const blockerId of task.blockedBy) {
        const blocker = tasks.get(blockerId)
        if (blocker) {
          blocker.blocks = blocker.blocks.filter(b => b !== id)
        }
      }
      for (const blockedId of task.blocks) {
        const blocked = tasks.get(blockedId)
        if (blocked) {
          blocked.blockedBy = blocked.blockedBy.filter(b => b !== id)
        }
      }

      tasks.delete(id)
      return `Task #${id} deleted: ${task.subject}`
    },
  })
}
