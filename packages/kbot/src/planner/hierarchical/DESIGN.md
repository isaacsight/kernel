# Hierarchical Planner — Design

_Status: design-stage. The `types.ts` schema and the `HierarchicalPlanner`
class stub in this directory are the load-bearing artifacts. The rest of
this document is the plan for filling them in._

---

## 1. Motivation

kbot's current planner (`packages/kbot/src/planner.ts`) is a single-tier
design: one LLM call produces a flat list of `PlanStep`s, and every user
turn pays Sonnet-grade cost for both the strategic framing ("what is this
session trying to accomplish?") and the tactical framing ("which tool, with
which args, next?"). That's wasteful along three axes:

1. **Token axis.** The system prompt for the planner re-states goal context
   on every turn, so we keep paying Sonnet rates to re-derive facts that
   don't change for hours.
2. **Latency axis.** Tool actuation — the single highest-frequency event in
   a session — happens inside the same model call that is doing strategy.
   Latency is dominated by the strategic tokens we didn't actually need to
   regenerate.
3. **Reliability axis.** When a tool call fails we either (a) give up, or
   (b) re-run the whole planner. There is no intermediate scope for
   "rewrite just this step" vs. "the whole phase is wrong."

The cleanest prior art for cost-partitioned generation is Suno's 3-stage
transformer: **semantic → coarse acoustic → fine acoustic.** Semantic tokens
are expensive but generated rarely (one stream per song). Coarse acoustic
tokens are cheaper, generated per ~1-second frame, conditioned on the
semantic stream. Fine acoustic tokens are the cheapest of all, generated at
the sample rate, conditioned on the coarse stream. The insight: **higher
temporal resolution should run cheaper models, conditioned on the outputs
of slower, more expensive models above it.**

A coding agent has the same structure. Long-horizon intent ("ship the
hierarchical planner") is stable for days. Mid-horizon phase ("we are in
debug mode on the tier-3 tests") is stable for hours. Per-turn action ("fix
the failing test in x.test.ts") is stable for minutes. Per-call tool
invocation ("run `npx vitest run x.test.ts`") is stable for seconds. We
should be paying commensurate rates.

That's what this planner is.

---

## 2. Tier Definitions

Four tiers. Each is a typed record (see `types.ts`) and has a horizon, a
model, a trigger, and a persistence slot.

### Tier 1 — `SessionGoal`

- **Horizon:** days → weeks.
- **Model:** Opus.
- **Trigger:** new top-level user objective, or explicit `kbot goal ...`
  command. Not re-planned inside a session barring major scope shift.
- **Persistence:** `~/.kbot/planner/goals/<id>.json`.

A SessionGoal encodes _what success looks like_. It has acceptance
criteria, tags, and a lifecycle. It is the only tier the human user cares
about reading directly.

### Tier 2 — `Phase`

- **Horizon:** hours.
- **Model:** Opus.
- **Trigger:** mode shift detected (explore → build, build → debug, …)
  _or_ exit criteria of the active phase met.
- **Persistence:** `~/.kbot/planner/phases/<goalId>/<id>.json`.

A Phase encodes _which mode the agent is in and why_. The `PhaseKind` enum
(`explore | build | debug | review | write | refactor | deploy | other`)
intentionally mirrors the categories `learned-router.ts` already classifies
turns into, so a Phase can be advanced by the same routing signal.

A Phase has scope (files/subsystems) and exit criteria. When exit criteria
are met _or_ the routing signal disagrees for N consecutive turns, the
Phase is closed and a new one is opened.

### Tier 3 — `Action`

- **Horizon:** minutes — exactly one user turn.
- **Model:** Sonnet.
- **Trigger:** every user turn.
- **Persistence:** `~/.kbot/planner/actions/<phaseId>/<id>.json`.

An Action is the turn-level plan: a short summary + an ordered list of
`ActionStep`s. `ActionStep` _extends_ the existing `PlanStep` from
`planner.ts`, so we stay wire-compatible with `executePlan()` today.

Actions are small (typically 1–6 steps). They reference the active Phase
and Goal by id so the Sonnet prompt can be short: the heavy framing lives
in the Phase record, not in the per-turn prompt.

### Tier 4 — `ToolCallSpec`

- **Horizon:** seconds — one tool call.
- **Model:** Haiku.
- **Trigger:** every step of every Action.
- **Persistence:** not durably stored; logged into `~/.kbot/planner/verdicts/`
  as part of the verdict record.

A ToolCallSpec is the final low-level invocation: the tool name, the args,
a `SideEffectClass`, an optional expected outcome, and an optional timeout.
Haiku's job is narrow: take an `ActionStep` and the active scope, and emit
a fully-bound tool call. Because the Action already picked the tool, Haiku
is usually just filling in args from context and classifying the side
effect.

---

## 3. Token Schemas (summary; canonical source is `types.ts`)

```
SessionGoal   : id, title, intent, acceptance[], tags?, createdAt, updatedAt, status
Phase         : id, goalId, kind, objective, exitCriteria[], scope?, startedAt, endedAt?, status
Action        : id, phaseId, userTurn, summary, steps: ActionStep[], expectedAgents?, createdAt, status
ActionStep    : extends PlanStep (from ../../planner.ts — id, tool, args, agent, reads, writes, dependsOn, status)
ToolCallSpec  : id, actionId, stepId, tool, args, sideEffect: SideEffectClass, expectedOutcome?, timeoutMs?
TierVerdict   : decision: VerdictDecision, tier, reason, evidence?
TurnMetrics   : tier1Calls, tier2Calls, tier3Calls, tier4Calls, tokensIn, tokensOut, wallMs
PlannerResult : goal, phase, action, verdicts[], metrics
```

Two enums do real work:

- `PhaseKind` — 8 values, chosen to match `learned-router.ts` categories.
  If routing classifies N turns in a row as a different kind, we close the
  Phase.
- `SideEffectClass` — 7 values (`pure | read | write | exec | network |
  destructive | external`). This maps 1:1 to the permission gates already
  in the tool pipeline. Giving Haiku the job of classifying each call
  means the pipeline can enforce ("destructive requires confirm") without
  a separate LLM pass.
- `VerdictDecision` — 5 values (`continue | revise-action | revise-phase
  | revise-goal | abort`). This is the up-delegation ladder in §7.

---

## 4. Model Assignment

| Tier | Token          | Model  | Why                                                             |
| ---- | -------------- | ------ | --------------------------------------------------------------- |
| 1    | `SessionGoal`  | Opus   | Rare, high-impact. Cost of a bad goal ripples for days.         |
| 2    | `Phase`        | Opus   | Rare. Correct `PhaseKind` drives routing + system-prompt swap.  |
| 3    | `Action`       | Sonnet | Per turn. Sonnet is what today's planner already uses.          |
| 4    | `ToolCallSpec` | Haiku  | Narrow: bind args, classify side-effect. Haiku is fast + cheap. |

Opus is used _sparingly_ — only when there is no cached goal/phase whose
acceptance/exit criteria still hold. The steady state of a multi-hour
working session is **zero Opus calls**.

### Why not Sonnet at Tier 1/2?

Goals and phases are the cheapest tokens to get wrong and the most
expensive to re-derive. The decision "is this turn still in the same
phase?" is a routing decision made by classification signals, not by a
full-model call — so Opus runs only when we genuinely need new strategy.
Using Opus here is a cheap insurance policy: at most a handful of calls
per week per user.

### Why not Opus at Tier 3?

Per-turn planning benefits from speed much more than from additional
reasoning headroom. Sonnet is already more than adequate for the "pick 3
tools in order" job, and the Phase record it's conditioned on absorbs most
of the reasoning load.

### Why Haiku at Tier 4?

Tool-call binding is a translation task. The Action already named the
tool; Haiku just fills in args and classifies the side effect. Haiku's
speed matters because we pay this cost per step, and a user turn can have
many steps.

---

## 5. Cost Analysis

### Today (single-tier `planner.ts`)

A representative 40-turn working session:

- 40 Sonnet calls (one per user turn) × ~6k input / ~1k output
- ~0 Opus calls, ~0 Haiku calls
- Total: **~40 Sonnet calls per session.**

### Hierarchical steady state

- Tier 1 (Opus): 0 calls. Active goal stays valid across the session.
- Tier 2 (Opus): 0 calls in steady state; 1 call per scope shift. An
  average session has 0–2 scope shifts.
- Tier 3 (Sonnet): 40 calls (one per turn — unchanged count).
- Tier 4 (Haiku): ~120 calls (avg 3 steps per turn).

Tier 3 Sonnet calls are **cheaper** than they are today because the Action
prompt no longer carries the strategic framing — that now lives in the
Phase record. We estimate Tier 3 input tokens drop ~40% once the Phase
record is populated.

### Cost ratio (steady state vs. today, at current API prices)

```
Today          : 40 × Sonnet(6k in + 1k out)
Hierarchical   : 40 × Sonnet(3.5k in + 1k out)
               + 120 × Haiku(1k in + 200 out)
               + ~0 Opus
```

Haiku at 120 calls is a rounding error against 40 Sonnet calls. Net
session cost drops roughly **30–40%**, with the kicker that the delta
grows as session length grows (Haiku scales with tool calls; Sonnet only
scales with turns).

### Failure mode cost

When a step fails, today we often re-run the whole planner (one Sonnet
call for nothing). Under the hierarchical model, a step failure issues a
`TierVerdict`; the cheapest upstream fix is chosen (usually
`revise-action`, which is one more Sonnet call, but often just a
step-level retry at Haiku level).

---

## 6. Decision Logic — When Each Tier Re-plans

### Tier 1 (Goal)

Re-planned when:

- No active goal exists for this project (first turn).
- User issues an explicit `kbot goal reset` or similar.
- Current goal's `acceptance` list has all items marked done (close +
  prompt for next).
- User turn clearly doesn't belong to any active goal (classifier-based).

Never re-planned inside a turn.

### Tier 2 (Phase)

Re-planned when:

- No active phase exists under the active goal.
- Current phase's exit criteria are met.
- Routing classifier returns a different `PhaseKind` for N consecutive
  turns (default N = 2). Single-turn detours don't close a phase.
- User explicitly switches mode (`kbot phase debug` or similar).

### Tier 3 (Action)

Re-planned **on every user turn**. This is the "one Sonnet call per turn"
surface. The Action's prompt includes:

- Goal id + title + intent
- Phase id + kind + objective + exit criteria
- Last N turns' summaries (short, from `context-manager.ts`)
- User's current turn verbatim

Critically the Action prompt does **not** include the long rationale that
lives on the Goal. That's the whole savings.

### Tier 4 (ToolCallSpec)

Re-planned per step. Haiku takes the ActionStep + active file scope and
emits a bound tool call. This runs in sequence with step execution; in
practice the Haiku call and the tool actuation are near-simultaneous.

### Verdicts trigger up-delegation

After each tool call, a `TierVerdict` is recorded. The decision field
(`continue | revise-action | revise-phase | revise-goal | abort`) says how
far up the ladder we need to go. See §7.

---

## 7. Failure Modes — The Up-Delegation Ladder

A good planner needs graceful failure. The rule here is **always try to
fix the problem at the cheapest tier first**, escalate only when the
evidence demands it.

### Ladder

```
tool error
   ↓
revise-action    (Sonnet: rewrite steps of this Action)
   ↓
revise-phase     (Opus: are we in the wrong mode?)
   ↓
revise-goal      (Opus: is this goal still the right one?)
   ↓
abort            (bubble up to user)
```

### Heuristics

- **Transient tool error** (timeout, rate limit, flaky network) →
  `continue` with retry at Tier 4.
- **Wrong args** (tool ran but output clearly mismatches step intent) →
  `revise-action`. The Action rewrites the step; no higher tier touched.
- **Wrong tool** (step's chosen tool cannot produce the required outcome)
  → `revise-action`. Same as above.
- **Wrong approach** (multiple Actions in a row have failed on the same
  surface) → `revise-phase`. The Phase re-opens; kind may change.
- **Wrong goal** (user correction — "no, I didn't mean to build that")
  → `revise-goal`.
- **User requests halt / destructive action blocked / unresolvable** →
  `abort`.

### Why this matters

The alternative — re-running the planner from scratch on every failure —
is both expensive (unnecessary Sonnet calls) and brittle (loses context of
_where_ the failure happened). The verdict system keeps the failure local
and records evidence upstream only when justified.

---

## 8. Integration with `learned-router.ts`

`learned-router.ts` already does per-turn classification into agent
categories. We reuse that signal at two tiers:

1. **Tier 2 trigger.** If `learned-router` classifies a turn into a
   different `PhaseKind` for two turns in a row, close the Phase and
   re-plan Tier 2. The `PhaseKind` enum is intentionally aligned to the
   router's category set.
2. **Tier 3 hint.** The Action prompt includes the router's top-1 and
   top-2 guesses as `expectedAgents`. Sonnet can override, but the hint
   keeps the per-turn plan biased toward specialists the learned model has
   seen succeed on similar turns.

This means zero additional inference at the planner level for routing —
the signal is already being computed.

---

## 9. Persistence — `~/.kbot/planner/`

```
~/.kbot/planner/
├── goals/
│   └── <goalId>.json              # SessionGoal records
├── phases/
│   └── <goalId>/
│       └── <phaseId>.json          # Phase records, indexed by goal
├── actions/
│   └── <phaseId>/
│       └── <actionId>.json         # Action records, indexed by phase
└── verdicts/
    └── <YYYY-MM-DD>.jsonl          # TierVerdict append-log, daily rotated
```

### Rules

- **Append-only for verdicts.** We never edit a past verdict — this is the
  audit log that tells us when the up-delegation ladder fired.
- **Atomic writes for goals/phases/actions.** Write to `<id>.json.tmp`
  then rename; the planner should never read a half-written record.
- **Garbage collection.** `completed | abandoned` goals older than 90 days
  get archived into `goals/_archive/`. Phases and actions follow their
  parent.
- **Portability.** The entire tree is JSON and self-contained. `kbot
  planner export` produces a tarball; `kbot planner import` slots it
  back in. No DB dependency.

### Why filesystem, not Supabase?

BYOK philosophy. The planner state is _the user's project memory_; it
belongs on the user's disk, not in our cloud. If the user wants sync, we
have `cloud-sync.ts` for opt-in; but default is local.

---

## 10. Integration Plan

### Phase A — types + stub (DONE)

- `types.ts` defines all five records.
- `session-planner.ts` exports `HierarchicalPlanner` with `planTurn()`.
- `planTurn()` wraps `autonomousExecute` 1:1, synthesizes stand-in Goal
  and Phase, counts steps for Tier-4 metrics.
- No behavior change; the existing CLI path is untouched.

### Phase B — persistence + Tier 1/2 loaders (next)

- Implement `loadActiveGoal()` / `loadActivePhase()` against
  `~/.kbot/planner/`.
- When none found, fall through to Opus to synthesize; otherwise reuse.
- Still delegate Tier 3 to `autonomousExecute`.

### Phase C — real Tier 3 prompt

- Replace the `autonomousExecute` delegation with a Sonnet call that
  references the active Goal + Phase records.
- Keep `executePlan` as the step executor — the Action's `steps` are
  `ActionStep[]` which extends `PlanStep`.

### Phase D — Tier 4 Haiku binding

- Insert a Haiku pass between Action step selection and tool pipeline
  actuation. Haiku fills unresolved args and assigns `SideEffectClass`.

### Phase E — verdict system + up-delegation

- Every tool-pipeline outcome emits a `TierVerdict`.
- The verdict drives the ladder described in §7.

### Phase F — router integration

- Wire `learned-router.ts` signals into Tier 2 trigger + Tier 3 hint.

Each phase ships independently; `planTurn()`'s return type never changes.

---

## 11. Non-goals

- **Not a workflow engine.** Long-running flows live in
  `background.ts` / `tasks.ts` / `parallel.ts`; the planner orchestrates a
  single conversation's worth of work, not background jobs.
- **Not a replacement for `executePlan`.** We keep the existing step
  execution loop. We only change how steps are _produced_ and _framed_.
- **Not a multi-agent supervisor.** That's `matrix.ts` and the agent
  system. The planner picks when to delegate but doesn't run agents
  itself.

---

## 12. Open questions

1. **How often is the PhaseKind classifier wrong in a way that churns
   Phase records?** We need telemetry before setting the N-consecutive-turn
   threshold; N=2 is a guess.
2. **Do we cache Haiku tool-bindings?** A stable Action replaying against
   the same scope should be able to skip Tier 4 entirely on the second
   call. Needs a cache key.
3. **Do goals nest?** MVP says no — flat list. If nesting proves useful
   we add a `parentGoalId?: string` field; the current schema is forward-
   compatible.
4. **Does Tier 2 need to observe test results?** Phase-level exit criteria
   like "all vitest tests pass" would let the Phase close itself without
   human prompt. Proposed for Phase E alongside verdicts.

---

## 13. Summary

Four tiers. Each one runs a model whose price matches its update rate.
Long-horizon intent stays in Opus-produced records that live on disk;
per-turn planning runs Sonnet on a short prompt; per-call binding runs
Haiku in a tight loop; failure triggers up-delegation rather than full
re-planning. Zero Opus calls in the steady state; ~30–40% token savings
per session; cleaner failure isolation; compatibility with the existing
`executePlan` step loop.

The types are in `types.ts`. The stub is in `session-planner.ts`. The
integration plan above lists the exact phases. Everything else is
execution.
