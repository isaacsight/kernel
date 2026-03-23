export type CheckStatus = 'pass' | 'warn' | 'fail';
export interface CheckResult {
    name: string;
    status: CheckStatus;
    message: string;
}
export interface DoctorReport {
    checks: CheckResult[];
    timestamp: string;
    /** Overall: fail if any check fails, warn if any warns, pass otherwise */
    overall: CheckStatus;
}
export declare function runDoctor(): Promise<DoctorReport>;
export declare function formatDoctorReport(report: DoctorReport): string;
//# sourceMappingURL=doctor.d.ts.map