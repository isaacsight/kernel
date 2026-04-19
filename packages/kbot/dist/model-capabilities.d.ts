import type { ByokProvider } from './auth.js';
/**
 * Check whether a specific model can invoke tools.
 * For Ollama/local: queries the model's capabilities endpoint.
 * For cloud providers: returns true for the known-capable list.
 * Returns `null` if the answer can't be determined (non-fatal — caller decides).
 */
export declare function supportsToolCalls(provider: ByokProvider, model: string): Promise<boolean | null>;
/**
 * Human-readable recommendation when a model lacks tool support.
 * Returns null if the model is fine OR if we can't tell.
 */
export declare function getWeakModelWarning(provider: ByokProvider, model: string): Promise<string | null>;
//# sourceMappingURL=model-capabilities.d.ts.map