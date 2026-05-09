import type { ToolDefinition } from './index.js';
type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
export interface SurfaceSignal {
    id: string;
    category: string;
    severity: Severity;
    file: string;
    line: number;
    excerpt: string;
    pattern: string;
    ts: number;
}
export interface SurfaceMap {
    sessionId: string;
    target: string;
    startedAt: number;
    filesWalked: number;
    bytesRead: number;
    signals: SurfaceSignal[];
    skipped: {
        path: string;
        reason: string;
    }[];
}
export interface BuildSurfaceMapOptions {
    target: string;
    excludes?: Iterable<string>;
    severityFloor?: Severity;
    sessionId?: string;
}
export declare function buildSurfaceMap(opts: BuildSurfaceMapOptions): SurfaceMap;
export declare function persistSurfaceMap(map: SurfaceMap, baseDir?: string): string;
export declare function renderSurfaceMap(map: SurfaceMap, persistedTo: string): string;
export interface RunOptions {
    target: string;
    severityFloor?: Severity;
    excludes?: string[];
    baseDir?: string;
}
export declare function runSecurityAuditLocal(opts: RunOptions): {
    map: SurfaceMap;
    persistedTo: string;
    markdown: string;
};
export declare const securityAuditLocalTool: ToolDefinition;
export {};
//# sourceMappingURL=security-audit-local.d.ts.map