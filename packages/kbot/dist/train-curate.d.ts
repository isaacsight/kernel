export type CurateMode = 'default' | 'reasoning' | 'agent-trace' | 'code-only';
export interface CurateOptions {
    sources?: string[];
    output?: string;
    mode?: CurateMode;
    maxExamples?: number;
    minScore?: number;
    minResponseLen?: number;
    maxResponseLen?: number;
    dedupe?: boolean;
}
export interface CurateResult {
    output: string;
    total_examined: number;
    kept: number;
    rejected: number;
    duplicates: number;
    mean_score: number;
    by_source: Record<string, number>;
}
/** Run the curator end-to-end. Returns a report. */
export declare function curate(opts?: CurateOptions): CurateResult;
/** Format as a human-readable report */
export declare function formatCurateReport(r: CurateResult): string;
//# sourceMappingURL=train-curate.d.ts.map