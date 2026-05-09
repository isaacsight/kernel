/**
 * Debate runner — orchestrates a 4-round asymmetric debate.
 *
 * Algorithm:
 *   1. allow-advocate opens
 *   2. block-advocate rebuts
 *   3. allow-advocate counter-rebuts (if maxRounds >= 3)
 *   4. block-advocate final (if maxRounds >= 4)
 *   5. judge synthesizes a Verdict
 *
 * The LLM client is injected via opts.client. This module never imports
 * a provider SDK. Tests use a deterministic stub.
 */
import type { AsymmetricRoles, DebateInput, DebateOpts, DebateRound, Verdict } from './types.js';
/**
 * Compose the role-specific prompt with the debate history.
 * Exported so tests and synthesis can verify prompt shape.
 */
export declare function formatPrompt(input: DebateInput, role: AsymmetricRoles, history: DebateRound[]): string;
/**
 * Parse the judge's free-form text into a structured verdict body.
 * Falls back to undecided/0 when fields are missing or malformed.
 */
export declare function parseVerdict(judgeText: string): {
    label: Verdict['label'];
    confidence: number;
    rationale: string;
};
/**
 * Run the debate end-to-end and return a Verdict.
 * Order is fixed: allow → block → allow → block → judge.
 */
export declare function runDebate(input: DebateInput, opts: DebateOpts): Promise<Verdict>;
//# sourceMappingURL=runner.d.ts.map