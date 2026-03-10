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
export { connectKbot, disconnectKbot, isKbotConnected, getKbotConnection, chatWithKbot } from './kbot'
export type { KbotConnection } from './kbot'
// memory and mcp tools are WIP — excluded from build
// export { registerMemoryTools } from './memory'
// export { registerExternalMCPTool } from './mcp'
