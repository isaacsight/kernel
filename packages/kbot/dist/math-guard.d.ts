/**
 * Math guard — pre-computes arithmetic in user messages.
 *
 * Reality-check probes (2026-04-20) showed kbot answering "847 × 239 = 1,985,633"
 * (correct: 202,433) — an order-of-magnitude RF-16 arithmetic error. This module
 * scans the user message for basic arithmetic expressions, evaluates them in JS,
 * and returns a ground-truth block to prepend so the LLM sees the correct answer
 * as input rather than relying on learned priors.
 *
 * Scope: single-operator expressions only — `a op b` where op ∈ {+,-,*,×,/,÷,%}.
 * Compound expressions, parentheses, unary minus: not handled. The failure mode
 * when this module doesn't match is "guard did not fire" — the LLM sees the raw
 * message unchanged, same as today. So false negatives are safe.
 *
 * No eval(), no Function(). Pure regex + arithmetic.
 */
export interface ComputedExpression {
    expression: string;
    result: number;
}
/**
 * Find every `a op b` in the message and compute it.
 *
 * Returns at most 10 distinct expressions per message — more than that and the
 * user is probably pasting a table, not asking for arithmetic help.
 */
export declare function extractArithmetic(message: string): ComputedExpression[];
/**
 * Ground-truth preamble to prepend to the user message (or system prompt).
 * Returns empty string when no arithmetic is detected — callers can
 * concatenate unconditionally.
 */
export declare function buildMathGuardBlock(message: string): string;
//# sourceMappingURL=math-guard.d.ts.map