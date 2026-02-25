// ─── Tool System Types ──────────────────────────────────────
//
// Foundation types for Kernel's tool infrastructure.
// Tools give agents the ability to act on the world, not just think.

export interface Tool {
  name: string
  description: string
  parameters: Record<string, unknown>  // JSON Schema
  execute: (args: Record<string, unknown>) => Promise<ToolResult>
  requiresApproval?: boolean           // For HITL gates (Phase 3)
  agents?: string[]                    // Which agents can use this (empty = all)
  keywords?: string[]                  // Trigger keywords for Tool RAG
  category?: 'search' | 'compute' | 'memory' | 'external'
}

export interface ToolResult {
  success: boolean
  data: unknown
  error?: string
}

export interface ToolCall {
  id: string
  name: string
  args: Record<string, unknown>
}

export interface ToolCallResult {
  id: string
  result: ToolResult
}
