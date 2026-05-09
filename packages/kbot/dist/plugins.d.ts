export interface LoadPluginsOptions {
    /** Override the plugin directory (used by tests). Defaults to ~/.kbot/plugins. */
    pluginsDir?: string;
    /** Override the integrity manifest path. Defaults to ~/.kbot/plugins.json. */
    manifestPath?: string;
    /**
     * Override the integrity-disabled flag. Defaults to reading
     * `process.env.KBOT_PLUGIN_INTEGRITY === 'off'`.
     */
    integrityDisabled?: boolean;
}
export interface PluginDefinition {
    name: string;
    description: string;
    parameters: Record<string, {
        type: string;
        description: string;
        required?: boolean;
        default?: unknown;
    }>;
    execute: (args: Record<string, unknown>) => Promise<string>;
    tier?: 'free' | 'pro' | 'growth' | 'enterprise';
}
export interface PluginManifest {
    name: string;
    file: string;
    toolCount: number;
    loadedAt: string;
    error?: string;
}
/** Ensure the plugins directory exists */
export declare function ensurePluginsDir(dir?: string): string;
/** Load all plugins from ~/.kbot/plugins/ */
export declare function loadPlugins(verbose?: boolean, opts?: LoadPluginsOptions): Promise<PluginManifest[]>;
/** List loaded plugins */
export declare function getLoadedPlugins(): PluginManifest[];
/** Format plugin list for display */
export declare function formatPluginList(): string;
/** Create a scaffold plugin file */
export declare function scaffoldPlugin(name: string): string;
//# sourceMappingURL=plugins.d.ts.map