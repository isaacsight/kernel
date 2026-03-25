// @kernel.chat/tool-forge — Runtime Tool Creation for AI Agents
//
// Create new tools at runtime from structured definitions.
// The agent builds its own tools — no restart, no recompile.
//
// Usage:
//   import { ToolForge } from '@kernel.chat/tool-forge'
//
//   const forge = new ToolForge()
//
//   forge.create({
//     name: 'count_lines',
//     description: 'Count lines in a file',
//     parameters: { path: { type: 'string', description: 'File path', required: true } },
//     implementation: async (args) => {
//       const fs = await import('fs/promises')
//       const content = await fs.readFile(args.path as string, 'utf-8')
//       return `${content.split('\n').length} lines`
//     },
//   })
//
//   const result = await forge.execute('count_lines', { path: './README.md' })
// ── Implementation Templates ───────────────────────────────────────────
/** Pre-built implementation patterns for common tool types */
export const TEMPLATES = {
    /** Tool that runs a shell command */
    shell: (command) => async (args) => {
        const { execSync } = await import('child_process');
        // Substitute {{arg}} placeholders
        let cmd = command;
        for (const [key, value] of Object.entries(args)) {
            cmd = cmd.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
        }
        return execSync(cmd, { encoding: 'utf-8', timeout: 30000 }).trim();
    },
    /** Tool that reads a file and transforms it */
    fileRead: (transform) => async (args) => {
        const fs = await import('fs/promises');
        const content = await fs.readFile(args.path, 'utf-8');
        return transform ? transform(content) : content;
    },
    /** Tool that fetches a URL */
    fetch: (options) => async (args) => {
        const res = await globalThis.fetch(args.url, { headers: options?.headers });
        if (!res.ok)
            throw new Error(`HTTP ${res.status}`);
        return res.text();
    },
    /** Tool that does a JSON API call */
    jsonApi: (baseUrl) => async (args) => {
        const path = args.path ?? '';
        const res = await globalThis.fetch(`${baseUrl}${path}`, {
            method: args.method ?? 'GET',
            headers: { 'Content-Type': 'application/json' },
            body: args.body ? JSON.stringify(args.body) : undefined,
        });
        return JSON.stringify(await res.json(), null, 2);
    },
    /** Tool that computes something from input */
    compute: (fn) => async (args) => {
        return fn(args.input);
    },
};
// ── Core Forge ─────────────────────────────────────────────────────────
export class ToolForge {
    tools = new Map();
    metrics = new Map();
    /**
     * Create and register a new tool.
     * Throws if a tool with the same name already exists (use replace to overwrite).
     */
    create(def) {
        if (this.tools.has(def.name)) {
            throw new Error(`Tool "${def.name}" already exists. Use forge.replace() to overwrite.`);
        }
        def.createdAt = def.createdAt ?? new Date().toISOString();
        def.createdBy = def.createdBy ?? 'forge';
        def.tags = def.tags ?? [];
        this.tools.set(def.name, def);
        this.metrics.set(def.name, {
            name: def.name,
            calls: 0,
            errors: 0,
            totalDurationMs: 0,
            avgDurationMs: 0,
            lastCalled: '',
        });
    }
    /** Replace an existing tool or create a new one */
    replace(def) {
        this.tools.delete(def.name);
        this.create(def);
    }
    /** Remove a tool */
    remove(name) {
        this.metrics.delete(name);
        return this.tools.delete(name);
    }
    /** Check if a tool exists */
    has(name) {
        return this.tools.has(name);
    }
    /** Get a tool definition */
    get(name) {
        return this.tools.get(name);
    }
    /** List all tools */
    list() {
        return Array.from(this.tools.values()).map(t => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters,
            tags: t.tags ?? [],
            createdBy: t.createdBy ?? 'forge',
            createdAt: t.createdAt ?? '',
            metrics: this.metrics.get(t.name) ?? {
                name: t.name, calls: 0, errors: 0,
                totalDurationMs: 0, avgDurationMs: 0, lastCalled: '',
            },
        }));
    }
    /** List tools filtered by tag */
    listByTag(tag) {
        return this.list().filter(t => t.tags.includes(tag));
    }
    /**
     * Execute a tool by name with arguments.
     * Validates required parameters, applies defaults, enforces timeout.
     */
    async execute(name, args = {}) {
        const tool = this.tools.get(name);
        if (!tool) {
            return { name, result: '', error: `Unknown tool: ${name}`, durationMs: 0 };
        }
        // Validate required parameters
        for (const [key, param] of Object.entries(tool.parameters)) {
            if (param.required && !(key in args)) {
                return { name, result: '', error: `Missing required parameter: ${key}`, durationMs: 0 };
            }
            // Apply defaults
            if (!(key in args) && param.default !== undefined) {
                args[key] = param.default;
            }
        }
        const timeout = tool.timeout ?? 30000;
        const start = Date.now();
        try {
            const result = await Promise.race([
                tool.implementation(args),
                new Promise((_, reject) => setTimeout(() => reject(new Error(`Tool "${name}" timed out after ${timeout}ms`)), timeout)),
            ]);
            const durationMs = Date.now() - start;
            this.recordMetric(name, durationMs, false);
            return { name, result, durationMs };
        }
        catch (err) {
            const durationMs = Date.now() - start;
            this.recordMetric(name, durationMs, true);
            return { name, result: '', error: err instanceof Error ? err.message : String(err), durationMs };
        }
    }
    recordMetric(name, durationMs, isError) {
        const m = this.metrics.get(name);
        if (!m)
            return;
        m.calls++;
        if (isError)
            m.errors++;
        m.totalDurationMs += durationMs;
        m.avgDurationMs = m.totalDurationMs / m.calls;
        m.lastCalled = new Date().toISOString();
    }
    /** Get metrics for a tool or all tools */
    getMetrics(name) {
        if (name) {
            const m = this.metrics.get(name);
            return m ? [m] : [];
        }
        return Array.from(this.metrics.values()).sort((a, b) => b.calls - a.calls);
    }
    // ── Persistence ──
    /**
     * Export tool definitions as JSON (without implementations).
     * Implementations are functions and can't be serialized — only metadata is saved.
     */
    toJSON() {
        return JSON.stringify(this.list(), null, 2);
    }
    /** Save manifests to a file */
    save(path) {
        const { writeFileSync, mkdirSync } = require('fs');
        const { dirname } = require('path');
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, this.toJSON());
    }
    // ── Quick Creation Helpers ──
    /** Create a shell-command tool in one line */
    createShell(name, description, command, params) {
        this.create({
            name,
            description,
            parameters: params ?? {},
            implementation: TEMPLATES.shell(command),
            tags: ['shell'],
        });
    }
    /** Create a file-reading tool in one line */
    createFileReader(name, description, transform) {
        this.create({
            name,
            description,
            parameters: { path: { type: 'string', description: 'File path', required: true } },
            implementation: TEMPLATES.fileRead(transform),
            tags: ['file'],
        });
    }
    /** Create a URL-fetching tool in one line */
    createFetcher(name, description, headers) {
        this.create({
            name,
            description,
            parameters: { url: { type: 'string', description: 'URL to fetch', required: true } },
            implementation: TEMPLATES.fetch({ headers }),
            tags: ['fetch'],
        });
    }
    /** Create a JSON API tool in one line */
    createApi(name, description, baseUrl) {
        this.create({
            name,
            description,
            parameters: {
                path: { type: 'string', description: 'API path', default: '' },
                method: { type: 'string', description: 'HTTP method', default: 'GET' },
                body: { type: 'object', description: 'Request body (for POST/PUT)' },
            },
            implementation: TEMPLATES.jsonApi(baseUrl),
            tags: ['api'],
        });
    }
    /** Get a human-readable summary */
    summary() {
        const tools = this.list();
        const lines = [
            'Tool Forge',
            '═'.repeat(40),
            `${tools.length} tools registered`,
            '',
        ];
        for (const t of tools) {
            const params = Object.keys(t.parameters).join(', ') || 'none';
            lines.push(`  ${t.name} (${params}) — ${t.description.slice(0, 60)}`);
            if (t.metrics.calls > 0) {
                lines.push(`    ${t.metrics.calls} calls, ${t.metrics.errors} errors, avg ${t.metrics.avgDurationMs.toFixed(0)}ms`);
            }
        }
        return lines.join('\n');
    }
}
//# sourceMappingURL=index.js.map