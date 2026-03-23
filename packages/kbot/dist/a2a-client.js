// kbot A2A Client — Agent-to-Agent protocol client (v0.3)
//
// Discovers remote A2A agents, sends tasks, tracks lifecycle, cancels work.
// Complements a2a.ts which provides the server side + Agent Card generation.
//
// Usage:
//   import { discoverAgent, sendTask, getTaskStatus, cancelTask } from './a2a-client.js'
//   const card = await discoverAgent('http://other-agent:8080')
//   const task = await sendTask('http://other-agent:8080', { prompt: 'Summarize this repo' })
//   const status = await getTaskStatus('http://other-agent:8080', task.id)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { buildAgentCard, discoverAgent as discoverAgentCore, delegateTask, listRemoteAgents, removeRemoteAgent, findAgentBySkill, } from './a2a.js';
// ── Constants ──
const KBOT_DIR = join(homedir(), '.kbot');
const TASK_HISTORY_PATH = join(KBOT_DIR, 'a2a-task-history.json');
const DEFAULT_TIMEOUT_MS = 120_000; // 2 minutes
const DISCOVERY_TIMEOUT_MS = 10_000; // 10 seconds
function loadTaskHistory() {
    try {
        if (!existsSync(TASK_HISTORY_PATH))
            return [];
        return JSON.parse(readFileSync(TASK_HISTORY_PATH, 'utf-8'));
    }
    catch {
        return [];
    }
}
function saveTaskHistory(history) {
    if (!existsSync(KBOT_DIR))
        mkdirSync(KBOT_DIR, { recursive: true });
    // Keep last 500 entries
    const trimmed = history.slice(-500);
    writeFileSync(TASK_HISTORY_PATH, JSON.stringify(trimmed, null, 2));
}
function recordTask(entry) {
    const history = loadTaskHistory();
    // Update existing or append
    const idx = history.findIndex(h => h.id === entry.id);
    if (idx >= 0) {
        history[idx] = entry;
    }
    else {
        history.push(entry);
    }
    saveTaskHistory(history);
}
// ── Agent Card Generator ──
/**
 * Generate kbot's Agent Card JSON with all specialists as skills.
 *
 * @param endpointUrl - The URL where this kbot instance is reachable.
 *                      Defaults to http://localhost:7437.
 * @returns A fully populated AgentCard per the A2A v0.3 spec.
 */
export function generateAgentCard(endpointUrl) {
    return buildAgentCard(endpointUrl);
}
// ── Discovery ──
/**
 * Discover a remote A2A agent by fetching its Agent Card from
 * `<url>/.well-known/agent.json`.
 *
 * The discovered agent is persisted in the local registry at
 * `~/.kbot/a2a-registry.json` for future lookups.
 *
 * @param url - Base URL of the remote agent (e.g. "http://other-agent:8080")
 * @returns The agent's card, or null if discovery fails.
 */
export async function discoverAgent(url) {
    return discoverAgentCore(url);
}
/**
 * Send a task to a remote A2A agent.
 *
 * By default this is synchronous — it waits for the remote agent to complete
 * the task and returns the result. Set `options.sync = false` to submit
 * asynchronously (returns immediately with a submitted-state task).
 *
 * @param agentUrl - Base URL of the remote agent
 * @param task - The prompt text or a structured A2AMessage
 * @param options - Execution options
 * @returns The task result, including id, status, and response text
 */
export async function sendTask(agentUrl, task, options = {}) {
    const prompt = typeof task === 'string' ? task : task.prompt;
    const sync = options.sync !== false;
    const timeout = options.timeoutMs || DEFAULT_TIMEOUT_MS;
    const baseUrl = agentUrl.replace(/\/$/, '');
    const taskUrl = `${baseUrl}/a2a/tasks${sync ? '?sync=true' : ''}`;
    const body = {
        message: {
            role: 'user',
            parts: [{ type: 'text', text: prompt }],
        },
    };
    if (options.agent || options.metadata) {
        body.metadata = { ...options.metadata, agent: options.agent };
    }
    const headers = {
        'Content-Type': 'application/json',
    };
    if (options.token) {
        headers['Authorization'] = `Bearer ${options.token}`;
    }
    const response = await fetch(taskUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeout),
    });
    if (!response.ok) {
        const errText = await response.text().catch(() => 'Unknown error');
        throw new Error(`A2A task submission failed (${response.status}): ${errText}`);
    }
    const result = await response.json();
    const text = result.result?.parts
        ?.filter((p) => p.type === 'text')
        .map(p => p.text)
        .join('\n') ?? null;
    // Record in local history
    recordTask({
        id: result.id,
        agentUrl,
        prompt,
        status: result.status.state,
        result: text ?? undefined,
        createdAt: new Date().toISOString(),
        completedAt: result.status.state === 'completed' ? new Date().toISOString() : undefined,
        metadata: result.metadata,
    });
    return {
        id: result.id,
        status: result.status.state,
        text,
        metadata: result.metadata || {},
    };
}
/**
 * Check the status and result of a previously submitted task.
 *
 * @param agentUrl - Base URL of the remote agent
 * @param taskId - The task ID returned by sendTask
 * @param options - Optional auth token
 * @returns Current task state and any available result
 */
export async function getTaskStatus(agentUrl, taskId, options = {}) {
    const baseUrl = agentUrl.replace(/\/$/, '');
    const url = `${baseUrl}/a2a/tasks/${taskId}`;
    const headers = {
        'Accept': 'application/json',
    };
    if (options.token) {
        headers['Authorization'] = `Bearer ${options.token}`;
    }
    const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(DISCOVERY_TIMEOUT_MS),
    });
    if (!response.ok) {
        if (response.status === 404) {
            throw new Error(`Task ${taskId} not found on ${agentUrl}`);
        }
        throw new Error(`Failed to get task status (${response.status})`);
    }
    const result = await response.json();
    const text = result.result?.parts
        ?.filter((p) => p.type === 'text')
        .map(p => p.text)
        .join('\n') ?? null;
    // Update local history
    recordTask({
        id: result.id,
        agentUrl,
        prompt: '(status check)',
        status: result.status.state,
        result: text ?? undefined,
        createdAt: new Date().toISOString(),
        completedAt: result.status.state === 'completed' ? new Date().toISOString() : undefined,
        metadata: result.metadata,
    });
    return {
        id: result.id,
        status: result.status.state,
        message: result.status.message,
        text,
        metadata: result.metadata || {},
    };
}
/**
 * Cancel a running task on a remote agent.
 *
 * @param agentUrl - Base URL of the remote agent
 * @param taskId - The task ID to cancel
 * @param options - Optional auth token
 * @returns true if the task was canceled, false if it was already terminal
 */
export async function cancelTask(agentUrl, taskId, options = {}) {
    const baseUrl = agentUrl.replace(/\/$/, '');
    const url = `${baseUrl}/a2a/tasks/${taskId}/cancel`;
    const headers = {
        'Content-Type': 'application/json',
    };
    if (options.token) {
        headers['Authorization'] = `Bearer ${options.token}`;
    }
    const response = await fetch(url, {
        method: 'POST',
        headers,
        signal: AbortSignal.timeout(DISCOVERY_TIMEOUT_MS),
    });
    if (response.status === 409) {
        // Task already in terminal state
        return false;
    }
    if (!response.ok) {
        if (response.status === 404) {
            throw new Error(`Task ${taskId} not found on ${agentUrl}`);
        }
        throw new Error(`Failed to cancel task (${response.status})`);
    }
    return true;
}
// ── Incoming Task Handling ──
/**
 * Handle an incoming A2A task received by this kbot instance.
 *
 * Routes the task to the appropriate specialist agent based on metadata
 * hints or automatic intent classification, executes it through kbot's
 * agent system, and returns the completed task.
 *
 * This is used internally by the A2A server but is exported for
 * programmatic use (e.g., SDK consumers, custom servers).
 *
 * @param task - The incoming task with a user message
 * @returns The task with result populated and status set to completed/failed
 */
export async function handleIncomingTask(task) {
    const agentModule = await import('./agent.js');
    const runAgent = agentModule.runAgent;
    const text = task.message.parts
        .filter((p) => p.type === 'text')
        .map(p => p.text)
        .join('\n');
    if (!text) {
        return {
            id: 'inline-' + Date.now(),
            status: 'failed',
            text: null,
            metadata: { error: 'No text content in message' },
        };
    }
    const agentOpts = {};
    if (task.metadata?.agent && typeof task.metadata.agent === 'string') {
        agentOpts.agent = task.metadata.agent;
    }
    try {
        const response = await runAgent(text, agentOpts);
        return {
            id: 'inline-' + Date.now(),
            status: 'completed',
            text: response.content,
            metadata: {
                ...task.metadata,
                agentUsed: response.agent,
                model: response.model,
                toolCalls: response.toolCalls,
                usage: response.usage,
            },
        };
    }
    catch (err) {
        return {
            id: 'inline-' + Date.now(),
            status: 'failed',
            text: null,
            metadata: {
                ...task.metadata,
                error: err instanceof Error ? err.message : 'Task execution failed',
            },
        };
    }
}
// ── Convenience / Registry ──
/**
 * List all discovered remote agents from the local registry.
 */
export { listRemoteAgents, removeRemoteAgent, findAgentBySkill };
/**
 * Delegate a task to a remote agent (convenience wrapper around sendTask
 * that matches the existing delegateTask signature in a2a.ts).
 */
export { delegateTask };
/**
 * Get the local task history (tasks sent to remote agents).
 */
export function getTaskHistory() {
    return loadTaskHistory();
}
/**
 * Clear the local task history.
 */
export function clearTaskHistory() {
    if (existsSync(TASK_HISTORY_PATH)) {
        writeFileSync(TASK_HISTORY_PATH, '[]');
    }
}
/**
 * Execute a multi-step collaboration plan across multiple A2A agents.
 *
 * Steps without dependencies run in parallel. Steps with `dependsOn`
 * wait for their dependencies to complete and inject their results
 * into the prompt using `{{step:N}}` placeholders.
 *
 * @param plan - The collaboration plan
 * @param options - Auth tokens keyed by agent URL
 * @returns Results for each step
 */
export async function collaborate(plan, options = {}) {
    const results = new Map();
    const pending = new Set(plan.steps.map((_, i) => i));
    while (pending.size > 0) {
        // Find steps whose dependencies are all resolved
        const ready = [];
        for (const idx of pending) {
            const step = plan.steps[idx];
            const deps = step.dependsOn || [];
            if (deps.every(d => results.has(d))) {
                ready.push(idx);
            }
        }
        if (ready.length === 0) {
            // Deadlock — remaining steps have unresolvable dependencies
            for (const idx of pending) {
                results.set(idx, { status: 'failed', text: 'Deadlock: unresolvable dependencies' });
            }
            break;
        }
        // Execute ready steps in parallel
        const executions = ready.map(async (idx) => {
            const step = plan.steps[idx];
            pending.delete(idx);
            // Substitute dependency results into prompt
            let prompt = step.prompt;
            for (const depIdx of step.dependsOn || []) {
                const depResult = results.get(depIdx);
                const placeholder = `{{step:${depIdx}}}`;
                prompt = prompt.replace(placeholder, depResult?.text || '(no result)');
            }
            try {
                const result = await sendTask(step.agentUrl, prompt, {
                    token: options.tokens?.[step.agentUrl],
                    sync: true,
                });
                results.set(idx, { status: result.status, text: result.text });
            }
            catch (err) {
                results.set(idx, {
                    status: 'failed',
                    text: err instanceof Error ? err.message : 'Collaboration step failed',
                });
            }
        });
        await Promise.all(executions);
    }
    return {
        results: plan.steps.map((step, idx) => ({
            stepIndex: idx,
            agentUrl: step.agentUrl,
            status: results.get(idx)?.status || 'failed',
            text: results.get(idx)?.text || null,
        })),
    };
}
//# sourceMappingURL=a2a-client.js.map