# Hierarchical Planner

A four-tier planner for kbot. Coarse intent is slow and expensive; fine
actuation is cheap and rewritten.

See [`DESIGN.md`](./DESIGN.md) for the full rationale, cost model, decision
logic, failure-mode ladder, and integration plan. This README is a one-page
pointer.

## The four tiers

| Tier | Token         | Horizon        | Model  |
| ---- | ------------- | -------------- | ------ |
| 1    | `SessionGoal` | days → weeks   | Opus   |
| 2    | `Phase`       | hours          | Opus   |
| 3    | `Action`      | minutes (turn) | Sonnet |
| 4    | `ToolCallSpec`| seconds        | Haiku  |

## Files

- `DESIGN.md` — full spec (read this first).
- `types.ts` — the four-tier schema + verdicts + metrics.
- `session-planner.ts` — `HierarchicalPlanner` class with `planTurn()`.
  Today this delegates to the legacy `autonomousExecute`; tier logic lands
  at the `TODO(tier*)` markers.
- `dag.ts` — TDP DAG node types + scoped-context builder. Phase 2 wraps
  `Phase` records as `DAGNode`s so descendants only see ancestor summaries,
  not the full history.

## Research grounding

- **TDP / scoped-context DAG** — "Beyond Entangled Planning" (arXiv:2601.07577).
  Up to 82% token reduction by replanning only failing nodes. See `dag.ts`.
- **Global-plan re-derivation** — GoalAct (arXiv:2504.16563). The global plan
  is re-derived every step from `(query, tools, history)` rather than held
  fixed — our Tier-1 update rule should mirror this.
- **ReAcTree control flow** — arXiv:2511.02424. Sequence/selector/parallel
  nodes bound tree depth and allow early-exit. Relevant to difficulty-gated
  deliberation.
- **Schema-gated validation** — "Talk Freely, Execute Strictly"
  (arXiv:2603.06394). Each tier emits a typed IR; a validator rejects
  ill-typed plans before descent.
- **Failure taxonomy (critic integration)** — arXiv:2601.22208 (RF-01..RF-16),
  consumed by `../../critic-taxonomy.ts`. Rejections attach a `failure_class`
  so FP rate is measurable per class.

## State

Persisted under `~/.kbot/planner/`:

```
~/.kbot/planner/
  goals/      SessionGoal records
  phases/     Phase records (indexed by goalId)
  actions/    Action records (indexed by phaseId)
  verdicts/   TierVerdict append-log
```

## Minimum usage

```ts
import { HierarchicalPlanner } from './hierarchical/session-planner.js'

const planner = new HierarchicalPlanner({ agentOpts, autoApprove: true })
const result = await planner.planTurn(userTurn)
```

## Cost target

Steady-state turn budget: **0 Opus calls**, **0–1 Sonnet calls**, **N Haiku
calls** where N = number of tool steps. Opus only fires when the goal or
phase needs to be (re)negotiated. See DESIGN.md §Cost Analysis.
