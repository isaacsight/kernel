// ─── Autonomous Engine Types ─────────────────────────────────
//
// Type definitions for background agents, outcome tracking,
// and adaptive routing weights.

export interface BackgroundAgent {
  id: string
  user_id: string
  name: string
  description: string
  trigger: BackgroundTrigger
  agent_config: { persona: string; tools: string[] }
  enabled: boolean
  last_run_at: string | null
  run_count: number
  created_at: string
}

export type BackgroundTrigger =
  | { type: 'schedule'; cron: string }
  | { type: 'event'; event_name: string }
  | { type: 'condition'; check: string }

export interface BackgroundAgentRun {
  id: string
  agent_id: string
  status: 'running' | 'completed' | 'failed'
  output: string
  started_at: string
  completed_at: string | null
  duration_ms: number
}

export interface AgentOutcome {
  id: string
  agent_id: string
  intent_type: string
  quality_score: number
  user_signal: 'positive' | 'neutral' | 'negative'
  recorded_at: string
}

export interface RoutingWeights {
  agent_id: string
  intent_type: string
  weight: number
  sample_count: number
  last_updated: string
}

export type FeedbackSignal = 'continued' | 'rephrased' | 'abandoned' | 'positive' | 'negative'
