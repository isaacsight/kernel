import type { Command } from 'commander';
export interface PairOptions {
    /** Directory to watch (default: cwd) */
    path?: string;
    /** Only show errors, suppress suggestions */
    quiet?: boolean;
    /** Automatically apply safe fixes (unused imports, formatting) */
    autoFix?: boolean;
    /** Sound terminal bell on errors */
    bell?: boolean;
    /** Override which checks to run */
    checks?: PairChecks;
    /** Extra ignore patterns (globs) */
    ignorePatterns?: string[];
    /** Agent options for AI-powered suggestions */
    agentOptions?: {
        agent?: string;
        model?: string;
        tier?: string;
    };
}
export interface PairChecks {
    typeErrors?: boolean;
    lint?: boolean;
    missingTests?: boolean;
    imports?: boolean;
    security?: boolean;
    style?: boolean;
}
export interface PairSuggestion {
    type: 'error' | 'warning' | 'info' | 'fix';
    category: 'type' | 'lint' | 'test' | 'import' | 'security' | 'style' | 'ai';
    file: string;
    line?: number;
    message: string;
    fix?: string;
}
export interface PairConfig {
    checks: PairChecks;
    ignorePatterns: string[];
    autoFix: boolean;
    bell: boolean;
    quiet: boolean;
}
declare let sessionStats: {
    filesAnalyzed: number;
    suggestionsShown: number;
    fixesApplied: number;
    errorsFound: number;
};
export declare function startPairMode(options?: PairOptions): Promise<void>;
export declare function stopPairMode(): void;
/**
 * Check if pair mode is currently active.
 */
export declare function isPairActive(): boolean;
/**
 * Get current session stats.
 */
export declare function getPairStats(): typeof sessionStats;
/**
 * Request AI analysis for a specific file. Uses the kbot agent loop to
 * provide deeper suggestions: refactoring, architecture, patterns.
 *
 * This is called when the user explicitly requests it (not on every save).
 */
export declare function analyzeWithAgent(filePath: string, agentOptions?: {
    agent?: string;
    model?: string;
    tier?: string;
}): Promise<string>;
/**
 * Register the `kbot pair` command with the CLI program.
 *
 * Usage from cli.ts:
 *   import { registerPairCommand } from './pair.js'
 *   registerPairCommand(program)
 */
export declare function registerPairCommand(program: Command): void;
export {};
//# sourceMappingURL=pair.d.ts.map