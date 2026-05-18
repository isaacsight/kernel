# Agentic engineering — a field, not a discipline

*A working definition of the field, and a map of the disciplines inside it. Written from the position of one magazine and one open-source agent stack working in it.*

Dated 2026-05-17. Filed alongside [`packages/kbot`](../packages/kbot/), [`packages/kbot-finance`](../packages/kbot-finance/), and [`packages/agent-os`](../packages/agent-os/).

---

## The distinction

**Field** and **discipline** are not the same word.

A field is where work happens. It has practitioners, tools, problems, journals, conferences, and a vocabulary that is mostly contested. Computer science is a field. Civil engineering is a field. Medicine is a field.

A discipline is a sharp practice inside a field. It has a defined question it answers, a defined object it produces, a defined community that does the work. Distributed systems is a discipline inside computer science. Structural analysis is a discipline inside civil engineering. Anesthesiology is a discipline inside medicine.

Agentic engineering is a field. It is what people mean when they say "I build with AI agents." Provenance engineering is a discipline inside it. So are several others, mostly unnamed.

This document defines the field, then maps the disciplines inside it. It does not try to coin the field name; that has already happened in circulation. It does try to make the boundary sharp.

---

## What agentic engineering is

Agentic engineering is the practice of building production systems where AI agents take actions, not just produce text.

The boundary is the action. If an LLM produces an answer that a human reads and acts on, that is AI engineering. If an LLM produces an answer that a software system acts on without human review at every step, that is agentic engineering.

Three things follow from that boundary.

The first is that *correctness has to be engineered*, not assumed. An action that fires without human review is an action whose consequences land. The discipline of getting actions right (or proving them wrong before they fire) is the central engineering problem of the field.

The second is that *delegation is the unit of work*. An agentic system is one or more agents passing work to each other. Whether that is a single agent calling tools or a swarm of specialists handing off intermediate results, the engineering question is how delegation is structured.

The third is that *the substrate under the agent matters more than the model in it*. Models commoditize. Substrates do not. The work that holds value over a five-year horizon is the work done on what surrounds the agent, not on the agent itself.

---

## What agentic engineering is not

Several adjacent things are routinely conflated with the field. Pulling them apart makes the field sharper.

It is not AI engineering. AI engineering is the practice of building systems around model outputs that humans then act on (chatbots, copilots, search). Agentic engineering starts where the human stops reviewing every output.

It is not prompt engineering. Prompt engineering is a craft skill inside both fields. It does not constitute the engineering work.

It is not autonomous-agent research. Research labs build experimental agents to study what is possible. Agentic engineering is what happens when those capabilities meet production constraints (cost, latency, audit, reliability).

It is not ML engineering. ML engineering is upstream — training, fine-tuning, evaluation of model weights. Agentic engineering happens downstream of weights you didn't train.

---

## The discipline map

Six disciplines sit inside the field as of mid-2026. Some have names. Some don't.

### 1. Substrate — provenance engineering

The discipline of building the substrate that makes agent actions provable, auditable, and replayable. Hash-chained logs, content-addressed envelopes, deterministic engines, regulatory verifiers, material gates. The reference role is [`packages/kbot-finance/ROLE.md`](../packages/kbot-finance/ROLE.md); the reference implementation is [`@kernel.chat/kbot-finance`](../packages/kbot-finance/).

Coined and held by kernel.chat (ISSUE 381, May 12 2026). Open to fork.

### 2. Orchestration — currently unnamed

The discipline of structuring how multiple agents pass work between each other. Routing, delegation, handoff protocols, blackboard patterns, multi-agent dispatch. Most agentic systems today either ignore this (single-agent loop) or solve it ad hoc per project.

Practitioners are visible: NousResearch, Anthropic's multi-agent harness, AutoGen, CrewAI, kernel.chat's specialist dispatch. The discipline has not coalesced under a name.

### 3. System primitives — agent-OS

The discipline of building the OS-layer primitives an agent runs on top of: permissions, namespaces, quotas, capabilities, taint tracking. [`packages/agent-os`](../packages/agent-os/) is the kernel.chat reference, positioned as "POSIX for AI agents." The MCP specification is a partial substrate at the protocol layer.

Coined and held by kernel.chat (`@kernel.chat/agent-os` v0.2.0-alpha, April 2026). Open to fork.

### 4. Curation — currently unnamed

The discipline of choosing which behaviors, skills, and tools an agent should ship with. Evidence-driven cuts. Skill provenance. Behaviour shaping. kbot v4.0's 670→100 skill cut with a public audit trail is one practitioner's version of this discipline. Hermes Agent's skill-document standard is another.

The discipline has not coalesced under a name. "Evidence-driven curation" or "agent product engineering" both partially fit; neither is in circulation.

### 5. Evaluation — currently named informally

The discipline of measuring whether agents are getting better at real work. METR, Anthropic's evaluation team, Replit Bench, SWE-bench, several smaller benches. The discipline has practitioners, conferences, and a growing vocabulary; "agent evaluation" or "agent benchmarking" both function.

Not a kernel.chat focus. Other parties carry it well.

### 6. Operations — currently unnamed

The discipline of running agents in production: cost containment, latency budgets, error recovery, incident response, on-call shape, observability. Closest existing analogue is SRE; the agent-specific version doesn't have a name. Practitioners exist at every company running agents at scale.

The naming move here is open. "Agent SRE" is one obvious candidate. The discipline is real and unowned.

---

## The kernel.chat position

kernel.chat is the magazine of agentic engineering as a field. The editorial beat is the whole field; the disciplines we have coined and shipped reference implementations for are provenance engineering and agent-OS.

Three commitments follow from that position.

First, we will not try to claim the field name itself. Agentic engineering is in too much circulation to be claimed by one publication. We cover it; we don't own it.

Second, we will continue to coin sharper disciplines inside the field where the work warrants. Provenance engineering was the first; agent-OS was implicit in agent-os/v0.2.0-alpha; orchestration, curation, and operations may follow if the work merits it. Each named discipline ships with a reference role definition (a ROLE.md-style document) and a reference open-source implementation under MIT or Apache-2.0.

Third, we will cover the disciplines we don't name with the same editorial seriousness. The magazine reads the field, not just our own corner of it. Evaluation work happening at METR matters to us even though we don't do it. Operations work at companies running agents at scale matters even though no name is attached.

---

## How to contribute

This map will go stale fast. The field is moving. Three contribution shapes are welcome:

1. **Fork a discipline name.** Take "agent SRE" or "evidence-driven curation" or any of the unnamed disciplines above and write a ROLE.md for it. Define the question the discipline answers, the object it produces, the engineering rule it enforces. Publish under CC BY 4.0. If it lands in circulation, the field has gained a discipline.

2. **Ship a reference implementation.** Open-source, MIT or Apache-2.0, working code that demonstrates the discipline. Most disciplines coalesce around reference implementations, not papers.

3. **Read a discipline in the magazine.** If you operate in one of the unnamed disciplines and want the editorial frame, write to kernel.chat. We will cover work that demonstrates the discipline at a level worth circulating.

---

## Open questions at field level

The disciplines listed above are not the whole map. Five open questions about the field itself are unresolved and worth naming:

1. **Does agentic engineering require a license discipline?** Lawyers are not yet visible in this field at the rate the work needs. The question of who is liable when an agent acts is unresolved across jurisdictions.

2. **Is there an agentic engineering equivalent of the Joel Test?** A short checklist that distinguishes serious agentic engineering shops from cosplay. The field needs one.

3. **Does the field cohere as a degree program?** "Agentic engineering" as an undergraduate concentration would imply field maturity. Today the disciplines are too young.

4. **What is the field's relationship to safety research?** Safety research and agentic engineering currently run on parallel tracks with limited integration. The right relationship is unclear.

5. **What is the field's relationship to the model layer below it?** Open weights commoditize the model; the field is increasingly stack-agnostic. But agentic engineering practiced at the frontier still depends on lab-quality model behavior. The interface between field and lab needs naming.

---

*This document is licensed CC BY 4.0. Fork it. Improve it. Disagree with it in public. The field will benefit from the argument.*
