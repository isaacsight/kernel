/**
 * @kernel.chat/agent-os — POSIX for AI agents.
 *
 * Permissions, namespaces, resource quotas, content-addressed audit,
 * downscoped handoff, server-side credential injection, and rubric-
 * graded self-evaluation. The OS-level substrate that runs above
 * Modal-class sandboxes (Modal, Daytona, RunPod, E2B, local Docker)
 * and below MCP/A2A as the wire formats agents speak.
 *
 * Ten primitives (v0.2 ships 7 of 10):
 *
 *   1. spawn(manifest)     ✓ src/spawn.ts
 *   2. acap                ✓ src/acap.ts
 *   3. ns                  — namespaces typed; enforcement v0.3
 *   4. ulimit-tok          ✓ src/budget.ts
 *   5. chexec              ✓ src/taint.ts
 *   6. audit               — uses @kernel.chat/kbot-finance log; ns isolation v0.3
 *   7. handoff             ✓ src/acap.ts (downscope())
 *   8. snapshot            — content-addressed agent state; v0.3
 *   9. vault               ✓ src/vault.ts        (NEW v0.2 — from CMA)
 *  10. outcomes            ✓ src/outcomes.ts     (NEW v0.2 — from CMA)
 *
 * Apache 2.0. Status: v0.2.0-alpha.0. Reference implementation; not
 * yet certified for multi-tenant production.
 */
export * from './types.js';
export * from './acap.js';
export * from './budget.js';
export * from './spawn.js';
export * from './taint.js';
export * from './vault.js';
export * from './outcomes.js';
//# sourceMappingURL=index.d.ts.map