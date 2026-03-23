import { type Ora } from 'ora';
import { type TerminalCapabilities } from './terminal-caps.js';
export declare function getTerminalCaps(): TerminalCapabilities;
export { detectTerminalCapabilities, withSyncOutput } from './terminal-caps.js';
export declare function setQuiet(q: boolean): void;
export declare const status: (...args: unknown[]) => void;
export declare const content: (...args: unknown[]) => void;
/** Register a custom agent's color (for matrix agents) */
export declare function registerAgentVisuals(id: string, _icon: string, color: string): void;
export declare function agentColor(agentId: string): (text: string) => string;
export declare function agentIcon(agentId: string): string;
export declare function prompt(): string;
export declare function banner(version?: string): string;
export declare function bannerCompact(): string;
export declare function bannerAuth(): string;
export declare function matrixConnect(tier: string, agentCount: number): string;
export declare function createSpinner(text?: string): Ora;
/** Print an agent response (content → stdout, agent label → stderr) */
export declare function printResponse(agentId: string, text: string): void;
/** Print a tool execution — compact, one line (stderr — status) */
export declare function printToolCall(toolName: string, args: Record<string, unknown>): void;
/** Print tool result (truncated, stderr — status) */
export declare function printToolResult(result: string, error?: boolean): void;
/** Print usage stats (stderr — status) */
export declare function printUsage(stats: {
    tier: string;
    monthly_messages: {
        count: number;
        limit: number;
    };
}): void;
export declare function printError(message: string): void;
export declare function printSuccess(message: string): void;
export declare function printInfo(message: string): void;
export declare function printWarn(message: string): void;
export declare function divider(): void;
export declare function printHelp(): void;
export declare function printGoodbye(): void;
//# sourceMappingURL=ui.d.ts.map