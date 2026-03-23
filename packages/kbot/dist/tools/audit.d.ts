interface AuditResult {
    repo: string;
    score: number;
    maxScore: number;
    grade: string;
    sections: AuditSection[];
    summary: string;
}
interface AuditSection {
    name: string;
    score: number;
    maxScore: number;
    findings: string[];
    status: 'pass' | 'warn' | 'fail';
}
declare function auditRepo(repo: string): Promise<AuditResult>;
declare function formatAuditReport(result: AuditResult): string;
export declare function registerAuditTools(): void;
export { auditRepo, formatAuditReport };
//# sourceMappingURL=audit.d.ts.map