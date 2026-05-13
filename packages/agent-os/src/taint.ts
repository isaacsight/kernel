import type { Taint, ToolCall, ToolCallResult, OSResult } from './types.js'
import { err, ok } from './types.js'

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
  readonly blocks: ReadonlyMap<string, ReadonlySet<Taint['source']>>
  /** Tools allowed to perform an untaint operation. These should be
   *  high-trust agents holding an explicit `acap` to untaint. */
  readonly untaint_allowlist: ReadonlySet<string>
}

export const DEFAULT_TAINT_POLICY: TaintPolicy = {
  blocks: new Map<string, ReadonlySet<Taint['source']>>([
    // Exfil-capable tools refuse anything that originated outside
    // the agent's own trust boundary.
    ['email_send', new Set(['fetched_url', 'email', 'agent_message', 'untrusted_file'])],
    ['http_post', new Set(['fetched_url', 'email', 'agent_message', 'untrusted_file'])],
    ['file_write', new Set(['fetched_url', 'email', 'agent_message'])],
    ['shell_exec', new Set(['fetched_url', 'email', 'user_input', 'agent_message', 'untrusted_file'])],
    ['mcp_send', new Set(['fetched_url', 'email', 'agent_message', 'untrusted_file'])],
  ]),
  untaint_allowlist: new Set<string>([
    // Only the kernel.chat designated "compliance officer" agent type
    // can untaint by default. Operators override.
    'compliance.untaint',
  ]),
}

/**
 * Pre-execution check: does the proposed tool call violate the
 * taint policy? Returns `taint_violation` if any input taint is
 * blocked for this tool.
 */
export function checkTaint(call: ToolCall, policy: TaintPolicy = DEFAULT_TAINT_POLICY): OSResult<true> {
  const blocked = policy.blocks.get(call.tool)
  if (!blocked) return ok(true)
  for (const taint of call.taints) {
    if (blocked.has(taint.source)) {
      return err('taint_violation', `tool ${call.tool} refuses input tainted by ${taint.source}`, {
        tool: call.tool,
        taint_source: taint.source,
        taint_origin: taint.origin,
      })
    }
  }
  return ok(true)
}

/**
 * Forward propagation: every tool call result inherits the union of
 * its input taints, plus any new taint the tool itself introduces
 * (e.g., the `http_get` tool taints its output with `fetched_url`).
 */
export function propagate(
  call: ToolCall,
  raw_value: unknown,
  introduces?: Taint['source'],
): ToolCallResult {
  const inherited = [...call.taints]
  if (introduces) {
    inherited.push({
      source: introduces,
      origin: typeof call.args === 'object' && call.args !== null && 'url' in call.args ? String((call.args as { url: unknown }).url) : call.tool,
      introduced_at: new Date().toISOString(),
    })
  }
  return {
    tool: call.tool,
    value: raw_value,
    produced_at: new Date().toISOString(),
    taints: inherited,
  }
}

/**
 * Explicit untaint operation. Only callable by an agent on the
 * policy's untaint_allowlist. Removes ALL taints from a value —
 * the agent that performs untaint takes responsibility for the
 * downstream consequences.
 */
export function untaint(
  result: ToolCallResult,
  performed_by_tool: string,
  policy: TaintPolicy = DEFAULT_TAINT_POLICY,
): OSResult<ToolCallResult> {
  if (!policy.untaint_allowlist.has(performed_by_tool)) {
    return err(
      'taint_violation',
      `tool ${performed_by_tool} is not on the untaint allowlist`,
      { allowlist: [...policy.untaint_allowlist] },
    )
  }
  return ok({
    ...result,
    taints: [],
  })
}
