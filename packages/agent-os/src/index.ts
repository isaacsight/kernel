/**
 * @kernel.chat/agent-os — POSIX for AI agents.
 *
 * Permissions, namespaces, resource quotas, content-addressed audit,
 * and downscoped handoff. The OS-level substrate that runs above
 * Modal-class sandboxes (Modal, Daytona, RunPod, E2B, local Docker)
 * and below MCP/A2A as the wire formats agents speak.
 *
 * Eight primitives (v0.1 ships the first 5):
 *
 *   1. spawn(manifest)     ✓ src/spawn.ts
 *   2. acap                ✓ src/acap.ts
 *   3. ns                  — namespaces are typed in src/types.ts;
 *                            enforcement lands in v0.2
 *   4. ulimit-tok          ✓ src/budget.ts
 *   5. chexec              ✓ src/taint.ts
 *   6. audit               — uses @kernel.chat/kbot-finance's hash-chained
 *                            log directly; namespace isolation lands in v0.2
 *   7. handoff             ✓ src/acap.ts (downscope() primitive)
 *   8. snapshot            — content-addressed agent state; v0.2
 *
 * Apache 2.0. Status: v0.1.0-alpha.0. Reference implementation; not
 * yet certified for multi-tenant production.
 */

export * from './types.js'
export * from './acap.js'
export * from './budget.js'
export * from './spawn.js'
export * from './taint.js'
