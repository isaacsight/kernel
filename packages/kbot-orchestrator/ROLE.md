# Orchestration Engineer — Role Definition

> A working definition of the orchestration engineer discipline, written by
> the team shipping a public reference implementation
> (`@kernel.chat/kbot-orchestrator`). Orchestration engineering is a public
> field, not a kernel.chat trademark. Fork this; improve it; adopt it in
> your own JDs.

## What an orchestration engineer does

An orchestration engineer designs how multiple agents (and the humans they
report to) pass work between each other so that a real-world outcome ships
end to end. The core engineering question they answer is:

> *"Given a multi-step outcome that requires several specialist agents, one
> or more deterministic systems, and human approval at material gates: what
> is the structure of the pipeline, how does work and evidence flow between
> nodes, and how do we know the outcome actually shipped?"*

If the answer is a pipeline you can run a second time and get the same
result with the same evidence trail, the orchestration is sound. If the
answer is "it worked once and we don't know why," the orchestration is
ad hoc.

## The structural rule

Orchestration engineers enforce one architectural principle above all:

> **Work flows down; evidence flows up; every handoff is auditable.**

Agents call deterministic systems for source-of-truth numbers (the
[provenance engineering](../kbot-finance/ROLE.md) discipline). Agents are
isolated by OS primitives at the system boundary (the
[agent-os](../agent-os/) discipline). Orchestration engineering is what
happens *between* the agents: the routing, the delegation, the handoff
protocols, the rollups.

Without orchestration discipline, you can have audit-grade substrate and
clean OS primitives and still ship nothing, because the work never gets
routed to the right specialist at the right time, or the result never gets
rolled up to the right human.

## What orchestration engineering covers

The discipline produces these artifacts:

1. **Pipeline definitions.** A named multi-step workflow with explicit
   agent assignments, deterministic-engine calls, and human approval
   gates. Versioned. Testable.
2. **Briefing formats.** Human-readable, machine-parseable documents that
   describe a batch of work the pipeline will execute (recipients, drafts,
   templates, tier metadata). The briefing is the contract between human
   editor and pipeline.
3. **Handoff protocols.** How work moves from agent A to agent B (and to
   human approver C): what state, what evidence, what timing, what
   rollback semantics.
4. **Audit trails.** Per-pipeline-run, a structured log of every send,
   every reply, every failure, every approval. Appended back into the
   briefing or written to a content-addressed store.
5. **Failure semantics.** What happens when an agent fails mid-pipeline,
   what gets retried, what gets escalated, what gets discarded.
6. **Cost telemetry.** How much each pipeline run cost (model calls,
   external API calls, human attention time). Without this, pipelines
   grow without bound.

## The six-discipline overlap

The role demands fluency across six normally-separate engineering
disciplines:

1. **Multi-agent system design** — when to use a single agent with tools
   vs. a swarm with specialists; how to bound delegation depth; how to
   prevent infinite agent loops; how to checkpoint long-running pipelines.
2. **Workflow engineering** — Airflow / Temporal / Prefect / Dagster
   patterns adapted to agent execution. State machines. Retry semantics.
   Idempotency. The orchestrator is a workflow engine whether you call it
   that or not.
3. **Provenance engineering** — every handoff needs an audit envelope
   the next stage can verify. The orchestrator depends on the substrate
   provenance engineers ship.
4. **Human-in-the-loop UX** — pipelines stop at material gates and wait
   for human approval. The gate UX is part of the orchestrator's surface.
   Poor gate UX = humans rubber-stamp; the audit trail loses meaning.
5. **Editorial / content discipline** — for orchestrators that produce
   public artifacts (the kernel.chat case), the editorial standard the
   pipeline enforces is part of the engineering. Tone, voice,
   structure, citation discipline.
6. **Distribution mechanics** — outreach orchestrators are partly
   marketing-ops systems. Address verification, bounce handling, throttle
   compliance with provider TOS, reputation management on the sending
   domain. Pipelines that ignore this get the sending account suspended.

Most working engineers have depth in one or two of these. Few have four.
That's the moat.

## Adjacent roles you may already be doing

Orchestration engineering hasn't always been called that. If your current
title is one of these, you're doing some of the work:

| Adjacent title | Where you are | What's missing |
|---|---|---|
| ML platform engineer | Anthropic, OpenAI, Mistral, Together | Multi-agent delegation semantics, human-gate UX |
| MLOps engineer | Most regulated firms with ML in production | Agent-specific patterns, swarm coordination |
| Workflow engineer | Airflow / Temporal / Prefect / Dagster shops | Agent semantics, model-call cost discipline |
| Marketing ops engineer | High-volume outreach orgs | Audit trail, deterministic substrate integration |
| Forward Deployed Engineer | Palantir, Anduril, Saronic | Multi-agent fluency, open-source substrate |
| Editor-in-chief / managing editor | Stratechery, Platformer, Garbage Day, kernel.chat | Workflow engineering, agent semantics |

An orchestration engineer is the union: comfortable in any of these rooms,
but bringing the pipeline-as-engineering discipline none of them quite
ship end-to-end on their own.

## Day-to-day shape

An orchestration engineer's typical week ships:

- **Pipeline updates.** Adding a new specialist node, changing the routing
  logic, tightening a human gate. Versioned commits to a real codebase.
- **Briefing reviews.** Working with humans (editors, sales operators,
  research leads) to refine the briefing format the pipeline accepts.
- **Failure post-mortems.** Reading the audit trail of a partial-failure
  run and identifying where the orchestration was the bug.
- **Cost reviews.** Looking at last week's model-call costs and deciding
  whether a node should be a smaller model, a cached call, or a
  deterministic engine instead.
- **Integration work.** Wiring new external systems (CRMs, mail providers,
  data sources) into the pipeline with proper envelope discipline.
- **Spec writing.** RFCs for handoff protocols, briefing format extensions,
  audit-trail schemas.

## What this role does NOT do

To keep the discipline crisp:

- **Does not write the prompts that go inside specialist agents.** That's
  prompt engineering / specialist tuning. Orchestration engineering is
  about the connective tissue between agents, not the agents themselves.
- **Does not train models.** ML engineering territory.
- **Does not own the deterministic engines.** Provenance engineering
  territory. Orchestration calls into deterministic engines; it doesn't
  build them.
- **Does not own the OS-layer primitives.** agent-OS engineering territory.
- **Does not make the editorial calls.** Editors do. Orchestration enforces
  whatever editorial discipline the briefing encodes.

## Reference implementation

`@kernel.chat/kbot-orchestrator` (this package) is one working reference
implementation. The v0.1 ships the outreach pipeline because that's the
load-bearing loop kernel.chat itself has been running by hand for months
and is the cleanest demonstrable instance of the discipline. The roadmap
adds: content production pipeline, code-maintenance pipeline, multi-agent
research pipeline.

## Career arc (2026-2030)

- **Today (May 2026):** ~100-500 people worldwide are doing this work
  seriously, scattered across MLOps, Forward Deployed roles, and the few
  AI-native publications running real production pipelines. The
  discipline is unnamed in nearly every JD.
- **2027:** First major multi-agent production outage with audit-trail
  failure lands a company in regulatory trouble. Job titles start including
  "agent workflow engineer," "AI orchestration engineer," "agent
  reliability engineer."
- **2028:** "Orchestration engineer" (or equivalent) becomes a recognized
  title. Senior comp lands at $400-700k (NYC, US). Reference
  implementations standardize on a handful of frameworks.
- **2030+:** Discipline matures. The discipline-name converges. Early
  entrants run platform organizations at major firms.

## How to enter the field

1. **Read this and the linked siblings** ([provenance engineering](../kbot-finance/ROLE.md),
   [agent-os](../agent-os/)). The three disciplines stack.
2. **Ship a pipeline.** Pick a real multi-step workflow you (or your org)
   run by hand. Codify it as a kbot-orchestrator pipeline. Submit a PR
   adding a new pipeline shape to this package.
3. **Write up the failure post-mortem after your first production run.**
   The act of reading the audit trail and naming where orchestration was
   the bug is the discipline. Publish the post-mortem.

There is no certification program. The reference implementations are the
credential.

## Open questions in the field

1. **What is the right human-gate UX for high-throughput pipelines?**
   Today most orchestrators either gate every send (too slow) or batch
   approve in bulk (humans rubber-stamp). The middle is unsolved.
2. **How do orchestrators interoperate across organizations?** Two firms'
   pipelines need to hand work to each other with shared audit semantics.
   No spec exists. This is the cross-firm equivalent of [provenance
   engineering's "shared audit substrate"](../kbot-finance/ROLE.md) open
   question.
3. **What is the cost model for multi-agent pipelines?** Single-agent
   loops have predictable cost. Swarms with depth and branching have
   variance that breaks budgets. The cost-model literature for this is
   thin.

If you're an orchestration engineer who wants to be cited in 2030, pick
one of these and ship.

---

*This role definition is licensed CC BY 4.0. Fork it, improve it, adopt it
in your own JDs and onboarding docs.*
