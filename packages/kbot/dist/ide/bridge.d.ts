import { type AgentResponse } from '../agent.js';
import type { ResponseStream } from '../streaming.js';
import { type ProjectContext } from '../context.js';
import { type ToolResult } from '../tools/index.js';
import { type Session } from '../sessions.js';
import { type Diagnostic, type LspBridgeOptions } from './lsp-bridge.js';
export interface BridgeConfig {
    /** Working directory for context gathering */
    cwd?: string;
    /** API tier override */
    tier?: string;
    /** Default agent to use */
    agent?: string;
    /** LSP bridge options */
    lsp?: LspBridgeOptions;
}
export interface BridgeStatus {
    version: string;
    agent: string;
    tier: string;
    cwd: string;
    toolCount: number;
    learning: {
        patternsCount: number;
        solutionsCount: number;
        knowledgeCount: number;
        totalMessages: number;
    };
    sessionCount: number;
}
export interface ChatOptions {
    agent?: string;
    model?: string;
    stream?: boolean;
    responseStream?: ResponseStream;
}
/**
 * Initialize the IDE bridge. Must be called before any other bridge function.
 * Registers tools and gathers project context.
 */
export declare function initBridge(config?: BridgeConfig): Promise<void>;
/**
 * Send a message through the full agent loop.
 * Returns the agent response with content, tool calls, usage.
 */
export declare function chat(message: string, opts?: ChatOptions): Promise<AgentResponse>;
/**
 * Execute a single tool by name with arguments.
 * Bypasses the agent loop — direct tool execution.
 */
export declare function executeCommand(toolName: string, args?: Record<string, unknown>): Promise<ToolResult>;
/**
 * Get current project context (git info, file tree, framework, etc.)
 */
export declare function getContext(): ProjectContext | null;
/**
 * Get formatted context string for prompts
 */
export declare function getFormattedContext(): string;
/**
 * Get all registered tool definitions in Claude API format
 */
export declare function getTools(tier?: string): Array<{
    name: string;
    description: string;
    input_schema: {
        type: 'object';
        properties: Record<string, unknown>;
        required?: string[];
    };
}>;
/**
 * Get raw tool list (names + descriptions)
 */
export declare function getToolList(): Array<{
    name: string;
    description: string;
    tier: string;
}>;
/**
 * Get diagnostics for a file by spawning the appropriate LSP server.
 * Returns type errors, warnings, etc.
 */
export declare function getFileDiagnostics(filePath: string): Promise<Diagnostic[]>;
/**
 * Get bridge status — learning stats, session info, active agent
 */
export declare function getStatus(): BridgeStatus;
/**
 * Teach kbot a fact for future use
 */
export declare function remember(fact: string): void;
/**
 * Get persistent memory contents
 */
export declare function getMemory(): string;
/**
 * Get conversation history
 */
export declare function getConversationHistory(): Array<{
    role: string;
    content: string;
}>;
/**
 * List available agents
 */
export declare function getAgents(): Array<{
    id: string;
    name: string;
    description: string;
}>;
/**
 * Get saved sessions
 */
export declare function getSessions(): Session[];
/**
 * Run self-training on accumulated knowledge
 */
export declare function train(): {
    summary: string;
};
/**
 * Refresh project context (e.g., after git changes)
 */
export declare function refreshContext(): ProjectContext;
/**
 * Set active agent for subsequent chat calls
 */
export declare function setAgent(agent: string): void;
//# sourceMappingURL=bridge.d.ts.map