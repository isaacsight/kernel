export interface McpAppResult {
    /** Standard text result (for non-visual contexts) */
    text: string;
    /** Interactive HTML/JS content */
    html?: string;
    /** App title for the window/tab */
    title?: string;
    /** Preferred width in pixels */
    width?: number;
    /** Preferred height in pixels */
    height?: number;
}
export interface McpAppConfig {
    /** How to render HTML: 'browser' opens in default browser, 'inline' returns for embedding, 'disabled' skips */
    renderMode: 'browser' | 'inline' | 'disabled';
    /** Max HTML size to render in bytes (default 1MB) */
    maxHtmlSize: number;
    /** Whether to sandbox iframes when rendering inline (default true) */
    sandbox: boolean;
}
/** Registry entry for tools that support MCP Apps output */
interface McpAppToolEntry {
    name: string;
    description: string;
    supportsApp: true;
}
/**
 * Determine whether a tool result contains MCP App HTML content.
 * Checks for the presence of a non-empty `html` field.
 */
export declare function isMcpAppResult(result: unknown): result is McpAppResult;
/**
 * Check if a plain text tool result contains embedded MCP App markers.
 * Tools that return a JSON-encoded McpAppResult as their text output
 * use the marker `<!--mcp-app-->` at the start of the html field.
 */
export declare function extractMcpAppFromText(text: string): McpAppResult | null;
/**
 * Load MCP Apps config from ~/.kbot/config.json, falling back to defaults.
 */
export declare function getAppConfig(): McpAppConfig;
/**
 * Render an MCP App result based on the config mode.
 *
 * - **browser**: Writes HTML to a temp file and opens it with the system browser.
 * - **inline**: Returns the HTML string wrapped with sandbox attributes for iframe embedding.
 * - **disabled**: Returns just the text, ignoring the HTML.
 *
 * Returns the text portion of the result (always), plus the rendered HTML path/content.
 */
export declare function renderMcpApp(result: McpAppResult, config?: McpAppConfig): Promise<{
    text: string;
    rendered?: string;
    path?: string;
}>;
/**
 * Create an MCP App result object. Use this in tool implementations
 * to return interactive HTML alongside a text summary.
 *
 * @param title   - Title for the app window/tab
 * @param html    - Interactive HTML/JS content
 * @param options - Optional text summary, width, height
 */
export declare function createMcpApp(title: string, html: string, options?: {
    text?: string;
    width?: number;
    height?: number;
}): McpAppResult;
/**
 * Mark a tool as MCP App-capable in the registry.
 */
export declare function registerAppCapableTool(name: string, description: string): void;
/**
 * Check if a tool is registered as MCP App-capable.
 */
export declare function isAppCapableTool(name: string): boolean;
/**
 * List all MCP App-capable tools.
 */
export declare function listAppCapableTools(): McpAppToolEntry[];
/**
 * Register the built-in tools that return MCP Apps:
 * - render_chart: Chart.js-based charts
 * - render_table: Interactive sortable tables
 * - render_diff:  Side-by-side diff viewer
 * - render_diagram: Mermaid diagram renderer
 */
export declare function registerMcpAppTools(): void;
export {};
//# sourceMappingURL=mcp-apps.d.ts.map