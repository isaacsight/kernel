// kbot Team Mode — Coordinated multi-instance collaboration over local TCP
//
// Usage:
//   kbot team start                    # Start server + join as coordinator
//   kbot team start --port 8000        # Custom port
//   kbot team join --role coder        # Join as coder
//   kbot team join --role researcher   # Join as researcher
//   kbot team status                   # Show connected instances
//
// Architecture:
//   - Local TCP server on localhost:7439 (configurable)
//   - Newline-delimited JSON protocol (NDJSON)
//   - Shared context store (any instance writes, all read)
//   - Role-based task routing
//
// Workflow:
//   Terminal 1: kbot team start           → coordinator
//   Terminal 2: kbot team join --role researcher
//   Terminal 3: kbot team join --role coder
//   Coordinator assigns "research RSC" → researcher gets the task
//   Researcher shares findings → all instances receive context
//   Coordinator assigns "implement RSC" → coder gets task + research context
import * as net from 'node:net';
import { randomUUID } from 'node:crypto';
import { registerTool } from './tools/index.js';
import { printInfo, printSuccess, printError, printWarn } from './ui.js';
// ── Constants ────────────────────────────────────────────────────────
const DEFAULT_PORT = 7439;
const HEARTBEAT_INTERVAL = 10_000;
const RECONNECT_DELAY = 2_000;
const MAX_RECONNECT_ATTEMPTS = 5;
// ── Server State ─────────────────────────────────────────────────────
let _server = null;
let _serverPort = DEFAULT_PORT;
const _instances = new Map();
const _sharedContext = new Map();
const _pendingTasks = new Map();
// ── Client State ─────────────────────────────────────────────────────
let _client = null;
let _reconnectAttempts = 0;
let _onTask = null;
let _onContext = null;
let _onBroadcast = null;
let _onStatus = null;
// ── Protocol ─────────────────────────────────────────────────────────
/** Encode a message as NDJSON (newline-delimited JSON) */
function encode(msg) {
    return JSON.stringify(msg) + '\n';
}
/** Parse incoming data buffer into messages, handling partial lines */
function createMessageParser() {
    let buffer = '';
    return (chunk) => {
        buffer += chunk.toString('utf-8');
        const messages = [];
        let newlineIdx;
        while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, newlineIdx).trim();
            buffer = buffer.slice(newlineIdx + 1);
            if (!line)
                continue;
            try {
                messages.push(JSON.parse(line));
            }
            catch {
                // Malformed line — skip
            }
        }
        return messages;
    };
}
// ── Team Server ──────────────────────────────────────────────────────
/**
 * Start the team coordination server.
 * Maintains connected instances, shared context, and task routing.
 */
export async function startTeamServer(options = {}) {
    const port = options.port ?? DEFAULT_PORT;
    _serverPort = port;
    if (_server) {
        printWarn('Team server already running');
        return _server;
    }
    return new Promise((resolve, reject) => {
        const server = net.createServer((socket) => {
            const parser = createMessageParser();
            let instanceId = '';
            socket.on('data', (data) => {
                const messages = parser(data);
                for (const msg of messages) {
                    handleServerMessage(msg, socket);
                    if (msg.type === 'join') {
                        instanceId = msg.instanceId;
                    }
                }
            });
            socket.on('error', (err) => {
                if (instanceId) {
                    handleDisconnect(instanceId);
                }
                // ECONNRESET and EPIPE are expected on abrupt disconnects
                if (err.code !== 'ECONNRESET' &&
                    err.code !== 'EPIPE') {
                    printError(`Socket error: ${err.message}`);
                }
            });
            socket.on('close', () => {
                if (instanceId) {
                    handleDisconnect(instanceId);
                }
            });
        });
        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                printError(`Port ${port} is already in use. Another team server may be running.`);
                printInfo(`Try: kbot team join --role coordinator --port ${port}`);
            }
            else {
                printError(`Team server error: ${err.message}`);
            }
            reject(err);
        });
        server.listen(port, '127.0.0.1', () => {
            _server = server;
            printSuccess(`Team server running on localhost:${port}`);
            printInfo('Waiting for instances to join...');
            printInfo('');
            printInfo('In other terminals, run:');
            printInfo(`  kbot team join --role researcher`);
            printInfo(`  kbot team join --role coder`);
            printInfo(`  kbot team join --role reviewer`);
            resolve(server);
        });
    });
}
/** Handle an incoming message on the server side */
function handleServerMessage(msg, socket) {
    switch (msg.type) {
        case 'join': {
            const instance = {
                id: msg.instanceId,
                role: msg.role,
                status: 'idle',
                socket,
                joinedAt: new Date(),
            };
            _instances.set(msg.instanceId, instance);
            printSuccess(`[+] ${msg.role} joined (${msg.instanceId.slice(0, 8)})`);
            // Send current shared context to the new instance
            for (const [key, value] of _sharedContext.entries()) {
                const contextMsg = { type: 'context', key, value, from: 'server' };
                safeSend(socket, contextMsg);
            }
            // Broadcast updated status to everyone
            broadcastStatus();
            break;
        }
        case 'leave': {
            handleDisconnect(msg.instanceId);
            break;
        }
        case 'context': {
            // Store and broadcast to all other instances
            _sharedContext.set(msg.key, msg.value);
            broadcastToAll(msg, msg.from);
            printInfo(`[ctx] ${msg.from.slice(0, 8)} shared "${msg.key}" (${msg.value.length} chars)`);
            break;
        }
        case 'task': {
            const task = {
                taskId: msg.taskId,
                task: msg.task,
                assignedTo: msg.assignTo,
                from: msg.from,
                createdAt: new Date(),
                status: 'pending',
            };
            _pendingTasks.set(msg.taskId, task);
            // Route to the target role
            const target = findInstanceByRole(msg.assignTo);
            if (target) {
                safeSend(target.socket, msg);
                target.status = 'working';
                task.status = 'in_progress';
                printInfo(`[task] "${msg.task.slice(0, 60)}" → ${msg.assignTo} (${target.id.slice(0, 8)})`);
            }
            else {
                // No instance with that role — notify sender
                const errorMsg = {
                    type: 'broadcast',
                    message: `No instance with role "${msg.assignTo}" is connected. Available roles: ${getAvailableRoles().join(', ') || 'none'}`,
                    from: 'server',
                };
                safeSend(socket, errorMsg);
                printWarn(`[task] No "${msg.assignTo}" instance connected`);
            }
            broadcastStatus();
            break;
        }
        case 'result': {
            const pendingTask = _pendingTasks.get(msg.taskId);
            if (pendingTask) {
                pendingTask.status = 'completed';
                pendingTask.result = msg.result;
                // Notify the task originator
                const originator = _instances.get(pendingTask.from);
                if (originator) {
                    safeSend(originator.socket, msg);
                }
                // Mark the completer as idle
                const completer = _instances.get(msg.from);
                if (completer) {
                    completer.status = 'idle';
                }
                printSuccess(`[done] Task ${msg.taskId.slice(0, 8)} completed by ${msg.from.slice(0, 8)}`);
            }
            broadcastStatus();
            break;
        }
        case 'broadcast': {
            broadcastToAll(msg, msg.from);
            printInfo(`[msg] ${msg.from.slice(0, 8)}: ${msg.message.slice(0, 80)}`);
            break;
        }
        default:
            break;
    }
}
/** Safely send a message to a socket, handling write errors */
function safeSend(socket, msg) {
    try {
        if (!socket.destroyed) {
            socket.write(encode(msg));
            return true;
        }
    }
    catch {
        // Socket may have been destroyed between the check and the write
    }
    return false;
}
/** Broadcast a message to all connected instances except the sender */
function broadcastToAll(msg, excludeId) {
    for (const [id, instance] of _instances.entries()) {
        if (id !== excludeId && instance.status !== 'disconnected') {
            safeSend(instance.socket, msg);
        }
    }
}
/** Broadcast the current status (all instances) to everyone */
function broadcastStatus() {
    const statusMsg = {
        type: 'status',
        instances: Array.from(_instances.values())
            .filter(i => i.status !== 'disconnected')
            .map(i => ({ id: i.id, role: i.role, status: i.status })),
    };
    for (const instance of _instances.values()) {
        if (instance.status !== 'disconnected') {
            safeSend(instance.socket, statusMsg);
        }
    }
}
/** Handle an instance disconnect */
function handleDisconnect(instanceId) {
    const instance = _instances.get(instanceId);
    if (instance && instance.status !== 'disconnected') {
        instance.status = 'disconnected';
        printWarn(`[-] ${instance.role} disconnected (${instanceId.slice(0, 8)})`);
        // Reassign any pending tasks from this instance
        for (const [taskId, task] of _pendingTasks.entries()) {
            if (task.assignedTo === instance.role && task.status === 'in_progress') {
                task.status = 'pending';
                printWarn(`[task] Task ${taskId.slice(0, 8)} unassigned (${instance.role} disconnected)`);
            }
        }
        _instances.delete(instanceId);
        broadcastStatus();
    }
}
/** Find a connected instance by role (picks the first idle one, or first available) */
function findInstanceByRole(role) {
    let fallback;
    for (const instance of _instances.values()) {
        if (instance.role === role && instance.status !== 'disconnected') {
            if (instance.status === 'idle')
                return instance;
            fallback = instance;
        }
    }
    return fallback;
}
/** Get the list of currently connected roles */
function getAvailableRoles() {
    const roles = new Set();
    for (const instance of _instances.values()) {
        if (instance.status !== 'disconnected') {
            roles.add(instance.role);
        }
    }
    return Array.from(roles);
}
/** Stop the team server and disconnect all clients */
export async function stopTeamServer() {
    if (!_server)
        return;
    // Notify all instances
    const leaveMsg = {
        type: 'broadcast',
        message: 'Team server shutting down.',
        from: 'server',
    };
    broadcastToAll(leaveMsg);
    // Close all sockets
    for (const instance of _instances.values()) {
        try {
            instance.socket.destroy();
        }
        catch { /* already closed */ }
    }
    _instances.clear();
    _sharedContext.clear();
    _pendingTasks.clear();
    return new Promise((resolve) => {
        _server.close(() => {
            _server = null;
            printInfo('Team server stopped');
            resolve();
        });
    });
}
// ── Team Client ──────────────────────────────────────────────────────
/**
 * Join an existing team as a specific role.
 * Returns methods to interact with the team.
 */
export async function joinTeam(options) {
    const port = options.port ?? DEFAULT_PORT;
    const instanceId = options.instanceId ?? randomUUID();
    const role = options.role;
    _reconnectAttempts = 0;
    const client = await connectToServer(port, instanceId, role);
    return new TeamClient(client, instanceId, role, port);
}
/** Establish a TCP connection to the team server */
function connectToServer(port, instanceId, role) {
    return new Promise((resolve, reject) => {
        const socket = net.createConnection({ host: '127.0.0.1', port }, () => {
            // Connected — send join message
            const joinMsg = { type: 'join', role, instanceId };
            socket.write(encode(joinMsg));
            _client = socket;
            _reconnectAttempts = 0;
            printSuccess(`Joined team as "${role}" (${instanceId.slice(0, 8)})`);
            resolve(socket);
        });
        const parser = createMessageParser();
        socket.on('data', (data) => {
            const messages = parser(data);
            for (const msg of messages) {
                handleClientMessage(msg);
            }
        });
        socket.on('error', (err) => {
            if (err.code === 'ECONNREFUSED') {
                printError(`Cannot connect to team server on localhost:${port}`);
                printInfo('Start one with: kbot team start');
                reject(err);
            }
            else {
                printError(`Team connection error: ${err.message}`);
                attemptReconnect(port, instanceId, role);
            }
        });
        socket.on('close', () => {
            if (_client === socket) {
                _client = null;
                printWarn('Disconnected from team server');
                attemptReconnect(port, instanceId, role);
            }
        });
    });
}
/** Attempt to reconnect after a disconnection */
function attemptReconnect(port, instanceId, role) {
    if (_reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        printError(`Failed to reconnect after ${MAX_RECONNECT_ATTEMPTS} attempts`);
        return;
    }
    _reconnectAttempts++;
    const delay = RECONNECT_DELAY * _reconnectAttempts;
    printInfo(`Reconnecting in ${delay / 1000}s (attempt ${_reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
    setTimeout(async () => {
        try {
            await connectToServer(port, instanceId, role);
        }
        catch {
            // connectToServer already logs errors
        }
    }, delay);
}
/** Handle an incoming message on the client side */
function handleClientMessage(msg) {
    switch (msg.type) {
        case 'task': {
            printInfo(`[task] Assigned: "${msg.task.slice(0, 80)}" (from ${msg.from.slice(0, 8)})`);
            if (_onTask) {
                _onTask(msg.task, msg.taskId, msg.from);
            }
            break;
        }
        case 'context': {
            printInfo(`[ctx] ${msg.from.slice(0, 8)} shared "${msg.key}" (${msg.value.length} chars)`);
            // Store locally
            _sharedContext.set(msg.key, msg.value);
            if (_onContext) {
                _onContext(msg.key, msg.value, msg.from);
            }
            break;
        }
        case 'broadcast': {
            printInfo(`[team] ${msg.from.slice(0, 8)}: ${msg.message.slice(0, 200)}`);
            if (_onBroadcast) {
                _onBroadcast(msg.message, msg.from);
            }
            break;
        }
        case 'result': {
            printSuccess(`[result] Task ${msg.taskId.slice(0, 8)} completed: ${msg.result.slice(0, 100)}`);
            break;
        }
        case 'status': {
            if (_onStatus) {
                _onStatus(msg.instances);
            }
            break;
        }
        default:
            break;
    }
}
// ── Team Client Class ────────────────────────────────────────────────
export class TeamClient {
    socket;
    instanceId;
    role;
    port;
    constructor(socket, instanceId, role, port) {
        this.socket = socket;
        this.instanceId = instanceId;
        this.role = role;
        this.port = port;
    }
    /** Share a context value with the entire team */
    shareContext(key, value) {
        const msg = {
            type: 'context',
            key,
            value,
            from: this.instanceId,
        };
        this.send(msg);
    }
    /** Request a task be assigned to a specific role */
    requestTask(role, task) {
        const taskId = randomUUID();
        const msg = {
            type: 'task',
            task,
            assignTo: role,
            from: this.instanceId,
            taskId,
        };
        this.send(msg);
        return taskId;
    }
    /** Submit a result for a completed task */
    submitResult(taskId, result) {
        const msg = {
            type: 'result',
            taskId,
            result,
            from: this.instanceId,
        };
        this.send(msg);
    }
    /** Broadcast a message to all team members */
    broadcastMessage(message) {
        const msg = {
            type: 'broadcast',
            message,
            from: this.instanceId,
        };
        this.send(msg);
    }
    /** Get locally cached shared context */
    getContext(key) {
        return _sharedContext.get(key);
    }
    /** Get all shared context entries */
    getAllContext() {
        return new Map(_sharedContext);
    }
    /** Register handler for incoming tasks */
    onTask(handler) {
        _onTask = handler;
    }
    /** Register handler for incoming context updates */
    onContext(handler) {
        _onContext = handler;
    }
    /** Register handler for broadcast messages */
    onBroadcast(handler) {
        _onBroadcast = handler;
    }
    /** Register handler for status updates */
    onStatus(handler) {
        _onStatus = handler;
    }
    /** Leave the team gracefully */
    leave() {
        const msg = { type: 'leave', instanceId: this.instanceId };
        this.send(msg);
        setTimeout(() => {
            try {
                this.socket.destroy();
            }
            catch { /* already closed */ }
            _client = null;
        }, 100);
        printInfo(`Left team (${this.role})`);
    }
    /** Check if connected */
    get connected() {
        return !this.socket.destroyed;
    }
    send(msg) {
        if (this.socket.destroyed) {
            printWarn('Not connected to team server');
            return;
        }
        try {
            this.socket.write(encode(msg));
        }
        catch (err) {
            printError(`Failed to send: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
}
// ── Module-level Client Reference ────────────────────────────────────
// Used by the tools to access the active client without threading it through
let _activeClient = null;
export function getActiveClient() {
    return _activeClient;
}
export function setActiveClient(client) {
    _activeClient = client;
}
// ── Tool Registration ────────────────────────────────────────────────
export function registerTeamTools() {
    registerTool({
        name: 'team_start',
        description: 'Start the team coordination server. Other kbot instances can then join. Optionally join as coordinator.',
        parameters: {
            port: { type: 'number', description: `TCP port for the team server (default: ${DEFAULT_PORT})` },
            join_as: { type: 'string', description: 'Also join the team with this role (e.g., "coordinator")' },
        },
        tier: 'free',
        async execute(args) {
            const port = args.port ? Number(args.port) : DEFAULT_PORT;
            try {
                await startTeamServer({ port });
                // Optionally join the server we just started
                if (args.join_as) {
                    const role = String(args.join_as);
                    const client = await joinTeam({ port, role });
                    setActiveClient(client);
                    return `Team server started on localhost:${port}. Joined as "${role}".`;
                }
                return `Team server started on localhost:${port}. Run 'kbot team join --role <role>' in other terminals.`;
            }
            catch (err) {
                return `Failed to start team server: ${err instanceof Error ? err.message : String(err)}`;
            }
        },
    });
    registerTool({
        name: 'team_join',
        description: 'Join an existing team with a specific role (researcher, coder, reviewer, etc.).',
        parameters: {
            role: { type: 'string', description: 'Your role in the team (researcher, coder, reviewer, coordinator, etc.)', required: true },
            port: { type: 'number', description: `Team server port (default: ${DEFAULT_PORT})` },
        },
        tier: 'free',
        async execute(args) {
            const role = String(args.role);
            const port = args.port ? Number(args.port) : DEFAULT_PORT;
            try {
                const client = await joinTeam({ port, role });
                setActiveClient(client);
                return `Joined team as "${role}" on localhost:${port}. Instance ID: ${client.instanceId.slice(0, 8)}`;
            }
            catch (err) {
                return `Failed to join team: ${err instanceof Error ? err.message : String(err)}`;
            }
        },
    });
    registerTool({
        name: 'team_status',
        description: 'Show all connected team instances and their current status.',
        parameters: {
            port: { type: 'number', description: `Team server port (default: ${DEFAULT_PORT})` },
        },
        tier: 'free',
        async execute() {
            // If we're the server, read directly from server state
            if (_server) {
                const instances = Array.from(_instances.values())
                    .filter(i => i.status !== 'disconnected');
                if (instances.length === 0) {
                    return 'Team server running, but no instances connected.';
                }
                const lines = instances.map(i => {
                    const uptime = Math.round((Date.now() - i.joinedAt.getTime()) / 1000);
                    return `  ${i.role.padEnd(15)} ${i.status.padEnd(10)} ${i.id.slice(0, 8)}  (${uptime}s)`;
                });
                const contextKeys = Array.from(_sharedContext.keys());
                const tasksSummary = Array.from(_pendingTasks.values());
                const pending = tasksSummary.filter(t => t.status === 'pending').length;
                const inProgress = tasksSummary.filter(t => t.status === 'in_progress').length;
                const completed = tasksSummary.filter(t => t.status === 'completed').length;
                return [
                    `Team Server — localhost:${_serverPort}`,
                    ``,
                    `Instances (${instances.length}):`,
                    `  ${'Role'.padEnd(15)} ${'Status'.padEnd(10)} ID`,
                    `  ${'─'.repeat(15)} ${'─'.repeat(10)} ${'─'.repeat(8)}`,
                    ...lines,
                    ``,
                    `Shared Context: ${contextKeys.length} entries${contextKeys.length > 0 ? ' (' + contextKeys.join(', ') + ')' : ''}`,
                    `Tasks: ${pending} pending, ${inProgress} in progress, ${completed} completed`,
                ].join('\n');
            }
            // If we're a client, report what we know
            if (_activeClient) {
                const context = _activeClient.getAllContext();
                return [
                    `Connected as "${_activeClient.role}" (${_activeClient.instanceId.slice(0, 8)})`,
                    `Connected: ${_activeClient.connected ? 'yes' : 'no'}`,
                    `Shared context: ${context.size} entries${context.size > 0 ? ' (' + Array.from(context.keys()).join(', ') + ')' : ''}`,
                ].join('\n');
            }
            return 'Not connected to any team. Run team_start or team_join first.';
        },
    });
    registerTool({
        name: 'team_share',
        description: 'Share context with the team (e.g., research findings, code snippets, decisions). All team members receive it.',
        parameters: {
            key: { type: 'string', description: 'Context key (e.g., "research_findings", "api_design", "review_notes")', required: true },
            value: { type: 'string', description: 'Context value — the actual content to share', required: true },
        },
        tier: 'free',
        async execute(args) {
            const key = String(args.key);
            const value = String(args.value);
            if (_activeClient) {
                _activeClient.shareContext(key, value);
                return `Shared "${key}" with team (${value.length} chars)`;
            }
            // If we're only the server (no client), store directly and broadcast
            if (_server) {
                _sharedContext.set(key, value);
                const msg = { type: 'context', key, value, from: 'server' };
                broadcastToAll(msg);
                return `Shared "${key}" with team from server (${value.length} chars)`;
            }
            return 'Not connected to any team. Run team_start or team_join first.';
        },
    });
    registerTool({
        name: 'team_assign',
        description: 'Assign a task to a specific role in the team. The instance with that role will receive the task.',
        parameters: {
            role: { type: 'string', description: 'Target role (researcher, coder, reviewer, etc.)', required: true },
            task: { type: 'string', description: 'Task description — what the target should do', required: true },
        },
        tier: 'free',
        async execute(args) {
            const role = String(args.role);
            const task = String(args.task);
            if (_activeClient) {
                const taskId = _activeClient.requestTask(role, task);
                return `Task assigned to "${role}": ${task.slice(0, 100)}${task.length > 100 ? '...' : ''}\nTask ID: ${taskId.slice(0, 8)}`;
            }
            // Server can assign tasks directly
            if (_server) {
                const taskId = randomUUID();
                const target = findInstanceByRole(role);
                if (!target) {
                    const available = getAvailableRoles();
                    return `No instance with role "${role}" is connected. Available: ${available.join(', ') || 'none'}`;
                }
                const msg = { type: 'task', task, assignTo: role, from: 'server', taskId };
                safeSend(target.socket, msg);
                target.status = 'working';
                const pendingTask = {
                    taskId,
                    task,
                    assignedTo: role,
                    from: 'server',
                    createdAt: new Date(),
                    status: 'in_progress',
                };
                _pendingTasks.set(taskId, pendingTask);
                broadcastStatus();
                return `Task assigned to "${role}" (${target.id.slice(0, 8)}): ${task.slice(0, 100)}${task.length > 100 ? '...' : ''}\nTask ID: ${taskId.slice(0, 8)}`;
            }
            return 'Not connected to any team. Run team_start or team_join first.';
        },
    });
    registerTool({
        name: 'team_broadcast',
        description: 'Send a message to all team members. Use for announcements, status updates, or coordination.',
        parameters: {
            message: { type: 'string', description: 'Message to broadcast to all team members', required: true },
        },
        tier: 'free',
        async execute(args) {
            const message = String(args.message);
            if (_activeClient) {
                _activeClient.broadcastMessage(message);
                return `Broadcast sent to team: ${message.slice(0, 100)}${message.length > 100 ? '...' : ''}`;
            }
            if (_server) {
                const msg = { type: 'broadcast', message, from: 'server' };
                broadcastToAll(msg);
                return `Broadcast sent from server: ${message.slice(0, 100)}${message.length > 100 ? '...' : ''}`;
            }
            return 'Not connected to any team. Run team_start or team_join first.';
        },
    });
    registerTool({
        name: 'team_context',
        description: 'Read shared context from the team. Returns a specific key or all shared context.',
        parameters: {
            key: { type: 'string', description: 'Context key to read. Omit to list all keys.' },
        },
        tier: 'free',
        async execute(args) {
            if (!_activeClient && !_server) {
                return 'Not connected to any team. Run team_start or team_join first.';
            }
            if (args.key) {
                const key = String(args.key);
                const value = _sharedContext.get(key);
                if (value) {
                    return `[${key}]\n${value}`;
                }
                return `No shared context for key "${key}". Available keys: ${Array.from(_sharedContext.keys()).join(', ') || 'none'}`;
            }
            // List all context
            if (_sharedContext.size === 0) {
                return 'No shared context yet. Team members can share context with team_share.';
            }
            const entries = Array.from(_sharedContext.entries()).map(([k, v]) => {
                const preview = v.length > 120 ? v.slice(0, 120) + '...' : v;
                return `[${k}] (${v.length} chars)\n  ${preview}`;
            });
            return `Shared Context (${_sharedContext.size} entries):\n\n${entries.join('\n\n')}`;
        },
    });
    registerTool({
        name: 'team_result',
        description: 'Submit a result for a task that was assigned to you.',
        parameters: {
            task_id: { type: 'string', description: 'Task ID (shown when task was assigned)', required: true },
            result: { type: 'string', description: 'Task result — what you accomplished', required: true },
        },
        tier: 'free',
        async execute(args) {
            const taskId = String(args.task_id);
            const result = String(args.result);
            if (_activeClient) {
                _activeClient.submitResult(taskId, result);
                return `Result submitted for task ${taskId.slice(0, 8)}`;
            }
            return 'Not connected to any team. Run team_join first.';
        },
    });
    registerTool({
        name: 'team_stop',
        description: 'Stop the team server and disconnect all instances.',
        parameters: {},
        tier: 'free',
        async execute() {
            if (_activeClient) {
                _activeClient.leave();
                setActiveClient(null);
            }
            if (_server) {
                await stopTeamServer();
                return 'Team server stopped. All instances disconnected.';
            }
            return 'No team server running on this instance.';
        },
    });
}
// ── CLI Integration ──────────────────────────────────────────────────
/**
 * Register the `kbot team` subcommand with a Commander program.
 * Called from cli.ts.
 */
export function registerTeamCommand(program) {
    const teamCmd = program
        .command('team')
        .description('Team mode — coordinate multiple kbot instances');
    teamCmd
        .command('start')
        .description('Start the team coordination server')
        .option('--port <port>', 'TCP port', String(DEFAULT_PORT))
        .option('--role <role>', 'Also join as this role (default: coordinator)')
        .action(async (opts) => {
        const port = parseInt(opts.port, 10);
        const role = opts.role ?? 'coordinator';
        try {
            await startTeamServer({ port });
            const client = await joinTeam({ port, role });
            setActiveClient(client);
            // Keep the process alive and handle shutdown
            const shutdown = async () => {
                printInfo('\nShutting down team...');
                client.leave();
                await stopTeamServer();
                process.exit(0);
            };
            process.on('SIGINT', shutdown);
            process.on('SIGTERM', shutdown);
            // Heartbeat — periodically log status
            setInterval(() => {
                const count = _instances.size;
                if (count > 0) {
                    const roles = getAvailableRoles();
                    printInfo(`[heartbeat] ${count} instance(s): ${roles.join(', ')}`);
                }
            }, HEARTBEAT_INTERVAL);
            // Keep alive
            await new Promise(() => { });
        }
        catch {
            process.exit(1);
        }
    });
    teamCmd
        .command('join')
        .description('Join an existing team with a role')
        .requiredOption('--role <role>', 'Your role (researcher, coder, reviewer, etc.)')
        .option('--port <port>', 'Team server port', String(DEFAULT_PORT))
        .action(async (opts) => {
        const port = parseInt(opts.port, 10);
        try {
            const client = await joinTeam({ port, role: opts.role });
            setActiveClient(client);
            // Handle shutdown
            const shutdown = () => {
                printInfo('\nLeaving team...');
                client.leave();
                process.exit(0);
            };
            process.on('SIGINT', shutdown);
            process.on('SIGTERM', shutdown);
            // Keep alive
            await new Promise(() => { });
        }
        catch {
            process.exit(1);
        }
    });
    teamCmd
        .command('status')
        .description('Show connected team instances')
        .option('--port <port>', 'Team server port', String(DEFAULT_PORT))
        .action(async (opts) => {
        const port = parseInt(opts.port, 10);
        // Connect briefly to get status, then disconnect
        try {
            const client = await joinTeam({ port, role: '_status_probe', instanceId: `probe-${randomUUID()}` });
            // Wait a moment for the status broadcast to arrive
            await new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    resolve();
                }, 1000);
                client.onStatus((instances) => {
                    clearTimeout(timeout);
                    console.log('');
                    console.log(`Team — localhost:${port}`);
                    console.log(`${'Role'.padEnd(15)} ${'Status'.padEnd(10)} ID`);
                    console.log(`${'─'.repeat(15)} ${'─'.repeat(10)} ${'─'.repeat(8)}`);
                    for (const inst of instances) {
                        if (inst.role === '_status_probe')
                            continue;
                        console.log(`${inst.role.padEnd(15)} ${inst.status.padEnd(10)} ${inst.id.slice(0, 8)}`);
                    }
                    console.log(`\n${instances.filter(i => i.role !== '_status_probe').length} instance(s) connected`);
                    resolve();
                });
            });
            client.leave();
            process.exit(0);
        }
        catch {
            printError('Cannot connect to team server. Is one running?');
            process.exit(1);
        }
    });
}
//# sourceMappingURL=team.js.map