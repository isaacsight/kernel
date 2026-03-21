// @kernel.chat/prompt-evolver — GEPA-style Prompt Self-Optimization
//
// Prompts evolve from execution traces. Track what works, mutate what
// doesn't, auto-rollback bad changes. Zero LLM calls — heuristic mutations.
//
// Usage:
//   import { PromptEvolver } from '@kernel.chat/prompt-evolver'
//
//   const evolver = new PromptEvolver({ threshold: 20 })
//   evolver.recordTrace({ agent: 'coder', taskType: 'debugging', tools: ['bash', 'read_file'], score: 0.9, success: true })
//   const mutation = evolver.evolve('coder')
//   if (mutation) console.log(`New prompt amendment: ${mutation.text}`)

// ── Types ──────────────────────────────────────────────────────────────

/** Execution trace — one agent run */
export interface Trace {
  agent: string
  taskType: string
  toolsUsed: string[]
  score: number         // 0-1
  success: boolean
  messageLength?: number
  timestamp: string
}

/** A mutation applied to a prompt */
export interface Mutation {
  agent: string
  text: string          // The amendment to append
  reason: string
  scoreBefore: number
  scoreAfter: number    // Filled in after measurement
  appliedAt: string
  rolledBack: boolean
}

/** Configuration */
export interface EvolverConfig {
  /** Traces per agent before evolution triggers (default: 20) */
  threshold?: number
  /** Max traces to keep (default: 500) */
  maxTraces?: number
  /** Max mutations to keep (default: 50) */
  maxMutations?: number
  /** Score drop threshold for auto-rollback (default: 0.1) */
  rollbackThreshold?: number
}

/** Evolution state */
export interface EvolverState {
  traces: Trace[]
  mutations: Mutation[]
  generation: number
}

// ── Mutation Generators ────────────────────────────────────────────────

interface MutationRule {
  name: string
  check: (traces: Trace[]) => boolean
  generate: (traces: Trace[]) => string
}

const MUTATION_RULES: MutationRule[] = [
  {
    name: 'tool-preference',
    check: (traces) => {
      const successTools = new Map<string, number>()
      const failTools = new Map<string, number>()
      for (const t of traces) {
        const map = t.success ? successTools : failTools
        for (const tool of t.toolsUsed) {
          map.set(tool, (map.get(tool) ?? 0) + 1)
        }
      }
      // Check if any tool is strongly associated with success
      for (const [tool, count] of successTools) {
        const failCount = failTools.get(tool) ?? 0
        if (count >= 5 && count > failCount * 3) return true
      }
      return false
    },
    generate: (traces) => {
      const toolSuccess = new Map<string, number>()
      for (const t of traces.filter(t => t.success)) {
        for (const tool of t.toolsUsed) {
          toolSuccess.set(tool, (toolSuccess.get(tool) ?? 0) + 1)
        }
      }
      const sorted = [...toolSuccess.entries()].sort((a, b) => b[1] - a[1])
      const top3 = sorted.slice(0, 3).map(([t]) => t)
      return `Prefer using these tools when applicable: ${top3.join(', ')}. They have the highest success rates in your history.`
    },
  },
  {
    name: 'brevity-boost',
    check: (traces) => {
      const short = traces.filter(t => t.success && (t.messageLength ?? 0) < 500)
      const long = traces.filter(t => t.success && (t.messageLength ?? 0) > 2000)
      return short.length > long.length * 2 && short.length >= 5
    },
    generate: () => 'Keep responses concise. Shorter responses have been more successful. Lead with the answer, explain after.',
  },
  {
    name: 'verbosity-boost',
    check: (traces) => {
      const long = traces.filter(t => t.success && (t.messageLength ?? 0) > 1500)
      const short = traces.filter(t => !t.success && (t.messageLength ?? 0) < 500)
      return long.length >= 5 && short.length >= 3
    },
    generate: () => 'Provide detailed, thorough responses. Brief answers have led to more failures. Include context, reasoning, and examples.',
  },
  {
    name: 'task-specialization',
    check: (traces) => {
      const taskSuccess = new Map<string, { wins: number; total: number }>()
      for (const t of traces) {
        const entry = taskSuccess.get(t.taskType) ?? { wins: 0, total: 0 }
        entry.total++
        if (t.success) entry.wins++
        taskSuccess.set(t.taskType, entry)
      }
      // Check for a task type with >80% success rate and enough data
      for (const [, stats] of taskSuccess) {
        if (stats.total >= 5 && stats.wins / stats.total > 0.8) return true
      }
      return false
    },
    generate: (traces) => {
      const taskSuccess = new Map<string, { wins: number; total: number }>()
      for (const t of traces) {
        const entry = taskSuccess.get(t.taskType) ?? { wins: 0, total: 0 }
        entry.total++
        if (t.success) entry.wins++
        taskSuccess.set(t.taskType, entry)
      }
      const best = [...taskSuccess.entries()]
        .filter(([, s]) => s.total >= 5)
        .sort((a, b) => (b[1].wins / b[1].total) - (a[1].wins / a[1].total))
      if (best.length === 0) return ''
      const [taskType, stats] = best[0]
      return `You excel at ${taskType} tasks (${Math.round(stats.wins / stats.total * 100)}% success). Lean into this strength — be confident and direct on these tasks.`
    },
  },
  {
    name: 'failure-pattern',
    check: (traces) => {
      const recent = traces.slice(-10)
      const failures = recent.filter(t => !t.success)
      return failures.length >= 4
    },
    generate: (traces) => {
      const failures = traces.filter(t => !t.success).slice(-5)
      const taskTypes = [...new Set(failures.map(t => t.taskType))]
      const tools = [...new Set(failures.flatMap(t => t.toolsUsed))]
      return `Recent failures detected in ${taskTypes.join(', ')} tasks using ${tools.slice(0, 3).join(', ')}. Before executing, pause and verify your approach. Check assumptions. Read existing code before modifying.`
    },
  },
]

// ── Core Evolver ───────────────────────────────────────────────────────

export class PromptEvolver {
  private state: EvolverState
  private config: Required<EvolverConfig>

  constructor(config?: EvolverConfig) {
    this.config = {
      threshold: config?.threshold ?? 20,
      maxTraces: config?.maxTraces ?? 500,
      maxMutations: config?.maxMutations ?? 50,
      rollbackThreshold: config?.rollbackThreshold ?? 0.1,
    }
    this.state = { traces: [], mutations: [], generation: 0 }
  }

  /** Record an execution trace */
  recordTrace(trace: Omit<Trace, 'timestamp'>): void {
    this.state.traces.push({ ...trace, timestamp: new Date().toISOString() })
    if (this.state.traces.length > this.config.maxTraces) {
      this.state.traces = this.state.traces.slice(-this.config.maxTraces)
    }
  }

  /**
   * Attempt to evolve a prompt for the given agent.
   * Analyzes traces and generates a mutation if patterns are found.
   * Returns the mutation, or null if no evolution is warranted.
   */
  evolve(agent: string): Mutation | null {
    const agentTraces = this.state.traces.filter(t => t.agent === agent)
    if (agentTraces.length < this.config.threshold) return null

    // Calculate current average score
    const avgScore = agentTraces.reduce((s, t) => s + t.score, 0) / agentTraces.length

    // Try each mutation rule
    for (const rule of MUTATION_RULES) {
      if (rule.check(agentTraces)) {
        const text = rule.generate(agentTraces)
        if (!text) continue

        // Don't duplicate existing mutations
        if (this.state.mutations.some(m => m.agent === agent && m.text === text && !m.rolledBack)) {
          continue
        }

        const mutation: Mutation = {
          agent,
          text,
          reason: rule.name,
          scoreBefore: Math.round(avgScore * 1000) / 1000,
          scoreAfter: 0,
          appliedAt: new Date().toISOString(),
          rolledBack: false,
        }

        this.state.mutations.push(mutation)
        this.state.generation++

        if (this.state.mutations.length > this.config.maxMutations) {
          this.state.mutations = this.state.mutations.slice(-this.config.maxMutations)
        }

        return mutation
      }
    }

    return null
  }

  /**
   * Check if the latest mutation for an agent should be rolled back.
   * Call this after enough traces have been collected post-mutation.
   */
  checkRollback(agent: string): Mutation | null {
    const latest = [...this.state.mutations]
      .reverse()
      .find(m => m.agent === agent && !m.rolledBack)

    if (!latest) return null

    // Get traces after the mutation
    const postTraces = this.state.traces.filter(
      t => t.agent === agent && t.timestamp > latest.appliedAt
    )

    if (postTraces.length < 10) return null // Not enough data

    // Use success rate as signal (more reliable than eval scores)
    const successRate = postTraces.filter(t => t.success).length / postTraces.length
    const priorTraces = this.state.traces.filter(
      t => t.agent === agent && t.timestamp <= latest.appliedAt
    ).slice(-20)
    const priorSuccessRate = priorTraces.length > 0
      ? priorTraces.filter(t => t.success).length / priorTraces.length
      : 0.5

    latest.scoreAfter = Math.round(successRate * 1000) / 1000

    if (priorSuccessRate - successRate > this.config.rollbackThreshold) {
      latest.rolledBack = true
      return latest
    }

    return null
  }

  /** Get all active (non-rolled-back) mutations for an agent */
  getActiveMutations(agent: string): Mutation[] {
    return this.state.mutations.filter(m => m.agent === agent && !m.rolledBack)
  }

  /** Get the prompt amendment text for an agent (all active mutations combined) */
  getAmendment(agent: string): string {
    const active = this.getActiveMutations(agent)
    if (active.length === 0) return ''
    return '\n\n--- Evolved Amendments ---\n' + active.map(m => `- ${m.text}`).join('\n')
  }

  /** Get current generation */
  getGeneration(): number {
    return this.state.generation
  }

  // ── Persistence ──

  toJSON(): string { return JSON.stringify(this.state, null, 2) }
  fromJSON(json: string): void { this.state = JSON.parse(json) as EvolverState }

  save(path: string): void {
    const { writeFileSync, mkdirSync } = require('fs') as typeof import('fs')
    const { dirname } = require('path') as typeof import('path')
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, this.toJSON())
  }

  load(path: string): void {
    const { readFileSync, existsSync } = require('fs') as typeof import('fs')
    if (existsSync(path)) this.fromJSON(readFileSync(path, 'utf-8'))
  }

  /** Human-readable summary */
  summary(): string {
    const agents = [...new Set(this.state.traces.map(t => t.agent))]
    const lines = [
      'Prompt Evolver',
      '═'.repeat(40),
      `Generation: ${this.state.generation}`,
      `Traces: ${this.state.traces.length}`,
      `Mutations: ${this.state.mutations.length} (${this.state.mutations.filter(m => m.rolledBack).length} rolled back)`,
      '',
    ]

    for (const agent of agents) {
      const traces = this.state.traces.filter(t => t.agent === agent)
      const mutations = this.getActiveMutations(agent)
      const successRate = traces.filter(t => t.success).length / traces.length
      lines.push(`  ${agent}: ${traces.length} traces, ${(successRate * 100).toFixed(0)}% success, ${mutations.length} active mutations`)
    }

    return lines.join('\n')
  }
}
