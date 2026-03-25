/** Parameter definition for a forged tool */
export interface ToolParameter {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    description: string;
    required?: boolean;
    default?: unknown;
}
/** Tool definition — everything needed to create a tool at runtime */
export interface ToolDefinition {
    name: string;
    description: string;
    parameters: Record<string, ToolParameter>;
    /** The actual implementation */
    implementation: (args: Record<string, unknown>) => Promise<string>;
    /** Optional timeout in ms (default: 30000) */
    timeout?: number;
    /** Optional tags for categorization */
    tags?: string[];
    /** Who created this tool */
    createdBy?: string;
    /** When this tool was created */
    createdAt?: string;
}
/** Result of a tool execution */
export interface ToolResult {
    name: string;
    result: string;
    error?: string;
    durationMs: number;
}
/** Tool execution metrics */
export interface ToolMetrics {
    name: string;
    calls: number;
    errors: number;
    totalDurationMs: number;
    avgDurationMs: number;
    lastCalled: string;
}
/** Serializable tool definition (without the implementation function) */
export interface ToolManifest {
    name: string;
    description: string;
    parameters: Record<string, ToolParameter>;
    tags: string[];
    createdBy: string;
    createdAt: string;
    metrics: ToolMetrics;
}
/** Pre-built implementation patterns for common tool types */
export declare const TEMPLATES: {
    /** Tool that runs a shell command */
    shell: (command: string) => (args: Record<string, unknown>) => Promise<string>;
    /** Tool that reads a file and transforms it */
    fileRead: (transform?: (content: string) => string) => (args: Record<string, unknown>) => Promise<string>;
    /** Tool that fetches a URL */
    fetch: (options?: {
        headers?: Record<string, string>;
    }) => (args: Record<string, unknown>) => Promise<string>;
    /** Tool that does a JSON API call */
    jsonApi: (baseUrl: string) => (args: Record<string, unknown>) => Promise<string>;
    /** Tool that computes something from input */
    compute: (fn: (input: string) => string) => (args: Record<string, unknown>) => Promise<string>;
};
export declare class ToolForge {
    private tools;
    private metrics;
    /**
     * Create and register a new tool.
     * Throws if a tool with the same name already exists (use replace to overwrite).
     */
    create(def: ToolDefinition): void;
    /** Replace an existing tool or create a new one */
    replace(def: ToolDefinition): void;
    /** Remove a tool */
    remove(name: string): boolean;
    /** Check if a tool exists */
    has(name: string): boolean;
    /** Get a tool definition */
    get(name: string): ToolDefinition | undefined;
    /** List all tools */
    list(): ToolManifest[];
    /** List tools filtered by tag */
    listByTag(tag: string): ToolManifest[];
    /**
     * Execute a tool by name with arguments.
     * Validates required parameters, applies defaults, enforces timeout.
     */
    execute(name: string, args?: Record<string, unknown>): Promise<ToolResult>;
    private recordMetric;
    /** Get metrics for a tool or all tools */
    getMetrics(name?: string): ToolMetrics[];
    /**
     * Export tool definitions as JSON (without implementations).
     * Implementations are functions and can't be serialized — only metadata is saved.
     */
    toJSON(): string;
    /** Save manifests to a file */
    save(path: string): void;
    /** Create a shell-command tool in one line */
    createShell(name: string, description: string, command: string, params?: Record<string, ToolParameter>): void;
    /** Create a file-reading tool in one line */
    createFileReader(name: string, description: string, transform?: (content: string) => string): void;
    /** Create a URL-fetching tool in one line */
    createFetcher(name: string, description: string, headers?: Record<string, string>): void;
    /** Create a JSON API tool in one line */
    createApi(name: string, description: string, baseUrl: string): void;
    /** Get a human-readable summary */
    summary(): string;
}
//# sourceMappingURL=index.d.ts.map