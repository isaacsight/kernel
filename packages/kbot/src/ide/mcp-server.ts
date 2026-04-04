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

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import {
  initBridge,
  chat,
  executeCommand,
  getTools,
  getToolList,
  getStatus,
  getAgents,
  getMemory,
  getSessions,
  getContext,
  getFileDiagnostics,
  remember,
  setAgent,
  type BridgeConfig,
} from './bridge.js'
import { ResponseStream, type ResponseStreamEvent } from '../streaming.js'
import { formatDiagnostics } from './lsp-bridge.js'
import { createRequire } from 'node:module'

const __require = createRequire(import.meta.url)
const PKG_VERSION: string = (__require('../../package.json') as { version: string }).version

/** Sanitize error messages to prevent leaking internal paths, keys, or URLs */
function sanitizeError(err: unknown): string {
  if (err instanceof Error) {
    return err.message
      .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
      .replace(/apikey\s+\S+/gi, 'apikey [REDACTED]')
      .replace(/https?:\/\/[^\s]+/g, '[URL]')
      .replace(/\/Users\/[^\s]+/g, '[PATH]')
      .replace(/\/home\/[^\s]+/g, '[PATH]')
  }
  return 'An unexpected error occurred'
}

/**
 * Start the MCP server on stdio.
 * This is the entry point called by `kbot ide mcp`.
 */
export async function startMcpServer(config: BridgeConfig = {}): Promise<void> {
  // Initialize bridge (registers tools, gathers context)
  await initBridge(config)

  const server = new Server(
    {
      name: 'kbot',
      version: PKG_VERSION,
    },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
    },
  )

  // ── Tool Definitions ──

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    // Static tools with custom MCP schemas (kept for backward compatibility)
    const staticTools = [
      {
        name: 'kbot_chat',
        description: 'Send a natural language message to kbot and receive a specialist agent response. kbot automatically routes to the best-fit agent (coder, researcher, writer, analyst, guardian, or 30 others) based on message intent, or you can force a specific agent via the agent parameter. Use this tool when you need AI-powered assistance for coding, research, writing, analysis, security review, or any general task. Do not use this for direct file operations (use kbot_read_file, kbot_edit_file, kbot_write_file instead) or shell commands (use kbot_bash instead). Each call is stateless -- conversation history is not preserved between calls. Returns the agent response text, plus optional thinking traces and tool-use results if the agent invoked sub-tools.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            message: { type: 'string', description: 'The natural language message or task description for kbot. Must be a non-empty string. Be specific about what you need -- e.g., "refactor this function to use async/await" rather than "fix this".' },
            agent: { type: 'string', description: 'Force a specific specialist agent by ID. Available agents: "coder" (programming), "researcher" (research and fact-finding), "writer" (content creation), "analyst" (strategy and evaluation), "guardian" (security), "quant" (data analysis), "aesthete" (design), "infrastructure" (DevOps), and 27 more. Omit to let kbot auto-route based on message content.' },
          },
          required: ['message'],
        },
      },
      {
        name: 'kbot_edit_file',
        description: 'Edit an existing file by finding and replacing a specific text occurrence. Locates the first exact match of old_string in the file and replaces it with new_string. Use this tool for targeted, surgical edits to existing files -- prefer this over kbot_write_file when you only need to change part of a file. Do not use this for creating new files (use kbot_write_file instead). Always call kbot_read_file first to verify the exact text you want to replace. Side effects: modifies the file on disk. Fails with an error if old_string is not found or the file does not exist.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            path: { type: 'string', description: 'Absolute or relative file path to edit. The file must already exist.' },
            old_string: { type: 'string', description: 'Exact text to find in the file. Must match precisely including all whitespace and indentation. Copy the text from kbot_read_file output to ensure accuracy.' },
            new_string: { type: 'string', description: 'Replacement text to insert where old_string was found. Can be an empty string to delete the matched text.' },
          },
          required: ['path', 'old_string', 'new_string'],
        },
      },
      {
        name: 'kbot_write_file',
        description: 'Create a new file or completely overwrite an existing file with the provided content. Creates parent directories automatically if they do not exist. Use this tool when creating new files from scratch. Do not use this for partial edits to existing files (use kbot_edit_file instead, which preserves the rest of the file). If the target file already exists, call kbot_read_file first to avoid unintentional data loss. Side effects: writes to disk, may create directories.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            path: { type: 'string', description: 'Absolute or relative file path to write. Parent directories are created automatically if missing.' },
            content: { type: 'string', description: 'Complete file content to write. This replaces the entire file -- include all content, not just changes.' },
          },
          required: ['path', 'content'],
        },
      },
      {
        name: 'kbot_read_file',
        description: 'Read and return the full text contents of a file from the local filesystem. Use this tool to inspect source code, configuration files, documentation, or data files before making edits. Always call this before kbot_edit_file to verify the exact text you want to replace. Do not use this for binary files (images, compiled artifacts). Read-only operation with no side effects. Returns an error message if the file does not exist or is not readable.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            path: { type: 'string', description: 'Absolute or relative file path to read. Supports any text-based file format.' },
          },
          required: ['path'],
        },
      },
      {
        name: 'kbot_bash',
        description: 'Execute a shell command in the project working directory and return combined stdout and stderr output. Use this tool for build commands (npm run build), git operations (git status, git diff), package management (npm install), running tests (npm test), and system checks (which, ls, cat). Do not use this for file reading (use kbot_read_file) or file writing (use kbot_write_file) -- those tools are safer and more reliable. Destructive commands (rm -rf, git reset --hard) require user confirmation when --safe mode is enabled. Side effects: depends on the command executed. Commands exceeding the timeout are terminated with SIGTERM.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            command: { type: 'string', description: 'Shell command to execute. Avoid commands requiring interactive input (like vim, nano, or prompts). Pipe-friendly commands work best.' },
            timeout: { type: 'number', description: 'Maximum execution time in milliseconds before the command is killed. Default: 30000 (30 seconds). Maximum: 300000 (5 minutes). Increase for long-running builds or tests.' },
          },
          required: ['command'],
        },
      },
      {
        name: 'kbot_search',
        description: 'Search the web for current information and return summarized results. Use this tool when you need real-time data, recent events, up-to-date documentation, or answers not available in local files. Do not use this for searching the local project codebase (use kbot_grep or kbot_glob instead) or for GitHub-specific searches (use kbot_github instead). Read-only operation with no side effects. Requires a search provider to be configured via kbot auth.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            query: { type: 'string', description: 'Web search query string. Be specific and include relevant keywords for better results -- e.g., "React 19 useActionState migration guide" rather than "React hooks".' },
          },
          required: ['query'],
        },
      },
      {
        name: 'kbot_github',
        description: 'Search GitHub for repositories, code snippets, or issues/PRs matching a query. Use this tool to find libraries, reference implementations, open issues, or code examples across public GitHub repositories. Do not use this for web searches (use kbot_search instead) or local file searches (use kbot_grep instead). Read-only operation with no side effects. Returns structured results with repository names, descriptions, star counts, and URLs.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            query: { type: 'string', description: 'GitHub search query. Supports GitHub search qualifiers like "language:typescript", "stars:>100", "topic:mcp-server". Example: "mcp server language:typescript stars:>50".' },
            type: { type: 'string', description: 'What to search for. "repositories" searches repo names and descriptions. "code" searches file contents across repos. "issues" searches issue and PR titles and bodies. Default: "repositories".' },
          },
          required: ['query'],
        },
      },
      {
        name: 'kbot_status',
        description: 'Retrieve kbot runtime status as a JSON object. Returns the active specialist agent, learning engine statistics (patterns, solutions, knowledge entries, total messages processed), session count, and registered tool count. Use this tool to verify kbot is properly configured, check which agent is active, or monitor learning progress. Do not use this for project-specific status (use kbot_bash with "git status" instead). Read-only operation with no side effects.',
        inputSchema: {
          type: 'object' as const,
          properties: {},
        },
      },
      {
        name: 'kbot_agent',
        description: 'Switch the active specialist agent for subsequent kbot_chat calls, or list all available agents when called without arguments. Use this tool to optimize responses by selecting the right specialist -- e.g., switch to "guardian" before a security review, or "researcher" before a deep-dive investigation. Do not use this if you only need to route a single message (pass the agent parameter to kbot_chat instead). Side effects: when agent ID is provided, changes the active agent for all future kbot_chat calls in this session.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            agent: { type: 'string', description: 'Agent ID to activate. Examples: "coder", "researcher", "writer", "analyst", "guardian", "quant", "infrastructure", "aesthete". Omit this parameter entirely to list all 35 available agents with descriptions.' },
          },
        },
      },
      {
        name: 'kbot_remember',
        description: 'Store a fact in kbot persistent memory that persists across sessions and restarts. Use this tool to teach kbot project-specific conventions (e.g., "This project uses pnpm, not npm"), user preferences (e.g., "User prefers functional React components"), or domain knowledge that should inform future agent responses. Do not use this for temporary notes or session-specific context. Side effects: writes to the learning database on disk at ~/.kbot/. Facts are automatically surfaced to agents as context in future sessions.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            fact: { type: 'string', description: 'The fact, convention, or knowledge to persist. Be specific and declarative -- e.g., "This project uses Vitest for testing, not Jest" rather than "testing stuff".' },
          },
          required: ['fact'],
        },
      },
      {
        name: 'kbot_diagnostics',
        description: 'Retrieve TypeScript/JavaScript diagnostics (type errors, warnings, lint issues) for a specific source file via the kbot LSP bridge. Use this tool to check for type errors before committing changes, to verify that a fix resolved a type issue, or to understand compilation errors. Do not use this for runtime errors (use kbot_bash to run the code instead) or for non-TypeScript files. Read-only operation with no side effects. Returns formatted diagnostic messages with file path, line number, column, severity level, and error message.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            path: { type: 'string', description: 'Absolute or relative path to the TypeScript or JavaScript file to check for diagnostics.' },
          },
          required: ['path'],
        },
      },
      {
        name: 'kbot_plan',
        description: 'Generate and optionally execute an autonomous multi-step plan for a complex task. The planner analyzes the task, breaks it into ordered subtasks, selects appropriate tools for each step, executes them sequentially, and self-corrects on failures with retries. Use this tool for complex multi-file refactors, full-stack feature implementations, research-then-implement workflows, or any task requiring coordination of multiple tools. Do not use this for simple single-step operations (use the specific tool directly). Side effects: depends on plan steps -- may read/write files, run shell commands, make API calls. Set auto_approve=false to review the generated plan before any execution begins.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            task: { type: 'string', description: 'Detailed description of the complex task to plan and execute. More context leads to better plans -- include relevant file paths, expected outcomes, and constraints.' },
            auto_approve: { type: 'boolean', description: 'Controls whether plan steps execute automatically. false (default): generates the plan and returns it for review without executing. true: generates and immediately executes all steps without confirmation.' },
          },
          required: ['task'],
        },
      },
      {
        name: 'kbot_glob',
        description: 'Find files matching a glob pattern in the project directory tree. Use this tool to discover files by name pattern before reading or editing them -- e.g., find all test files, all TypeScript files in a directory, or locate a specific config file. Do not use this for searching file contents (use kbot_grep instead). Read-only operation with no side effects. Returns a list of matching absolute file paths sorted by most recently modified first.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            pattern: { type: 'string', description: 'Glob pattern to match against file paths. Supports ** for recursive directory matching, * for single-level wildcards, and {a,b} for alternatives. Examples: "**/*.ts" (all TypeScript files), "src/**/*.test.tsx" (all test files in src), "*.json" (JSON files in current directory).' },
            path: { type: 'string', description: 'Base directory to start searching from. Default: current working directory. Use an absolute path for predictable results.' },
          },
          required: ['pattern'],
        },
      },
      {
        name: 'kbot_grep',
        description: 'Search file contents for lines matching a regular expression pattern. Use this tool to find function definitions, string references, import statements, TODO comments, or any text pattern across the project codebase. Do not use this for finding files by name (use kbot_glob instead) or for web searches (use kbot_search instead). Read-only operation with no side effects. Returns matching lines with file path, line number, and the matched line content.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            pattern: { type: 'string', description: 'Regular expression pattern to search for in file contents. Supports full regex syntax. Examples: "function\\s+\\w+" (function declarations), "TODO|FIXME|HACK" (code annotations), "import.*from \'react\'" (React imports).' },
            path: { type: 'string', description: 'File or directory to search in. When a directory is given, searches recursively through all text files. Default: current working directory.' },
          },
          required: ['pattern'],
        },
      },
    ]

    // Dynamically append ALL registered tools from the tool registry
    const staticNames = new Set(staticTools.map(t => t.name))
    const registeredTools = getTools()
    const dynamicTools = registeredTools
      .filter(t => !staticNames.has(t.name) && !staticNames.has(`kbot_${t.name}`))
      .map(t => ({
        name: t.name,
        description: t.description,
        inputSchema: t.input_schema as { type: 'object'; properties: Record<string, unknown>; required?: string[] },
      }))

    return { tools: [...staticTools, ...dynamicTools] }
  })

  // ── Tool Execution ──

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params

    try {
      switch (name) {
        case 'kbot_chat': {
          const message = (args as { message: string; agent?: string }).message
          const agent = (args as { agent?: string }).agent

          // Collect structured stream events for richer MCP responses
          const stream = new ResponseStream()
          const events: ResponseStreamEvent[] = []
          stream.on((event) => events.push(event))

          const response = await chat(message, { agent, responseStream: stream })

          // Build MCP content blocks from collected events
          const contentBlocks: Array<{ type: 'text'; text: string }> = []

          // Include thinking if present
          const thinkingText = events
            .filter(e => e.type === 'thinking_delta')
            .map(e => (e as { type: 'thinking_delta'; text: string }).text)
            .join('')
          if (thinkingText) {
            contentBlocks.push({ type: 'text' as const, text: `<thinking>\n${thinkingText}\n</thinking>` })
          }

          // Include tool results if any
          const toolResults = events.filter(e => e.type === 'tool_result') as Array<{
            type: 'tool_result'; id: string; name: string; result: string; error?: string
          }>
          for (const tr of toolResults) {
            contentBlocks.push({
              type: 'text' as const,
              text: `[Tool: ${tr.name}] ${tr.error ? `Error: ${tr.error}` : tr.result}`,
            })
          }

          // Main content
          contentBlocks.push({ type: 'text' as const, text: response.content })

          return {
            content: contentBlocks,
            isError: false,
          }
        }

        case 'kbot_edit_file': {
          const result = await executeCommand('edit_file', args as Record<string, unknown>)
          return {
            content: [{ type: 'text' as const, text: result.result }],
            isError: result.error,
          }
        }

        case 'kbot_write_file': {
          const result = await executeCommand('write_file', args as Record<string, unknown>)
          return {
            content: [{ type: 'text' as const, text: result.result }],
            isError: result.error,
          }
        }

        case 'kbot_read_file': {
          const result = await executeCommand('read_file', args as Record<string, unknown>)
          return {
            content: [{ type: 'text' as const, text: result.result }],
            isError: result.error,
          }
        }

        case 'kbot_bash': {
          const result = await executeCommand('bash', args as Record<string, unknown>)
          return {
            content: [{ type: 'text' as const, text: result.result }],
            isError: result.error,
          }
        }

        case 'kbot_search': {
          const result = await executeCommand('web_search', args as Record<string, unknown>)
          return {
            content: [{ type: 'text' as const, text: result.result }],
            isError: result.error,
          }
        }

        case 'kbot_github': {
          const result = await executeCommand('github_search', args as Record<string, unknown>)
          return {
            content: [{ type: 'text' as const, text: result.result }],
            isError: result.error,
          }
        }

        case 'kbot_status': {
          const status = getStatus()
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify(status, null, 2),
            }],
            isError: false,
          }
        }

        case 'kbot_agent': {
          const agentId = (args as { agent?: string }).agent
          if (agentId) {
            setAgent(agentId)
            return {
              content: [{ type: 'text' as const, text: `Agent set to: ${agentId}` }],
              isError: false,
            }
          }
          const agents = getAgents()
          return {
            content: [{
              type: 'text' as const,
              text: agents.map(a => `${a.id}: ${a.name} — ${a.description}`).join('\n'),
            }],
            isError: false,
          }
        }

        case 'kbot_remember': {
          const fact = (args as { fact: string }).fact
          remember(fact)
          return {
            content: [{ type: 'text' as const, text: `Learned: "${fact}"` }],
            isError: false,
          }
        }

        case 'kbot_diagnostics': {
          const path = (args as { path: string }).path
          const diags = await getFileDiagnostics(path)
          return {
            content: [{ type: 'text' as const, text: formatDiagnostics(diags) }],
            isError: false,
          }
        }

        case 'kbot_plan': {
          const taskArgs = args as { task: string; auto_approve?: boolean }
          const { autonomousExecute, formatPlanSummary } = await import('../planner.js')
          const plan = await autonomousExecute(taskArgs.task, { agent: 'coder' }, {
            autoApprove: taskArgs.auto_approve || false,
          })
          return {
            content: [{ type: 'text' as const, text: formatPlanSummary(plan) }],
            isError: plan.status === 'failed',
          }
        }

        case 'kbot_glob': {
          const result = await executeCommand('glob', args as Record<string, unknown>)
          return {
            content: [{ type: 'text' as const, text: result.result }],
            isError: result.error,
          }
        }

        case 'kbot_grep': {
          const result = await executeCommand('grep', args as Record<string, unknown>)
          return {
            content: [{ type: 'text' as const, text: result.result }],
            isError: result.error,
          }
        }

        default: {
          // Dynamic dispatch: forward any registered tool to executeCommand
          const result = await executeCommand(name, (args || {}) as Record<string, unknown>)
          return {
            content: [{ type: 'text' as const, text: result.result }],
            isError: result.error,
          }
        }
      }
    } catch (err) {
      return {
        content: [{
          type: 'text' as const,
          text: `Error: ${sanitizeError(err)}`,
        }],
        isError: true,
      }
    }
  })

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
    }
  })

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params

    switch (uri) {
      case 'kbot://context':
        return {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(getContext(), null, 2),
          }],
        }

      case 'kbot://memory':
        return {
          contents: [{
            uri,
            mimeType: 'text/plain',
            text: getMemory() || '(no memory entries)',
          }],
        }

      case 'kbot://agents':
        return {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(getAgents(), null, 2),
          }],
        }

      case 'kbot://sessions':
        return {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(getSessions(), null, 2),
          }],
        }

      default:
        throw new Error(`Unknown resource: ${uri}`)
    }
  })

  // ── Prompt Definitions ──

  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
      prompts: [
        { name: 'explain_code', description: 'Generate a detailed explanation of what a code snippet does, including its purpose, control flow, key operations, and return values. Use this when you need to understand unfamiliar code.', arguments: [{ name: 'code', required: true, description: 'The source code snippet to explain. Can be any programming language.' }] },
        { name: 'review_code', description: 'Perform a code review identifying bugs, security vulnerabilities, performance issues, and improvement opportunities. Returns categorized findings with severity levels and suggested fixes.', arguments: [{ name: 'code', required: true, description: 'The source code to review. Include enough surrounding context for accurate analysis.' }] },
        { name: 'fix_error', description: 'Diagnose and fix a code error given an error message and optionally the relevant source code. Returns the corrected code with an explanation of what caused the error and how the fix resolves it.', arguments: [{ name: 'error', required: true, description: 'The full error message, stack trace, or diagnostic output.' }, { name: 'code', required: false, description: 'The source code that produced the error. Include the function or block containing the error for best results.' }] },
        { name: 'generate_tests', description: 'Generate comprehensive test cases for a code snippet, covering happy paths, edge cases, error conditions, and boundary values. Outputs test code in the appropriate testing framework for the language.', arguments: [{ name: 'code', required: true, description: 'The source code to generate tests for. Include type signatures and function documentation for better test coverage.' }] },
        { name: 'refactor', description: 'Analyze code and suggest refactoring improvements for readability, maintainability, performance, and adherence to best practices. Returns the refactored code with explanations for each change.', arguments: [{ name: 'code', required: true, description: 'The source code to refactor. Include the complete function or module for context-aware suggestions.' }] },
      ],
    }
  })

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params
    const a = (args || {}) as Record<string, string>

    const promptMap: Record<string, string> = {
      explain_code: `Explain this code:\n\n\`\`\`\n${a.code}\n\`\`\``,
      review_code: `Review this code for bugs, security issues, and improvements:\n\n\`\`\`\n${a.code}\n\`\`\``,
      fix_error: `Fix this error:\n${a.error}\n${a.code ? `\nCode:\n\`\`\`\n${a.code}\n\`\`\`` : ''}`,
      generate_tests: `Generate tests for this code:\n\n\`\`\`\n${a.code}\n\`\`\``,
      refactor: `Refactor this code:\n\n\`\`\`\n${a.code}\n\`\`\``,
    }

    const text = promptMap[name]
    if (!text) throw new Error(`Unknown prompt: ${name}`)

    return { messages: [{ role: 'user' as const, content: { type: 'text' as const, text } }] }
  })

  // ── Start Server ──

  const transport = new StdioServerTransport()
  await server.connect(transport)

  // Log to stderr (stdout is for JSON-RPC)
  process.stderr.write('kbot MCP server started\n')
}
