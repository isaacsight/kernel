// kbot forge_tool — Runtime Self-Extension
//
// Creates new tools on the fly from natural language + JavaScript code.
// Tools are registered immediately and persisted to ~/.kbot/plugins/forged/
// for survival across sessions.
//
// Security: regex blocklist rejects dangerous patterns.
// Sandbox: test execution with 5s timeout before registration.
import { registerTool } from './index.js';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
const FORGED_DIR = join(homedir(), '.kbot', 'plugins', 'forged');
const REGISTRY_URL = 'https://eoxxpyixdieprsxlpwcs.supabase.co/functions/v1/forge-registry';
/** Patterns that are never allowed in forged tool code */
const DANGEROUS_PATTERNS = [
    // Code generation / eval
    /\beval\s*\(/,
    /\bnew\s+Function\b/,
    /\bAsyncFunction\b/,
    /\bgetPrototypeOf\b/,
    // Process control
    /\bprocess\.exit\b/,
    /\bprocess\.kill\b/,
    /\bprocess\.env\b/,
    /\bprocess\.binding\b/,
    // Child process — block both bare and node: protocol forms
    /\brequire\s*\(\s*['"`](?:node:)?child_process['"`]\s*\)/,
    /\bimport\s*\(\s*['"`](?:node:)?child_process['"`]\s*\)/,
    /\bexecSync\b/,
    /\bspawnSync\b/,
    /\bexecFileSync\b/,
    /(?<!\.)\bexec\s*\(/,
    /\bspawn\s*\(/,
    /\bexecFile\s*\(/,
    // Filesystem — block importing fs entirely (forged tools should not need raw fs)
    /\brequire\s*\(\s*['"`](?:node:)?fs['"`]\s*\)/,
    /\bimport\s*\(\s*['"`](?:node:)?fs['"`]\s*\)/,
    /\brequire\s*\(\s*['"`](?:node:)?fs\/promises['"`]\s*\)/,
    /\bimport\s*\(\s*['"`](?:node:)?fs\/promises['"`]\s*\)/,
    /\bfs\.(rm|rmdir|unlink|writeFile|appendFile|rename|chmod|chown)Sync\s*\(/,
    /\bfs\.\s*(rm|rmdir|unlink|writeFile|appendFile|rename|chmod|chown)\s*\(/,
    // Network — block raw networking modules
    /\brequire\s*\(\s*['"`](?:node:)?(?:net|dgram|tls|http2)['"`]\s*\)/,
    /\bimport\s*\(\s*['"`](?:node:)?(?:net|dgram|tls|http2)['"`]\s*\)/,
    // OS info / crypto access
    /\brequire\s*\(\s*['"`](?:node:)?(?:os|crypto)['"`]\s*\)/,
    /\bimport\s*\(\s*['"`](?:node:)?(?:os|crypto)['"`]\s*\)/,
    // Prototype pollution vectors
    /\bglobalThis\b/,
    /\b__proto__\b/,
    /\bconstructor\s*\[/,
    /\bProxy\s*\(/,
    /\bReflect\./,
    /Object\.setPrototypeOf\b/,
    /Object\.defineProperty\b/,
    // Dynamic import with variables (evasion via string concatenation)
    /\bimport\s*\(\s*[^'"`\s]/,
    /\brequire\s*\(\s*[^'"`\s]/,
    // Function constructor access via prototype chain (eval-equivalent bypass)
    /\)\s*\.constructor\b/,
    /\.\s*constructor\s*\(/,
    // process.mainModule gives require() access bypassing import blocks
    /\bprocess\.mainModule\b/,
    /\bprocess\[/,
];
/** Tool names that cannot be overwritten by forge_tool */
const RESERVED_NAMES = new Set([
    'forge_tool', 'bash', 'read_file', 'write_file', 'edit_file',
    'glob', 'grep', 'git_status', 'git_diff', 'git_commit',
    'web_search', 'url_fetch', 'mcp_search', 'mcp_install', 'mcp_connect', 'mcp_call',
]);
/** Validate forged tool code for dangerous patterns */
export function validateCode(code) {
    for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(code)) {
            return { safe: false, reason: `Blocked: code contains dangerous pattern ${pattern.source}` };
        }
    }
    return { safe: true };
}
/** Test-execute forged code with a 5s timeout to verify it works */
async function testExecution(code, testArgs) {
    const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;
    try {
        const fn = new AsyncFunction('args', code);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        try {
            const result = await Promise.race([
                fn(testArgs),
                new Promise((_, reject) => {
                    controller.signal.addEventListener('abort', () => reject(new Error('Forged tool test execution timed out after 5s')));
                }),
            ]);
            clearTimeout(timer);
            return { success: true, output: String(result ?? 'OK') };
        }
        finally {
            clearTimeout(timer);
        }
    }
    catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
}
/** Persist a forged tool to ~/.kbot/plugins/forged/ for future sessions */
function persistTool(name, description, parameters, code) {
    if (!existsSync(FORGED_DIR)) {
        mkdirSync(FORGED_DIR, { recursive: true });
    }
    const fileContent = `// Forged tool: ${name}
// Created: ${new Date().toISOString()}
// Description: ${description}

export default {
  name: ${JSON.stringify(name)},
  description: ${JSON.stringify(description)},
  parameters: ${JSON.stringify(parameters, null, 2)},
  tier: 'free',
  execute: async (args) => {
${code.split('\n').map(line => '    ' + line).join('\n')}
  },
}
`;
    writeFileSync(join(FORGED_DIR, `${name}.js`), fileContent);
}
/** Get the cloud token for authenticated registry operations */
async function getToken() {
    try {
        const { getCloudToken } = await import('../cloud-sync.js');
        return getCloudToken();
    }
    catch {
        return null;
    }
}
/** List all locally forged tools with metadata */
export function listForgedTools() {
    if (!existsSync(FORGED_DIR))
        return [];
    const tools = [];
    for (const file of readdirSync(FORGED_DIR).filter(f => f.endsWith('.js'))) {
        const filePath = join(FORGED_DIR, file);
        try {
            const content = readFileSync(filePath, 'utf-8');
            const nameMatch = content.match(/name:\s*"([^"]+)"/);
            const descMatch = content.match(/description:\s*"([^"]+)"/);
            const dateMatch = content.match(/Created:\s*(\S+)/);
            tools.push({
                name: nameMatch?.[1] || file.replace('.js', ''),
                description: descMatch?.[1] || 'No description',
                createdAt: dateMatch?.[1] || 'unknown',
                path: filePath,
            });
        }
        catch {
            tools.push({ name: file.replace('.js', ''), description: 'Error reading', createdAt: 'unknown', path: filePath });
        }
    }
    return tools;
}
/** Register the forge_tool itself */
export function registerForgeTools() {
    // ── Core forge_tool ──
    registerTool({
        name: 'forge_tool',
        description: 'Create a new tool at runtime from JavaScript code. The tool is immediately available and persisted for future sessions. Use this when no existing tool provides the capability you need.',
        parameters: {
            name: { type: 'string', description: 'Tool name (snake_case, e.g. "csv_parser")', required: true },
            description: { type: 'string', description: 'What the tool does (shown to AI for tool selection)', required: true },
            parameters: { type: 'object', description: 'Tool parameters as {paramName: {type, description, required?}}', required: true },
            code: { type: 'string', description: 'JavaScript async function body. Receives `args` object with the parameters. Must return a string result.', required: true },
        },
        tier: 'free',
        timeout: 10_000,
        execute: async (args) => {
            const name = String(args.name || '');
            const description = String(args.description || '');
            const code = String(args.code || '');
            const parameters = (args.parameters || {});
            // Validate inputs
            if (!name || !description || !code) {
                return 'Error: name, description, and code are all required.';
            }
            if (!/^[a-z][a-z0-9_]*$/.test(name)) {
                return 'Error: name must be snake_case (lowercase letters, numbers, underscores, starting with a letter).';
            }
            if (name.length > 64) {
                return 'Error: name must be 64 characters or fewer.';
            }
            if (RESERVED_NAMES.has(name)) {
                return `Error: "${name}" is a built-in tool and cannot be overwritten.`;
            }
            // Security check
            const validation = validateCode(code);
            if (!validation.safe) {
                return `Security error: ${validation.reason}`;
            }
            // Test execution with sample args
            const testArgs = {};
            for (const [key, param] of Object.entries(parameters)) {
                if (param.type === 'string')
                    testArgs[key] = 'test';
                else if (param.type === 'number')
                    testArgs[key] = 0;
                else if (param.type === 'boolean')
                    testArgs[key] = false;
                else if (param.type === 'array')
                    testArgs[key] = [];
                else
                    testArgs[key] = {};
            }
            const testResult = await testExecution(code, testArgs);
            if (!testResult.success) {
                return `Forge failed: test execution error: ${testResult.error}\nFix the code and try again.`;
            }
            // Create the tool definition
            const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;
            const toolDef = {
                name,
                description,
                parameters,
                tier: 'free',
                execute: async (toolArgs) => {
                    const fn = new AsyncFunction('args', code);
                    const result = await fn(toolArgs);
                    return String(result ?? '');
                },
            };
            // Register immediately (available this session)
            registerTool(toolDef);
            // Persist for future sessions
            try {
                persistTool(name, description, parameters, code);
            }
            catch {
                // Persistence failure is non-fatal — tool is still available this session
            }
            // Record in learning engine (async, non-blocking)
            try {
                const { learnFact } = await import('../learning.js');
                learnFact(`forge_tool: created "${name}" — ${description}`);
            }
            catch { /* non-critical */ }
            return `Tool "${name}" forged successfully.\nTest output: ${testResult.output}\nPersisted to ~/.kbot/plugins/forged/${name}.js\nAvailable immediately — use it now.`;
        },
    });
    // ── Forge Registry: publish to shared registry ──
    registerTool({
        name: 'forge_publish',
        description: 'Publish a locally forged tool to the shared forge registry so other kbot users can discover and install it. Requires a kernel.chat account.',
        parameters: {
            name: { type: 'string', description: 'Name of the forged tool to publish', required: true },
            tags: { type: 'string', description: 'Comma-separated tags (e.g. "parser,csv,data")', required: false },
        },
        tier: 'free',
        timeout: 15_000,
        execute: async (args) => {
            const name = String(args.name || '');
            const tags = String(args.tags || '').split(',').map(t => t.trim()).filter(Boolean);
            // Read the local forged tool
            const toolPath = join(FORGED_DIR, `${name}.js`);
            if (!existsSync(toolPath)) {
                return `Error: No forged tool named "${name}" found at ${toolPath}. Run forge_tool first.`;
            }
            const content = readFileSync(toolPath, 'utf-8');
            const descMatch = content.match(/description:\s*"([^"]+)"/);
            const description = descMatch?.[1] || name;
            // Extract code block
            const codeMatch = content.match(/execute:\s*async\s*\(args\)\s*=>\s*\{([\s\S]*)\},?\s*\}/);
            const code = codeMatch?.[1]?.trim() || '';
            // Extract parameters
            let parameters = {};
            try {
                const paramMatch = content.match(/parameters:\s*(\{[\s\S]*?\}),?\s*\n\s*tier/);
                if (paramMatch)
                    parameters = JSON.parse(paramMatch[1]);
            }
            catch { /* use empty */ }
            const token = await getToken();
            if (!token) {
                return 'Error: No kernel.chat token found. Run `kbot auth` with your kernel.chat account to publish.';
            }
            try {
                const res = await fetch(`${REGISTRY_URL}/publish`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                    body: JSON.stringify({ name, description, code, parameters, tags }),
                    signal: AbortSignal.timeout(10_000),
                });
                const data = await res.json();
                if (!res.ok)
                    return `Publish failed: ${data.error || res.status}`;
                return `Published "${name}" to forge registry (v${data.tool?.version || '1.0.0'}).\nOther kbot users can now install it with forge_install.`;
            }
            catch (err) {
                return `Publish failed: ${err instanceof Error ? err.message : String(err)}`;
            }
        },
    });
    // ── Forge Registry: search shared tools ──
    registerTool({
        name: 'forge_search',
        description: 'Search the shared forge registry for tools created by other kbot users.',
        parameters: {
            query: { type: 'string', description: 'Search query (tool name or description keywords)', required: true },
        },
        tier: 'free',
        timeout: 10_000,
        execute: async (args) => {
            const query = String(args.query || '');
            try {
                const res = await fetch(`${REGISTRY_URL}/search?q=${encodeURIComponent(query)}&limit=15`, {
                    signal: AbortSignal.timeout(8_000),
                });
                const data = await res.json();
                if (!data.tools || data.tools.length === 0) {
                    return `No forged tools found for "${query}". Be the first — create one with forge_tool, then publish with forge_publish.`;
                }
                const lines = data.tools.map((t) => `  ${t.name} (v${t.version}) — ${t.description}\n    ${t.downloads || 0} downloads · ${(t.tags || []).join(', ') || 'no tags'} · id: ${t.id}`);
                return `Forge Registry — ${data.tools.length} results for "${query}":\n\n${lines.join('\n\n')}\n\nInstall with forge_install using the tool id.`;
            }
            catch (err) {
                return `Search failed: ${err instanceof Error ? err.message : String(err)}`;
            }
        },
    });
    // ── Forge Registry: install from shared registry ──
    registerTool({
        name: 'forge_install',
        description: 'Install a forged tool from the shared registry. Downloads the code, validates security, and registers it locally.',
        parameters: {
            id: { type: 'string', description: 'Tool ID from forge_search results', required: true },
        },
        tier: 'free',
        timeout: 15_000,
        execute: async (args) => {
            const id = String(args.id || '');
            try {
                // Fetch tool from registry
                const res = await fetch(`${REGISTRY_URL}/tool/${id}`, {
                    signal: AbortSignal.timeout(8_000),
                });
                const data = await res.json();
                if (!res.ok || !data.tool) {
                    return `Tool not found: ${data.error || 'unknown error'}`;
                }
                const tool = data.tool;
                const { name, description, code, parameters } = tool;
                // Re-validate security locally (don't trust the server blindly)
                const validation = validateCode(code);
                if (!validation.safe) {
                    return `Security error: registry tool "${name}" contains blocked patterns. Not installed.`;
                }
                // Check reserved names
                if (RESERVED_NAMES.has(name)) {
                    return `Error: "${name}" is a reserved tool name. Cannot install.`;
                }
                // Test execution locally
                const testArgs = {};
                for (const [key, param] of Object.entries(parameters)) {
                    if (param.type === 'string')
                        testArgs[key] = 'test';
                    else if (param.type === 'number')
                        testArgs[key] = 0;
                    else if (param.type === 'boolean')
                        testArgs[key] = false;
                    else
                        testArgs[key] = {};
                }
                const testResult = await testExecution(code, testArgs);
                if (!testResult.success) {
                    return `Install failed: tool "${name}" failed local test execution: ${testResult.error}`;
                }
                // Register and persist
                const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;
                registerTool({
                    name,
                    description: `[registry] ${description}`,
                    parameters: parameters || {},
                    tier: 'free',
                    execute: async (toolArgs) => {
                        const fn = new AsyncFunction('args', code);
                        return String(await fn(toolArgs) ?? '');
                    },
                });
                persistTool(name, description, parameters || {}, code);
                // Record install on registry (non-blocking)
                fetch(`${REGISTRY_URL}/install`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id }),
                    signal: AbortSignal.timeout(5_000),
                }).catch(() => { });
                return `Installed "${name}" from forge registry (v${tool.version}, ${tool.downloads || 0} downloads).\nPersisted to ~/.kbot/plugins/forged/${name}.js\nAvailable immediately.`;
            }
            catch (err) {
                return `Install failed: ${err instanceof Error ? err.message : String(err)}`;
            }
        },
    });
    // ── Forge List: show all locally forged tools ──
    registerTool({
        name: 'forge_list',
        description: 'List all locally forged tools with metadata. Shows tools you created and tools installed from the registry.',
        parameters: {},
        tier: 'free',
        execute: async () => {
            const tools = listForgedTools();
            if (tools.length === 0) {
                return 'No forged tools yet. Use forge_tool to create one, or forge_search to find community tools.';
            }
            const lines = tools.map(t => `  ${t.name} — ${t.description}\n    Created: ${t.createdAt} · ${t.path}`);
            return `Forged tools (${tools.length}):\n\n${lines.join('\n\n')}\n\nPublish to the registry with forge_publish. Search community tools with forge_search.`;
        },
    });
}
//# sourceMappingURL=forge.js.map