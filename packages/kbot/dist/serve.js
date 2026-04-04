// kbot Serve — HTTP/HTTPS server that exposes all tools over REST
//
// Usage:
//   kbot serve                    # Start on default port 7437
//   kbot serve --port 3000        # Custom port
//   kbot serve --token mysecret   # Require auth token
//   kbot serve --https            # HTTPS with auto-generated self-signed cert
//   kbot serve --cert x.pem --key x.key  # HTTPS with custom cert
//
// Endpoints:
//   GET  /health          — Health check
//   GET  /tools           — List all registered tools (schemas only)
//   POST /tools/:name     — Execute a tool by name
//   POST /execute         — Execute a tool { name, args }
//   POST /stream          — SSE streaming agent execution
//   GET  /metrics         — Tool execution metrics
import { createServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { createRequire } from 'node:module';
import { registerAllTools, getAllTools, executeTool, getToolDefinitionsForApi, getToolMetrics } from './tools/index.js';
import { extractMcpAppFromText, renderMcpApp, listAppCapableTools } from './mcp-apps.js';
import { printInfo, printSuccess } from './ui.js';
import { ResponseStream } from './streaming.js';
import { runAgent } from './agent.js';
import { destroySession } from './memory.js';
import { randomUUID } from 'node:crypto';
import { mountA2ARoutes } from './a2a.js';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
const __require = createRequire(import.meta.url);
const VERSION = __require('../package.json').version;
function cors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}
function json(res, status, data) {
    cors(res);
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}
function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
        req.on('error', reject);
    });
}
/** Generate or load a self-signed TLS certificate for localhost */
function ensureSelfSignedCert() {
    const certDir = join(homedir(), '.kbot', 'certs');
    const certPath = join(certDir, 'localhost.crt');
    const keyPath = join(certDir, 'localhost.key');
    if (existsSync(certPath) && existsSync(keyPath)) {
        return { cert: readFileSync(certPath, 'utf-8'), key: readFileSync(keyPath, 'utf-8') };
    }
    mkdirSync(certDir, { recursive: true });
    printInfo('Generating self-signed TLS certificate for localhost...');
    execSync(`openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 ` +
        `-nodes -days 365 -subj "/CN=localhost" ` +
        `-addext "subjectAltName=DNS:localhost,IP:127.0.0.1" ` +
        `-keyout "${keyPath}" -out "${certPath}"`, { stdio: 'pipe' });
    printSuccess('Certificate generated at ~/.kbot/certs/');
    return { cert: readFileSync(certPath, 'utf-8'), key: readFileSync(keyPath, 'utf-8') };
}
export async function startServe(options) {
    // Register all tools before starting
    printInfo('Registering tools...');
    await registerAllTools({ computerUse: options.computerUse });
    const tools = getAllTools();
    printSuccess(`${tools.length} tools registered`);
    // Determine TLS config
    const useTls = !!(options.https || options.cert || options.key);
    let tlsOpts;
    if (useTls) {
        if (options.cert && options.key) {
            tlsOpts = { cert: readFileSync(options.cert, 'utf-8'), key: readFileSync(options.key, 'utf-8') };
        }
        else {
            tlsOpts = ensureSelfSignedCert();
        }
    }
    const protocol = useTls ? 'https' : 'http';
    const handler = async (req, res) => {
        // CORS preflight
        if (req.method === 'OPTIONS') {
            cors(res);
            res.writeHead(204);
            res.end();
            return;
        }
        // Auth check
        if (options.token) {
            const auth = req.headers.authorization;
            const bearerToken = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
            const queryToken = new URL(req.url || '/', `http://localhost`).searchParams.get('token');
            if (bearerToken !== options.token && queryToken !== options.token) {
                json(res, 401, { error: 'Unauthorized' });
                return;
            }
        }
        const url = new URL(req.url || '/', `${protocol}://localhost:${options.port}`);
        const path = url.pathname;
        try {
            // GET /health
            if (path === '/health' && req.method === 'GET') {
                json(res, 200, {
                    status: 'ok',
                    version: VERSION,
                    tools: tools.length,
                    uptime: process.uptime(),
                });
                return;
            }
            // GET /tools — list all tools with schemas
            if (path === '/tools' && req.method === 'GET') {
                const tier = url.searchParams.get('tier') || 'free';
                const schemas = getToolDefinitionsForApi(tier);
                json(res, 200, { tools: schemas, count: schemas.length });
                return;
            }
            // GET /metrics — tool execution metrics
            if (path === '/metrics' && req.method === 'GET') {
                json(res, 200, { metrics: getToolMetrics() });
                return;
            }
            // POST /stream — SSE streaming agent execution
            if (path === '/stream' && req.method === 'POST') {
                const body = JSON.parse(await readBody(req));
                const { message, agent, model, thinking } = body;
                if (!message) {
                    json(res, 400, { error: 'Missing "message" field' });
                    return;
                }
                cors(res);
                res.writeHead(200, {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                });
                const stream = new ResponseStream();
                stream.on(ResponseStream.createSSEListener(res));
                // Isolate conversation history per request
                const sessionId = `serve_${randomUUID()}`;
                try {
                    await runAgent(message, {
                        responseStream: stream,
                        stream: true,
                        agent,
                        model,
                        thinking,
                        sessionId,
                    });
                }
                catch (err) {
                    stream.emit({
                        type: 'error',
                        message: err instanceof Error ? err.message : String(err),
                    });
                }
                finally {
                    destroySession(sessionId);
                }
                res.end();
                return;
            }
            // GET /apps — list MCP App-capable tools
            if (path === '/apps' && req.method === 'GET') {
                const appTools = listAppCapableTools();
                json(res, 200, { tools: appTools, count: appTools.length });
                return;
            }
            // POST /execute — execute a tool
            if (path === '/execute' && req.method === 'POST') {
                const body = JSON.parse(await readBody(req));
                const { name, args } = body;
                if (!name) {
                    json(res, 400, { error: 'Missing "name" field' });
                    return;
                }
                const result = await executeTool({
                    id: `serve_${Date.now()}`,
                    name,
                    arguments: args || {},
                });
                // Check for MCP App content in the result
                const appResult = !result.error ? extractMcpAppFromText(result.result) : null;
                if (appResult) {
                    const rendered = await renderMcpApp(appResult, { renderMode: 'inline', maxHtmlSize: 1_048_576, sandbox: true });
                    json(res, 200, {
                        result: rendered.text,
                        html: rendered.rendered,
                        title: appResult.title,
                        width: appResult.width,
                        height: appResult.height,
                        mcp_app: true,
                        error: false,
                        duration_ms: result.duration_ms,
                    });
                    return;
                }
                json(res, result.error ? 500 : 200, {
                    result: result.result,
                    error: result.error || false,
                    duration_ms: result.duration_ms,
                });
                return;
            }
            // POST /tools/:name — execute tool by URL path
            const toolMatch = path.match(/^\/tools\/([a-z_]+)$/);
            if (toolMatch && req.method === 'POST') {
                const toolName = toolMatch[1];
                let args = {};
                try {
                    const rawBody = await readBody(req);
                    if (rawBody.trim())
                        args = JSON.parse(rawBody);
                }
                catch { /* empty body is fine */ }
                const result = await executeTool({
                    id: `serve_${Date.now()}`,
                    name: toolName,
                    arguments: args,
                });
                // Check for MCP App content in the result
                const toolAppResult = !result.error ? extractMcpAppFromText(result.result) : null;
                if (toolAppResult) {
                    const rendered = await renderMcpApp(toolAppResult, { renderMode: 'inline', maxHtmlSize: 1_048_576, sandbox: true });
                    json(res, 200, {
                        result: rendered.text,
                        html: rendered.rendered,
                        title: toolAppResult.title,
                        width: toolAppResult.width,
                        height: toolAppResult.height,
                        mcp_app: true,
                        error: false,
                        duration_ms: result.duration_ms,
                    });
                    return;
                }
                json(res, result.error ? 500 : 200, {
                    result: result.result,
                    error: result.error || false,
                    duration_ms: result.duration_ms,
                });
                return;
            }
            // 404
            json(res, 404, { error: 'Not found' });
        }
        catch (err) {
            json(res, 500, { error: err instanceof Error ? err.message : 'Internal error' });
        }
    };
    const server = useTls
        ? createHttpsServer(tlsOpts, handler)
        : createServer(handler);
    // Mount A2A protocol routes (Agent Card + task endpoints)
    // Cast needed: https.Server and http.Server share the same request event API
    mountA2ARoutes(server, {
        port: options.port,
        endpointUrl: `${protocol}://localhost:${options.port}`,
        token: options.token,
    });
    const baseUrl = `${protocol}://localhost:${options.port}`;
    server.listen(options.port, () => {
        printSuccess(`kbot serve running on ${baseUrl}`);
        if (useTls) {
            printInfo('  TLS: self-signed cert (browsers will warn — safe for local connectors)');
        }
        printInfo(`  GET  /health                — Health check`);
        printInfo(`  GET  /tools                 — List ${tools.length} tools`);
        printInfo(`  POST /execute               — Execute a tool`);
        printInfo(`  POST /stream                — SSE streaming agent`);
        printInfo(`  POST /tools/:name           — Execute by name`);
        printInfo(`  GET  /metrics               — Execution metrics`);
        printInfo(`  GET  /apps                  — List MCP App-capable tools`);
        printInfo(`  GET  /.well-known/agent.json — A2A Agent Card`);
        printInfo(`  POST /a2a                   — A2A JSON-RPC endpoint`);
        printInfo(`  POST /a2a/tasks             — A2A submit task (REST)`);
        printInfo(`  GET  /a2a/tasks/:id         — A2A task status (REST)`);
        if (options.token) {
            printInfo(`  Auth: Bearer token required`);
        }
        printInfo('');
        printInfo('Connect from kernel.chat:');
        printInfo(`  connectKbot('${baseUrl}')`);
    });
    // Graceful shutdown
    const shutdown = () => {
        printInfo('\nShutting down kbot serve...');
        server.close();
        process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    // Keep process alive
    await new Promise(() => { });
}
//# sourceMappingURL=serve.js.map