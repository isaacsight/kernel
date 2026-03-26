export type FindingSeverity = 'info' | 'warn' | 'critical';
export type FindingCategory = 'todo-removal' | 'typo' | 'missing-type' | 'dead-code' | 'complexity' | 'duplicate-pattern' | 'missing-docs' | 'dependency-issue' | 'style-inconsistency' | 'other';
export interface ContributorFinding {
    category: FindingCategory;
    severity: FindingSeverity;
    title: string;
    description: string;
    file: string;
    line?: number;
    /** The original code snippet */
    original?: string;
    /** Whether this is a simple, auto-fixable issue */
    isSimpleFix: boolean;
}
export interface ProposedFix {
    finding: ContributorFinding;
    description: string;
    /** The diff-like description of the change */
    changeSummary: string;
    /** Estimated review time in minutes */
    estimatedReviewMinutes: number;
}
export interface ContributionReport {
    repo: string;
    clonedAt: string;
    analyzedAt: string;
    /** Detected primary language */
    language: string;
    /** Detected framework (if any) */
    framework: string;
    /** Total files scanned */
    filesScanned: number;
    findings: ContributorFinding[];
    proposed_fixes: ProposedFix[];
    estimated_impact: {
        totalFindings: number;
        simpleFixes: number;
        complexFindings: number;
        categories: Record<string, number>;
    };
    /** Bootstrap-style project health summary */
    projectHealth: {
        hasReadme: boolean;
        hasLicense: boolean;
        hasTests: boolean;
        hasCI: boolean;
        hasContributing: boolean;
        hasTypeConfig: boolean;
    };
}
export interface ContributorOptions {
    /** Maximum files to scan (default: 500) */
    maxFiles?: number;
    /** Minimum severity to include (default: 'info') */
    minSeverity?: FindingSeverity;
    /** Skip cloning if a local path is provided */
    localPath?: string;
    /** Keep the cloned repo after analysis (default: false) */
    keepClone?: boolean;
}
export interface GoodFirstIssue {
    number: number;
    title: string;
    url: string;
    labels: string[];
    created_at: string;
    author: string;
    comments: number;
    body_preview: string;
}
/**
 * Point at any GitHub repo, clone it, analyze it, and generate a contribution
 * report with findings and proposed fixes.
 *
 * v1 is analysis-only — no automatic PR creation. The report gives you
 * everything needed to make targeted contributions.
 */
export declare function runAutonomousContributor(repoUrl: string, options?: ContributorOptions): Promise<ContributionReport>;
/**
 * Fetch open issues labeled "good first issue" or "help wanted" from a GitHub repo.
 * Uses the public GitHub API (no auth required for public repos).
 */
export declare function listGoodFirstIssues(repoUrl: string): Promise<GoodFirstIssue[]>;
/**
 * Format a ContributionReport as a readable markdown string.
 */
export declare function formatContributionReport(report: ContributionReport): string;
//# sourceMappingURL=autonomous-contributor.d.ts.map