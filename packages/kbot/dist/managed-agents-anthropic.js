/**
 * Anthropic Managed Agents client (April 2026 launch).
 *
 * Hosted long-horizon agent platform. This module is a STANDALONE backend
 * that workspace agents can route through when ANTHROPIC_API_KEY is set.
 * Wiring into ./workspace-agents.ts happens in a follow-up pass.
 *
 * Beta header: `anthropic-beta: managed-agents-2026-04-01` is sent on every
 * request.
 *
 * SPEC: best-effort, refine when official docs published.
 * Endpoint shape mirrors the public beta announcement; refine when the
 * official OpenAPI spec lands.
 */
const DEFAULT_BASE_URL = 'https://api.anthropic.com/v1';
const BETA_HEADER_VALUE = 'managed-agents-2026-04-01';
const ANTHROPIC_VERSION = '2023-06-01';
export class AnthropicManagedAgentsError extends Error {
    status;
    body;
    constructor(message, status, body) {
        super(message);
        this.name = 'AnthropicManagedAgentsError';
        this.status = status;
        this.body = body;
    }
}
export class AnthropicManagedAgentsClient {
    apiKey;
    baseUrl;
    fetchImpl;
    constructor(opts = {}) {
        const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
            throw new Error('AnthropicManagedAgentsClient: ANTHROPIC_API_KEY is not set');
        }
        this.apiKey = apiKey;
        this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
        this.fetchImpl = opts.fetchImpl ?? fetch;
    }
    // ── Sessions ────────────────────────────────────────────────────────────
    async createSession(input) {
        if (!input.mission || !input.mission.trim()) {
            throw new Error('createSession: mission is required');
        }
        const body = { mission: input.mission };
        if (input.model)
            body.model = input.model;
        if (input.allowedTools)
            body.tools = input.allowedTools;
        return this.request('POST', '/agents/sessions', body);
    }
    async sendTurn(input) {
        if (!input.sessionId)
            throw new Error('sendTurn: sessionId is required');
        return this.request('POST', `/agents/sessions/${encodeURIComponent(input.sessionId)}/turns`, { input: input.input });
    }
    async getSession(input) {
        if (!input.sessionId)
            throw new Error('getSession: sessionId is required');
        return this.request('GET', `/agents/sessions/${encodeURIComponent(input.sessionId)}`);
    }
    async listSessions() {
        return this.request('GET', '/agents/sessions');
    }
    async closeSession(input) {
        if (!input.sessionId) {
            throw new Error('closeSession: sessionId is required');
        }
        return this.request('DELETE', `/agents/sessions/${encodeURIComponent(input.sessionId)}`);
    }
    // ── Memory ──────────────────────────────────────────────────────────────
    async memoryRead(input) {
        if (!input.sessionId)
            throw new Error('memoryRead: sessionId is required');
        const path = input.key
            ? `/agents/sessions/${encodeURIComponent(input.sessionId)}/memory/${encodeURIComponent(input.key)}`
            : `/agents/sessions/${encodeURIComponent(input.sessionId)}/memory`;
        return this.request('GET', path);
    }
    async memoryWrite(input) {
        if (!input.sessionId)
            throw new Error('memoryWrite: sessionId is required');
        if (!input.key)
            throw new Error('memoryWrite: key is required');
        return this.request('POST', `/agents/sessions/${encodeURIComponent(input.sessionId)}/memory`, { key: input.key, value: input.value });
    }
    // ── Internals ───────────────────────────────────────────────────────────
    async request(method, path, body) {
        const url = `${this.baseUrl}${path}`;
        const headers = {
            'x-api-key': this.apiKey,
            'anthropic-version': ANTHROPIC_VERSION,
            'anthropic-beta': BETA_HEADER_VALUE,
        };
        const init = { method, headers };
        if (body !== undefined && method !== 'GET') {
            headers['content-type'] = 'application/json';
            init.body = JSON.stringify(body);
        }
        let res;
        try {
            res = await this.fetchImpl(url, init);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            throw new AnthropicManagedAgentsError(`network error contacting ${url}: ${msg}`, 0, '');
        }
        const text = await res.text();
        if (!res.ok) {
            throw new AnthropicManagedAgentsError(`Anthropic Managed Agents ${method} ${path} failed: ${res.status} ${res.statusText}`, res.status, text);
        }
        if (!text)
            return {};
        try {
            return JSON.parse(text);
        }
        catch {
            throw new AnthropicManagedAgentsError(`Anthropic Managed Agents ${method} ${path} returned non-JSON body`, res.status, text);
        }
    }
}
//# sourceMappingURL=managed-agents-anthropic.js.map