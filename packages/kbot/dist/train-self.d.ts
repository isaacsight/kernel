import { type CurateMode } from './train-curate.js';
export interface TrainSelfOptions {
    mode?: CurateMode;
    baseModel?: string;
    outputName?: string;
    backend?: 'mlx' | 'unsloth' | 'llama-cpp' | 'together';
    dryRun?: boolean;
    skipCurate?: boolean;
    skipTrain?: boolean;
    skipDeploy?: boolean;
    iters?: number;
    batchSize?: number;
    numLayers?: number;
    learningRate?: number;
    maxExamples?: number;
    datasetPath?: string;
    adapterPath?: string;
    fusedPath?: string;
    ggufPath?: string;
    gradCheckpoint?: boolean;
}
interface StepResult {
    step: string;
    ok: boolean;
    duration_ms: number;
    details?: string;
}
export declare function trainSelf(opts?: TrainSelfOptions): Promise<{
    results: StepResult[];
    summary: string;
}>;
/** CLI-facing: pretty-print a run. */
export declare function formatTrainSelfReport(r: {
    results: StepResult[];
    summary: string;
}): string;
export {};
//# sourceMappingURL=train-self.d.ts.map