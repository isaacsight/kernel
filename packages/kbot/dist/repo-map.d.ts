export interface RepoMapOptions {
    maxDepth?: number;
    maxFiles?: number;
}
/** Generate a compact repo map for LLM context */
export declare function generateRepoMap(rootDir: string, options?: RepoMapOptions): Promise<string>;
/** Get repo map with 60s cache. Resolves git root from cwd. */
export declare function getRepoMapForContext(cwd?: string): Promise<string>;
//# sourceMappingURL=repo-map.d.ts.map