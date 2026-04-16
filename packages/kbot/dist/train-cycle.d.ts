export interface TrainCycleOptions {
    studentModel?: string;
    teacherProvider?: 'anthropic' | 'openai';
    teacherModel?: string;
    promptsFile?: string;
    corrections?: string;
    samples?: number;
    passThreshold?: number;
    retrain?: boolean;
    dryRun?: boolean;
}
export interface CycleResult {
    sampled: number;
    passed: number;
    corrected: number;
    skipped: number;
    corrections_file: string;
    retrain_summary?: string;
}
export declare function runCycle(opts?: TrainCycleOptions): Promise<CycleResult>;
export declare function formatCycleReport(r: CycleResult): string;
//# sourceMappingURL=train-cycle.d.ts.map