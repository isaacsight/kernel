export declare const DEFAULT_MODELS: Record<string, {
    hf: string;
    description: string;
    size: string;
}>;
/**
 * Recommend models that fit this machine's hardware.
 * Uses MachineProfile if available, falls back to os.totalmem().
 */
export declare function getRecommendedModels(): Array<{
    name: string;
    fits: boolean;
    reason: string;
}>;
export declare function ensureModelsDir(): string;
export declare function listLocalModels(): Array<{
    name: string;
    path: string;
    size: string;
    modified: string;
}>;
export declare function downloadModel(nameOrHf: string, onProgress?: (pct: number) => void): Promise<string>;
export declare function removeModel(name: string): boolean;
export declare function loadModel(modelPath?: string): Promise<void>;
export declare function unloadModel(): Promise<void>;
export declare function getLoadedModelName(): string | null;
export declare function isModelLoaded(): boolean;
export interface EmbeddedResult {
    content: string;
    model: string;
    usage: {
        input_tokens: number;
        output_tokens: number;
    };
    tool_calls?: Array<{
        id: string;
        name: string;
        arguments: Record<string, unknown>;
    }>;
    stop_reason?: string;
}
export declare function chatCompletion(systemPrompt: string, messages: Array<{
    role: string;
    content: string;
}>, tools?: Array<{
    name: string;
    description: string;
    input_schema: Record<string, unknown>;
}>, onChunk?: (text: string) => void): Promise<EmbeddedResult>;
export declare function resetSession(): Promise<void>;
export declare function isEmbeddedAvailable(): Promise<boolean>;
export declare function getModelInfo(): {
    name: string | null;
    path: string | null;
    modelsDir: string;
    availableModels: number;
};
//# sourceMappingURL=inference.d.ts.map