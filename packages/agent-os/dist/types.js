/**
 * Core types for @kernel.chat/agent-os.
 *
 * Eight primitives — synthesized from the May 2026 frontier research:
 *
 *   1. spawn(manifest)     — fork an agent with declared identity
 *   2. acap                — signed, revocable capability tokens
 *   3. ns                  — keyed namespaces (memory, tools, audit log)
 *   4. ulimit-tok          — per-agent token/$/wall-clock/spawn quotas
 *   5. chexec              — trust-channel exec with taint tracking
 *   6. audit               — append-only, content-addressed event log
 *   7. handoff             — task transfer with explicit downscoping
 *   8. snapshot            — content-addressed agent state freeze
 *
 * The OS runs above Modal-class sandbox providers (Modal, Daytona,
 * RunPod, E2B, local Docker, bare process) and below MCP/A2A as the
 * wire formats agents speak to each other.
 *
 * See docs/frontier-2027.md and docs/frontier-2027-research.md for
 * the strategic positioning.
 */
export function ok(value) {
    return { ok: true, value };
}
export function err(code, message, details) {
    return {
        ok: false,
        error: { code, message, ...(details !== undefined ? { details } : {}) },
    };
}
//# sourceMappingURL=types.js.map