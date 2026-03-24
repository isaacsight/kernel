/** Sign all memory files — call after every legitimate write */
export declare function signMemoryFiles(): void;
/** Verify all memory files — returns list of tampered files */
export declare function verifyMemoryIntegrity(): Array<{
    file: string;
    status: 'ok' | 'tampered' | 'new' | 'missing';
}>;
export interface InjectionResult {
    detected: boolean;
    threats: Array<{
        name: string;
        severity: string;
        match: string;
    }>;
    score: number;
    recommendation: 'allow' | 'warn' | 'block';
}
/** Scan a message for prompt injection attempts */
export declare function detectInjection(message: string): InjectionResult;
/** Check if a knowledge entry is safe to store */
export declare function sanitizeKnowledge(fact: string): {
    safe: boolean;
    reason?: string;
};
export interface ForgeVerification {
    safe: boolean;
    warnings: string[];
    dangerousPatterns: string[];
}
/** Verify a forged tool's code before registration */
export declare function verifyForgedTool(code: string, name: string): ForgeVerification;
export interface AnomalyReport {
    anomalies: Array<{
        type: string;
        description: string;
        severity: string;
    }>;
    memoryIntegrity: Array<{
        file: string;
        status: string;
    }>;
    score: number;
}
export declare function detectAnomalies(): AnomalyReport;
interface Incident {
    timestamp: string;
    type: string;
    severity: string;
    description: string;
    action: 'blocked' | 'warned' | 'logged';
}
/** Log a security incident */
export declare function logIncident(type: string, severity: string, description: string, action: 'blocked' | 'warned' | 'logged'): void;
/** Get recent incidents */
export declare function getIncidents(limit?: number): Incident[];
export interface DefenseAudit {
    memoryIntegrity: {
        total: number;
        ok: number;
        tampered: number;
        new: number;
        missing: number;
    };
    anomalies: AnomalyReport;
    recentIncidents: Incident[];
    overallStatus: 'secure' | 'warning' | 'compromised';
    recommendations: string[];
}
export declare function runDefenseAudit(): DefenseAudit;
export {};
//# sourceMappingURL=self-defense.d.ts.map