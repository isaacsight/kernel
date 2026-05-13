# agent-os vs Claude Managed Agents

> Honest side-by-side analysis. Anthropic rolled out Claude Managed
> Agents (CMA) Apr 9, 2026, with material expansions May 5-7. This
> document maps the eight `agent-os` primitives onto CMA's surface,
> names what we should adopt from them, and names where we're
> uniquely positioned.
>
> Sources: docs.anthropic.com/managed-agents, the Anthropic
> Engineering blog post on "decoupling the brain from the hands,"
> the May 5 finance-agents announcement, Pluto Security's red-team
> writeup, and two VentureBeat pieces on vendor lock-in.

---

## Side-by-side primitive map

| agent-os primitive | Claude Managed Agents equivalent | Verdict |
|---|---|---|
| **spawn** (fork-style agent creation with declared identity) | `POST /v1/agents` + `POST /v1/sessions` + `multiagent.coordinator`. Two-tier object model (Agent + Session + Thread). Coordinator delegation is one level deep; max 25 concurrent threads; max 20 agents in roster. | Has it — but bundled with their backend, capped at one delegation level. |
| **acap** (delegable, scoped capability tokens) | Per-tool `always_allow` / `always_ask`; toolset bound at agent-create time. No per-invocation capability tokens. No delegation/attenuation. | **Partial.** Permissions are agent-level config, not per-call delegable tokens. Sub-agents get their own toolset, not a narrowed slice of the coordinator's. |
| **ns** (sibling namespace isolation) | Context-isolated session threads but **shared container filesystem** across siblings. gVisor separates session-from-outside-world but not sibling-from-sibling. | **Partial — filesystem shared by design.** We have the sibling-isolation primitive they don't. |
| **ulimit-tok** (per-agent token / cost / time quotas) | `max_iterations` (default 3, max 20) is a loose proxy. Token/cost/time reported in `usage` events but not enforced as a per-agent cap. Org-level rate limits. | **Mostly missing.** Iteration count is a proxy; resource enforcement is not first-class. |
| **chexec** (taint-tracked tool execution) | Tool confirmation flow via `user.tool_confirmation` events. Default toolset is `always_allow` (no human gate). gVisor sandbox + egress proxy. | **Partial.** Per-tool confirmation, not per-capability-token. Default is permissive. No taint tracking. |
| **audit** (queryable, exportable event log) | Append-only event log per session, durable, fetchable via SSE or paginated `GET /events`. Console dashboard. **Survives container crash.** | **Has it — and inside their walls, arguably stronger.** But: no documented portable export format; hard-delete erases the record. |
| **handoff** (cross-agent message + capability scoping) | `agent.thread_message_sent/received` events. Capabilities NOT scoped on handoff — each sub-agent uses its own pre-declared toolset. | **Partial.** Messaging exists; capability attenuation does not. |
| **snapshot** (checkpoint, rewind, fork) | `wake(sessionId)` rehydrates from event log; Agent SDK rewinds file edits. **Resume case yes; fork case no.** | **Has resume; missing fork.** No documented "snapshot → restore as N parallel forks." |

---

## Architecture overlap (their words)

The Anthropic Engineering post decouples the runtime into three components:

- **Brain (harness)** — stateless, outside the container, routes tool calls.
- **Hands (sandbox)** — gVisor container, treated as untrusted.
- **Session** — append-only event log, durable, outside the model's context window.

This is **essentially the same architecture agent-os exposes as primitives**, but inverted: CMA hides it behind a managed service; agent-os exposes it as composable POSIX-style verbs the operator owns.

The ownership inversion is the entire pitch.

---

## What CMA has that we should adopt

### 1. Credential vaults (server-side credential injection outside the sandbox)

The vault design is genuinely good:

- Credentials never enter the sandbox — a credential proxy outside the container injects auth server-side.
- This **structurally defeats prompt-injection credential theft**: the agent can't read secrets it can't access.
- Secret fields are write-only (never returned in responses).
- Periodic re-resolution propagates rotation/archival to running sessions without restart.
- One active credential per MCP server URL per vault; max 20 credentials per vault.

**Action for agent-os v0.2:** add a credential proxy primitive. Bind credentials to capability subjects (`{kind: 'mcp_server', server: '...'}`), inject them at the chexec boundary. Bake the "reference-by-name, inject server-side" pattern into the substrate.

### 2. Outcomes / rubric-graded self-evaluation

`user.define_outcome` + rubric + auto-graded iteration loop is novel. A grader runs in a separate context window, returns per-criterion feedback, and the agent self-revises up to `max_iterations`. Result codes: `satisfied | needs_revision | max_iterations_reached | failed | interrupted`.

**This is not a budget primitive — it's a goal/quality primitive.** agent-os has no equivalent. Worth a 9th primitive proposal: `goal(rubric)` or `with_outcome(criteria)`.

### 3. Event-log-first audit

agent-os audit is per-action. CMA treats the entire session as the log; tools, messages, status changes are all events. The session is the source of truth. Worth considering as the v0.2 audit model.

---

## What agent-os has that CMA doesn't

### 1. acap as a first-class delegable token

CMA has agent-level toolsets, not call-level capability passing. A sub-agent gets the toolset attached to its own agent record — there's no way to grant a sibling a narrowed slice of the coordinator's capabilities for the duration of one call.

agent-os's `downscope()` enforces strict capability subsetting on handoff. The kernel rejects escalation. This is structurally absent from CMA.

### 2. Sibling namespace isolation

CMA's multi-agent shares filesystem by design. agent-os `ns` separates sibling agents' views of memory, tools, and audit log. For multi-tenant deployments (multiple customer workloads on shared infrastructure), this matters.

### 3. Snapshot-as-fork

CMA has resume-from-crash; agent-os v0.2 will have fork-from-checkpoint. The difference: branching an agent's state into N parallel experiments. Useful for evals, A/B comparison, and rollback.

### 4. Provider portability

This is the entire pitch in one line. The eight agent-os primitives are an open spec. Your sandbox, your vault, your audit log, your event store — portable to any model provider, runnable on-prem. CMA gives you Anthropic's runtime; agent-os gives you a **runtime contract that survives a model-vendor change.**

---

## The enterprise pitch (after this analysis)

Three sentences:

> **agent-os does what Managed Agents doesn't:** a portable, provider-neutral primitive spec — capability tokens (acap), sibling namespaces (ns), and fork-able snapshots — that lets an enterprise own its agent runtime end to end and migrate model vendors without rewriting the orchestration layer.
>
> **Managed Agents does what agent-os doesn't:** server-side credential injection outside the sandbox (vaults), goal-driven self-evaluation with auto-graded iteration (outcomes), and a fully managed durable event log queryable from a console — three patterns agent-os should absorb.
>
> **The honest enterprise pitch:** if you've already bet the firm on Claude, CMA is faster; if you need optionality, on-prem residency, or a runtime contract that outlives any one model vendor, agent-os is the only thing in the market shaped like that.

---

## Roadmap impact

The May 13 v0.2 roadmap, in priority order:

1. **Adopt the credential vault pattern.** Add a `Vault` primitive to agent-os with the same reference-by-name + server-side-injection contract as CMA. Bind to capability subjects.
2. **Add the `outcomes` / rubric primitive.** Ninth primitive: `goal(rubric)` runs in a separate context, grades per-criterion, drives iteration. Borrows CMA's design verbatim — same UX, our runtime.
3. **Event-log-first audit.** Move from per-action audit envelopes to a per-session event log as the audit substrate. Keeps content-addressing; changes the indexing model.
4. **Ed25519 signatures for acap** (already on the v0.2 list).
5. **Snapshot/fork** (already on the v0.2 list).
6. **ns enforcement** (already on the v0.2 list).

The first three are direct lessons from CMA. Adopting them now closes the design gap and lets us pitch as "everything Managed Agents does, plus portable + delegable + sibling-isolated."

---

## Lock-in concretely (what we say to a buyer)

When a buyer is evaluating both, the differentiators are:

1. **Session data lives in Anthropic's database with no portable export format.**
2. **Memory, outcomes (evals), and orchestration are all Anthropic-native primitives** — migrating means rewriting against another vendor's primitives.
3. **Vaults are workspace-scoped to Anthropic's API key.**
4. **Sandbox + harness + model are bundled.** Can't bring your own sandbox to their harness.
5. **Data residency** is a documented concern for compliance-sensitive buyers.

For the EU AI Act, FCA SS1/23, Fed SR 26-02, MAS, and HKMA buyer set — where data residency and provider-portability are not negotiable — agent-os is structurally the only credible answer in the market.

For everyone else, CMA is faster.

---

*v0.1 · 2026-05-13 · CC BY 4.0 · Update as both surfaces evolve.*
