export interface AutopilotConfig {
    /** GitHub repo in "owner/repo" format */
    github_repo: string;
    /** Discord webhook URL for notifications */
    discord_webhook?: string;
    /** Check interval in ms (default: 300000 = 5 min) */
    check_interval_ms?: number;
}
export interface TriageResult {
    issue: number;
    title: string;
    label: string;
    response: string;
    url: string;
}
export interface PRReviewResult {
    pr: number;
    title: string;
    author: string;
    status: 'pending-ci' | 'ci-passing' | 'ci-failing' | 'draft' | 'reviewed';
    comment: string;
    url: string;
}
export interface FAQMatch {
    question: string;
    answer: string;
    matchedIssue: number;
    confidence: number;
}
export interface DigestEntry {
    generatedAt: string;
    repo: string;
    newIssues: number;
    newPRs: number;
    mergedPRs: number;
    welcomed: string[];
    markdown: string;
}
export interface AutopilotCycleResult {
    timestamp: string;
    repo: string;
    triaged: TriageResult[];
    reviewed: PRReviewResult[];
    faqAnswered: FAQMatch[];
    welcomed: string[];
    digest: DigestEntry | null;
    errors: string[];
}
export interface FAQEntry {
    question: string;
    answer: string;
    keywords: string[];
}
interface AutopilotState {
    /** Issue numbers we have already triaged */
    triagedIssues: number[];
    /** PR numbers we have already reviewed */
    reviewedPRs: number[];
    /** Issue numbers where we posted FAQ answers */
    answeredIssues: number[];
    /** Users we have already welcomed */
    welcomedUsers: string[];
    /** ISO string of last digest generation */
    lastDigestDate: string;
    /** All known contributors (for detecting new ones) */
    knownContributors: string[];
    /** Cycle count */
    cycleCount: number;
}
/**
 * Run a single community autopilot cycle.
 *
 * 1. Triage new GitHub issues (label + respond)
 * 2. Review new PRs (check CI, comment)
 * 3. Answer pending questions via FAQ matching
 * 4. Generate daily digest at midnight
 * 5. Welcome new contributors
 */
export declare function runCommunityAutopilot(config: AutopilotConfig): Promise<AutopilotCycleResult>;
/**
 * Start the community autopilot as a background daemon.
 * Runs a cycle immediately, then repeats at the configured interval.
 */
export declare function startAutopilot(config: AutopilotConfig): void;
/**
 * Stop the community autopilot daemon.
 */
export declare function stopAutopilot(): void;
/**
 * Check if the autopilot daemon is currently running.
 */
export declare function isAutopilotRunning(): boolean;
/**
 * Get the current autopilot state (for debugging / monitoring).
 */
export declare function getAutopilotState(): AutopilotState;
export {};
//# sourceMappingURL=community-autopilot.d.ts.map