/**
 * Identity guard — injects ground-truth self-facts into the user message
 * when the message is a self-query.
 *
 * Reality probes (2026-04-20) showed that with a small local model
 * (gemma4:latest, 4B-class), "what version are you?" returns a different
 * fabricated version number on each invocation — v3.99.14, v3.99.12, etc.
 * The self-awareness system-context block exists and is injected, but
 * small models ignore system context for identity queries.
 *
 * This module mirrors math-guard: detect the query in the USER message and
 * prepend a ground-truth block to the context snippet. Local models respect
 * user-message content more than system prompts, so the answer shows up
 * directly in the input the model conditions on.
 *
 * Scope: version, product name, provider, model. Not capabilities — those
 * belong to self-awareness.ts and its 200-token budget.
 */
export type IdentityQueryKind = 'version' | 'product' | 'provider' | 'model';
export declare function detectIdentityQuery(message: string): Set<IdentityQueryKind>;
/**
 * Build the ground-truth preamble for a user message. Returns empty string
 * when the message is not a self-query, so callers can concatenate
 * unconditionally.
 */
export declare function buildIdentityGuardBlock(message: string): string;
//# sourceMappingURL=identity-guard.d.ts.map