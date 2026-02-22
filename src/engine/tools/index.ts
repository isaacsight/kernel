// ─── Tool System — Public API ───────────────────────────────

export type { Tool, ToolResult, ToolCall, ToolCallResult } from './types'
export {
  registerTool,
  removeTool,
  getTool,
  getAllTools,
  getToolSchemas,
  getToolsForAgent,
  clearTools,
  getToolCount,
} from './registry'
export { runToolLoop } from './executor'
export type { ToolLoopCallbacks, ToolLoopResult } from './executor'
export { selectTools } from './toolRAG'
export { createApprovalGate, formatApprovalDescription } from './approval'
export type { ApprovalRequest, ApprovalCallback } from './approval'
export { registerMemoryTools } from './memory'
export { registerExternalMCPTool } from './mcp'export { registerMemoryTools } from './memory'
export { registerExternalMCPTool } from './mcp'
