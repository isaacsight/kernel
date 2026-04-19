# Baseline: learned-router accuracy on observer data

**Generated:** 2026-04-19T19:35:32.879Z
**Script:** `packages/kbot/research/action-tokens/baseline-measure.ts`
**Data:** `~/.kbot/observer/session.jsonl` (24145 events, 73 sessions, 115 unique tools)
**Router:** `packages/kbot/src/learned-router.ts` — measured unmodified.

---

## Methodology

### What we are measuring

The action-token proposal (§2) frames routing as next-tool prediction given
prior-action context. `learned-router.ts` does **not** do that. It takes a
user-message string and returns one agent via a cascade: exact intent match
→ Bayesian skill rating → keyword vote → category pattern → null (LLM).

To bridge these two prediction heads we made three choices, any of which
biases the numbers — read the caveats section.

### Intent-signal reconstruction

For every non-first tool call in each session, we built a pseudo-user-message
from the prior 5 events by concatenating (a) up to 4 recent
text-bearing argument fields (`description`, `query`, `prompt`, `message`,
`pattern`, or path basenames), and (b) the 5 most recent tool names. Events
with no reconstructable intent signal are skipped and counted separately.
The observer log does **not** persist user turns — this reconstruction is
the best proxy we have without re-instrumenting kbot.

### Ground-truth label

Each observed tool call is mapped to one of 16 agents via a substring
classifier (`labelTool()` in `baseline-measure.ts`) mirroring the router's
AGENT_KEYWORDS worldview. Tools that don't match a specialist cluster are
labeled `kernel` (generalist). Rule-derived labels, not hand-labeled.

### Top-K extraction

`learnedRoute` returns one pick. We generate a ranking over all agents by
extending with the same keyword-vote logic the router uses and padding with
the remaining agent set. Top-1 is the router's real cascade output when
non-null; Top-5 / Top-10 are an **upper bound** on any extended-ranking
behavior.

### Excluded events

All `daemon_*` events (per proposal §2.2 — daemon calls don't reflect user
intent).

---

## Headline numbers

| Metric | Value |
|---|---|
| Total observer events | **24145** |
| Unique sessions | **73** |
| Unique tools | **115** |
| Tool calls scored (non-daemon, intent reconstructable) | **19791** |
| Tool calls skipped (no usable intent signal) | 10 |
| **Top-1 accuracy** | **51.8%** |
| **Top-5 accuracy** | **91.8%** |
| **Top-10 accuracy** | **100.0%** |

### Data sufficiency verdict

**Sufficient for baseline.** 19791 scored tool calls across 73 sessions comfortably clears the 100-call minimum and produces a stable top-K estimate. The sample is dominated by a small number of long engineering sessions, so per-category numbers for low-volume buckets (ableton, trader, social) should be treated as directional only.

---

## Per-category breakdown

Categories are coarse buckets over the 115 observed tools
(mapping in `labelTool`).

| Category | Samples | Top-1 | Top-5 | Top-10 |
|---|---:|---:|---:|---:|
| `file-ops` | 7573 | 64.4% | 97.5% | 100.0% |
| `shell` | 5443 | 61.3% | 96.9% | 100.0% |
| `search` | 2240 | 56.2% | 97.2% | 100.0% |
| `web` | 1462 | 0.0% | 76.8% | 100.0% |
| `ableton` | 962 | 0.0% | 99.2% | 100.0% |
| `computer-use` | 444 | 73.9% | 74.8% | 100.0% |
| `other` | 437 | 19.2% | 40.5% | 100.0% |
| `delegation` | 412 | 43.2% | 52.9% | 100.0% |
| `planning` | 221 | 0.0% | 76.0% | 100.0% |
| `mcp-ops` | 194 | 56.7% | 95.9% | 100.0% |
| `science` | 182 | 0.0% | 0.0% | 100.0% |
| `browser` | 95 | 40.0% | 100.0% | 100.0% |
| `memory` | 72 | 6.9% | 36.1% | 100.0% |
| `git` | 52 | 48.1% | 100.0% | 100.0% |
| `social` | 2 | 0.0% | 100.0% | 100.0% |

### Data not scored (no reconstructable intent signal)

These categories are under-represented above because their tool calls had
no text-bearing argument and insufficient prior context. That is itself a
finding: the router has nothing to consume on these calls today.

| Category | Skipped events |
|---|---:|
| `other` | 6 |
| `search` | 1 |
| `web` | 1 |
| `delegation` | 1 |
| `file-ops` | 1 |

---

## Honest caveats

1. **The router does not consume prior-action context.** It consumes a user
   message string; we fed it a reconstruction. Its real production behavior
   is to see the actual user turn, which we don't have in the observer log.
   These numbers estimate the router's ceiling on prior-action-only input —
   the fair comparand for the action-token proposal, but **not** a
   measurement of production performance on real user messages.

2. **Top-5 / Top-10 are an upper bound.** `learnedRoute` returns a single
   agent. We synthesized a ranking from the same keyword-vote logic. A
   neural model emitting a true distribution has a structural advantage at
   K>1; the baseline should not be read as a hard floor on multi-candidate
   comparisons.

3. **Ground-truth labels are rule-derived, not hand-labeled.** The label
   function and the router both live in this repo and share vocabulary,
   which biases numbers upward. A 200-call hand-labeled subset would
   calibrate this and is a cheap follow-up.

4. **Argument-text leakage.** Intent reconstruction uses `description`
   fields written by Claude Code / kbot, which already know what they're
   about to do. Descriptions can preview the intended next tool, which
   inflates the baseline vs what a pure tool-id model would see. The
   action-token proposal explicitly drops argument text — if it matches
   this baseline *without* description leakage, the real win is larger
   than the raw delta suggests.

5. **Class imbalance.** `coder` dominates (file ops + shell + grep + git).
   Always-predict-`coder` would score well. Look at per-category numbers,
   not the aggregate, to judge whether the baseline actually discriminates.

---

## Comparison target for the action-token model

For a neural action-token model to beat this baseline by a margin that
justifies shipping (vs. a ~50 LOC hand-written router that compiles in 0 ms
and needs no training pipeline), it needs to hit:

| Metric | Baseline | Ship bar |
|---|---:|---:|
| Top-1 | 51.8% | **≥ 61.8%** |
| Top-5 | 91.8% | **≥ 98.0%** |

Lifts below those thresholds mean we're paying the complexity cost of a
trained model for a rounding-error improvement. The lift must also
generalize across categories — a model that only improves `coder` and not
`producer` or `researcher` is not worth shipping, since `coder` is already
the easiest route.

### What would enable a stronger baseline

- **Hand-labeled ground truth** (200–500 calls): replace rule-derived
  labels with what a human says the correct route was.
- **User-turn logging**: add a hook that writes the user message to the
  same stream as tool calls. Today the router sees user messages at
  runtime, but the observer log doesn't persist them — we can't replay
  the router's true input distribution.
- **Outcome labels**: record whether a route succeeded (user did not
  override) alongside the tool-call event. Today this is in
  `~/.kbot/memory/routing-history.json` but not aligned to the observer
  stream.
- **Per-session train/val split**: don't leak within a debugging flow.
  More important for the neural model than for the heuristic.

---

## Reproducibility

```
cd packages/kbot && npx tsx research/action-tokens/baseline-measure.ts
```

Re-run whenever the observer log grows or `learned-router.ts` changes.
