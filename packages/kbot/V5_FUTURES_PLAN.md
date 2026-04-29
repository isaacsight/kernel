# V5 Futures Plan — Self-Improving Harness + Six Module Foundation

> **Status**: planned, not built. Drafted 2026-04-29 from the research session.
> One concrete sample exists: `packages/kbot/src/futures/harness/types.ts`.
> This document lists the rest, sequenced and scoped, for review.

## Why this plan

The research synthesis on 2026-04-29 identified six positions where current
kbot architecture lines up with frontier research published in the last
~10 days. Each maps onto a kbot subsystem that already exists in some form,
and each closes a gap that current kbot has either flagged-off, scaffolded,
or done ad-hoc. This plan formalizes them into one coherent `src/futures/`
module — the v5 architectural skeleton.

The unifying frame: **kbot becomes a self-improving harness, not a
collection of tools.** "Agent = Model + Harness" (Sylph.AI 2026); kbot ships
the harness; the harness improves itself; everything else hangs off that.

## Sources behind each module

| Module | Paper / signal | arXiv |
|---|---|---|
| `harness/` | "The Last Harness You'll Ever Build" — Sylph.AI | 2604.21003 |
| `skill-graph/` | "Toward Scalable Terminal Task Synthesis via Skill Graphs" — Tencent Hunyuan | 2604.25727 |
| `latent-state/` | "Recursive Multi-Agent Systems" — Stanford / UIUC / NVIDIA / MIT | 2604.25917 |
| `forecast/` | Custom — addresses "better predictions and outputs for the future" | n/a |
| `persona/` | Cequence "Agent Personas" infrastructure-level privilege scoping | press 2026-04-28 |
| `debate/` | "BARRED: Custom Policy Guardrails via Asymmetric Debate" — Plurai | 2604.25203 |

## Directory layout

```
packages/kbot/src/futures/
├── README.md                 # Architecture overview, how the modules compose
├── index.ts                  # Public surface
├── harness/                  # ✅ Sample types.ts already drafted
│   ├── types.ts              # Harness, Worker, Evaluator, EvolutionAgent
│   ├── evolution-loop.ts     # Inner loop (Algorithm 1 from Sylph)
│   ├── meta-evolution.ts     # Outer loop (Algorithm 2 from Sylph)
│   ├── critic-evaluator.ts   # Adapts critic-gate.ts → Evaluator interface
│   ├── noop-evolution.ts     # Stub EvolutionAgent (records but doesn't rewrite)
│   ├── persistence.ts        # JSONL trace persistence (pattern from planner/hierarchical)
│   ├── index.ts
│   ├── evolution-loop.test.ts
│   └── README.md
├── skill-graph/              # Tencent SkillSynth formalism
│   ├── types.ts              # Skill, Scenario, Edge, GraphPath
│   ├── graph.ts              # buildGraph, addSkill, addScenario, samplePath
│   ├── synthesis.ts          # Path → Task instance (calls into kbot agent stub)
│   ├── index.ts
│   └── graph.test.ts
├── latent-state/             # Recursive MAS envelope
│   ├── types.ts              # LatentEnvelope, AgentTransfer
│   ├── envelope.ts           # serialize / deserialize / merge
│   ├── index.ts
│   └── envelope.test.ts
├── forecast/                 # Predictions module — NEW, addresses user's framing
│   ├── types.ts              # Signal, Trend, Forecast, Horizon
│   ├── projection.ts         # linear / exponential projection over Signal arrays
│   ├── synthesize.ts         # Pull from growth.ts + research signals → Forecast[]
│   ├── index.ts
│   └── projection.test.ts
├── persona/                  # Cequence Agent Personas
│   ├── types.ts              # Persona, Scope, PermissionGrant
│   ├── check.ts              # canInvoke(persona, tool, args) → Verdict
│   ├── index.ts
│   └── check.test.ts
└── debate/                   # BARRED-style asymmetric debate
    ├── types.ts              # DebateRound, AsymmetricRoles, Verdict
    ├── runner.ts             # Run a debate round given LLM client (injectable)
    ├── synthesis.ts          # Generate guardrail training data
    ├── index.ts
    └── runner.test.ts
```

Total estimated LOC, tightly scoped: **~1,200 LOC of TS + ~400 LOC of tests + ~300 lines of markdown**.

---

## Module-by-module spec

### 1. `harness/` — Harness Evolution Loop (HIGHEST LEVERAGE)

**Goal**: every kbot session is a Worker run inside a Harness Evolution Loop. The Evaluator (wrapping `critic-gate.ts`) scores the trace; the EvolutionAgent records what would change. Even with a no-op EvolutionAgent, the data structure unlocks: harness diffing, trace persistence, A/B evaluation.

**Maps onto existing kbot**:
- Worker → existing `agent.ts` (we just need an adapter)
- Evaluator → existing `critic-gate.ts` (already produces verdicts; needs adapter)
- EvolutionAgent → **does not exist**; ship a no-op stub now, real implementation later
- Harness → currently implicit in `auth.ts` config + `cli.ts` flags; this module makes it explicit data

**What the no-op EvolutionAgent gives you for free**: structured trace history, harness versioning, regression detection. Even with zero codegen, you get the substrate for harness experimentation.

**Tests**: in-memory Worker that returns a canned trace; in-memory Evaluator that grades against a regex; loop runs K=3 iterations; assert history length, best-score monotonicity, verdict labels.

### 2. `skill-graph/` — Skill graph data structure

**Goal**: formalize what `packages/skill-router/` does as an explicit graph: skill nodes, scenario nodes (intermediate), edges. Path through graph = workflow. Sampling paths gives synthetic tasks for evaluation/training.

**Maps onto existing kbot**:
- Existing `skill-router/` is a Bayesian rating system over flat skills; this graph wraps it with structure
- Existing 100+ skills become nodes; scenarios are inferred from co-occurrence in session logs
- Sampled paths feed `harness/` evaluation tasks

**Tests**: build a 10-node graph by hand; assert path sampling visits expected scenarios; assert path length distribution matches workflow shape.

### 3. `latent-state/` — Inter-agent state envelope

**Goal**: agents currently hand off state via text. Recursive MAS argues latent-state transfer is more efficient. We can't ship latent-state today (needs model support), but we can ship a typed envelope that carries either text or structured state, so when the underlying models support it, the protocol doesn't need to change.

**Maps onto existing kbot**:
- Existing `a2a.ts`, `agent-protocol.ts` — currently text-based handoffs
- New envelope wraps existing handoffs with optional structured payload + provenance

**Tests**: round-trip serialize/deserialize; merge two envelopes; assert provenance preserved.

### 4. `forecast/` — Predictions module

**Goal**: kbot already has `growth.ts` (npm/GitHub/users/tools/traces). It surfaces *current state*. This module projects forward — linear and exponential models over rolling windows, with confidence intervals. Plus a `synthesize` entry point that joins growth signals with research signals to emit "what's likely to ship next" predictions.

**Why it's worth building**: user explicitly framed the build as "for better predictions and outputs for the future." This is the literal interpretation. Surfaces predictions to the user, not just to the agent.

**Tests**: synthetic Signal series; linear projection within tolerance; exponential projection within tolerance; horizon clamping.

### 5. `persona/` — Privilege scoping

**Goal**: type-checked per-persona scopes for tool invocation. Each persona has an allowlist of tools, an args-shape constraint, and a max-blast-radius bound. Runtime check before any tool execution.

**Maps onto existing kbot**:
- Existing `permissions.ts` already gates destructive ops; this generalizes it to identity-bound scopes
- Existing `hooks.ts` provides the integration point — Persona check becomes a pre-tool hook

**Tests**: define 3 personas (researcher, coder, computer-use); assert allowed/denied combinations; assert scope inheritance.

### 6. `debate/` — Asymmetric debate runner (CRITIC TRAINING)

**Goal**: BARRED's recipe — use multi-agent debate to generate high-quality guardrail training data. Stub now (LLM client is injectable), real run later. Produces JSONL of (input, label, debate-rationale) tuples that can fine-tune the critic.

**Maps onto existing kbot**:
- Existing `critic-gate.ts` is feature-flagged off awaiting FP measurement
- This module produces the training data that lets you measure → ship the critic

**Tests**: with a deterministic stub LLM client, assert debate runs to completion, asymmetric roles assigned correctly, label aggregation rules fire.

---

## Sequencing

### Phase 1 — Foundation (1–2 sessions, ~600 LOC)
1. `futures/index.ts` + `futures/README.md`
2. `harness/types.ts` (✅ already drafted)
3. `harness/evolution-loop.ts` + `noop-evolution.ts` + tests
4. `harness/critic-evaluator.ts` (the wiring that actually puts critic-gate to work)
5. `harness/persistence.ts` (JSONL — same pattern as `planner/hierarchical/persistence.ts`)

After Phase 1: every kbot session can opt-in (`--evolve` flag) to run inside the loop. Critic-gate finally has a job. Trace history accumulates on disk. Foundation for everything else.

### Phase 2 — Structure & Predictions (1 session, ~400 LOC)
6. `skill-graph/` full module
7. `forecast/` full module
8. Hook `forecast/` into the `growth_summary` tool so the dashboard projects forward, not just back

After Phase 2: kbot can answer "what's likely to ship next" in a typed, evidence-backed way. Skill graph becomes the substrate for synthesizing eval tasks for harness loop.

### Phase 3 — Distribution & Safety (1 session, ~400 LOC)
9. `latent-state/` full module
10. `persona/` full module + integration with `permissions.ts`
11. `debate/` full module
12. Wire `debate/` output → `critic-gate.ts` training pipeline

After Phase 3: critic is shippable (FP rate measurable from debate-generated data). Personas formalize who-can-do-what. Latent state envelope gates the road to multi-agent v2.

### Phase 4 — Meta (1 session, ~200 LOC)
13. `harness/meta-evolution.ts` — the outer loop. Only worth building once you have multiple distinct tasks in the inner loop history.

---

## What this does not include (deliberately)

- **Real EvolutionAgent codegen**. The interface is shipped; the implementation is "rewrites the harness JSON based on history." Actual safe code rewriting is a multi-month problem and not necessary for the substrate to be useful.
- **Recursive MAS latent-thought training**. Requires model-side support; envelope is the most we can do client-side.
- **TCOD on-policy distillation**. Needs a training pipeline + GPU budget; out of scope until kbot has a custom local model.
- **Terminal-Bench evaluation**. Worth doing later as a separate effort — not blocking this plan.
- **Anything that runs real LLMs in tests**. All tests use injected stub clients — CI must stay deterministic and free.

---

## Open decisions for review

1. **Naming**: `futures/` vs `v5/` vs `experimental/`? Current draft uses `futures/`.
2. **Where the no-op EvolutionAgent lives now**: in `futures/harness/` (shipped) vs as a placeholder that throws (not shipped until real)? Current draft: shipped no-op so the loop runs end-to-end.
3. **Persistence path**: `~/.kbot/futures/harness/<task-id>.jsonl` vs reuse the existing `~/.kbot/observer/session.jsonl`? Current draft: separate path, easier to nuke.
4. **CLI surface**: new `kbot harness evolve` subcommand vs `--evolve` flag on existing run? Current draft: subcommand, since it's a different mode.
5. **Forecast surfacing**: new tool `forecast_summary` parallel to `growth_summary`, or add `horizon` arg to existing tool? Current draft: new tool — separation of concerns.
6. **Public API**: do these modules export from `@kernel.chat/kbot/futures`, or stay internal? Current draft: separate subpath export, so users can opt-in to experimental APIs.

---

## Files already drafted (concrete sample)

- `packages/kbot/src/futures/harness/types.ts` — full type system for the Harness Evolution Loop. Pure types, no runtime, no risk. Acts as the contract every other harness file targets.

---

## When you're back

Pick:
- (A) Ship Phase 1 only and stop — gives you the harness substrate and a real job for critic-gate.
- (B) Ship Phases 1–2 — adds skill graph + forecast (the "predictions" framing).
- (C) Ship all four phases — full v5 foundation. ~1 week of focused sessions, all reversible since it's additive under `futures/`.
- (D) Different sequence — for example, do `forecast/` first because it's smallest and highest-visibility.

Default recommendation: **(A) first, then (B)**. Phase 1 unblocks critic-gate, which is the longest-lived feature flag in the codebase. Phase 2 produces user-visible predictions, which is what you literally asked for.
