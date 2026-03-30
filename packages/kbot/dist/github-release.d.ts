export interface ReleaseConfig {
    /** GitHub repo owner (e.g., 'isaacsight') */
    owner: string;
    /** GitHub repo name (e.g., 'kernel') */
    repo: string;
    /** GitHub token — from env, config, or gh CLI auth */
    token?: string;
}
export interface ReleaseInfo {
    /** Git tag (e.g., 'v3.52.0') */
    tag: string;
    /** Release title (e.g., 'v3.52.0 — Feature Name') */
    name: string;
    /** Markdown release notes body */
    body: string;
    /** Create as draft release */
    draft: boolean;
    /** Mark as pre-release */
    prerelease: boolean;
}
export interface ReleaseResult {
    /** URL of the created release */
    url: string;
    /** GitHub release ID */
    id: number;
    /** Tag name */
    tag: string;
    /** Whether it was created as draft */
    draft: boolean;
}
/**
 * Categorize an array of commit subjects into labeled sections.
 */
export declare function categorizeCommits(commits: string[]): Record<string, string[]>;
/**
 * Format categorized commits into markdown release notes.
 */
export declare function formatReleaseNotes(categorized: Record<string, string[]>): string;
/**
 * Generate a full changelog between two tags/refs.
 * If no refs provided, auto-detects from the latest and previous tags.
 */
export declare function generateChangelog(fromTag?: string, toTag?: string): string;
/**
 * Create a GitHub release via the REST API.
 *
 * Generates a changelog, creates a git tag (if it doesn't exist),
 * and publishes a release on GitHub.
 */
export declare function createGitHubRelease(config: ReleaseConfig, info?: Partial<ReleaseInfo>): Promise<ReleaseResult>;
/**
 * CLI handler for `kbot release`.
 * Called from cli.ts command registration.
 */
export declare function runRelease(opts: {
    draft?: boolean;
    tag?: string;
    dryRun?: boolean;
    json?: boolean;
}): Promise<void>;
//# sourceMappingURL=github-release.d.ts.map