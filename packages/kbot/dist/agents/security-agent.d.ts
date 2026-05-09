import { RULES, RULES_BY_ID, type Severity } from './security-rules.js';
export type SecurityMode = 'scan' | 'scan-and-fix' | 'report-only';
export interface SecurityFinding {
    id: string;
    severity: Severity;
    category: string;
    file: string;
    line?: number;
    description: string;
    recommendation: string;
    fixed?: boolean;
}
export interface SecurityReport {
    scanned: number;
    findings: SecurityFinding[];
    fixesApplied: number;
    summary: string;
}
export interface RunSecurityAgentInput {
    target: string;
    mode: SecurityMode;
}
/**
 * Run the kbot security agent over a directory.
 * - `scan`: read-only walk + report
 * - `scan-and-fix`: applies the safest auto-fixes (currently md5 -> sha256)
 * - `report-only`: identical to scan; never writes
 */
export declare function runSecurityAgent(input: RunSecurityAgentInput): Promise<SecurityReport>;
export { RULES, RULES_BY_ID };
//# sourceMappingURL=security-agent.d.ts.map