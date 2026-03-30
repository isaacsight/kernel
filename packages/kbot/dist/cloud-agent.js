// kbot Cloud Agent — Persistent background agent execution over HTTP
//
// Extends `kbot serve` with long-running agent orchestration:
//   kbot serve --cloud
//
// Endpoints:
//   POST   /agents             — Create a cloud agent
//   GET    /agents             — List all agents
//   GET    /agents/:id         — Get agent status + results
//   POST   /agents/:id/pause   — Pause agent
//   POST   /agents/:id/resume  — Resume agent
//   DELETE /agents/:id         — Kill agent
//   POST   /agents/:id/message — Send a message to running agent
//   GET    /agents/:id/stream  — SSE stream of agent events
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { runAgent } from './agent.js';
import { ResponseStream } from './streaming.js';
// ── Constants ──
const MAX_CONCURRENT_AGENTS = 4;
const PERSIST_DIR = join(homedir(), '.kbot', 'cloud-agents');
const CRON_CHECK_INTERVAL_MS = 60_000; // check cron schedules every 60s
// ── State ──
const agents = new Map();
const runningAbortControllers = new Map();
const sseListeners = new Map();
let cronIntervalId = null;
// ── Persistence ──
function ensurePersistDir() {
    if (!existsSync(PERSIST_DIR)) {
        mkdirSync(PERSIST_DIR, { recursive: true });
    }
}
async function persistAgent(agent) {
    ensurePersistDir();
    const filePath = join(PERSIST_DIR, `${agent.id}.json`);
    await writeFile(filePath, JSON.stringify(agent, null, 2), 'utf-8');
}
async function loadPersistedAgents() {
    ensurePersistDir();
    const files = readdirSync(PERSIST_DIR).filter(f => f.endsWith('.json'));
    for (const file of files) {
        try {
            const raw = await readFile(join(PERSIST_DIR, file), 'utf-8');
            const agent = JSON.parse(raw);
            // Normalize older persisted agents that lack pendingMessages
            if (!agent.pendingMessages)
                agent.pendingMessages = [];
            agents.set(agent.id, agent);
        }
        catch {
            // Skip corrupted files
        }
    }
}
function removePersistedAgent(id) {
    const filePath = join(PERSIST_DIR, `${id}.json`);
    try {
        unlinkSync(filePath);
    }
    catch { /* already gone */ }
}
// ── SSE Helpers ──
function emitSSE(agentId, event, data) {
    const listeners = sseListeners.get(agentId);
    if (!listeners || listeners.size === 0)
        return;
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of listeners) {
        try {
            res.write(payload);
        }
        catch {
            listeners.delete(res);
        }
    }
}
function addSSEListener(agentId, res) {
    if (!sseListeners.has(agentId))
        sseListeners.set(agentId, new Set());
    sseListeners.get(agentId).add(res);
}
function removeSSEListener(agentId, res) {
    sseListeners.get(agentId)?.delete(res);
}
// ── Webhook ──
async function postWebhook(url, payload) {
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(15_000),
        });
    }
    catch {
        // Webhook delivery is best-effort; don't crash the agent
    }
}
/**
 * Parse a standard 5-field cron expression into expanded arrays.
 *
 * Supports:
 *   - Wildcards: *
 *   - Ranges: 1-5
 *   - Steps: *\/5, 1-10/2
 *   - Lists: 1,3,5
 *   - Combinations: 1-5,10,15-20/2
 *
 * Fields: minute (0-59), hour (0-23), day-of-month (1-31), month (1-12), day-of-week (0-6, Sun=0)
 */
export function parseCron(expr) {
    const parts = expr.trim().split(/\s+/);
    if (parts.length !== 5) {
        throw new Error(`Invalid cron expression: expected 5 fields, got ${parts.length}`);
    }
    const ranges = [
        [0, 59], // minute
        [0, 23], // hour
        [1, 31], // dayOfMonth
        [1, 12], // month
        [0, 6], // dayOfWeek
    ];
    function expandField(field, min, max) {
        const values = new Set();
        for (const segment of field.split(',')) {
            // Handle step: */N or range/N
            const stepMatch = segment.match(/^(.+)\/(\d+)$/);
            const step = stepMatch ? parseInt(stepMatch[2], 10) : 1;
            const base = stepMatch ? stepMatch[1] : segment;
            let rangeStart = min;
            let rangeEnd = max;
            if (base === '*') {
                // full range
            }
            else if (base.includes('-')) {
                const [lo, hi] = base.split('-').map(Number);
                if (isNaN(lo) || isNaN(hi) || lo < min || hi > max || lo > hi) {
                    throw new Error(`Invalid cron range: ${base} (valid: ${min}-${max})`);
                }
                rangeStart = lo;
                rangeEnd = hi;
            }
            else {
                const val = parseInt(base, 10);
                if (isNaN(val) || val < min || val > max) {
                    throw new Error(`Invalid cron value: ${base} (valid: ${min}-${max})`);
                }
                if (step === 1) {
                    values.add(val);
                    continue;
                }
                rangeStart = val;
                rangeEnd = max;
            }
            for (let i = rangeStart; i <= rangeEnd; i += step) {
                values.add(i);
            }
        }
        return Array.from(values).sort((a, b) => a - b);
    }
    return {
        minute: expandField(parts[0], ranges[0][0], ranges[0][1]),
        hour: expandField(parts[1], ranges[1][0], ranges[1][1]),
        dayOfMonth: expandField(parts[2], ranges[2][0], ranges[2][1]),
        month: expandField(parts[3], ranges[3][0], ranges[3][1]),
        dayOfWeek: expandField(parts[4], ranges[4][0], ranges[4][1]),
    };
}
export function shouldRunAt(cron, date) {
    return (cron.minute.includes(date.getMinutes()) &&
        cron.hour.includes(date.getHours()) &&
        cron.month.includes(date.getMonth() + 1) &&
        // Standard cron: if both day-of-month and day-of-week are restricted, match either
        (cron.dayOfMonth.includes(date.getDate()) || cron.dayOfWeek.includes(date.getDay())));
}
// ── Agent Execution ──
function countRunningAgents() {
    let count = 0;
    for (const a of agents.values()) {
        if (a.status === 'running')
            count++;
    }
    return count;
}
function promoteQueuedAgent() {
    for (const agent of agents.values()) {
        if (agent.status === 'queued') {
            executeAgent(agent);
            return;
        }
    }
}
async function executeAgent(agent) {
    agent.status = 'running';
    agent.lastActiveAt = new Date().toISOString();
    emitSSE(agent.id, 'status', { status: 'running', iteration: agent.currentIteration });
    await persistAgent(agent);
    const ac = new AbortController();
    runningAbortControllers.set(agent.id, ac);
    const iterations = agent.maxIterations ?? 1;
    try {
        while (agent.currentIteration < iterations && agent.status === 'running') {
            const iterationIndex = agent.currentIteration;
            const startTime = Date.now();
            // Build the task message, appending pending messages if any
            let taskMessage = agent.task;
            if (agent.pendingMessages.length > 0) {
                taskMessage += '\n\n--- Additional context ---\n' + agent.pendingMessages.join('\n');
                agent.pendingMessages = [];
            }
            // Iteration context for multi-iteration agents
            if (iterations > 1) {
                taskMessage = `[Iteration ${iterationIndex + 1}/${iterations}] ${taskMessage}`;
            }
            emitSSE(agent.id, 'iteration_start', { iteration: iterationIndex + 1, total: iterations });
            // Create a ResponseStream to capture tool calls and content
            const stream = new ResponseStream();
            const toolCalls = [];
            stream.on((event) => {
                if (event.type === 'tool_call_start') {
                    toolCalls.push(event.name);
                    emitSSE(agent.id, 'tool_call', { tool: event.name, id: event.id });
                }
                if (event.type === 'tool_call_end') {
                    emitSSE(agent.id, 'tool_call_end', { tool: event.name, id: event.id });
                }
                if (event.type === 'content_delta') {
                    emitSSE(agent.id, 'content_delta', { delta: event.text });
                }
                if (event.type === 'error') {
                    emitSSE(agent.id, 'error', { error: event.message });
                }
            });
            const agentOpts = {
                agent: agent.agent,
                stream: true,
                responseStream: stream,
            };
            let response;
            try {
                response = await runAgent(taskMessage, agentOpts);
            }
            catch (err) {
                // If this is an abort (paused or killed), stop cleanly
                if (ac.signal.aborted)
                    return;
                const errorMsg = err instanceof Error ? err.message : String(err);
                agent.error = errorMsg;
                agent.status = 'failed';
                agent.lastActiveAt = new Date().toISOString();
                emitSSE(agent.id, 'error', { error: errorMsg, iteration: iterationIndex + 1 });
                emitSSE(agent.id, 'status', { status: 'failed' });
                await persistAgent(agent);
                runningAbortControllers.delete(agent.id);
                promoteQueuedAgent();
                return;
            }
            const duration = Date.now() - startTime;
            const result = {
                iteration: iterationIndex + 1,
                content: response.content,
                toolCalls,
                tokens: {
                    input: response.usage?.input_tokens ?? 0,
                    output: response.usage?.output_tokens ?? 0,
                },
                duration,
                timestamp: new Date().toISOString(),
            };
            agent.results.push(result);
            agent.currentIteration = iterationIndex + 1;
            agent.lastActiveAt = new Date().toISOString();
            emitSSE(agent.id, 'iteration_complete', {
                iteration: iterationIndex + 1,
                content: response.content.slice(0, 500), // preview
                toolCalls: toolCalls.length,
                duration,
            });
            // Webhook delivery
            if (agent.webhook) {
                await postWebhook(agent.webhook, {
                    agentId: agent.id,
                    agentName: agent.name,
                    event: 'iteration_complete',
                    result,
                });
            }
            await persistAgent(agent);
            // Check if paused during iteration
            if (agent.status !== 'running')
                return;
        }
        // All iterations completed
        if (agent.status === 'running') {
            agent.status = 'completed';
            agent.lastActiveAt = new Date().toISOString();
            emitSSE(agent.id, 'status', { status: 'completed' });
            if (agent.webhook) {
                await postWebhook(agent.webhook, {
                    agentId: agent.id,
                    agentName: agent.name,
                    event: 'completed',
                    totalIterations: agent.currentIteration,
                    results: agent.results,
                });
            }
            await persistAgent(agent);
        }
    }
    finally {
        runningAbortControllers.delete(agent.id);
        promoteQueuedAgent();
    }
}
// ── CRUD Operations ──
export async function createCloudAgent(req) {
    if (!req.task || req.task.trim().length === 0) {
        throw new Error('Missing required field: task');
    }
    // Validate cron expression if provided
    if (req.schedule) {
        parseCron(req.schedule); // throws on invalid
    }
    const agent = {
        id: randomUUID(),
        name: req.name || `agent-${Date.now().toString(36)}`,
        status: 'queued',
        task: req.task,
        agent: req.agent,
        schedule: req.schedule,
        webhook: req.webhook,
        maxIterations: req.maxIterations ?? 1,
        currentIteration: 0,
        results: [],
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        pendingMessages: [],
    };
    agents.set(agent.id, agent);
    await persistAgent(agent);
    // If scheduled, don't start immediately — the cron scheduler will trigger it
    if (agent.schedule) {
        agent.status = 'paused';
        emitSSE(agent.id, 'status', { status: 'paused', reason: 'scheduled' });
        await persistAgent(agent);
        return agent;
    }
    // Start immediately if under concurrency limit
    if (countRunningAgents() < MAX_CONCURRENT_AGENTS) {
        // Fire and forget — executeAgent manages its own lifecycle
        executeAgent(agent).catch(() => { });
    }
    else {
        emitSSE(agent.id, 'status', { status: 'queued', position: countQueuePosition(agent.id) });
    }
    return agent;
}
export function listCloudAgents() {
    return Array.from(agents.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
export function getCloudAgent(id) {
    return agents.get(id);
}
export async function pauseCloudAgent(id) {
    const agent = agents.get(id);
    if (!agent)
        throw new Error(`Agent not found: ${id}`);
    if (agent.status !== 'running' && agent.status !== 'queued') {
        throw new Error(`Cannot pause agent in status: ${agent.status}`);
    }
    agent.status = 'paused';
    agent.lastActiveAt = new Date().toISOString();
    // Abort the running execution
    const ac = runningAbortControllers.get(id);
    if (ac) {
        ac.abort();
        runningAbortControllers.delete(id);
    }
    emitSSE(id, 'status', { status: 'paused' });
    await persistAgent(agent);
    return agent;
}
export async function resumeCloudAgent(id) {
    const agent = agents.get(id);
    if (!agent)
        throw new Error(`Agent not found: ${id}`);
    if (agent.status !== 'paused') {
        throw new Error(`Cannot resume agent in status: ${agent.status}`);
    }
    if (countRunningAgents() < MAX_CONCURRENT_AGENTS) {
        executeAgent(agent).catch(() => { });
    }
    else {
        agent.status = 'queued';
        emitSSE(id, 'status', { status: 'queued', position: countQueuePosition(id) });
        await persistAgent(agent);
    }
    return agent;
}
export async function killCloudAgent(id) {
    const agent = agents.get(id);
    if (!agent)
        throw new Error(`Agent not found: ${id}`);
    // Abort if running
    const ac = runningAbortControllers.get(id);
    if (ac) {
        ac.abort();
        runningAbortControllers.delete(id);
    }
    // Close SSE connections
    const listeners = sseListeners.get(id);
    if (listeners) {
        for (const res of listeners) {
            try {
                res.end();
            }
            catch { /* ignore */ }
        }
        sseListeners.delete(id);
    }
    agents.delete(id);
    removePersistedAgent(id);
}
export function sendMessageToAgent(id, message) {
    const agent = agents.get(id);
    if (!agent)
        throw new Error(`Agent not found: ${id}`);
    if (agent.status !== 'running' && agent.status !== 'paused') {
        throw new Error(`Cannot send message to agent in status: ${agent.status}`);
    }
    agent.pendingMessages.push(message);
    emitSSE(id, 'message_queued', { message: message.slice(0, 200) });
    return agent;
}
// ── Queue Helpers ──
function countQueuePosition(id) {
    let pos = 0;
    for (const agent of agents.values()) {
        if (agent.status === 'queued') {
            pos++;
            if (agent.id === id)
                return pos;
        }
    }
    return pos;
}
// ── Cron Scheduler ──
function startCronScheduler() {
    if (cronIntervalId)
        return;
    cronIntervalId = setInterval(() => {
        const now = new Date();
        for (const agent of agents.values()) {
            if (!agent.schedule || agent.status !== 'paused')
                continue;
            try {
                const cron = parseCron(agent.schedule);
                if (shouldRunAt(cron, now)) {
                    // Reset iteration for a new scheduled run
                    agent.currentIteration = 0;
                    agent.results = [];
                    agent.error = undefined;
                    if (countRunningAgents() < MAX_CONCURRENT_AGENTS) {
                        executeAgent(agent).catch(() => { });
                    }
                    else {
                        agent.status = 'queued';
                        emitSSE(agent.id, 'status', { status: 'queued', reason: 'cron_triggered' });
                        persistAgent(agent).catch(() => { });
                    }
                }
            }
            catch {
                // Invalid cron — skip silently, it was validated on creation
            }
        }
    }, CRON_CHECK_INTERVAL_MS);
    // Don't let the interval keep the process alive
    if (cronIntervalId && typeof cronIntervalId === 'object' && 'unref' in cronIntervalId) {
        cronIntervalId.unref();
    }
}
function stopCronScheduler() {
    if (cronIntervalId) {
        clearInterval(cronIntervalId);
        cronIntervalId = null;
    }
}
// ── HTTP Route Handler ──
function cors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
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
function stripSensitiveFields(agent) {
    // Return a plain object without internal pendingMessages when listing
    const { pendingMessages: _pm, ...rest } = agent;
    return {
        ...rest,
        pendingMessageCount: agent.pendingMessages.length,
    };
}
/**
 * Returns an async route handler function that can be mounted in the kbot serve HTTP server.
 *
 * Usage in serve.ts:
 *   const cloudRoutes = getCloudAgentRoutes()
 *   // Inside the request handler:
 *   if (await cloudRoutes(req, res)) return // handled
 */
export function getCloudAgentRoutes() {
    // Initialize: load persisted agents and start cron scheduler
    let initialized = false;
    let initPromise = null;
    async function ensureInit() {
        if (initialized)
            return;
        if (!initPromise) {
            initPromise = (async () => {
                await loadPersistedAgents();
                startCronScheduler();
                // Resume any agents that were running when server last stopped
                for (const agent of agents.values()) {
                    if (agent.status === 'running') {
                        // They weren't gracefully stopped — mark as paused so user can resume
                        agent.status = 'paused';
                        agent.error = 'Server restarted — agent paused. Resume with POST /agents/:id/resume';
                        await persistAgent(agent);
                    }
                }
                initialized = true;
            })();
        }
        await initPromise;
    }
    return async (req, res) => {
        const url = new URL(req.url || '/', 'http://localhost');
        const path = url.pathname;
        // Only handle /agents routes
        if (!path.startsWith('/agents'))
            return false;
        // CORS preflight
        if (req.method === 'OPTIONS') {
            cors(res);
            res.writeHead(204);
            res.end();
            return true;
        }
        await ensureInit();
        try {
            // POST /agents — create a cloud agent
            if (path === '/agents' && req.method === 'POST') {
                const body = JSON.parse(await readBody(req));
                const agent = await createCloudAgent(body);
                json(res, 201, stripSensitiveFields(agent));
                return true;
            }
            // GET /agents — list all agents
            if (path === '/agents' && req.method === 'GET') {
                const status = url.searchParams.get('status') || undefined;
                let list = listCloudAgents();
                if (status) {
                    list = list.filter(a => a.status === status);
                }
                json(res, 200, {
                    agents: list.map(stripSensitiveFields),
                    count: list.length,
                    running: countRunningAgents(),
                    maxConcurrent: MAX_CONCURRENT_AGENTS,
                });
                return true;
            }
            // Match /agents/:id or /agents/:id/action
            const idMatch = path.match(/^\/agents\/([a-f0-9-]{36})(?:\/(\w+))?$/);
            if (!idMatch) {
                json(res, 404, { error: 'Not found' });
                return true;
            }
            const agentId = idMatch[1];
            const action = idMatch[2]; // pause, resume, message, stream — or undefined for GET/DELETE
            // GET /agents/:id — get agent details
            if (!action && req.method === 'GET') {
                const agent = getCloudAgent(agentId);
                if (!agent) {
                    json(res, 404, { error: `Agent not found: ${agentId}` });
                    return true;
                }
                json(res, 200, stripSensitiveFields(agent));
                return true;
            }
            // DELETE /agents/:id — kill agent
            if (!action && req.method === 'DELETE') {
                try {
                    await killCloudAgent(agentId);
                    json(res, 200, { ok: true, deleted: agentId });
                }
                catch (err) {
                    json(res, 404, { error: err instanceof Error ? err.message : String(err) });
                }
                return true;
            }
            // POST /agents/:id/pause
            if (action === 'pause' && req.method === 'POST') {
                try {
                    const agent = await pauseCloudAgent(agentId);
                    json(res, 200, stripSensitiveFields(agent));
                }
                catch (err) {
                    json(res, 400, { error: err instanceof Error ? err.message : String(err) });
                }
                return true;
            }
            // POST /agents/:id/resume
            if (action === 'resume' && req.method === 'POST') {
                try {
                    const agent = await resumeCloudAgent(agentId);
                    json(res, 200, stripSensitiveFields(agent));
                }
                catch (err) {
                    json(res, 400, { error: err instanceof Error ? err.message : String(err) });
                }
                return true;
            }
            // POST /agents/:id/message — inject a message
            if (action === 'message' && req.method === 'POST') {
                const body = JSON.parse(await readBody(req));
                const message = body.message;
                if (!message) {
                    json(res, 400, { error: 'Missing "message" field' });
                    return true;
                }
                try {
                    const agent = sendMessageToAgent(agentId, message);
                    json(res, 200, {
                        ok: true,
                        pendingMessageCount: agent.pendingMessages.length,
                    });
                }
                catch (err) {
                    json(res, 400, { error: err instanceof Error ? err.message : String(err) });
                }
                return true;
            }
            // GET /agents/:id/stream — SSE event stream
            if (action === 'stream' && req.method === 'GET') {
                const agent = getCloudAgent(agentId);
                if (!agent) {
                    json(res, 404, { error: `Agent not found: ${agentId}` });
                    return true;
                }
                cors(res);
                res.writeHead(200, {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                });
                // Send current state as initial event
                res.write(`event: connected\ndata: ${JSON.stringify({
                    agentId: agent.id,
                    name: agent.name,
                    status: agent.status,
                    currentIteration: agent.currentIteration,
                    totalIterations: agent.maxIterations ?? 1,
                })}\n\n`);
                addSSEListener(agentId, res);
                // Keep-alive ping every 30s
                const pingInterval = setInterval(() => {
                    try {
                        res.write(': ping\n\n');
                    }
                    catch {
                        clearInterval(pingInterval);
                        removeSSEListener(agentId, res);
                    }
                }, 30_000);
                req.on('close', () => {
                    clearInterval(pingInterval);
                    removeSSEListener(agentId, res);
                });
                return true;
            }
            json(res, 404, { error: `Unknown action: ${action}` });
            return true;
        }
        catch (err) {
            json(res, 500, { error: err instanceof Error ? err.message : String(err) });
            return true;
        }
    };
}
// ── Cleanup ──
export function shutdownCloudAgents() {
    stopCronScheduler();
    // Abort all running agents
    for (const [id, ac] of runningAbortControllers) {
        ac.abort();
        const agent = agents.get(id);
        if (agent) {
            agent.status = 'paused';
            agent.error = 'Server shutting down';
            // Synchronous write on shutdown — best effort
            try {
                writeFileSync(join(PERSIST_DIR, `${id}.json`), JSON.stringify(agent, null, 2), 'utf-8');
            }
            catch { /* best effort */ }
        }
    }
    runningAbortControllers.clear();
    // Close all SSE connections
    for (const listeners of sseListeners.values()) {
        for (const res of listeners) {
            try {
                res.end();
            }
            catch { /* ignore */ }
        }
    }
    sseListeners.clear();
}
// ── Re-exports for convenience ──
// parseCron, shouldRunAt, ParsedCron are exported at their declaration sites above
// CloudAgent, AgentResult are exported at their interface declarations above
// createCloudAgent, listCloudAgents, getCloudAgent, pauseCloudAgent,
// resumeCloudAgent, killCloudAgent, getCloudAgentRoutes, shutdownCloudAgents
// are exported at their function declarations above
//# sourceMappingURL=cloud-agent.js.map