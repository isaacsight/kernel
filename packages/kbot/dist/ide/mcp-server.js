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
import { createRequire } from 'node:module';
const __require = createRequire(import.meta.url);
const PKG_VERSION = __require('../../package.json').version;
/** Sanitize error messages to prevent leaking internal paths, keys, or URLs */
function sanitizeError(err) {
    if (err instanceof Error) {
        return err.message
            .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
            .replace(/apikey\s+\S+/gi, 'apikey [REDACTED]')
            .replace(/https?:\/\/[^\s]+/g, '[URL]')
            .replace(/\/Users\/[^\s]+/g, '[PATH]')
            .replace(/\/home\/[^\s]+/g, '[PATH]');
    }
    return 'An unexpected error occurred';
}
/**
 * Start the MCP server on stdio.
 * This is the entry point called by `kbot ide mcp`.
 */
export async function startMcpServer(config = {}) {
    // Initialize bridge (registers tools, gathers context)
    await initBridge(config);
    const server = new Server({
        name: 'kbot',
        version: PKG_VERSION,
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
                description: 'Send a message to kbot and receive a specialist agent response. Automatically routes to the best agent (kernel, researcher, coder, writer, analyst, etc.) based on message content, or you can force a specific agent. Use this for general queries, code help, research, writing, or analysis. Each call is stateless. Returns the agent response with optional thinking and tool-use traces.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        message: { type: 'string', description: 'The message or task for kbot. Non-empty string.' },
                        agent: { type: 'string', description: 'Force a specific specialist agent by ID (e.g., "researcher", "coder", "writer", "analyst"). Omit for automatic routing based on message content.' },
                    },
                    required: ['message'],
                },
            },
            {
                name: 'kbot_edit_file',
                description: 'Edit a file by replacing a specific text occurrence with new text. Finds the first match of old_string in the file and replaces it with new_string. Side effects: modifies the file on disk. Use kbot_read_file first to verify the exact text to replace. Fails if old_string is not found in the file.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        path: { type: 'string', description: 'Absolute or relative file path to edit' },
                        old_string: { type: 'string', description: 'Exact text to find in the file. Must match precisely including whitespace.' },
                        new_string: { type: 'string', description: 'Replacement text. Can be empty string to delete the matched text.' },
                    },
                    required: ['path', 'old_string', 'new_string'],
                },
            },
            {
                name: 'kbot_write_file',
                description: 'Create a new file or overwrite an existing file with the provided content. Side effects: writes to disk, creating parent directories if needed. Use kbot_read_file first if updating an existing file to avoid data loss. For targeted edits, prefer kbot_edit_file instead.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        path: { type: 'string', description: 'Absolute or relative file path to write' },
                        content: { type: 'string', description: 'Complete file content to write' },
                    },
                    required: ['path', 'content'],
                },
            },
            {
                name: 'kbot_read_file',
                description: 'Read and return the full contents of a file from the local filesystem. Read-only operation with no side effects. Use this to inspect source code, config files, or data before editing. Returns an error if the file does not exist or is not readable.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        path: { type: 'string', description: 'Absolute or relative file path to read' },
                    },
                    required: ['path'],
                },
            },
            {
                name: 'kbot_bash',
                description: 'Execute a shell command in the project directory and return stdout/stderr. Side effects: depends on the command executed. Destructive commands (rm, git reset) require confirmation when --safe mode is enabled. Use for build commands, git operations, package management, or system checks. Commands that exceed the timeout are terminated.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        command: { type: 'string', description: 'Shell command to execute. Avoid commands requiring interactive input.' },
                        timeout: { type: 'number', description: 'Timeout in milliseconds. Default: 30000 (30 seconds). Maximum: 300000 (5 minutes).' },
                    },
                    required: ['command'],
                },
            },
            {
                name: 'kbot_search',
                description: 'Search the web for current information, documentation, or answers. Returns summarized search results. Use this for real-time data, recent events, or when local knowledge is insufficient. Read-only operation with no side effects. Requires a configured search provider.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        query: { type: 'string', description: 'Search query string. Be specific for better results.' },
                    },
                    required: ['query'],
                },
            },
            {
                name: 'kbot_github',
                description: 'Search GitHub for repositories, code snippets, or issues matching a query. Read-only operation with no side effects. Use this to find libraries, reference implementations, or open issues. Returns structured results with repo names, descriptions, and URLs.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        query: { type: 'string', description: 'GitHub search query. Supports GitHub search syntax (e.g., "language:typescript stars:>100").' },
                        type: { type: 'string', description: 'Search scope: "repositories" for repos, "code" for file contents, "issues" for issues/PRs. Default: "repositories".' },
                    },
                    required: ['query'],
                },
            },
            {
                name: 'kbot_status',
                description: 'Retrieve kbot runtime status including active agent, learning statistics, session count, and tool registry size. Read-only operation with no side effects. Use this to check system health or verify configuration before performing tasks.',
                inputSchema: {
                    type: 'object',
                    properties: {},
                },
            },
            {
                name: 'kbot_agent',
                description: 'Switch the active specialist agent or list all available agents. When called with an agent ID, switches routing for subsequent kbot_chat calls. When called without arguments, returns a list of all available agents with IDs and descriptions. Side effects: changes the active agent for the session when agent is provided.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        agent: { type: 'string', description: 'Agent ID to activate (e.g., "researcher", "coder"). Omit to list all available agents.' },
                    },
                },
            },
            {
                name: 'kbot_remember',
                description: 'Store a fact in kbot persistent memory that survives across sessions. Side effects: writes to the learning database on disk. Use this to teach kbot project-specific patterns, preferences, or conventions. Facts are used by the agent for future context.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        fact: { type: 'string', description: 'The fact or knowledge to persist (e.g., "This project uses Vitest for testing").' },
                    },
                    required: ['fact'],
                },
            },
            {
                name: 'kbot_diagnostics',
                description: 'Retrieve LSP diagnostics (type errors, warnings, lint issues) for a specific file via the kbot LSP bridge. Read-only operation with no side effects. Use this to check for type errors before committing or to verify fixes. Returns formatted diagnostic messages with line numbers and severity.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        path: { type: 'string', description: 'Absolute or relative file path to check for diagnostics' },
                    },
                    required: ['path'],
                },
            },
            {
                name: 'kbot_plan',
                description: 'Generate and optionally execute an autonomous multi-step plan for a complex task. The planner breaks the task into subtasks, executes tools sequentially, and self-corrects on failure. Side effects: depends on the plan steps (may read/write files, run commands). Set auto_approve=false (default) to review the plan before execution. Use this for multi-file refactors, complex builds, or research tasks.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        task: { type: 'string', description: 'Description of the complex task to plan and execute' },
                        auto_approve: { type: 'boolean', description: 'If true, execute all plan steps without confirmation. Default: false (review plan first).' },
                    },
                    required: ['task'],
                },
            },
            {
                name: 'kbot_glob',
                description: 'Find files matching a glob pattern in the project directory. Read-only operation with no side effects. Use this to discover files before reading or editing them. Returns a list of matching file paths sorted by modification time.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        pattern: { type: 'string', description: 'Glob pattern to match (e.g., "**/*.ts", "src/**/*.test.tsx")' },
                        path: { type: 'string', description: 'Base directory to search from. Default: current working directory.' },
                    },
                    required: ['pattern'],
                },
            },
            {
                name: 'kbot_grep',
                description: 'Search file contents using a regular expression pattern. Read-only operation with no side effects. Use this to find code patterns, function definitions, or string references across the project. Returns matching lines with file paths and line numbers.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        pattern: { type: 'string', description: 'Regular expression pattern to search for (e.g., "function\\s+\\w+", "TODO|FIXME")' },
                        path: { type: 'string', description: 'File or directory to search in. Default: current working directory.' },
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
                        text: `Error: ${sanitizeError(err)}`,
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