export interface Diagnostic {
    file: string;
    line: number;
    column: number;
    severity: 'error' | 'warning' | 'info' | 'hint';
    message: string;
    source?: string;
    code?: string | number;
}
export interface LspBridgeOptions {
    /** Timeout in ms for LSP response (default: 10000) */
    timeout?: number;
    /** Custom LSP server commands by language */
    servers?: Record<string, string[]>;
}
/**
 * Get diagnostics for a file by spawning the appropriate LSP server.
 *
 * This is a one-shot operation: spawn LSP, initialize, open file,
 * collect diagnostics, shut down. Not a persistent connection.
 */
export declare function getDiagnostics(filePath: string, options?: LspBridgeOptions): Promise<Diagnostic[]>;
/**
 * Format diagnostics as a human-readable string for the agent loop.
 */
export declare function formatDiagnostics(diagnostics: Diagnostic[]): string;
//# sourceMappingURL=lsp-bridge.d.ts.map