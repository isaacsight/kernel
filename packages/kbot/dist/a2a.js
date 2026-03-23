// kbot A2A (Agent-to-Agent) Protocol Support
//
// Implements Google's Agent2Agent protocol for agent interoperability:
// - Agent Card: JSON descriptor of kbot's capabilities
// - A2A Server: HTTP endpoints for receiving tasks from other agents
// - A2A Client: Discovery and delegation to external A2A agents
//
// Spec: https://google.github.io/A2A/
//
// Usage:
//   import { mountA2ARoutes } from './a2a.js'
//   mountA2ARoutes(server, { port: 7437 })
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { runAgent } from './agent.js';
import { SPECIALISTS } from './agents/specialists.js';
import { timingSafeEqual } from 'node:crypto';
// ── Package metadata ──
const __require = createRequire(import.meta.url);
const pkg = __require('../package.json');
// ── Constants ──
const KBOT_DIR = join(homedir(), '.kbot');
const REGISTRY_PATH = join(KBOT_DIR, 'a2a-registry.json');
const DEFAULT_PORT = 7437;
// ── In-memory task store ──
const tasks = new Map();
const MAX_TASKS = 1000;
const TASK_TTL_MS = 60 * 60 * 1000; // 1 hour
function pruneTasks() {
    if (tasks.size <= MAX_TASKS)
        return;
    const now = Date.now();
    for (const [id, task] of tasks) {
        if (now - new Date(task.createdAt).getTime() > TASK_TTL_MS)
            tasks.delete(id);
    }
    // If still over limit, drop oldest
    if (tasks.size > MAX_TASKS) {
        const oldest = [...tasks.keys()].slice(0, tasks.size - MAX_TASKS);
        for (const id of oldest)
            tasks.delete(id);
    }
}
// ── Skill mapping ──
/** Map specialist definitions to A2A skills */
function specialistToSkill(id, def) {
    const tagMap = {
        kernel: ['general', 'assistant', 'coordination'],
        researcher: ['research', 'fact-checking', 'synthesis'],
        coder: ['programming', 'code-generation', 'debugging', 'refactoring'],
        writer: ['writing', 'documentation', 'content-creation'],
        analyst: ['analysis', 'strategy', 'evaluation'],
        aesthete: ['design', 'ui-ux', 'css', 'accessibility'],
        guardian: ['security', 'vulnerability-scanning', 'owasp'],
        curator: ['knowledge-management', 'documentation', 'indexing'],
        strategist: ['business-strategy', 'roadmapping', 'competitive-analysis'],
        infrastructure: ['devops', 'ci-cd', 'containers', 'cloud'],
        quant: ['data-science', 'statistics', 'quantitative-analysis'],
        investigator: ['deep-research', 'root-cause-analysis', 'forensics'],
        oracle: ['predictions', 'trend-analysis', 'forecasting'],
        chronist: ['history', 'timelines', 'changelog'],
        sage: ['philosophy', 'wisdom', 'mental-models'],
        communicator: ['communication', 'messaging', 'presentations'],
        adapter: ['translation', 'format-conversion', 'migration'],
    };
    return {
        id,
        name: def.name,
        description: def.prompt.split('\n')[0].replace(/^You are (?:an? )?/, ''),
        tags: tagMap[id] || [id],
    };
}
/** Additional built-in agent skills (preset agents beyond the 17 specialists) */
const EXTRA_SKILLS = [
    {
        id: 'hacker',
        name: 'Hacker',
        description: 'Offensive security specialist and CTF solver — red team analysis',
        tags: ['offensive-security', 'penetration-testing', 'ctf'],
    },
    {
        id: 'operator',
        name: 'Operator',
        description: 'Autonomous executor — plans, executes, verifies, and reports',
        tags: ['automation', 'orchestration', 'task-execution'],
    },
    {
        id: 'dreamer',
        name: 'Dreamer',
        description: 'Liminal space explorer — dream interpretation, worldbuilding, vision engineering',
        tags: ['creative', 'worldbuilding', 'imagination'],
    },
    {
        id: 'creative',
        name: 'Creative',
        description: 'Generative art, creative coding, shaders, procedural generation',
        tags: ['generative-art', 'creative-coding', 'shaders', 'music'],
    },
    {
        id: 'developer',
        name: 'Developer',
        description: 'kbot self-improvement specialist — builds and extends kbot itself',
        tags: ['kbot', 'self-improvement', 'typescript', 'tooling'],
    },
];
// ── Agent Card ──
/** Build the Agent Card for this kbot instance */
export function buildAgentCard(endpointUrl) {
    const url = endpointUrl || `http://localhost:${DEFAULT_PORT}`;
    const skills = [
        ...Object.entries(SPECIALISTS).map(([id, def]) => specialistToSkill(id, def)),
        ...EXTRA_SKILLS,
    ];
    return {
        name: 'kbot',
        description: pkg.description,
        version: pkg.version,
        url,
        provider: {
            organization: 'kernel.chat group',
            url: pkg.homepage,
        },
        capabilities: {
            streaming: true,
            pushNotifications: false,
            stateTransitionHistory: true,
        },
        skills,
        defaultInputModes: ['text/plain', 'application/json'],
        defaultOutputModes: ['text/plain', 'application/json'],
    };
}
// ── Task execution ──
/** Create a new A2A task from an incoming message */
function createTask(message, metadata) {
    const now = new Date().toISOString();
    const task = {
        id: randomUUID(),
        status: {
            state: 'submitted',
            timestamp: now,
        },
        message,
        history: [],
        metadata,
        createdAt: now,
    };
    pruneTasks();
    tasks.set(task.id, task);
    return task;
}
/** Extract plain text from an A2A message */
function extractText(message) {
    return message.parts
        .filter((p) => p.type === 'text')
        .map(p => p.text)
        .join('\n');
}
/** Execute a task through kbot's agent system */
async function executeTask(task) {
    // Transition to working
    task.status = { state: 'working', timestamp: new Date().toISOString() };
    task.history?.push({ ...task.message });
    const userText = extractText(task.message);
    if (!userText) {
        task.status = { state: 'failed', message: 'No text content in message', timestamp: new Date().toISOString() };
        return task;
    }
    // Determine agent from metadata hint or let router decide
    const agentOptions = {};
    if (task.metadata?.agent && typeof task.metadata.agent === 'string') {
        agentOptions.agent = task.metadata.agent;
    }
    try {
        const response = await runAgent(userText, agentOptions);
        task.result = {
            role: 'agent',
            parts: [{ type: 'text', text: response.content }],
        };
        task.status = { state: 'completed', timestamp: new Date().toISOString() };
        // Include agent metadata in task
        task.metadata = {
            ...task.metadata,
            agentUsed: response.agent,
            model: response.model,
            toolCalls: response.toolCalls,
            usage: response.usage,
        };
    }
    catch (err) {
        task.status = {
            state: 'failed',
            message: err instanceof Error ? err.message : 'Task execution failed',
            timestamp: new Date().toISOString(),
        };
    }
    return task;
}
// ── A2A Server ──
/** HTTP helpers */
function sendJson(res, status, data) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}
const MAX_BODY_SIZE = 1024 * 1024; // 1 MB
function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;
        req.on('data', (c) => {
            size += c.length;
            if (size > MAX_BODY_SIZE) {
                req.destroy();
                reject(new Error('Request body too large'));
                return;
            }
            chunks.push(c);
        });
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
        req.on('error', reject);
    });
}
/**
 * Mount A2A protocol routes onto an existing HTTP server's request handler.
 *
 * Returns a request handler that should be called from the server's main
 * request listener. Returns `true` if the request was handled by A2A routes,
 * `false` if it should be passed to the next handler.
 */
export function createA2AHandler(options = {}) {
    const baseUrl = options.endpointUrl || `http://localhost:${options.port || DEFAULT_PORT}`;
    const card = buildAgentCard(baseUrl);
    return async (req, res) => {
        const url = new URL(req.url || '/', `http://localhost`);
        const path = url.pathname;
        // CORS preflight for A2A routes
        if (req.method === 'OPTIONS' && (path === '/.well-known/agent.json' || path.startsWith('/a2a/'))) {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            res.writeHead(204);
            res.end();
            return true;
        }
        // Auth check for task endpoints
        if (options.token && path.startsWith('/a2a/')) {
            const auth = req.headers.authorization;
            const bearerToken = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
            const tokenBuf = Buffer.from(options.token);
            const bearerBuf = Buffer.from(bearerToken || '');
            if (tokenBuf.length !== bearerBuf.length || !timingSafeEqual(tokenBuf, bearerBuf)) {
                sendJson(res, 401, { error: 'Unauthorized' });
                return true;
            }
        }
        // GET /.well-known/agent.json — Agent Card discovery
        if (path === '/.well-known/agent.json' && req.method === 'GET') {
            sendJson(res, 200, card);
            return true;
        }
        // POST /a2a/tasks — Submit a new task
        if (path === '/a2a/tasks' && req.method === 'POST') {
            try {
                const body = JSON.parse(await readBody(req));
                if (!body.message || !body.message.parts || !body.message.role) {
                    sendJson(res, 400, { error: 'Invalid message format. Expected { message: { role, parts } }' });
                    return true;
                }
                const task = createTask(body.message, body.metadata);
                // Check if caller wants synchronous execution
                const sync = url.searchParams.get('sync') === 'true';
                if (sync) {
                    // Synchronous: execute and return completed task
                    const completed = await executeTask(task);
                    sendJson(res, 200, taskToResponse(completed));
                }
                else {
                    // Asynchronous: return immediately with submitted status, execute in background
                    sendJson(res, 202, taskToResponse(task));
                    // Fire and forget — task will be updated in the store
                    executeTask(task).catch(() => {
                        task.status = { state: 'failed', message: 'Background execution failed', timestamp: new Date().toISOString() };
                    });
                }
            }
            catch (err) {
                sendJson(res, 400, { error: err instanceof Error ? err.message : 'Invalid request body' });
            }
            return true;
        }
        // GET /a2a/tasks/:id — Get task status and result
        const taskStatusMatch = path.match(/^\/a2a\/tasks\/([a-f0-9-]+)$/);
        if (taskStatusMatch && req.method === 'GET') {
            const taskId = taskStatusMatch[1];
            const task = tasks.get(taskId);
            if (!task) {
                sendJson(res, 404, { error: 'Task not found' });
                return true;
            }
            sendJson(res, 200, taskToResponse(task));
            return true;
        }
        // POST /a2a/tasks/:id/cancel — Cancel a task
        const taskCancelMatch = path.match(/^\/a2a\/tasks\/([a-f0-9-]+)\/cancel$/);
        if (taskCancelMatch && req.method === 'POST') {
            const taskId = taskCancelMatch[1];
            const task = tasks.get(taskId);
            if (!task) {
                sendJson(res, 404, { error: 'Task not found' });
                return true;
            }
            if (task.status.state === 'completed' || task.status.state === 'failed') {
                sendJson(res, 409, { error: `Cannot cancel task in '${task.status.state}' state` });
                return true;
            }
            task.status = { state: 'canceled', timestamp: new Date().toISOString() };
            sendJson(res, 200, taskToResponse(task));
            return true;
        }
        // Not an A2A route
        return false;
    };
}
/** Serialize a task for the A2A response format */
function taskToResponse(task) {
    return {
        id: task.id,
        status: task.status,
        result: task.result || null,
        history: task.history || [],
        metadata: task.metadata || {},
    };
}
/**
 * Mount A2A routes onto an existing Node.js HTTP Server.
 *
 * Wraps the server's existing request listeners so A2A endpoints are
 * checked first. Non-A2A requests fall through to the original handler.
 */
export function mountA2ARoutes(server, options = {}) {
    const a2aHandler = createA2AHandler(options);
    // Capture existing listeners
    const existingListeners = server.listeners('request');
    server.removeAllListeners('request');
    // Install composite handler: A2A first, then original
    server.on('request', async (req, res) => {
        try {
            const handled = await a2aHandler(req, res);
            if (handled)
                return;
        }
        catch (err) {
            sendJson(res, 500, { error: err instanceof Error ? err.message : 'A2A internal error' });
            return;
        }
        // Fall through to original handlers
        for (const listener of existingListeners) {
            listener(req, res);
        }
    });
}
// ── A2A Client ──
/** Load the agent registry from disk */
function loadRegistry() {
    try {
        if (!existsSync(REGISTRY_PATH))
            return {};
        const raw = readFileSync(REGISTRY_PATH, 'utf-8');
        return JSON.parse(raw);
    }
    catch {
        return {};
    }
}
/** Save the agent registry to disk */
function saveRegistry(registry) {
    if (!existsSync(KBOT_DIR))
        mkdirSync(KBOT_DIR, { recursive: true });
    writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2));
}
/**
 * Discover a remote A2A agent by fetching its Agent Card.
 *
 * @param url - Base URL of the remote agent (e.g. "http://other-agent:8080")
 * @returns The agent's card, or null if discovery fails
 */
export async function discoverAgent(url) {
    const cardUrl = url.replace(/\/$/, '') + '/.well-known/agent.json';
    try {
        const response = await fetch(cardUrl, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) {
            return null;
        }
        const card = await response.json();
        // Validate minimum required fields
        if (!card.name || !card.url || !card.skills) {
            return null;
        }
        // Register in local registry
        const registry = loadRegistry();
        registry[url] = {
            url,
            card,
            discoveredAt: new Date().toISOString(),
        };
        saveRegistry(registry);
        return card;
    }
    catch {
        return null;
    }
}
/**
 * Send a task to a remote A2A agent and wait for the result.
 *
 * @param agentUrl - Base URL of the remote agent
 * @param task - The task text to send
 * @param options - Optional agent hint and metadata
 * @returns The agent's text response, or null if the task failed
 */
export async function delegateTask(agentUrl, task, options) {
    const taskUrl = agentUrl.replace(/\/$/, '') + '/a2a/tasks?sync=true';
    try {
        const body = {
            message: {
                role: 'user',
                parts: [{ type: 'text', text: task }],
            },
        };
        if (options?.agent || options?.metadata) {
            body.metadata = { ...options?.metadata, agent: options?.agent };
        }
        const response = await fetch(taskUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(120_000), // 2 minute timeout for task execution
        });
        if (!response.ok) {
            return null;
        }
        const result = await response.json();
        if (result.status.state !== 'completed' || !result.result) {
            return null;
        }
        const text = result.result.parts
            .filter((p) => p.type === 'text')
            .map(p => p.text)
            .join('\n');
        // Update last contact time in registry
        const registry = loadRegistry();
        if (registry[agentUrl]) {
            registry[agentUrl].lastContactedAt = new Date().toISOString();
            saveRegistry(registry);
        }
        return { text, metadata: result.metadata || {} };
    }
    catch {
        return null;
    }
}
/**
 * List all discovered remote agents from the local registry.
 */
export function listRemoteAgents() {
    const registry = loadRegistry();
    return Object.values(registry);
}
/**
 * Remove a remote agent from the local registry.
 */
export function removeRemoteAgent(url) {
    const registry = loadRegistry();
    if (!registry[url])
        return false;
    delete registry[url];
    saveRegistry(registry);
    return true;
}
/**
 * Find a remote agent that has a skill matching the given tags.
 */
export function findAgentBySkill(tags) {
    const registry = loadRegistry();
    const tagSet = new Set(tags.map(t => t.toLowerCase()));
    for (const agent of Object.values(registry)) {
        for (const skill of agent.card.skills) {
            if (skill.tags.some(t => tagSet.has(t.toLowerCase()))) {
                return agent;
            }
        }
    }
    return null;
}
//# sourceMappingURL=a2a.js.map