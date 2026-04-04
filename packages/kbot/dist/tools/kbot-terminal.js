// kbot Persistent Terminal — kbot's own shell environment
//
// A persistent terminal that survives session disconnects.
// Shell state (cwd, env, history) persists to disk.
// Command queue enables autonomous unattended execution.
// Multiple named sessions with independent state.
//
// State: ~/.kbot/terminal-state.json
// Queue: ~/.kbot/terminal-queue.json
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { registerTool } from './index.js';
// ─── State ────────────────────────────────────────────────────────────────
const KBOT_DIR = join(homedir(), '.kbot');
const TERMINAL_STATE = join(KBOT_DIR, 'terminal-state.json');
const COMMAND_QUEUE = join(KBOT_DIR, 'terminal-queue.json');
const terminal = {
    sessions: new Map(),
    defaultSession: '',
};
let queueInterval = null;
// ─── Session Management ───────────────────────────────────────────────────
function createShellSession(name) {
    const id = `term_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const session = {
        id,
        name,
        cwd: homedir(),
        env: { ...process.env },
        history: [],
        running: true,
        pid: null,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        outputBuffer: [],
        pendingCommand: null,
        exitCode: null,
    };
    return session;
}
function findSession(nameOrId) {
    if (terminal.sessions.has(nameOrId))
        return nameOrId;
    for (const [id, s] of terminal.sessions) {
        if (s.name === nameOrId)
            return id;
    }
    return terminal.defaultSession;
}
// ─── Command Execution ────────────────────────────────────────────────────
async function executeInSession(session, command) {
    const start = Date.now();
    return new Promise((resolve_) => {
        const proc = spawn('bash', ['-c', command], {
            cwd: session.cwd,
            env: session.env,
            timeout: 300_000, // 5 min timeout
        });
        session.pid = proc.pid ?? null;
        session.pendingCommand = command;
        let stdout = '';
        let stderr = '';
        proc.stdout?.on('data', (d) => {
            const text = d.toString();
            stdout += text;
            // Add to rolling buffer
            const lines = text.split('\n');
            session.outputBuffer.push(...lines);
            if (session.outputBuffer.length > 500) {
                session.outputBuffer = session.outputBuffer.slice(-500);
            }
        });
        proc.stderr?.on('data', (d) => {
            const text = d.toString();
            stderr += text;
            // Also add stderr to output buffer for visibility
            const lines = text.split('\n');
            session.outputBuffer.push(...lines);
            if (session.outputBuffer.length > 500) {
                session.outputBuffer = session.outputBuffer.slice(-500);
            }
        });
        proc.on('close', (code) => {
            const entry = {
                command,
                output: (stdout + stderr).slice(0, 50_000), // cap at 50KB
                exitCode: code ?? 1,
                timestamp: start,
                duration: Date.now() - start,
            };
            session.history.push(entry);
            if (session.history.length > 200)
                session.history = session.history.slice(-200);
            session.lastActivity = Date.now();
            session.exitCode = code;
            session.pendingCommand = null;
            session.pid = null;
            // Track cwd changes
            if (/^\s*cd\s/.test(command) && !command.includes('&&') && !command.includes(';')) {
                const dir = command.replace(/^\s*cd\s+/, '').trim().replace(/^['"]|['"]$/g, '');
                const expanded = dir.replace(/^~/, homedir());
                try {
                    const resolved = resolve(session.cwd, expanded);
                    if (existsSync(resolved))
                        session.cwd = resolved;
                }
                catch { /* keep current cwd */ }
            }
            // Save to disk
            saveTerminalState();
            resolve_(entry);
        });
        proc.on('error', (err) => {
            const entry = {
                command,
                output: `Error: ${err.message}`,
                exitCode: 1,
                timestamp: start,
                duration: Date.now() - start,
            };
            session.history.push(entry);
            session.lastActivity = Date.now();
            session.pendingCommand = null;
            session.pid = null;
            saveTerminalState();
            resolve_(entry);
        });
    });
}
// ─── State Persistence ────────────────────────────────────────────────────
function saveTerminalState() {
    try {
        if (!existsSync(KBOT_DIR))
            mkdirSync(KBOT_DIR, { recursive: true });
        const state = {
            sessions: Array.from(terminal.sessions.entries()).map(([_id, s]) => ({
                id: s.id,
                name: s.name,
                cwd: s.cwd,
                createdAt: s.createdAt,
                lastActivity: s.lastActivity,
                history: s.history.slice(-50), // save last 50 commands
                outputBuffer: s.outputBuffer.slice(-100), // save last 100 lines
            })),
            defaultSession: terminal.defaultSession,
            savedAt: Date.now(),
        };
        writeFileSync(TERMINAL_STATE, JSON.stringify(state, null, 2));
    }
    catch { /* best-effort persistence */ }
}
function loadTerminalState() {
    try {
        if (existsSync(TERMINAL_STATE)) {
            const raw = readFileSync(TERMINAL_STATE, 'utf-8');
            const state = JSON.parse(raw);
            for (const s of state.sessions || []) {
                terminal.sessions.set(s.id, {
                    id: s.id,
                    name: s.name,
                    cwd: s.cwd || homedir(),
                    env: { ...process.env },
                    history: s.history || [],
                    running: true,
                    pid: null,
                    createdAt: s.createdAt || Date.now(),
                    lastActivity: s.lastActivity || Date.now(),
                    outputBuffer: s.outputBuffer || [],
                    pendingCommand: null,
                    exitCode: null,
                });
            }
            if (state.defaultSession && terminal.sessions.has(state.defaultSession)) {
                terminal.defaultSession = state.defaultSession;
            }
        }
    }
    catch { /* start fresh if state is corrupted */ }
}
// ─── Command Queue ────────────────────────────────────────────────────────
function loadQueue() {
    try {
        if (existsSync(COMMAND_QUEUE)) {
            return JSON.parse(readFileSync(COMMAND_QUEUE, 'utf-8'));
        }
    }
    catch { /* empty queue on corruption */ }
    return [];
}
function saveQueue(queue) {
    try {
        if (!existsSync(KBOT_DIR))
            mkdirSync(KBOT_DIR, { recursive: true });
        writeFileSync(COMMAND_QUEUE, JSON.stringify(queue, null, 2));
    }
    catch { /* best-effort */ }
}
function queueCommand(command, sessionId, delay) {
    const queue = loadQueue();
    queue.push({
        command,
        session: sessionId,
        scheduledAt: Date.now(),
        runAt: delay ? Date.now() + delay : undefined,
    });
    saveQueue(queue);
}
async function processQueue() {
    const queue = loadQueue();
    if (queue.length === 0)
        return;
    const now = Date.now();
    const ready = queue.filter(q => !q.runAt || q.runAt <= now);
    const remaining = queue.filter(q => q.runAt != null && q.runAt > now);
    for (const cmd of ready) {
        const session = terminal.sessions.get(cmd.session);
        if (session) {
            await executeInSession(session, cmd.command);
        }
    }
    saveQueue(remaining);
}
function startQueueProcessor() {
    if (queueInterval)
        return;
    queueInterval = setInterval(() => {
        processQueue().catch(() => { });
    }, 10_000);
    // Don't keep the process alive just for the queue
    if (queueInterval.unref)
        queueInterval.unref();
}
// ─── Tool Registration ────────────────────────────────────────────────────
export function registerKBotTerminalTools() {
    // Initialize: load persisted state
    loadTerminalState();
    // Ensure at least one session exists
    if (terminal.sessions.size === 0) {
        const defaultSession = createShellSession('main');
        terminal.sessions.set(defaultSession.id, defaultSession);
        terminal.defaultSession = defaultSession.id;
        saveTerminalState();
    }
    else if (!terminal.defaultSession || !terminal.sessions.has(terminal.defaultSession)) {
        terminal.defaultSession = terminal.sessions.keys().next().value;
    }
    // Start background queue processor
    startQueueProcessor();
    registerTool({
        name: 'terminal_exec',
        description: 'Execute a command in kbot\'s persistent terminal. Shell state (cwd, history) persists across calls and sessions. Output is stored for later retrieval.',
        parameters: {
            command: { type: 'string', description: 'Shell command to execute', required: true },
            session: { type: 'string', description: 'Session name or ID (default: current default session)' },
        },
        tier: 'free',
        timeout: 300_000,
        async execute(args) {
            const sessionId = findSession(String(args.session || 'main'));
            const session = terminal.sessions.get(sessionId);
            if (!session)
                return 'Session not found. Use terminal_sessions action="list" to see available sessions.';
            const result = await executeInSession(session, String(args.command));
            return `[${session.name}:${session.cwd}] $ ${result.command}\n${result.output}\n[exit: ${result.exitCode}, ${result.duration}ms]`;
        },
    });
    registerTool({
        name: 'terminal_history',
        description: 'View command history from kbot\'s persistent terminal. Shows recent commands and their output. History persists across process restarts.',
        parameters: {
            count: { type: 'string', description: 'Number of recent commands to show (default: 10)' },
            session: { type: 'string', description: 'Session name or ID' },
        },
        tier: 'free',
        async execute(args) {
            const sessionId = findSession(String(args.session || 'main'));
            const session = terminal.sessions.get(sessionId);
            if (!session)
                return 'Session not found';
            const count = parseInt(String(args.count || '10'), 10) || 10;
            const recent = session.history.slice(-count);
            if (recent.length === 0)
                return `[${session.name}] No command history yet.`;
            return recent.map(h => `[${new Date(h.timestamp).toLocaleTimeString()}] $ ${h.command}\n${h.output.slice(0, 200)}${h.output.length > 200 ? '...' : ''}\n[exit: ${h.exitCode}, ${h.duration}ms]`).join('\n\n');
        },
    });
    registerTool({
        name: 'terminal_output',
        description: 'Get the current output buffer from a terminal session. Shows the last N lines of combined stdout/stderr output across all commands.',
        parameters: {
            lines: { type: 'string', description: 'Number of lines to show (default: 50)' },
            session: { type: 'string', description: 'Session name or ID' },
        },
        tier: 'free',
        async execute(args) {
            const sessionId = findSession(String(args.session || 'main'));
            const session = terminal.sessions.get(sessionId);
            if (!session)
                return 'Session not found';
            const lines = parseInt(String(args.lines || '50'), 10) || 50;
            const buf = session.outputBuffer.slice(-lines);
            if (buf.length === 0)
                return `[${session.name}] Output buffer empty.`;
            return buf.join('\n');
        },
    });
    registerTool({
        name: 'terminal_sessions',
        description: 'List, create, or close terminal sessions. Each session has its own cwd, history, and output buffer.',
        parameters: {
            action: { type: 'string', description: '"list", "new", or "close"', required: true },
            name: { type: 'string', description: 'Session name (for new/close)' },
        },
        tier: 'free',
        async execute(args) {
            const action = String(args.action);
            if (action === 'list') {
                const sessions = Array.from(terminal.sessions.values());
                if (sessions.length === 0)
                    return 'No sessions.';
                return sessions.map(s => {
                    const isDefault = s.id === terminal.defaultSession ? ' [default]' : '';
                    const pending = s.pendingCommand ? `\n    running: ${s.pendingCommand}` : '';
                    return `${s.name} (${s.id})${isDefault}\n    cwd: ${s.cwd}\n    commands: ${s.history.length}\n    last: ${new Date(s.lastActivity).toLocaleString()}${pending}`;
                }).join('\n\n');
            }
            if (action === 'new') {
                const name = String(args.name || `session-${terminal.sessions.size + 1}`);
                // Check for duplicate names
                for (const s of terminal.sessions.values()) {
                    if (s.name === name)
                        return `Session "${name}" already exists. Choose a different name.`;
                }
                const session = createShellSession(name);
                terminal.sessions.set(session.id, session);
                terminal.defaultSession = session.id;
                saveTerminalState();
                return `Created session: ${name} (${session.id}) — now the default session.`;
            }
            if (action === 'close') {
                if (!args.name)
                    return 'Specify session name to close.';
                const sessionId = findSession(String(args.name));
                if (!terminal.sessions.has(sessionId))
                    return `Session "${args.name}" not found.`;
                if (sessionId === terminal.defaultSession && terminal.sessions.size === 1) {
                    return 'Cannot close the last session.';
                }
                const closedName = terminal.sessions.get(sessionId)?.name;
                terminal.sessions.delete(sessionId);
                if (sessionId === terminal.defaultSession) {
                    terminal.defaultSession = terminal.sessions.keys().next().value;
                }
                saveTerminalState();
                return `Closed session: ${closedName}`;
            }
            return 'Unknown action. Use: list, new, close';
        },
    });
    registerTool({
        name: 'terminal_queue',
        description: 'Queue a command for later execution in kbot\'s terminal. Commands run autonomously every 10 seconds, even when no one is watching. Use for scheduled maintenance, builds, or autonomous operations.',
        parameters: {
            command: { type: 'string', description: 'Command to queue (omit to list pending queue)', required: false },
            delay_seconds: { type: 'string', description: 'Delay in seconds before execution (default: 0 = next cycle)' },
            session: { type: 'string', description: 'Session name or ID' },
            action: { type: 'string', description: '"add" (default), "list", or "clear"' },
        },
        tier: 'free',
        async execute(args) {
            const action = String(args.action || 'add');
            if (action === 'list') {
                const queue = loadQueue();
                if (queue.length === 0)
                    return 'Queue is empty.';
                return queue.map((q, i) => {
                    const delay = q.runAt ? `runs at ${new Date(q.runAt).toLocaleTimeString()}` : 'runs next cycle';
                    return `${i + 1}. [${q.session}] ${q.command}\n   scheduled: ${new Date(q.scheduledAt).toLocaleTimeString()}, ${delay}`;
                }).join('\n\n');
            }
            if (action === 'clear') {
                saveQueue([]);
                return 'Queue cleared.';
            }
            // action === 'add'
            if (!args.command)
                return 'Specify a command to queue, or use action="list" to view pending commands.';
            const delay = parseInt(String(args.delay_seconds || '0'), 10) * 1000;
            const sessionId = findSession(String(args.session || 'main'));
            queueCommand(String(args.command), sessionId, delay || undefined);
            return `Queued: ${args.command}${delay ? ` (runs in ${args.delay_seconds}s)` : ' (runs next cycle ~10s)'}`;
        },
    });
    registerTool({
        name: 'terminal_cwd',
        description: 'Get or change the working directory of a terminal session.',
        parameters: {
            path: { type: 'string', description: 'New directory path (omit to show current cwd)' },
            session: { type: 'string', description: 'Session name or ID' },
        },
        tier: 'free',
        async execute(args) {
            const sessionId = findSession(String(args.session || 'main'));
            const session = terminal.sessions.get(sessionId);
            if (!session)
                return 'Session not found';
            if (args.path) {
                const target = String(args.path).replace(/^~/, homedir());
                const resolved = resolve(session.cwd, target);
                if (existsSync(resolved)) {
                    session.cwd = resolved;
                    saveTerminalState();
                    return `[${session.name}] cwd: ${resolved}`;
                }
                return `Directory not found: ${resolved}`;
            }
            return `[${session.name}] cwd: ${session.cwd}`;
        },
    });
}
//# sourceMappingURL=kbot-terminal.js.map