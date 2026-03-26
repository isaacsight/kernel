export type FindingType = 'duplicate-pattern' | 'co-change' | 'complexity';
export interface GuardianFinding {
    type: FindingType;
    severity: 'info' | 'warn' | 'critical';
    title: string;
    description: string;
    files: string[];
    /** The repeated code snippet (for duplicate-pattern findings) */
    pattern?: string;
    /** Occurrence count (for duplicate-pattern findings) */
    occurrences?: number;
    /** Metric value (for complexity findings — e.g., function length) */
    metric?: number;
    /** Suggested action */
    suggestion: string;
    foundAt: string;
}
export interface GuardianReport {
    analyzedAt: string;
    rootDir: string;
    filesScanned: number;
    findings: GuardianFinding[];
    summary: {
        duplicates: number;
        coChanges: number;
        complexityWarnings: number;
        totalFindings: number;
    };
}
export interface ForgedGuardianTool {
    name: string;
    description: string;
    finding: GuardianFinding;
    detectPattern: string;
    createdAt: string;
}
interface HistoryEntry {
    report: GuardianReport;
    forgedTools: string[];
}
/**
 * Run the Codebase Guardian on a directory.
 *
 * Scans for:
 * - Duplicate code patterns (3+ occurrences across files)
 * - Files that always change together (from git history)
 * - Growing complexity (function length, nesting depth)
 *
 * Returns a structured report with all findings.
 */
export declare function runGuardian(path: string): Promise<GuardianReport>;
/**
 * When the guardian finds a recurring pattern, forge a tool to detect (and
 * optionally fix) that specific pattern in the future.
 *
 * The forged tool is saved to ~/.kbot/forge/guardian-{name}.json.
 */
export declare function forgeGuardianTool(finding: GuardianFinding): ForgedGuardianTool;
/**
 * Get history of guardian reports and forged tools.
 */
export declare function getGuardianHistory(): HistoryEntry[];
export {};
//# sourceMappingURL=codebase-guardian.d.ts.map