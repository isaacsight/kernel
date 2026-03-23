export interface KBotPluginTool {
    name: string;
    description: string;
    input_schema: Record<string, unknown>;
    execute: (args: Record<string, unknown>) => Promise<string>;
}
export interface KBotPluginHooks {
    beforeMessage?: (message: string) => string | Promise<string>;
    afterResponse?: (response: string) => string | Promise<string>;
    beforeToolCall?: (tool: string, args: Record<string, unknown>) => Record<string, unknown> | Promise<Record<string, unknown>>;
    afterToolCall?: (tool: string, result: string) => string | Promise<string>;
}
export interface KBotPluginCommand {
    name: string;
    description: string;
    execute: (args: string) => Promise<string>;
}
export interface KBotPlugin {
    name: string;
    version: string;
    description: string;
    author?: string;
    /** Tools this plugin provides */
    tools?: KBotPluginTool[];
    /** Hooks into the agent lifecycle */
    hooks?: KBotPluginHooks;
    /** Custom slash commands (e.g., "my-command" -> user types /my-command) */
    commands?: KBotPluginCommand[];
    /** Called when the plugin is loaded */
    activate?: () => Promise<void>;
    /** Called when the plugin is unloaded */
    deactivate?: () => Promise<void>;
}
export interface PluginConfig {
    enabled: string[];
    disabled: string[];
}
export interface SDKPluginManifest {
    name: string;
    version: string;
    description: string;
    author?: string;
    source: 'local' | 'npm';
    path: string;
    enabled: boolean;
    loaded: boolean;
    toolCount: number;
    commandCount: number;
    hasHooks: boolean;
    error?: string;
    loadedAt?: string;
}
/**
 * Load all installed and enabled SDK plugins.
 * Called at startup after the legacy plugins.ts loadPlugins() runs.
 */
export declare function loadPlugins(verbose?: boolean): Promise<SDKPluginManifest[]>;
/**
 * Scaffold a new plugin with a full project structure.
 * Creates ~/.kbot/plugins/<name>/ with index.ts and package.json.
 */
export declare function createPlugin(name: string): string;
/**
 * Enable a plugin by name.
 */
export declare function enablePlugin(name: string): string;
/**
 * Disable a plugin by name. Calls deactivate() if loaded.
 */
export declare function disablePlugin(name: string): Promise<string>;
/**
 * Install a plugin from npm or a git URL.
 */
export declare function installPlugin(source: string): string;
/**
 * Uninstall a plugin by name.
 */
export declare function uninstallPlugin(name: string): Promise<string>;
/**
 * List all discovered plugins with their status.
 */
export declare function listPlugins(): string;
/**
 * Run all registered beforeMessage hooks in sequence.
 * Returns the (possibly transformed) message.
 */
export declare function runBeforeMessageHooks(message: string): Promise<string>;
/**
 * Run all registered afterResponse hooks in sequence.
 * Returns the (possibly transformed) response.
 */
export declare function runAfterResponseHooks(response: string): Promise<string>;
/**
 * Run all registered beforeToolCall hooks in sequence.
 * Returns the (possibly modified) args.
 */
export declare function runBeforeToolCallHooks(tool: string, args: Record<string, unknown>): Promise<Record<string, unknown>>;
/**
 * Run all registered afterToolCall hooks in sequence.
 * Returns the (possibly transformed) result.
 */
export declare function runAfterToolCallHooks(tool: string, result: string): Promise<string>;
/**
 * Check if a slash command is provided by a plugin.
 */
export declare function hasPluginCommand(commandName: string): boolean;
/**
 * Execute a plugin slash command.
 */
export declare function executePluginCommand(commandName: string, args: string): Promise<string>;
/**
 * Get all registered plugin commands.
 */
export declare function getPluginCommands(): Array<{
    name: string;
    description: string;
    pluginName: string;
}>;
/**
 * Get a loaded plugin by name.
 */
export declare function getLoadedPlugin(name: string): KBotPlugin | undefined;
/**
 * Get all loaded SDK plugins.
 */
export declare function getLoadedSDKPlugins(): SDKPluginManifest[];
/**
 * Deactivate all loaded plugins (called on shutdown).
 */
export declare function deactivateAll(): Promise<void>;
/**
 * Register plugin management tools into the kbot tool registry.
 * These tools let the user manage plugins via natural language.
 */
export declare function registerPluginSDKTools(): void;
//# sourceMappingURL=plugin-sdk.d.ts.map