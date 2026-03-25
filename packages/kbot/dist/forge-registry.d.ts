interface ForgedTool {
    name: string;
    description: string;
    code: string;
    author?: string;
    version: string;
    created: string;
    tags: string[];
}
export declare function listForgedTools(): ForgedTool[];
export declare function searchForgeRegistry(query: string): Promise<string>;
export declare function publishForgedTool(name: string): Promise<string>;
export declare function installForgedTool(name: string): Promise<string>;
export declare function runForge(action: string, arg?: string): Promise<void>;
export {};
//# sourceMappingURL=forge-registry.d.ts.map