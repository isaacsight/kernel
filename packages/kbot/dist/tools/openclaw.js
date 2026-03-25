// kbot OpenClaw Tools — The iPhone of Tokens
//
// Jensen Huang: "OpenClaw did for agentic systems what ChatGPT did for generative systems."
//
// Connects kbot to OpenClaw Gateway — discover agents, send messages,
// manage sessions across 20+ platforms (WhatsApp, Telegram, Slack, Discord, iMessage, etc.)
//
// Architecture: kbot ←→ OpenClaw Gateway (http://127.0.0.1:18789)
import { registerTool } from './index.js';
const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || 'http://127.0.0.1:18789';
async function clawFetch(path, options) {
    const response = await fetch(`${GATEWAY_URL}${path}`, {
        method: options?.method || 'GET',
        headers: { 'Content-Type': 'application/json' },
        body: options?.body ? JSON.stringify(options.body) : undefined,
    });
    if (!response.ok) {
        const text = await response.text().catch(() => response.statusText);
        throw new Error(`OpenClaw Gateway error: ${response.status} ${text}`);
    }
    return response.json();
}
export function registerOpenClawTools() {
    registerTool({
        name: 'openclaw_status',
        description: 'Check if OpenClaw Gateway is running. Returns agent info, connected platforms, and session count.',
        parameters: {},
        tier: 'free',
        async execute() {
            try {
                const status = await clawFetch('/api/status');
                return JSON.stringify(status, null, 2);
            }
            catch (err) {
                return `OpenClaw Gateway not running at ${GATEWAY_URL}.\nStart with: openclaw start\nError: ${err instanceof Error ? err.message : String(err)}`;
            }
        },
    });
    registerTool({
        name: 'openclaw_sessions',
        description: 'List active OpenClaw conversations across all platforms (WhatsApp, Telegram, Slack, Discord, iMessage, etc.).',
        parameters: {
            platform: { type: 'string', description: 'Filter by platform (e.g., whatsapp, telegram, slack, discord)' },
            limit: { type: 'string', description: 'Max sessions to return. Default: 20' },
        },
        tier: 'free',
        async execute(args) {
            const sessions = await clawFetch('/api/sessions');
            let filtered = sessions;
            if (args.platform) {
                filtered = sessions.filter(s => s.platform.toLowerCase().includes(String(args.platform).toLowerCase()));
            }
            const limit = Number(args.limit) || 20;
            filtered = filtered.slice(0, limit);
            if (filtered.length === 0)
                return 'No active sessions found.';
            return filtered.map(s => `[${s.platform}] ${s.contact} (${s.id})${s.lastMessage ? ` — "${s.lastMessage}"` : ''}`).join('\n');
        },
    });
    registerTool({
        name: 'openclaw_history',
        description: 'Get conversation history for an OpenClaw session. Useful for understanding context before responding.',
        parameters: {
            session_id: { type: 'string', description: 'Session ID to get history for', required: true },
            limit: { type: 'string', description: 'Max messages to return. Default: 50' },
        },
        tier: 'free',
        async execute(args) {
            const messages = await clawFetch(`/api/sessions/${args.session_id}/history`);
            const limit = Number(args.limit) || 50;
            const recent = messages.slice(-limit);
            if (recent.length === 0)
                return 'No messages in this session.';
            return recent.map(m => `[${m.role}]${m.timestamp ? ` (${m.timestamp})` : ''}: ${m.content}`).join('\n');
        },
    });
    registerTool({
        name: 'openclaw_send',
        description: 'Send a message through OpenClaw to any platform. Reply to existing sessions or start new conversations on WhatsApp, Telegram, Slack, Discord, iMessage, etc.',
        parameters: {
            message: { type: 'string', description: 'Message to send', required: true },
            session_id: { type: 'string', description: 'Session ID for existing conversation' },
            platform: { type: 'string', description: 'Platform for new conversation (e.g., whatsapp, telegram, slack)' },
            contact: { type: 'string', description: 'Contact for new conversation (phone number, username, channel)' },
        },
        tier: 'free',
        async execute(args) {
            if (args.session_id) {
                const result = await clawFetch(`/api/sessions/${args.session_id}/send`, {
                    method: 'POST', body: { message: String(args.message) },
                });
                return result.status || 'Message sent.';
            }
            if (args.platform && args.contact) {
                const result = await clawFetch('/api/sessions/new', {
                    method: 'POST',
                    body: { platform: String(args.platform), contact: String(args.contact), message: String(args.message) },
                });
                return result.session_id ? `New session ${result.session_id} — sent to ${args.contact} on ${args.platform}.` : 'Message sent.';
            }
            return 'Provide session_id (existing) or platform + contact (new conversation).';
        },
    });
    registerTool({
        name: 'openclaw_agents',
        description: 'List OpenClaw agents running on the Gateway. Shows names, models, SOUL config, and status.',
        parameters: {},
        tier: 'free',
        async execute() {
            const agents = await clawFetch('/api/agents');
            if (agents.length === 0)
                return 'No agents configured. Create a SOUL.md and run: openclaw agent start';
            return agents.map(a => `${a.name} [${a.status}]${a.model ? ` — ${a.model}` : ''}`).join('\n');
        },
    });
    registerTool({
        name: 'openclaw_delegate',
        description: 'Delegate a task to an OpenClaw agent. The agent uses its SOUL personality and model to process the task. Use for multi-agent collaboration where kbot orchestrates OpenClaw agents.',
        parameters: {
            agent: { type: 'string', description: 'OpenClaw agent name to delegate to', required: true },
            task: { type: 'string', description: 'Task or message for the agent', required: true },
            context: { type: 'string', description: 'Optional context (conversation history, file contents)' },
        },
        tier: 'free',
        async execute(args) {
            const result = await clawFetch('/api/agents/delegate', {
                method: 'POST',
                body: { agent: String(args.agent), task: String(args.task), context: String(args.context || '') },
            });
            return result.response || result.error || 'No response from agent.';
        },
    });
    registerTool({
        name: 'openclaw_broadcast',
        description: 'Broadcast a message across multiple OpenClaw sessions or platforms simultaneously. For announcements, notifications, multi-channel comms.',
        parameters: {
            message: { type: 'string', description: 'Message to broadcast', required: true },
            platforms: { type: 'string', description: 'Comma-separated platforms to broadcast to (e.g., "whatsapp,telegram,slack")' },
        },
        tier: 'free',
        async execute(args) {
            const platforms = args.platforms ? String(args.platforms).split(',').map(p => p.trim()) : [];
            const result = await clawFetch('/api/broadcast', {
                method: 'POST',
                body: { message: String(args.message), platforms },
            });
            return result.sent !== undefined ? `Broadcast: ${result.sent} sent, ${result.failed || 0} failed.` : result.error || 'Broadcast sent.';
        },
    });
    registerTool({
        name: 'openclaw_soul',
        description: 'Read or update an OpenClaw agent\'s SOUL.md — the personality, capabilities, and behavior configuration.',
        parameters: {
            agent: { type: 'string', description: 'Agent name', required: true },
            action: { type: 'string', description: '"read" or "update"', required: true },
            content: { type: 'string', description: 'New SOUL.md content (for update)' },
        },
        tier: 'free',
        async execute(args) {
            if (args.action === 'read') {
                const soul = await clawFetch(`/api/agents/${args.agent}/soul`);
                return soul.content || 'No SOUL.md found.';
            }
            if (args.action === 'update' && args.content) {
                await clawFetch(`/api/agents/${args.agent}/soul`, { method: 'PUT', body: { content: String(args.content) } });
                return `SOUL.md updated for "${args.agent}".`;
            }
            return 'Use action="read" or action="update" with content.';
        },
    });
}
//# sourceMappingURL=openclaw.js.map