import { tmpdir } from 'node:os';
export interface SetupOptions {
    force?: boolean;
    /** Override $HOME for testing. */
    home?: string;
    /** Override cwd for testing. */
    cwd?: string;
    /** Override the kbot binary path. */
    kbotBin?: string;
    /** Override the kbot-local-mcp script path. */
    kbotLocalMcpPath?: string;
    /** Override the bundled skill template path. */
    skillTemplatePath?: string;
}
export interface SetupResult {
    configPath: string;
    mcpAdded: string[];
    mcpAlreadyPresent: string[];
    skillCopied?: string;
    skillAlreadyPresent?: string;
}
export declare function setupClaudeCode(opts?: SetupOptions): SetupResult;
export declare function setupCursor(opts?: SetupOptions): SetupResult;
export declare function setupZed(opts?: SetupOptions): SetupResult;
export declare const _testHelpers: {
    tmpdir: typeof tmpdir;
};
//# sourceMappingURL=setup-editor.d.ts.map