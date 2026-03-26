export type Severity = 'critical' | 'high' | 'medium' | 'low';
export interface SecurityFinding {
    category: string;
    title: string;
    severity: Severity;
    description: string;
    remediation: string;
    location?: string;
}
export interface SecurityReport {
    timestamp: string;
    score: number;
    findings: SecurityFinding[];
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    goodPractices: string[];
    summary: string;
}
export interface BreachResult {
    email: string;
    breached: boolean;
    breachCount: number;
    breaches: Array<{
        name: string;
        domain: string;
        breachDate: string;
        dataClasses: string[];
    }>;
}
export interface MonitorEvent {
    timestamp: string;
    path: string;
    eventType: string;
    filename: string | null;
}
export interface ScanHistoryEntry {
    timestamp: string;
    score: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    totalFindings: number;
}
export interface SecretFinding {
    file: string;
    line: number;
    type: string;
    preview: string;
}
/**
 * Recursively scan a directory for leaked secrets (API keys, tokens, passwords).
 * NEVER reads or displays actual secret values.
 */
export declare function scanForSecrets(scanPath?: string): SecretFinding[];
export interface SSHAudit {
    findings: SecurityFinding[];
    keysFound: Array<{
        name: string;
        type: string;
        hasPassphrase: boolean | null;
    }>;
    authorizedKeysCount: number;
    configIssues: string[];
}
/**
 * Audit SSH configuration and keys.
 * Checks for password-protected keys, authorized_keys cleanliness, and config issues.
 */
export declare function checkSSHSecurity(): SSHAudit;
export interface PortResult {
    port: number;
    service: string;
    open: boolean;
}
/**
 * Scan common ports on localhost to check for exposed services.
 * Uses TCP connect probes via the net module.
 */
export declare function checkPortExposure(): Promise<{
    ports: PortResult[];
    findings: SecurityFinding[];
}>;
export interface PermissionCheck {
    path: string;
    exists: boolean;
    mode: string | null;
    isWorldReadable: boolean;
    isWorldWritable: boolean;
    finding: SecurityFinding | null;
}
/**
 * Verify that sensitive files and directories are not world-readable or world-writable.
 */
export declare function checkFilePermissions(paths?: string[]): PermissionCheck[];
export interface ScanOptions {
    /** Directory to scan for secrets (default: cwd) */
    secretsScanPath?: string;
    /** Skip port scanning */
    skipPorts?: boolean;
    /** Skip npm global check */
    skipNpm?: boolean;
    /** Skip browser data check */
    skipBrowser?: boolean;
}
/**
 * Full personal security audit.
 * Checks: secrets, SSH, permissions, ports, firewall, git, browser, npm globals.
 */
export declare function runSecurityScan(options?: ScanOptions): Promise<SecurityReport>;
/**
 * Watch sensitive directories for unexpected changes.
 * Logs all change events to ~/.kbot/security/monitor-log.jsonl.
 * Returns a dispose function to stop watching.
 */
export declare function monitorFileChanges(paths?: string[]): {
    dispose: () => void;
};
/**
 * Check if email addresses appear in known data breaches using the Have I Been Pwned API.
 * Uses the free, public, unauthenticated breach search endpoint.
 */
export declare function checkBreachedEmails(emails: string[]): Promise<BreachResult[]>;
/**
 * Run a full scan and format it into a human-readable report.
 */
export declare function generateSecurityReport(options?: ScanOptions): Promise<string>;
/**
 * Set up recurring security scans.
 * Results saved to ~/.kbot/security/scan-history.json.
 * Sends Discord webhook alert if critical findings detected.
 */
export declare function scheduleSecurityScan(intervalHours: number, discordWebhookUrl?: string): {
    stop: () => void;
};
/**
 * Get the scan history for trend analysis.
 */
export declare function getScanHistory(limit?: number): ScanHistoryEntry[];
//# sourceMappingURL=personal-security.d.ts.map