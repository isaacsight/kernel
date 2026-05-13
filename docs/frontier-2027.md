# Past the Frontier — kernel.chat's 2027 Position Paper

> What Anthropic + Steinberger are shipping today is the current frontier.
> This document names what comes *after* that frontier — the substrate
> work the leaders are not pushing on yet — and sketches the projects
> kernel.chat is positioned to ship across the next 18-24 months to be
> meaningfully ahead by mid-2027.
>
> Honest disclaimer: being ahead of teams who are themselves ahead of
> the field is hard. Most "ahead of Anthropic" claims fail because they
> overestimate the field's pace of change. The seven projects below
> are calibrated to be ahead *and* shippable by a small team. They're
> not moonshots; they're the next-decade substrate work that nobody
> has yet claimed.

---

## What Anthropic is far ahead on (May 2026)

- **Frontier LLM training** (Claude Opus 4.6, Sonnet 4.5/4.6, Haiku 4.5). Compute, data, and research staff at a scale we won't match.
- **Mechanistic interpretability research** (the Natural Language Autoencoders, the Risk Reports, the public commitments to "detect most model problems by 2027").
- **Agent frameworks** (Claude Code, Agent SDK, computer-use, Managed Agents). The reference implementations the field is starting to copy.
- **MCP protocol design and stewardship** (~6,000 servers by April 2026, Linux Foundation track, multi-vendor adoption).
- **Constitutional AI / alignment at training time** (RSP, RLAIF, Constitutional Classifiers, the public-policy work).
- **Developer experience** (the SDK is the cleanest API in the field; Claude Code's onboarding is the bar).

We will not match them on these axes. Trying to is the most common failure mode for builders in our shape.

## What Steinberger is far ahead on

- **Native macOS substrate depth** (Peekaboo's AX-first model, the Swift 6.2 implementation, the recognition that the platform already publishes the structure agents need).
- **Single-developer infrastructure-tool shipping cadence** (PSPDFKit's 15-year run, Peekaboo's MCP-server-shape ship in weeks).
- **Public reputation as a substrate-deep operator** (the X following, the blog, the "I'll just ship it" register).
- **Cross-substrate transfer** (PDF SDK to macOS automation — proving the discipline isn't domain-locked).

We will not match him on these either. He's been at it for 15 years; we've been at it for 4.

## Where the gap is — what neither of them is shipping yet

Six places the field is wide open. Each is the substrate work that, in retrospect, will look obvious — but which today is unowned, unfinished, or named-but-not-built.

### 1. Cross-implementation MCP conformance + audit

Anthropic publishes the MCP spec and ships a reference server. They do **not** ship:
- A conformance test suite that verifies any MCP implementation produces semantically-identical results across implementations.
- An audit/replay extension that lets a regulator inspect what an MCP call returned six months later.
- A protocol for handshake-time capability negotiation that includes audit semantics.

We drafted the audit-extension RFC. The next move is the **conformance suite** + the **first cross-implementation audit-replay demonstration**. Whoever ships this becomes the de facto MCP conformance authority — the way the W3C HTML test suite became the conformance authority for browsers in 2010-2015.

### 2. Agent-to-agent governance (post-MCP)

MCP is agent-to-tool. **Agent-to-agent is wide open.** Google's A2A is positioned as complementary, not competitive, and is still early. Nobody has shipped:
- A protocol for multiple agents (from different model vendors) to negotiate a shared decision with explicit handoff rules.
- A reference adjudicator agent that resolves disputes between agents using rule-packs.
- An auditable trace of multi-agent reasoning that's replayable across vendor boundaries.

This is "agent court" — multi-agent dispute resolution with cryptographic provenance.

### 3. Production zkML (proofs without exposure)

The interpretability work Anthropic is doing assumes the regulator has access to the model. Many real regulators don't and won't — proprietary models, classified data, HIPAA-protected inputs. The substrate they need is:
- A library for generating zk-SNARK proofs that "model M was applied to inputs whose hash is H and produced outputs whose hash is O."
- A reference circuit for the simplest case (matrix multiplication + softmax) that production-grade implementations build on.
- A worked example where a regulator verifies a model ran correctly without seeing the inputs.

zkML for production is 18-36 months away from being widely deployed. The reference implementation that gets adopted is the one that exists when the demand lands.

### 4. The agent operating system (POSIX for agents)

Anthropic ships Claude Code (an agent). Steinberger ships Peekaboo (a substrate for one kind of agent automation). Neither ships:
- Permissions for agents (who can call which tool, with what materiality threshold).
- Namespaces (one user's agents can't see another's audit log).
- Resource quotas (agent A gets 10K tokens/min; agent B gets unlimited).
- Sandboxes (a misbehaving agent can't poison the audit log of its sibling).
- The agent equivalent of `chmod`, `chown`, `chroot`, `ulimit`.

The agent OS — POSIX for agents — is unowned. The first credible reference implementation owns the language for the next decade.

### 5. Sovereign AI (local-first, BYOK, zero-telemetry)

Anthropic is cloud-centric. The Claude.ai surface phones home. The API requires sending data to Anthropic's servers. This is fine for many use cases but fails for:
- Classified government work.
- Regulated industries with strict data-residency requirements (banking, healthcare in some jurisdictions).
- Privacy-maximalist developers and users.

The substrate is: local-first AI infrastructure that runs on consumer hardware (M4 Max, ARM laptops), never phones home, and provides the same audit primitives that cloud-deployed kbot-finance does. kbot is already on this track; the next move is making it production-grade for regulated work.

### 6. The rule-pack registry (npm for compliance)

Today every team that needs to encode a regulation in code rewrites it from scratch. There is no:
- Versioned registry of importable rule packs (EU AI Act Annex IV @ v1.2.0, SR 26-02 @ v0.9.1, MiFID II RTS 6 @ v3.0.0).
- Lockfile format so a deployed compliance kit composes deterministically.
- Regulatory-diff tool that shows when an underlying regulation changed and what rule-pack updates are required.
- Signed attestations from compliance counsel that a specific rule-pack version correctly implements the cited regulation.

This is the legibility infrastructure of compliance. The first credible registry owns the entire vertical.

---

## The seven projects (kernel.chat ships these to be ahead by 2027)

Ranked by leverage. Each is a real package or service, scoped to be shippable by a small team in 6-18 months.

### Project 1 — `@kernel.chat/mcp-conformance`

**What it is:** A conformance test suite for MCP servers, with explicit audit-mode coverage. Ships as an npm package + a CI integration any MCP server can adopt. Run against your server; get a pass/fail report + a public conformance badge.

**Why it's ahead:** Anthropic publishes the spec but doesn't ship the conformance authority. Browser conformance suites (Acid3, Web Platform Tests) became *the* authority for their domain. MCP needs the same.

**Stand-out signal by 2027:** Every serious MCP server lists "MCP Conformance Score: X/Y" in its README. The conformance suite is cited in the MCP spec itself.

**First commit scope:** A test harness that exercises a target MCP server's `tools/list`, `tools/call`, `_meta` envelope coverage, and capability negotiation. Reports per-category pass/fail.

**Timeline:** 90 days to first usable version. 12 months to broad adoption.

---

### Project 2 — `@kernel.chat/agent-court`

**What it is:** A multi-agent dispute resolution protocol. When two agents disagree about whether an action should fire, they submit the dispute (with full audit chains) to a designated arbiter agent. The arbiter rules with explicit citations to a versioned rule-pack. The decision + reasoning enter the audit chain.

**Why it's ahead:** A2A is positioned as complementary to MCP but is still early. Nobody has shipped multi-agent governance that works across model vendors. Anthropic is doing alignment at training time; this is constitutional adjudication at runtime.

**Stand-out signal by 2027:** When a multi-agent system fails in production and a regulator asks "which agent decided what," the answer points at an agent-court chain.

**First commit scope:** A `Dispute` envelope type, an `Arbiter` interface, a reference arbiter using kbot-finance's verifier, and a single worked example: two agents (Claude and a local model) disagreeing about whether a trade should fire; arbiter rules.

**Timeline:** 120 days to first usable version. 18 months to standards-body conversations.

---

### Project 3 — `@kernel.chat/zkml-attestation`

**What it is:** A library for generating zk-SNARK proofs that an AI inference ran correctly on inputs whose hash is H, without revealing the inputs themselves. Ships with reference circuits for the simplest production cases (linear layers + softmax over a small model).

**Why it's ahead:** zkML is a research field today. Production-grade zkML is 18-36 months away. The reference implementation that exists when demand lands wins.

**Stand-out signal by 2027:** The first regulator-accepted proof that a model ran correctly without input disclosure uses this library.

**First commit scope:** Wrappers around `snarkjs` or `risc0` that produce a verifiable attestation for a constrained model class. A worked example: prove a small classifier ran correctly on a hash-pinned input without revealing the input.

**Timeline:** 180 days to first usable version. 24-36 months to production-grade.

---

### Project 4 — `@kernel.chat/agent-os`

**What it is:** Permissions, namespaces, resource quotas, and sandboxes for multi-agent systems. POSIX for agents. Builds on kbot-finance's existing material-gate approval substrate but generalizes it to multi-agent OS-level primitives.

**Why it's ahead:** Anthropic ships *an* agent. Steinberger ships substrates for *an* agent's automation. Nobody has shipped the OS that multiple agents share.

**Stand-out signal by 2027:** "Running on agent-os" becomes a credibility signal for any multi-agent product, the way "ACID-compliant" became one for databases.

**First commit scope:** A small process-manager-shape package that lets a parent process spawn child agents with declared permissions, audit-log namespace isolation, and a token quota. First adopter: kbot itself (replaces ad-hoc subprocess spawning).

**Timeline:** 90 days to first usable version. 18 months to broader adoption.

---

### Project 5 — `@kernel.chat/sovereign-stack`

**What it is:** A turnkey local-first AI stack — Ollama + kbot + kbot-finance + audit log + verifier + computer-use, all running on consumer hardware (M4 Max, ARM laptops, modest x86 boxes), with zero telemetry and BYOK throughout. Ships as a one-command install.

**Why it's ahead:** Anthropic is cloud-centric. The privacy-maximalist + sovereignty-mandated buyers (classified work, EU healthcare, certain hedge funds) need this and don't have it. The substrate is mostly built; what's missing is the integration and the brand.

**Stand-out signal by 2027:** "Did you check sovereign-stack?" becomes the first question every privacy-focused developer asks when evaluating AI tooling.

**First commit scope:** A `sovereign-stack init` command that provisions the local Ollama + kbot + kbot-finance setup with sensible defaults, a single config file, and a smoke-test that verifies zero outbound calls.

**Timeline:** 60 days to first usable version. 12 months to a meaningful adoption story.

---

### Project 6 — `@kernel.chat/rulepack-registry`

**What it is:** The npm-of-compliance. Versioned, signed, importable rule packs for every major regulation. A lockfile format. A diff tool that shows when an underlying regulation changes and what rule-pack updates that requires.

**Why it's ahead:** Today every team rewrites compliance code from scratch. Nobody has shipped the legibility infrastructure. The cost of being first is moderate; the network effects after adoption are massive.

**Stand-out signal by 2027:** Every regulated-industry AI deployment cites rule-pack-registry version pins in its compliance documentation.

**First commit scope:** A registry CLI (`rulepack publish`, `rulepack install`), a lockfile format (`rulepack.lock.json`), and the first three published rule packs: EU AI Act Annex IV, SR 26-02 model-risk, MiFID II RTS 6.

**Timeline:** 90 days to first usable version. 24 months to industry adoption.

---

### Project 7 — `@kernel.chat/mcp-next` (the post-MCP spec)

**What it is:** A draft spec for the protocol that comes after MCP — multi-modal, multi-agent, audit-native, post-quantum-cryptographic. Not a replacement; an evolution proposal Anthropic can either adopt into MCP v2 or treat as a separate track.

**Why it's ahead:** By 2028 MCP will need successor work. The successor draft that exists when the conversation starts gets the framing power. Steinberger drafted Peekaboo before AX-first was an obvious choice; the same move applies at the protocol layer.

**Stand-out signal by 2027:** kernel.chat is in the room when the MCP working group debates the next version.

**First commit scope:** A 20-30 page draft spec with: multi-modal envelope (text + image + audio + binary), multi-agent handshake (capability negotiation across agent vendors), audit-native (audit envelope is normative, not experimental), post-quantum signature track (Ed25519 + Dilithium dual-mode).

**Timeline:** 60 days to first draft. 12 months to community-discussion-ready. 24-36 months to standards-body conversations.

---

## What this stack signals together

Each individual project could be dismissed as "someone else will build this." The seven together signal something different:

**kernel.chat is building the agent-substrate layer that comes after the current frontier.**

- MCP-conformance and MCP-next say we're the protocol stewards-in-waiting.
- Agent-court and agent-os say we're the OS-level substrate authority.
- zkML-attestation says we're at the cryptographic frontier.
- Sovereign-stack says we're the privacy-maximalist alternative.
- Rulepack-registry says we're the legibility infrastructure.

Anthropic builds models. Steinberger builds GUI automation. **kernel.chat builds the agent substrate.** That's the position the seven projects together carve out.

---

## The honest critique of this position paper

Three real risks to name:

1. **Substrate-first companies often die to platform plays.** If Anthropic decides to ship the agent OS themselves (Project 4), or a major cloud vendor builds the rulepack registry (Project 6), they win on distribution. The defense: ship the open spec first, get cited in regulation, become the reference implementation regulators trust.

2. **"Further ahead" can read as "alone and unfunded."** Being ahead of the field means you're spending capital before the market arrives. Funding becomes hard — investors want pattern matches, and these don't pattern-match yet. The defense: keep one foot in the present (kbot-finance pilots paying revenue) while shipping the future projects in parallel.

3. **The team to ship all seven doesn't exist yet.** Even one of these takes 6-18 months with a focused team. Seven across 24 months requires hiring, fundraising, and discipline most early-stage teams don't have. The defense: ship two with deep focus (Projects 1 and 4 are the most leveraged), let the others remain documented intent until the team grows.

---

## What ships first

Two of the seven. The rest stay in this document as a public roadmap.

1. **`@kernel.chat/mcp-conformance`** — the conformance authority for MCP. 90-day scope. Compounds adoption.
2. **`@kernel.chat/agent-os`** — POSIX for agents. 90-day scope. The OS-level innovation.

The other five are queued and dated below in priority order. Each gets its own scaffold when the focus turns to it.

| Project | Earliest credible start |
|---|---|
| MCP Conformance Suite | Now (Q2 2026) |
| Agent OS | Q3 2026 |
| Rule-pack Registry | Q3 2026 |
| Sovereign Stack | Q4 2026 |
| Agent Court | Q1 2027 |
| MCP-Next Draft Spec | Q2 2027 |
| zkML Attestation | Q3 2027 |

---

## Final note

Being ahead of teams that are themselves ahead of the field is a hard claim. We don't ship it as a slogan. We ship it as code, in the open, with conformance tests anyone can run.

If by mid-2027 these seven projects are real packages with adoption, the position paper was right. If they're not, this document is honest evidence of where we tried and what we learned.

The next commit is the first scaffold of project 1.

---

*Position paper v0.1 · May 2026 · CC BY 4.0 · The position is not the
work. The work is what compiles, ships, and gets cited.*
