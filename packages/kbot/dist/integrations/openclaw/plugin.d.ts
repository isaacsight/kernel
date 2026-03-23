interface PluginApi {
    registerTool(tool: {
        name: string;
        description: string;
        parameters: Record<string, unknown>;
        execute: (id: string, params: Record<string, unknown>) => Promise<{
            content: Array<{
                type: string;
                text: string;
            }>;
        }>;
    }): void;
}
interface KbotConfig {
    port?: number;
    host?: string;
    agent?: string;
    token?: string;
}
export declare function register(api: PluginApi, config?: KbotConfig): void;
export {};
//# sourceMappingURL=plugin.d.ts.map