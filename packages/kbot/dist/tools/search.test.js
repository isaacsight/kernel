// kbot Search Tools Tests — Mocked (no real network calls)
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { executeTool, getTool } from './index.js';
import { registerSearchTools } from './search.js';
// Register once
registerSearchTools();
// ─────────────────────────────────────────────────────────────────────
// Mock global fetch to avoid real network calls
// ─────────────────────────────────────────────────────────────────────
const originalFetch = globalThis.fetch;
beforeAll(() => {
    globalThis.fetch = vi.fn();
});
afterAll(() => {
    globalThis.fetch = originalFetch;
});
function mockFetch(impl) {
    ;
    globalThis.fetch.mockImplementation(impl);
}
function mockFetchReset() {
    ;
    globalThis.fetch.mockReset();
}
// ─────────────────────────────────────────────────────────────────────
// 1. Registration
// ─────────────────────────────────────────────────────────────────────
describe('Search Tools Registration', () => {
    it('registers web_search', () => {
        const tool = getTool('web_search');
        expect(tool).toBeTruthy();
        expect(tool.tier).toBe('free');
        expect(tool.parameters.query.required).toBe(true);
    });
    it('registers research', () => {
        const tool = getTool('research');
        expect(tool).toBeTruthy();
        expect(tool.tier).toBe('free');
        expect(tool.parameters.topic.required).toBe(true);
    });
});
// ─────────────────────────────────────────────────────────────────────
// 2. web_search — DuckDuckGo success
// ─────────────────────────────────────────────────────────────────────
describe('web_search', () => {
    it('returns DuckDuckGo instant answer', async () => {
        mockFetch(async (url) => {
            const urlStr = String(url);
            if (urlStr.includes('duckduckgo.com')) {
                return new Response(JSON.stringify({
                    AbstractText: 'TypeScript is a typed superset of JavaScript.',
                    AbstractSource: 'Wikipedia',
                    RelatedTopics: [],
                }), { status: 200 });
            }
            // Wikipedia fallback
            if (urlStr.includes('wikipedia.org')) {
                return new Response(JSON.stringify({
                    extract: 'TypeScript is a programming language developed by Microsoft.',
                }), { status: 200 });
            }
            return new Response('', { status: 404 });
        });
        const result = await executeTool({
            id: 'ws-1',
            name: 'web_search',
            arguments: { query: 'TypeScript' },
        });
        expect(result.error).toBeUndefined();
        expect(result.result).toContain('TypeScript');
        expect(result.result).toContain('Wikipedia');
    });
    it('returns related topics from DuckDuckGo', async () => {
        mockFetch(async (url) => {
            const urlStr = String(url);
            if (urlStr.includes('duckduckgo.com')) {
                return new Response(JSON.stringify({
                    AbstractText: '',
                    RelatedTopics: [
                        { Text: 'React is a JavaScript library' },
                        { Text: 'Vue.js is a progressive framework' },
                    ],
                }), { status: 200 });
            }
            return new Response(JSON.stringify({}), { status: 200 });
        });
        const result = await executeTool({
            id: 'ws-2',
            name: 'web_search',
            arguments: { query: 'frontend frameworks' },
        });
        expect(result.error).toBeUndefined();
        expect(result.result).toContain('React is a JavaScript library');
        expect(result.result).toContain('Vue.js');
    });
    it('includes StackOverflow for programming queries', async () => {
        mockFetch(async (url) => {
            const urlStr = String(url);
            if (urlStr.includes('duckduckgo.com')) {
                return new Response(JSON.stringify({ AbstractText: '', RelatedTopics: [] }), { status: 200 });
            }
            if (urlStr.includes('wikipedia.org')) {
                return new Response(JSON.stringify({}), { status: 200 });
            }
            if (urlStr.includes('stackexchange.com')) {
                return new Response(JSON.stringify({
                    items: [
                        { title: 'How to install npm packages', excerpt: 'Use npm install to add packages to your project...' },
                    ],
                }), { status: 200 });
            }
            return new Response('', { status: 404 });
        });
        const result = await executeTool({
            id: 'ws-3',
            name: 'web_search',
            arguments: { query: 'how to install npm packages' },
        });
        expect(result.error).toBeUndefined();
        expect(result.result).toContain('Stack Overflow');
        expect(result.result).toContain('npm');
    });
    it('returns fallback message when no results', async () => {
        mockFetch(async () => {
            return new Response(JSON.stringify({ AbstractText: '', RelatedTopics: [] }), { status: 200 });
        });
        const result = await executeTool({
            id: 'ws-4',
            name: 'web_search',
            arguments: { query: 'xyznonexistentquery12345' },
        });
        expect(result.error).toBeUndefined();
        expect(result.result).toContain('No results');
        expect(result.result).toContain('url_fetch');
    });
    it('handles fetch failures gracefully', async () => {
        mockFetch(async () => {
            throw new Error('Network error');
        });
        const result = await executeTool({
            id: 'ws-5',
            name: 'web_search',
            arguments: { query: 'test query' },
        });
        // Should not throw — should return fallback
        expect(result.error).toBeUndefined();
        expect(result.result).toContain('No results');
    });
    it('handles Wikipedia 404 gracefully', async () => {
        mockFetch(async (url) => {
            const urlStr = String(url);
            if (urlStr.includes('duckduckgo.com')) {
                return new Response(JSON.stringify({
                    AbstractText: 'Some answer',
                    AbstractSource: 'DDG',
                    RelatedTopics: [],
                }), { status: 200 });
            }
            // Wikipedia returns 404
            return new Response('Not found', { status: 404 });
        });
        const result = await executeTool({
            id: 'ws-6',
            name: 'web_search',
            arguments: { query: 'obscure topic' },
        });
        expect(result.error).toBeUndefined();
        expect(result.result).toContain('Some answer');
    });
});
// ─────────────────────────────────────────────────────────────────────
// 3. research
// ─────────────────────────────────────────────────────────────────────
describe('research', () => {
    it('fetches provided URLs and DDG/Wikipedia', async () => {
        mockFetch(async (url) => {
            const urlStr = String(url);
            if (urlStr.includes('example.com')) {
                return new Response('<html><body><p>Example content about AI</p></body></html>', {
                    status: 200,
                    headers: { 'content-type': 'text/html' },
                });
            }
            if (urlStr.includes('duckduckgo.com')) {
                return new Response(JSON.stringify({
                    AbstractText: 'AI is a branch of computer science.',
                    AbstractSource: 'Wikipedia',
                    RelatedTopics: [],
                }), { status: 200 });
            }
            if (urlStr.includes('wikipedia.org')) {
                return new Response(JSON.stringify({
                    extract: 'Artificial intelligence is intelligence demonstrated by machines.',
                }), { status: 200 });
            }
            return new Response('', { status: 404 });
        });
        const result = await executeTool({
            id: 'r-1',
            name: 'research',
            arguments: {
                topic: 'artificial intelligence',
                urls: ['https://example.com/ai-page'],
            },
        });
        expect(result.error).toBeUndefined();
        expect(result.result).toContain('Research results for: artificial intelligence');
        expect(result.result).toContain('Example content about AI');
        expect(result.result).toContain('AI is a branch of computer science');
        expect(result.result).toContain('Wikipedia');
    });
    it('limits URLs to 5', async () => {
        let fetchCount = 0;
        mockFetch(async (url) => {
            const urlStr = String(url);
            if (urlStr.includes('example.com')) {
                fetchCount++;
                return new Response(`Content ${fetchCount}`, { status: 200 });
            }
            return new Response(JSON.stringify({ AbstractText: '', RelatedTopics: [] }), { status: 200 });
        });
        const urls = Array.from({ length: 10 }, (_, i) => `https://example.com/page${i}`);
        const result = await executeTool({
            id: 'r-2',
            name: 'research',
            arguments: { topic: 'test', urls },
        });
        expect(result.error).toBeUndefined();
        // Only first 5 URLs should be fetched
        expect(fetchCount).toBeLessThanOrEqual(5);
    });
    it('returns fallback for no results', async () => {
        mockFetch(async () => {
            throw new Error('Network failure');
        });
        const result = await executeTool({
            id: 'r-3',
            name: 'research',
            arguments: { topic: 'impossible topic' },
        });
        expect(result.error).toBeUndefined();
        expect(result.result).toContain('No research results found');
    });
    it('strips HTML from fetched URLs', async () => {
        mockFetch(async (url) => {
            const urlStr = String(url);
            if (urlStr.includes('example.com')) {
                return new Response('<html><head><script>alert("xss")</script><style>body{color:red}</style></head><body><p>Clean text</p></body></html>', { status: 200 });
            }
            return new Response(JSON.stringify({ AbstractText: '', RelatedTopics: [] }), { status: 200 });
        });
        const result = await executeTool({
            id: 'r-4',
            name: 'research',
            arguments: { topic: 'html stripping', urls: ['https://example.com'] },
        });
        expect(result.error).toBeUndefined();
        expect(result.result).toContain('Clean text');
        expect(result.result).not.toContain('alert');
        expect(result.result).not.toContain('<script');
        expect(result.result).not.toContain('<style');
    });
    it('handles mixed URL success and failure', async () => {
        mockFetch(async (url) => {
            const urlStr = String(url);
            if (urlStr.includes('good.com')) {
                return new Response('Good content', { status: 200 });
            }
            if (urlStr.includes('bad.com')) {
                throw new Error('Connection refused');
            }
            if (urlStr.includes('duckduckgo.com')) {
                return new Response(JSON.stringify({ AbstractText: 'DDG result', AbstractSource: 'DDG', RelatedTopics: [] }), { status: 200 });
            }
            return new Response(JSON.stringify({}), { status: 200 });
        });
        const result = await executeTool({
            id: 'r-5',
            name: 'research',
            arguments: {
                topic: 'test',
                urls: ['https://good.com/page', 'https://bad.com/page'],
            },
        });
        expect(result.error).toBeUndefined();
        expect(result.result).toContain('Good content');
        expect(result.result).toContain('DDG result');
        // bad.com should be silently skipped
    });
    it('works without urls parameter', async () => {
        mockFetch(async (url) => {
            const urlStr = String(url);
            if (urlStr.includes('duckduckgo.com')) {
                return new Response(JSON.stringify({
                    AbstractText: 'Research result',
                    AbstractSource: 'Source',
                    RelatedTopics: [{ Text: 'Related item' }],
                }), { status: 200 });
            }
            return new Response(JSON.stringify({ extract: 'Wiki content' }), { status: 200 });
        });
        const result = await executeTool({
            id: 'r-6',
            name: 'research',
            arguments: { topic: 'test topic' },
        });
        expect(result.error).toBeUndefined();
        expect(result.result).toContain('Research result');
    });
});
//# sourceMappingURL=search.test.js.map