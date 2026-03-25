export interface KbotProjectConfig {
    /** Detected project name */
    name: string;
    /** Detected language */
    language: string;
    /** Detected framework (if any) */
    framework?: string;
    /** Package manager */
    packageManager?: string;
    /** Preferred default agent */
    defaultAgent: string;
    /** Key files kbot should know about */
    keyFiles: string[];
    /** Custom commands detected from package.json/Makefile/etc */
    commands: Record<string, string>;
    /** Forged tools created during init */
    forgedTools: string[];
    /** File counts by extension */
    fileCounts: Record<string, number>;
    /** Total file count */
    totalFiles: number;
    /** README excerpt (first 500 chars) */
    readmeExcerpt?: string;
    /** When this config was generated */
    createdAt: string;
}
export declare function initProject(root: string): Promise<KbotProjectConfig>;
export declare function formatInitReport(config: KbotProjectConfig): string;
/**
 * Print the user-friendly init summary.
 * Format: "I detected a [framework] project with [N] files. I've configured [M] tools for your stack."
 */
export declare function formatInitSummary(config: KbotProjectConfig): string;
/**
 * runInit() — 60-second onboarding entry point.
 *
 * 1. Detects project type (package.json, Cargo.toml, pyproject.toml, go.mod, etc.)
 * 2. Detects framework (React, Next.js, Vue, Express, FastAPI, Django, Flask, Rails, etc.)
 * 3. Counts files by extension
 * 4. Reads README.md (first 500 chars)
 * 5. Creates .kbot/config.json with detected info
 * 6. Prints summary
 * 7. Suggests a first query
 */
export declare function runInit(root?: string): Promise<KbotProjectConfig>;
//# sourceMappingURL=init.d.ts.map