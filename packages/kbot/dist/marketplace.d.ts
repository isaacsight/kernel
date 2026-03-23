import { type MatrixAgent } from './matrix.js';
export interface RegistryEntry {
    name: string;
    description: string;
    version: string;
    author: string;
    npm?: string;
    github?: string;
    tags: string[];
    downloads?: number;
}
export interface InstalledPlugin {
    name: string;
    version: string;
    source: 'npm' | 'github' | 'local';
    installedAt: string;
    path: string;
}
export declare function searchPlugins(query: string): Promise<RegistryEntry[]>;
export declare function installPlugin(nameOrUrl: string): Promise<InstalledPlugin>;
export declare function uninstallPlugin(name: string): boolean;
export declare function listInstalled(): InstalledPlugin[];
export declare function updatePlugin(name: string): Promise<InstalledPlugin | null>;
export declare function formatRegistryResults(entries: RegistryEntry[]): string;
export declare function formatInstalledList(plugins: InstalledPlugin[]): string;
export interface MarketplaceAgentConfig {
    name: string;
    icon: string;
    color: string;
    systemPrompt: string;
}
export interface MarketplaceAgent {
    id: string;
    name: string;
    description: string;
    author: string;
    version: string;
    downloads: number;
    rating: number;
    tags: string[];
    agentConfig: MarketplaceAgentConfig;
    createdAt: string;
    updatedAt: string;
}
export interface MarketplaceManifest {
    agents: MarketplaceAgent[];
    lastUpdated: string;
}
export interface InstalledMarketplaceAgent {
    id: string;
    name: string;
    version: string;
    author: string;
    installedAt: string;
}
/** Fetch the agent marketplace registry. Uses cached version if within TTL, falls back to bundled agents. */
export declare function fetchRegistry(): Promise<MarketplaceManifest>;
/** Search marketplace agents by name, description, or tags. */
export declare function searchMarketplace(query: string): Promise<MarketplaceAgent[]>;
/** Install a marketplace agent into the local matrix. */
export declare function installAgent(agentId: string): Promise<MatrixAgent>;
/** Package a local matrix agent for publishing to the marketplace. Outputs JSON for the user to submit as a PR. */
export declare function publishAgent(agent: MatrixAgent, opts: {
    description: string;
    author: string;
    version?: string;
    tags?: string[];
}): {
    json: string;
    filePath: string;
};
/** List all marketplace agents installed locally. */
export declare function listInstalledAgents(): InstalledMarketplaceAgent[];
/** Uninstall a marketplace agent. Removes from local tracking and the matrix. */
export declare function uninstallAgent(agentId: string): boolean;
export declare function formatMarketplaceResults(agents: MarketplaceAgent[]): string;
export declare function formatInstalledAgentsList(agents: InstalledMarketplaceAgent[]): string;
/** Register marketplace tools so the agent can search and install marketplace agents during conversations. */
export declare function registerMarketplaceTools(): void;
//# sourceMappingURL=marketplace.d.ts.map