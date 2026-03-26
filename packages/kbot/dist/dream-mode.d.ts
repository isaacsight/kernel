interface DreamResult {
    phase: string;
    duration_ms: number;
    findings: string[];
    actions_taken: string[];
    improvements: number;
}
interface DreamReport {
    timestamp: string;
    duration_ms: number;
    phases_completed: number;
    total_findings: number;
    total_actions: number;
    total_improvements: number;
    results: DreamResult[];
}
export declare function runDreamMode(verbose?: boolean): Promise<DreamReport>;
export declare function getDreamHistory(): Array<{
    date: string;
    summary: Record<string, number>;
}>;
export {};
//# sourceMappingURL=dream-mode.d.ts.map