# Frontier-2027 Research Synthesis

> Three parallel research agents dispatched on the seven projects named
> in `frontier-2027.md`. Findings honestly correct the position paper
> where the research showed it was wrong, and sharpen the framing where
> it was right.
>
> May 2026 · CC BY 4.0

---

## 1. MCP Conformance — repositioning required

**Headline finding:** The Anthropic/LF-stewarded `modelcontextprotocol/conformance` repository already exists, is actively maintained, and is wired directly into SDK Tiering (SEP-1730). [TOOL]

What that means for our position:

- The "Acid3 for MCP" / spec-org-level conformance authority slot is **closed**.
- The repo at `github.com/modelcontextprotocol/conformance` ships TypeScript + Vitest scenarios covering lifecycle, tools, prompts, resources, elicitation, OAuth/DCR, DNS rebinding, and SSE behavior. SDK tier (1/2/3) is computed from conformance percentage. Continuous failure for 4 weeks → auto-relegation. [TOOL]
- **The gap that's actually open:** the official suite tests *SDKs* against a reference "Everything Server." It does NOT test *deployed production servers* — Stripe MCP, Notion MCP, Cloudflare MCP, the long tail of vendor servers. There is no public scoreboard. [TOOL+INFERENCE]
- **The reposition:** not "Acid3 for MCP" but **"WPT + receipts for production MCP servers"** — a downstream layer that consumes the official fixtures and adds two things the upstream doesn't:
  1. Operator-facing CLI ergonomics — "I wrote a Stripe MCP, did I get it right?"
  2. Audit-mode tests (the content-addressed envelope work in our RFC) that pin down behaviour the protocol-shape conformance doesn't cover: replay determinism, redaction conformance, content-addressed reference resolution.

**Concrete minimum viable suite (8 categories):** init handshake, tools/list + pagination, tools/call response contract, JSON-RPC error semantics, cancellation + progress, resources + prompts surface, Streamable HTTP transport, **audit-mode** (the wedge).

**Conclusion:** Project 1 in `frontier-2027.md` is real but the framing needs sharpening. Position downstream of the LF suite, not as a competitor. The public scoreboard against 20+ live MCP servers is the moat.

---

## 2. Agent OS — genuinely open slot, **build first**

**Headline finding:** Multi-agent frameworks (AutoGen, CrewAI, LangGraph, Swarm, Letta, Mastra) treat "agent" as an application-layer abstraction over a single trust domain. **None enforces a kernel/userspace boundary.** [TOOL]

Where each falls short:

- **AutoGen / Semantic Kernel:** Policy controls are advisory; no syscall enforcement.
- **CrewAI:** Role/task graph, tool allow-list, no isolation.
- **LangGraph:** Nodes in a state graph; "subagents" are function calls.
- **OpenAI Swarm / Agents SDK:** `handoff()` exists but no resource accounting.
- **Letta / MemGPT (Berkeley Sky Lab):** Memory-tier OS only — RAM/disk/archival. Doesn't ship process isolation, capability tokens, or cross-agent quotas. **Closest precedent; explicitly memory-tier and not process-tier.** [TOOL]
- **Mastra:** TypeScript-first, no runtime isolation.

Adjacent infrastructure:

- **Google's A2A** is a wire protocol, not an OS. Explicitly out of scope: server-side resource quotas, rate limiting, detailed monitoring. v1.0 (early 2026), 150+ org adoption. [TOOL]
- **MCP authorization** (OAuth 2.1 + PKCE + PRM + RFC 8707 `resource` parameter) is the closest acap-like primitive in the wild, but it's per-server-per-client. Doesn't compose across an agent tree; doesn't carry taint; doesn't downscope on handoff. [TOOL+INFERENCE]
- **Modal-class sandboxes** (Modal, Daytona, RunPod, E2B): hardware layer. Container-per-agent isolation, gVisor, filesystem snapshots. **The OS contract sits above them; doesn't replace them.** [TOOL]

Academic precedent:

- **AIOS** (Rutgers, COLM 2025, arxiv 2403.16971): kernel layer with scheduler / memory manager / tool manager / context / storage / access. Research artifact, not a shipping runtime. **Most direct intellectual ancestor.** [TOOL]
- **ASPLOS 2026 AgenticOS Workshop** (os-for-agent.github.io): first academic venue for the OS-design-for-agents conversation. Position-paper opportunity. [TOOL]

Production incidents that prove the need:

- **EchoLeak (CVE-2025-32711, M365 Copilot, June 2025):** Zero-click prompt injection via crafted email. Aim Labs categorized it as "LLM Scope Violation" — exactly what `chexec` taint tracking + `ns`-scoped tool access is designed to prevent. CVSS 9.3. [TOOL]
- **ServiceNow "confused deputy" incident (2025):** Privilege escalation across handoff. What downscoped `handoff()` prevents. [TOOL]
- **"Prompt Infection" (COLM 2025, arxiv 2503.12188):** LLM-to-LLM injection propagating through multi-agent systems; **84% attack success rate vs ~50% single-agent**. [TOOL]

**Conclusion:** Project 4 in `frontier-2027.md` is **the most genuinely open slot and the most leveraged starting move**. Eight primitives synthesized from the research:

1. `spawn(manifest)` — fork an agent with declared identity, no implicit inheritance
2. `acap` — signed, revocable capability tokens
3. `ns` — keyed namespaces (memory, tools, audit-log view)
4. `ulimit-tok` — per-agent token/$/wall-clock/spawn quotas
5. `chexec` — trust-channel exec with taint tracking
6. `audit` — append-only, content-addressed event log per namespace
7. `handoff(target, task, acap_subset)` — downscoped capability transfer
8. `snapshot(agent_id) → cid` — content-addressed agent state freeze

We ship the scaffold of this package in the same commit as this doc — `packages/agent-os/`, v0.1.0-alpha.0, 5 of 8 primitives shipped.

---

## 3. zkML — repositioning required, scope reduction

**Headline finding:** zkML for regulated finance is honestly **3-5 years out**, not 18 months. The 18-month-shippable version is a **privacy primitive for firms protecting PII from auditors**, not a compliance-substitution layer. [INFERENCE, anchored to TOOL benchmarks]

What ships today:

- **EZKL (zkonduit):** Halo2 + KZG. ONNX import. Most mature; default library. Crashes on >128GB models. [TOOL]
- **zkPyTorch (Polyhedra, March 2025):** PyTorch → ZK. VGG-16 in 2.2s. Llama-3-8B at ~150s/token. 99.32% output fidelity vs FP32. [TOOL]
- **DeepProve (Lagrange, 2025):** sum-check / GKR. First full GPT-2 inference proof. 54-158× faster than EZKL on the same workloads. [TOOL]
- **RISC Zero / Boundless:** STARK over RISC-V. General-purpose. Google Cloud "Verifiable AI Program" partnership (2026). [TOOL]
- **zkLLM (CCS 2024 research):** 13B params in <15 min CUDA. Research artifact; not a production library. [TOOL]

What's actually deployed:

- **Worldcoin / World ID:** 10M+ users, 75M+ transactions. But this is proof-of-personhood, not zkML of an inference. [TOOL]
- **DeFi:** Modulus Labs (Lyra, Ion), Giza Agents on Starknet, AI Arena. Real but narrow vertical. [TOOL]
- **Financial services:** **Zero public production deployment at a tier-1 bank as of May 2026.** [INFERENCE]

The honest critique that has to be answered:

1. **Nobody is asking for it.** No regulator has named zkML as a compliance mechanism. ESMA, FCA, SEC, MAS 2026 priorities all emphasize audit trails and explainability, not cryptographic verification.
2. **TEEs win on cost.** Intel TDX, AMD SEV-SNP, Nvidia confidential computing give remote-attested inference with near-zero overhead. For most regulators, "Intel-attested" is good enough.
3. **Quantization isn't bit-exact.** zkPyTorch's 99.32% fidelity is impressive but means the proven computation isn't the production computation. Hard sell to a regulator asking "did this exact model produce this exact output?"
4. **Memory and latency.** 1TB-RAM proving rigs for large models. Batch-audit use case, not always-on attestation.
5. **The crypto stink.** Tier-1 banks associate ZK with crypto, and crypto with compliance pain.

**Realistic 18-month envelope for kbot-finance:**

- **Tractable:** CNNs up to ~VGG-16, gradient-boosted trees (XGBoost), small MLPs, tabular risk models. These are exactly the models regulators currently care most about.
- **Tractable but expensive:** Small transformers (BERT-base, DistilGPT-2, quantized Llama-3-8B). Batch/audit workloads.
- **Not realistic:** Frontier LLMs at production latency.

**Reposition for the next 18 months:**

- The package is `@kernel.chat/zkml-attestation`, but the framing is **privacy primitive for firms protecting PII / proprietary inputs from auditors**, not "compliance substitution."
- Target initial models: credit decisioning, AML scoring, KYC risk, small document classifiers.
- Default backend: EZKL with sum-check migration path to zkPyTorch / DeepProve as those stabilize.
- Use case: a regulator demands proof a model ran correctly; the firm provides a zk-proof tied to the input hash without exposing the underlying client data.

**Conclusion:** Project 3 in `frontier-2027.md` stays in the queue but with a sharpened scope: ship for the privacy use case, not as a compliance-substitution play. Probably 12-18 months to a usable v0; 24-36 months to a regulator-accepted reference proof.

---

## Corrections to `frontier-2027.md`

Three explicit changes to the position paper, based on the research:

1. **Project 1 (MCP Conformance):** Reframe as operator-facing + audit-mode, downstream of the official LF/Anthropic suite. Drop the "conformance authority" framing — that slot is taken.
2. **Project 4 (Agent OS):** Promote to the **first ship**, not the second. The research confirms this is the most open slot and the highest-leverage move. Scaffold ships in the same commit as this synthesis.
3. **Project 3 (zkML):** Reframe as a privacy primitive for the next 18 months, not a compliance-substitution layer. The compliance-substitution use case is real but at a 3-5 year horizon.

The other four projects (Agent Court, Sovereign Stack, Rule-pack Registry, MCP-Next) hold their framing. The research didn't surface contradictions.

---

## What ships in this commit

- `docs/frontier-2027-research.md` — this document
- `packages/agent-os/` — v0.1.0-alpha.0 scaffold:
  - 5 source files (types, acap, budget, spawn, taint)
  - 3 test files (26 tests, all passing)
  - README.md framing the package as POSIX-for-agents
  - Apache 2.0 license, Node 22+, ready for `npm publish` after a v0.1 review

The position is no longer just text. The reference implementation
exists, the tests pass, the package can be installed today. That's
the form of "ahead" we wanted.

---

## Sources (consolidated)

### MCP conformance
- `github.com/modelcontextprotocol/conformance`
- MCP 2026 Roadmap (`blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/`)
- SEP-1730 SDKs Tiering System
- MCP Specification 2025-11-25
- Stainless: How to Test MCP Servers
- Cloudflare: Test a Remote MCP Server
- Tetrate: MCP Audit Logging
- Agentity mcp-audit-extension

### Agent OS
- AIOS paper (arxiv 2403.16971, COLM 2025)
- Agent Operating Systems Blueprint (preprint 202509.0077)
- AgenticOS 2026 Workshop @ ASPLOS (os-for-agent.github.io)
- Agent Centric Operating System survey (arxiv 2411.17710)
- Letta / MemGPT (`github.com/letta-ai/letta`)
- A2A Protocol Specification (`a2a-protocol.org`)
- MCP Authorization spec (draft)
- Modal Sandboxes docs
- EchoLeak paper (arxiv 2509.10540)
- Prompt Infection (COLM 2025, arxiv 2503.12188)
- OWASP LLM01:2025 Prompt Injection

### zkML
- EZKL (`github.com/zkonduit/ezkl`)
- zkPyTorch paper (eprint 2025/535)
- DeepProve-1 (Lagrange)
- zkLLM paper (arXiv 2404.16109)
- RISC Zero (`risczero.com`)
- The Definitive Guide to ZKML (2025) — ICME
- The zkML Singularity 2025 — Extropy
- Survey of ZK-based verifiable ML (arXiv 2502.18535)
- Worldcoin proof-of-personhood protocol
- Modulus Labs / Giza / AI Arena
- ESMA / FCA / SEC / MAS 2026 priorities

---

*v0.1 · May 2026 · Research conducted by parallel agents; synthesis
by the maintainer. CC BY 4.0.*
