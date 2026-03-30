export type TaskCategory = 'codegen' | 'bugfix' | 'refactor' | 'explain' | 'research' | 'science';
export type TaskDifficulty = 'easy' | 'medium' | 'hard';
export interface BenchTask {
    id: string;
    category: TaskCategory;
    difficulty: TaskDifficulty;
    prompt: string;
    expectedPatterns: string[];
    expectedTools?: string[];
    maxTokens?: number;
    timeoutMs?: number;
}
export interface TaskResult {
    taskId: string;
    category: TaskCategory;
    difficulty: TaskDifficulty;
    passed: boolean;
    patternScore: number;
    toolScore: number;
    speedScore: number;
    overallScore: number;
    durationMs: number;
    responseLength: number;
    matchedPatterns: string[];
    missedPatterns: string[];
    toolsCalled: string[];
    error?: string;
}
export interface BenchResult {
    timestamp: string;
    provider: string;
    model: string;
    kbotVersion: string;
    totalScore: number;
    categoryScores: Record<string, number>;
    tasks: TaskResult[];
    duration: number;
    tokenUsage: {
        input: number;
        output: number;
    };
}
export interface BenchOptions {
    categories?: string[];
    difficulty?: string;
    provider?: string;
    model?: string;
    verbose?: boolean;
    /** Max tasks to run (for quick checks) */
    limit?: number;
}
/** Run the benchmark suite */
export declare function runBenchmark(opts?: BenchOptions): Promise<BenchResult>;
/** Get all saved benchmark results, sorted newest first */
export declare function getBenchHistory(): BenchResult[];
/** Compare two benchmark results and format a comparison table */
export declare function compareBenchmarks(a: BenchResult, b: BenchResult): string;
/** Format and print a benchmark result as a terminal table */
export declare function formatBenchResult(result: BenchResult): void;
/** Format benchmark history as a compact table */
export declare function formatBenchHistory(results: BenchResult[]): string;
/** Register the bench subcommand with Commander */
export declare function registerBenchCommand(program: import('commander').Command): void;
//# sourceMappingURL=bench.d.ts.map