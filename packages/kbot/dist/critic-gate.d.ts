/**
 * Critic Gate — adversarial discriminator on tool outputs.
 * Generator/discriminator pattern: critic reviews each tool result before the
 * main LLM sees it. Fast path auto-accepts trivial results. Config via
 * ~/.kbot/config.json: critic_enabled (bool), critic_strictness (0..1).
 * Hard disable: env KBOT_NO_CRITIC=1.
 */
import { type RFClass } from './critic-taxonomy.js';
export interface CriticVerdict {
    accept: boolean;
    reason?: string;
    retry_hint?: string;
    confidence: number;
    /** RF taxonomy class when a rule-based classifier fired (arXiv:2601.22208). */
    failure_class?: RFClass;
}
export interface GateOpts {
    strictness?: number;
    provider?: string;
    /** Optional LLM client override — takes user prompt, returns raw text. For testing. */
    llmClient?: (userPrompt: string) => Promise<string>;
}
/**
 * Gate a tool result through the adversarial critic.
 * Never throws — on any failure, returns accept=true with low confidence so
 * the agent loop is never blocked by the critic itself.
 */
export declare function gateToolResult(tool: string, args: Record<string, unknown>, result: unknown, opts?: GateOpts): Promise<CriticVerdict>;
//# sourceMappingURL=critic-gate.d.ts.map