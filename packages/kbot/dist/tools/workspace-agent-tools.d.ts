/**
 * Workspace Agent kbot tool definitions.
 *
 * NOT registered in tools/index.ts. Wire up via `registerWorkspaceAgentTools()`
 * from a higher-level bootstrap once the feature is shipped.
 *
 * Each tool returns a string (the kbot tool contract). State persists via
 * the WorkspaceAgent class — file at <root>/<id>.json.
 */
import type { ToolDefinition } from './index.js';
export declare const workspaceAgentCreate: ToolDefinition;
export declare const workspaceAgentStart: ToolDefinition;
export declare const workspaceAgentResume: ToolDefinition;
export declare const workspaceAgentStatus: ToolDefinition;
export declare const workspaceAgentStop: ToolDefinition;
export declare const workspaceAgentList: ToolDefinition;
/** Convenience array — caller can iterate to register all six. */
export declare const workspaceAgentTools: ToolDefinition[];
//# sourceMappingURL=workspace-agent-tools.d.ts.map