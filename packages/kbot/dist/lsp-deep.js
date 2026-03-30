// kbot Deep LSP Integration
//
// Wires language servers deeper into the agent loop:
//   1. Auto-attach to the right LSP server for the project
//   2. Proactive diagnostics monitoring injected into agent context
//   3. Type-aware file context enrichment (hover/type info)
//   4. Smart reference checking before modifying symbols
//   5. Auto-fix suggestions for common diagnostic codes
//
// Unlike lsp-bridge.ts (one-shot diagnostics), this module maintains
// a persistent LSP session for continuous intelligence.
import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join, extname, resolve, relative } from 'node:path';
import { execSync } from 'node:child_process';
const LSP_SERVERS = {
    typescript: {
        command: ['typescript-language-server', '--stdio'],
        languageIds: ['typescript', 'typescriptreact', 'javascript', 'javascriptreact'],
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
        detectBinary: 'typescript-language-server',
    },
    python: {
        command: ['pyright-langserver', '--stdio'],
        languageIds: ['python'],
        extensions: ['.py'],
        detectBinary: 'pyright-langserver',
    },
    'python-pylsp': {
        command: ['pylsp'],
        languageIds: ['python'],
        extensions: ['.py'],
        detectBinary: 'pylsp',
    },
    rust: {
        command: ['rust-analyzer'],
        languageIds: ['rust'],
        extensions: ['.rs'],
        detectBinary: 'rust-analyzer',
    },
    go: {
        command: ['gopls', 'serve'],
        languageIds: ['go', 'gomod'],
        extensions: ['.go'],
        detectBinary: 'gopls',
    },
    clangd: {
        command: ['clangd'],
        languageIds: ['c', 'cpp', 'objc', 'objcpp'],
        extensions: ['.c', '.cpp', '.cc', '.cxx', '.h', '.hpp'],
        detectBinary: 'clangd',
    },
    java: {
        command: ['jdtls'],
        languageIds: ['java'],
        extensions: ['.java'],
        detectBinary: 'jdtls',
    },
    lua: {
        command: ['lua-language-server'],
        languageIds: ['lua'],
        extensions: ['.lua'],
        detectBinary: 'lua-language-server',
    },
    ruby: {
        command: ['solargraph', 'stdio'],
        languageIds: ['ruby'],
        extensions: ['.rb'],
        detectBinary: 'solargraph',
    },
    zig: {
        command: ['zls'],
        languageIds: ['zig'],
        extensions: ['.zig'],
        detectBinary: 'zls',
    },
};
// ── Internal State ──
let activeServer = null;
let activeConfig = null;
let activeProjectDir = null;
let messageId = 0;
let buffer = '';
let initialized = false;
let fileWatcher = null;
const context = {
    diagnostics: [],
    symbols: [],
    references: new Map(),
    typeInfo: new Map(),
    serverCapabilities: {},
};
// Pending request callbacks
const pendingRequests = new Map();
function encodeMessage(msg) {
    const body = JSON.stringify(msg);
    return `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`;
}
function parseMessages(data) {
    const messages = [];
    let remaining = data;
    while (remaining.length > 0) {
        const headerEnd = remaining.indexOf('\r\n\r\n');
        if (headerEnd === -1)
            break;
        const header = remaining.slice(0, headerEnd);
        const lengthMatch = header.match(/Content-Length:\s*(\d+)/i);
        if (!lengthMatch)
            break;
        const contentLength = parseInt(lengthMatch[1], 10);
        const bodyStart = headerEnd + 4;
        const body = remaining.slice(bodyStart, bodyStart + contentLength);
        if (body.length < contentLength)
            break;
        try {
            messages.push(JSON.parse(body));
        }
        catch {
            if (process.env.KBOT_DEBUG) {
                process.stderr.write('[lsp-deep] malformed JSON-RPC message\n');
            }
        }
        remaining = remaining.slice(bodyStart + contentLength);
    }
    return { messages, remaining };
}
function mapSeverity(severity) {
    switch (severity) {
        case 1: return 'error';
        case 2: return 'warning';
        case 3: return 'info';
        case 4: return 'hint';
        default: return 'warning';
    }
}
const SYMBOL_KIND_MAP = {
    1: 'file', 2: 'module', 3: 'namespace', 4: 'package', 5: 'class',
    6: 'method', 7: 'property', 8: 'field', 9: 'constructor', 10: 'enum',
    11: 'interface', 12: 'function', 13: 'variable', 14: 'constant', 15: 'string',
    16: 'number', 17: 'boolean', 18: 'array', 19: 'object', 20: 'key',
    21: 'null', 22: 'enum_member', 23: 'struct', 24: 'event', 25: 'operator',
    26: 'type_parameter',
};
function getLanguageId(filePath) {
    const ext = extname(filePath).toLowerCase();
    const map = {
        '.ts': 'typescript', '.tsx': 'typescriptreact',
        '.js': 'javascript', '.jsx': 'javascriptreact',
        '.py': 'python', '.rs': 'rust', '.go': 'go',
        '.c': 'c', '.cpp': 'cpp', '.cc': 'cpp', '.h': 'c', '.hpp': 'cpp',
        '.java': 'java', '.rb': 'ruby', '.lua': 'lua', '.zig': 'zig',
    };
    return map[ext] || 'plaintext';
}
// ── LSP Communication ──
function sendRequest(method, params, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
        if (!activeServer?.stdin) {
            reject(new Error('LSP server not running'));
            return;
        }
        const id = ++messageId;
        const timer = setTimeout(() => {
            pendingRequests.delete(id);
            reject(new Error(`LSP request ${method} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
        pendingRequests.set(id, { resolve, reject, timer });
        activeServer.stdin.write(encodeMessage({
            jsonrpc: '2.0',
            id,
            method,
            params,
        }));
    });
}
function sendNotification(method, params) {
    if (!activeServer?.stdin)
        return;
    activeServer.stdin.write(encodeMessage({
        jsonrpc: '2.0',
        method,
        params,
    }));
}
function handleMessage(msg) {
    // Response to a request
    if (msg.id !== undefined && pendingRequests.has(msg.id)) {
        const pending = pendingRequests.get(msg.id);
        pendingRequests.delete(msg.id);
        clearTimeout(pending.timer);
        if (msg.error) {
            pending.reject(new Error(msg.error.message));
        }
        else {
            pending.resolve(msg.result);
        }
        return;
    }
    // Notification from server
    if (msg.method === 'textDocument/publishDiagnostics') {
        handleDiagnostics(msg.params);
    }
}
function handleDiagnostics(params) {
    const file = params.uri.replace('file://', '');
    // Remove old diagnostics for this file
    context.diagnostics = context.diagnostics.filter(d => d.file !== file);
    // Add new diagnostics
    for (const d of params.diagnostics) {
        context.diagnostics.push({
            file,
            line: d.range.start.line + 1,
            column: d.range.start.character + 1,
            severity: mapSeverity(d.severity),
            message: d.message,
            source: d.source || 'lsp',
            code: d.code !== undefined ? String(d.code) : undefined,
        });
    }
}
// ── Project Detection ──
function detectProjectServer(projectDir) {
    // Check for project markers and pick the right server
    const markers = [
        { file: 'tsconfig.json', server: 'typescript' },
        { file: 'jsconfig.json', server: 'typescript' },
        { file: 'package.json', server: 'typescript' },
        { file: 'pyproject.toml', server: 'python' },
        { file: 'setup.py', server: 'python' },
        { file: 'requirements.txt', server: 'python' },
        { file: 'Cargo.toml', server: 'rust' },
        { file: 'go.mod', server: 'go' },
        { file: 'CMakeLists.txt', server: 'clangd' },
        { file: 'Makefile', server: 'clangd' },
        { file: 'pom.xml', server: 'java' },
        { file: 'build.gradle', server: 'java' },
        { file: 'Gemfile', server: 'ruby' },
        { file: 'build.zig', server: 'zig' },
    ];
    for (const marker of markers) {
        if (existsSync(join(projectDir, marker.file))) {
            const config = LSP_SERVERS[marker.server];
            if (config && isBinaryAvailable(config.detectBinary)) {
                return config;
            }
            // If primary not available, try fallback (e.g., pylsp for python)
            if (marker.server === 'python') {
                const fallback = LSP_SERVERS['python-pylsp'];
                if (fallback && isBinaryAvailable(fallback.detectBinary)) {
                    return fallback;
                }
            }
        }
    }
    // Fallback: scan file extensions
    try {
        const entries = readdirSync(projectDir).slice(0, 100);
        const extCounts = {};
        for (const entry of entries) {
            const ext = extname(entry).toLowerCase();
            if (ext)
                extCounts[ext] = (extCounts[ext] || 0) + 1;
        }
        // Find the most common extension that has an LSP server
        const sorted = Object.entries(extCounts).sort((a, b) => b[1] - a[1]);
        for (const [ext] of sorted) {
            for (const config of Object.values(LSP_SERVERS)) {
                if (config.extensions.includes(ext) && isBinaryAvailable(config.detectBinary)) {
                    return config;
                }
            }
        }
    }
    catch { /* ignore */ }
    return null;
}
function isBinaryAvailable(binary) {
    try {
        execSync(`which ${binary}`, { stdio: 'ignore', timeout: 3000 });
        return true;
    }
    catch {
        return false;
    }
}
// ── Public API ──
/**
 * Attach to the appropriate language server for the project.
 *
 * Detects the project type, spawns the right LSP server, initializes
 * the protocol, and begins monitoring diagnostics. Returns the live
 * LSPContext that updates as the server reports new information.
 */
export async function attachLSP(projectDir) {
    const absDir = resolve(projectDir);
    // Detach existing session if any
    if (activeServer) {
        detachLSP();
    }
    const serverConfig = detectProjectServer(absDir);
    if (!serverConfig) {
        if (process.env.KBOT_DEBUG) {
            process.stderr.write('[lsp-deep] no suitable language server found\n');
        }
        return context;
    }
    activeConfig = serverConfig;
    activeProjectDir = absDir;
    messageId = 0;
    buffer = '';
    initialized = false;
    context.diagnostics = [];
    context.symbols = [];
    context.references.clear();
    context.typeInfo.clear();
    context.serverCapabilities = {};
    // Spawn the server
    try {
        activeServer = spawn(serverConfig.command[0], serverConfig.command.slice(1), {
            stdio: ['pipe', 'pipe', 'pipe'],
            cwd: absDir,
        });
    }
    catch (err) {
        if (process.env.KBOT_DEBUG) {
            process.stderr.write(`[lsp-deep] spawn failed: ${err.message}\n`);
        }
        return context;
    }
    activeServer.on('error', (err) => {
        if (process.env.KBOT_DEBUG) {
            process.stderr.write(`[lsp-deep] server error: ${err.message}\n`);
        }
    });
    activeServer.on('exit', (code) => {
        if (process.env.KBOT_DEBUG) {
            process.stderr.write(`[lsp-deep] server exited with code ${code}\n`);
        }
        activeServer = null;
        initialized = false;
    });
    // Handle incoming messages
    activeServer.stdout?.on('data', (chunk) => {
        buffer += chunk.toString();
        const { messages, remaining } = parseMessages(buffer);
        buffer = remaining;
        for (const msg of messages) {
            handleMessage(msg);
        }
    });
    // Initialize the LSP protocol
    const rootUri = `file://${absDir}`;
    try {
        const initResult = await sendRequest('initialize', {
            processId: process.pid,
            capabilities: {
                textDocument: {
                    publishDiagnostics: { relatedInformation: true, codeDescriptionSupport: true },
                    hover: { contentFormat: ['plaintext', 'markdown'] },
                    completion: { completionItem: { snippetSupport: false } },
                    definition: { linkSupport: false },
                    references: {},
                    documentSymbol: { hierarchicalDocumentSymbolSupport: true },
                },
                workspace: {
                    workspaceFolders: true,
                },
            },
            rootUri,
            workspaceFolders: [{ uri: rootUri, name: 'workspace' }],
        }, 15000);
        // Parse server capabilities
        if (initResult && typeof initResult === 'object') {
            const caps = initResult.capabilities || {};
            context.serverCapabilities = {
                hover: !!caps.hoverProvider,
                definition: !!caps.definitionProvider,
                references: !!caps.referencesProvider,
                documentSymbol: !!caps.documentSymbolProvider,
                completion: !!caps.completionProvider,
                rename: !!caps.renameProvider,
                codeAction: !!caps.codeActionProvider,
                formatting: !!caps.documentFormattingProvider,
            };
        }
        // Send initialized notification
        sendNotification('initialized', {});
        initialized = true;
    }
    catch (err) {
        if (process.env.KBOT_DEBUG) {
            process.stderr.write(`[lsp-deep] initialize failed: ${err.message}\n`);
        }
        detachLSP();
        return context;
    }
    return context;
}
/**
 * Get all current diagnostics, optionally filtered to errors/warnings only.
 *
 * Returns a snapshot of diagnostics from the LSP server. Use this
 * to inject context into the agent prompt like:
 * "There are 3 TypeScript errors in src/auth.ts"
 */
export function getProactiveDiagnostics() {
    return [...context.diagnostics];
}
/**
 * Enrich file content with type information from the LSP.
 *
 * Adds inline type annotations as comments for the agent to understand
 * the code better. Only annotates function signatures and variable
 * declarations to avoid noise.
 */
export function enrichFileContext(file, content) {
    if (!initialized || !context.serverCapabilities.hover) {
        return content;
    }
    const absPath = resolve(file);
    const fileUri = `file://${absPath}`;
    // Open the file in the LSP server
    sendNotification('textDocument/didOpen', {
        textDocument: {
            uri: fileUri,
            languageId: getLanguageId(absPath),
            version: 1,
            text: content,
        },
    });
    // For synchronous enrichment, return the content with cached type info
    const lines = content.split('\n');
    const enrichedLines = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        enrichedLines.push(line);
        // Check if we have cached type info for this line
        const key = `${absPath}:${i + 1}`;
        const typeHint = context.typeInfo.get(key);
        if (typeHint) {
            enrichedLines.push(`  // [type] ${typeHint}`);
        }
    }
    // Close the file
    sendNotification('textDocument/didClose', {
        textDocument: { uri: fileUri },
    });
    return enrichedLines.join('\n');
}
/**
 * Get all references to a symbol at a given position.
 *
 * Use this before modifying a function/variable to understand the
 * blast radius of the change.
 */
export function getReferencesForSymbol(file, line, col) {
    const cacheKey = `${file}:${line}:${col}`;
    // Return cached references if available
    if (context.references.has(cacheKey)) {
        return context.references.get(cacheKey);
    }
    if (!initialized || !context.serverCapabilities.references) {
        return [];
    }
    const absPath = resolve(file);
    const fileUri = `file://${absPath}`;
    // Fire the request — result will be cached when it arrives
    sendRequest('textDocument/references', {
        textDocument: { uri: fileUri },
        position: { line: line - 1, character: col - 1 },
        context: { includeDeclaration: true },
    }, 8000).then((result) => {
        if (Array.isArray(result)) {
            const locations = result.map((ref) => ({
                file: ref.uri.replace('file://', ''),
                line: ref.range.start.line + 1,
                column: ref.range.start.character + 1,
            }));
            context.references.set(cacheKey, locations);
        }
    }).catch(() => {
        // Silently ignore reference lookup failures
    });
    return [];
}
/**
 * Suggest a fix strategy for a diagnostic.
 *
 * Maps common diagnostic codes to actionable fix descriptions that
 * the agent can use to auto-correct code.
 */
export function suggestFix(diagnostic) {
    const { code, message, source } = diagnostic;
    // TypeScript common errors
    if (source === 'ts' || source === 'typescript') {
        const tsFixMap = {
            '2304': `Import or declare the identifier: ${extractIdentifier(message)}`,
            '2305': `The module does not export this member. Check the export name or use a different import.`,
            '2307': `Module not found. Install the package or fix the import path.`,
            '2322': `Type mismatch. Cast the value, update the type annotation, or fix the assigned value.`,
            '2339': `Property does not exist on type. Add the property to the interface or use a type assertion.`,
            '2345': `Argument type mismatch. Convert the argument or update the function signature.`,
            '2551': `Property name typo. Did you mean a similarly-named property?`,
            '2554': `Wrong number of arguments. Check the function signature.`,
            '2571': `Object is of type 'unknown'. Add a type guard or type assertion.`,
            '2741': `Missing property in object literal. Add the required property.`,
            '6133': `Declared but never used. Remove the unused declaration or prefix with underscore.`,
            '7006': `Parameter implicitly has 'any' type. Add an explicit type annotation.`,
            '7016': `Could not find declaration file. Install @types/ package or add a .d.ts declaration.`,
            '7031': `Binding element implicitly has 'any' type. Add type annotation to destructured parameter.`,
        };
        if (code && tsFixMap[code])
            return tsFixMap[code];
    }
    // Python / Pyright common errors
    if (source === 'pyright' || source === 'Pyright' || source === 'pylsp') {
        if (message.includes('is not defined')) {
            return `Import the symbol or define it before use.`;
        }
        if (message.includes('could not be resolved')) {
            return `Install the package with pip/conda or fix the import path.`;
        }
        if (message.includes('is not assignable to type')) {
            return `Type mismatch. Fix the assigned value or update the type hint.`;
        }
        if (message.includes('has no attribute')) {
            return `Attribute does not exist. Check the object type or add the attribute.`;
        }
        if (message.includes('Missing return statement')) {
            return `Add a return statement to the function or update the return type to None.`;
        }
    }
    // Rust-analyzer common errors
    if (source === 'rust-analyzer' || source === 'rustc') {
        if (code === 'E0308')
            return `Mismatched types. Convert with .into(), as, or fix the expression.`;
        if (code === 'E0425')
            return `Cannot find value. Import it or fix the identifier name.`;
        if (code === 'E0433')
            return `Failed to resolve path. Add a use statement or fix the module path.`;
        if (code === 'E0382')
            return `Value moved. Clone the value, borrow instead, or restructure ownership.`;
        if (code === 'E0502')
            return `Cannot borrow as mutable. Restructure to avoid overlapping borrows.`;
        if (code === 'E0599')
            return `No method found. Import the trait or check the type.`;
    }
    // Go (gopls) common errors
    if (source === 'compiler' || source === 'gopls') {
        if (message.includes('undefined:')) {
            return `Identifier not defined. Import the package or declare the symbol.`;
        }
        if (message.includes('cannot use')) {
            return `Type mismatch. Convert the value or fix the type.`;
        }
        if (message.includes('imported and not used')) {
            return `Remove the unused import.`;
        }
        if (message.includes('declared and not used')) {
            return `Use the variable or replace it with _.`;
        }
    }
    // Generic fallbacks based on message patterns
    if (/not found|cannot find|could not resolve|undefined/i.test(message)) {
        return `Symbol or module not found. Check imports, spelling, and installed dependencies.`;
    }
    if (/type.*mismatch|not assignable|incompatible/i.test(message)) {
        return `Type mismatch. Align the types between the source and target.`;
    }
    if (/unused|never read|not used/i.test(message)) {
        return `Unused declaration. Remove it or prefix with underscore to suppress.`;
    }
    if (/missing|required/i.test(message)) {
        return `Required element missing. Add the missing property, argument, or statement.`;
    }
    return null;
}
/** Extract an identifier name from a diagnostic message */
function extractIdentifier(message) {
    const match = message.match(/'([^']+)'/);
    return match ? match[1] : '(unknown)';
}
/**
 * Detach from the language server and clean up resources.
 */
export function detachLSP() {
    // Cancel all pending requests
    for (const [id, pending] of pendingRequests) {
        clearTimeout(pending.timer);
        pending.reject(new Error('LSP detached'));
        pendingRequests.delete(id);
    }
    // Stop file watcher
    if (fileWatcher) {
        fileWatcher.close();
        fileWatcher = null;
    }
    // Shut down server gracefully
    if (activeServer) {
        try {
            activeServer.stdin?.write(encodeMessage({
                jsonrpc: '2.0',
                id: ++messageId,
                method: 'shutdown',
                params: null,
            }));
            const server = activeServer;
            setTimeout(() => {
                try {
                    server.stdin?.write(encodeMessage({
                        jsonrpc: '2.0',
                        method: 'exit',
                        params: null,
                    }));
                    server.kill();
                }
                catch { /* already dead */ }
            }, 500);
        }
        catch {
            activeServer.kill();
        }
    }
    activeServer = null;
    activeConfig = null;
    activeProjectDir = null;
    initialized = false;
    buffer = '';
    // Clear context
    context.diagnostics = [];
    context.symbols = [];
    context.references.clear();
    context.typeInfo.clear();
    context.serverCapabilities = {};
}
// ── Formatting Helpers ──
/**
 * Format diagnostics as a concise summary for agent context injection.
 *
 * Example output:
 *   "3 errors, 2 warnings in workspace:
 *    ERROR src/auth.ts:42:5 — Property 'token' does not exist on type 'User'
 *    ERROR src/auth.ts:58:12 — Cannot find name 'jwt'
 *    ERROR src/server.ts:15:1 — Module '"./db"' has no exported member 'connect'"
 */
export function formatDiagnosticsSummary(diagnostics) {
    const diags = diagnostics || context.diagnostics;
    if (diags.length === 0)
        return 'No LSP diagnostics.';
    const errors = diags.filter(d => d.severity === 'error');
    const warnings = diags.filter(d => d.severity === 'warning');
    const infos = diags.filter(d => d.severity === 'info' || d.severity === 'hint');
    const parts = [];
    if (errors.length > 0)
        parts.push(`${errors.length} error${errors.length === 1 ? '' : 's'}`);
    if (warnings.length > 0)
        parts.push(`${warnings.length} warning${warnings.length === 1 ? '' : 's'}`);
    if (infos.length > 0)
        parts.push(`${infos.length} info`);
    const lines = [`${parts.join(', ')} in workspace:`];
    // Show errors first (limit to 10 to avoid noise)
    const shownDiags = [...errors, ...warnings, ...infos].slice(0, 10);
    for (const d of shownDiags) {
        const tag = d.severity.toUpperCase();
        const relFile = activeProjectDir ? relative(activeProjectDir, d.file) : d.file;
        lines.push(`  ${tag} ${relFile}:${d.line}:${d.column} — ${d.message}`);
    }
    if (diags.length > 10) {
        lines.push(`  ... and ${diags.length - 10} more`);
    }
    return lines.join('\n');
}
/**
 * Format reference locations for display.
 */
export function formatReferences(locations) {
    if (locations.length === 0)
        return 'No references found.';
    const lines = [`${locations.length} reference${locations.length === 1 ? '' : 's'}:`];
    for (const loc of locations.slice(0, 20)) {
        const relFile = activeProjectDir ? relative(activeProjectDir, loc.file) : loc.file;
        lines.push(`  ${relFile}:${loc.line}:${loc.column}`);
    }
    if (locations.length > 20) {
        lines.push(`  ... and ${locations.length - 20} more`);
    }
    return lines.join('\n');
}
//# sourceMappingURL=lsp-deep.js.map