import { invokeMCPTool } from '../SupabaseClient'
import { registerTool } from './registry'
import type { Tool } from './types'

/**
 * Dynamically registers an external MCP tool into the local Kernel tool registry.
 * This allows Claude to see the MCP tool as if it were a local function.
 */
export function registerExternalMCPTool(
    serverUrl: string,
    mcpToolName: string,
    description: string,
    parameters: Record<string, unknown>,
    allowedAgents: string[] = []
): void {
    const kernelTool: Tool = {
        name: `mcp_\${mcpToolName.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
        description: `[External MCP Tool] \${description}`,
        parameters,
        agents: allowedAgents,
        execute: async (args: Record<string, unknown>) => {
            try {
                const result = await invokeMCPTool(serverUrl, mcpToolName, args)
                return {
                    success: true,
                    data: result
                }
            } catch (err) {
                return {
                    success: false,
                    data: null,
                    error: err instanceof Error ? err.message : String(err)
                }
            }
        }
    }

    registerTool(kernelTool)
}
