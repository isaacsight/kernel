// Tests for kbot Context Manager
import { describe, it, expect } from 'vitest';
import { estimateTokens, estimateTurnTokens, extractKeyContext, foldContext, compressToolResult, autoCompact, shouldDelegate, } from './context-manager.js';
describe('estimateTokens', () => {
    it('estimates tokens from text length', () => {
        expect(estimateTokens('')).toBe(0);
        expect(estimateTokens('abcd')).toBe(1);
        expect(estimateTokens('a'.repeat(100))).toBe(25);
    });
    it('rounds up partial tokens', () => {
        expect(estimateTokens('abc')).toBe(1);
        expect(estimateTokens('abcde')).toBe(2);
    });
});
describe('estimateTurnTokens', () => {
    it('returns 0 for empty array', () => {
        expect(estimateTurnTokens([])).toBe(0);
    });
    it('includes overhead per turn', () => {
        const turns = [
            { role: 'user', content: 'hello' },
        ];
        const tokens = estimateTurnTokens(turns);
        expect(tokens).toBeGreaterThan(estimateTokens('hello'));
    });
});
describe('extractKeyContext', () => {
    it('extracts file paths', () => {
        const ctx = extractKeyContext('Modified src/auth.ts and ./config.json');
        expect(ctx.files.length).toBeGreaterThan(0);
    });
    it('extracts errors', () => {
        const ctx = extractKeyContext('TypeError: Cannot read property "foo" of undefined');
        expect(ctx.errors.length).toBeGreaterThan(0);
    });
    it('extracts decisions', () => {
        const ctx = extractKeyContext('✓ Fixed the auth bug by updating the token validation');
        expect(ctx.decisions.length).toBeGreaterThan(0);
    });
    it('extracts corrections', () => {
        const ctx = extractKeyContext("no, that's wrong. Use the other approach.");
        expect(ctx.corrections.length).toBeGreaterThan(0);
    });
    it('extracts code snippets', () => {
        const ctx = extractKeyContext('Here is the fix:\n```typescript\nconst x = 1\n```');
        expect(ctx.codeSnippets.length).toBeGreaterThan(0);
    });
    it('deduplicates files', () => {
        const ctx = extractKeyContext('src/auth.ts was changed. Also see src/auth.ts for reference.');
        const unique = new Set(ctx.files);
        expect(ctx.files.length).toBe(unique.size);
    });
});
describe('foldContext', () => {
    it('returns turns unchanged when under budget', () => {
        const turns = [
            { role: 'user', content: 'hello' },
            { role: 'assistant', content: 'hi there' },
        ];
        const folded = foldContext(turns, 10000);
        expect(folded).toHaveLength(2);
    });
    it('compresses when over budget', () => {
        const turns = [];
        for (let i = 0; i < 50; i++) {
            turns.push({ role: 'user', content: `Message ${i}: ${'x'.repeat(500)}` });
            turns.push({ role: 'assistant', content: `Response ${i}: ${'y'.repeat(500)}` });
        }
        const folded = foldContext(turns, 5000);
        expect(folded.length).toBeLessThan(turns.length);
    });
    it('returns empty for empty input', () => {
        expect(foldContext([])).toHaveLength(0);
    });
});
describe('compressToolResult', () => {
    it('returns short results unchanged', () => {
        expect(compressToolResult('short result')).toBe('short result');
    });
    it('compresses long results', () => {
        const result = 'x'.repeat(10000);
        const compressed = compressToolResult(result, 2000);
        expect(compressed).toContain('[Compressed');
    });
    it('preserves errors in compressed output', () => {
        const lines = Array.from({ length: 100 }, (_, i) => `line ${i}`);
        lines[50] = 'TypeError: something broke';
        const result = lines.join('\n');
        const compressed = compressToolResult(result, 2000);
        expect(compressed).toContain('TypeError');
    });
});
describe('shouldDelegate', () => {
    it('delegates when content would exceed 70% of budget', () => {
        expect(shouldDelegate(25000, 10000, 32000)).toBe(true);
    });
    it('does not delegate when within budget', () => {
        expect(shouldDelegate(1000, 5000, 32000)).toBe(false);
    });
});
describe('autoCompact', () => {
    it('does not compact when within budget', () => {
        const turns = [
            { role: 'user', content: 'hello' },
            { role: 'assistant', content: 'hi' },
        ];
        const { wasCompacted } = autoCompact(turns, 2000, 32000);
        expect(wasCompacted).toBe(false);
    });
    it('compacts when over budget', () => {
        const turns = [];
        for (let i = 0; i < 100; i++) {
            turns.push({ role: 'user', content: 'x'.repeat(500) });
            turns.push({ role: 'assistant', content: 'y'.repeat(500) });
        }
        const { wasCompacted, turns: compacted } = autoCompact(turns, 2000, 10000);
        expect(wasCompacted).toBe(true);
        expect(compacted.length).toBeLessThan(turns.length);
    });
});
//# sourceMappingURL=context-manager.test.js.map