// K:BOT Task Ledger — Dual-ledger orchestration for autonomous planning
//
// Implements the Magentic-One / AutoGen dual-ledger pattern:
//   1. TASK LEDGER — Accumulated facts, hypotheses, and the current plan
//   2. PROGRESS LEDGER — Per-step self-reflection and execution telemetry
//
// The orchestrator maintains both ledgers throughout task execution.
// After each step, the progress ledger is updated with results, cost,
// and tool usage. The task ledger accumulates facts discovered along
// the way and tracks hypotheses that need verification.
//
// shouldReplan() triggers replanning when:
//   - 2+ consecutive steps fail
//   - Total cost exceeds $0.50
//   - Any step used more than 3 tool loops
//
// toContext() produces a compact ~500 token summary for LLM context,
// keeping the orchestrator aware of progress without blowing up tokens.

// ── Types ──

export interface PlanStep {
  index: number
  description: string
  /** Which specialist agent to route this step to */
  agent?: string
  /** Expected tools this step will need */
  tools?: string[]
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped'
  /** Step indices this step depends on */
  dependsOn?: number[]
}

export interface StepProgress {
  stepIndex: number
  startedAt: string
  completedAt?: string
  result: 'success' | 'failure' | 'partial'
  /** Brief summary of what happened */
  output?: string
  /** Error message if failed */
  error?: string
  toolsUsed: string[]
  tokensUsed: number
  costUsd: number
}

export interface StepResult {
  result: 'success' | 'failure' | 'partial'
  output?: string
  error?: string
  toolsUsed: string[]
  tokensUsed: number
  costUsd: number
}

// ── Constants ──

/** Max cost in USD before triggering a replan */
const COST_THRESHOLD = 0.50

/** Max tool loops per step before triggering a replan */
const MAX_TOOL_LOOPS = 3

/** Max consecutive failures before triggering a replan */
const MAX_CONSECUTIVE_FAILURES = 2

/** Target token budget for the compact context representation */
const CONTEXT_MAX_CHARS = 2000 // ~500 tokens at 4 chars/token

// ── TaskLedger ──

export class TaskLedger {
  // Task Ledger — accumulated facts and plan
  facts: string[] = []
  guesses: string[] = []
  plan: PlanStep[] = []

  // Progress Ledger — per-step self-reflection
  progress: StepProgress[] = []

  /** Add a verified fact discovered during execution */
  addFact(fact: string): void {
    const trimmed = fact.trim()
    if (trimmed && !this.facts.includes(trimmed)) {
      this.facts.push(trimmed)
    }
  }

  /** Add a hypothesis that needs verification */
  addGuess(guess: string): void {
    const trimmed = guess.trim()
    if (trimmed && !this.guesses.includes(trimmed)) {
      this.guesses.push(trimmed)
    }
  }

  /** Set or replace the current plan */
  setPlan(steps: PlanStep[]): void {
    this.plan = steps.map((step, i) => ({
      ...step,
      index: step.index ?? i,
      status: step.status ?? 'pending',
    }))
  }

  /** Update a step with its execution result */
  updateStep(stepIndex: number, result: StepResult): void {
    const step = this.plan.find(s => s.index === stepIndex)
    if (!step) return

    // Update step status based on result
    step.status = result.result === 'success' ? 'completed'
      : result.result === 'failure' ? 'failed'
      : 'in_progress' // partial stays in_progress

    // Find existing progress entry or create new one
    let entry = this.progress.find(p => p.stepIndex === stepIndex)
    if (entry) {
      // Update existing entry (step was already started)
      entry.result = result.result
      entry.output = result.output
      entry.error = result.error
      entry.toolsUsed = [...new Set([...entry.toolsUsed, ...result.toolsUsed])]
      entry.tokensUsed += result.tokensUsed
      entry.costUsd += result.costUsd
      if (result.result !== 'partial') {
        entry.completedAt = new Date().toISOString()
      }
    } else {
      // Create new progress entry
      const now = new Date().toISOString()
      entry = {
        stepIndex,
        startedAt: now,
        completedAt: result.result !== 'partial' ? now : undefined,
        result: result.result,
        output: result.output,
        error: result.error,
        toolsUsed: [...result.toolsUsed],
        tokensUsed: result.tokensUsed,
        costUsd: result.costUsd,
      }
      this.progress.push(entry)
    }
  }

  /** Generate a human-readable progress assessment */
  getProgressSummary(): string {
    const total = this.plan.length
    const completed = this.plan.filter(s => s.status === 'completed').length
    const failed = this.plan.filter(s => s.status === 'failed').length
    const inProgress = this.plan.filter(s => s.status === 'in_progress').length
    const pending = this.plan.filter(s => s.status === 'pending').length
    const skipped = this.plan.filter(s => s.status === 'skipped').length

    const totalCost = this.progress.reduce((sum, p) => sum + p.costUsd, 0)
    const totalTokens = this.progress.reduce((sum, p) => sum + p.tokensUsed, 0)

    const lines: string[] = [
      `Progress: ${completed}/${total} steps completed`,
    ]

    if (failed > 0) lines.push(`  ${failed} failed`)
    if (inProgress > 0) lines.push(`  ${inProgress} in progress`)
    if (pending > 0) lines.push(`  ${pending} pending`)
    if (skipped > 0) lines.push(`  ${skipped} skipped`)

    lines.push(`Cost: $${totalCost.toFixed(4)} | Tokens: ${totalTokens}`)

    if (this.facts.length > 0) {
      lines.push(`Facts discovered: ${this.facts.length}`)
    }
    if (this.guesses.length > 0) {
      lines.push(`Hypotheses pending: ${this.guesses.length}`)
    }

    // Recent errors
    const recentErrors = this.progress
      .filter(p => p.error)
      .slice(-3)
    if (recentErrors.length > 0) {
      lines.push('Recent errors:')
      for (const p of recentErrors) {
        const stepDesc = this.plan.find(s => s.index === p.stepIndex)?.description || `Step ${p.stepIndex}`
        lines.push(`  - ${stepDesc}: ${p.error}`)
      }
    }

    return lines.join('\n')
  }

  /**
   * Should we replan?
   * Returns true if:
   *   - 2+ consecutive steps failed
   *   - Total cost exceeds $0.50
   *   - Any step used more than 3 tool loops (inferred from toolsUsed count)
   */
  shouldReplan(): boolean {
    // Check total cost
    const totalCost = this.progress.reduce((sum, p) => sum + p.costUsd, 0)
    if (totalCost > COST_THRESHOLD) return true

    // Check for excessive tool usage on any single step
    for (const entry of this.progress) {
      if (entry.toolsUsed.length > MAX_TOOL_LOOPS) return true
    }

    // Check for consecutive failures
    // Sort progress by step index to check adjacency
    const sorted = [...this.progress]
      .filter(p => p.result === 'failure')
      .sort((a, b) => a.stepIndex - b.stepIndex)

    if (sorted.length >= MAX_CONSECUTIVE_FAILURES) {
      // Check if any pair of failures are on consecutive step indices
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].stepIndex === sorted[i - 1].stepIndex + 1) {
          return true
        }
      }
    }

    return false
  }

  /**
   * Compact representation for LLM context (~500 tokens max).
   *
   * Format:
   *   TASK LEDGER:
   *   Facts: [N known] fact1. fact2. fact3.
   *   Plan: 1. checkmark step  2. arrow step  3. circle step
   *   Progress: Step 1 completed (2 tools, 0.3s). Step 2 in progress.
   */
  toContext(): string {
    const parts: string[] = ['TASK LEDGER:']

    // Facts (truncate to fit budget)
    if (this.facts.length > 0) {
      const factStr = this.facts.slice(-5).join('. ')
      parts.push(`Facts: [${this.facts.length} known] ${factStr}`)
    }

    // Guesses
    if (this.guesses.length > 0) {
      const guessStr = this.guesses.slice(-3).join('. ')
      parts.push(`Hypotheses: [${this.guesses.length}] ${guessStr}`)
    }

    // Plan — compact one-liner with status icons
    if (this.plan.length > 0) {
      const stepStrs = this.plan.map(step => {
        const icon = statusIcon(step.status)
        const agent = step.agent ? ` [${step.agent}]` : ''
        // Truncate long descriptions
        const desc = step.description.length > 40
          ? step.description.slice(0, 37) + '...'
          : step.description
        return `${step.index + 1}. ${icon} ${desc}${agent}`
      })
      parts.push(`Plan: ${stepStrs.join('  ')}`)
    }

    // Progress — brief per-step summaries
    if (this.progress.length > 0) {
      const progressStrs = this.progress.slice(-5).map(p => {
        const toolCount = p.toolsUsed.length
        const duration = p.completedAt
          ? formatDuration(p.startedAt, p.completedAt)
          : 'ongoing'
        const status = p.result === 'success' ? 'completed'
          : p.result === 'failure' ? 'FAILED'
          : 'partial'
        const err = p.error ? ` — ${p.error.slice(0, 40)}` : ''
        return `Step ${p.stepIndex + 1} ${status} (${toolCount} tools, ${duration})${err}`
      })
      parts.push(`Progress: ${progressStrs.join('. ')}.`)
    }

    // Cost summary
    const totalCost = this.progress.reduce((sum, p) => sum + p.costUsd, 0)
    if (totalCost > 0) {
      parts.push(`Cost: $${totalCost.toFixed(4)}`)
    }

    // Replan warning
    if (this.shouldReplan()) {
      parts.push('WARNING: Replan recommended.')
    }

    // Truncate if over budget
    let result = parts.join('\n')
    if (result.length > CONTEXT_MAX_CHARS) {
      result = result.slice(0, CONTEXT_MAX_CHARS - 3) + '...'
    }

    return result
  }

  /** Serialize to JSON string for session persistence */
  toJSON(): string {
    return JSON.stringify({
      facts: this.facts,
      guesses: this.guesses,
      plan: this.plan,
      progress: this.progress,
    })
  }

  /** Deserialize from JSON string */
  static fromJSON(json: string): TaskLedger {
    const ledger = new TaskLedger()
    try {
      const data = JSON.parse(json)
      ledger.facts = Array.isArray(data.facts) ? data.facts : []
      ledger.guesses = Array.isArray(data.guesses) ? data.guesses : []
      ledger.plan = Array.isArray(data.plan) ? data.plan : []
      ledger.progress = Array.isArray(data.progress) ? data.progress : []
    } catch {
      // Return empty ledger on invalid JSON
    }
    return ledger
  }
}

// ── Helpers ──

/** Map step status to a compact icon */
function statusIcon(status: PlanStep['status']): string {
  switch (status) {
    case 'completed': return '\u2713'
    case 'in_progress': return '\u2192'
    case 'failed': return '\u2717'
    case 'skipped': return '\u2014'
    case 'pending': return '\u25CB'
    default: return '\u00B7'
  }
}

/** Format duration between two ISO timestamps */
function formatDuration(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60_000).toFixed(1)}m`
}
