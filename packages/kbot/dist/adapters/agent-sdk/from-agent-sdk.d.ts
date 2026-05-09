import type { ToolDefinition } from '../../tools/index.js';
import type { AgentSdkExecutableTool, AgentSdkTool } from './types.js';
export interface FromAgentSdkOptions {
    /** kbot tier to assign to the imported tool. Default 'free'. */
    tier?: ToolDefinition['tier'];
    /** Custom timeout (ms). */
    timeout?: number;
    /** Max result size (bytes). */
    maxResultSize?: number;
    /**
     * Fallback executor when the source tool ships no handler. Useful when the
     * caller routes execution elsewhere (e.g., back through the Anthropic SDK).
     */
    fallbackExecutor?: (toolName: string, args: Record<string, unknown>) => Promise<string> | string;
}
/**
 * Convert a non-executable Agent SDK tool definition into a kbot ToolDefinition.
 * Because the source has no handler, an executor must be supplied via opts.fallbackExecutor
 * — otherwise the resulting tool will return a structured "no handler" error string when invoked.
 */
export declare function fromAgentSdkTool(tool: AgentSdkTool, opts?: FromAgentSdkOptions): ToolDefinition;
/**
 * Convert an executable Agent SDK tool (schema + handler) into a kbot ToolDefinition.
 * Preferred over fromAgentSdkTool() when the caller has the implementation in process.
 */
export declare function fromAgentSdkExecutableTool(tool: AgentSdkExecutableTool, opts?: Omit<FromAgentSdkOptions, 'fallbackExecutor'>): ToolDefinition;
export declare function fromAgentSdkTools(tools: AgentSdkTool[], opts?: FromAgentSdkOptions): ToolDefinition[];
//# sourceMappingURL=from-agent-sdk.d.ts.map