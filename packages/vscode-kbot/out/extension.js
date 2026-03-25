"use strict";
// kbot VS Code Extension
// Phase 1: MCP server registration (kbot's 12 tools available in VS Code chat)
// Phase 2: Commands + context menu (explain, review, fix, test, ask)
//
// kbot already has a full MCP server (kbot ide mcp) with 12 tools,
// 4 resources, and 5 prompts. This extension tells VS Code how to start it
// and adds convenience commands.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const child_process_1 = require("child_process");
let statusBarItem;
let outputChannel;
function activate(context) {
    outputChannel = vscode.window.createOutputChannel('kbot');
    outputChannel.appendLine('kbot extension activated');
    // ── Status Bar ──
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = '$(hubot) kbot';
    statusBarItem.tooltip = 'kbot — AI Agent (23 specialists, 290 tools)';
    statusBarItem.command = 'kbot.startChat';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
    // ── MCP Server Registration (Phase 1) ──
    const config = vscode.workspace.getConfiguration('kbot');
    if (config.get('enableMcpServer', true)) {
        registerMcpServer(context);
    }
    // ── Commands (Phase 2) ──
    context.subscriptions.push(vscode.commands.registerCommand('kbot.startChat', () => startChat()), vscode.commands.registerCommand('kbot.explainSelection', () => runOnSelection('explain')), vscode.commands.registerCommand('kbot.reviewSelection', () => runOnSelection('review')), vscode.commands.registerCommand('kbot.fixError', () => fixCurrentError()), vscode.commands.registerCommand('kbot.generateTests', () => runOnSelection('test')), vscode.commands.registerCommand('kbot.askAgent', () => askAgent()));
    outputChannel.appendLine('kbot ready — MCP server registered, commands active');
}
function deactivate() {
    outputChannel?.appendLine('kbot extension deactivated');
}
// ── MCP Server Registration ──
function registerMcpServer(context) {
    // VS Code 1.99+ supports MCP server definition providers
    // This tells VS Code: "run `kbot ide mcp` to get an MCP server with 12 tools"
    try {
        const lm = vscode.lm;
        if (lm && typeof lm.registerMcpServerDefinitionProvider === 'function') {
            const provider = lm.registerMcpServerDefinitionProvider('kbot.mcpServer', {
                provideMcpServerDefinitions: async () => {
                    const binaryPath = getBinaryPath();
                    return [
                        new vscode.McpStdioServerDefinition('kbot', binaryPath, ['ide', 'mcp']),
                    ];
                },
            });
            context.subscriptions.push(provider);
            outputChannel.appendLine('MCP server registered: kbot ide mcp');
        }
        else {
            // Fallback: write MCP config to .vscode/mcp.json
            outputChannel.appendLine('MCP provider API not available — using config file fallback');
            ensureMcpConfig();
        }
    }
    catch {
        outputChannel.appendLine('MCP registration failed — using config file fallback');
        ensureMcpConfig();
    }
}
function ensureMcpConfig() {
    // Write .vscode/mcp.json if it doesn't exist
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders)
        return;
    const mcpConfigUri = vscode.Uri.joinPath(workspaceFolders[0].uri, '.vscode', 'mcp.json');
    vscode.workspace.fs.stat(mcpConfigUri).then(() => { }, async () => {
        const config = {
            servers: {
                kbot: {
                    command: getBinaryPath(),
                    args: ['ide', 'mcp'],
                },
            },
        };
        const content = Buffer.from(JSON.stringify(config, null, 2));
        await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(workspaceFolders[0].uri, '.vscode'));
        await vscode.workspace.fs.writeFile(mcpConfigUri, content);
        outputChannel.appendLine('Created .vscode/mcp.json with kbot MCP server config');
    });
}
// ── Commands ──
async function startChat() {
    const input = await vscode.window.showInputBox({
        prompt: 'Ask kbot anything',
        placeHolder: 'e.g., "explain this codebase" or "fix the auth bug"',
    });
    if (!input)
        return;
    await runKbot(input);
}
async function runOnSelection(action) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
    }
    const selection = editor.document.getText(editor.selection);
    if (!selection) {
        vscode.window.showWarningMessage('No text selected');
        return;
    }
    const file = editor.document.fileName;
    const lang = editor.document.languageId;
    const prompts = {
        explain: `Explain this ${lang} code from ${file}:\n\n${selection}`,
        review: `Review this ${lang} code from ${file} for bugs, security issues, and improvements:\n\n${selection}`,
        test: `Generate tests for this ${lang} code from ${file}:\n\n${selection}`,
    };
    await runKbot(prompts[action]);
}
async function fixCurrentError() {
    const editor = vscode.window.activeTextEditor;
    if (!editor)
        return;
    const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);
    const errors = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error);
    if (errors.length === 0) {
        vscode.window.showInformationMessage('No errors in current file');
        return;
    }
    const errorMessages = errors.map(e => `Line ${e.range.start.line + 1}: ${e.message}`).join('\n');
    const prompt = `Fix these errors in ${editor.document.fileName}:\n\n${errorMessages}`;
    await runKbot(prompt);
}
async function askAgent() {
    const agents = [
        'kernel', 'coder', 'researcher', 'writer', 'analyst',
        'guardian', 'aesthete', 'curator', 'strategist',
        'infrastructure', 'quant', 'investigator',
    ];
    const agent = await vscode.window.showQuickPick(agents, {
        placeHolder: 'Select a specialist agent',
    });
    if (!agent)
        return;
    const input = await vscode.window.showInputBox({
        prompt: `Ask the ${agent} agent`,
        placeHolder: `e.g., "audit this file for security issues"`,
    });
    if (!input)
        return;
    await runKbot(input, agent);
}
// ── kbot Process Management ──
async function runKbot(prompt, agent) {
    const binaryPath = getBinaryPath();
    statusBarItem.text = '$(loading~spin) kbot thinking...';
    const args = ['-p', prompt];
    if (agent)
        args.push('--agent', agent);
    outputChannel.appendLine(`\n> kbot ${args.join(' ').slice(0, 100)}...`);
    outputChannel.show(true);
    return new Promise((resolve) => {
        const proc = (0, child_process_1.spawn)(binaryPath, args, {
            cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
            env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
        });
        let output = '';
        proc.stdout?.on('data', (data) => {
            const text = data.toString();
            output += text;
            outputChannel.append(text);
        });
        proc.stderr?.on('data', (data) => {
            outputChannel.append(data.toString());
        });
        proc.on('close', (code) => {
            statusBarItem.text = '$(hubot) kbot';
            if (code === 0 && output.trim()) {
                // Show result as information message with "Copy" action
                vscode.window.showInformationMessage(output.trim().slice(0, 200) + (output.length > 200 ? '...' : ''), 'Copy Full Output', 'Open Output').then(action => {
                    if (action === 'Copy Full Output') {
                        vscode.env.clipboard.writeText(output.trim());
                    }
                    else if (action === 'Open Output') {
                        outputChannel.show();
                    }
                });
            }
            else if (code !== 0) {
                vscode.window.showErrorMessage(`kbot exited with code ${code}. Check Output panel.`);
            }
            resolve();
        });
        proc.on('error', (err) => {
            statusBarItem.text = '$(hubot) kbot';
            if (err.message.includes('ENOENT')) {
                vscode.window.showErrorMessage('kbot not found. Install it: npm install -g @kernel.chat/kbot', 'Install kbot').then(action => {
                    if (action === 'Install kbot') {
                        const terminal = vscode.window.createTerminal('kbot install');
                        terminal.sendText('npm install -g @kernel.chat/kbot');
                        terminal.show();
                    }
                });
            }
            else {
                vscode.window.showErrorMessage(`kbot error: ${err.message}`);
            }
            resolve();
        });
    });
}
function getBinaryPath() {
    return vscode.workspace.getConfiguration('kbot').get('binaryPath', 'kbot');
}
//# sourceMappingURL=extension.js.map