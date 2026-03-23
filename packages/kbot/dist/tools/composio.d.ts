import { type ToolDefinition } from './index.js';
export declare function registerComposioTools(): void;
/**
 * Fetch available actions for all connected Composio apps and return them
 * as kbot-compatible ToolDefinition objects. This allows the agent to see
 * Composio actions alongside built-in tools.
 *
 * Call this after registerComposioTools() to dynamically expand the toolset.
 */
export declare function getComposioTools(): Promise<ToolDefinition[]>;
//# sourceMappingURL=composio.d.ts.map