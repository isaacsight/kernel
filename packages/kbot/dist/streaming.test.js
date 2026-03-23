// Tests for kbot Streaming — createStreamState and formatThinkingSummary
import { describe, it, expect } from 'vitest';
import { createStreamState, formatThinkingSummary } from './streaming.js';
describe('createStreamState', () => {
    it('creates a clean initial state', () => {
        const state = createStreamState();
        expect(state.thinking).toBe('');
        expect(state.content).toBe('');
        expect(state.toolCalls).toHaveLength(0);
        expect(state.model).toBe('');
        expect(state.isThinking).toBe(false);
        expect(state.thinkingDisplayed).toBe(false);
        expect(state.usage).toEqual({ input_tokens: 0, output_tokens: 0 });
    });
});
describe('formatThinkingSummary', () => {
    it('returns empty string for empty thinking', () => {
        expect(formatThinkingSummary('')).toBe('');
    });
    it('shows all lines for short thinking', () => {
        const thinking = 'Line 1\nLine 2\nLine 3';
        const summary = formatThinkingSummary(thinking);
        expect(summary).toContain('Line 1');
        expect(summary).toContain('Line 2');
        expect(summary).toContain('Line 3');
    });
    it('truncates long thinking with ellipsis', () => {
        const lines = Array.from({ length: 20 }, (_, i) => `Thinking line ${i + 1}`);
        const thinking = lines.join('\n');
        const summary = formatThinkingSummary(thinking);
        expect(summary).toContain('Thinking line 1');
        expect(summary).toContain('more lines');
    });
    it('skips blank lines', () => {
        const thinking = 'Line 1\n\n\nLine 2';
        const summary = formatThinkingSummary(thinking);
        expect(summary).toContain('Line 1');
        expect(summary).toContain('Line 2');
    });
});
//# sourceMappingURL=streaming.test.js.map