/**
 * Convert a session to readable Markdown format.
 */
export declare function exportToMarkdown(sessionId: string): string;
/**
 * Export a session as formatted JSON.
 */
export declare function exportToJSON(sessionId: string): string;
/**
 * Export a session as a standalone HTML page with embedded styling.
 */
export declare function exportToHTML(sessionId: string): string;
/**
 * Main export function. Converts a session to the specified format
 * and optionally writes it to disk.
 *
 * @returns The exported content as a string.
 */
export declare function exportSession(sessionId: string, format: 'md' | 'json' | 'html', outputPath?: string): string;
//# sourceMappingURL=export.d.ts.map