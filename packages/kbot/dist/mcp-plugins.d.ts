import { type ChildProcess } from 'node:child_process';
export interface McpPluginConfig {
    command: string;
    args?: string[];
    env?: Record<string, string>;
}
export interface PluginsJsonConfig {
    plugins: Record<string, McpPluginConfig>;
}
export interface PluginToolInfo {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
}
export type PluginHealth = 'starting' | 'healthy' | 'unhealthy' | 'stopped';
export interface PluginState {
    id: string;
    config: McpPluginConfig;
    source: 'plugins.json' | 'package.json';
    health: PluginHealth;
    process: ChildProcess | null;
    messageId: number;
    pending: Map<number, {
        resolve: (v: unknown) => void;
        reject: (e: Error) => void;
        timer: ReturnType<typeof setTimeout>;
    }>;
    buffer: string;
    tools: PluginToolInfo[];
    startedAt: string | null;
    error: string | null;
}
export interface PluginStatus {
    id: string;
    health: PluginHealth;
    tools: number;
    startedAt: string | null;
    error: string | null;
    source: 'plugins.json' | 'package.json';
}
/** Discover all configured MCP plugins from plugins.json and package.json sources */
export declare function discoverPlugins(): Map<string, {
    config: McpPluginConfig;
    source: 'plugins.json' | 'package.json';
}>;
/** Start a single plugin by ID. Spawns the process, performs MCP handshake, fetches tools. */
export declare function startPlugin(id: string): Promise<PluginState>;
/** Stop a single plugin gracefully */
export declare function stopPlugin(id: string): Promise<void>;
/** Start all discovered plugins */
export declare function startAllPlugins(): Promise<PluginStatus[]>;
/** Stop all running plugins */
export declare function stopAllPlugins(): Promise<void>;
/** Get tools exposed by a specific plugin */
export declare function getPluginTools(id: string): PluginToolInfo[];
/** Call a tool on a specific plugin */
export declare function callPluginTool(id: string, toolName: string, args?: Record<string, unknown>): Promise<string>;
/** Get health status of all plugins */
export declare function getPluginStatus(): PluginStatus[];
/** Register meta-tools for the agent to interact with MCP plugins */
export declare function registerMcpPluginTools(): void;
//# sourceMappingURL=mcp-plugins.d.ts.map