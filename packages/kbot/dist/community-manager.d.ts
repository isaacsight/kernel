export interface CommunityConfig {
    /** Discord webhook URL for posting digests/notifications */
    discord_webhook?: string;
    /** GitHub repo in "owner/repo" format */
    github_repo: string;
    /** Email addresses for digest distribution */
    email_list?: string[];
}
export interface FAQEntry {
    question: string;
    answer: string;
    keywords: string[];
}
export interface TriageResult {
    issue: number;
    title: string;
    label: string;
    response: string;
    url: string;
}
export interface CommunityDigest {
    generatedAt: string;
    repo: string;
    openIssues: number;
    openPRs: number;
    newIssuesThisWeek: number;
    newPRsThisWeek: number;
    mergedPRsThisWeek: number;
    stargazers: number;
    npmDownloadsWeekly: number;
    newContributors: string[];
    markdown: string;
}
/**
 * Fuzzy-match a question against the FAQ knowledge base.
 * Returns the best matching answer or a polite fallback.
 */
export declare function answerFAQ(question: string): string;
/**
 * Generate a personalized welcome message for a new contributor.
 */
export declare function welcomeContributor(username: string, platform: 'github' | 'discord' | 'email'): string;
/**
 * Generate a formatted community digest from GitHub and npm data.
 */
export declare function generateDigest(repo?: string): Promise<string>;
/**
 * Run the community manager cycle.
 *
 * - Checks GitHub for new issues/PRs and triages them
 * - Generates a daily community digest
 * - Welcomes new contributors
 * - Answers common questions from FAQ
 */
export declare function runCommunityManager(config: CommunityConfig): Promise<{
    triaged: TriageResult[];
    digest: string;
    welcomed: string[];
}>;
//# sourceMappingURL=community-manager.d.ts.map