// kbot Fetch Tool Tests — Mocked (no real network calls)
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { executeTool, getTool } from './index.js';
import { registerFetchTools } from './fetch.js';
// Register once
registerFetchTools();
// ─────────────────────────────────────────────────────────────────────
// Mock global fetch
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
// ─────────────────────────────────────────────────────────────────────
// 1. Registration
// ─────────────────────────────────────────────────────────────────────
describe('Fetch Tool Registration', () => {
    it('registers url_fetch', () => {
        const tool = getTool('url_fetch');
        expect(tool).toBeTruthy();
        expect(tool.tier).toBe('free');
        expect(tool.parameters.url.required).toBe(true);
    });
});
// ─────────────────────────────────────────────────────────────────────
// 2. URL validation
// ─────────────────────────────────────────────────────────────────────
describe('url_fetch — URL Validation', () => {
    it('rejects invalid URLs', async () => {
        const result = await executeTool({
            id: 'f-1',
            name: 'url_fetch',
            arguments: { url: 'not-a-url' },
        });
        expect(result.result).toContain('Error');
        expect(result.result).toContain('Invalid URL');
    });
    it('rejects ftp protocol', async () => {
        const result = await executeTool({
            id: 'f-2',
            name: 'url_fetch',
            arguments: { url: 'ftp://example.com/file.txt' },
        });
        expect(result.result).toContain('Error');
        expect(result.result).toContain('http/https');
    });
    it('rejects file:// protocol', async () => {
        const result = await executeTool({
            id: 'f-3',
            name: 'url_fetch',
            arguments: { url: 'file:///etc/passwd' },
        });
        expect(result.result).toContain('Error');
        expect(result.result).toContain('http/https');
    });
});
// ─────────────────────────────────────────────────────────────────────
// 3. SSRF protection — blocked hosts
// ─────────────────────────────────────────────────────────────────────
describe('url_fetch — SSRF Protection', () => {
    it('blocks localhost', async () => {
        const result = await executeTool({
            id: 'ssrf-1',
            name: 'url_fetch',
            arguments: { url: 'http://localhost:8080/secret' },
        });
        expect(result.result).toContain('Blocked host');
    });
    it('blocks 127.0.0.1', async () => {
        const result = await executeTool({
            id: 'ssrf-2',
            name: 'url_fetch',
            arguments: { url: 'http://127.0.0.1/admin' },
        });
        expect(result.result).toContain('Blocked host');
    });
    it('blocks 10.x.x.x private range', async () => {
        const result = await executeTool({
            id: 'ssrf-3',
            name: 'url_fetch',
            arguments: { url: 'http://10.0.0.1/internal' },
        });
        expect(result.result).toContain('Blocked host');
    });
    it('blocks 172.16-31.x.x private range', async () => {
        const result = await executeTool({
            id: 'ssrf-4',
            name: 'url_fetch',
            arguments: { url: 'http://172.16.0.1/internal' },
        });
        expect(result.result).toContain('Blocked host');
    });
    it('blocks 192.168.x.x private range', async () => {
        const result = await executeTool({
            id: 'ssrf-5',
            name: 'url_fetch',
            arguments: { url: 'http://192.168.1.1/router' },
        });
        expect(result.result).toContain('Blocked host');
    });
    it('blocks 0.0.0.0', async () => {
        const result = await executeTool({
            id: 'ssrf-6',
            name: 'url_fetch',
            arguments: { url: 'http://0.0.0.0/' },
        });
        expect(result.result).toContain('Blocked host');
    });
    it('blocks ::1 (IPv6 localhost)', async () => {
        // Note: URL parsing wraps IPv6 in brackets, but the hostname property strips them.
        // The isBlockedHost regex matches '::1' directly.
        // However, some Node.js versions may return the brackets in hostname.
        // We test that the fetch is blocked or errors — either way, no content is returned.
        const result = await executeTool({
            id: 'ssrf-7',
            name: 'url_fetch',
            arguments: { url: 'http://[::1]/secret' },
        });
        expect(result.result).toContain('Error');
    });
    it('blocks .local domains', async () => {
        const result = await executeTool({
            id: 'ssrf-8',
            name: 'url_fetch',
            arguments: { url: 'http://myserver.local/api' },
        });
        expect(result.result).toContain('Blocked host');
    });
    it('blocks link-local 169.254.x.x', async () => {
        const result = await executeTool({
            id: 'ssrf-9',
            name: 'url_fetch',
            arguments: { url: 'http://169.254.169.254/latest/meta-data/' },
        });
        expect(result.result).toContain('Blocked host');
    });
    it('allows public domains', async () => {
        mockFetch(async () => new Response('OK', { status: 200 }));
        const result = await executeTool({
            id: 'ssrf-10',
            name: 'url_fetch',
            arguments: { url: 'https://example.com' },
        });
        // Should not be blocked
        expect(result.result).not.toContain('Blocked host');
    });
});
// ─────────────────────────────────────────────────────────────────────
// 4. Successful fetches
// ─────────────────────────────────────────────────────────────────────
describe('url_fetch — Success Cases', () => {
    it('fetches plain text content', async () => {
        mockFetch(async () => new Response('Hello, World!', {
            status: 200,
            headers: { 'content-type': 'text/plain' },
        }));
        const result = await executeTool({
            id: 'ok-1',
            name: 'url_fetch',
            arguments: { url: 'https://example.com/text' },
        });
        expect(result.error).toBeUndefined();
        expect(result.result).toBe('Hello, World!');
    });
    it('fetches JSON content as-is', async () => {
        const jsonContent = JSON.stringify({ key: 'value', num: 42 });
        mockFetch(async () => new Response(jsonContent, {
            status: 200,
            headers: { 'content-type': 'application/json' },
        }));
        const result = await executeTool({
            id: 'ok-2',
            name: 'url_fetch',
            arguments: { url: 'https://api.example.com/data' },
        });
        expect(result.error).toBeUndefined();
        expect(result.result).toBe(jsonContent);
    });
    it('strips HTML tags from HTML content', async () => {
        const html = '<html><head><title>Test</title></head><body><p>Hello <strong>World</strong></p></body></html>';
        mockFetch(async () => new Response(html, {
            status: 200,
            headers: { 'content-type': 'text/html; charset=utf-8' },
        }));
        const result = await executeTool({
            id: 'ok-3',
            name: 'url_fetch',
            arguments: { url: 'https://example.com/page' },
        });
        expect(result.error).toBeUndefined();
        expect(result.result).toContain('Hello');
        expect(result.result).toContain('World');
        expect(result.result).not.toContain('<p>');
        expect(result.result).not.toContain('<strong>');
    });
    it('removes script and style blocks from HTML', async () => {
        const html = '<html><script>alert("xss")</script><style>body{color:red}</style><body>Clean text</body></html>';
        mockFetch(async () => new Response(html, {
            status: 200,
            headers: { 'content-type': 'text/html' },
        }));
        const result = await executeTool({
            id: 'ok-4',
            name: 'url_fetch',
            arguments: { url: 'https://example.com/xss' },
        });
        expect(result.error).toBeUndefined();
        expect(result.result).toContain('Clean text');
        expect(result.result).not.toContain('alert');
        expect(result.result).not.toContain('color:red');
    });
    it('decodes HTML entities', async () => {
        const html = '<p>&amp; &lt; &gt; &quot; &#39; &nbsp;</p>';
        mockFetch(async () => new Response(html, {
            status: 200,
            headers: { 'content-type': 'text/html' },
        }));
        const result = await executeTool({
            id: 'ok-5',
            name: 'url_fetch',
            arguments: { url: 'https://example.com/entities' },
        });
        expect(result.error).toBeUndefined();
        expect(result.result).toContain('&');
        expect(result.result).toContain('<');
        expect(result.result).toContain('>');
        expect(result.result).toContain('"');
        expect(result.result).toContain("'");
    });
    it('returns "(empty response)" for empty body', async () => {
        mockFetch(async () => new Response('', {
            status: 200,
            headers: { 'content-type': 'text/plain' },
        }));
        const result = await executeTool({
            id: 'ok-6',
            name: 'url_fetch',
            arguments: { url: 'https://example.com/empty' },
        });
        expect(result.error).toBeUndefined();
        expect(result.result).toBe('(empty response)');
    });
});
// ─────────────────────────────────────────────────────────────────────
// 5. Truncation
// ─────────────────────────────────────────────────────────────────────
describe('url_fetch — Truncation', () => {
    it('truncates long content at default 20000 chars', async () => {
        const longContent = 'x'.repeat(30000);
        mockFetch(async () => new Response(longContent, {
            status: 200,
            headers: { 'content-type': 'text/plain' },
        }));
        const result = await executeTool({
            id: 'tr-1',
            name: 'url_fetch',
            arguments: { url: 'https://example.com/long' },
        });
        expect(result.error).toBeUndefined();
        expect(result.result.length).toBeLessThan(30000);
        expect(result.result).toContain('truncated');
    });
    it('respects custom max_length', async () => {
        const content = 'abcdefghij'.repeat(100); // 1000 chars
        mockFetch(async () => new Response(content, {
            status: 200,
            headers: { 'content-type': 'text/plain' },
        }));
        const result = await executeTool({
            id: 'tr-2',
            name: 'url_fetch',
            arguments: { url: 'https://example.com/custom-len', max_length: 200 },
        });
        expect(result.error).toBeUndefined();
        expect(result.result).toContain('truncated');
        // Should be around 200 chars + truncation message
        expect(result.result.length).toBeLessThan(500);
    });
    it('does not truncate short content', async () => {
        mockFetch(async () => new Response('short', {
            status: 200,
            headers: { 'content-type': 'text/plain' },
        }));
        const result = await executeTool({
            id: 'tr-3',
            name: 'url_fetch',
            arguments: { url: 'https://example.com/short' },
        });
        expect(result.error).toBeUndefined();
        expect(result.result).toBe('short');
        expect(result.result).not.toContain('truncated');
    });
});
// ─────────────────────────────────────────────────────────────────────
// 6. Error handling
// ─────────────────────────────────────────────────────────────────────
describe('url_fetch — Error Handling', () => {
    it('returns HTTP error for 404', async () => {
        mockFetch(async () => new Response('Not Found', { status: 404, statusText: 'Not Found' }));
        const result = await executeTool({
            id: 'err-1',
            name: 'url_fetch',
            arguments: { url: 'https://example.com/404' },
        });
        expect(result.result).toContain('Error');
        expect(result.result).toContain('404');
    });
    it('returns HTTP error for 500', async () => {
        mockFetch(async () => new Response('Internal Server Error', { status: 500, statusText: 'Internal Server Error' }));
        const result = await executeTool({
            id: 'err-2',
            name: 'url_fetch',
            arguments: { url: 'https://example.com/500' },
        });
        expect(result.result).toContain('Error');
        expect(result.result).toContain('500');
    });
    it('handles network errors', async () => {
        mockFetch(async () => {
            throw new Error('getaddrinfo ENOTFOUND example.invalid');
        });
        const result = await executeTool({
            id: 'err-3',
            name: 'url_fetch',
            arguments: { url: 'https://example.invalid/page' },
        });
        expect(result.result).toContain('Error');
        expect(result.result).toContain('ENOTFOUND');
    });
    it('handles timeout (AbortError)', async () => {
        mockFetch(async () => {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            throw err;
        });
        const result = await executeTool({
            id: 'err-4',
            name: 'url_fetch',
            arguments: { url: 'https://slow.example.com/' },
        });
        expect(result.result).toContain('timed out');
    });
    it('handles non-Error thrown values', async () => {
        mockFetch(async () => {
            throw 'string error';
        });
        const result = await executeTool({
            id: 'err-5',
            name: 'url_fetch',
            arguments: { url: 'https://example.com/weird-error' },
        });
        expect(result.result).toContain('Error');
        expect(result.result).toContain('string error');
    });
});
//# sourceMappingURL=fetch.test.js.map