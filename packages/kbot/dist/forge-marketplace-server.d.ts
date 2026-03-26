import type { Server } from 'node:http';
export interface ForgeServerTool {
    /** Tool name (snake_case) */
    name: string;
    /** Human-readable description */
    description: string;
    /** Tool implementation code */
    code: string;
    /** Author username or anonymous */
    author: string;
    /** Semver version */
    version: string;
    /** ISO timestamp of creation */
    created: string;
    /** ISO timestamp of last update */
    updated: string;
    /** Categorization tags */
    tags: string[];
}
/** Start the Forge Marketplace HTTP server.
 *  Returns the running server instance. */
export declare function startForgeServer(port?: number): Server;
//# sourceMappingURL=forge-marketplace-server.d.ts.map