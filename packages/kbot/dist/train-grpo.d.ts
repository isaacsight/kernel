export type Verifier = {
    kind: 'build-pass';
    cwd: string;
    cmd: string;
} | {
    kind: 'test-pass';
    cwd: string;
    cmd: string;
} | {
    kind: 'lint-pass';
    cwd: string;
    cmd: string;
} | {
    kind: 'regex-match';
    pattern: string;
    flags?: string;
} | {
    kind: 'json-valid';
    requireKeys?: string[];
} | {
    kind: 'custom';
    script: string;
};
export interface GrpoPrompt {
    id?: string;
    prompt: string;
    system?: string;
    verifier: Verifier;
    tags?: string[];
}
export interface GrpoOptions {
    studentModel?: string;
    prompts: GrpoPrompt[];
    groupSize?: number;
    iters?: number;
    learningRate?: number;
    klBeta?: number;
    outputDir?: string;
    runnerCmd?: string;
    dryRun?: boolean;
}
export interface RolloutResult {
    prompt_id: string;
    completions: Array<{
        text: string;
        reward: number;
        verifier_ok: boolean;
    }>;
    advantage: number[];
}
export interface GrpoResult {
    ok: boolean;
    output_dir: string;
    rollouts: RolloutResult[];
    iterations_run: number;
    mean_reward: number;
    log: string;
}
/** Apply a verifier to a completion. Returns { ok, reward ∈ [0,1] }. */
export declare function verify(v: Verifier, completion: string): Promise<{
    ok: boolean;
    reward: number;
}>;
export declare function runGrpoRollouts(opts: GrpoOptions): Promise<GrpoResult>;
/** Default verifier suite for kbot: regex + JSON validity on common code gen. */
export declare const DEFAULT_VERIFIER_SUITE: GrpoPrompt[];
export declare function formatGrpoReport(r: GrpoResult): string;
//# sourceMappingURL=train-grpo.d.ts.map