import type { ToolDefinition } from '../../tools/index.js';
import type { AgentSdkTool } from './types.js';
export interface ToAgentSdkOptions {
    /** If true (default), kbot tool names are passed through unchanged. */
    preserveName?: boolean;
    /** Optional rename hook. Wins over preserveName. */
    renameTool?: (name: string) => string;
    /** If true, pass `additionalProperties: false` on the input schema. Default true. */
    strict?: boolean;
}
export declare function toAgentSdkTool(tool: ToolDefinition, opts?: ToAgentSdkOptions): AgentSdkTool;
export declare function toAgentSdkTools(tools: ToolDefinition[], opts?: ToAgentSdkOptions): AgentSdkTool[];
//# sourceMappingURL=to-agent-sdk.d.ts.map