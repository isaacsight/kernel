// kbot IDE Bridge — Shared core for all IDE protocol adapters
//
// Wraps kbot's tool registry, agent loop, learning engine, and memory
// into a unified API that MCP, ACP, and LSP adapters consume.
import { runAgent } from '../agent.js';
import { gatherContext, formatContextForPrompt } from '../context.js';
import { registerAllTools, executeTool, getAllTools, getToolDefinitionsForApi } from '../tools/index.js';
import { getExtendedStats, learnFact, selfTrain } from '../learning.js';
import { listSessions } from '../sessions.js';
import { getPreviousMessages, loadMemory } from '../memory.js';
import { loadConfig } from '../auth.js';
import { getDiagnostics } from './lsp-bridge.js';
let initialized = false;
let bridgeConfig = {};
let projectContext = null;
/**
 * Initialize the IDE bridge. Must be called before any other bridge function.
 * Registers tools and gathers project context.
 */
export async function initBridge(config = {}) {
    if (initialized)
        return;
    bridgeConfig = config;
    if (config.cwd)
        process.chdir(config.cwd);
    await registerAllTools();
    projectContext = gatherContext();
    initialized = true;
}
/** Ensure bridge is initialized, throw if not */
function assertInit() {
    if (!initialized)
        throw new Error('IDE bridge not initialized. Call initBridge() first.');
}
/**
 * Send a message through the full agent loop.
 * Returns the agent response with content, tool calls, usage.
 */
export async function chat(message, opts = {}) {
    assertInit();
    const config = loadConfig();
    const agentOpts = {
        agent: opts.agent || bridgeConfig.agent || 'auto',
        model: opts.model,
        stream: opts.stream,
        context: projectContext || undefined,
        tier: bridgeConfig.tier || 'free',
        responseStream: opts.responseStream,
    };
    return runAgent(message, agentOpts);
}
/**
 * Execute a single tool by name with arguments.
 * Bypasses the agent loop — direct tool execution.
 */
export async function executeCommand(toolName, args = {}) {
    assertInit();
    const call = {
        id: `ide_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: toolName,
        arguments: args,
    };
    return executeTool(call);
}
/**
 * Get current project context (git info, file tree, framework, etc.)
 */
export function getContext() {
    assertInit();
    return projectContext;
}
/**
 * Get formatted context string for prompts
 */
export function getFormattedContext() {
    assertInit();
    if (!projectContext)
        return '';
    return formatContextForPrompt(projectContext);
}
/**
 * Get all registered tool definitions in Claude API format
 */
export function getTools(tier) {
    assertInit();
    return getToolDefinitionsForApi(tier || bridgeConfig.tier || 'free');
}
/**
 * Get raw tool list (names + descriptions)
 */
export function getToolList() {
    assertInit();
    return getAllTools().map(t => ({ name: t.name, description: t.description, tier: t.tier }));
}
/**
 * Get diagnostics for a file by spawning the appropriate LSP server.
 * Returns type errors, warnings, etc.
 */
export async function getFileDiagnostics(filePath) {
    assertInit();
    return getDiagnostics(filePath, bridgeConfig.lsp);
}
/**
 * Get bridge status — learning stats, session info, active agent
 */
export function getStatus() {
    assertInit();
    const stats = getExtendedStats();
    const sessions = listSessions();
    return {
        version: '2.2.0',
        agent: bridgeConfig.agent || 'auto',
        tier: bridgeConfig.tier || 'free',
        cwd: process.cwd(),
        toolCount: getAllTools().length,
        learning: {
            patternsCount: stats.patternsCount,
            solutionsCount: stats.solutionsCount,
            knowledgeCount: stats.knowledgeCount,
            totalMessages: stats.totalMessages,
        },
        sessionCount: sessions.length,
    };
}
/**
 * Teach kbot a fact for future use
 */
export function remember(fact) {
    assertInit();
    learnFact(fact, 'fact', 'user-taught');
}
/**
 * Get persistent memory contents
 */
export function getMemory() {
    return loadMemory();
}
/**
 * Get conversation history
 */
export function getConversationHistory() {
    return getPreviousMessages();
}
/**
 * List available agents
 */
export function getAgents() {
    return [
        { id: 'kernel', name: 'Kernel', description: 'General-purpose personal assistant' },
        { id: 'researcher', name: 'Researcher', description: 'Research & fact-finding specialist' },
        { id: 'coder', name: 'Coder', description: 'Programming & development specialist' },
        { id: 'writer', name: 'Writer', description: 'Content creation specialist' },
        { id: 'analyst', name: 'Analyst', description: 'Strategy & evaluation specialist' },
        { id: 'aesthete', name: 'Aesthete', description: 'Design & aesthetics specialist' },
        { id: 'guardian', name: 'Guardian', description: 'Security specialist' },
        { id: 'curator', name: 'Curator', description: 'Knowledge curation specialist' },
        { id: 'strategist', name: 'Strategist', description: 'Strategic planning specialist' },
        { id: 'creative', name: 'Creative', description: 'Generative art, creative coding & procedural generation specialist' },
        { id: 'developer', name: 'Developer', description: 'kbot self-development specialist — builds and improves kbot itself' },
    ];
}
/**
 * Get saved sessions
 */
export function getSessions() {
    return listSessions();
}
/**
 * Run self-training on accumulated knowledge
 */
export function train() {
    assertInit();
    return selfTrain();
}
/**
 * Refresh project context (e.g., after git changes)
 */
export function refreshContext() {
    projectContext = gatherContext();
    return projectContext;
}
/**
 * Set active agent for subsequent chat calls
 */
export function setAgent(agent) {
    bridgeConfig.agent = agent;
}
//# sourceMappingURL=bridge.js.map