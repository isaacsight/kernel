export type MergeMethod = 'ties' | 'slerp' | 'dare_ties' | 'linear' | 'passthrough';
export interface MergeOptions {
    method?: MergeMethod;
    baseModel: string;
    models: Array<{
        model: string;
        weight?: number;
        density?: number;
    }>;
    outputName?: string;
    outputDir?: string;
    dtype?: 'float16' | 'bfloat16' | 'float32';
    deploy?: boolean;
}
export interface MergeResult {
    ok: boolean;
    output_dir: string;
    config_path: string;
    ollama_name?: string;
    log: string;
}
export declare function mergeModels(opts: MergeOptions): Promise<MergeResult>;
/** Convenience: sensible default TIES blend for kbot. */
export declare function mergeKbotDefault(): Promise<MergeResult>;
export declare function formatMergeReport(r: MergeResult): string;
//# sourceMappingURL=train-merge.d.ts.map