import type { Taint, ToolCall, ToolCallResult, OSResult } from './types.js';
/**
 * chexec — trust-channel execution with taint tracking.
 *
 * Every tool call routes through a typed channel tagged with provenance.
 * Tainted input (fetched HTML, email body, untrusted file, message from
 * another agent) cannot reach high-privilege tools without an explicit
 * untaint operation by a sufficiently-trusted agent.
 *
 * This is the OS-level response to the EchoLeak class of LLM Scope
 * Violation vulnerabilities (CVE-2025-32711) — the kernel prevents
 * tainted prompt content from reaching exfil-capable tools regardless
 * of what the model decides to do.
 */
/** Default taint policy: which tools refuse which taint sources. Operators
 *  override this; v0.1 ships a conservative default that blocks the most
 *  common exfil patterns. */
export interface TaintPolicy {
    /** Map: tool name → set of taint sources that block invocation. */
    readonly blocks: ReadonlyMap<string, ReadonlySet<Taint['source']>>;
    /** Tools allowed to perform an untaint operation. These should be
     *  high-trust agents holding an explicit `acap` to untaint. */
    readonly untaint_allowlist: ReadonlySet<string>;
}
export declare const DEFAULT_TAINT_POLICY: TaintPolicy;
/**
 * Pre-execution check: does the proposed tool call violate the
 * taint policy? Returns `taint_violation` if any input taint is
 * blocked for this tool.
 */
export declare function checkTaint(call: ToolCall, policy?: TaintPolicy): OSResult<true>;
/**
 * Forward propagation: every tool call result inherits the union of
 * its input taints, plus any new taint the tool itself introduces
 * (e.g., the `http_get` tool taints its output with `fetched_url`).
 */
export declare function propagate(call: ToolCall, raw_value: unknown, introduces?: Taint['source']): ToolCallResult;
/**
 * Explicit untaint operation. Only callable by an agent on the
 * policy's untaint_allowlist. Removes ALL taints from a value —
 * the agent that performs untaint takes responsibility for the
 * downstream consequences.
 */
export declare function untaint(result: ToolCallResult, performed_by_tool: string, policy?: TaintPolicy): OSResult<ToolCallResult>;
//# sourceMappingURL=taint.d.ts.map