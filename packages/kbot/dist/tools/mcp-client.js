// kbot MCP Client — Connect to and consume external MCP servers
//
// Lets kbot use tools from any MCP server: databases, APIs, Supabase,
// filesystem servers, custom tools, etc.
//
// Flow:
//   1. mcp_connect — launch an MCP server process and cache the connection
//   2. mcp_list_tools — list tools available from a connected server
//   3. mcp_call — call a tool on a connected MCP server
//   4. mcp_disconnect — shut down a connected server
//   5. mcp_list_resources — list resources from a connected server
//   6. mcp_read_resource — read a resource from a connected server
import { spawn } from 'node:child_process';
import { registerTool } from './index.js';
function encodeJsonRpc(msg) {
    const body = JSON.stringify(msg);
    return `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`;
}
const connections = new Map();
function parseMessages(conn) {
    while (true) {
        const headerEnd = conn.buffer.indexOf('\r\n\r\n');
        if (headerEnd === -1)
            break;
        const header = conn.buffer.slice(0, headerEnd);
        const lengthMatch = header.match(/Content-Length:\s*(\d+)/i);
        if (!lengthMatch) {
            conn.buffer = conn.buffer.slice(headerEnd + 4);
            continue;
        }
        const contentLength = parseInt(lengthMatch[1], 10);
        const bodyStart = headerEnd + 4;
        if (conn.buffer.length < bodyStart + contentLength)
            break;
        const body = conn.buffer.slice(bodyStart, bodyStart + contentLength);
        conn.buffer = conn.buffer.slice(bodyStart + contentLength);
        try {
            const msg = JSON.parse(body);
            if (msg.id !== undefined && conn.pending.has(msg.id)) {
                const { resolve, reject } = conn.pending.get(msg.id);
                conn.pending.delete(msg.id);
                if (msg.error) {
                    reject(new Error(msg.error.message));
                }
                else {
                    resolve(msg.result);
                }
            }
        }
        catch {
            // skip malformed
        }
    }
}
function sendRequest(conn, method, params) {
    return new Promise((resolve, reject) => {
        const id = ++conn.messageId;
        conn.pending.set(id, { resolve, reject });
        const msg = { jsonrpc: '2.0', id, method, params };
        conn.process.stdin?.write(encodeJsonRpc(msg));
        // Timeout after 30s
        setTimeout(() => {
            if (conn.pending.has(id)) {
                conn.pending.delete(id);
                reject(new Error(`MCP request timeout: ${method}`));
            }
        }, 30000);
    });
}
function sendNotification(conn, method, params) {
    const msg = { jsonrpc: '2.0', method, params };
    conn.process.stdin?.write(encodeJsonRpc(msg));
}
// ── Tool registration ──
export function registerMcpClientTools() {
    registerTool({
        name: 'mcp_connect',
        description: 'Connect to an MCP server. Launches the server process, performs initialize handshake, and caches the connection. The server stays running until mcp_disconnect.',
        parameters: {
            name: { type: 'string', description: 'Unique name for this connection (e.g., "supabase", "filesystem")', required: true },
            command: { type: 'string', description: 'Command to launch the MCP server (e.g., "npx -y @supabase/mcp-server")', required: true },
            args: { type: 'array', description: 'Additional arguments for the command', items: { type: 'string' } },
            env: { type: 'object', description: 'Environment variables to set for the server process' },
        },
        tier: 'free',
        async execute(args) {
            const name = String(args.name);
            const command = String(args.command);
            const extraArgs = args.args || [];
            const env = args.env || {};
            if (connections.has(name)) {
                return `Already connected to "${name}". Use mcp_disconnect first to reconnect.`;
            }
            // Parse command into parts
            const parts = command.split(/\s+/);
            const cmd = parts[0];
            const cmdArgs = [...parts.slice(1), ...extraArgs];
            let proc;
            try {
                proc = spawn(cmd, cmdArgs, {
                    stdio: ['pipe', 'pipe', 'pipe'],
                    env: { ...process.env, ...env },
                });
            }
            catch (err) {
                return `Error: Failed to launch "${command}": ${err instanceof Error ? err.message : String(err)}`;
            }
            const conn = {
                name,
                command: [cmd, ...cmdArgs],
                process: proc,
                messageId: 0,
                pending: new Map(),
                buffer: '',
                capabilities: {},
                tools: [],
                resources: [],
            };
            proc.stdout?.on('data', (chunk) => {
                conn.buffer += chunk.toString();
                parseMessages(conn);
            });
            proc.on('error', () => {
                connections.delete(name);
            });
            proc.on('exit', () => {
                connections.delete(name);
            });
            connections.set(name, conn);
            // Initialize handshake
            try {
                const initResult = await sendRequest(conn, 'initialize', {
                    protocolVersion: '2024-11-05',
                    capabilities: {},
                    clientInfo: { name: 'kbot', version: '2.0.0' },
                });
                conn.capabilities = initResult?.capabilities || {};
                sendNotification(conn, 'initialized', {});
                // Fetch tools
                try {
                    const toolsResult = await sendRequest(conn, 'tools/list', {});
                    conn.tools = toolsResult?.tools || [];
                }
                catch {
                    // Server may not support tools
                }
                // Fetch resources
                try {
                    const resourcesResult = await sendRequest(conn, 'resources/list', {});
                    conn.resources = resourcesResult?.resources || [];
                }
                catch {
                    // Server may not support resources
                }
                return `Connected to "${name}" — ${conn.tools.length} tools, ${conn.resources.length} resources available`;
            }
            catch (err) {
                proc.kill();
                connections.delete(name);
                return `Error: MCP handshake failed: ${err instanceof Error ? err.message : String(err)}`;
            }
        },
    });
    registerTool({
        name: 'mcp_list_tools',
        description: 'List tools available from a connected MCP server.',
        parameters: {
            name: { type: 'string', description: 'Connection name', required: true },
        },
        tier: 'free',
        async execute(args) {
            const name = String(args.name);
            const conn = connections.get(name);
            if (!conn)
                return `Error: Not connected to "${name}". Use mcp_connect first.`;
            if (conn.tools.length === 0)
                return `No tools available from "${name}".`;
            return conn.tools.map(t => `${t.name}: ${t.description || '(no description)'}`).join('\n');
        },
    });
    registerTool({
        name: 'mcp_call',
        description: 'Call a tool on a connected MCP server. Returns the tool result.',
        parameters: {
            name: { type: 'string', description: 'Connection name', required: true },
            tool: { type: 'string', description: 'Tool name to call', required: true },
            arguments: { type: 'object', description: 'Arguments to pass to the tool' },
        },
        tier: 'free',
        async execute(args) {
            const name = String(args.name);
            const tool = String(args.tool);
            const toolArgs = args.arguments || {};
            const conn = connections.get(name);
            if (!conn)
                return `Error: Not connected to "${name}". Use mcp_connect first.`;
            try {
                const result = await sendRequest(conn, 'tools/call', {
                    name: tool,
                    arguments: toolArgs,
                });
                if (result?.content) {
                    return result.content.map(c => c.text || JSON.stringify(c)).join('\n');
                }
                return JSON.stringify(result, null, 2);
            }
            catch (err) {
                return `Error calling ${tool}: ${err instanceof Error ? err.message : String(err)}`;
            }
        },
    });
    registerTool({
        name: 'mcp_disconnect',
        description: 'Disconnect from an MCP server and shut down the process.',
        parameters: {
            name: { type: 'string', description: 'Connection name', required: true },
        },
        tier: 'free',
        async execute(args) {
            const name = String(args.name);
            const conn = connections.get(name);
            if (!conn)
                return `Not connected to "${name}".`;
            try {
                await sendRequest(conn, 'shutdown', null);
                sendNotification(conn, 'exit', null);
            }
            catch {
                // Force kill if graceful shutdown fails
            }
            conn.process.kill();
            connections.delete(name);
            return `Disconnected from "${name}"`;
        },
    });
    registerTool({
        name: 'mcp_list_resources',
        description: 'List resources available from a connected MCP server.',
        parameters: {
            name: { type: 'string', description: 'Connection name', required: true },
        },
        tier: 'free',
        async execute(args) {
            const name = String(args.name);
            const conn = connections.get(name);
            if (!conn)
                return `Error: Not connected to "${name}". Use mcp_connect first.`;
            if (conn.resources.length === 0)
                return `No resources available from "${name}".`;
            return conn.resources.map(r => `${r.uri}: ${r.name}${r.description ? ` — ${r.description}` : ''}`).join('\n');
        },
    });
    registerTool({
        name: 'mcp_read_resource',
        description: 'Read a resource from a connected MCP server.',
        parameters: {
            name: { type: 'string', description: 'Connection name', required: true },
            uri: { type: 'string', description: 'Resource URI to read', required: true },
        },
        tier: 'free',
        async execute(args) {
            const name = String(args.name);
            const uri = String(args.uri);
            const conn = connections.get(name);
            if (!conn)
                return `Error: Not connected to "${name}". Use mcp_connect first.`;
            try {
                const result = await sendRequest(conn, 'resources/read', { uri });
                if (result?.contents) {
                    return result.contents.map(c => c.text || JSON.stringify(c)).join('\n');
                }
                return JSON.stringify(result, null, 2);
            }
            catch (err) {
                return `Error reading ${uri}: ${err instanceof Error ? err.message : String(err)}`;
            }
        },
    });
    registerTool({
        name: 'mcp_servers',
        description: 'List all active MCP server connections.',
        parameters: {},
        tier: 'free',
        async execute() {
            if (connections.size === 0)
                return 'No active MCP connections.';
            const lines = [];
            for (const [name, conn] of connections) {
                lines.push(`${name}: ${conn.command.join(' ')} — ${conn.tools.length} tools, ${conn.resources.length} resources`);
            }
            return lines.join('\n');
        },
    });
}
//# sourceMappingURL=mcp-client.js.map