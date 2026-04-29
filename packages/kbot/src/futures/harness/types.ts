/**
 * Harness Evolution Loop — type definitions.
 *
 * Maps onto the formalism from "The Last Harness You'll Ever Build"
 * (Seong, Yin, Zhang — Sylph.AI, arXiv:2604.21003):
 *
 *   Agent = Model + Harness
 *   Harness = prompts + tools + orchestration + hooks + model config
 *
 *   Inner loop:  Worker(τ)        → Evaluator(τ) → EvolutionAgent(history) → H'
 *   Outer loop:  HarnessEvolution × N tasks → MetaEvolutionAgent(history) → Λ'
 *
 * This module is types-only. Runtime lives in evolution-loop.ts and
 * meta-evolution.ts. No imports from heavy modules so it can be loaded by
 * tools, tests, and remote runners cheaply.
 */

/** Identifier for a single task instance the worker is being optimized against. */
export interface Task {
  id: string
  /** Concrete instructions the worker reads. */
  instructions: string
  /** Verifiable success criteria — the evaluator's checklist. */
  acceptance: string[]
  /** Optional free-form metadata (domain, expected runtime, etc.). */
  meta?: Record<string, unknown>
}

/**
 * The harness — every piece of code/config that surrounds the model.
 * Kept as data so it can be diffed, persisted, and rewritten by EvolutionAgent.
 */
export interface Harness {
  /** Stable identifier; new id on every evolution step. */
  id: string
  systemPrompt: string
  /** Tool names the worker is allowed to call. */
  toolAllowlist: string[]
  /** Hooks/middleware applied around tool calls. */
  hooks: HookSpec[]
  /** Model routing — which model handles which subtask kind. */
  modelRouting: ModelRoute[]
  /** Loop hyperparameters: max iterations, parallelism, revert thresholds. */
  hyperparams: Hyperparams
}

export interface HookSpec {
  name: string
  /** When to fire: before tool call, after, on error, etc. */
  phase: 'pre-tool' | 'post-tool' | 'on-error' | 'pre-response'
  /** Free-form config; the runtime resolves to actual hook code. */
  config?: Record<string, unknown>
}

export interface ModelRoute {
  /** Pattern match on task kind / tool / phase. */
  match: string
  model: string
  temperature?: number
  maxTokens?: number
}

export interface Hyperparams {
  maxIterations: number
  /** Stop early if score >= this on successive iterations. */
  earlyStopScore?: number
  /** If a step regresses by more than this, revert to best. */
  revertThreshold?: number
}

/** Trace produced by Worker.execute() for the Evaluator to inspect. */
export interface ExecutionTrace {
  taskId: string
  harnessId: string
  steps: TraceStep[]
  finalState: Record<string, unknown>
  llmTimeMs: number
  toolTimeMs: number
}

export interface TraceStep {
  index: number
  phase: 'plan' | 'tool' | 'response' | 'observe'
  action: string
  output?: string
  error?: string
  durationMs: number
}

/** Evaluator output: pass/fail + score + diagnostic narrative. */
export interface EvaluationReport {
  taskId: string
  harnessId: string
  pass: boolean
  /** Two-tier score: pass yields 1.0, scaled by efficiency tiebreaker. */
  score: number
  /** Per-criterion verdict. Length matches Task.acceptance. */
  criteriaResults: CriterionResult[]
  /** Categorized failure modes for the Evolution Agent to act on. */
  failureModes: FailureMode[]
  /** Free-form diagnostic prose. */
  notes?: string
}

export interface CriterionResult {
  criterion: string
  passed: boolean
  evidence?: string
}

export type FailureModeKind =
  | 'incorrect-tool-usage'
  | 'reasoning-loop'
  | 'misinterpreted-state'
  | 'excessive-latency'
  | 'missing-capability'
  | 'hallucinated-state'
  | 'other'

export interface FailureMode {
  kind: FailureModeKind
  detail: string
}

/** One row in the evolution history. */
export interface EvolutionRecord {
  iteration: number
  harness: Harness
  trace: ExecutionTrace
  report: EvaluationReport
  verdict: 'improved' | 'regressed' | 'no-op'
}

/** Final result of a single inner-loop run. */
export interface EvolutionResult {
  taskId: string
  bestHarness: Harness
  bestScore: number
  history: EvolutionRecord[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent interfaces
// ─────────────────────────────────────────────────────────────────────────────

/** Worker = the agent under optimization, parameterized by harness. */
export interface Worker {
  execute(task: Task, harness: Harness): Promise<ExecutionTrace>
}

/** Evaluator = adversarial reviewer; produces EvaluationReport. */
export interface Evaluator {
  evaluate(trace: ExecutionTrace, task: Task): Promise<EvaluationReport>
}

/** EvolutionAgent = mutates the harness based on history. */
export interface EvolutionAgent {
  evolve(history: EvolutionRecord[], best: Harness): Promise<Harness>
}

/** Λ — the evolution protocol itself. */
export interface EvolutionProtocol {
  worker: Worker
  evaluator: Evaluator
  evolution: EvolutionAgent
  initialHarness: Harness
  hyperparams: Hyperparams
}

/** Outer-loop result. */
export interface MetaResult {
  bestProtocol: EvolutionProtocol
  bestMetaScore: number
  perTask: EvolutionResult[]
}
