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
