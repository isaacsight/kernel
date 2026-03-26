import { type BridgeStatus } from '../ide/bridge.js';
export interface PluginContext {
    /** Working directory for kbot to operate in */
    cwd?: string;
    /** Default agent to use */
    agent?: string;
    /** API tier override */
    tier?: string;
    /** Skip starting the MCP server (e.g., if already running) */
    skipMcp?: boolean;
}
export interface SkillDefinition {
    /** Skill name (matches manifest) */
    name: string;
    /** Human-readable description */
    description: string;
    /** Path to the skill markdown file */
    file: string;
    /** The kbot CLI command this skill maps to */
    command: string;
}
export interface PluginManifest {
    name: string;
    version: string;
    description: string;
    homepage: string;
    repository: string;
    license: string;
    mcpServers: Record<string, {
        command: string;
        args: string[];
        env: Record<string, string>;
    }>;
    channels: Record<string, {
        command: string;
        args: string[];
    }>;
    skills: Array<{
        name: string;
        description: string;
        file: string;
    }>;
}
/**
 * Load and return the plugin manifest.
 */
export declare function getManifest(): PluginManifest;
/**
 * Skill definitions mapping Claude Code slash commands to kbot CLI commands.
 */
export declare const skills: SkillDefinition[];
/**
 * Load the markdown content of a skill file.
 */
export declare function loadSkillContent(skillName: string): string | null;
/**
 * Activate the kbot plugin.
 *
 * Initializes the IDE bridge (registers tools, gathers project context)
 * and optionally starts the MCP server for tool communication.
 */
export declare function activate(context?: PluginContext): Promise<BridgeStatus>;
/**
 * Deactivate the kbot plugin. Cleans up resources.
 */
export declare function deactivate(): void;
/**
 * Check if the plugin is currently activated.
 */
export declare function isActivated(): boolean;
//# sourceMappingURL=index.d.ts.map