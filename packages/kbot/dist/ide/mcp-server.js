// kbot MCP Server — Model Context Protocol for IDE integration
//
// Stdio JSON-RPC server implementing MCP specification.
// Exposes kbot's tools, agent loop, and resources to any MCP-compatible IDE.
//
// Supported IDEs: VS Code, Cursor, Windsurf, Zed, Neovim (via nvim-mcp)
//
// Usage:
//   kbot ide mcp
//
// VS Code config:
//   { "mcp": { "servers": { "kbot": { "command": "kbot", "args": ["ide", "mcp"] } } } }
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema, ListPromptsRequestSchema, GetPromptRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import { initBridge, chat, executeCommand, getTools, getStatus, getAgents, getMemory, getSessions, getContext, getFileDiagnostics, remember, setAgent, } from './bridge.js';
import { ResponseStream } from '../streaming.js';
import { formatDiagnostics } from './lsp-bridge.js';
/**
 * Start the MCP server on stdio.
 * This is the entry point called by `kbot ide mcp`.
 */
export async function startMcpServer(config = {}) {
    // Initialize bridge (registers tools, gathers context)
    await initBridge(config);
    const server = new Server({
        name: 'kbot',
        version: '2.0.0',
    }, {
        capabilities: {
            tools: {},
            resources: {},
            prompts: {},
        },
    });
    // ── Tool Definitions ──
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        // Static tools with custom MCP schemas (kept for backward compatibility)
        const staticTools = [
            {
                name: 'kbot_chat',
                description: 'Send a message to kbot and get an agent response. Supports 22 specialist agents with automatic routing.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        message: { type: 'string', description: 'The message to send to kbot' },
                        agent: { type: 'string', description: 'Force a specific agent (kernel, researcher, coder, writer, analyst, etc.). Defaults to auto-routing.' },
                    },
                    required: ['message'],
                },
            },
            {
                name: 'kbot_edit_file',
                description: 'Edit a file using search/replace. Finds old_string and replaces with new_string.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        path: { type: 'string', description: 'File path to edit' },
                        old_string: { type: 'string', description: 'Text to find' },
                        new_string: { type: 'string', description: 'Replacement text' },
                    },
                    required: ['path', 'old_string', 'new_string'],
                },
            },
            {
                name: 'kbot_write_file',
                description: 'Create or overwrite a file with content.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        path: { type: 'string', description: 'File path' },
                        content: { type: 'string', description: 'File content' },
                    },
                    required: ['path', 'content'],
                },
            },
            {
                name: 'kbot_read_file',
                description: 'Read the contents of a file.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        path: { type: 'string', description: 'File path to read' },
                    },
                    required: ['path'],
                },
            },
            {
                name: 'kbot_bash',
                description: 'Run a shell command and return the output.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        command: { type: 'string', description: 'Shell command to execute' },
                        timeout: { type: 'number', description: 'Timeout in milliseconds (default: 30000)' },
                    },
                    required: ['command'],
                },
            },
            {
                name: 'kbot_search',
                description: 'Search the web for information.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        query: { type: 'string', description: 'Search query' },
                    },
                    required: ['query'],
                },
            },
            {
                name: 'kbot_github',
                description: 'Search GitHub repositories and code.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        query: { type: 'string', description: 'GitHub search query' },
                        type: { type: 'string', description: 'Search type: repositories, code, issues' },
                    },
                    required: ['query'],
                },
            },
            {
                name: 'kbot_status',
                description: 'Get kbot status including agent info, learning stats, and session count.',
                inputSchema: {
                    type: 'object',
                    properties: {},
                },
            },
            {
                name: 'kbot_agent',
                description: 'Switch the active kbot agent or list available agents.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        agent: { type: 'string', description: 'Agent ID to switch to. Omit to list available agents.' },
                    },
                },
            },
            {
                name: 'kbot_remember',
                description: 'Teach kbot a fact that persists across sessions.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        fact: { type: 'string', description: 'The fact to remember' },
                    },
                    required: ['fact'],
                },
            },
            {
                name: 'kbot_diagnostics',
                description: 'Get LSP diagnostics (type errors, warnings) for a file.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        path: { type: 'string', description: 'File path to check' },
                    },
                    required: ['path'],
                },
            },
            {
                name: 'kbot_plan',
                description: 'Generate and execute an autonomous plan for a complex task.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        task: { type: 'string', description: 'The complex task to plan and execute' },
                        auto_approve: { type: 'boolean', description: 'Auto-approve (default: false)' },
                    },
                    required: ['task'],
                },
            },
            {
                name: 'kbot_glob',
                description: 'Find files matching a glob pattern.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        pattern: { type: 'string', description: 'Glob pattern (e.g., "**/*.ts")' },
                        path: { type: 'string', description: 'Base directory (default: cwd)' },
                    },
                    required: ['pattern'],
                },
            },
            {
                name: 'kbot_grep',
                description: 'Search file contents with regex.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        pattern: { type: 'string', description: 'Regex pattern' },
                        path: { type: 'string', description: 'File or directory to search' },
                    },
                    required: ['pattern'],
                },
            },
        ];
        // Dynamically append ALL registered tools from the tool registry
        const staticNames = new Set(staticTools.map(t => t.name));
        const registeredTools = getTools();
        const dynamicTools = registeredTools
            .filter(t => !staticNames.has(t.name) && !staticNames.has(`kbot_${t.name}`))
            .map(t => ({
            name: t.name,
            description: t.description,
            inputSchema: t.input_schema,
        }));
        return { tools: [...staticTools, ...dynamicTools] };
    });
    // ── Tool Execution ──
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        try {
            switch (name) {
                case 'kbot_chat': {
                    const message = args.message;
                    const agent = args.agent;
                    // Collect structured stream events for richer MCP responses
                    const stream = new ResponseStream();
                    const events = [];
                    stream.on((event) => events.push(event));
                    const response = await chat(message, { agent, responseStream: stream });
                    // Build MCP content blocks from collected events
                    const contentBlocks = [];
                    // Include thinking if present
                    const thinkingText = events
                        .filter(e => e.type === 'thinking_delta')
                        .map(e => e.text)
                        .join('');
                    if (thinkingText) {
                        contentBlocks.push({ type: 'text', text: `<thinking>\n${thinkingText}\n</thinking>` });
                    }
                    // Include tool results if any
                    const toolResults = events.filter(e => e.type === 'tool_result');
                    for (const tr of toolResults) {
                        contentBlocks.push({
                            type: 'text',
                            text: `[Tool: ${tr.name}] ${tr.error ? `Error: ${tr.error}` : tr.result}`,
                        });
                    }
                    // Main content
                    contentBlocks.push({ type: 'text', text: response.content });
                    return {
                        content: contentBlocks,
                        isError: false,
                    };
                }
                case 'kbot_edit_file': {
                    const result = await executeCommand('edit_file', args);
                    return {
                        content: [{ type: 'text', text: result.result }],
                        isError: result.error,
                    };
                }
                case 'kbot_write_file': {
                    const result = await executeCommand('write_file', args);
                    return {
                        content: [{ type: 'text', text: result.result }],
                        isError: result.error,
                    };
                }
                case 'kbot_read_file': {
                    const result = await executeCommand('read_file', args);
                    return {
                        content: [{ type: 'text', text: result.result }],
                        isError: result.error,
                    };
                }
                case 'kbot_bash': {
                    const result = await executeCommand('bash', args);
                    return {
                        content: [{ type: 'text', text: result.result }],
                        isError: result.error,
                    };
                }
                case 'kbot_search': {
                    const result = await executeCommand('web_search', args);
                    return {
                        content: [{ type: 'text', text: result.result }],
                        isError: result.error,
                    };
                }
                case 'kbot_github': {
                    const result = await executeCommand('github_search', args);
                    return {
                        content: [{ type: 'text', text: result.result }],
                        isError: result.error,
                    };
                }
                case 'kbot_status': {
                    const status = getStatus();
                    return {
                        content: [{
                                type: 'text',
                                text: JSON.stringify(status, null, 2),
                            }],
                        isError: false,
                    };
                }
                case 'kbot_agent': {
                    const agentId = args.agent;
                    if (agentId) {
                        setAgent(agentId);
                        return {
                            content: [{ type: 'text', text: `Agent set to: ${agentId}` }],
                            isError: false,
                        };
                    }
                    const agents = getAgents();
                    return {
                        content: [{
                                type: 'text',
                                text: agents.map(a => `${a.id}: ${a.name} — ${a.description}`).join('\n'),
                            }],
                        isError: false,
                    };
                }
                case 'kbot_remember': {
                    const fact = args.fact;
                    remember(fact);
                    return {
                        content: [{ type: 'text', text: `Learned: "${fact}"` }],
                        isError: false,
                    };
                }
                case 'kbot_diagnostics': {
                    const path = args.path;
                    const diags = await getFileDiagnostics(path);
                    return {
                        content: [{ type: 'text', text: formatDiagnostics(diags) }],
                        isError: false,
                    };
                }
                case 'kbot_plan': {
                    const taskArgs = args;
                    const { autonomousExecute, formatPlanSummary } = await import('../planner.js');
                    const plan = await autonomousExecute(taskArgs.task, { agent: 'coder' }, {
                        autoApprove: taskArgs.auto_approve || false,
                    });
                    return {
                        content: [{ type: 'text', text: formatPlanSummary(plan) }],
                        isError: plan.status === 'failed',
                    };
                }
                case 'kbot_glob': {
                    const result = await executeCommand('glob', args);
                    return {
                        content: [{ type: 'text', text: result.result }],
                        isError: result.error,
                    };
                }
                case 'kbot_grep': {
                    const result = await executeCommand('grep', args);
                    return {
                        content: [{ type: 'text', text: result.result }],
                        isError: result.error,
                    };
                }
                default: {
                    // Dynamic dispatch: forward any registered tool to executeCommand
                    const result = await executeCommand(name, (args || {}));
                    return {
                        content: [{ type: 'text', text: result.result }],
                        isError: result.error,
                    };
                }
            }
        }
        catch (err) {
            return {
                content: [{
                        type: 'text',
                        text: `Error: ${err instanceof Error ? err.message : String(err)}`,
                    }],
                isError: true,
            };
        }
    });
    // ── Resource Definitions ──
    server.setRequestHandler(ListResourcesRequestSchema, async () => {
        return {
            resources: [
                {
                    uri: 'kbot://context',
                    name: 'Project Context',
                    description: 'Current project context including git info, file tree, framework detection',
                    mimeType: 'application/json',
                },
                {
                    uri: 'kbot://memory',
                    name: 'Persistent Memory',
                    description: 'kbot persistent memory — learned facts, patterns, and user preferences',
                    mimeType: 'text/plain',
                },
                {
                    uri: 'kbot://agents',
                    name: 'Available Agents',
                    description: 'List of all available kbot specialist agents',
                    mimeType: 'application/json',
                },
                {
                    uri: 'kbot://sessions',
                    name: 'Saved Sessions',
                    description: 'List of saved conversation sessions',
                    mimeType: 'application/json',
                },
            ],
        };
    });
    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
        const { uri } = request.params;
        switch (uri) {
            case 'kbot://context':
                return {
                    contents: [{
                            uri,
                            mimeType: 'application/json',
                            text: JSON.stringify(getContext(), null, 2),
                        }],
                };
            case 'kbot://memory':
                return {
                    contents: [{
                            uri,
                            mimeType: 'text/plain',
                            text: getMemory() || '(no memory entries)',
                        }],
                };
            case 'kbot://agents':
                return {
                    contents: [{
                            uri,
                            mimeType: 'application/json',
                            text: JSON.stringify(getAgents(), null, 2),
                        }],
                };
            case 'kbot://sessions':
                return {
                    contents: [{
                            uri,
                            mimeType: 'application/json',
                            text: JSON.stringify(getSessions(), null, 2),
                        }],
                };
            default:
                throw new Error(`Unknown resource: ${uri}`);
        }
    });
    // ── Prompt Definitions ──
    server.setRequestHandler(ListPromptsRequestSchema, async () => {
        return {
            prompts: [
                { name: 'explain_code', description: 'Explain what code does', arguments: [{ name: 'code', required: true, description: 'Code to explain' }] },
                { name: 'review_code', description: 'Review code for bugs and improvements', arguments: [{ name: 'code', required: true, description: 'Code to review' }] },
                { name: 'fix_error', description: 'Fix a code error', arguments: [{ name: 'error', required: true, description: 'Error message' }, { name: 'code', required: false, description: 'Relevant code' }] },
                { name: 'generate_tests', description: 'Generate tests for code', arguments: [{ name: 'code', required: true, description: 'Code to test' }] },
                { name: 'refactor', description: 'Suggest refactoring improvements', arguments: [{ name: 'code', required: true, description: 'Code to refactor' }] },
            ],
        };
    });
    server.setRequestHandler(GetPromptRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        const a = (args || {});
        const promptMap = {
            explain_code: `Explain this code:\n\n\`\`\`\n${a.code}\n\`\`\``,
            review_code: `Review this code for bugs, security issues, and improvements:\n\n\`\`\`\n${a.code}\n\`\`\``,
            fix_error: `Fix this error:\n${a.error}\n${a.code ? `\nCode:\n\`\`\`\n${a.code}\n\`\`\`` : ''}`,
            generate_tests: `Generate tests for this code:\n\n\`\`\`\n${a.code}\n\`\`\``,
            refactor: `Refactor this code:\n\n\`\`\`\n${a.code}\n\`\`\``,
        };
        const text = promptMap[name];
        if (!text)
            throw new Error(`Unknown prompt: ${name}`);
        return { messages: [{ role: 'user', content: { type: 'text', text } }] };
    });
    // ── Start Server ──
    const transport = new StdioServerTransport();
    await server.connect(transport);
    // Log to stderr (stdout is for JSON-RPC)
    process.stderr.write('kbot MCP server started\n');
}
//# sourceMappingURL=mcp-server.js.map