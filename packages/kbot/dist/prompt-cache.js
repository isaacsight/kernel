// kbot Prompt Cache — Reduce redundant system prompt tokens
//
// System prompts are large and mostly static. By hashing the stable
// portions and caching them, we can use Anthropic's prompt caching
// (cache_control: ephemeral) to avoid re-processing the same tokens.
//
// Key insight: split the system prompt into STABLE (persona, tools, rules)
// and DYNAMIC (learning context, memory, project context) sections.
// The stable portion gets a cache breakpoint.
import { createHash } from 'node:crypto';
const stats = {
    hits: 0,
    misses: 0,
    lastHash: '',
    estimatedSavings: 0,
};
/** Hash a string for cache key comparison */
function hashText(text) {
    return createHash('md5').update(text).digest('hex').slice(0, 16);
}
/** Estimate token count (4 chars per token heuristic) */
function estimateTokens(text) {
    return Math.ceil(text.length / 4);
}
/**
 * Build a cacheable system prompt from sections.
 *
 * For Anthropic: returns structured content blocks with cache_control
 * on the stable portion. This allows the API to cache the large static
 * part and only process the dynamic part fresh each time.
 *
 * For other providers: returns a plain concatenated string (no caching).
 */
export function buildCacheablePrompt(sections, provider = 'anthropic') {
    const stableParts = sections.filter(s => s.stable && s.text).map(s => s.text);
    const dynamicParts = sections.filter(s => !s.stable && s.text).map(s => s.text);
    const stableText = stableParts.join('\n\n');
    const dynamicText = dynamicParts.join('\n\n');
    const fullText = [stableText, dynamicText].filter(Boolean).join('\n\n');
    // Track cache efficiency
    const stableHash = hashText(stableText);
    if (stableHash === stats.lastHash) {
        stats.hits++;
        stats.estimatedSavings += estimateTokens(stableText);
    }
    else {
        stats.misses++;
        stats.lastHash = stableHash;
    }
    // For Anthropic: use structured cache blocks
    if (provider === 'anthropic' && stableText && dynamicText) {
        return {
            text: fullText,
            cacheBlocks: [
                {
                    type: 'text',
                    text: stableText,
                    cache_control: { type: 'ephemeral' },
                },
                {
                    type: 'text',
                    text: dynamicText,
                },
            ],
        };
    }
    return { text: fullText };
}
/**
 * Create prompt sections from agent.ts components.
 * Separates stable (persona, tools, rules) from dynamic (learning, memory).
 */
export function createPromptSections(opts) {
    const sections = [];
    // Stable sections (change rarely)
    if (opts.persona) {
        sections.push({ id: 'persona', text: opts.persona, stable: true });
    }
    if (opts.conversationRules) {
        sections.push({ id: 'rules', text: opts.conversationRules, stable: true });
    }
    if (opts.matrixPrompt) {
        sections.push({ id: 'matrix', text: `[Agent Persona]\n${opts.matrixPrompt}`, stable: true });
    }
    if (opts.toolInstructions) {
        sections.push({ id: 'tools', text: opts.toolInstructions, stable: true });
    }
    // Dynamic sections (change per message)
    if (opts.contextSnippet) {
        sections.push({ id: 'context', text: opts.contextSnippet, stable: false });
    }
    if (opts.memorySnippet) {
        sections.push({ id: 'memory', text: opts.memorySnippet, stable: false });
    }
    if (opts.learningContext) {
        sections.push({ id: 'learning', text: opts.learningContext, stable: false });
    }
    return sections;
}
/** Get cache statistics */
export function getPromptCacheStats() {
    return { ...stats };
}
/** Reset cache stats (for testing) */
export function resetPromptCacheStats() {
    stats.hits = 0;
    stats.misses = 0;
    stats.lastHash = '';
    stats.estimatedSavings = 0;
}
//# sourceMappingURL=prompt-cache.js.map