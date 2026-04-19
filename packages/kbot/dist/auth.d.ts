declare const KBOT_DIR: string;
declare const CONFIG_PATH: string;
export type ByokProvider = 'anthropic' | 'openai' | 'google' | 'mistral' | 'xai' | 'deepseek' | 'groq' | 'together' | 'fireworks' | 'perplexity' | 'cohere' | 'nvidia' | 'sambanova' | 'cerebras' | 'openrouter' | 'lmstudio' | 'jan' | 'ollama' | 'kbot-local' | 'embedded';
export interface ProviderConfig {
    name: string;
    apiUrl: string;
    apiStyle: 'anthropic' | 'openai' | 'google' | 'cohere';
    defaultModel: string;
    fastModel: string;
    inputCost: number;
    outputCost: number;
    authHeader: 'x-api-key' | 'bearer';
    models?: string[];
}
export declare const PROVIDERS: Record<ByokProvider, ProviderConfig>;
export interface KbotConfig {
    default_model: 'auto' | string;
    default_agent: 'auto' | string;
    byok_key?: string;
    byok_enabled?: boolean;
    byok_provider?: ByokProvider;
    kernel_token?: string;
    critic_enabled?: boolean;
    critic_strictness?: number;
}
export declare function loadConfig(): KbotConfig | null;
export declare function saveConfig(config: KbotConfig): void;
export declare function getDefaultModel(): string;
export declare function getDefaultAgent(): string;
/** Detect provider from API key prefix. Returns null if ambiguous. */
export declare function detectProvider(key: string): ByokProvider | null;
declare const ENV_KEYS: Array<{
    env: string;
    provider: ByokProvider;
}>;
/** Check if a provider is local (runs on this machine, may still need a token) */
export declare function isLocalProvider(provider: ByokProvider): boolean;
/** Check if a provider needs no API key at all */
export declare function isKeylessProvider(provider: ByokProvider): boolean;
/** Check if BYOK mode is enabled (via env var or config) */
export declare function isByokEnabled(): boolean;
/** Get the active BYOK provider */
export declare function getByokProvider(): ByokProvider;
/** Get the BYOK API key */
export declare function getByokKey(): string | null;
/** Get provider config */
export declare function getProvider(provider: ByokProvider): ProviderConfig;
/** Select the best Ollama model for a given message, only from available models */
export declare function selectOllamaModel(message: string, availableModels?: string[]): string;
/** Pre-warm the Ollama model cache (call at startup) */
export declare function warmOllamaModelCache(): Promise<string[]>;
/** Get model name for provider */
export declare function getProviderModel(provider: ByokProvider, speed: 'default' | 'fast', taskHint?: string): string;
/** Get the provider API URL */
export declare function getProviderUrl(provider: ByokProvider): string;
/** Estimate cost */
export declare function estimateCost(provider: ByokProvider, inputTokens: number, outputTokens: number): number;
export declare function getAnthropicUrl(): string;
/** Set up BYOK mode with any supported provider key */
export declare function setupByok(key: string, provider?: ByokProvider): Promise<boolean>;
/** Set up embedded provider directly (no key verification needed) */
export declare function setupEmbedded(): void;
/** Disable BYOK mode */
export declare function disableByok(): void;
/** Check if Ollama is running locally */
export declare function isOllamaRunning(): Promise<boolean>;
/** List available Ollama models */
export declare function listOllamaModels(): Promise<string[]>;
/** Fetch the Ollama server version string (e.g. "0.19.0"), or null if unreachable */
export declare function getOllamaVersion(): Promise<string | null>;
/** Detect whether Ollama is using the MLX backend (Ollama 0.19+ on Apple Silicon) */
export declare function isOllamaMLXBackend(): Promise<boolean>;
/** Set up Ollama as the active provider */
export declare function setupOllama(model?: string): Promise<boolean>;
/** Check if LM Studio is running locally (default port 1234) */
export declare function isLmStudioRunning(): Promise<boolean>;
/** Check if Jan is running locally (default port 1337) */
export declare function isJanRunning(): Promise<boolean>;
/** Set up LM Studio as the active provider */
export declare function setupLmStudio(): Promise<boolean>;
/** Set up Jan as the active provider */
export declare function setupJan(): Promise<boolean>;
/** Detect any running local AI runtime (Ollama, LM Studio, Jan, kbot local) */
export declare function detectLocalRuntime(): Promise<ByokProvider | null>;
/** Set up kbot local as the active provider */
export declare function setupKbotLocal(token?: string): Promise<boolean>;
export type TaskComplexity = 'trivial' | 'simple' | 'moderate' | 'complex' | 'reasoning';
/** Classify message complexity for cost-aware model routing */
export declare function classifyComplexity(message: string): TaskComplexity;
/** Route to the optimal model based on task complexity */
export declare function routeModelForTask(provider: ByokProvider, message: string): {
    model: string;
    reason: string;
};
export { KBOT_DIR, CONFIG_PATH, ENV_KEYS };
//# sourceMappingURL=auth.d.ts.map