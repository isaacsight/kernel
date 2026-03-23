import { ToolPipeline } from './tool-pipeline.js';
import { type ProjectContext } from './context.js';
import type { UIAdapter } from './ui-adapter.js';
import { type ParsedMessage } from './multimodal.js';
import { ResponseStream } from './streaming.js';
import { type Checkpoint } from './checkpoint.js';
export interface AgentOptions {
    agent?: string;
    model?: string;
    stream?: boolean;
    context?: ProjectContext;
    tier?: string;
    /** Enable extended thinking (shows reasoning steps) */
    thinking?: boolean;
    /** Thinking budget in tokens (default: 10000) */
    thinkingBudget?: number;
    /** Pre-parsed multimodal content (images from CLI) */
    multimodal?: ParsedMessage;
    /** Skip planner re-entry (prevents infinite loop when planner calls runAgent) */
    skipPlanner?: boolean;
    /** UIAdapter for decoupled output (SDK use). Defaults to TerminalUIAdapter. */
    ui?: UIAdapter;
    /** Custom tool execution pipeline (overrides default permission/hook/metrics chain) */
    pipeline?: ToolPipeline;
    /** ResponseStream for structured event streaming (SDK/MCP/HTTP consumers) */
    responseStream?: ResponseStream;
    /** Plan mode — read-only exploration, no writes or command execution */
    plan?: boolean;
}
export interface AgentResponse {
    content: string;
    agent: string;
    model: string;
    toolCalls: number;
    thinking?: string;
    streamed?: boolean;
    usage?: {
        input_tokens: number;
        output_tokens: number;
        cost_usd: number;
    };
}
export declare function runAgent(message: string, options?: AgentOptions): Promise<AgentResponse>;
/** One-shot: run agent and print response */
export declare function runAndPrint(message: string, options?: AgentOptions): Promise<void>;
/**
 * Resume an agent session from a checkpoint.
 * Restores conversation messages and state, then continues execution.
 */
export declare function runAgentFromCheckpoint(checkpoint: Checkpoint, options?: AgentOptions): Promise<AgentResponse>;
//# sourceMappingURL=agent.d.ts.map