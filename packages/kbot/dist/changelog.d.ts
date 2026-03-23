export interface ChangelogOptions {
    /** Git ref to start from (default: last tag or last 20 commits) */
    since?: string;
    /** Output format — 'markdown' for release notes, 'terminal' for CLI display */
    format?: 'markdown' | 'terminal';
}
/**
 * Generate a changelog from git history.
 *
 * Groups commits by conventional commit prefix and formats them
 * as either markdown (for release notes / piping) or terminal
 * (colored output for the REPL).
 */
export declare function generateChangelog(options?: ChangelogOptions): string;
/**
 * Format a markdown changelog string for colored terminal output.
 * Use this to colorize changelog text that was already generated
 * in markdown format.
 */
export declare function formatChangelogTerminal(changelog: string): string;
//# sourceMappingURL=changelog.d.ts.map