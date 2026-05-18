# Provenance Engineer — Role Definition

> A working definition of the provenance engineer discipline, written by
> the team shipping one of the first public reference implementations
> (kbot-finance). This document is intended to be forked, referenced,
> and improved — provenance engineering is a public field, not a kbot
> trademark.

## What a provenance engineer does

A provenance engineer builds the substrate that lets AI agents operate
safely inside regulated industries. The core engineering question they
answer is:

> *"After this AI agent took an action, can we prove what it knew, what
> it asked, what it received, what it computed, what it decided, who
> approved it, and replay the decision byte-for-byte under audit?"*

If the answer is yes, the substrate is sound. If the answer is no,
the substrate needs work.

## The structural rule

Provenance engineers enforce one architectural principle above all others:

> **AI never produces the source-of-truth number. Deterministic engines do.
> AI orchestrates and interprets. Humans approve at material gates.**

This separation is non-negotiable. It's what makes the rest of the
substrate possible — without it, "audit trail" is just a log of what the
model felt like saying. With it, every audit-grade claim is grounded in a
deterministic computation an inspector can re-run.

## The six-discipline overlap

The role demands fluency across six normally-separate engineering
disciplines:

1. **Quantitative finance** (or the equivalent domain math for your
   vertical) — enough to know what *not* to compute in the AI layer.
   You don't have to derive Black-Scholes from scratch; you have to know
   why the AI shouldn't.
2. **Distributed systems** — state machine replication, FLP impossibility,
   CAP trade-offs, deterministic compute, append-only logs, vector
   clocks. The audit log is a distributed systems artifact whether you
   call it that or not.
3. **Cryptography** — SHA-256 content addressing, Merkle trees,
   HMAC/Ed25519 signatures, eventually zero-knowledge proofs for
   regulator-side verification without input disclosure.
4. **Numerical analysis** — IEEE 754 floating-point, catastrophic
   cancellation, correctly-rounded math libraries (CRlibm, sleef),
   reproducible BLAS. This is where audit-trail (cheap) becomes
   audit-grade (engineering).
5. **Regulatory literacy** — SR 26-02 / SR 11-7, EU AI Act Annex IV,
   MiFID II RTS 6, FINRA 2026 ROR, FCA SS1/23, FDA SaMD, jurisdiction
   variants. You're not the lawyer; you implement what the lawyer wrote.
6. **AI / agent engineering** — MCP protocol, tool-use schemas,
   multi-agent orchestration, model-substrate separation, prompt-template
   versioning, eval harnesses.

Most working engineers have depth in one or two of these. Few have
four. Almost nobody has all six. That's the moat.

## Adjacent roles you may already be doing

Provenance engineering hasn't always been called that. If your current
title is one of these, you're doing some of the work:

| Adjacent title | Where you are | What's missing |
|---|---|---|
| Quant developer / core strats | Goldman, JPM, Two Sigma, Citadel | AI/agent layer, MCP, governance UX |
| Forward-deployed engineer | Palantir | Open-source substrate work, public spec contribution |
| Applied AI engineer | Anthropic, OpenAI, vertical AI startups | Finance/numerics depth, deterministic compute |
| Compliance engineer | Norm AI, Hadrius, regulated-firm internal tooling | Distributed systems / cryptography depth |
| Low-latency engineer | Adaptive (Aeron), HFT firms | AI layer, audit-export, regulator-facing artifacts |
| SRE / platform engineer | Stripe, Cloudflare, Snowflake | Regulatory grammar, domain math |

A provenance engineer is the union — comfortable in any of these rooms,
but bringing the audit-grade discipline that none of them quite ships
end-to-end on their own.

## Day-to-day shape

A provenance engineer's typical week ships:

- **Engine adapters** — wrapping deterministic services (pricing APIs,
  filing endpoints, on-chain data, calculation libraries) in
  content-addressed envelopes so AI agents can call them safely.
- **Verifier rules** — encoding regulations as machine-checkable
  predicates with adverse-action-style reason codes on failure.
- **Audit-log primitives** — hash-chained append-only stores, replay
  infrastructure, integrity verification, WORM-compatible exporters.
- **MCP servers** — exposing the audit substrate to any agent platform
  (Claude Code, Cursor, Replit Agent, kbot, custom) without lock-in.
- **Protocol specs** — RFCs, reference implementations, working-group
  participation. The MCP content-addressed envelope extension is one
  current example.
- **Lineage reviews** — making sure every AI-influenced decision traces
  back to specific model version, prompt template, training data
  manifest, and human approver.
- **Live smoke tests** — running every adapter against the real binary
  or API before declaring done. Stub-driven unit tests pass against
  the spec, not reality.
- **Compliance translation** — pair-programming with counsel to convert
  prose regulation into rules-as-code, jurisdiction-aware rule
  packages, and examiner-exportable evidence bundles.

## What this role does NOT do

To keep the discipline crisp:

- **Does not train models.** Model training is ML engineering. Provenance
  engineering is about the substrate *around* models.
- **Does not draft regulation.** Compliance counsel drafts; you encode.
  You read regulation fluently enough to know when the encoding diverges
  from the spirit.
- **Does not pick trades / make business decisions.** The engine produces
  the number; humans choose what to do with it. Provenance engineers
  build the rails, not the trades.
- **Does not own the model layer.** Frontier models commoditize; the
  substrate is the durable surface. Stay on the substrate side.

## Career arc (2026–2030)

- **Today (May 2026):** ~50–200 people worldwide are doing this work
  seriously, mostly inside Bloomberg, Palantir, Adaptive (Aeron),
  Two Sigma, Renaissance, JPM/GS internal stacks, and a handful of
  FINOS contributors. The discipline is unnamed in most JDs.
- **2027:** First nine-figure AI enforcement action lands. Compliance
  teams at every tier-2+ regulated firm start asking the question this
  role answers. JDs start using "AI governance engineer" or "audit-grade
  AI infrastructure" as title fragments.
- **2028:** "Provenance engineer" (or equivalent) becomes a recognized
  title. Senior comp lands at $500–800k (NYC, US). Several open-source
  projects compete to be the reference substrate. The MCP audit-extension
  spec ratifies.
- **2030+:** Discipline matures. Conferences, certifications, books.
  Early entrants run substrate organizations at major firms or
  infrastructure companies. The role is to AI what SRE was to web
  infrastructure in 2010.

## How to enter the field

If you have two or three of the six disciplines and want to develop the
others:

1. **Read the audit-grade reference implementations.** kbot-finance
   (this repo), Aeron Sequencer, FINOS AI Governance Framework, Norm AI's
   public material, Stripe Radar's published architecture, FDA's PCCP
   guidance. Read source, not summaries.
2. **Ship a verifier rule.** Pick one regulation paragraph from MiFID II
   RTS 6 or SR 26-02. Encode it as a `Rule` against the kbot-finance
   verifier interface. Submit a PR. The pattern is mechanical once you
   see it; the value compounds.
3. **Ship an engine adapter.** Pick a public data source (FRED, USPTO,
   ClinicalTrials.gov, an exchange API) and wrap it in a content-addressed
   adapter following the Polymarket pattern. Submit a PR. You'll learn
   the substrate by writing one.
4. **Pair with compliance counsel** wherever you can. The most rare and
   leveraged skill in this field is the ability to read regulation
   alongside a lawyer and turn what you both read into testable code.

There is no certification program yet. There will be by 2028. Until
then, public commits are the credential.

## Reading list

**Foundational:**
- Lamport, *Time, Clocks, and the Ordering of Events in a Distributed System* (1978)
- Schneider, *Implementing Fault-Tolerant Services Using the State Machine Approach* (1990)
- IEEE 754-2019 (skim the relevant chapters; nobody reads the whole thing)
- RFC 8785 (JSON Canonicalization Scheme)

**Domain:**
- ISDA Common Domain Model documentation
- EU AI Act Annex IV (read the actual annex, not summaries)
- Federal Reserve SR 26-02 supersedes SR 11-7 (Apr 2026)
- FINOS AI Governance Framework v2.0
- Anthropic's MCP specification + roadmap

**Industry context:**
- Bloomberg LP, public material on ASKB (Feb 2026 launch + roadmap)
- Palantir AIP documentation (closed-source counterpart to study)
- Stripe Radar's engineering blog (rules + ML hybrid pattern)
- ACAS-X papers (offline-compiled deterministic policies — pattern
  transfers to AI-derived execution heuristics)

## Open questions in the field

These are unsolved. The provenance engineer who solves any of them
becomes a named contributor:

1. **Bit-deterministic AI inference at production speeds.** Currently
   physically impossible on commodity GPUs. Needs hardware or
   integer-only inference paths.
2. **Cross-firm audit-log interoperability.** Each firm has its own
   audit substrate today. A shared spec (the MCP extension is one
   attempt) would let regulators verify across vendors.
3. **Zero-knowledge replay.** Regulators want to verify computation
   without seeing inputs (proprietary positions, patient data,
   classified intelligence). zkML is early; the production pattern is
   open.
4. **Compliance-as-code standardization.** Today every team encodes
   their own RTS 6 rules. A shared open library (with versioned diffs
   when regulation updates) would let firms inherit instead of
   rebuild.
5. **Hardware-determinism honesty primitive.** The standard for *when*
   a system may claim byte-identical replay is informal today. A
   formal certification process (analogous to FIPS 140) would let
   regulated firms procure with confidence.

If you're a provenance engineer who wants to be cited in 2030, pick one
of these and ship.

---

*This role definition is licensed CC BY 4.0. Fork it, improve it,
adopt it in your own JDs and onboarding docs.*
