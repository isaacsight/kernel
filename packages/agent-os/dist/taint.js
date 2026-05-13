import { err, ok } from './types.js';
export const DEFAULT_TAINT_POLICY = {
    blocks: new Map([
        // Exfil-capable tools refuse anything that originated outside
        // the agent's own trust boundary.
        ['email_send', new Set(['fetched_url', 'email', 'agent_message', 'untrusted_file'])],
        ['http_post', new Set(['fetched_url', 'email', 'agent_message', 'untrusted_file'])],
        ['file_write', new Set(['fetched_url', 'email', 'agent_message'])],
        ['shell_exec', new Set(['fetched_url', 'email', 'user_input', 'agent_message', 'untrusted_file'])],
        ['mcp_send', new Set(['fetched_url', 'email', 'agent_message', 'untrusted_file'])],
    ]),
    untaint_allowlist: new Set([
        // Only the kernel.chat designated "compliance officer" agent type
        // can untaint by default. Operators override.
        'compliance.untaint',
    ]),
};
/**
 * Pre-execution check: does the proposed tool call violate the
 * taint policy? Returns `taint_violation` if any input taint is
 * blocked for this tool.
 */
export function checkTaint(call, policy = DEFAULT_TAINT_POLICY) {
    const blocked = policy.blocks.get(call.tool);
    if (!blocked)
        return ok(true);
    for (const taint of call.taints) {
        if (blocked.has(taint.source)) {
            return err('taint_violation', `tool ${call.tool} refuses input tainted by ${taint.source}`, {
                tool: call.tool,
                taint_source: taint.source,
                taint_origin: taint.origin,
            });
        }
    }
    return ok(true);
}
/**
 * Forward propagation: every tool call result inherits the union of
 * its input taints, plus any new taint the tool itself introduces
 * (e.g., the `http_get` tool taints its output with `fetched_url`).
 */
export function propagate(call, raw_value, introduces) {
    const inherited = [...call.taints];
    if (introduces) {
        inherited.push({
            source: introduces,
            origin: typeof call.args === 'object' && call.args !== null && 'url' in call.args ? String(call.args.url) : call.tool,
            introduced_at: new Date().toISOString(),
        });
    }
    return {
        tool: call.tool,
        value: raw_value,
        produced_at: new Date().toISOString(),
        taints: inherited,
    };
}
/**
 * Explicit untaint operation. Only callable by an agent on the
 * policy's untaint_allowlist. Removes ALL taints from a value —
 * the agent that performs untaint takes responsibility for the
 * downstream consequences.
 */
export function untaint(result, performed_by_tool, policy = DEFAULT_TAINT_POLICY) {
    if (!policy.untaint_allowlist.has(performed_by_tool)) {
        return err('taint_violation', `tool ${performed_by_tool} is not on the untaint allowlist`, { allowlist: [...policy.untaint_allowlist] });
    }
    return ok({
        ...result,
        taints: [],
    });
}
//# sourceMappingURL=taint.js.map