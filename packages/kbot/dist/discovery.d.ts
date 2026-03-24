export interface DiscoveryConfig {
    /** Project name (e.g., "kbot", "my-api") */
    projectName: string;
    /** One-line description */
    projectDescription: string;
    /** Topics kbot should look for (e.g., ["AI agent", "terminal tool", "local LLM"]) */
    topics: string[];
    /** HN username (for posting) */
    hnUsername?: string;
    /** HN cookie string (for posting) */
    hnCookie?: string;
    /** GitHub token (for commenting on issues) — uses gh CLI if available */
    githubToken?: string;
    /** Max posts per cycle */
    maxPostsPerCycle: number;
    /** Poll interval in minutes */
    pollIntervalMinutes: number;
    /** Dry run — find + draft but don't post */
    dryRun: boolean;
    /** Ollama model for analysis */
    ollamaModel: string;
    /** Ollama URL */
    ollamaUrl: string;
}
export interface Opportunity {
    source: 'hn' | 'github' | 'reddit';
    title: string;
    url: string;
    snippet: string;
    foundAt: string;
}
export interface PostRecord {
    timestamp: string;
    url: string;
    title: string;
    comment: string;
    platform: string;
    success: boolean;
    error?: string;
}
export interface DiscoveryState {
    totalScans: number;
    totalFound: number;
    totalPosted: number;
    totalSkipped: number;
    lastScan: string;
    posts: PostRecord[];
}
export declare function loadConfig(): DiscoveryConfig | null;
export declare function saveConfig(config: DiscoveryConfig): void;
export declare function runDiscoveryCycle(config: DiscoveryConfig): Promise<{
    found: number;
    posted: number;
    skipped: number;
}>;
export declare function getDiscoveryState(): DiscoveryState;
export declare function getRecentLog(lines?: number): string;
export interface DiscoveredTool {
    name: string;
    source: 'npm' | 'github' | 'mcp';
    description: string;
    url: string;
    relevance: string;
    foundAt: string;
}
export interface ProposedAgent {
    id: string;
    name: string;
    reason: string;
    systemPrompt: string;
    proposedAt: string;
}
export interface AcademicPaper {
    title: string;
    authors: string;
    abstract: string;
    url: string;
    relevance: string;
    publishedAt: string;
    foundAt: string;
}
export declare function runExtendedDiscovery(config: DiscoveryConfig): Promise<{
    tools: number;
    agents: number;
    papers: number;
}>;
export declare function getDiscoveredTools(): DiscoveredTool[];
export declare function getProposedAgents(): ProposedAgent[];
export declare function getDiscoveredPapers(): AcademicPaper[];
//# sourceMappingURL=discovery.d.ts.map