/**
 * kbot tool definitions wrapping the Anthropic Managed Agents client.
 *
 * Six tools mirror the client surface: create / turn / list / close /
 * memory_read / memory_write. Each uses the canonical ToolDefinition shape
 * from ./index.js.
 *
 * Wiring into the global tool registry happens elsewhere (tools/index.ts).
 * This file only exports the definitions so workspace-agents.ts can pick
 * them up when ANTHROPIC_API_KEY is set.
 *
 * SPEC: best-effort, refine when official docs published.
 */
import type { ToolDefinition } from './index.js';
export declare const anthropicManagedAgentCreate: ToolDefinition;
export declare const anthropicManagedAgentTurn: ToolDefinition;
export declare const anthropicManagedAgentList: ToolDefinition;
export declare const anthropicManagedAgentClose: ToolDefinition;
export declare const anthropicManagedAgentMemoryRead: ToolDefinition;
export declare const anthropicManagedAgentMemoryWrite: ToolDefinition;
export declare const anthropicManagedAgentTools: ToolDefinition[];
//# sourceMappingURL=anthropic-managed-agents-tools.d.ts.map