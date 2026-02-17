// ─── Tool Registry ──────────────────────────────────────────
//
// Singleton registry for all tools available to the engine.
// Tools are registered at startup and can be scoped per agent.

import type { Tool } from './types'

const tools = new Map<string, Tool>()

export function registerTool(tool: Tool): void {
  if (tools.has(tool.name)) {
    console.warn(`[ToolRegistry] Overwriting existing tool: ${tool.name}`)
  }
  tools.set(tool.name, tool)
}

export function removeTool(name: string): boolean {
  return tools.delete(name)
}

export function getTool(name: string): Tool | undefined {
  return tools.get(name)
}

export function getAllTools(): Tool[] {
  return Array.from(tools.values())
}

export function getToolSchemas(): Record<string, unknown>[] {
  return getAllTools().map(t => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }))
}

export function getToolsForAgent(agentId: string): Tool[] {
  return getAllTools().filter(t =>
    !t.agents || t.agents.length === 0 || t.agents.includes(agentId)
  )
}

export function clearTools(): void {
  tools.clear()
}

export function getToolCount(): number {
  return tools.size
}
