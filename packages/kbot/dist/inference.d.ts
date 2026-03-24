export declare const DEFAULT_MODELS: Record<string, {
    hf: string;
    description: string;
    size: string;
    tags: string[];
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
export type TaskComplexity = 'simple' | 'moderate' | 'complex' | 'frontier';
/** Estimate task complexity from user message */
export declare function estimateTaskComplexity(message: string): TaskComplexity;
/** Get the best local model for a task */
export declare function selectModelForTask(complexity: TaskComplexity): {
    name: string;
    reason: string;
} | null;
/** Configure multi-model setup based on available RAM */
export declare function getMultiModelConfig(): {
    canMultiModel: boolean;
    recommended: Array<{
        slot: string;
        model: string;
        size: string;
    }>;
    totalRAM: number;
};
export interface QuantOption {
    name: string;
    suffix: string;
    description: string;
    sizeMultiplier: number;
}
export declare const QUANT_OPTIONS: QuantOption[];
/** Recommend quantization based on available RAM and model size */
export declare function recommendQuantization(modelBaseGB: number): QuantOption;
export type HardwareTier = 'basic' | 'standard' | 'pro' | 'ultra' | 'datacenter';
export declare function detectHardwareTier(): {
    tier: HardwareTier;
    description: string;
    maxModelParams: string;
    recommendations: string[];
};
//# sourceMappingURL=inference.d.ts.map