// ─── Master Agent Types ──────────────────────────────────────
//
// Type definitions for the Master Agent orchestration layer.
// The Master Agent is the brain of Kernel — it decomposes user
// requests into multi-engine plans and executes them.

/** Describes what an engine can do — registered at startup */
export interface EngineCapability {
  id: string
  name: string
  description: string
  actions: EngineAction[]
  /** Whether this engine requires Pro subscription */
  requiresPro: boolean
}

/** A single action an engine can perform */
export interface EngineAction {
  name: string
  description: string
  /** JSON schema describing expected input */
  inputSchema: Record<string, unknown>
  /** Description of what this action produces */
  outputDescription: string
}

/** An ordered plan of engine calls with data flow */
export interface EnginePlan {
  id: string
  /** Original user message that triggered this plan */
  userMessage: string
  steps: EnginePlanStep[]
  /** Summary of what the plan will accomplish */
  reasoning: string
  createdAt: number
  completedAt?: number
  state: MasterAgentState
}

/** A single step in an engine plan */
export interface EnginePlanStep {
  id: string
  engineId: string
  action: string
  /** Input data — can reference outputs from previous steps via $step.<stepId> */
  input: Record<string, unknown>
  /** IDs of steps this step depends on */
  dependsOn: string[]
  /** Output after execution */
  output?: unknown
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  error?: string
  startedAt?: number
  completedAt?: number
}

/** Master Agent lifecycle states */
export type MasterAgentState =
  | 'idle'
  | 'planning'
  | 'executing'
  | 'awaiting_user'
  | 'completed'
  | 'failed'

/** Callbacks for streaming Master Agent progress to the UI */
export interface MasterAgentCallbacks {
  /** Called when the Master Agent creates a plan */
  onPlan: (plan: EnginePlan) => void
  /** Called when a plan step begins execution */
  onStepStart: (stepId: string, engineId: string, action: string) => void
  /** Called when a plan step completes */
  onStepComplete: (stepId: string, output: unknown) => void
  /** Called when streaming text chunks arrive */
  onChunk: (text: string) => void
  /** Called when the active engine changes */
  onEngineSwitch: (fromEngine: string | null, toEngine: string) => void
  /** Called when user approval is needed before proceeding */
  onApprovalNeeded: (stepId: string, reason: string) => void
  /** Called when a step fails */
  onStepFailed: (stepId: string, error: string) => void
}

/** Map of registered engines */
export type EngineRegistry = Map<string, RegisteredEngine>

/** A registered engine with its capability description and executor */
export interface RegisteredEngine {
  capability: EngineCapability
  /** Execute an action on this engine */
  execute: EngineExecutor
}

/** Function signature for executing an engine action */
export type EngineExecutor = (
  action: string,
  input: Record<string, unknown>,
  callbacks: EngineExecutorCallbacks,
) => Promise<unknown>

/** Callbacks passed to individual engine executors */
export interface EngineExecutorCallbacks {
  onChunk: (text: string) => void
  onProgress: (detail: string) => void
}

/** Tool definition for Claude tool-use API (derived from EngineCapability) */
export interface MasterTool {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, unknown>
    required: string[]
  }
}
