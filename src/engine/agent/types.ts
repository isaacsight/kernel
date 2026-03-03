// ─── Agent Engine Types ─────────────────────────────────────
//
// Types for custom agent builder, conversations, and workflows.

export interface CustomAgent {
  id: string
  user_id: string
  name: string
  persona: string  // system prompt personality
  tools: string[]  // enabled engine IDs
  knowledge_ids: string[]  // knowledge base item IDs
  starters: string[]  // conversation starter suggestions
  icon: string  // emoji
  color: string  // hex color
  is_public: boolean
  install_count: number
  created_at: string
  updated_at: string
}

export interface AgentConversation {
  id: string
  agent_id: string
  user_id: string
  messages: AgentMessage[]
  created_at: string
}

export interface AgentMessage {
  role: 'user' | 'agent'
  content: string
  timestamp: number
}

export interface AgentWorkflow {
  id: string
  user_id: string
  name: string
  description: string
  steps: AgentWorkflowStep[]
  created_at: string
}

export interface AgentWorkflowStep {
  id: string
  agent_id: string
  action: string
  input_map: Record<string, string>  // maps step outputs to next step inputs
  order: number
}

export interface AgentWorkflowRun {
  id: string
  workflow_id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  step_results: Record<string, unknown>
  started_at: string
  completed_at?: string
}
