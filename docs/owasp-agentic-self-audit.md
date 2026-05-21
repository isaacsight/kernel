# OWASP Top 10 for Agentic Applications 2026 — kbot self-audit

*A category-by-category self-audit of the kernel.chat agentic stack
(@kernel.chat/kbot, @kernel.chat/agent-os, @kernel.chat/kbot-orchestrator,
@kernel.chat/kbot-finance) against the OWASP Top 10 for Agentic
Applications framework (ASI01-ASI10) released in 2026.*

Dated 2026-05-21. Filed alongside [`docs/agentic-engineering.md`](./agentic-engineering.md) and [`docs/may-2026-signals.md`](./may-2026-signals.md).

Licensed CC BY 4.0. Fork it. Improve it. Submit corrections via PR or issue at [github.com/isaacsight/kernel](https://github.com/isaacsight/kernel).

---

## How to read this document

For each of the ten OWASP-Agentic categories, this document records:

1. **OWASP category** — verbatim category name and short description.
2. **Current posture** — what kbot does today against this category.
3. **Substrate primitives** — which packages and primitives in the kernel.chat stack address this risk.
4. **Gaps** — honest accounting of where the current state falls short.
5. **Roadmap** — committed next-ship items to close the gap.

This is a self-audit, not a third-party assessment. Use it as the candid
baseline kernel.chat operates from, not as an external certification.
Third-party security review is on the roadmap; for now, the discipline is
to publish the honest current state and iterate in public.

The audit is anchored against the framework documented at
https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/.

---

## ASI01 — Agent Goal Hijack

> An attacker manipulates an agent's objectives, instructions, or decision
> path so it pursues unintended outcomes.

**Current posture:** moderate.

- kbot specialist dispatch routes requests through a Bayesian skill-router
  (`@kernel.chat/skill-router` v1.0.1) which evaluates intent before
  dispatch. Direct prompt-injection-driven dispatch override is bounded
  by the specialist registry — agents cannot route work to specialists
  not in the registry.
- kbot-orchestrator's outreach + explore pipelines accept structured
  briefings (parsed markdown) rather than free-form user input as the
  authority surface, reducing the prompt-injection surface significantly.
- kbot-finance enforces material-gate approval at every action that
  lands consequences, so a hijacked agent cannot execute a regulated
  action without human approval.

**Substrate primitives:**
- `@kernel.chat/agent-os` capability tokens (`acap`) — every agent
  action requires a signed token authorizing the specific operation.
- Material-gate approval pattern (kbot-finance)
- Bayesian routing with confidence thresholds (skill-router)

**Gaps:**
- No explicit "goal-drift detector" tracking long-running agent behavior
  against original instructions. Multi-turn goal hijack via incremental
  context shift would not be caught by current substrate.
- kbot's general chat path does NOT enforce goal-state pinning. Open
  prompt = open goal space.

**Roadmap:**
- v0.3 of kbot-orchestrator adds a two-kind classifier
  (operator-policy vs third-party-harm) that flags any operation
  the operator did not authorize at delegation time. Closes part of
  the gap.
- Goal-drift telemetry as a kbot-orchestrator v0.4 item.

---

## ASI02 — Tool Misuse and Exploitation

> An agent uses connected tools in unsafe ways, or attackers exploit tool
> interfaces to gain access or cause harm.

**Current posture:** strong.

- All kbot tools register through a typed schema with explicit input
  validation (zod) before invocation.
- Bash tool (`packages/kbot/src/tools/bash.ts`) has hardcoded refusal
  patterns for destructive commands (`rm -rf /`, `sudo rm`, `mkfs`,
  `shutdown`, fork bombs, `dd if=/dev/zero`, raw disk writes).
- File tools (`files.ts`) use Node-native primitives (readFileSync,
  readdirSync, picomatch) since the v4.2 Windows sprint — no shell-outs
  to Unix utilities that could be exploited through quoting bugs.
- Git tools use `spawnSync(args[])` instead of `execSync(string)` —
  eliminates entire class of shell-escaping vulnerabilities.
- agent-os `chexec` taint-tracked exec is the longer-term primitive
  here: every exec carries the taint set of its inputs, refusing any
  exec where tainted input would be used in a sensitive operation.

**Substrate primitives:**
- agent-os `chexec` (taint-tracked exec)
- zod-validated tool input schemas
- Hardcoded destructive-pattern refusals in bash tool
- Node-native filesystem operations

**Gaps:**
- Plugin SDK (`packages/kbot/src/plugins.ts`) allows third-party tools
  with less strict input validation than first-party tools. A
  malicious plugin could expose new attack surface.
- `chexec` taint tracking is design-complete but full enforcement is
  agent-os v0.3 roadmap.

**Roadmap:**
- agent-os v0.3 ships full `chexec` enforcement.
- Plugin SDK v2 adds mandatory zod validation + capability-token scope
  to every third-party tool.

---

## ASI03 — Identity and Privilege Abuse

> Agents misuse credentials, tokens, or inherited permissions to access
> systems or data beyond intended limits.

**Current posture:** moderate-to-strong.

- BYOK contract: kbot stores no provider credentials. User provides
  API keys via env vars; kbot uses them for the current call and does
  not retain them.
- agent-os `acap` (signed capability tokens) scope every agent action
  to a specific operation. Tokens are time-limited and downscope-only
  through delegation.
- Credential vault primitive (agent-os) holds long-lived secrets
  encrypted at rest, accessed only by capability-token-bearing agents.

**Substrate primitives:**
- agent-os `acap` (signed capability tokens, time-limited)
- agent-os credential vault (encrypted at rest)
- BYOK design contract (no provider creds in kbot)

**Gaps:**
- `acap` tokens are designed but the production enforcement is
  agent-os v0.3 roadmap. v0.2 ships the types; runtime enforcement
  is pending.
- macOS Keychain is used directly for app-password storage
  (Gmail SMTP example in kbot-orchestrator). Keychain access is
  not yet wrapped in capability-token discipline — currently any
  process running as the user can read the Keychain entry.

**Roadmap:**
- agent-os v0.3 enforces `acap` at runtime.
- kbot-orchestrator v0.4 wraps Keychain access in capability-scoped
  primitives.

---

## ASI04 — Agentic Supply Chain Vulnerabilities

> Risks introduced through third-party tools, plugins, registries, MCP
> servers, or external components used in agent workflows.

**Current posture:** weak.

- npm dependencies are pinned in package-lock.json but not signed.
  Compromised upstream package = compromised kbot.
- MCP server registry has no signing / verification primitive.
- Plugin SDK does not verify the integrity of third-party plugins
  before loading.
- No SBOM (Software Bill of Materials) generated automatically.

**Substrate primitives:**
- (Limited) Lockfile-based dependency pinning
- (Limited) Manual review for kernel.chat-published packages

**Gaps:**
- This is currently the weakest category of the audit. The kbot stack
  is heavily dependent on npm + open-source plugins with limited
  supply-chain verification.

**Roadmap:**
- SBOM generation in CI (CycloneDX format) — q3 2026.
- `@kernel.chat/forge-registry` (the plugin registry kbot uses) to
  add SHA-256 signature verification on plugin install — q4 2026.
- Sigstore signing for kernel.chat-published npm packages — q4 2026.

---

## ASI05 — Unexpected Code Execution

> An agent generates, modifies, or runs code or commands in ways that
> create security or operational risk.

**Current posture:** moderate.

- Bash tool refusal patterns (covered under ASI02) block most
  destructive commands.
- `kbot edit_file` tool requires the path argument, refusing edits
  to paths outside the working directory by default.
- agent-os namespaces (design-complete, v0.3 enforcement) provide
  filesystem isolation per-agent.

**Substrate primitives:**
- agent-os namespaces (v0.3)
- Bash refusal patterns
- Path validation on file tools

**Gaps:**
- `code_interpreter`-style sandboxing not standard in kbot today.
  Agents can write arbitrary code and execute it via bash.
- Namespace enforcement is type-level only currently.

**Roadmap:**
- agent-os v0.3 namespace runtime enforcement (read-only mounts,
  capability-scoped writes).
- Sandboxed code execution primitive — q3 2026.

---

## ASI06 — Context Management and Retrieval Manipulation

> Retrieved or stored context is poisoned, misleading, stale, or tampered
> with, influencing future agent behavior.

**Current posture:** strong.

- kbot-finance content-addressed envelopes (SHA-256 hash of input)
  detect tampering of retrieved context before agent action.
- Three-tier memory system (`@kernel.chat/memory-tiers`) separates
  observations (raw, append-only) from reflections (synthesized) from
  identity (durable traits). Observations are immutable once recorded.
- Hash-chained audit log makes retroactive context manipulation
  detectable.

**Substrate primitives:**
- Content-addressed envelopes (kbot-finance)
- Three-tier memory with append-only observations (memory-tiers)
- Hash-chained audit log (kbot-finance)

**Gaps:**
- The synthesis step (observations → reflections) is rule-based
  and deterministic, which is good for auditability but also means
  the rules themselves are a manipulation target. Adversarial
  observations crafted to game the synthesis rules would influence
  identity layer.

**Roadmap:**
- Synthesis rules versioning + diff alerts — q3 2026.

---

## ASI07 — Memory and Context Poisoning

> Persistent stores (memory, vector DBs, knowledge bases) are seeded
> with adversarial content that re-emerges in future agent decisions.

**Current posture:** moderate.

- agent-os audit-log primitive records every memory write with
  cryptographic signature of the writing agent + timestamp.
  Retroactively identifying poisoning is possible.
- memory-tiers identity layer evolves slowly (requires multiple
  reflections to shift a trait), reducing single-incident poisoning
  impact.

**Substrate primitives:**
- agent-os audit log (cryptographic write attribution)
- memory-tiers slow-evolving identity layer

**Gaps:**
- No proactive poisoning detection. Detection is forensic.
- Cross-session memory (when kbot agents share memory between users
  or installs) does not yet have isolation primitives.

**Roadmap:**
- Memory namespace isolation per agent identity — agent-os v0.3.
- Anomaly detection on memory write patterns — q4 2026.

---

## ASI08 — Insecure Inter-Agent Communication

> Channels between agents are unauthenticated, unencrypted, or lack
> integrity protection, allowing message injection or eavesdropping.

**Current posture:** moderate.

- agent-os `acap` tokens authenticate inter-agent handoffs.
- agent-os downscoped-handoff primitive (v0.3 roadmap) ensures
  delegated authority cannot exceed the delegating agent's authority.
- kbot-orchestrator pipeline handoffs are local in-process today —
  no network channel — so eavesdropping is currently not a risk for
  the orchestrator.

**Substrate primitives:**
- agent-os `acap` token-bearing handoff
- agent-os downscoped-handoff (v0.3)
- Local-process pipeline isolation

**Gaps:**
- A2A (agent-to-agent over network) protocol is not yet implemented.
  When kbot agents talk to remote agents (which is a roadmap item),
  the channel needs explicit authentication + integrity protection.

**Roadmap:**
- A2A protocol with mutual TLS + signed message envelopes — agent-os
  v0.4.

---

## ASI09 — Cascading Failures

> Failures in one agent or component propagate uncontrolled through the
> multi-agent system, amplifying impact.

**Current posture:** weak.

- kbot-orchestrator outreach pipeline has per-message error handling
  with continue-on-failure semantics — one bounced email doesn't halt
  the batch.
- kbot specialist agents fail in isolation; one specialist's failure
  doesn't crash the dispatcher.
- No formal circuit-breaker pattern between agent layers.

**Substrate primitives:**
- (Limited) Per-step error handling in orchestrator
- (Limited) Specialist-isolated failure in dispatcher

**Gaps:**
- No quota enforcement that backs off when downstream errors spike.
- No correlation of failures across agent layers — one specialist
  failing repeatedly does not trigger a global throttle.

**Roadmap:**
- agent-os `ulimit-tok` runtime quota enforcement with backoff —
  agent-os v0.3.
- Cross-layer failure correlation telemetry — kbot-orchestrator v0.4.

---

## ASI10 — Human-Agent Trust Exploitation

> An agent (or attacker via the agent) exploits the trust the human
> operator has in the agent to manipulate the human into harmful
> decisions or false attestations.

**Current posture:** moderate.

- Material-gate approval pattern (kbot-finance) shows the human
  exactly what action is about to fire with full context including
  the deterministic engine's result and the regulatory verifier's
  pass/fail. The human sees the substance, not just an agent
  recommendation.
- kbot-orchestrator dry-run-by-default discipline ensures the human
  sees the full action set before any send.
- Audit log records the exact prompt + context that led to every
  attested decision, so retroactive review is possible.

**Substrate primitives:**
- Material-gate approval UX (kbot-finance)
- Dry-run-by-default in kbot-orchestrator
- Per-decision context recording in audit log

**Gaps:**
- The agent-fidelity engineering discipline (ISSUE 389) names this
  category explicitly. v0.3 of kbot-orchestrator adds the two-kind
  classifier (operator-policy vs third-party-harm) which encodes the
  refusal that should happen even when the operator authorizes.
- No standardized way today to flag for the human "the agent is asking
  you to do something the agent itself flagged as potentially
  harmful." That UX primitive is roadmap.

**Roadmap:**
- kbot-orchestrator v0.3 ships the two-kind classifier + refusal
  predicates + attestation discipline.
- Operator-facing "agent flagged this" UX primitive in kbot v4.6.

---

## Summary table

| Category | Posture | Gap severity | Closing in |
|---|---|---|---|
| ASI01 Agent Goal Hijack | moderate | medium | orchestrator v0.3-v0.4 |
| ASI02 Tool Misuse | strong | low | agent-os v0.3 |
| ASI03 Identity & Privilege | moderate-strong | medium | agent-os v0.3 |
| ASI04 Supply Chain | **weak** | **high** | SBOM + signing through q4 2026 |
| ASI05 Code Execution | moderate | medium | agent-os v0.3 + q3 sandbox |
| ASI06 Context Mgmt | strong | low | q3 synthesis-rule diff alerts |
| ASI07 Memory Poisoning | moderate | medium | agent-os v0.3 + q4 anomaly detect |
| ASI08 Inter-Agent Comm | moderate | low (currently in-process) | agent-os v0.4 (A2A) |
| ASI09 Cascading Failures | **weak** | medium | agent-os v0.3 + orchestrator v0.4 |
| ASI10 Human-Agent Trust | moderate | medium | orchestrator v0.3 |

**Headline read:** the kernel.chat stack is **strong on ASI02 and ASI06**
(tool misuse, context management — areas where the audit substrate work
in kbot-finance directly defends), **moderate-to-strong across most of
the rest**, and **weakest on ASI04 (supply chain)**. The supply-chain
gap is the most important next-quarter focus.

The agent-fidelity primitives shipping in kbot-orchestrator v0.3 close
significant pieces of ASI01, ASI03, ASI07, and ASI10 simultaneously,
which is the highest-leverage single next ship.

---

## What this self-audit is not

- **Not a third-party assessment.** This is operator self-audit. A
  formal security audit by an external party is on the roadmap (q3 2026)
  but is not yet done.
- **Not a compliance certification.** ASI compliance is not a formal
  certification scheme (yet). This document is a working baseline to
  iterate from.
- **Not a guarantee.** Software security is probabilistic. This audit
  documents posture; actual security depends on implementation correctness
  and ongoing maintenance.

---

## Engaging with this audit

- **Filing issues:** if you spot an inaccuracy, an underestimated risk,
  or a closed gap not yet reflected here, open an issue at
  https://github.com/isaacsight/kernel/issues with the `audit` label.
- **Forking:** the audit is CC BY 4.0. Use it as a template for your own
  agent platform's audit; the structure (Posture / Primitives / Gaps /
  Roadmap per category) generalizes.
- **Citing:** "kernel.chat OWASP Top 10 for Agentic Applications 2026
  self-audit, May 2026" is the citation form.

---

*Filed under [`docs/`](.). Licensed CC BY 4.0. Dated; the field moves;
the next revision lands when v0.3 of kbot-orchestrator ships and the
agent-fidelity gaps close.*
